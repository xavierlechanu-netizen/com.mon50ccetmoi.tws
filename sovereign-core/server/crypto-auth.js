/**
 * ============================================================================
 * sovereign-core/server/crypto-auth.js
 * ============================================================================
 * Moteur d'Authentification & d'Autorisation 100 % Souverain (Zéro Firebase Auth)
 *
 * Fonctionnalités :
 *   - Hachage de mots de passe par dérivation mémoire-dure (scrypt NIST SP 800-132)
 *   - Comparaison à temps constant (crypto.timingSafeEqual) contre les timing attacks
 *   - Émission et vérification de jetons JWT asymétriques ES256 (ECDSA P-256 / SHA-256)
 *   - Aucune dépendance externe (100 % module natif Node.js `node:crypto`)
 * ============================================================================
 */

"use strict";

const crypto = require("crypto");

const SCRYPT_PARAMS = {
    N: 16384,
    r: 8,
    p: 1,
    keylen: 64
};

const TOKEN_TTL_SECONDS = 3600; // 1 heure (conformité OWASP ASVS v5.0.0-6.x)

// Clés ECDSA P-256 de signature des JWT (ES256), injectées par variables d'environnement.
// Les "\n" littéraux sont acceptés pour pouvoir passer une clé PEM sur une seule ligne.
// Sans clés : paire éphémère en dev/test, refus de démarrer en production
// (sinon tous les jetons deviennent invalides à chaque redémarrage).
function loadJwtKeys(env = process.env) {
    const priv = env.SOVEREIGN_JWT_PRIVATE_KEY;
    const pub = env.SOVEREIGN_JWT_PUBLIC_KEY;
    if (priv && pub) {
        return { privateKey: priv.replace(/\\n/g, "\n"), publicKey: pub.replace(/\\n/g, "\n") };
    }
    if (env.NODE_ENV === "production") {
        throw new Error(
            "SOVEREIGN_JWT_PRIVATE_KEY et SOVEREIGN_JWT_PUBLIC_KEY sont obligatoires en production " +
            "(générer avec : node sovereign-core/scripts/generate-jwt-keys.js)."
        );
    }
    return crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
}

const { privateKey: JWT_PRIVATE_KEY, publicKey: JWT_PUBLIC_KEY } = loadJwtKeys();
const JWT_ISSUER = "urn:mon50ccetmoi:sovereign-auth";
const JWT_AUDIENCE = "https://mon50ccetmoi.com";

function base64UrlEncode(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
    return buf.toString("base64url");
}

function base64UrlDecodeToBuffer(str) {
    return Buffer.from(String(str), "base64url");
}

/**
 * Hache un mot de passe utilisateur avec scrypt et un sel aléatoire de 128 bits.
 * Format de sortie : `scrypt$<salt_hex>$<hash_hex>`
 * @param {string} plainPassword
 * @returns {string}
 */
function hashPassword(plainPassword) {
    if (typeof plainPassword !== "string" || plainPassword.length < 8 || plainPassword.length > 256) {
        throw new Error("INVALID_PASSWORD_LENGTH");
    }
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(plainPassword, salt, SCRYPT_PARAMS.keylen, {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p
    });
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Vérifie un mot de passe contre son empreinte stockée en temps constant.
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyPassword(plainPassword, storedHash) {
    if (typeof plainPassword !== "string" || typeof storedHash !== "string") {
        return false;
    }
    const parts = storedHash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") {
        return false;
    }
    const salt = Buffer.from(parts[1], "hex");
    const expectedHash = Buffer.from(parts[2], "hex");
    if (salt.length !== 16 || expectedHash.length !== SCRYPT_PARAMS.keylen) {
        return false;
    }
    const derived = crypto.scryptSync(plainPassword, salt, SCRYPT_PARAMS.keylen, {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p
    });
    return crypto.timingSafeEqual(derived, expectedHash);
}

/**
 * Signe un jeton JWT ES256 (ECDSA P-256 + SHA-256).
 * @param {{uid: string, role?: string, username?: string, blackboxSerial?: string}} claims
 * @param {{expiresInSec?: number}} [opts]
 * @returns {string}
 */
function signSovereignJwt(claims, opts = {}) {
    if (!claims || typeof claims.uid !== "string" || !claims.uid.trim()) {
        throw new Error("UID_REQUIRED");
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = typeof opts.expiresInSec === "number" ? opts.expiresInSec : TOKEN_TTL_SECONDS;

    const header = { alg: "ES256", typ: "JWT" };
    const payload = {
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
        sub: claims.uid,
        uid: claims.uid,
        role: claims.role || "user",
        username: claims.username || null,
        blackbox_serial: claims.blackboxSerial || null,
        iat: nowSec,
        exp: nowSec + ttl,
        jti: crypto.randomUUID()
    };
    // Jeton à usage particulier (ex. défi de mise en service) : jamais une session
    if (typeof claims.purpose === "string" && claims.purpose) {
        payload.purpose = claims.purpose;
        payload.role = "none";
        payload.ctx = claims.ctx && typeof claims.ctx === "object" ? claims.ctx : {};
    }

    const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
    const signature = crypto.sign("SHA256", Buffer.from(signingInput, "utf8"), {
        key: JWT_PRIVATE_KEY,
        dsaEncoding: "ieee-p1363"
    });

    return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Vérifie la signature cryptographique ES256 et l'expiration d'un JWT souverain.
 * @param {string} token
 * @returns {{valid: boolean, payload?: object, reason?: string}}
 */
function verifySovereignJwt(token) {
    if (typeof token !== "string") {
        return { valid: false, reason: "token_missing" };
    }
    const parts = token.trim().split(".");
    if (parts.length !== 3) {
        return { valid: false, reason: "malformed_jwt" };
    }

    try {
        const header = JSON.parse(base64UrlDecodeToBuffer(parts[0]).toString("utf8"));
        if (header.alg !== "ES256" || header.typ !== "JWT") {
            return { valid: false, reason: "unsupported_alg" };
        }

        const signingInput = `${parts[0]}.${parts[1]}`;
        const sigBuf = base64UrlDecodeToBuffer(parts[2]);

        const isVerified = crypto.verify(
            "SHA256",
            Buffer.from(signingInput, "utf8"),
            { key: JWT_PUBLIC_KEY, dsaEncoding: "ieee-p1363" },
            sigBuf
        );

        if (!isVerified) {
            return { valid: false, reason: "invalid_signature" };
        }

        const payload = JSON.parse(base64UrlDecodeToBuffer(parts[1]).toString("utf8"));
        const nowSec = Math.floor(Date.now() / 1000);

        if (typeof payload.exp !== "number" || nowSec >= payload.exp) {
            return { valid: false, reason: "token_expired" };
        }
        if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
            return { valid: false, reason: "invalid_issuer_or_audience" };
        }

        return { valid: true, payload };
    } catch (e) {
        return { valid: false, reason: "verification_error" };
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    signSovereignJwt,
    verifySovereignJwt,
    loadJwtKeys,
    JWT_PUBLIC_KEY,
    JWT_ISSUER,
    JWT_AUDIENCE
};

