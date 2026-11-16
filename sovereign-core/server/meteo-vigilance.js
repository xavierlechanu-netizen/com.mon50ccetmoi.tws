/**
 * Vigilance Météo-France (carte en cours), pour l'appli : remplace la Cloud Function Firebase
 * getVigilanceMeteo (functions/api/services.js), à l'arrêt depuis le 14/11/2026.
 *
 * - La clé Météo-France (METEO_FRANCE_API_KEY) reste sur le serveur, jamais dans l'appli.
 * - Mémoire tampon de 10 min : Météo-France est interrogé au plus une fois par période, quel que
 *   soit le nombre de pilotes ; les demandes qui arrivent pendant un appel attendent ce même appel.
 * - Météo-France muet ou en erreur : dernière carte connue, marquée « stale: true » (24 h au plus,
 *   au-delà elle ne dit plus rien d'utile), sinon { error, fallback: true }.
 * - Sans clé : { error, fallback: true }. Le serveur démarre quand même.
 *
 * Clé : portail-api.meteofrance.fr, API « Données Publiques Vigilance », clé d'API (« API Key »)
 * envoyée dans l'en-tête « apikey ». Mode d'emploi : deploy/README.md, étape 9 bis.
 *
 * Format de la réponse (inchangé, transmis tel quel) :
 *   product.periods[] : { echeance: "J" | "J1", timelaps: { domain_ids: [ { domain_id, max_color_id,
 *   phenomenon_items: [ { phenomenon_id, phenomenon_max_color_id } ] } ] } }
 *   Couleurs : 1 vert, 2 jaune, 3 orange, 4 rouge. Lu par src/js/vigilance-meteo.js.
 */
"use strict";

const VIGILANCE_URL = "https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours";
const CACHE_MS = 10 * 60 * 1000;
const STALE_MAX_MS = 24 * 3600 * 1000;
const TIMEOUT_MS = 8000;

const CACHE_FRAIS = "public, max-age=300";
// Repli : le navigateur ne garde rien, le prochain passage redemande une carte à jour.
const CACHE_REPLI = "no-store";

const repli = (error) => ({ error, fallback: true });

/**
 * @param {object} cfg { apiKey, fetchImpl?, now?, cacheMs?, staleMaxMs?, timeoutMs?, log? }
 */
function createVigilanceService(cfg = {}) {
    const apiKey = typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : "";
    const fetchImpl = cfg.fetchImpl || globalThis.fetch;
    const now = cfg.now || (() => Date.now());
    const cacheMs = cfg.cacheMs || CACHE_MS;
    const staleMaxMs = cfg.staleMaxMs || STALE_MAX_MS;
    const timeoutMs = cfg.timeoutMs || TIMEOUT_MS;
    const log = cfg.log || console;

    let cache = null; // { data, at }
    let enCours = null; // appel à Météo-France en cours, partagé

    async function demanderCarte() {
        const res = await fetchImpl(VIGILANCE_URL, {
            headers: { apikey: apiKey, Accept: "application/json" },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 401 || res.status === 403) {
            throw new Error(`clé refusée (HTTP ${res.status}) : expirée ou sans abonnement à l'API Vigilance ?`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Une erreur renvoyée en 200 ne doit pas remplacer la dernière vraie carte
        if (!data || typeof data !== "object" || !data.product || !Array.isArray(data.product.periods)) {
            throw new Error("réponse sans carte de vigilance");
        }
        return data;
    }

    function rafraichir() {
        if (!enCours) {
            enCours = demanderCarte()
                .then((data) => {
                    cache = { data, at: now() };
                    return true;
                })
                .catch((e) => {
                    // Jamais la clé dans le journal : seulement le statut ou le type d'erreur
                    log.error("[Meteo] Météo-France indisponible :", e && e.message);
                    return false;
                })
                .finally(() => {
                    enCours = null;
                });
        }
        return enCours;
    }

    return {
        configured: Boolean(apiKey),
        /** @returns {Promise<{ body: object, cacheControl: string }>} */
        async current() {
            if (cache && now() - cache.at < cacheMs) return { body: cache.data, cacheControl: CACHE_FRAIS };
            if (!apiKey) {
                return { body: repli("Vigilance Météo-France non configurée sur ce serveur."), cacheControl: CACHE_REPLI };
            }
            if (await rafraichir()) return { body: cache.data, cacheControl: CACHE_FRAIS };
            if (cache && now() - cache.at < staleMaxMs) {
                return { body: { ...cache.data, stale: true }, cacheControl: CACHE_REPLI };
            }
            return { body: repli("Données Météo-France indisponibles"), cacheControl: CACHE_REPLI };
        },
    };
}

/** Service depuis les variables d'environnement (METEO_FRANCE_API_KEY facultative). */
function vigilanceServiceFromEnv(env = process.env, extra = {}) {
    return createVigilanceService({ apiKey: env.METEO_FRANCE_API_KEY || "", ...extra });
}

module.exports = { createVigilanceService, vigilanceServiceFromEnv, VIGILANCE_URL, CACHE_MS, STALE_MAX_MS };
