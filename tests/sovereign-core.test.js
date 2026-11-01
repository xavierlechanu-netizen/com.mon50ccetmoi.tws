/**
 * @jest-environment node
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const {
    hashPassword,
    verifyPassword,
    signSovereignJwt,
    verifySovereignJwt
} = require("../sovereign-core/server/crypto-auth");
const { SovereignWormStorage } = require("../sovereign-core/server/storage-worm");
const { createSovereignApp, SOVEREIGN_CSP } = require("../sovereign-core/server/index");
const blackboxCore = require("../functions/api/blackbox-core");

function invokeRequest(app, method, url, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const rawBuf = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
        const resHeaders = {};
        const req = {
            method,
            url,
            headers: Object.fromEntries(
                Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
            )
        };
        const res = {
            statusCode: 200,
            setHeader(k, v) {
                resHeaders[k.toLowerCase()] = v;
            },
            end(payload) {
                resolve({
                    status: this.statusCode,
                    headers: resHeaders,
                    body: payload ? JSON.parse(payload) : null
                });
            }
        };
        app.handleRequest(req, res, rawBuf).catch(reject);
    });
}

describe("Architecture Souveraine Autonome (sovereign-core — Zéro Google / Zéro Firebase)", () => {
    let tmpWormDir;

    beforeEach(() => {
        tmpWormDir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-worm-"));
    });

    afterEach(() => {
        fs.rmSync(tmpWormDir, { recursive: true, force: true });
    });

    test("1. Authentification Souveraine : Hachage scrypt + JWT asymétrique ES256 (ECDSA P-256)", () => {
        const hash = hashPassword("MonSuperMotDePasse50cc!");
        expect(hash.startsWith("scrypt$")).toBe(true);
        expect(verifyPassword("MonSuperMotDePasse50cc!", hash)).toBe(true);
        expect(verifyPassword("MauvaisMotDePasse", hash)).toBe(false);

        const token = signSovereignJwt({ uid: "user-sov-01", role: "admin", username: "Rider50" });
        const verified = verifySovereignJwt(token);
        expect(verified.valid).toBe(true);
        expect(verified.payload.uid).toBe("user-sov-01");
        expect(verified.payload.role).toBe("admin");

        // Falsification du payload JWT -> rejet immédiat par signature ECDSA P-256
        const parts = token.split(".");
        const tamperedPayload = Buffer.from(JSON.stringify({ uid: "hacker", role: "admin" })).toString("base64url");
        const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
        expect(verifySovereignJwt(forgedToken).valid).toBe(false);
    });

    test("2. Stockage Forensique WORM : Scellement SHA-256 & détection de falsification", () => {
        const vault = new SovereignWormStorage(tmpWormDir);
        const receipt = vault.sealTelemetryEvidence("user_123", {
            seqId: 1,
            gForce: 4.8,
            lat: 48.8566,
            lng: 2.3522
        });

        expect(receipt.storagePath.startsWith("worm://user_123/")).toBe(true);
        expect(receipt.sha256Hex).toMatch(/^[0-9a-f]{64}$/);

        const readBack = vault.verifyAndReadEvidence(receipt.storagePath, receipt.sha256Hex);
        expect(readBack.verified).toBe(true);
        expect(readBack.data.gForce).toBe(4.8);

        expect(() => {
            vault.verifyAndReadEvidence(receipt.storagePath, "0".repeat(64));
        }).toThrow("WORM_INTEGRITY_VIOLATION_DETECTED");
    });

    test("3. Cycle complet Serveur Souverain : Register -> Login -> Upload Télémétrie ECDSA -> Purge RGPD", async () => {
        const app = createSovereignApp({ wormDir: tmpWormDir });

        // Healthcheck sans dépendance Google
        const health = await invokeRequest(app, "GET", "/api/v1/health");
        expect(health.status).toBe(200);
        expect(health.body.googleDependencies).toBe(0);
        expect(health.body.firebaseDependencies).toBe(0);
        expect(SOVEREIGN_CSP.includes("googleapis.com")).toBe(false);

        // Inscription
        const reg = await invokeRequest(app, "POST", "/api/v1/auth/register", {
            email: "pilote@mon50ccetmoi.com",
            username: "PiloteSouverain",
            password: "SovereignPassword2026!"
        });
        expect(reg.status).toBe(201);
        expect(reg.body.token).toBeDefined();

        // Connexion
        const login = await invokeRequest(app, "POST", "/api/v1/auth/login", {
            email: "pilote@mon50ccetmoi.com",
            password: "SovereignPassword2026!"
        });
        expect(login.status).toBe(200);
        const jwt = login.body.token;

        // Préparation d'une chaîne de Merkle + Signature matérielle ECDSA P-256
        const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
        const pubUncompressedHex = publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("hex");
        const seedHex = "a".repeat(64);
        const h1 = blackboxCore.computeMerkleStep(seedHex, "frame-payload-1");
        const chainedFrames = [
            { seqId: 1, timestamp: 1730000100, prevHashHex: seedHex.slice(0, 32), payload: "frame-payload-1", gForce: 1.0 },
            { seqId: 2, timestamp: 1730000101, prevHashHex: h1.slice(0, 32), payload: "frame-payload-2", gForce: 4.5, isShockFrame: true }
        ];
        const merkleVerif = blackboxCore.verifyMerkleChain(chainedFrames, seedHex);
        const sigDerHex = crypto
            .sign("sha256", Buffer.from(merkleVerif.finalHashHex, "hex"), privateKey)
            .toString("hex");

        // Upload télémétrie sur le serveur souverain
        const upload = await invokeRequest(
            app,
            "POST",
            "/api/v1/telemetry/upload",
            {
                hardwareId: "BB-V1-00001",
                payloads: chainedFrames,
                isCrashReport: true,
                impactTimestamp: 1730000101,
                merkleSeedHex: seedHex,
                ecdsaSignature: sigDerHex,
                ecdsaPublicKey: pubUncompressedHex
            },
            { Authorization: `Bearer ${jwt}` }
        );

        expect(upload.status).toBe(201);
        expect(upload.body.merkleVerified).toBe(true);
        expect(upload.body.ecdsaVerified).toBe(true);
        expect(upload.body.wormStoragePath).toMatch(/^worm:\/\//);

        // Effacement RGPD Art. 17
        const del = await invokeRequest(
            app,
            "DELETE",
            "/api/v1/rgpd/account",
            null,
            { Authorization: `Bearer ${jwt}` }
        );
        expect(del.status).toBe(200);
        expect(del.body.success).toBe(true);
    });
});
