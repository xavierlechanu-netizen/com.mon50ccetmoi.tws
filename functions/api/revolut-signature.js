/**
 * REVOLUT — Vérification de signature des webhooks (Merchant API)
 * ─────────────────────────────────────────────────────────────────────────────
 * Spécification Revolut :
 *   payload_to_sign    = "v1." + <Revolut-Request-Timestamp> + "." + <corps brut>
 *   Revolut-Signature  = "v1=" + HEX(HMAC_SHA256(signing_secret, payload_to_sign))
 *   (plusieurs signatures séparées par des virgules pendant une rotation de secret)
 *
 * Corrige l'ancienne implémentation qui hachait JSON.stringify(req.body) sans
 * timestamp ni préfixe "v1=" : toutes les notifications Revolut légitimes
 * étaient rejetées en 401 et aucun paiement n'était jamais confirmé.
 *
 * Sécurité : comparaison en temps constant (timingSafeEqual), fenêtre anti-rejeu
 * de 5 minutes (NIST DE.CM-06, OWASP ASVS v5.0.0-4.x).
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const crypto = require("crypto");

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * @param {Buffer|string} rawBody   Corps HTTP brut (req.rawBody)
 * @param {string} timestampHeader  Valeur de Revolut-Request-Timestamp (ms)
 * @param {string} signatureHeader  Valeur de Revolut-Signature
 * @param {string} secret           Secret de signature du webhook (wsk_...)
 * @param {{now?: number, toleranceMs?: number}} [opts]
 * @returns {{valid: boolean, reason?: string}}
 */
function verifyRevolutSignature(rawBody, timestampHeader, signatureHeader, secret, opts = {}) {
    if (!secret) return { valid: false, reason: "secret_missing" };
    if (rawBody === undefined || rawBody === null) return { valid: false, reason: "body_missing" };
    if (typeof timestampHeader !== "string" || !/^\d{10,16}$/.test(timestampHeader)) {
        return { valid: false, reason: "timestamp_invalid" };
    }
    if (typeof signatureHeader !== "string" || signatureHeader.length === 0 || signatureHeader.length > 2048) {
        return { valid: false, reason: "signature_missing" };
    }

    const now = typeof opts.now === "number" ? opts.now : Date.now();
    const tolerance = typeof opts.toleranceMs === "number" ? opts.toleranceMs : DEFAULT_TOLERANCE_MS;
    if (Math.abs(now - Number(timestampHeader)) > tolerance) {
        return { valid: false, reason: "timestamp_out_of_window" };
    }

    const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
    const payload = Buffer.concat([Buffer.from(`v1.${timestampHeader}.`, "utf8"), bodyBuf]);
    const expected = Buffer.from("v1=" + crypto.createHmac("sha256", secret).update(payload).digest("hex"), "utf8");

    const candidates = signatureHeader.split(",").map((s) => s.trim()).filter(Boolean);
    const match = candidates.some((sig) => {
        const sigBuf = Buffer.from(sig, "utf8");
        return sigBuf.length === expected.length && crypto.timingSafeEqual(sigBuf, expected);
    });

    return match ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}

module.exports = { verifyRevolutSignature, DEFAULT_TOLERANCE_MS };
