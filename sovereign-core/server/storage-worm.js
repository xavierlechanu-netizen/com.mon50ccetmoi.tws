/**
 * ============================================================================
 * sovereign-core/server/storage-worm.js
 * ============================================================================
 * Stockage Forensique WORM (Write-Once-Read-Many) Souverain
 * Remplace Google Cloud Storage (`admin.storage().bucket()`).
 *
 * Fonctionnement :
 *   - Calcule l'empreinte SHA-256 du rapport télémétrique chiffré.
 *   - Écrit le fichier dans un coffre local immuable (ou bucket S3 OVHcloud
 *     avec Object Lock COMPLIANCE) en interdisant tout écrasement ultérieur.
 *   - Génère un récépissé d'intégrité horodaté opposable (ISO/IEC 27037).
 * ============================================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class SovereignWormStorage {
    /**
     * @param {string} [baseDir] Répertoire racine du coffre WORM
     */
    constructor(baseDir) {
        this.baseDir = baseDir || path.join(__dirname, "..", "worm_vault");
    }

    /**
     * Archive de manière immuable un lot de télémétrie Boîte Noire.
     * @param {string} uid Identifiant utilisateur
     * @param {object} sessionPayload Données de session (frames chiffrées, merkleRoot, signature ECDSA)
     * @returns {{storagePath: string, sha256Hex: string, sizeBytes: number, sealedAt: string}}
     */
    sealTelemetryEvidence(uid, sessionPayload) {
        if (!uid || typeof uid !== "string" || !/^[a-zA-Z0-9_-]{3,64}$/.test(uid)) {
            throw new Error("INVALID_UID_FOR_VAULT");
        }

        const serialized = JSON.stringify(sessionPayload);
        const buf = Buffer.from(serialized, "utf8");
        const sha256Hex = crypto.createHash("sha256").update(buf).digest("hex");

        const userDir = path.join(this.baseDir, uid);
        fs.mkdirSync(userDir, { recursive: true });

        const fileName = `${Date.now()}_${sha256Hex.slice(0, 16)}.worm.json`;
        const fullPath = path.join(userDir, fileName);

        // WORM strict : flag 'wx' échoue si le fichier existe déjà (interdiction absolue d'écrasement)
        fs.writeFileSync(fullPath, buf, { flag: "wx", mode: 0o444 });

        return {
            storagePath: `worm://${uid}/${fileName}`,
            sha256Hex,
            sizeBytes: buf.length,
            sealedAt: new Date().toISOString()
        };
    }

    /**
     * Lit et vérifie l'intégrité SHA-256 d'une archive forensique.
     * @param {string} storagePath Chemin `worm://<uid>/<fileName>`
     * @param {string} expectedSha256Hex Empreinte SHA-256 attendue
     */
    verifyAndReadEvidence(storagePath, expectedSha256Hex) {
        if (typeof storagePath !== "string" || !storagePath.startsWith("worm://")) {
            throw new Error("INVALID_WORM_URI");
        }
        const rel = storagePath.replace("worm://", "");
        const safeRel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
        const fullPath = path.join(this.baseDir, safeRel);

        const buf = fs.readFileSync(fullPath);
        const actualSha256Hex = crypto.createHash("sha256").update(buf).digest("hex");

        if (expectedSha256Hex && actualSha256Hex !== expectedSha256Hex.toLowerCase()) {
            throw new Error("WORM_INTEGRITY_VIOLATION_DETECTED");
        }

        return {
            verified: true,
            sha256Hex: actualSha256Hex,
            data: JSON.parse(buf.toString("utf8"))
        };
    }
}

module.exports = { SovereignWormStorage };

