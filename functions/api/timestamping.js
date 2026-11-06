/**
 * timestamping.js — Horodatage gratuit (non qualifié) de l'empreinte d'un rapport de sinistre.
 *
 *  1. FreeTSA (RFC 3161) : jeton signé par une autorité d'horodatage, vérifiable avec
 *     `openssl ts -verify`. Même format que les prestataires qualifiés eIDAS : passer au
 *     qualifié = changer l'URL (et l'authentification) dans RFC3161_SERVERS.
 *  2. OpenTimestamps : l'empreinte est ancrée dans la blockchain Bitcoin via un serveur
 *     « calendrier » (preuve indépendante, confirmée en quelques heures, vérifiable à vie).
 *
 * Seule l'empreinte SHA-256 est envoyée : aucune donnée personnelle ne quitte le serveur.
 * Non qualifié au sens d'eIDAS : recevable en justice (art. 41.1), sans présomption d'exactitude.
 */
"use strict";

const crypto = require("crypto");

const RFC3161_SERVERS = [{ name: "FreeTSA", url: "https://freetsa.org/tsr" }];
const OTS_CALENDARS = [
    "https://alice.btc.calendar.opentimestamps.org",
    "https://bob.btc.calendar.opentimestamps.org",
];
const TIMEOUT_MS = 8000;

// ─── Encodage DER minimal (juste ce qu'exige une requête RFC 3161) ──────────

function derLength(n) {
    if (n < 0x80) return Buffer.from([n]);
    const bytes = [];
    while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag, content) => Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
const derSequence = (...parts) => tlv(0x30, Buffer.concat(parts));
function derInteger(buf) {
    let b = Buffer.from(buf);
    while (b.length > 1 && b[0] === 0 && !(b[1] & 0x80)) b = b.subarray(1);
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); // entier positif
    return tlv(0x02, b);
}
const SHA256_ALGORITHM = Buffer.from("300d06096086480165030402010500", "hex"); // OID 2.16.840.1.101.3.4.2.1 + NULL

/**
 * TimeStampReq (RFC 3161 §2.4.1) : version 1, empreinte SHA-256, nonce, certificat demandé.
 */
function buildTimeStampReq(hashHex, nonce = crypto.randomBytes(8)) {
    if (!/^[0-9a-f]{64}$/i.test(hashHex)) throw new Error("Empreinte SHA-256 invalide");
    const messageImprint = derSequence(SHA256_ALGORITHM, tlv(0x04, Buffer.from(hashHex, "hex")));
    return derSequence(derInteger(Buffer.from([1])), messageImprint, derInteger(nonce), Buffer.from([0x01, 0x01, 0xff]));
}

/** Lit un élément DER : { tag, start (contenu), end }. */
function readTlv(buf, offset) {
    const tag = buf[offset];
    let len = buf[offset + 1];
    let pos = offset + 2;
    if (len & 0x80) {
        const n = len & 0x7f;
        len = 0;
        for (let i = 0; i < n; i++) len = (len << 8) | buf[pos + i];
        pos += n;
    }
    if (tag === undefined || pos + len > buf.length) throw new Error("Réponse d'horodatage tronquée");
    return { tag, start: pos, end: pos + len };
}

/**
 * Analyse une TimeStampResp : statut PKI (0 = accordé, 1 = accordé avec modifications)
 * et date du jeton (genTime, premier GeneralizedTime rencontré dans TSTInfo).
 */
function parseTimeStampResp(buf) {
    const outer = readTlv(buf, 0);
    if (outer.tag !== 0x30) throw new Error("Réponse d'horodatage invalide");
    const statusInfo = readTlv(buf, outer.start);
    const statusInt = readTlv(buf, statusInfo.start);
    if (statusInt.tag !== 0x02) throw new Error("Statut d'horodatage illisible");
    const status = buf.readUIntBE(statusInt.start, statusInt.end - statusInt.start);
    let genTime = null;
    const text = buf.toString("latin1", statusInfo.end);
    const m = /\x18[\x0f-\x15](\d{14}(?:\.\d+)?Z)/.exec(text);
    if (m) {
        const s = m[1];
        genTime = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12)}`;
    }
    return { status, granted: status === 0 || status === 1, genTime };
}

async function postWithTimeout(fetchFn, url, body, contentType) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    try {
        const resp = await fetchFn(url, {
            method: "POST",
            headers: { "Content-Type": contentType, "User-Agent": "mon50ccetmoi-evidence/1.0" },
            body,
            signal: ctrl ? ctrl.signal : undefined,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return Buffer.from(await resp.arrayBuffer());
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/** Jeton RFC 3161 (FreeTSA). */
async function requestRfc3161(hashHex, fetchFn = globalThis.fetch, server = RFC3161_SERVERS[0]) {
    const req = buildTimeStampReq(hashHex);
    const resp = await postWithTimeout(fetchFn, server.url, req, "application/timestamp-query");
    const parsed = parseTimeStampResp(resp);
    if (!parsed.granted) throw new Error(`Horodatage refusé (statut ${parsed.status})`);
    return { provider: server.name, url: server.url, genTime: parsed.genTime, tokenBase64: resp.toString("base64") };
}

/** Preuve OpenTimestamps (en attente d'ancrage Bitcoin, à « mettre à niveau » ensuite avec l'outil ots). */
async function requestOpenTimestamps(hashHex, fetchFn = globalThis.fetch, calendars = OTS_CALENDARS) {
    if (!/^[0-9a-f]{64}$/i.test(hashHex)) throw new Error("Empreinte SHA-256 invalide");
    let lastError = null;
    for (const cal of calendars) {
        try {
            const resp = await postWithTimeout(fetchFn, `${cal}/digest`, Buffer.from(hashHex, "hex"), "application/octet-stream");
            return { calendar: cal, pendingProofBase64: resp.toString("base64"), status: "EN_ATTENTE_BITCOIN" };
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError || new Error("Aucun calendrier OpenTimestamps disponible");
}

/** Les deux horodatages, indépendants : l'échec de l'un n'empêche pas l'autre. */
async function timestampEvidence(hashHex, fetchFn = globalThis.fetch) {
    const [tsa, ots] = await Promise.allSettled([requestRfc3161(hashHex, fetchFn), requestOpenTimestamps(hashHex, fetchFn)]);
    return {
        level: "NON_QUALIFIE",
        sha256: hashHex,
        rfc3161: tsa.status === "fulfilled" ? tsa.value : { error: String(tsa.reason && tsa.reason.message) },
        opentimestamps: ots.status === "fulfilled" ? ots.value : { error: String(ots.reason && ots.reason.message) },
    };
}

module.exports = {
    RFC3161_SERVERS,
    OTS_CALENDARS,
    buildTimeStampReq,
    parseTimeStampResp,
    requestRfc3161,
    requestOpenTimestamps,
    timestampEvidence,
};
