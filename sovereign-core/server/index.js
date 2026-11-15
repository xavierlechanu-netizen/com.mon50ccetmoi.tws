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
const { resolveWormVault } = require("./storage-worm-s3");
const { createMemoryStore } = require("./store-memory");
const { createPgStore } = require("./store-pg");
const { StoreError } = require("./store-errors");
const pointsRules = require("../../functions/api/points-rules");

const HAZARD_TYPES = ["pothole", "accident", "police", "roadwork", "obstacle", "weather", "other"];
const HAZARDS_PER_DAY = 30;
const isLat = (v) => typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90;
const isLng = (v) => typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180;
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
 * Choix du stockage : PostgreSQL si DATABASE_URL est défini (obligatoire en production),
 * sinon mémoire (développement et tests).
 */
function resolveStore(options, env = process.env) {
    if (options.store) return options.store;
    if (env.DATABASE_URL) return createPgStore({ connectionString: env.DATABASE_URL });
    if (env.NODE_ENV === "production") {
        throw new Error("DATABASE_URL est obligatoire en production (les données en mémoire seraient perdues au redémarrage).");
    }
    // Boîtiers pré-enregistrés (tests / amorçage) : [{ serial, ecdsaPublicKey, ownerUid, revision }]
    return createMemoryStore({ blackboxUnits: options.blackboxUnits || [], users: options.users || [] });
}

/**
 * Crée une instance isolée du noyau souverain.
 */
function createSovereignApp(options = {}) {
    const wormVault = resolveWormVault(options);
    const store = resolveStore(options);

    // Limitation des tentatives d'authentification (anti force brute, OWASP ASVS v5.0.0-6.3)
    const authLimit = {
        maxAttempts: options.authMaxAttempts || 10,
        windowMs: options.authWindowMs || 15 * 60 * 1000,
        hits: new Map()
    };

    function clientIp(req) {
        if (options.trustProxy || process.env.SOVEREIGN_TRUST_PROXY === "1") {
            const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
            if (fwd) return fwd;
        }
        return (req.socket && req.socket.remoteAddress) || "unknown";
    }

    /** Enregistre une tentative et renvoie true si la limite est dépassée. */
    function isRateLimited(key) {
        const now = Date.now();
        const recent = (authLimit.hits.get(key) || []).filter((t) => now - t < authLimit.windowMs);
        recent.push(now);
        authLimit.hits.set(key, recent);
        if (authLimit.hits.size > 50000) {
            for (const [k, v] of authLimit.hits) {
                if (!v.some((t) => now - t < authLimit.windowMs)) authLimit.hits.delete(k);
            }
        }
        return recent.length > authLimit.maxAttempts;
    }

    function rejectTooManyAttempts(res) {
        res.statusCode = 429;
        res.setHeader("Retry-After", String(Math.ceil(authLimit.windowMs / 1000)));
        res.end(JSON.stringify({ error: "Trop de tentatives. Réessayez plus tard." }));
    }

    function extractBearerUser(req) {
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) return null;
        const token = authHeader.slice(7).trim();
        const verif = verifySovereignJwt(token);
        // Un jeton à usage particulier (défi d'usine…) n'ouvre jamais une session
        return verif.valid && !verif.payload.purpose ? verif.payload : null;
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
            if (isRateLimited(`register:${clientIp(req)}`)) {
                rejectTooManyAttempts(res);
                return;
            }
            if (!email || !username || !password || String(password).length < 8) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Email, pseudonyme et mot de passe (>= 8 car.) requis." }));
                return;
            }
            const cleanEmail = String(email).trim().toLowerCase();
            const cleanUsername = String(username).trim();
            if (cleanEmail.length > 255 || cleanUsername.length < 2 || cleanUsername.length > 64) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Email (255 car. max) ou pseudonyme (2 à 64 car.) invalide." }));
                return;
            }

            let userRecord;
            try {
                userRecord = await store.createUser({
                    uid: crypto.randomUUID(),
                    email: cleanEmail,
                    username: cleanUsername,
                    passwordHash: hashPassword(String(password)),
                    role: "user"
                });
            } catch (e) {
                if (e instanceof StoreError) {
                    res.statusCode = 409;
                    res.end(JSON.stringify({ error: e.message }));
                    return;
                }
                throw e;
            }

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
            // Deux compteurs : par IP (balayage de comptes) et par email (attaque ciblée)
            const limitedByIp = isRateLimited(`login-ip:${clientIp(req)}`);
            const limitedByEmail = isRateLimited(`login-email:${cleanEmail}`);
            if (limitedByIp || limitedByEmail) {
                rejectTooManyAttempts(res);
                return;
            }
            const user = await store.findUserByEmail(cleanEmail);

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

            // La clé publique envoyée par le client (ecdsaPublicKey) est volontairement ignorée :
            // seule la clé enregistrée au provisionnement du boîtier fait foi.
            const {
                hardwareId,
                payloads,
                isCrashReport,
                impactTimestamp,
                merkleSeedHex,
                ecdsaSignature
            } = body;

            // Un jeton encore valide d'un compte anonymisé (RGPD) ne doit plus rien déposer
            if (!(await store.findUserById(authUser.uid))) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Compte introuvable ou supprimé." }));
                return;
            }

            const unit = typeof hardwareId === "string" ? await store.getBlackboxUnit(hardwareId) : null;
            if (!unit || unit.ownerUid !== authUser.uid || unit.status !== "ACTIVE") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Boîtier inconnu, inactif ou non rattaché à ce compte." }));
                return;
            }

            if (!Array.isArray(payloads) || payloads.length === 0 || payloads.length > 5000) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Lot de trames invalide (1 à 5000 trames)." }));
                return;
            }

            // Preuve = trames chaînées ET signées par le boîtier. Rien de non signé n'est scellé :
            // une trame sans signature n'est qu'une déclaration de l'utilisateur.
            if (typeof merkleSeedHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(merkleSeedHex) ||
                typeof ecdsaSignature !== "string" || ecdsaSignature.length === 0) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: "Preuve non signée : graine de Merkle et signature ECDSA du boîtier obligatoires." }));
                return;
            }

            // La vérification porte sur le lot COMPLET, tel que le boîtier l'a chaîné et signé.
            // (Filtrer la fenêtre de l'accident avant de vérifier casserait la chaîne et ferait
            // refuser une vraie preuve dès qu'une trame sort de la fenêtre.)
            // Trames brutes du boîtier ({ raw }) décodées ici : on ne croit que ses octets.
            let frames;
            try {
                frames = blackboxCore.normalizeTelemetryFrames(payloads);
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
                return;
            }
            const merkleVerification = blackboxCore.verifyMerkleChain(frames, merkleSeedHex);
            if (!merkleVerification.valid) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: "Chaîne de trames rompue : " + merkleVerification.reason }));
                return;
            }
            const ecdsaVerified = blackboxCore.verifyEcdsaP256Signature(
                Buffer.from(merkleVerification.finalHashHex, "hex"),
                ecdsaSignature,
                unit.ecdsaPublicKey
            );
            if (!ecdsaVerified) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: "Signature ECDSA du boîtier invalide." }));
                return;
            }

            // Fenêtre de l'accident (±30 s) : repérée pour le rapport, mais le lot signé est scellé
            // en entier, sinon personne (assureur, expert, juge) ne pourrait revérifier la signature.
            let crashWindow = null;
            if (isCrashReport) {
                if (typeof impactTimestamp !== "number") {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "Horodatage du choc requis pour un rapport d'accident." }));
                    return;
                }
                const inWindow = blackboxCore.filterCrashWindowFrames(
                    frames,
                    impactTimestamp,
                    blackboxCore.CRASH_WINDOW_SECONDS
                );
                if (inWindow.length === 0) {
                    res.statusCode = 422;
                    res.end(JSON.stringify({ error: "Aucune trame dans la fenêtre de ±30 s autour du choc." }));
                    return;
                }
                crashWindow = {
                    seconds: blackboxCore.CRASH_WINDOW_SECONDS,
                    firstSeqId: inWindow[0].seqId,
                    lastSeqId: inWindow[inWindow.length - 1].seqId,
                    frameCount: inWindow.length
                };
            }
            const finalFrames = payloads;

            const evidenceReceipt = await wormVault.sealTelemetryEvidence(authUser.uid, {
                uid: authUser.uid,
                hardwareId: unit.serial,
                isCrashReport: Boolean(isCrashReport),
                impactTimestamp: typeof impactTimestamp === "number" ? impactTimestamp : null,
                crashWindow,
                merkleSeedHex: merkleSeedHex.toLowerCase(),
                merkleRootHex: merkleVerification.finalHashHex,
                ecdsaSignature,
                ecdsaPublicKey: unit.ecdsaPublicKey,
                merkleVerified: true,
                ecdsaVerified: true,
                frames: finalFrames
            });

            const sessionRecord = await store.insertTelemetrySession({
                sessionId: crypto.randomUUID(),
                uid: authUser.uid,
                hardwareId: unit.serial,
                isCrashReport: Boolean(isCrashReport),
                impactTimestamp: typeof impactTimestamp === "number" ? Math.round(impactTimestamp) : null,
                frameCount: finalFrames.length,
                merkleVerified: true,
                merkleRootHex: merkleVerification.finalHashHex,
                ecdsaVerified: true,
                wormStoragePath: evidenceReceipt.storagePath,
                wormSha256Hex: evidenceReceipt.sha256Hex,
                sealedAt: evidenceReceipt.sealedAt
            });

            res.statusCode = 201;
            res.end(JSON.stringify({
                success: true,
                ...sessionRecord
            }));
            return;
        }

        // 4b. PROVISIONNEMENT D'UN BOÎTIER (admin) : la clé publique est figée à cette étape
        if (req.method === "POST" && pathname === "/api/v1/admin/blackbox/units") {
            const authUser = extractBearerUser(req);
            if (!authUser || authUser.role !== "admin") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Réservé aux administrateurs." }));
                return;
            }
            const { serial, ecdsaPublicKey, ownerUid, revision } = body;
            if (typeof serial !== "string" || !blackboxCore.isValidSerial(serial) ||
                !blackboxCore.isValidEcdsaPublicKey(ecdsaPublicKey)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Numéro de série ou clé publique ECDSA P-256 invalide." }));
                return;
            }
            let unit;
            try {
                unit = await store.createBlackboxUnit({
                    serial,
                    revision: typeof revision === "string" ? revision : "V1",
                    ecdsaPublicKey: ecdsaPublicKey.trim(),
                    ownerUid: typeof ownerUid === "string" ? ownerUid : null
                });
            } catch (e) {
                if (e instanceof StoreError) {
                    res.statusCode = (e.code === "UNIT_EXISTS" || e.code === "KEY_EXISTS") ? 409 : 400;
                    res.end(JSON.stringify({ error: e.message }));
                    return;
                }
                throw e;
            }
            res.statusCode = 201;
            res.end(JSON.stringify({ serial: unit.serial, status: unit.status, ownerUid: unit.ownerUid }));
            return;
        }

        // 4b-bis. MISE EN SERVICE EN USINE — le boîtier fabrique sa clé dans la puce ; le serveur
        // attribue le numéro de série et le lie définitivement à cette clé. Preuve de possession :
        // le boîtier signe un défi du serveur (une usine ne peut pas présenter une clé fabriquée
        // sur son propre PC sans que la puce l'ait signée). Comptes « factory » ou « admin ».
        if (req.method === "POST" && (pathname === "/api/v1/factory/challenge" || pathname === "/api/v1/factory/units")) {
            const authUser = extractBearerUser(req);
            if (!authUser || (authUser.role !== "factory" && authUser.role !== "admin")) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Réservé à la mise en service en usine." }));
                return;
            }
            if (pathname === "/api/v1/factory/challenge") {
                const challenge = crypto.randomBytes(32).toString("hex");
                // Défi signé et daté (5 min) : vérifiable par n'importe quelle instance du serveur
                const challengeToken = signSovereignJwt({ uid: `factory-pop:${authUser.uid}`, purpose: "factory-pop", ctx: { challenge, by: authUser.uid } }, { expiresInSec: 300 });
                res.statusCode = 200;
                res.end(JSON.stringify({ challenge, challengeToken, expiresInSec: 300 }));
                return;
            }
            const { ecdsaPublicKey, challengeToken, popSignature } = body;
            const revision = body.revision === undefined ? "V1" : body.revision;
            const type = body.type === undefined ? "SERIES" : body.type;
            if (typeof ecdsaPublicKey !== "string" || !/^04[0-9a-fA-F]{128}$/.test(ecdsaPublicKey) ||
                !blackboxCore.isValidEcdsaPublicKey(ecdsaPublicKey) ||
                !blackboxCore.HW_REVISIONS.includes(revision) || !["SERIES", "PROTOTYPE"].includes(type)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Clé publique (04 + 128 hex), révision ou type invalide." }));
                return;
            }
            const ch = typeof challengeToken === "string" ? verifySovereignJwt(challengeToken) : { valid: false };
            if (!ch.valid || ch.payload.purpose !== "factory-pop" || !ch.payload.ctx || ch.payload.ctx.by !== authUser.uid ||
                !/^[0-9a-f]{64}$/.test(ch.payload.ctx.challenge || "")) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Défi absent, expiré ou émis pour un autre poste." }));
                return;
            }
            const pubHex = ecdsaPublicKey.toLowerCase();
            const message = Buffer.from(`mon50cc-factory-pop:${ch.payload.ctx.challenge}:${pubHex}`, "utf8");
            if (typeof popSignature !== "string" || !blackboxCore.verifyEcdsaP256Signature(message, popSignature, pubHex)) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: "Le boîtier n'a pas prouvé qu'il détient la clé privée." }));
                return;
            }
            let reg;
            try {
                reg = await store.registerFactoryUnit({ ecdsaPublicKey: pubHex, revision, type, nextSerial: blackboxCore.nextSerial });
            } catch (e) {
                if (e instanceof StoreError || /prototypes/.test(e.message)) {
                    res.statusCode = 409;
                    res.end(JSON.stringify({ error: e.message }));
                    return;
                }
                throw e;
            }
            // Même clé présentée deux fois (outil relancé) → même numéro, rien de créé
            res.statusCode = reg.created ? 201 : 200;
            res.end(JSON.stringify({ serial: reg.unit.serial, revision: reg.unit.revision, created: reg.created }));
            return;
        }

        // 4c. DANGERS : signaler (pilote connecté) et lister autour d'un point
        if (pathname === "/api/v1/hazards" && (req.method === "POST" || req.method === "GET")) {
            const authUser = extractBearerUser(req);
            if (!authUser) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            if (req.method === "POST") {
                const { type, lat, lng, description } = body;
                if (!HAZARD_TYPES.includes(type) || !isLat(lat) || !isLng(lng) ||
                    (description !== undefined && (typeof description !== "string" || description.length > 500))) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "Type de danger, position ou description invalide." }));
                    return;
                }
                if (!(await store.findUserById(authUser.uid))) {
                    res.statusCode = 401;
                    res.end(JSON.stringify({ error: "Compte introuvable ou supprimé." }));
                    return;
                }
                if ((await store.countHazardsSince(authUser.uid, Date.now() - 24 * 3600 * 1000)) >= HAZARDS_PER_DAY) {
                    res.statusCode = 429;
                    res.end(JSON.stringify({ error: `Limite de ${HAZARDS_PER_DAY} signalements par jour atteinte.` }));
                    return;
                }
                const hazard = await store.createHazard({ uid: authUser.uid, type, lat, lng, description: description || "" });
                res.statusCode = 201;
                res.end(JSON.stringify(hazard));
                return;
            }
            const lat = Number(url.searchParams.get("lat"));
            const lng = Number(url.searchParams.get("lng"));
            const radiusKm = Math.min(Math.max(Number(url.searchParams.get("radiusKm")) || 10, 0.1), 50);
            if (!isLat(lat) || !isLng(lng)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Position invalide (lat, lng)." }));
                return;
            }
            const hazards = await store.findHazardsNear({ lat, lng, radiusM: radiusKm * 1000 });
            res.statusCode = 200;
            res.end(JSON.stringify({ radiusKm, count: hazards.length, hazards }));
            return;
        }

        // 4d. POINTS : même barème, mêmes preuves et mêmes plafonds que le serveur Firebase (points-rules.js)
        if (req.method === "POST" && pathname === "/api/v1/points/transact") {
            const authUser = extractBearerUser(req);
            if (!authUser) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            let plan;
            try {
                plan = pointsRules.planTransaction(body, { isAdmin: authUser.role === "admin" });
            } catch (e) {
                if (e instanceof pointsRules.RuleError) {
                    res.statusCode = { "permission-denied": 403, "out-of-range": 400 }[e.code] || 400;
                    res.end(JSON.stringify({ error: e.message }));
                    return;
                }
                throw e;
            }
            try {
                const result = await store.applyPointsTransaction({
                    uid: authUser.uid,
                    action: body.action,
                    reason: body.reason,
                    description: plan.rule.description,
                    amount: plan.amount,
                    unverified: plan.unverified,
                    idempotencyKey: plan.forcedIdempotencyKey || (typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 128) : null),
                    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : null,
                    hazardId: plan.needsHazardCheck ? body.metadata.hazardId : null,
                    checkCaps: (quota) => pointsRules.checkDailyCaps(plan, body.reason, quota),
                });
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, ...result }));
            } catch (e) {
                if (e instanceof StoreError) {
                    res.statusCode = { USER_NOT_FOUND: 404, BANNED: 403, PROOF_FAILED: 422, CAP_REACHED: 429, INSUFFICIENT_FUNDS: 402 }[e.code] || 400;
                    res.end(JSON.stringify({ error: e.message }));
                    return;
                }
                throw e;
            }
            return;
        }

        // 4e. CLASSEMENT : pseudo + points gagnés
        if (req.method === "GET" && pathname === "/api/v1/leaderboard") {
            if (!extractBearerUser(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ top: await store.topPilots(10) }));
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
            await store.anonymizeUser(authUser.uid);
            res.statusCode = 200;
            res.end(JSON.stringify({
                success: true,
                message: "Données personnelles effacées (RGPD art. 17). Les preuves d'accident sont conservées de façon anonyme (art. 17.3.e)."
            }));
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

    return { server, store, wormVault, handleRequest };
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 8080;
    const { server, store, wormVault } = createSovereignApp();
    // Un coffre S3 sans Object Lock ne protège rien : le serveur refuse de démarrer.
    const ready = typeof wormVault.assertBucketLocked === "function" ? wormVault.assertBucketLocked() : Promise.resolve();
    ready.catch((err) => {
        console.error("[SovereignCore] Démarrage refusé :", err.message);
        process.exit(1);
    });
    ready.then(() => server.listen(port, () => {
        console.log(`[SovereignCore] Serveur actif sur le port ${port} — stockage : ${store.kind === "postgres" ? "PostgreSQL" : "MÉMOIRE (développement uniquement)"} — preuves : ${wormVault.kind || "fichiers locaux (développement uniquement)"}`);
    }));
    const shutdown = () => server.close(() => store.close().finally(() => process.exit(0)));
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

module.exports = { createSovereignApp, SOVEREIGN_CSP };

