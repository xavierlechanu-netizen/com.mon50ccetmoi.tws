/**
 * revolut-merchant.js — API Merchant de Revolut (création et lecture des commandes), 18/11/2026.
 *
 * Remplace l'appel fait par la Cloud Function createRevolutOrder (functions/api/payments.js), coupée
 * avec la facturation Google le 14/11/2026. Même requête, même version d'API.
 *
 * Configuration (.env du VPS, jamais dans l'appli) :
 *   REVOLUT_SECRET_KEY : clé secrète Merchant (sk_…). Absente : les paiements répondent « non configuré ».
 *   REVOLUT_ENV        : "sandbox" pour les essais (clé du compte de test Revolut), sinon production.
 * L'appli ouvre la fenêtre de paiement dans le même environnement (champ `mode` de la commande).
 *
 * Testé : tests/sovereign-payments.test.js (Revolut simulé).
 */
"use strict";

const API_BASES = {
    prod: "https://merchant.revolut.com/api",
    sandbox: "https://sandbox-merchant.revolut.com/api",
};
// Même version que l'ancienne Cloud Function (functions/api/shared.js)
const DEFAULT_API_VERSION = "2026-04-20";
const TIMEOUT_MS = 10000;
const ORDER_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

class RevolutError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "RevolutError";
        this.status = status;
    }
}

/**
 * @param {{secretKey: string, mode?: "prod"|"sandbox", apiVersion?: string, fetchImpl?: Function, timeoutMs?: number}} opts
 */
function createRevolutClient({ secretKey, mode = "prod", apiVersion = DEFAULT_API_VERSION, fetchImpl = fetch, timeoutMs = TIMEOUT_MS }) {
    if (!secretKey) throw new Error("REVOLUT_SECRET_KEY manquante.");
    const base = API_BASES[mode] || API_BASES.prod;

    async function call(method, path, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetchImpl(`${base}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    "Revolut-Api-Version": apiVersion,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            if (!res.ok) {
                // Le détail de Revolut va dans le journal du serveur, jamais au pilote
                const detail = await res.text().catch(() => "");
                console.error(`[Revolut] ${method} ${path} → ${res.status} ${String(detail).slice(0, 300)}`);
                throw new RevolutError("Revolut a refusé la demande.", res.status);
            }
            return await res.json();
        } catch (e) {
            if (e instanceof RevolutError) throw e;
            throw new RevolutError(e && e.name === "AbortError" ? "Revolut ne répond pas." : "Revolut injoignable.", 0);
        } finally {
            clearTimeout(timer);
        }
    }

    /** Lecture des seuls champs utiles (montant en centimes, état en majuscules). */
    function normalize(o) {
        const amount = typeof o.amount === "number" ? o.amount
            : (o.order_amount && typeof o.order_amount.value === "number" ? o.order_amount.value : null);
        const currency = o.currency || (o.order_amount && o.order_amount.currency) || null;
        return { id: o.id, token: o.token || o.public_id || null, state: String(o.state || "").toUpperCase(), amount, currency,
            checkoutUrl: o.checkout_url || null };
    }

    return {
        mode: mode === "sandbox" ? "sandbox" : "prod",

        /**
         * @param {{amountCents: number, currency: string, description: string, reference: string, metadata: object, redirectUrl?: string}} order
         *   redirectUrl : page où Revolut renvoie le client après un paiement réussi sur sa page de paiement
         */
        async createOrder({ amountCents, currency, description, reference, metadata, redirectUrl }) {
            const o = normalize(await call("POST", "/orders", {
                amount: amountCents,
                currency,
                capture_mode: "automatic",
                merchant_order_ext_ref: reference,
                description,
                metadata,
                ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
            }));
            if (!o.id || !o.token) throw new RevolutError("Réponse de Revolut incomplète.", 502);
            return o;
        },

        async getOrder(orderId) {
            if (!ORDER_ID_RE.test(String(orderId))) throw new RevolutError("Identifiant de commande invalide.", 400);
            return normalize(await call("GET", `/orders/${encodeURIComponent(orderId)}`));
        },
    };
}

/** Client configuré par l'environnement, ou null si la clé secrète n'est pas en place. */
function revolutClientFromEnv(env = process.env) {
    if (!env.REVOLUT_SECRET_KEY) return null;
    return createRevolutClient({
        secretKey: env.REVOLUT_SECRET_KEY,
        mode: env.REVOLUT_ENV === "sandbox" ? "sandbox" : "prod",
        apiVersion: env.REVOLUT_API_VERSION || DEFAULT_API_VERSION,
    });
}

module.exports = { createRevolutClient, revolutClientFromEnv, RevolutError, API_BASES, ORDER_ID_RE };
