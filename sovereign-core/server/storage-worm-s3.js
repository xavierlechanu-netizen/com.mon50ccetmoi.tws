/**
 * ============================================================================
 * sovereign-core/server/storage-worm-s3.js
 * ============================================================================
 * Coffre des preuves sur stockage objet S3 avec Object Lock en mode COMPLIANCE
 * (OVHcloud Object Storage, Gravelines / Roubaix).
 *
 * Pourquoi : un fichier en lecture seule sur le disque du serveur peut toujours
 * être supprimé par un administrateur. En mode COMPLIANCE, l'objet ne peut être
 * ni modifié ni supprimé par personne (compte racine compris) avant la date de
 * fin de rétention, et cette date ne peut pas être raccourcie.
 *
 * Garanties apportées ici :
 *   - chaque preuve est écrite avec ObjectLockMode=COMPLIANCE et une date de
 *     fin de rétention (5 ans par défaut) ;
 *   - le serveur envoie l'empreinte SHA-256 (ChecksumSHA256) : le stockage
 *     refuse l'objet si les octets reçus ne correspondent pas ;
 *   - le chemin renvoyé contient l'identifiant de version : on relit toujours
 *     exactement la version scellée, jamais une version déposée après ;
 *   - au démarrage, `assertBucketLocked()` refuse un bucket sans Object Lock.
 *
 * Le SDK AWS n'est chargé que si ce coffre est utilisé (aucune dépendance pour
 * le développement local ni pour les tests, qui injectent un faux client).
 * ============================================================================
 */

"use strict";

const crypto = require("crypto");

const DEFAULT_RETENTION_DAYS = 1826; // 5 ans
const UID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

function loadSdk() {
    // Chargé à la demande : seul le serveur de production en a besoin
    return require("@aws-sdk/client-s3");
}

async function streamToBuffer(body) {
    if (!body) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body.transformToByteArray === "function") {
        return Buffer.from(await body.transformToByteArray());
    }
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

class S3ObjectLockWormStorage {
    /**
     * @param {object} opts
     * @param {string} opts.bucket Nom du bucket (créé avec Object Lock activé)
     * @param {object} [opts.client] Client S3 (doit exposer `send(command)`) ; créé depuis l'environnement sinon
     * @param {object} [opts.commands] Constructeurs de commandes (injectés par les tests)
     * @param {number} [opts.retentionDays] Durée de conservation (jours)
     * @param {() => Date} [opts.now] Horloge (tests)
     */
    constructor(opts = {}) {
        if (!opts.bucket || typeof opts.bucket !== "string") {
            throw new Error("WORM_S3_BUCKET est obligatoire pour le coffre S3.");
        }
        const retentionDays = opts.retentionDays === undefined ? DEFAULT_RETENTION_DAYS : Number(opts.retentionDays);
        if (!Number.isInteger(retentionDays) || retentionDays < 1) {
            throw new Error("Durée de rétention WORM invalide (nombre entier de jours >= 1).");
        }
        this.bucket = opts.bucket;
        this.retentionDays = retentionDays;
        this.now = opts.now || (() => new Date());
        this.commands = opts.commands || loadSdk();
        this.client = opts.client || new this.commands.S3Client({
            endpoint: opts.endpoint,
            region: opts.region,
            forcePathStyle: true,
            credentials: opts.accessKeyId ? {
                accessKeyId: opts.accessKeyId,
                secretAccessKey: opts.secretAccessKey
            } : undefined
        });
        this.kind = "s3-object-lock";
    }

    /** Refuse un bucket sans Object Lock activé (à appeler au démarrage). */
    async assertBucketLocked() {
        const out = await this.client.send(new this.commands.GetObjectLockConfigurationCommand({ Bucket: this.bucket }));
        const enabled = out && out.ObjectLockConfiguration && out.ObjectLockConfiguration.ObjectLockEnabled === "Enabled";
        if (!enabled) {
            throw new Error(`Le bucket « ${this.bucket} » n'a pas Object Lock activé : les preuves ne seraient pas protégées.`);
        }
        return true;
    }

    /**
     * Scelle un lot de télémétrie.
     * @returns {Promise<{storagePath:string, sha256Hex:string, sizeBytes:number, sealedAt:string, retainUntil:string}>}
     */
    async sealTelemetryEvidence(uid, sessionPayload) {
        if (!uid || typeof uid !== "string" || !UID_REGEX.test(uid)) {
            throw new Error("INVALID_UID_FOR_VAULT");
        }
        const buf = Buffer.from(JSON.stringify(sessionPayload), "utf8");
        const digest = crypto.createHash("sha256").update(buf).digest();
        const sha256Hex = digest.toString("hex");
        const sealedAt = this.now();
        const retainUntil = new Date(sealedAt.getTime() + this.retentionDays * 24 * 3600 * 1000);
        const key = `evidence/${uid}/${sealedAt.getTime()}_${sha256Hex.slice(0, 16)}_${crypto.randomBytes(4).toString("hex")}.json`;

        const out = await this.client.send(new this.commands.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buf,
            ContentType: "application/json",
            ChecksumSHA256: digest.toString("base64"),
            ObjectLockMode: "COMPLIANCE",
            ObjectLockRetainUntilDate: retainUntil
        }));

        if (!out || !out.VersionId) {
            // Sans version, le bucket n'est pas versionné : Object Lock ne peut pas y être actif.
            throw new Error("WORM_S3_NO_VERSION_ID");
        }

        return {
            storagePath: `s3://${this.bucket}/${key}?versionId=${encodeURIComponent(out.VersionId)}`,
            sha256Hex,
            sizeBytes: buf.length,
            sealedAt: sealedAt.toISOString(),
            retainUntil: retainUntil.toISOString()
        };
    }

    /** Relit la version scellée et vérifie son empreinte. */
    async verifyAndReadEvidence(storagePath, expectedSha256Hex) {
        const m = typeof storagePath === "string" && storagePath.match(/^s3:\/\/([^/]+)\/(evidence\/[^?]+)\?versionId=(.+)$/);
        if (!m || m[1] !== this.bucket) {
            throw new Error("INVALID_WORM_URI");
        }
        const out = await this.client.send(new this.commands.GetObjectCommand({
            Bucket: this.bucket,
            Key: m[2],
            VersionId: decodeURIComponent(m[3])
        }));
        const buf = await streamToBuffer(out && out.Body);
        const actualSha256Hex = crypto.createHash("sha256").update(buf).digest("hex");
        if (expectedSha256Hex && actualSha256Hex !== String(expectedSha256Hex).toLowerCase()) {
            throw new Error("WORM_INTEGRITY_VIOLATION_DETECTED");
        }
        return {
            verified: true,
            sha256Hex: actualSha256Hex,
            objectLockMode: out.ObjectLockMode || null,
            retainUntil: out.ObjectLockRetainUntilDate ? new Date(out.ObjectLockRetainUntilDate).toISOString() : null,
            data: JSON.parse(buf.toString("utf8"))
        };
    }
}

/**
 * Choisit le coffre des preuves.
 * - WORM_S3_BUCKET défini → coffre S3 Object Lock (obligatoire en production).
 * - Sinon, hors production → coffre local (développement et tests).
 */
function resolveWormVault(options = {}, env = process.env) {
    if (options.wormVault) return options.wormVault;
    if (env.WORM_S3_BUCKET) {
        return new S3ObjectLockWormStorage({
            bucket: env.WORM_S3_BUCKET,
            endpoint: env.WORM_S3_ENDPOINT,
            region: env.WORM_S3_REGION,
            accessKeyId: env.WORM_S3_ACCESS_KEY_ID,
            secretAccessKey: env.WORM_S3_SECRET_ACCESS_KEY,
            retentionDays: env.WORM_RETENTION_DAYS ? Number(env.WORM_RETENTION_DAYS) : undefined
        });
    }
    if (env.NODE_ENV === "production") {
        throw new Error("WORM_S3_BUCKET est obligatoire en production : un fichier local en lecture seule ne protège pas les preuves.");
    }
    const { SovereignWormStorage } = require("./storage-worm");
    return new SovereignWormStorage(options.wormDir);
}

module.exports = { S3ObjectLockWormStorage, resolveWormVault, DEFAULT_RETENTION_DAYS };
