/**
 * audit-log.js — Journal d'audit du serveur souverain (17/11/2026).
 *
 * But : savoir qui a fait quoi, et quand, sur les données personnelles et les actions sensibles
 * (connexion, export, rectification, effacement, preuves scellées, SOS, administration, usine,
 * et plus tard accès d'un assureur à un rapport).
 *
 * Minimal en données personnelles (RGPD art. 5.1.c) :
 *   - l'auteur et la cible ne sont désignés que par leur identifiant interne (UUID), jamais par
 *     un email, un pseudo, un numéro de téléphone ou une adresse IP ;
 *   - les actions forment une liste fermée (AUDIT_ACTIONS) : pas de texte libre ;
 *   - les détails sont filtrés (sanitizeDetails) : nombres, booléens et mots courts sans « @ »
 *     ni espace. Un email ou une phrase glissés par erreur sont retirés, pas enregistrés.
 *
 * Résistant aux modifications :
 *   - chaque entrée contient l'empreinte SHA-256 de la précédente (chaîne) : modifier, insérer
 *     ou retirer une entrée au milieu casse la chaîne (verifyAuditChain) ;
 *   - en base, des triggers interdisent UPDATE, TRUNCATE et DELETE (sauf les entrées de plus
 *     d'un an, purgées au bout de la durée de conservation) : db/migrations/001-audit-rgpd.sql ;
 *   - le serveur scelle chaque jour la tête de la chaîne dans le coffre S3 Object Lock (5 ans,
 *     mode COMPLIANCE) : même un administrateur de la base ne peut pas réécrire le passé sans
 *     que la comparaison avec ces sceaux le révèle.
 *
 * Testé : tests/sovereign-audit-rgpd.test.js (mémoire) et tests/sovereign-pg.test.js (PostgreSQL).
 */
"use strict";

const crypto = require("crypto");

const AUDIT_ACTIONS = Object.freeze({
    AUTH_REGISTER: "auth.register",
    AUTH_LOGIN: "auth.login",
    // Seulement quand le compte existe (cible = son identifiant) ; un email inconnu n'est pas noté
    AUTH_LOGIN_FAILED: "auth.login_failed",
    RGPD_EXPORT: "rgpd.export",
    RGPD_RECTIFY: "rgpd.rectify",
    RGPD_ERASE: "rgpd.erase",
    EVIDENCE_SEALED: "evidence.sealed",
    SOS_SENT: "sos.sent",
    ADMIN_BLACKBOX_PROVISION: "admin.blackbox_provision",
    FACTORY_UNIT_REGISTERED: "factory.unit_registered",
    ADMIN_AUDIT_READ: "admin.audit_read",
    // Réservé au portail assureur, quand il passera sur le serveur souverain (toute consultation
    // d'un rapport de sinistre par un assureur devra être notée avec cette action).
    B2B_REPORT_ACCESS: "b2b.report_access",
});
const ACTION_SET = new Set(Object.values(AUDIT_ACTIONS));
const OUTCOMES = new Set(["success", "denied", "failure"]);
const TARGET_TYPES = new Set(["user", "blackbox_unit", "telemetry_session", "audit_log", "insurer_report"]);

// Durée de conservation du journal : 1 an (recommandation CNIL pour les journaux : 6 mois à 1 an)
const AUDIT_RETENTION_DAYS = 365;
const GENESIS_HASH = "0".repeat(64);

const SAFE_KEY_RE = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
// Mot court : lettres, chiffres, point, tiret, deux-points, soulignement. Ni « @ » ni espace.
const SAFE_WORD_RE = /^[\w.:-]{0,64}$/;
const SAFE_ID_RE = /^[\w.:-]{1,64}$/;

function safeWord(v) {
    return typeof v === "string" && SAFE_WORD_RE.test(v);
}

/** Ne garde que des valeurs sans risque (nombres, booléens, mots courts, listes de mots). */
function sanitizeDetails(details) {
    const out = {};
    if (!details || typeof details !== "object" || Array.isArray(details)) return out;
    for (const [k, v] of Object.entries(details).slice(0, 12)) {
        if (!SAFE_KEY_RE.test(k)) continue;
        if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
        else if (safeWord(v)) out[k] = v;
        else if (Array.isArray(v) && v.length <= 10 && v.every(safeWord)) out[k] = [...v];
    }
    return out;
}

/** Sérialisation stable (clés triées) : la même entrée donne toujours la même empreinte. */
function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
}

/** Empreinte d'une entrée, chaînée à la précédente. */
function computeEntryHash(entry) {
    const material = canonicalJson({
        seq: entry.seq,
        at: entry.at,
        actorUid: entry.actorUid,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        outcome: entry.outcome,
        details: entry.details,
        prevHash: entry.prevHash,
    });
    return crypto.createHash("sha256").update(material, "utf8").digest("hex");
}

/**
 * Valide et normalise une demande d'écriture. Lève une erreur si l'action ou le résultat ne
 * font pas partie des listes fermées : un appel mal écrit doit se voir dans les tests.
 */
function normalizeEvent(event) {
    if (!event || !ACTION_SET.has(event.action)) throw new Error(`Action d'audit inconnue : ${event && event.action}`);
    const outcome = event.outcome || "success";
    if (!OUTCOMES.has(outcome)) throw new Error(`Résultat d'audit inconnu : ${outcome}`);
    const targetType = TARGET_TYPES.has(event.targetType) ? event.targetType : null;
    const id = (v) => (typeof v === "string" && SAFE_ID_RE.test(v) ? v : null);
    return {
        actorUid: id(event.actorUid),
        actorRole: safeWord(event.actorRole) && event.actorRole ? event.actorRole.slice(0, 20) : null,
        action: event.action,
        targetType,
        targetId: targetType ? id(event.targetId) : null,
        outcome,
        details: sanitizeDetails(event.details),
    };
}

/** Complète une entrée (numéro, date, chaînage) à partir de la dernière entrée connue. */
function sealEntry(event, last, now = new Date()) {
    const entry = {
        seq: last ? last.seq + 1 : 1,
        at: now.toISOString(),
        ...normalizeEvent(event),
        prevHash: last ? last.hash : GENESIS_HASH,
    };
    entry.hash = computeEntryHash(entry);
    return entry;
}

/**
 * Vérifie une suite d'entrées consécutives (ordre croissant).
 * La première entrée peut suivre des entrées purgées : son prevHash est alors accepté tel quel,
 * sauf si anchorHash (sceau de la veille, par ex.) est fourni.
 * @returns {{valid: boolean, count: number, headSeq: number|null, headHash: string|null, brokenAtSeq?: number, reason?: string}}
 */
function verifyAuditChain(entries, { anchorHash } = {}) {
    let prev = null;
    for (const e of entries) {
        const fail = (reason) => ({ valid: false, count: entries.length, headSeq: null, headHash: null, brokenAtSeq: e.seq, reason });
        if (prev) {
            if (e.seq !== prev.seq + 1) return fail("numéro manquant ou en double (entrée retirée ou insérée)");
            if (e.prevHash !== prev.hash) return fail("chaînage rompu (entrée précédente modifiée)");
        } else if (anchorHash && e.prevHash !== anchorHash) {
            return fail("la première entrée ne suit pas le sceau attendu");
        } else if (e.seq === 1 && e.prevHash !== GENESIS_HASH) {
            return fail("première entrée du journal mal initialisée");
        }
        if (computeEntryHash(e) !== e.hash) return fail("contenu modifié (empreinte différente)");
        prev = e;
    }
    return { valid: true, count: entries.length, headSeq: prev ? prev.seq : null, headHash: prev ? prev.hash : null };
}

module.exports = {
    AUDIT_ACTIONS,
    AUDIT_RETENTION_DAYS,
    GENESIS_HASH,
    sanitizeDetails,
    canonicalJson,
    computeEntryHash,
    normalizeEvent,
    sealEntry,
    verifyAuditChain,
};
