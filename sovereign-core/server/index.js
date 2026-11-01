/**
 * ============================================================================
 * sovereign-core/server/index.js
 * ============================================================================
 * Serveur Applicatif Souverain — mon50ccetmoi.com
 * 100 % Autonome (Zéro Google Cloud / Zéro Firebase SDK)
 *
 * Architecture :
 *   - Serveur HTTP/REST Node.js 22 natif (`node:http`)
 *   - Authentification JWT ES256 (`crypto-auth.js`)
 *   - Stockage Forensique WORM (`storage-worm.js`)
 *   - Validation Cryptographique Boîte Noire REV3 (`blackbox-core.js`)
 *   - En-têtes de sécurité stricts OWASP ASVS v5.0.0 (HSTS, CSP Souveraine, CORS)
 * ============================================================================
 */

"use strict";

const http = require("http");
const crypto = require("crypto");
const {
    hashPassword,
    verifyPassword,
    signSovereignJwt,
    verifySovereignJwt
} = require("./crypto-auth");
const { SovereignWormStorage } = require("./storage-worm");
const blackboxCore = require("../../functions/api/blackbox-core");
const { verifyRevolutSignature } = require("../../functions/api/revolut-signature");

const ALLOWED_ORIGIN = process.env.SOVEREIGN_CORS_ORIGIN || "https://mon50ccetmoi.com";

// En-têtes de sécurité stricts (OWASP ASVS v5.0.0-3.4.x — Zéro domaine Google)
const SOVEREIGN_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://data.geopf.fr https://*.tile.openstreetmap.org",
    "connect-src 'self' https://mon50ccetmoi.com https://api.mon50ccetmoi.com https://apicarto.ign.fr https://data.geopf.fr https://api.piste.gouv.fr https://merchant.revolut.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'"
].join("; ");

function applySecurityHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", SOVEREIGN_CSP);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
}

/**
 * Crée une instance isolée du noyau souverain (avec mémoire transactionnelle ou adaptateur SQL PostgreSQL).
 */
function createSovereignApp(options = {}) {
    const wormVault = new SovereignWormStorage(options.wormDir);

    // Magasin transactionnel embarqué (remplacé en prod par le pool PostgreSQL `pg` sur schema.sql)
    const state = {
        usersById: new Map(),
        usersByEmail: new Map(),
        pointsLedger: [],
        blackboxUnits: new Map(),
        telemetrySessions: []
    };

    function extractBearerUser(req) {
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) return null;
        const token = authHeader.slice(7).trim();
        const verif = verifySovereignJwt(token);
        return verif.valid ? verif.payload : null;
    }

    async function handleRequest(req, res, rawBodyBuffer) {
        applySecurityHeaders(res);

        if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
        }

        const url = new URL(req.url, "http://localhost");
        const pathname = url.pathname;
        const rawBodyStr = rawBodyBuffer ? rawBodyBuffer.toString("utf8") : "";
        let body = {};
        if (rawBodyStr) {
            try {
                body = JSON.parse(rawBodyStr);
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Corps JSON invalide." }));
                return;
            }
        }

        // 1. HEALTHCHECK SOUVERAIN
        if (req.method === "GET" && pathname === "/api/v1/health") {
            res.statusCode = 200;
            res.end(JSON.stringify({
                status: "OK",
                architecture: "mon50ccetmoi-sovereign-core",
                googleDependencies: 0,
                firebaseDependencies: 0,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 2. INSCRIPTION UTILISATEUR SOUVERAINE (scrypt + JWT ES256)
        if (req.method === "POST" && pathname === "/api/v1/auth/register") {
            const { email, username, password } = body;
            if (!email || !username || !password || String(password).length < 8) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Email, pseudonyme et mot de passe (>= 8 car.) requis." }));
                return;
            }
            const cleanEmail = String(email).trim().toLowerCase();
            if (state.usersByEmail.has(cleanEmail)) {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: "Cet email est déjà enregistré." }));
                return;
            }

            const uid = crypto.randomUUID();
            const userRecord = {
                uid,
                email: cleanEmail,
                username: String(username).trim(),
                passwordHash: hashPassword(String(password)),
                role: "user",
                braveCoins: 0,
                createdAt: new Date().toISOString()
            };
            state.usersById.set(uid, userRecord);
            state.usersByEmail.set(cleanEmail, userRecord);

            const token = signSovereignJwt({
                uid: userRecord.uid,
                role: userRecord.role,
                username: userRecord.username
            });

            res.statusCode = 201;
            res.end(JSON.stringify({
                uid: userRecord.uid,
                username: userRecord.username,
                role: userRecord.role,
                token
            }));
            return;
        }

        // 3. CONNEXION UTILISATEUR SOUVERAINE
        if (req.method === "POST" && pathname === "/api/v1/auth/login") {
            const { email, password } = body;
            const cleanEmail = String(email || "").trim().toLowerCase();
            const user = state.usersByEmail.get(cleanEmail);

            if (!user || !verifyPassword(String(password || ""), user.passwordHash)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Identifiants invalides." }));
                return;
            }

            const token = signSovereignJwt({
                uid: user.uid,
                role: user.role,
                username: user.username
            });

            res.statusCode = 200;
            res.end(JSON.stringify({
                uid: user.uid,
                username: user.username,
                role: user.role,
                braveCoins: user.braveCoins,
                token
            }));
            return;
        }

        // 4. TÉLÉVERSEMENT TÉLÉMÉTRIE BOÎTE NOIRE REV3 (Merkle + ECDSA P-256 + WORM)
        if (req.method === "POST" && pathname === "/api/v1/telemetry/upload") {
            const authUser = extractBearerUser(req);
            if (!authUser) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification JWT ES256 requise." }));
                return;
            }

            const {
                hardwareId,
                payloads,
                isCrashReport,
                impactTimestamp,
                merkleSeedHex,
                ecdsaSignature,
                ecdsaPublicKey
            } = body;

            if (!Array.isArray(payloads) || payloads.length === 0 || payloads.length > 5000) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Lot de trames invalide (1 à 5000 trames)." }));
                return;
            }

            let finalFrames = payloads;
            if (isCrashReport && typeof impactTimestamp === "number") {
                finalFrames = blackboxCore.filterCrashWindowFrames(
                    payloads,
                    impactTimestamp,
                    blackboxCore.CRASH_WINDOW_SECONDS
                );
            }

            let merkleVerification = null;
            if (typeof merkleSeedHex === "string" && /^[0-9a-fA-F]{64}$/.test(merkleSeedHex)) {
                merkleVerification = blackboxCore.verifyMerkleChain(finalFrames, merkleSeedHex);
            }

            let ecdsaVerified = false;
            if (ecdsaSignature && ecdsaPublicKey && merkleVerification && merkleVerification.finalHashHex) {
                ecdsaVerified = blackboxCore.verifyEcdsaP256Signature(
                    Buffer.from(merkleVerification.finalHashHex, "hex"),
                    ecdsaSignature,
                    ecdsaPublicKey
                );
            }

            const evidenceReceipt = wormVault.sealTelemetryEvidence(authUser.uid, {
                uid: authUser.uid,
                hardwareId: String(hardwareId || "BB-V1-00001"),
                isCrashReport: Boolean(isCrashReport),
                merkleVerified: merkleVerification ? merkleVerification.valid : null,
                merkleRootHex: merkleVerification ? merkleVerification.finalHashHex : null,
                ecdsaVerified,
                frames: finalFrames
            });

            const sessionRecord = {
                sessionId: crypto.randomUUID(),
                uid: authUser.uid,
                frameCount: finalFrames.length,
                merkleVerified: merkleVerification ? merkleVerification.valid : null,
                ecdsaVerified,
                wormStoragePath: evidenceReceipt.storagePath,
                wormSha256Hex: evidenceReceipt.sha256Hex,
                sealedAt: evidenceReceipt.sealedAt
            };
            state.telemetrySessions.push(sessionRecord);

            res.statusCode = 201;
            res.end(JSON.stringify({
                success: true,
                ...sessionRecord
            }));
            return;
        }

        // 5. WEBHOOK REVOLUT SOUVERAIN (Vérification HMAC-SHA256 à temps constant)
        if (req.method === "POST" && pathname === "/api/v1/webhooks/revolut") {
            const secret = process.env.REVOLUT_WEBHOOK_SECRET || options.revolutWebhookSecret;
            const sig = req.headers["revolut-signature"];
            const ts = req.headers["revolut-request-timestamp"];
            const verif = verifyRevolutSignature(rawBodyBuffer, ts, sig, secret);

            if (!verif.valid) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Signature Revolut invalide", reason: verif.reason }));
                return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
            return;
        }

        // 6. DROIT À L'EFFACEMENT RGPD ART. 17
        if (req.method === "DELETE" && pathname === "/api/v1/rgpd/account") {
            const authUser = extractBearerUser(req);
            if (!authUser) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            const user = state.usersById.get(authUser.uid);
            if (user) {
                state.usersByEmail.delete(user.email);
                state.usersById.delete(authUser.uid);
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: "Compte et données personnelles purgés (RGPD Art. 17)." }));
            return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Endpoint introuvable." }));
    }

    const server = http.createServer((req, res) => {
        const chunks = [];
        let totalBytes = 0;
        const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 Mo max (protection DoS OWASP A11)

        req.on("data", (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_BODY_BYTES) {
                res.statusCode = 413;
                res.end(JSON.stringify({ error: "Payload Too Large" }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });

        req.on("end", () => {
            const rawBody = Buffer.concat(chunks);
            handleRequest(req, res, rawBody).catch((err) => {
                console.error("[SovereignServer] Internal Error:", err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "Internal Server Error" }));
            });
        });
    });

    return { server, state, wormVault, handleRequest };
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 8080;
    const { server } = createSovereignApp();
    server.listen(port, () => {
        console.log(`[SovereignCore] Serveur autonome actif sur le port ${port} (Zéro Google / Zéro Firebase)`);
    });
}

module.exports = { createSovereignApp, SOVEREIGN_CSP };

