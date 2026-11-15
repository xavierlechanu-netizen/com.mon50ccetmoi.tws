/**
 * @jest-environment node
 *
 * Preuves de la boîte noire (revue technique du 10 novembre 2026) :
 *   1. rien n'est scellé sans chaîne de Merkle valide ET signature du boîtier ;
 *   2. un rapport d'accident est vérifié sur le lot complet signé (bug : le filtrage ±30 s
 *      avant vérification faisait refuser une vraie preuve) ;
 *   3. coffre S3 Object Lock en mode COMPLIANCE (OVHcloud), refus d'un bucket non verrouillé,
 *      et refus de démarrer en production sans coffre S3.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { S3ObjectLockWormStorage, resolveWormVault } = require("../sovereign-core/server/storage-worm-s3");
const blackboxCore = require("../functions/api/blackbox-core");

function invokeRequest(app, method, url, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const rawBuf = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
        const req = {
            method,
            url,
            socket: { remoteAddress: "10.0.0.1" },
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

/** Lot de `count` trames chaînées (une par seconde à partir de t0), signé par `privateKey`. */
function chainedBatch(privateKey, { count = 3, t0 = 1730000100, seedHex = "d".repeat(64) } = {}) {
    const frames = [];
    let prev = seedHex;
    for (let i = 0; i < count; i++) {
        const payload = `p${i + 1}`;
        frames.push({ seqId: i + 1, timestamp: t0 + i, prevHashHex: prev.slice(0, 32), payload, gForce: 1 + i / 10 });
        prev = blackboxCore.computeMerkleStep(prev, payload);
    }
    const root = blackboxCore.verifyMerkleChain(frames, seedHex).finalHashHex;
    const sig = crypto.sign("sha256", Buffer.from(root, "hex"), privateKey).toString("hex");
    return { frames, seedHex, root, sig };
}

/** Faux stockage S3 : garde les objets et toutes leurs versions en mémoire. */
function fakeS3({ lockEnabled = true, returnVersion = true } = {}) {
    const sent = [];
    const objects = new Map(); // "key#version" -> { body, input }
    let version = 0;
    class Cmd { constructor(input) { this.input = input; } }
    const commands = {
        PutObjectCommand: class PutObjectCommand extends Cmd {},
        GetObjectCommand: class GetObjectCommand extends Cmd {},
        GetObjectLockConfigurationCommand: class GetObjectLockConfigurationCommand extends Cmd {}
    };
    const client = {
        async send(cmd) {
            sent.push(cmd);
            const name = cmd.constructor.name;
            if (name === "PutObjectCommand") {
                const expected = crypto.createHash("sha256").update(cmd.input.Body).digest("base64");
                if (cmd.input.ChecksumSHA256 !== expected) throw new Error("BadDigest");
                version += 1;
                const v = `v${version}`;
                objects.set(`${cmd.input.Key}#${v}`, { body: Buffer.from(cmd.input.Body), input: cmd.input });
                return returnVersion ? { VersionId: v } : {};
            }
            if (name === "GetObjectCommand") {
                const o = objects.get(`${cmd.input.Key}#${cmd.input.VersionId}`);
                if (!o) throw new Error("NoSuchVersion");
                return { Body: o.body, ObjectLockMode: o.input.ObjectLockMode, ObjectLockRetainUntilDate: o.input.ObjectLockRetainUntilDate };
            }
            if (name === "GetObjectLockConfigurationCommand") {
                return lockEnabled ? { ObjectLockConfiguration: { ObjectLockEnabled: "Enabled" } } : {};
            }
            throw new Error("Commande inattendue " + name);
        }
    };
    return { client, commands, sent, objects };
}

describe("Envoi de preuves : signature obligatoire et lot complet vérifié", () => {
    let wormDir;
    let device;
    const ownerUid = "owner-uid-02";
    const jwt = () => signSovereignJwt({ uid: ownerUid, role: "user", username: "Owner" });

    beforeEach(() => {
        wormDir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-evidence-"));
        device = newDeviceKeys();
    });
    afterEach(() => fs.rmSync(wormDir, { recursive: true, force: true }));

    const makeApp = (opts = {}) => createSovereignApp({
        wormDir,
        blackboxUnits: [{ serial: "BB50V1-P02", ecdsaPublicKey: device.pubHex, ownerUid }],
        users: [{ uid: ownerUid }],
        ...opts
    });
    const sealedCount = () => (fs.existsSync(path.join(wormDir, ownerUid)) ? fs.readdirSync(path.join(wormDir, ownerUid)).length : 0);
    const upload = (app, body) => invokeRequest(app, "POST", "/api/v1/telemetry/upload", body, { Authorization: `Bearer ${jwt()}` });

    test("sans signature → 422 et rien n'est scellé", async () => {
        const app = makeApp();
        const { frames, seedHex } = chainedBatch(device.privateKey);
        const r = await upload(app, { hardwareId: "BB50V1-P02", payloads: frames, merkleSeedHex: seedHex });
        expect(r.status).toBe(422);
        expect(sealedCount()).toBe(0);
    });

    test("sans graine de Merkle → 422 et rien n'est scellé", async () => {
        const app = makeApp();
        const { frames, sig } = chainedBatch(device.privateKey);
        const r = await upload(app, { hardwareId: "BB50V1-P02", payloads: frames, ecdsaSignature: sig });
        expect(r.status).toBe(422);
        expect(sealedCount()).toBe(0);
    });

    test("trame retirée du lot → chaîne rompue, 422", async () => {
        const app = makeApp();
        const { frames, seedHex, sig } = chainedBatch(device.privateKey, { count: 4 });
        const r = await upload(app, { hardwareId: "BB50V1-P02", payloads: [frames[0], frames[2], frames[3]], merkleSeedHex: seedHex, ecdsaSignature: sig });
        expect(r.status).toBe(422);
        expect(sealedCount()).toBe(0);
    });

    test("trame modifiée (force G gonflée) → signature invalide, 422", async () => {
        const app = makeApp();
        const { frames, seedHex, sig } = chainedBatch(device.privateKey);
        const tampered = frames.map((f, i) => (i === 2 ? { ...f, payload: "p3-modifiee" } : f));
        const r = await upload(app, { hardwareId: "BB50V1-P02", payloads: tampered, merkleSeedHex: seedHex, ecdsaSignature: sig });
        expect(r.status).toBe(422);
        expect(sealedCount()).toBe(0);
    });

    test("accident avec des trames hors de la fenêtre ±30 s → accepté (bug corrigé), lot complet scellé", async () => {
        const app = makeApp();
        // 120 trames, une par seconde : le choc à t0+100 laisse 70 trames hors fenêtre au début
        const t0 = 1730000000;
        const { frames, seedHex, sig, root } = chainedBatch(device.privateKey, { count: 120, t0 });
        const r = await upload(app, {
            hardwareId: "BB50V1-P02", payloads: frames, merkleSeedHex: seedHex, ecdsaSignature: sig,
            isCrashReport: true, impactTimestamp: t0 + 100
        });
        expect(r.status).toBe(201);
        expect(r.body.ecdsaVerified).toBe(true);
        expect(r.body.merkleVerified).toBe(true);
        expect(r.body.frameCount).toBe(120);

        const sealed = app.wormVault.verifyAndReadEvidence(r.body.wormStoragePath, r.body.wormSha256Hex);
        expect(sealed.data.frames).toHaveLength(120);
        expect(sealed.data.merkleRootHex).toBe(root);
        expect(sealed.data.crashWindow).toEqual({ seconds: 30, firstSeqId: 71, lastSeqId: 120, frameCount: 50 });
        // Tout ce qu'il faut pour revérifier la signature sans faire confiance au serveur
        const recomputed = blackboxCore.verifyMerkleChain(sealed.data.frames, sealed.data.merkleSeedHex);
        expect(blackboxCore.verifyEcdsaP256Signature(
            Buffer.from(recomputed.finalHashHex, "hex"), sealed.data.ecdsaSignature, sealed.data.ecdsaPublicKey
        )).toBe(true);
    });

    test("accident sans horodatage du choc → 400", async () => {
        const app = makeApp();
        const { frames, seedHex, sig } = chainedBatch(device.privateKey);
        const r = await upload(app, { hardwareId: "BB50V1-P02", payloads: frames, merkleSeedHex: seedHex, ecdsaSignature: sig, isCrashReport: true });
        expect(r.status).toBe(400);
        expect(sealedCount()).toBe(0);
    });

    test("le serveur scelle dans le coffre S3 quand il est configuré", async () => {
        const s3 = fakeS3();
        const vault = new S3ObjectLockWormStorage({ bucket: "mon50cc-preuves", client: s3.client, commands: s3.commands });
        const app = makeApp({ wormVault: vault });
        const { frames, seedHex, sig } = chainedBatch(device.privateKey);
        const r = await upload(app, { hardwareId: "BB50V1-P02", payloads: frames, merkleSeedHex: seedHex, ecdsaSignature: sig });
        expect(r.status).toBe(201);
        expect(r.body.wormStoragePath).toMatch(/^s3:\/\/mon50cc-preuves\/evidence\/owner-uid-02\/.+\?versionId=v1$/);
        const readBack = await vault.verifyAndReadEvidence(r.body.wormStoragePath, r.body.wormSha256Hex);
        expect(readBack.data.frames).toHaveLength(3);
        expect(readBack.objectLockMode).toBe("COMPLIANCE");
    });
});

describe("Coffre S3 Object Lock (OVHcloud)", () => {
    const fixedNow = new Date("2026-11-10T08:00:00.000Z");

    test("chaque preuve est écrite en mode COMPLIANCE, 5 ans, avec son empreinte SHA-256", async () => {
        const s3 = fakeS3();
        const vault = new S3ObjectLockWormStorage({ bucket: "b", client: s3.client, commands: s3.commands, now: () => fixedNow });
        const receipt = await vault.sealTelemetryEvidence("user_123", { a: 1 });

        const put = s3.sent.find((c) => c.constructor.name === "PutObjectCommand").input;
        expect(put.ObjectLockMode).toBe("COMPLIANCE");
        expect(put.ObjectLockRetainUntilDate.toISOString()).toBe("2031-11-10T08:00:00.000Z"); // 1826 jours
        expect(put.ChecksumSHA256).toBe(Buffer.from(receipt.sha256Hex, "hex").toString("base64"));
        expect(put.Key).toMatch(/^evidence\/user_123\//);
        expect(receipt.retainUntil).toBe("2031-11-10T08:00:00.000Z");
    });

    test("la relecture vise la version scellée ; un contenu différent est détecté", async () => {
        const s3 = fakeS3();
        const vault = new S3ObjectLockWormStorage({ bucket: "b", client: s3.client, commands: s3.commands });
        const receipt = await vault.sealTelemetryEvidence("user_123", { a: 1 });
        await expect(vault.verifyAndReadEvidence(receipt.storagePath, receipt.sha256Hex)).resolves.toMatchObject({ verified: true });

        // Une nouvelle version déposée sous la même clé ne remplace pas celle qui a été scellée
        const [entryKey] = [...s3.objects.keys()];
        const key = entryKey.split("#")[0];
        await s3.client.send(new s3.commands.PutObjectCommand({
            Key: key, Body: Buffer.from('{"a":999}'),
            ChecksumSHA256: crypto.createHash("sha256").update('{"a":999}').digest("base64")
        }));
        const again = await vault.verifyAndReadEvidence(receipt.storagePath, receipt.sha256Hex);
        expect(again.data).toEqual({ a: 1 });

        await expect(vault.verifyAndReadEvidence(receipt.storagePath, "0".repeat(64)))
            .rejects.toThrow("WORM_INTEGRITY_VIOLATION_DETECTED");
        await expect(vault.verifyAndReadEvidence("s3://autre-bucket/evidence/x?versionId=v1", null))
            .rejects.toThrow("INVALID_WORM_URI");
    });

    test("bucket non versionné (pas de VersionId) → refus", async () => {
        const s3 = fakeS3({ returnVersion: false });
        const vault = new S3ObjectLockWormStorage({ bucket: "b", client: s3.client, commands: s3.commands });
        await expect(vault.sealTelemetryEvidence("user_123", { a: 1 })).rejects.toThrow("WORM_S3_NO_VERSION_ID");
    });

    test("bucket sans Object Lock → démarrage refusé", async () => {
        const locked = fakeS3();
        await expect(new S3ObjectLockWormStorage({ bucket: "b", client: locked.client, commands: locked.commands }).assertBucketLocked())
            .resolves.toBe(true);
        const unlocked = fakeS3({ lockEnabled: false });
        await expect(new S3ObjectLockWormStorage({ bucket: "b", client: unlocked.client, commands: unlocked.commands }).assertBucketLocked())
            .rejects.toThrow(/Object Lock/);
    });

    test("identifiant utilisateur invalide ou rétention invalide → refus", async () => {
        const s3 = fakeS3();
        const vault = new S3ObjectLockWormStorage({ bucket: "b", client: s3.client, commands: s3.commands });
        await expect(vault.sealTelemetryEvidence("../etc", {})).rejects.toThrow("INVALID_UID_FOR_VAULT");
        expect(() => new S3ObjectLockWormStorage({ bucket: "b", client: s3.client, commands: s3.commands, retentionDays: 0 })).toThrow();
        expect(() => new S3ObjectLockWormStorage({ client: s3.client, commands: s3.commands })).toThrow(/WORM_S3_BUCKET/);
    });

    test("en production, pas de coffre local : WORM_S3_BUCKET obligatoire", () => {
        expect(() => resolveWormVault({}, { NODE_ENV: "production" })).toThrow(/WORM_S3_BUCKET/);
        expect(resolveWormVault({ wormDir: os.tmpdir() }, { NODE_ENV: "test" }).constructor.name).toBe("SovereignWormStorage");
    });
});
