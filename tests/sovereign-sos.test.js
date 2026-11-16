/**
 * @jest-environment node
 *
 * Alerte SOS du serveur souverain : SMS réels par OVHcloud (sovereign-core/server/sms-ovh.js).
 * Avant (Firebase), les SMS étaient déposés dans une file que rien ne lisait : aucun n'est jamais
 * parti, alors que l'appli annonçait « Ange(s) Gardien(s) notifiés par SMS ».
 */
const crypto = require("crypto");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createOvhSmsClient, normalizeFrenchMobile, toSmsText, ovhSignature, OVH_API } = require("../sovereign-core/server/sms-ovh");

function invoke(app, method, url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const raw = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
        const req = { method, url, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
        const res = {
            statusCode: 200,
            setHeader() {},
            end(payload) { resolve({ status: this.statusCode, body: payload ? JSON.parse(payload) : null }); },
        };
        app.handleRequest(req, res, raw).catch(reject);
    });
}

const LILLE = { lat: 50.6292, lng: 3.0573, accuracy: 12 };
const auth = (uid) => ({ Authorization: `Bearer ${signSovereignJwt({ uid, role: "user", username: uid })}` });

function fakeSms(answer) {
    const calls = [];
    return {
        calls,
        async send(job) {
            calls.push(job);
            if (answer instanceof Error) throw answer;
            return answer || { validReceivers: job.receivers, invalidReceivers: [], ids: [1] };
        },
    };
}

function makeApp(smsClient) {
    return createSovereignApp({ users: [{ uid: "pilote1" }, { uid: "pilote2" }], smsClient });
}

describe("Numéros et texte des SMS", () => {
    test("seuls les mobiles français sont acceptés, au format international", () => {
        expect(normalizeFrenchMobile("06 12 34 56 78")).toBe("+33612345678");
        expect(normalizeFrenchMobile("07.12.34.56.78")).toBe("+33712345678");
        expect(normalizeFrenchMobile("+33 6 12 34 56 78")).toBe("+33612345678");
        expect(normalizeFrenchMobile("0033612345678")).toBe("+33612345678");
        for (const n of ["0112345678", "0899123456", "+447700900123", "06123", "abc", "", null]) {
            expect(normalizeFrenchMobile(n)).toBeNull();
        }
    });

    test("texte sans accents (SMS standard)", () => {
        expect(toSmsText("Chuté à Lille — précision")).toBe("Chute a Lille  precision");
    });
});

describe("Client SMS OVHcloud", () => {
    test("requête signée comme l'exige l'API OVHcloud, sans mention STOP, priorité haute", async () => {
        let seen;
        const fetchImpl = async (url, init) => {
            seen = { url, init };
            return { ok: true, status: 200, text: async () => JSON.stringify({ validReceivers: ["+33612345678"], invalidReceivers: [], ids: [42] }) };
        };
        const client = createOvhSmsClient({
            appKey: "AK", appSecret: "AS", consumerKey: "CK", serviceName: "sms-ab123-1", fetchImpl, now: () => 1_700_000_000_000,
        });
        const out = await client.send({ receivers: ["+33612345678"], message: "Alerte é" });
        expect(out.validReceivers).toEqual(["+33612345678"]);
        expect(seen.url).toBe(`${OVH_API}/sms/sms-ab123-1/jobs`);
        const job = JSON.parse(seen.init.body);
        expect(job).toMatchObject({ message: "Alerte e", priority: "high", noStopClause: true, senderForResponse: true });
        const h = seen.init.headers;
        expect(h["X-Ovh-Application"]).toBe("AK");
        expect(h["X-Ovh-Timestamp"]).toBe("1700000000");
        const attendu = "$1$" + crypto.createHash("sha1").update(["AS", "CK", "POST", seen.url, seen.init.body, "1700000000"].join("+")).digest("hex");
        expect(h["X-Ovh-Signature"]).toBe(attendu);
        expect(ovhSignature({ appSecret: "AS", consumerKey: "CK", method: "POST", url: seen.url, body: seen.init.body, timestamp: "1700000000" })).toBe(attendu);
    });

    test("un refus d'OVHcloud est une erreur, jamais un succès", async () => {
        const fetchImpl = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ message: "Not enough credits" }) });
        const client = createOvhSmsClient({ appKey: "a", appSecret: "b", consumerKey: "c", serviceName: "s", fetchImpl });
        await expect(client.send({ receivers: ["+33612345678"], message: "x" })).rejects.toThrow(/Not enough credits/);
    });

    test("configuration incomplète refusée", () => {
        expect(() => createOvhSmsClient({ appKey: "a" })).toThrow(/incomplète/);
    });
});

describe("Route POST /api/v1/sos", () => {
    const body = { ...LILLE, contacts: ["06 12 34 56 78", "+33712345678"], kind: "fall" };

    test("envoie un vrai SMS avec la vraie position et ne compte que les numéros acceptés", async () => {
        const sms = fakeSms();
        const r = await invoke(makeApp(sms), "POST", "/api/v1/sos", body, auth("pilote1"));
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ sent: 2, requested: 2, invalid: 0 });
        expect(sms.calls[0].receivers).toEqual(["+33612345678", "+33712345678"]);
        expect(sms.calls[0].message).toContain("mlat=50.62920&mlon=3.05730");
        expect(sms.calls[0].message).toContain("pilote1 a peut-etre chute");
        expect(sms.calls[0].message).toContain("112");
    });

    test("OVHcloud n'accepte aucun numéro : échec (502), sent = 0", async () => {
        const sms = fakeSms({ validReceivers: [], invalidReceivers: ["+33612345678"], ids: [] });
        const r = await invoke(makeApp(sms), "POST", "/api/v1/sos", body, auth("pilote1"));
        expect(r.status).toBe(502);
        expect(r.body.sent).toBe(0);
    });

    test("panne d'OVHcloud : échec (502) et consigne d'appeler le 112", async () => {
        const r = await invoke(makeApp(fakeSms(new Error("réseau"))), "POST", "/api/v1/sos", body, auth("pilote1"));
        expect(r.status).toBe(502);
        expect(r.body).toMatchObject({ sent: 0 });
        expect(r.body.error).toMatch(/112/);
    });

    test("SMS non configurés : 503, rien n'est annoncé comme envoyé", async () => {
        const r = await invoke(makeApp(null), "POST", "/api/v1/sos", body, auth("pilote1"));
        expect(r.status).toBe(503);
        expect(r.body.sent).toBe(0);
    });

    test("sans connexion : refusé (personne ne peut envoyer des SMS à nos frais)", async () => {
        const sms = fakeSms();
        const r = await invoke(makeApp(sms), "POST", "/api/v1/sos", body);
        expect(r.status).toBe(401);
        expect(sms.calls).toHaveLength(0);
    });

    test("position ou numéros invalides : refusé avant tout envoi", async () => {
        const sms = fakeSms();
        const app = makeApp(sms);
        for (const bad of [
            { ...body, lat: 200 },
            { ...body, contacts: [] },
            { ...body, contacts: ["0899123456"] },
            { ...body, contacts: ["0612345678", "0612345679", "0612345670", "0612345671"] },
            { ...body, kind: "test" },
        ]) {
            expect((await invoke(app, "POST", "/api/v1/sos", bad, auth("pilote1"))).status).toBe(400);
        }
        expect(sms.calls).toHaveLength(0);
    });

    test("au plus 3 alertes par 10 minutes et par pilote", async () => {
        const sms = fakeSms();
        const app = makeApp(sms);
        for (let i = 0; i < 3; i++) expect((await invoke(app, "POST", "/api/v1/sos", body, auth("pilote1"))).status).toBe(200);
        const r = await invoke(app, "POST", "/api/v1/sos", body, auth("pilote1"));
        expect(r.status).toBe(429);
        expect(r.body.error).toMatch(/112/);
        expect((await invoke(app, "POST", "/api/v1/sos", body, auth("pilote2"))).status).toBe(200);
    });
});

describe("Jeton SOS : l'alerte part des jours après la connexion", () => {
    const body = { ...LILLE, contacts: ["0612345678"], kind: "fall" };
    const bearer = (t) => ({ Authorization: `Bearer ${t}` });
    const sosJwt = (uid, ttl) => signSovereignJwt({ uid, purpose: "sos" }, ttl === undefined ? {} : { expiresInSec: ttl });

    test("inscription et connexion le donnent, valable 30 jours", async () => {
        const app = makeApp(fakeSms());
        const reg = await invoke(app, "POST", "/api/v1/auth/register", { email: "lea@mon50cc.internal", username: "lea", password: "motdepasse-1" });
        expect(reg.status).toBe(201);
        const login = await invoke(app, "POST", "/api/v1/auth/login", { email: "lea@mon50cc.internal", password: "motdepasse-1" });
        expect(login.status).toBe(200);
        const claims = JSON.parse(Buffer.from(login.body.sosToken.split(".")[1], "base64url").toString("utf8"));
        expect(claims).toMatchObject({ uid: login.body.uid, purpose: "sos", role: "none" });
        expect(claims.exp - claims.iat).toBe(30 * 24 * 3600);
        expect((await invoke(app, "POST", "/api/v1/sos", body, bearer(reg.body.sosToken))).status).toBe(200);
    });

    test("il n'ouvre QUE l'alerte SOS, jamais une session", async () => {
        const app = makeApp(fakeSms());
        const t = bearer(sosJwt("pilote1"));
        expect((await invoke(app, "POST", "/api/v1/sos", body, t)).status).toBe(200);
        expect((await invoke(app, "POST", "/api/v1/telemetry/upload", {}, t)).status).toBe(401);
        expect((await invoke(app, "POST", "/api/v1/points/transact", {}, t)).status).toBe(401);
        expect((await invoke(app, "DELETE", "/api/v1/rgpd/account", null, t)).status).toBe(401);
    });

    test("un autre jeton à usage particulier (défi d'usine) n'ouvre pas l'alerte", async () => {
        const sms = fakeSms();
        const usine = signSovereignJwt({ uid: "pilote1", purpose: "factory-pop", ctx: {} });
        expect((await invoke(makeApp(sms), "POST", "/api/v1/sos", body, bearer(usine))).status).toBe(401);
        expect(sms.calls).toHaveLength(0);
    });

    test("jeton expiré : refusé", async () => {
        expect((await invoke(makeApp(fakeSms()), "POST", "/api/v1/sos", body, bearer(sosJwt("pilote1", -10)))).status).toBe(401);
    });

    test("renouvellement : nouveau jeton SOS, seulement si le compte existe encore", async () => {
        const app = makeApp(fakeSms());
        const r = await invoke(app, "POST", "/api/v1/auth/sos-token", null, bearer(sosJwt("pilote1")));
        expect(r.status).toBe(200);
        expect((await invoke(app, "POST", "/api/v1/sos", body, bearer(r.body.sosToken))).status).toBe(200);
        expect((await invoke(app, "POST", "/api/v1/auth/sos-token", null, bearer(sosJwt("compte-supprime")))).status).toBe(401);
        expect((await invoke(app, "POST", "/api/v1/auth/sos-token", null, bearer(sosJwt("pilote1", -10)))).status).toBe(401);
        expect((await invoke(app, "POST", "/api/v1/auth/sos-token", null)).status).toBe(401);
    });
});
