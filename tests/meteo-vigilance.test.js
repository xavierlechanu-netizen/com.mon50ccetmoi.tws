/**
 * @jest-environment node
 *
 * Vigilance Météo-France : déménagée de la Cloud Function getVigilanceMeteo (à l'arrêt depuis le
 * 14/11/2026) vers le serveur souverain, route publique GET /api/v1/meteo/vigilance.
 * - serveur : clé gardée sur le serveur, carte gardée 10 min, ancienne carte « stale », repli sans clé ;
 * - appli (src/js/vigilance-meteo.js) : lecture de la vraie structure de la carte Météo-France.
 */
const fs = require("fs");
const path = require("path");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createVigilanceService, VIGILANCE_URL } = require("../sovereign-core/server/meteo-vigilance");

const CLE = "cle-de-test-meteo-france";

// Extrait de la carte Météo-France (DPVigilance v1, cartevigilance/encours)
function carte({ rougeJ = true } = {}) {
    return {
        product: {
            update_time: "2026-11-16T06:00:00Z",
            periods: [
                {
                    echeance: "J1",
                    timelaps: {
                        domain_ids: [
                            { domain_id: "13", max_color_id: 4, phenomenon_items: [{ phenomenon_id: "6", phenomenon_max_color_id: 4 }] },
                        ],
                    },
                },
                {
                    echeance: "J",
                    timelaps: {
                        domain_ids: [
                            { domain_id: "75", max_color_id: 1, phenomenon_items: [{ phenomenon_id: "1", phenomenon_max_color_id: 1 }] },
                            {
                                domain_id: "29",
                                max_color_id: rougeJ ? 4 : 3,
                                phenomenon_items: [
                                    { phenomenon_id: "1", phenomenon_max_color_id: rougeJ ? 4 : 3 },
                                    { phenomenon_id: "2", phenomenon_max_color_id: 2 },
                                ],
                            },
                            { domain_id: "2910", max_color_id: 3, phenomenon_items: [{ phenomenon_id: "9", phenomenon_max_color_id: 3 }] },
                            { domain_id: "56", max_color_id: 2, phenomenon_items: [{ phenomenon_id: "3", phenomenon_max_color_id: 2 }] },
                        ],
                    },
                },
            ],
        },
    };
}

const reponse = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

/** Faux fetch : répond dans l'ordre les réponses données (une Error = panne réseau). */
function fauxFetch(...reponses) {
    const appels = [];
    const fn = async (url, init) => {
        appels.push({ url, init });
        const r = reponses.length > 1 ? reponses.shift() : reponses[0];
        if (r instanceof Error) throw r;
        return r;
    };
    fn.appels = appels;
    return fn;
}

const journalMuet = () => ({ lignes: [], error(...a) { this.lignes.push(a.join(" ")); } });

function invoke(app, method, url, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = { method, url, headers, socket: { remoteAddress: headers.ip || "203.0.113.7" } };
        const entetes = {};
        const res = {
            statusCode: 200,
            setHeader(k, v) { entetes[k.toLowerCase()] = v; },
            end(payload) { resolve({ status: this.statusCode, headers: entetes, body: payload ? JSON.parse(payload) : null }); },
        };
        app.handleRequest(req, res, Buffer.alloc(0)).catch(reject);
    });
}

describe("Vigilance Météo-France sur le serveur souverain", () => {
    test("sans clé : le serveur démarre et la route répond « fallback », sans appeler Météo-France", async () => {
        const avant = process.env.METEO_FRANCE_API_KEY;
        delete process.env.METEO_FRANCE_API_KEY;
        try {
            const app = createSovereignApp();
            expect(app.vigilance.configured).toBe(false);
            const r = await invoke(app, "GET", "/api/v1/meteo/vigilance");
            expect(r.status).toBe(200);
            expect(r.body).toMatchObject({ fallback: true });
            expect(r.body.error).toEqual(expect.any(String));
            expect(r.headers["cache-control"]).toBe("no-store");
        } finally {
            if (avant !== undefined) process.env.METEO_FRANCE_API_KEY = avant;
        }
    });

    test("avec clé : carte du jour transmise telle quelle, clé dans l'en-tête apikey, jamais dans la réponse", async () => {
        const fetchImpl = fauxFetch(reponse(carte()));
        const app = createSovereignApp({ vigilance: createVigilanceService({ apiKey: CLE, fetchImpl }) });
        const r = await invoke(app, "GET", "/api/v1/meteo/vigilance");
        expect(r.status).toBe(200);
        expect(r.body).toEqual(carte());
        expect(r.headers["cache-control"]).toBe("public, max-age=300");
        expect(fetchImpl.appels).toHaveLength(1);
        expect(fetchImpl.appels[0].url).toBe(VIGILANCE_URL);
        expect(VIGILANCE_URL).toBe("https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours");
        expect(fetchImpl.appels[0].init.headers.apikey).toBe(CLE);
        expect(JSON.stringify(r)).not.toContain(CLE);
    });

    test("carte gardée 10 minutes : Météo-France interrogé au plus une fois par période", async () => {
        let t = 1_000_000;
        const fetchImpl = fauxFetch(reponse(carte()));
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl, now: () => t });
        const app = createSovereignApp({ vigilance });
        for (let i = 0; i < 5; i++) await invoke(app, "GET", "/api/v1/meteo/vigilance", { ip: `198.51.100.${i}` });
        expect(fetchImpl.appels).toHaveLength(1);
        t += 9 * 60 * 1000;
        await vigilance.current();
        expect(fetchImpl.appels).toHaveLength(1);
        t += 2 * 60 * 1000;
        await vigilance.current();
        expect(fetchImpl.appels).toHaveLength(2);
    });

    test("demandes simultanées : un seul appel à Météo-France", async () => {
        let libere;
        const attente = new Promise((r) => { libere = r; });
        const appels = [];
        const fetchImpl = async (url) => { appels.push(url); await attente; return reponse(carte()); };
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl });
        const toutes = Promise.all([vigilance.current(), vigilance.current(), vigilance.current()]);
        libere();
        const resultats = await toutes;
        expect(appels).toHaveLength(1);
        for (const r of resultats) expect(r.body).toEqual(carte());
    });

    test("Météo-France muet : dernière carte connue renvoyée avec stale: true", async () => {
        let t = 0;
        const log = journalMuet();
        const fetchImpl = fauxFetch(reponse(carte()), reponse({}, 503));
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl, now: () => t, log });
        const app = createSovereignApp({ vigilance });
        await invoke(app, "GET", "/api/v1/meteo/vigilance");
        t += 11 * 60 * 1000;
        const r = await invoke(app, "GET", "/api/v1/meteo/vigilance");
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ ...carte(), stale: true });
        expect(r.headers["cache-control"]).toBe("no-store");
        expect(log.lignes.join("\n")).toMatch(/HTTP 503/);
        expect(log.lignes.join("\n")).not.toContain(CLE);
    });

    test("ancienne carte de plus de 24 h : plus servie, repli « fallback »", async () => {
        let t = 0;
        const fetchImpl = fauxFetch(reponse(carte()), new Error("fetch failed"));
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl, now: () => t, log: journalMuet() });
        await vigilance.current();
        t += 23 * 3600 * 1000;
        expect((await vigilance.current()).body.stale).toBe(true);
        t += 2 * 3600 * 1000;
        expect((await vigilance.current()).body).toMatchObject({ fallback: true });
    });

    test("aucune carte connue et Météo-France en panne : { error, fallback: true }", async () => {
        const log = journalMuet();
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl: fauxFetch(new Error("fetch failed")), log });
        const r = await vigilance.current();
        expect(r.body).toEqual({ error: "Données Météo-France indisponibles", fallback: true });
        expect(r.cacheControl).toBe("no-store");
        expect(log.lignes).toHaveLength(1);
    });

    test("clé refusée (expirée) : message clair dans le journal, repli", async () => {
        const log = journalMuet();
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl: fauxFetch(reponse({ code: 900901 }, 401)), log });
        expect((await vigilance.current()).body.fallback).toBe(true);
        expect(log.lignes[0]).toMatch(/clé refusée \(HTTP 401\)/);
        expect(log.lignes[0]).not.toContain(CLE);
    });

    test("réponse 200 sans carte : jamais gardée à la place de la dernière vraie carte", async () => {
        let t = 0;
        const fetchImpl = fauxFetch(reponse(carte()), reponse({ message: "quota" }));
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl, now: () => t, log: journalMuet() });
        await vigilance.current();
        t += 11 * 60 * 1000;
        expect((await vigilance.current()).body).toEqual({ ...carte(), stale: true });
    });

    test("débit limité par adresse IP (429 + Retry-After), sans gêner les autres adresses", async () => {
        const vigilance = createVigilanceService({ apiKey: CLE, fetchImpl: fauxFetch(reponse(carte())) });
        const app = createSovereignApp({ vigilance, publicReadMaxRequests: 2, publicReadWindowMs: 60_000 });
        expect((await invoke(app, "GET", "/api/v1/meteo/vigilance")).status).toBe(200);
        expect((await invoke(app, "GET", "/api/v1/meteo/vigilance")).status).toBe(200);
        const trop = await invoke(app, "GET", "/api/v1/meteo/vigilance");
        expect(trop.status).toBe(429);
        expect(trop.headers["retry-after"]).toBe("60");
        expect((await invoke(app, "GET", "/api/v1/meteo/vigilance", { ip: "192.0.2.1" })).status).toBe(200);
    });

    test("route publique en lecture seule : POST refusé", async () => {
        const app = createSovereignApp({ vigilance: createVigilanceService({ apiKey: CLE, fetchImpl: fauxFetch(reponse(carte())) }) });
        expect((await invoke(app, "POST", "/api/v1/meteo/vigilance")).status).toBe(404);
    });
});

// --- Côté appli ---------------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(ROOT, "src/js/vigilance-meteo.js"), "utf8").replace(/^export /gm, "");
// Même méthode que les autres tests du projet pour charger un module ES sans transpilation
const V = new Function(`${code}; return { vigilanceUrl, nomZone, resumeVigilance, texteZonesRouges, chargerVigilance };`)();

const SOUVERAIN = { ACTIF: true, API_URL: "https://api.mon50ccetmoi.com/api/v1" };

describe("Lecture de la carte par l'appli (vigilance-meteo.js)", () => {
    test("adresse du serveur souverain, ou rien s'il n'est pas branché", () => {
        expect(V.vigilanceUrl(SOUVERAIN)).toBe("https://api.mon50ccetmoi.com/api/v1/meteo/vigilance");
        expect(V.vigilanceUrl({ ...SOUVERAIN, API_URL: "https://api.mon50ccetmoi.com/api/v1/" })).toBe("https://api.mon50ccetmoi.com/api/v1/meteo/vigilance");
        expect(V.vigilanceUrl({ ...SOUVERAIN, ACTIF: false })).toBeNull();
        expect(V.vigilanceUrl(undefined)).toBeNull();
    });

    test("noms des zones : départements, Corse, littoral", () => {
        expect(V.nomZone("29")).toBe("Finistère (29)");
        expect(V.nomZone("2A")).toBe("Corse-du-Sud (2A)");
        expect(V.nomZone("2910")).toBe("Finistère (29, littoral)");
        expect(V.nomZone("2B10")).toBe("Haute-Corse (2B, littoral)");
        expect(V.nomZone("ABC")).toBe("zone ABC");
    });

    test("carte du jour (J, pas J1) : niveau, zones en rouge et risques", () => {
        const r = V.resumeVigilance(carte());
        expect(r.niveau).toBe(4);
        expect(r.couleur).toBe("rouge");
        // Les Bouches-du-Rhône sont en rouge demain (J1) seulement : pas dans le bandeau du jour
        expect(r.zonesRouges).toEqual([{ zone: "Finistère (29)", risques: ["vent violent"] }]);
        expect(r.risques.sort()).toEqual(["orages", "pluie-inondation", "vagues-submersion", "vent violent"]);
        expect(r.perimee).toBe(false);
        expect(V.texteZonesRouges(r.zonesRouges)).toBe("Finistère (29) : vent violent");
    });

    test("sans rouge : pas de zone rouge, niveau orange", () => {
        const r = V.resumeVigilance(carte({ rougeJ: false }));
        expect(r.niveau).toBe(3);
        expect(r.zonesRouges).toEqual([]);
    });

    test("repli du serveur ou réponse inattendue : rien (null), ancienne carte signalée", () => {
        expect(V.resumeVigilance({ error: "Données Météo-France indisponibles", fallback: true })).toBeNull();
        expect(V.resumeVigilance(null)).toBeNull();
        expect(V.resumeVigilance({ product: { periods: [] } })).toBeNull();
        expect(V.resumeVigilance({ ...carte(), stale: true }).perimee).toBe(true);
    });

    test("de bout en bout : réponse du serveur lue par l'appli", async () => {
        const app = createSovereignApp({ vigilance: createVigilanceService({ apiKey: CLE, fetchImpl: fauxFetch(reponse(carte())) }) });
        const appels = [];
        const fetchAppli = async (url, init) => {
            appels.push({ url, init });
            const r = await invoke(app, "GET", new URL(url).pathname);
            return reponse(r.body, r.status);
        };
        const r = await V.chargerVigilance(SOUVERAIN, fetchAppli);
        expect(appels[0].url).toBe("https://api.mon50ccetmoi.com/api/v1/meteo/vigilance");
        // Route publique : l'appli n'envoie aucun jeton
        expect(appels[0].init.headers.Authorization).toBeUndefined();
        expect(r.zonesRouges[0].zone).toBe("Finistère (29)");
        expect(await V.chargerVigilance(SOUVERAIN, async () => reponse({}, 429))).toBeNull();
        expect(await V.chargerVigilance({ ACTIF: false }, fetchAppli)).toBeNull();
    });

    test("l'appli n'appelle plus la Cloud Function getVigilanceMeteo", () => {
        for (const f of ["src/js/app-features.js", "src/js/code-de-la-route.js"]) {
            const src = fs.readFileSync(path.join(ROOT, f), "utf8");
            expect(src).not.toMatch(/getVigilanceMeteo/);
            expect(src).toMatch(/chargerVigilance\(CONFIG\.SOVEREIGN\)/);
        }
    });

    test("CSP : l'appli peut joindre api.mon50ccetmoi.com (site principal et Firebase Hosting)", () => {
        const vite = fs.readFileSync(path.join(ROOT, "vite.config.js"), "utf8");
        expect(vite).toMatch(/'connect-src':[^\]]*'https:\/\/\*\.mon50ccetmoi\.com'/);
        const fb = fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8").match(/connect-src([^;"]*)/)[1];
        expect(fb).toContain("https://api.mon50ccetmoi.com");
    });
});
