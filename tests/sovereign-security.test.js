/**
 * @jest-environment node
 *
 * Correctifs de sécurité Phase 1 (docs/AUDIT_2026-11.md) :
 *   C2 — la signature ECDSA est vérifiée avec la clé enregistrée du boîtier, jamais celle du client
 *   E3 — refus de démarrer en production sans clés JWT
 *   E4 — limitation des tentatives de connexion
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const { signSovereignJwt, loadJwtKeys } = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");
const blackboxCore = require("../functions/api/blackbox-core");

function invokeRequest(app, method, url, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const rawBuf = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
        const req = {
            method,
            url,
            socket: { remoteAddress: headers.ip || "10.0.0.1" },
            headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
        };
        const res = {
            statusCode: 200,
            setHeader() {},
            end(payload) {
                resolve({ status: this.statusCode, body: payload ? JSON.parse(payload) : null });
            }
        };
        app.handleRequest(req, res, rawBuf).catch(reject);
    });
}

function newDeviceKeys() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pubHex = publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("hex");
    return { pubHex, privateKey };
}

/** Trames chaînées + signature de la racine de Merkle par la clé privée donnée. */
function signedUpload(serial, privateKey, extra = {}) {
    const seedHex = "b".repeat(64);
    const h1 = blackboxCore.computeMerkleStep(seedHex, "p1");
    const frames = [
        { seqId: 1, timestamp: 1730000100, prevHashHex: seedHex.slice(0, 32), payload: "p1", gForce: 1.0 },
        { seqId: 2, timestamp: 1730000101, prevHashHex: h1.slice(0, 32), payload: "p2", gForce: 4.2 }
    ];
    const root = blackboxCore.verifyMerkleChain(frames, seedHex).finalHashHex;
    const sig = crypto.sign("sha256", Buffer.from(root, "hex"), privateKey).toString("hex");
    return { hardwareId: serial, payloads: frames, merkleSeedHex: seedHex, ecdsaSignature: sig, ...extra };
}

describe("Phase 1 — sécurité du serveur souverain", () => {
    let wormDir;
    let device;
    const ownerUid = "owner-uid-01";
    const ownerJwt = () => signSovereignJwt({ uid: ownerUid, role: "user", username: "Owner" });

    beforeEach(() => {
        wormDir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-sec-"));
        device = newDeviceKeys();
    });
    afterEach(() => fs.rmSync(wormDir, { recursive: true, force: true }));

    const makeApp = (opts = {}) =>
        createSovereignApp({
            wormDir,
            blackboxUnits: [{ serial: "BB50V1-P02", ecdsaPublicKey: device.pubHex, ownerUid }],
            users: [{ uid: ownerUid }, { uid: "someone-else" }],
            ...opts
        });

    test("C2 : upload signé par le vrai boîtier → accepté et scellé", async () => {
        const app = makeApp();
        const r = await invokeRequest(app, "POST", "/api/v1/telemetry/upload",
            signedUpload("BB50V1-P02", device.privateKey), { Authorization: `Bearer ${ownerJwt()}` });
        expect(r.status).toBe(201);
        expect(r.body.ecdsaVerified).toBe(true);
        expect(r.body.merkleVerified).toBe(true);
    });

    test("C2 : fausse preuve signée avec la clé d'un attaquant → rejetée, même si sa clé est envoyée", async () => {
        const app = makeApp();
        const attacker = newDeviceKeys();
        const forged = signedUpload("BB50V1-P02", attacker.privateKey, { ecdsaPublicKey: attacker.pubHex });
        const r = await invokeRequest(app, "POST", "/api/v1/telemetry/upload", forged,
            { Authorization: `Bearer ${ownerJwt()}` });
        expect(r.status).toBe(422);
        expect(fs.readdirSync(wormDir)).toHaveLength(0); // rien n'a été scellé
    });

    test("C2 : boîtier inconnu ou appartenant à un autre compte → 403", async () => {
        const app = makeApp();
        const unknown = await invokeRequest(app, "POST", "/api/v1/telemetry/upload",
            signedUpload("BB50V1-P09", device.privateKey), { Authorization: `Bearer ${ownerJwt()}` });
        expect(unknown.status).toBe(403);

        const otherJwt = signSovereignJwt({ uid: "someone-else", role: "user", username: "X" });
        const notMine = await invokeRequest(app, "POST", "/api/v1/telemetry/upload",
            signedUpload("BB50V1-P02", device.privateKey), { Authorization: `Bearer ${otherJwt}` });
        expect(notMine.status).toBe(403);
    });

    test("C2 : seul un admin peut enregistrer un boîtier, et sa clé ne peut pas être remplacée", async () => {
        const app = makeApp();
        // Clé neuve : celle de `device` appartient déjà à BB50V1-P02 (une clé = un boîtier)
        const unit = { serial: "BB50V1-P03", ecdsaPublicKey: newDeviceKeys().pubHex, ownerUid };

        const asUser = await invokeRequest(app, "POST", "/api/v1/admin/blackbox/units", unit,
            { Authorization: `Bearer ${ownerJwt()}` });
        expect(asUser.status).toBe(403);

        const adminJwt = signSovereignJwt({ uid: "admin", role: "admin", username: "Admin" });
        const first = await invokeRequest(app, "POST", "/api/v1/admin/blackbox/units", unit,
            { Authorization: `Bearer ${adminJwt}` });
        expect(first.status).toBe(201);

        const replace = await invokeRequest(app, "POST", "/api/v1/admin/blackbox/units",
            { ...unit, ecdsaPublicKey: newDeviceKeys().pubHex }, { Authorization: `Bearer ${adminJwt}` });
        expect(replace.status).toBe(409);

        const sameKeyOtherSerial = await invokeRequest(app, "POST", "/api/v1/admin/blackbox/units",
            { serial: "BB50V1-P04", ecdsaPublicKey: device.pubHex }, { Authorization: `Bearer ${adminJwt}` });
        expect(sameKeyOtherSerial.status).toBe(409);

        const badKey = await invokeRequest(app, "POST", "/api/v1/admin/blackbox/units",
            { serial: "BB50V1-P04", ecdsaPublicKey: "04abc" }, { Authorization: `Bearer ${adminJwt}` });
        expect(badKey.status).toBe(400);
    });

    test("E4 : la connexion est bloquée après trop de tentatives (par email, même en changeant d'IP)", async () => {
        const app = makeApp({ authMaxAttempts: 3 });
        const tryLogin = (ip) => invokeRequest(app, "POST", "/api/v1/auth/login",
            { email: "cible@example.com", password: "mauvais" }, { ip });
        expect((await tryLogin("1.1.1.1")).status).toBe(401);
        expect((await tryLogin("2.2.2.2")).status).toBe(401);
        expect((await tryLogin("3.3.3.3")).status).toBe(401);
        expect((await tryLogin("4.4.4.4")).status).toBe(429);
    });

    test("E3 : pas de clés JWT en production → refus de démarrer ; en dev → clés éphémères", () => {
        expect(() => loadJwtKeys({ NODE_ENV: "production" })).toThrow(/obligatoires en production/);
        const dev = loadJwtKeys({ NODE_ENV: "development" });
        expect(dev.privateKey).toMatch(/BEGIN PRIVATE KEY/);

        const keys = loadJwtKeys({
            NODE_ENV: "production",
            SOVEREIGN_JWT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
            SOVEREIGN_JWT_PUBLIC_KEY: "pub"
        });
        expect(keys.privateKey).toContain("\nabc\n");
    });
});
