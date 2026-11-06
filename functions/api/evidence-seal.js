/**
 * evidence-seal.js — Sceau d'intégrité d'un rapport de sinistre (sans dépendance Firebase, testable).
 *
 * Au moment où un assureur paie, le serveur calcule l'empreinte SHA-256 des données de preuve
 * du dossier. Toute modification ultérieure (même d'un chiffre) donne une autre empreinte :
 * l'assureur peut vérifier que le rapport reçu est exactement celui qui a été scellé.
 *
 * Étape suivante (non branchée) : faire horodater cette empreinte par un prestataire
 * d'horodatage QUALIFIÉ (règlement eIDAS, jeton RFC 3161) pour une date opposable.
 */
"use strict";

const crypto = require("crypto");

/** Champs ajoutés par le paiement ou la gestion du dossier : exclus de l'empreinte. */
const NON_EVIDENCE_FIELDS = new Set([
    "payment_status", "payment_method", "revolut_order_id", "report_unlocked", "unlocked_at",
    "unlocked_for", "paid_tier", "paid_tiers", "integrity_alert", "evidence_sha256", "sealed_at", "sealed_by",
    "qualified_timestamp",
    "status", "resolvedBy", "resolvedAt",
]);

/** JSON canonique : clés triées à tous les niveaux, pour qu'un même contenu donne toujours la même empreinte. */
function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value === undefined ? null : value);
    if (typeof value.toMillis === "function") return JSON.stringify({ __timestamp: value.toMillis() });
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/** Ne garde que les données de preuve du dossier. */
function evidencePayload(caseData) {
    const out = {};
    for (const [k, v] of Object.entries(caseData || {})) {
        if (!NON_EVIDENCE_FIELDS.has(k)) out[k] = v;
    }
    return out;
}

/** Empreinte SHA-256 (hexadécimal) des données de preuve. */
function evidenceHash(caseData) {
    return crypto.createHash("sha256").update(stableStringify(evidencePayload(caseData)), "utf8").digest("hex");
}

module.exports = { NON_EVIDENCE_FIELDS, stableStringify, evidencePayload, evidenceHash };
