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
    rehashVerifiedPassword,
    verifyPassword,
    isFirebaseHash,
    signSovereignJwt,
    verifySovereignJwt
} = require("./crypto-auth");
const { resolveWormVault } = require("./storage-worm-s3");
const { createMemoryStore } = require("./store-memory");
const { createPgStore } = require("./store-pg");
const { StoreError } = require("./store-errors");
const { RESET_TOKEN_RE, hashResetToken, newPasswordError, issuedBeforePasswordChange } = require("./password-reset");
const { smsClientFromEnv, normalizeFrenchMobile } = require("./sms-ovh");
const { vigilanceServiceFromEnv } = require("./meteo-vigilance");
const { AUDIT_ACTIONS, verifyAuditChain } = require("./audit-log");
const { revolutClientFromEnv } = require("./revolut-merchant");
const { createPaymentsService, openProductsFromEnv, PaymentError } = require("./payments");
const { createGaragesService, GarageError } = require("./garages");
const { createShopService, ShopError } = require("./shop");
const { invoicesToCsv } = require("../../functions/api/invoicing");
const { createNexusBrain, llmFromEnv } = require("./nexus-brain");
const { createNexusVerifier } = require("./nexus-verifier");
const { createLive } = require("./live");
// Signaux rapides du cortège : texte envoyé par l'appli → icône (rien d'autre n'est accepté)
const GROUP_SIGNALS = Object.freeze({
    "Besoin d'essence": "⛽", "Pause demandée": "📸", "Problème technique": "🔧", "Danger signalé": "👮",
});
const pointsRules = require("../../functions/api/points-rules");

// Signalement des failles de sécurité (RFC 9116), même texte que src/public/.well-known/security.txt.
// « Expires » : à repousser chaque année (tests/security-txt.test.js échoue un mois avant).
const SECURITY_TXT = [
    "Contact: mailto:contact@mon50ccetmoi.com",
    "Expires: 2027-11-16T23:00:00.000Z",
    "Preferred-Languages: fr, en",
    "Canonical: https://mon50ccetmoi.com/.well-known/security.txt",
    "Canonical: https://api.mon50ccetmoi.com/.well-known/security.txt",
    "",
].join("\n");

// Alerte SOS : au plus 3 numéros, 3 alertes par pilote et par 10 minutes (anti-abus, SMS payants)
const SOS_MAX_CONTACTS = 3;
const SOS_MAX_ALERTS = 3;
const SOS_WINDOW_MS = 10 * 60 * 1000;
// Plafonds sur 24 h (audit du 16/11/2026, D2) : les numéros sont libres et les SMS payants.
// Par pilote : 10 alertes. Pour tout le serveur : un budget de SMS (SOS_DAILY_SMS_BUDGET, 300 par défaut),
// pour qu'un abus (comptes créés en série) ne vide pas le crédit SMS. Au-delà : « Appelez le 112 ».
const SOS_MAX_ALERTS_PER_DAY = 10;
const SOS_DAY_MS = 24 * 3600 * 1000;
const SOS_DEFAULT_DAILY_SMS_BUDGET = 300;
// Comptes de moins de 24 h : 10 % du budget au plus, pour que des comptes créés en série ne privent
// pas les vrais SOS. shortcut: des comptes préparés plus de 24 h à l'avance y échappent, ajouter une vérification du numéro si cela arrive.
const SOS_NEW_ACCOUNT_BUDGET_SHARE = 0.1;
// Jeton SOS : n'ouvre QUE l'alerte SOS (jamais une session). Une chute peut arriver des jours après
// la dernière saisie du mot de passe, alors que le jeton de session ne vit qu'une heure : l'appli
// garde ce jeton et le renouvelle (POST /api/v1/auth/sos-token) tant qu'elle est utilisée.
const SOS_TOKEN_PURPOSE = "sos";
const SOS_TOKEN_TTL_SEC = 30 * 24 * 3600;
const issueSosToken = (uid) => signSovereignJwt({ uid, purpose: SOS_TOKEN_PURPOSE }, { expiresInSec: SOS_TOKEN_TTL_SEC });
// Jeton de renouvellement (18/11/2026, phase A « comptes ») : le jeton de session ne vit qu'une heure,
// mais un pilote ne doit pas retaper son mot de passe à chaque page. Ce jeton de 30 jours n'ouvre QUE
// POST /api/v1/auth/refresh, qui vérifie à chaque fois que le compte existe encore et n'est pas banni,
// puis rend un nouveau jeton de session et un nouveau jeton de renouvellement (30 jours glissants).
const REFRESH_TOKEN_PURPOSE = "refresh";
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 3600;
const issueRefreshToken = (uid) => signSovereignJwt({ uid, purpose: REFRESH_TOKEN_PURPOSE }, { expiresInSec: REFRESH_TOKEN_TTL_SEC });

/** Réponse commune de l'inscription, de la connexion et du renouvellement de session. */
function sessionResponse(user) {
    return {
        uid: user.uid,
        email: user.email,
        username: user.username,
        role: user.role,
        braveCoins: user.braveCoins || 0,
        createdAt: user.createdAt || null,
        token: signSovereignJwt({ uid: user.uid, role: user.role, username: user.username }),
        refreshToken: issueRefreshToken(user.uid),
        sosToken: issueSosToken(user.uid)
    };
}

// Inscription et connexion (audit du 16/11/2026)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Phrases de passe acceptées jusqu'à la limite du hachage (crypto-auth.js : 256). Au-delà, l'inscription
// plantait (erreur 500) au lieu de répondre clairement ; à la connexion, rien n'est envoyé au hachage.
const PASSWORD_MAX_LENGTH = 256;
// Le pseudo est affiché aux autres membres : ni balise, ni guillemet, ni caractère de contrôle
// eslint-disable-next-line no-control-regex
const UNSAFE_USERNAME_RE = /[<>"'&`\u0000-\u001f\u007f]/;

const HAZARD_TYPES = ["pothole", "accident", "police", "roadwork", "obstacle", "weather", "other"];
const HAZARDS_PER_DAY = 30;
const HAZARD_MAX_AGE_MS = 24 * 3600 * 1000; // au-delà, un danger n'est plus montré
/** Type affiché par l'appli (« Route Dégradée », « animal »…) : texte court, sans balise. */
const isAppType = (v) => typeof v === "string" && v.length <= 40 && /^[\p{L}\p{N} _'-]+$/u.test(v);
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

/** Champs de profil envoyés par l'appli, vérifiés ; null si un seul est invalide ou inconnu. */
function profileChanges(body) {
    const allowed = { brand: 60, model: 60, department: 3, ghostMode: 0 };
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const keys = Object.keys(body);
    if (!keys.length || keys.some((k) => !(k in allowed))) return null;
    const out = {};
    for (const k of keys) {
        const v = body[k];
        if (k === "ghostMode") {
            if (typeof v !== "boolean") return null;
            out[k] = v;
            continue;
        }
        if (v === null || v === "") { out[k] = null; continue; }
        // eslint-disable-next-line no-control-regex
        if (typeof v !== "string" || v.trim().length > allowed[k] || /[<>\u0000-\u001f]/.test(v)) return null;
        out[k] = v.trim() || null;
    }
    if (out.department && !/^(0[1-9]|[1-8]\d|9[0-5]|2[AB]|97[1-6])$/.test(out.department)) return null;
    return out;
}

function applySecurityHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", SOVEREIGN_CSP);
    // Réponses de l'API (comptes, export RGPD…) : jamais gardées par le navigateur ni un proxy.
    // La vigilance météo, publique, remplace cette valeur par sa propre durée.
    res.setHeader("Cache-Control", "no-store");
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
    // Envoi des SMS d'urgence (OVHcloud) ; null si non configuré : la route SOS répond alors 503.
    const smsClient = options.smsClient !== undefined ? options.smsClient : smsClientFromEnv();
    const sosHits = new Map();
    // Numéros alertés par pilote sur 24 h : uid → Map(numéro → date), pour qu'un compte ne vise pas n'importe qui
    const sosNumbers = new Map();
    // SMS envoyés par le serveur sur 24 h glissantes : [{ t, n, isNew }]
    let sosSmsLog = [];
    const sosDailySmsBudget = options.sosDailySmsBudget ||
        Number(process.env.SOS_DAILY_SMS_BUDGET) || SOS_DEFAULT_DAILY_SMS_BUDGET;
    // Vigilance Météo-France : clé METEO_FRANCE_API_KEY facultative (sans elle, la route répond « fallback »)
    const vigilance = options.vigilance || vigilanceServiceFromEnv();

    // Limitation des tentatives d'authentification (anti force brute, OWASP ASVS v5.0.0-6.3)
    const authLimit = {
        maxAttempts: options.authMaxAttempts || 10,
        windowMs: options.authWindowMs || 15 * 60 * 1000,
        hits: new Map()
    };
    // Routes publiques de lecture (vigilance météo) : l'appli interroge toutes les 5 min, et
    // plusieurs pilotes peuvent partager une adresse IP (box, réseau mobile) : limite large,
    // seulement contre l'arrosage.
    const publicReadLimit = {
        maxAttempts: options.publicReadMaxRequests || 120,
        windowMs: options.publicReadWindowMs || 10 * 60 * 1000,
        hits: new Map()
    };
    // Paiements : 20 commandes par pilote et par 10 min ; suivi d'une commande toutes les 2 s au plus
    const paymentOrderLimit = { maxAttempts: 20, windowMs: 10 * 60 * 1000, hits: new Map() };
    const paymentPollLimit = { maxAttempts: 30, windowMs: 60 * 1000, hits: new Map() };
    // SOS communautaire et groupes de balade : positions toutes les 5 s, plus quelques gestes
    const live = options.live || createLive();
    const liveLimit = { maxAttempts: 40, windowMs: 60 * 1000, hits: new Map() };
    // Liste d'attente (route publique) : 5 inscriptions par adresse IP et par heure
    const waitlistLimit = { maxAttempts: 5, windowMs: 60 * 60 * 1000, hits: new Map() };

    // Paiements Revolut (payments.js) : REVOLUT_SECRET_KEY absente → « pas encore ouvert » (503)
    const revolut = options.revolut !== undefined ? options.revolut : revolutClientFromEnv();
    const payments = createPaymentsService({
        store, revolut, audit,
        openProducts: options.paymentsOpenProducts || openProductsFromEnv(),
    });

    // Nexus Atlas : réponses apprises, puis Mistral 7B sur le VPS (NEXUS_LLM_URL) ; jamais pour une urgence
    const nexusBrain = createNexusBrain({ store, llm: options.nexusLlm !== undefined ? options.nexusLlm : llmFromEnv() });
    const nexusVerifier = createNexusVerifier({ store, brain: nexusBrain });
    const nexusLimit = { maxAttempts: 20, windowMs: 10 * 60 * 1000, hits: new Map() };
    const NEXUS_DECISIONS = { valider: "valide", corriger: "valide", refuser: "refuse" };

    // Espace garage et carnet d'entretien (garages.js). Codes d'accord : 3 erreurs → 7 minutes de verrou (garages.js).
    const garages = createGaragesService({ store, wormVault });
    const shop = createShopService({ store });
    const GARAGE_ROUTES = {
        "GET /api/v1/garages": (u) => garages.publicList(u),
        "GET /api/v1/garage/dashboard": (u) => garages.dashboard(u),
        "PATCH /api/v1/garage/profile": (u, body) => garages.saveProfile(u, body),
        "POST /api/v1/garage/clients": (u, body) => garages.linkClient(u, body),
        "POST /api/v1/garage/maintenance": (u, body) => garages.addGarageLog(u, body),
        "GET /api/v1/maintenance": (u) => garages.pilotCarnet(u),"POST /api/v1/maintenance/code": (u, body) => garages.createCode(u, body),
        "DELETE /api/v1/maintenance/garages": (u, body, url) => garages.revokeGarage(u, url.searchParams.get("garage")),
        // Boutique des points (shop.js)
        "GET /api/v1/shop": (u) => shop.catalog(u),
        "POST /api/v1/shop/buy": (u, body) => shop.buy(u, body),
    };

    function sendPaymentError(res, e) {
        if (!(e instanceof PaymentError)) throw e;
        res.statusCode = e.status;
        res.end(JSON.stringify({ error: e.message, ...e.extra }));
    }

    function clientIp(req) {
        if (options.trustProxy || process.env.SOVEREIGN_TRUST_PROXY === "1") {
            const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
            if (fwd) return fwd;
        }
        return (req.socket && req.socket.remoteAddress) || "unknown";
    }

    /** Enregistre une tentative et renvoie true si la limite est dépassée. */
    function isRateLimited(key, limit = authLimit) {
        const now = Date.now();
        const recent = (limit.hits.get(key) || []).filter((t) => now - t < limit.windowMs);
        recent.push(now);
        limit.hits.set(key, recent);
        if (limit.hits.size > 50000) {
            for (const [k, v] of limit.hits) {
                if (!v.some((t) => now - t < limit.windowMs)) limit.hits.delete(k);
            }
        }
        return recent.length > limit.maxAttempts;
    }

    // Empreinte d'un mot de passe aléatoire, calculée une fois : sert de leurre quand l'email est inconnu
    let dummyHash = null;
    function dummyPasswordHash() {
        if (!dummyHash) dummyHash = hashPassword(crypto.randomBytes(24).toString("hex"));
        return dummyHash;
    }

    function rejectTooManyAttempts(res, limit = authLimit) {
        res.statusCode = 429;
        res.setHeader("Retry-After", String(Math.ceil(limit.windowMs / 1000)));
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

    /**
     * Note une action dans le journal d'audit (audit-log.js). Ne bloque jamais la réponse : un
     * effacement RGPD ou une alerte SOS ne doivent pas échouer parce que le journal est indisponible.
     */
    async function audit(event) {
        try {
            await store.appendAudit(event);
        } catch (e) {
            console.error("[Audit] Écriture impossible :", e.message);
        }
    }

    /** Pilote de l'alerte SOS : jeton de session OU jeton SOS (rien d'autre). */
    function extractSosUser(req) {
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) return null;
        const verif = verifySovereignJwt(authHeader.slice(7).trim());
        if (!verif.valid) return null;
        const purpose = verif.payload.purpose;
        return !purpose || purpose === SOS_TOKEN_PURPOSE ? verif.payload : null;
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

        // 1 bis. SIGNALEMENT DES FAILLES (RFC 9116)
        if (req.method === "GET" && pathname === "/.well-known/security.txt") {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.end(SECURITY_TXT);
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
            if (cleanEmail.length > 255 || !EMAIL_RE.test(cleanEmail) ||
                cleanUsername.length < 2 || cleanUsername.length > 64 || UNSAFE_USERNAME_RE.test(cleanUsername)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Email (255 car. max) ou pseudonyme (2 à 64 car., sans < > \" ' & `) invalide." }));
                return;
            }
            if (String(password).length > PASSWORD_MAX_LENGTH) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: `Mot de passe trop long (${PASSWORD_MAX_LENGTH} caractères au plus).` }));
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

            await audit({ action: AUDIT_ACTIONS.AUTH_REGISTER, actorUid: userRecord.uid, actorRole: userRecord.role,
                targetType: "user", targetId: userRecord.uid });

            res.statusCode = 201;
            res.end(JSON.stringify(sessionResponse(userRecord)));
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
            const plainPassword = String(password || "");
            // Même calcul (scrypt) que le compte existe ou non : le temps de réponse ne doit pas
            // révéler quels emails sont inscrits (OWASP ASVS v5.0.0 V6, énumération des comptes).
            const passwordOk = plainPassword.length <= PASSWORD_MAX_LENGTH &&
                verifyPassword(plainPassword, user ? user.passwordHash : dummyPasswordHash());

            if (!user || !passwordOk) {
                // Compte existant seulement : un email inconnu n'est jamais écrit dans le journal
                if (user) {
                    await audit({ action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED, outcome: "denied", targetType: "user", targetId: user.uid });
                }
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Identifiants invalides." }));
                return;
            }

            // Compte banni : même règle que le renouvellement de session (route /auth/refresh)
            if (user.isBanned) {
                await audit({ action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED, outcome: "denied", targetType: "user", targetId: user.uid,
                    details: { reason: "banned" } });
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Ce compte est suspendu. Écrivez à contact@mon50ccetmoi.com." }));
                return;
            }

            // Compte importé de Firebase : le mot de passe vient d'être vérifié, on remplace
            // l'empreinte Firebase par une empreinte au format du serveur (une seule fois).
            if (isFirebaseHash(user.passwordHash)) {
                try {
                    await store.updatePasswordHash(user.uid, rehashVerifiedPassword(String(password)));
                } catch (e) {
                    console.error("[SovereignServer] Conversion de l'empreinte Firebase impossible :", e.message);
                }
            }

            await audit({ action: AUDIT_ACTIONS.AUTH_LOGIN, actorUid: user.uid, actorRole: user.role, targetType: "user", targetId: user.uid });

            res.statusCode = 200;
            res.end(JSON.stringify(sessionResponse(user)));
            return;
        }

        // 3 ter. RENOUVELLEMENT DE LA SESSION : jeton de renouvellement (30 jours) → nouveau jeton de
        // session (1 h). Compte supprimé (RGPD) ou banni : refusé, il faudra se reconnecter.
        if (req.method === "POST" && pathname === "/api/v1/auth/refresh") {
            const authHeader = req.headers.authorization || "";
            const verif = authHeader.startsWith("Bearer ") ? verifySovereignJwt(authHeader.slice(7).trim()) : { valid: false };
            const claims = verif.valid && verif.payload.purpose === REFRESH_TOKEN_PURPOSE ? verif.payload : null;
            const user = claims ? await store.findUserById(claims.uid) : null;
            // shortcut: un jeton de session déjà émis vit encore 1 h au plus après un changement de mot de passe
            if (!user || user.isBanned || issuedBeforePasswordChange(claims, user)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Session expirée. Reconnectez-vous." }));
                return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify(sessionResponse(user)));
            return;
        }

        // 3 quater. NOUVEAU MOT DE PASSE avec un lien à usage unique (scripts/lien-mot-de-passe.js)
        if (req.method === "POST" && pathname === "/api/v1/auth/reset-password") {
            if (isRateLimited(`reset:${clientIp(req)}`)) {
                rejectTooManyAttempts(res);
                return;
            }
            const { token, password } = body;
            // Règle vérifiée d'abord : un mot de passe refusé ne fait pas perdre le lien
            const ruleError = newPasswordError(password);
            if (ruleError) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: ruleError }));
                return;
            }
            const uid = typeof token === "string" && RESET_TOKEN_RE.test(token)
                ? await store.consumePasswordReset(hashResetToken(token), hashPassword(password))
                : null;
            if (!uid) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Ce lien n'est plus valable. Demandez-en un nouveau à contact@mon50ccetmoi.com." }));
                return;
            }
            await audit({ action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET, actorUid: uid, targetType: "user", targetId: uid });
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 3 bis. RENOUVELLEMENT DU JETON SOS (glissant) : avec un jeton SOS ou de session encore valide,
        // et seulement si le compte existe toujours.
        if (req.method === "POST" && pathname === "/api/v1/auth/sos-token") {
            const authUser = extractSosUser(req);
            const user = authUser ? await store.findUserById(authUser.uid) : null;
            if (!user || issuedBeforePasswordChange(authUser, user)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Reconnectez-vous pour réactiver l'alerte SOS automatique." }));
                return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ sosToken: issueSosToken(user.uid) }));
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
            await audit({ action: AUDIT_ACTIONS.EVIDENCE_SEALED, actorUid: authUser.uid, actorRole: authUser.role,
                targetType: "telemetry_session", targetId: sessionRecord.sessionId,
                details: { frames: finalFrames.length, crash: Boolean(isCrashReport), unit: unit.serial } });

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
                if (authUser) {
                    await audit({ action: AUDIT_ACTIONS.ADMIN_BLACKBOX_PROVISION, outcome: "denied",
                        actorUid: authUser.uid, actorRole: authUser.role });
                }
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
            await audit({ action: AUDIT_ACTIONS.ADMIN_BLACKBOX_PROVISION, actorUid: authUser.uid, actorRole: authUser.role,
                targetType: "blackbox_unit", targetId: unit.serial, details: { assigned: Boolean(unit.ownerUid) } });
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
            if (reg.created) {
                await audit({ action: AUDIT_ACTIONS.FACTORY_UNIT_REGISTERED, actorUid: authUser.uid, actorRole: authUser.role,
                    targetType: "blackbox_unit", targetId: reg.unit.serial, details: { revision, type } });
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
                const { type, lat, lng, description, appType } = body;
                if (!HAZARD_TYPES.includes(type) || !isLat(lat) || !isLng(lng) || (appType !== undefined && !isAppType(appType)) ||
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
                const hazard = await store.createHazard({ uid: authUser.uid, type, lat, lng, description: description || "", appType: appType || null });
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
            const hazards = await store.findHazardsNear({ lat, lng, radiusM: radiusKm * 1000, sinceMs: Date.now() - HAZARD_MAX_AGE_MS });
            res.statusCode = 200;
            res.end(JSON.stringify({ radiusKm, count: hazards.length, hazards }));
            return;
        }

        // 4c ter. VOTE sur un danger : toujours là (1) ou disparu (-1), un vote par pilote
        const voteMatch = req.method === "POST" && pathname.match(/^\/api\/v1\/hazards\/([0-9a-f-]{36})\/vote$/);
        if (voteMatch) {
            const authUser = extractBearerUser(req);
            if (!authUser || !(await store.findUserById(authUser.uid))) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            const vote = { confirm: 1, resolve: -1 }[body.vote];
            if (!vote) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Vote invalide (confirm ou resolve)." }));
                return;
            }
            const result = await store.voteHazard({ hazardId: voteMatch[1], uid: authUser.uid, vote });
            res.statusCode = result ? 200 : 404;
            res.end(JSON.stringify(result || { error: "Danger introuvable ou déjà retiré." }));
            return;
        }

        // 4b ter. SOS COMMUNAUTAIRE et GROUPES DE BALADE (cortège, convoi), en mémoire (live.js).
        const sosMatch = pathname.match(/^\/api\/v1\/sos-communaute(?:\/([0-9a-f-]{36})\/(aide|fin))?$/);
        const groupMatch = pathname.match(/^\/api\/v1\/groupes(?:\/([A-Z0-9]{4}))?$/);
        if (sosMatch || groupMatch) {
            const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
            const authUser = extractBearerUser(req);
            if (!authUser) return send(401, { error: "Authentification requise." });
            if (isRateLimited(`live:${authUser.uid}`, liveLimit)) return rejectTooManyAttempts(res, liveLimit);
            const user = await store.findUserById(authUser.uid);
            if (!user) return send(401, { error: "Compte introuvable ou supprimé." });
            const { uid } = authUser;
            const name = user.username || "Pilote";

            if (sosMatch && sosMatch[1]) {
                if (req.method !== "POST") return send(405, { error: "Méthode non autorisée." });
                const ok = sosMatch[2] === "aide"
                    ? live.helpSos({ id: sosMatch[1], uid, name })
                    : live.closeSos({ id: sosMatch[1], uid });
                return send(ok ? 200 : 404, ok ? { ok } : { error: "Alerte introuvable ou terminée." });
            }
            if (sosMatch && req.method === "POST") {
                const { type, lat, lng } = body;
                if (!live.SOS_TYPES.includes(type) || !isLat(lat) || !isLng(lng)) {
                    return send(400, { error: "Type d'alerte ou position invalide." });
                }
                const result = live.createSos({ uid, author: name, type, lat, lng });
                if (result.error) return send(429, { error: "Une alerte SOS toutes les 5 minutes au plus." });
                return send(201, result);
            }
            if (sosMatch && req.method === "GET") {
                const lat = Number(url.searchParams.get("lat"));
                const lng = Number(url.searchParams.get("lng"));
                if (!isLat(lat) || !isLng(lng)) return send(400, { error: "Position invalide (lat, lng)." });
                return send(200, { alerts: live.sosNear({ uid, lat, lng }) });
            }
            if (groupMatch && !groupMatch[1] && req.method === "POST") return send(201, { code: live.createGroup() });
            if (groupMatch && groupMatch[1] && req.method === "DELETE") {
                live.leaveGroup({ code: groupMatch[1], uid });
                return send(200, { ok: true });
            }
            if (groupMatch && groupMatch[1] && req.method === "POST") {
                const { lat, lng, signal } = body;
                if (!isLat(lat) || !isLng(lng) || (signal !== undefined && !Object.hasOwn(GROUP_SIGNALS, signal))) {
                    return send(400, { error: "Position ou signal invalide." });
                }
                const result = live.updateMember({
                    code: groupMatch[1], uid, name, lat, lng,
                    signal: signal ? { text: signal, icon: GROUP_SIGNALS[signal] } : undefined,
                });
                if (result.error === "introuvable") return send(404, { error: "Groupe introuvable ou terminé." });
                if (result.error) return send(409, { error: "Ce groupe est complet (20 pilotes)." });
                return send(200, result);
            }
            return send(405, { error: "Méthode non autorisée." });
        }

        // 4c quater. LISTE D'ATTENTE de la Boîte Noire : adresse + consentement, sans compte
        if (req.method === "POST" && pathname === "/api/v1/waitlist") {
            if (isRateLimited(`waitlist:${clientIp(req)}`, waitlistLimit)) {
                rejectTooManyAttempts(res, waitlistLimit);
                return;
            }
            const email = String(body.email || "").trim().toLowerCase();
            if (body.consent !== true || email.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Adresse invalide ou consentement manquant." }));
                return;
            }
            await store.addToWaitlist(email);
            res.statusCode = 200; // même réponse si l'adresse y était déjà : ne dit pas qui est inscrit
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 4c bis. ALERTE SOS : SMS réels aux anges gardiens, par OVHcloud.
        // « sent » ne compte que les numéros acceptés par OVHcloud : l'appli n'annonce jamais
        // un envoi qui n'a pas eu lieu.
        if (req.method === "POST" && pathname === "/api/v1/sos") {
            const authUser = extractSosUser(req);
            if (!authUser) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise.", sent: 0 }));
                return;
            }
            const { lat, lng, accuracy, contacts, kind } = body;
            const numbers = Array.isArray(contacts)
                ? [...new Set(contacts.map(normalizeFrenchMobile).filter(Boolean))]
                : [];
            if (!isLat(lat) || !isLng(lng) || numbers.length === 0 || numbers.length > SOS_MAX_CONTACTS ||
                (kind !== undefined && kind !== "fall" && kind !== "manual")) {
                res.statusCode = 400;
                res.end(JSON.stringify({
                    error: `Position GPS et 1 à ${SOS_MAX_CONTACTS} numéros de mobile français (06 ou 07) requis.`,
                    sent: 0,
                }));
                return;
            }
            const user = await store.findUserById(authUser.uid);
            if (!user) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Compte introuvable ou supprimé.", sent: 0 }));
                return;
            }
            if (user.isBanned) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Compte suspendu : envoi de SMS impossible. Appelez le 112.", sent: 0 }));
                return;
            }
            const now = Date.now();
            const today = (sosHits.get(authUser.uid) || []).filter((t) => now - t < SOS_DAY_MS);
            const recent = today.filter((t) => now - t < SOS_WINDOW_MS);
            if (recent.length >= SOS_MAX_ALERTS || today.length >= SOS_MAX_ALERTS_PER_DAY) {
                res.statusCode = 429;
                res.end(JSON.stringify({ error: "Trop d'alertes SOS rapprochées. Appelez le 112.", sent: 0 }));
                return;
            }
            const recentNumbers = new Map([...(sosNumbers.get(authUser.uid) || [])].filter(([, t]) => now - t < SOS_DAY_MS));
            if (new Set([...recentNumbers.keys(), ...numbers]).size > SOS_MAX_CONTACTS) {
                res.statusCode = 429;
                res.end(JSON.stringify({ error: "Trop de numéros différents alertés aujourd'hui. Appelez le 112.", sent: 0 }));
                return;
            }
            sosSmsLog = sosSmsLog.filter((e) => now - e.t < SOS_DAY_MS);
            const smsToday = sosSmsLog.reduce((sum, e) => sum + e.n, 0);
            const smsFromNewAccounts = sosSmsLog.reduce((sum, e) => sum + (e.isNew ? e.n : 0), 0);
            const isNewAccount = Boolean(user.createdAt) && now - Date.parse(user.createdAt) < SOS_DAY_MS;
            if (smsToday + numbers.length > sosDailySmsBudget ||
                (isNewAccount && smsFromNewAccounts + numbers.length > Math.ceil(sosDailySmsBudget * SOS_NEW_ACCOUNT_BUDGET_SHARE))) {
                console.error(`[SOS] Budget SMS du jour atteint (${smsToday}/${sosDailySmsBudget}) : abus possible, vérifier les journaux.`);
                res.statusCode = 429;
                res.end(JSON.stringify({ error: "Envoi de SMS momentanément indisponible. Appelez le 112 et prévenez vos proches.", sent: 0 }));
                return;
            }
            if (!smsClient) {
                res.statusCode = 503;
                res.end(JSON.stringify({ error: "Envoi de SMS non configuré sur ce serveur.", sent: 0 }));
                return;
            }
            today.push(now);
            sosHits.set(authUser.uid, today);
            sosSmsLog.push({ t: now, n: numbers.length, isNew: isNewAccount });
            numbers.forEach((n) => recentNumbers.set(n, now));
            sosNumbers.set(authUser.uid, recentNumbers);

            // Lettres, chiffres, _ et - seulement : un pseudo ne doit pas glisser une adresse web dans le SMS
            const pseudo = String(user.username || "").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 30) || "Un pilote";
            const where = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            const precision = Number.isFinite(accuracy) && accuracy > 0 ? ` (precision ${Math.round(accuracy)} m)` : "";
            const message = [
                "ALERTE SOS mon50ccetmoi",
                kind === "manual"
                    ? `${pseudo} a declenche une alerte et a besoin d'aide.`
                    : `${pseudo} a peut-etre chute et ne repond pas.`,
                `Position${precision} : https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=17/${where.replace(",", "/")}`,
                "Appelez-le. Urgence : 112.",
            ].join("\n");
            try {
                const result = await smsClient.send({ receivers: numbers, message });
                const sent = result.validReceivers.length;
                // Journal sans numéros de téléphone ni position (données personnelles)
                console.log(`[SOS] ${authUser.uid} : ${sent}/${numbers.length} SMS acceptés par OVHcloud`);
                await audit({ action: AUDIT_ACTIONS.SOS_SENT, outcome: sent > 0 ? "success" : "failure", actorUid: authUser.uid,
                    targetType: "user", targetId: authUser.uid, details: { sent, requested: numbers.length, kind: kind || "fall" } });
                res.statusCode = sent > 0 ? 200 : 502;
                res.end(JSON.stringify({ sent, requested: numbers.length, invalid: result.invalidReceivers.length }));
            } catch (e) {
                console.error("[SOS] Envoi impossible :", e.message);
                res.statusCode = 502;
                res.end(JSON.stringify({ error: "L'envoi des SMS a échoué. Appelez le 112 et prévenez vos proches.", sent: 0 }));
            }
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

        // 4d bis. MES POINTS : solde et historique du pilote connecté (remplace getPointsHistory)
        if (req.method === "GET" && pathname === "/api/v1/points") {
            const authUser = extractBearerUser(req);
            const user = authUser ? await store.findUserById(authUser.uid) : null;
            if (!user) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            const limit = Math.min(Math.max(Math.floor(Number(url.searchParams.get("limit"))) || 30, 1), 100);
            res.statusCode = 200;
            res.end(JSON.stringify({ balance: user.braveCoins || 0, history: await store.listPointsHistory(user.uid, limit) }));
            return;
        }

        // 4d ter. MES BADGES et trajets déclarés : lecture seule, jamais attribués par l'appli
        if (req.method === "GET" && pathname === "/api/v1/achievements") {
            const authUser = extractBearerUser(req);
            const user = authUser ? await store.findUserById(authUser.uid) : null;
            if (!user) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ achievements: await store.listAchievements(user.uid) }));
            return;
        }

        // 4d quater. MON PROFIL (véhicule, département, mode fantôme). La date d'inscription (offre
        // Fondateur) vient de l'import Firebase et ne se modifie jamais depuis l'appli.
        if (pathname === "/api/v1/profile" && (req.method === "GET" || req.method === "PATCH")) {
            const authUser = extractBearerUser(req);
            const user = authUser ? await store.findUserById(authUser.uid) : null;
            if (!user) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }
            const profile = (await store.getProfile(user.uid)) || { brand: null, model: null, department: null, ghostMode: false, registeredAt: null };
            if (req.method === "PATCH") {
                const changes = profileChanges(body);
                if (!changes) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "Profil invalide." }));
                    return;
                }
                Object.assign(profile, changes);
                await store.saveProfile(user.uid, profile);
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ profile }));
            return;
        }

        // 4d quinquies. ESPACE GARAGE ET CARNET D'ENTRETIEN (garages.js). Seule la carte des garages
        // certifiés est publique ; tout le reste demande d'être connecté.
        const garageRoute = GARAGE_ROUTES[`${req.method} ${pathname}`];
        if (garageRoute) {
            const authUser = extractBearerUser(req);
            try {
                const result = await garageRoute(authUser, body || {}, url);
                res.statusCode = 200;
                if (pathname === "/api/v1/garages") res.setHeader("Cache-Control", "public, max-age=300");
                res.end(JSON.stringify(result));
            } catch (e) {
                if (e instanceof StoreError) {
                    res.statusCode = { USER_NOT_FOUND: 404, BANNED: 403, INSUFFICIENT_FUNDS: 402 }[e.code] || 400;
                    res.end(JSON.stringify({ error: e.message }));
                    return;
                }
                if (!(e instanceof GarageError) && !(e instanceof ShopError)) throw e;
                res.statusCode = e.status;
                res.end(JSON.stringify({ error: e.message }));
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

        // 4f. VIGILANCE MÉTÉO-FRANCE : information publique de sécurité, sans compte (visiteurs compris).
        // La clé Météo-France reste sur le serveur ; carte gardée 10 min (meteo-vigilance.js).
        if (req.method === "GET" && pathname === "/api/v1/meteo/vigilance") {
            if (isRateLimited(`meteo:${clientIp(req)}`, publicReadLimit)) {
                rejectTooManyAttempts(res, publicReadLimit);
                return;
            }
            const carte = await vigilance.current();
            res.statusCode = 200;
            res.setHeader("Cache-Control", carte.cacheControl);
            res.end(JSON.stringify(carte.body));
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
            // Signature bonne : la commande est encore relue chez Revolut avant toute livraison (payments.js)
            const out = await payments.handleWebhookEvent(body);
            res.statusCode = out.status;
            res.end(JSON.stringify({ success: out.status === 200, ...out.body }));
            return;
        }

        // 5 bis. PAIEMENTS : nouvelle commande, puis suivi par l'acheteur (remplacent les Cloud Functions
        // createRevolutOrder et checkPaymentStatus). Pilote connecté au serveur souverain obligatoire.
        if (pathname === "/api/v1/payments/orders" && (req.method === "POST" || req.method === "GET")) {
            const authUser = extractBearerUser(req);
            if (!authUser) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Connectez-vous pour payer." }));
                return;
            }
            const limit = req.method === "POST" ? paymentOrderLimit : paymentPollLimit;
            if (isRateLimited(`pay-${req.method}:${authUser.uid}`, limit)) {
                rejectTooManyAttempts(res, limit);
                return;
            }
            try {
                const result = req.method === "POST"
                    ? await payments.createOrder(authUser, body)
                    : await payments.orderStatus(authUser, url.searchParams.get("case_id"));
                res.statusCode = 200;
                res.end(JSON.stringify(result));
            } catch (e) {
                sendPaymentError(res, e);
            }
            return;
        }

        // 5 quater. NEXUS ATLAS : question du pilote (l'appli a déjà essayé ses commandes et Légifrance).
        //          Urgence → « SOS » sans jamais passer par Mistral (nexus-brain.js).
        if (req.method === "POST" && pathname === "/api/v1/nexus/ask") {
            const authUser = extractBearerUser(req);
            if (!authUser) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Connectez-vous pour parler à Nexus Atlas." }));
                return;
            }
            if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 2000) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Question vide ou trop longue." }));
                return;
            }
            if (isRateLimited(`nexus:${authUser.uid}`, nexusLimit)) {
                rejectTooManyAttempts(res, nexusLimit);
                return;
            }
            const out = await nexusBrain.ask({ question: body.question, driving: body.driving === true });
            res.statusCode = 200;
            res.end(JSON.stringify(out));
            return;
        }

        // 5 quinquies. NEXUS ATLAS, administrateur : carnet d'apprentissage (questions les plus posées
        //              d'abord) et décision (valider, corriger, refuser). Chaque lecture et décision est notée.
        const nexusEntryMatch = pathname.match(/^\/api\/v1\/admin\/nexus\/carnet(?:\/(\d{1,12}))?$/);
        if (nexusEntryMatch && (req.method === "GET" || req.method === "POST")) {
            const authUser = extractBearerUser(req);
            if (!authUser || authUser.role !== "admin") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Réservé aux administrateurs." }));
                return;
            }
            if (req.method === "GET" && !nexusEntryMatch[1]) {
                const status = url.searchParams.get("status");
                await audit({ action: AUDIT_ACTIONS.ADMIN_NEXUS_READ, actorUid: authUser.uid, actorRole: authUser.role });
                res.statusCode = 200;
                res.end(JSON.stringify({
                    mistral: nexusBrain.llmConfigured,
                    enAttente: nexusVerifier.pending(),
                    entries: await store.listNexusNotebook({ status: status || null, limit: Number(url.searchParams.get("limit")) || 100 }),
                }));
                return;
            }
            const id = Number(nexusEntryMatch[1]);
            const decision = NEXUS_DECISIONS[body.decision];
            const answer = typeof body.answer === "string" ? body.answer.trim() : "";
            if (req.method !== "POST" || !id || !decision || (body.decision === "corriger" && (!answer || answer.length > 4000))) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Décision attendue : valider, corriger (avec la réponse corrigée) ou refuser." }));
                return;
            }
            const updated = await store.updateNexusEntry(id, {
                status: decision, answer: body.decision === "corriger" ? answer : undefined, reviewedBy: authUser.uid,
            });
            if (!updated) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Entrée introuvable." }));
                return;
            }
            await audit({ action: AUDIT_ACTIONS.ADMIN_NEXUS_REVIEW, actorUid: authUser.uid, actorRole: authUser.role,
                targetType: "nexus_entry", targetId: String(id), details: { decision: body.decision } });
            res.statusCode = 200;
            res.end(JSON.stringify(updated));
            return;
        }

        // 5 ter. PAIEMENTS, administrateur : commandes récentes (avec ce qu'il reste à faire à la main)
        //        et factures à émettre (CSV pour Kolecto). Chaque lecture est notée dans le journal.
        if (req.method === "GET" && (pathname === "/api/v1/admin/payments" || pathname === "/api/v1/admin/payments/invoices.csv")) {
            const authUser = extractBearerUser(req);
            if (!authUser || authUser.role !== "admin") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Réservé aux administrateurs." }));
                return;
            }
            const csv = pathname.endsWith(".csv");
            await audit({ action: AUDIT_ACTIONS.ADMIN_PAYMENTS_READ, actorUid: authUser.uid, actorRole: authUser.role,
                details: { invoices: csv } });
            if (csv) {
                res.statusCode = 200;
                res.setHeader("Content-Type", "text/csv; charset=utf-8");
                res.setHeader("Content-Disposition", 'attachment; filename="factures-a-emettre.csv"');
                res.end("﻿" + invoicesToCsv(await store.listInvoicesToIssue()));
                return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({
                configured: payments.configured,
                mode: revolut ? revolut.mode : null,
                openProducts: payments.openProducts,
                orders: await payments.listForAdmin(Number(url.searchParams.get("limit")) || 100),
                dons: await shop.donations(),
            }));
            return;
        }

        // 6. DROITS DES PERSONNES (RGPD) sur /api/v1/rgpd/account, avec un jeton de session :
        //    GET = accès et portabilité (art. 15 et 20), PATCH = rectification (art. 16) et
        //    opposition au classement (art. 21), DELETE = effacement (art. 17).
        if (pathname === "/api/v1/rgpd/account" && ["GET", "PATCH", "DELETE"].includes(req.method)) {
            const authUser = extractBearerUser(req);
            const user = authUser ? await store.findUserById(authUser.uid) : null;
            if (!user) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: "Authentification requise." }));
                return;
            }

            if (req.method === "GET") {
                const data = await store.exportUserData(user.uid);
                const ownTrail = await store.listAudit({ subjectUid: user.uid, limit: 1000 });
                await audit({ action: AUDIT_ACTIONS.RGPD_EXPORT, actorUid: user.uid, actorRole: user.role, targetType: "user", targetId: user.uid });
                res.statusCode = 200;
                res.setHeader("Content-Disposition", 'attachment; filename="mon50ccetmoi-mes-donnees.json"');
                res.end(JSON.stringify({
                    format: "mon50ccetmoi-export-rgpd-v1",
                    generatedAt: new Date().toISOString(),
                    controller: "Xavier Le Chanu (EI), mon50ccetmoi.com — contact@mon50ccetmoi.com",
                    ...data,
                    // Qui a fait quoi sur ce compte (connexions, exports, preuves scellées…)
                    auditTrail: ownTrail.map(({ seq, at, action, outcome, actorRole, targetType, details }) =>
                        ({ seq, at, action, outcome, actorRole, targetType, details })),
                    notes: [
                        "Les trames de la Boîte Noire scellées comme preuves sont gardées 5 ans dans un coffre inaltérable (OVHcloud, Gravelines). Une copie peut être demandée à contact@mon50ccetmoi.com.",
                        "Les numéros des anges gardiens ne sont pas conservés par ce serveur : ils restent dans votre téléphone et ne sont transmis à OVHcloud qu'au moment d'une alerte SOS.",
                        "Les données encore gérées par l'ancienne plateforme (Firebase) s'exportent depuis l'application : Sécurité & RGPD > Exporter mes données.",
                    ],
                }, null, 2));
                return;
            }

            if (req.method === "PATCH") {
                const changes = {};
                const fields = [];
                if (body.username !== undefined || body.email !== undefined) {
                    // Changer d'identifiant demande le mot de passe actuel (un jeton volé ne suffit pas)
                    const current = String(body.currentPassword || "");
                    if (!current || current.length > PASSWORD_MAX_LENGTH || !verifyPassword(current, user.passwordHash)) {
                        await audit({ action: AUDIT_ACTIONS.RGPD_RECTIFY, outcome: "denied", actorUid: user.uid, actorRole: user.role,
                            targetType: "user", targetId: user.uid });
                        res.statusCode = 403;
                        res.end(JSON.stringify({ error: "Mot de passe actuel requis pour changer d'email ou de pseudonyme." }));
                        return;
                    }
                }
                if (body.email !== undefined) {
                    const cleanEmail = String(body.email).trim().toLowerCase();
                    if (cleanEmail.length > 255 || !EMAIL_RE.test(cleanEmail)) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: "Email invalide (255 caractères au plus)." }));
                        return;
                    }
                    changes.email = cleanEmail;
                    fields.push("email");
                }
                if (body.username !== undefined) {
                    const cleanUsername = String(body.username).trim();
                    if (cleanUsername.length < 2 || cleanUsername.length > 64 || UNSAFE_USERNAME_RE.test(cleanUsername)) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: "Pseudonyme invalide (2 à 64 car., sans < > \" ' & `)." }));
                        return;
                    }
                    changes.username = cleanUsername;
                    fields.push("username");
                }
                if (body.leaderboardVisible !== undefined) {
                    if (typeof body.leaderboardVisible !== "boolean") {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: "leaderboardVisible doit valoir true ou false." }));
                        return;
                    }
                    changes.hideFromLeaderboard = !body.leaderboardVisible;
                    fields.push("leaderboardVisible");
                }
                if (fields.length === 0) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "Rien à modifier (email, username ou leaderboardVisible)." }));
                    return;
                }
                let updated;
                try {
                    updated = await store.updateUserProfile(user.uid, changes);
                } catch (e) {
                    if (e instanceof StoreError) {
                        res.statusCode = e.code === "USER_NOT_FOUND" ? 404 : 409;
                        res.end(JSON.stringify({ error: e.message }));
                        return;
                    }
                    throw e;
                }
                await audit({ action: AUDIT_ACTIONS.RGPD_RECTIFY, actorUid: user.uid, actorRole: user.role,
                    targetType: "user", targetId: user.uid, details: { fields } });
                res.statusCode = 200;
                res.end(JSON.stringify({
                    uid: updated.uid, email: updated.email, username: updated.username,
                    leaderboardVisible: !updated.hideFromLeaderboard,
                }));
                return;
            }

            await store.anonymizeUser(user.uid);
            await audit({ action: AUDIT_ACTIONS.RGPD_ERASE, actorUid: user.uid, actorRole: user.role, targetType: "user", targetId: user.uid });
            res.statusCode = 200;
            res.end(JSON.stringify({
                success: true,
                message: "Données personnelles effacées (RGPD art. 17) : email, pseudonyme, mot de passe et textes des signalements. " +
                    "Les preuves d'accident déjà scellées restent 5 ans dans le coffre, rattachées à un identifiant qui ne mène plus à vous (art. 17.3.e)."
            }));
            return;
        }

        // 7. JOURNAL D'AUDIT (administrateurs) : lecture par pages et vérification de la chaîne.
        //    Chaque lecture est elle-même notée (on sait qui a regardé le journal).
        if (req.method === "GET" && (pathname === "/api/v1/admin/audit" || pathname === "/api/v1/admin/audit/verify")) {
            const authUser = extractBearerUser(req);
            if (!authUser || authUser.role !== "admin") {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "Réservé aux administrateurs." }));
                return;
            }
            const verifyAll = pathname.endsWith("/verify");
            await audit({ action: AUDIT_ACTIONS.ADMIN_AUDIT_READ, actorUid: authUser.uid, actorRole: authUser.role,
                targetType: "audit_log", details: { verify: verifyAll } });
            if (verifyAll) {
                const all = [];
                for (let after = 0; ;) {
                    const page = await store.listAudit({ afterSeq: after, limit: 1000 });
                    all.push(...page);
                    if (page.length < 1000) break;
                    after = page[page.length - 1].seq;
                }
                res.statusCode = 200;
                res.end(JSON.stringify(verifyAuditChain(all)));
                return;
            }
            const afterSeq = Math.max(Number(url.searchParams.get("afterSeq")) || 0, 0);
            const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 1000);
            const entries = await store.listAudit({ afterSeq, limit });
            res.statusCode = 200;
            res.end(JSON.stringify({ entries, nextAfterSeq: entries.length ? entries[entries.length - 1].seq : afterSeq }));
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

    return { server, store, wormVault, vigilance, payments, nexusBrain, nexusVerifier, handleRequest };
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 8080;
    const { server, store, wormVault, vigilance, payments, nexusBrain, nexusVerifier } = createSovereignApp();
    nexusVerifier.start();
    if (!nexusBrain.llmConfigured) {
        console.warn("[SovereignCore] NEXUS_LLM_URL absente : Nexus Atlas répond « Réessayez plus tard » au lieu de Mistral.");
    }
    if (!vigilance.configured) {
        console.warn("[SovereignCore] METEO_FRANCE_API_KEY absente : la vigilance Météo-France répond « indisponible » (deploy/README.md, étape 9 bis).");
    }
    if (!payments.configured) {
        console.warn("[SovereignCore] REVOLUT_SECRET_KEY absente : les paiements répondent « pas encore ouvert » (docs/PLAN_DEMENAGEMENT_GOOGLE.md, § 7).");
    } else {
        console.log(`[SovereignCore] Paiements Revolut (${process.env.REVOLUT_ENV === "sandbox" ? "SANDBOX, essais" : "production"}) : ${payments.openProducts.join(", ") || "aucun produit ouvert"}.`);
    }
    // Un coffre S3 sans Object Lock ne protège rien : le serveur refuse de démarrer.
    // Puis les migrations de la base (db/migrations, rejouables) avant d'accepter des requêtes.
    const ready = (typeof wormVault.assertBucketLocked === "function" ? wormVault.assertBucketLocked() : Promise.resolve())
        .then(() => store.migrate());
    ready.catch((err) => {
        console.error("[SovereignCore] Démarrage refusé :", err.message);
        process.exit(1);
    });
    ready.then(() => server.listen(port, () => {
        console.log(`[SovereignCore] Serveur actif sur le port ${port} — stockage : ${store.kind === "postgres" ? "PostgreSQL" : "MÉMOIRE (développement uniquement)"} — preuves : ${wormVault.kind || "fichiers locaux (développement uniquement)"}`);
    }));

    // Chaque jour : effacement des preuves de plus de 5 ans (politique de confidentialité), purge du
    // journal d'audit au-delà d'un an, puis sceau de la tête de la chaîne
    // dans le coffre des preuves (Object Lock 5 ans). Réécrire le journal en base se verrait alors
    // en comparant la chaîne avec ces sceaux.
    let lastSealedSeq = 0;
    const dailyAuditCare = async () => {
        try {
            const p = await store.purgeExpiredProofs();
            if (p.telemetry || p.maintenance) {
                console.log(`[Preuves] Plus de 5 ans, effacées de la base : ${p.telemetry} session(s) Boîte Noire, ${p.maintenance} intervention(s) de garage.`);
            }
        } catch (e) {
            console.error("[Preuves] Effacement des preuves de plus de 5 ans impossible :", e.message);
        }
        try {
            await store.purgeAudit();
            const all = [];
            for (let after = 0; ;) {
                const page = await store.listAudit({ afterSeq: after, limit: 1000 });
                all.push(...page);
                if (page.length < 1000) break;
                after = page[page.length - 1].seq;
            }
            const check = verifyAuditChain(all);
            if (!check.valid) console.error(`[Audit] CHAÎNE ROMPUE à l'entrée ${check.brokenAtSeq} : ${check.reason}`);
            if (check.valid && check.headSeq && check.headSeq > lastSealedSeq) {
                await wormVault.sealTelemetryEvidence("audit-checkpoints", {
                    kind: "audit-checkpoint", headSeq: check.headSeq, headHash: check.headHash, count: check.count,
                    sealedAt: new Date().toISOString(),
                });
                lastSealedSeq = check.headSeq;
            }
        } catch (e) {
            console.error("[Audit] Entretien quotidien impossible :", e.message);
        }
    };
    ready.then(() => {
        setTimeout(dailyAuditCare, 60 * 1000).unref();
        setInterval(dailyAuditCare, 24 * 3600 * 1000).unref();
    }).catch(() => {});
    const shutdown = () => server.close(() => store.close().finally(() => process.exit(0)));
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

module.exports = { createSovereignApp, SOVEREIGN_CSP };

