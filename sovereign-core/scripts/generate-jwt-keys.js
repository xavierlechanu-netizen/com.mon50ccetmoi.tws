/**
 * Génère une paire de clés ECDSA P-256 pour les JWT ES256 du serveur souverain.
 * Affiche deux lignes à placer dans le fichier .env (jamais dans git) :
 *   node sovereign-core/scripts/generate-jwt-keys.js >> sovereign-core/.env
 */
"use strict";

const crypto = require("crypto");

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

const oneLine = (pem) => pem.trim().replace(/\n/g, "\\n");
console.log(`SOVEREIGN_JWT_PRIVATE_KEY="${oneLine(privateKey)}"`);
console.log(`SOVEREIGN_JWT_PUBLIC_KEY="${oneLine(publicKey)}"`);
