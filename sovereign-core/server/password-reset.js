/**
 * Mot de passe oublié (23/11/2026) : lien à usage unique, valable une heure.
 *
 * 11 pilotes sur 15 n'ont qu'un pseudo, sans vraie adresse : le lien est donc créé à la main sur le VPS
 * (scripts/lien-mot-de-passe.js), après avoir vérifié que la demande vient bien du pilote.
 * shortcut: pas d'envoi automatique par e-mail, à ajouter quand un serveur d'envoi sera joignable depuis le VPS.
 */
"use strict";

const crypto = require("crypto");

const RESET_TTL_MS = 60 * 60 * 1000;
const RESET_PAGE = "https://mon50ccetmoi.com/mot-de-passe-oublie.html";
const RESET_TOKEN_RE = /^[a-f0-9]{64}$/;
const PASSWORD_MAX_LENGTH = 256; // limite du hachage (crypto-auth.js)
const NEW_PASSWORD_RULE = "Le mot de passe doit contenir au moins 1 majuscule, 7 minuscules et 2 caractères spéciaux.";

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

/** Règle des NOUVEAUX mots de passe. Jamais appliquée à la connexion : les anciens restent valables. */
function newPasswordError(password) {
    if (typeof password !== "string" || password.length > PASSWORD_MAX_LENGTH) return NEW_PASSWORD_RULE;
    const count = (re) => (password.match(re) || []).length;
    const ok = count(/\p{Lu}/gu) >= 1 && count(/\p{Ll}/gu) >= 7 && count(/[^\p{L}\p{N}\s]/gu) >= 2;
    return ok ? null : NEW_PASSWORD_RULE;
}

/** Vrai pour un jeton émis avant le dernier changement de mot de passe : il ne se renouvelle plus. */
function issuedBeforePasswordChange(claims, user) {
    return Boolean(user.passwordChangedAt) && claims.iat < Math.floor(Date.parse(user.passwordChangedAt) / 1000);
}

/** Crée le lien d'un pilote (pseudo ou e-mail, comme à la connexion). Null si compte inconnu ou banni. */
async function createResetLink(store, identifier, now = Date.now()) {
    const id = String(identifier || "").trim().toLowerCase();
    if (!id) return null;
    const user = await store.findUserByEmail(id.includes("@") ? id : `${id}@mon50cc.internal`);
    if (!user || user.isBanned) return null;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(now + RESET_TTL_MS).toISOString();
    await store.createPasswordReset({ uid: user.uid, tokenHash: hashResetToken(token), expiresAt });
    return { uid: user.uid, username: user.username, url: `${RESET_PAGE}#token=${token}`, expiresAt };
}

module.exports = { RESET_TOKEN_RE, hashResetToken, newPasswordError, issuedBeforePasswordChange, createResetLink };
