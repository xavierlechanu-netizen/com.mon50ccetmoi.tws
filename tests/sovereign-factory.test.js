/**
 * @jest-environment node
 *
 * Mise en service en usine : le boîtier fabrique sa clé dans la puce, prouve qu'il la détient
 * (signature d'un défi du serveur) et le serveur lui attribue un numéro de série lié
 * définitivement à cette clé. Une clé = un numéro ; 10 prototypes au plus.
 */
const crypto = require("crypto");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");
const blackboxCore = require("../functions/api/blackbox-core");

function call(app, method, url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = { method, url, socket: { remoteAddress: "10.0.0.9" },
            headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
        const res = { statusCode: 200, setHeader() {}, end(p) { resolve({ status: this.statusCode, body: p ? JSON.parse(p) : null }); } };
        app.handleRequest(req, res, body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0)).catch(reject);
    });
}

/** Boîtier simulé : clé faite « dans la puce », signe le message de preuve comme le firmware */
function device() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("hex");
    const pop = (challenge) => crypto.sign("sha256", Buffer.from(`mon50cc-factory-pop:${challenge}:${pub}`), privateKey).toString("hex");
    return { pub, pop };
}

const factory = { Authorization: `Bearer ${signSovereignJwt({ uid: "usine-poste-1", role: "factory", username: "Poste 1" })}` };

async function register(app, dev, extra = {}, headers = factory) {
    const ch = await call(app, "POST", "/api/v1/factory/challenge", {}, headers);
    return call(app, "POST", "/api/v1/factory/units",
        { ecdsaPublicKey: dev.pub, challengeToken: ch.body.challengeToken, popSignature: dev.pop(ch.body.challenge), ...extra }, headers);
}

describe("Mise en service en usine", () => {
    test("seuls les postes d'usine (ou un admin) peuvent numéroter", async () => {
        const app = createSovereignApp();
        const user = { Authorization: `Bearer ${signSovereignJwt({ uid: "u1", role: "user", username: "U" })}` };
        expect((await call(app, "POST", "/api/v1/factory/challenge", {}, user)).status).toBe(403);
        expect((await call(app, "POST", "/api/v1/factory/challenge", {})).status).toBe(403);
    });

    test("numéros attribués dans l'ordre A01, A02… et liés à la clé ; même clé = même numéro", async () => {
        const app = createSovereignApp();
        const a = device(), b = device();
        const ra = await register(app, a);
        expect(ra.status).toBe(201);
        expect(ra.body.serial).toBe("BB50V1-A01");
        expect((await register(app, b)).body.serial).toBe("BB50V1-A02");
        const again = await register(app, a);   // outil relancé après une coupure
        expect(again.status).toBe(200);
        expect(again.body).toMatchObject({ serial: "BB50V1-A01", created: false });
        const unit = await app.store.getBlackboxUnit("BB50V1-A01");
        expect(unit.ecdsaPublicKey).toBe(a.pub);
    });

    test("prototypes : P01 à P10 en V1, le 11e est refusé ; pas de prototype en V2", async () => {
        const app = createSovereignApp();
        for (let i = 1; i <= 10; i++) {
            expect((await register(app, device(), { type: "PROTOTYPE" })).body.serial).toBe(`BB50V1-P${String(i).padStart(2, "0")}`);
        }
        expect((await register(app, device(), { type: "PROTOTYPE" })).status).toBe(409);
        expect((await register(app, device(), { type: "PROTOTYPE", revision: "V2" })).status).toBe(409);
        expect((await register(app, device())).body.serial).toBe("BB50V1-A01");   // la série n'est pas touchée
    });

    test("une clé fabriquée hors de la puce ne passe pas : il faut la signature du défi par CETTE clé", async () => {
        const app = createSovereignApp();
        const real = device(), rogue = device();
        const ch = await call(app, "POST", "/api/v1/factory/challenge", {}, factory);
        const forged = await call(app, "POST", "/api/v1/factory/units",
            { ecdsaPublicKey: real.pub, challengeToken: ch.body.challengeToken, popSignature: rogue.pop(ch.body.challenge) }, factory);
        expect(forged.status).toBe(422);
        const noSig = await call(app, "POST", "/api/v1/factory/units", { ecdsaPublicKey: real.pub, challengeToken: ch.body.challengeToken }, factory);
        expect(noSig.status).toBe(422);
    });

    test("défi d'un autre poste, expiré ou inventé → refusé", async () => {
        const app = createSovereignApp();
        const dev = device();
        const other = { Authorization: `Bearer ${signSovereignJwt({ uid: "usine-poste-2", role: "factory", username: "Poste 2" })}` };
        const ch = await call(app, "POST", "/api/v1/factory/challenge", {}, other);
        const r = await call(app, "POST", "/api/v1/factory/units",
            { ecdsaPublicKey: dev.pub, challengeToken: ch.body.challengeToken, popSignature: dev.pop(ch.body.challenge) }, factory);
        expect(r.status).toBe(401);
        const expired = signSovereignJwt({ uid: "factory-pop:usine-poste-1", purpose: "factory-pop", ctx: { challenge: "ab".repeat(32), by: "usine-poste-1" } }, { expiresInSec: -10 });
        const r2 = await call(app, "POST", "/api/v1/factory/units",
            { ecdsaPublicKey: dev.pub, challengeToken: expired, popSignature: dev.pop("ab".repeat(32)) }, factory);
        expect(r2.status).toBe(401);
        const r3 = await call(app, "POST", "/api/v1/factory/units",
            { ecdsaPublicKey: dev.pub, challengeToken: "pas-un-jeton", popSignature: dev.pop("00") }, factory);
        expect(r3.status).toBe(401);
    });

    test("une clé déjà liée à un numéro ne peut pas être enregistrée sous un autre (même par un admin)", async () => {
        const app = createSovereignApp();
        const dev = device();
        await register(app, dev);
        const admin = { Authorization: `Bearer ${signSovereignJwt({ uid: "admin", role: "admin", username: "A" })}` };
        const dup = await call(app, "POST", "/api/v1/admin/blackbox/units", { serial: "BB50V1-B07", ecdsaPublicKey: dev.pub }, admin);
        expect(dup.status).toBe(409);
    });

    test("un jeton de défi n'ouvre pas de session", async () => {
        const app = createSovereignApp();
        const ch = await call(app, "POST", "/api/v1/factory/challenge", {}, factory);
        const r = await call(app, "GET", "/api/v1/leaderboard", null, { Authorization: `Bearer ${ch.body.challengeToken}` });
        expect(r.status).toBe(401);
    });

    test("nextSerial : P et 00 exclus, passage à deux lettres après Z99", () => {
        expect(blackboxCore.nextSerial([], "V1", "SERIES")).toBe("BB50V1-A01");
        expect(blackboxCore.nextSerial(["BB50V1-A99"], "V1", "SERIES")).toBe("BB50V1-B01");
        expect(blackboxCore.nextSerial(["BB50V1-O99"], "V1", "SERIES")).toBe("BB50V1-Q01");   // P sauté
        expect(blackboxCore.nextSerial(["BB50V1-Z99"], "V1", "SERIES")).toBe("BB50V1-AA01");
        expect(blackboxCore.nextSerial(["BB50V1-A05"], "V2", "SERIES")).toBe("BB50V2-A01");   // compteur par révision
    });
});
