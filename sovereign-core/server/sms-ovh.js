/**
 * Envoi de SMS par l'API d'OVHcloud (France), pour l'alerte SOS.
 *
 * Remplace la file « sms_outbox » de Firestore, que rien ne lisait : aucun SMS d'urgence
 * n'était réellement envoyé. Ici, un SMS n'est annoncé comme parti que si OVHcloud l'a accepté
 * (validReceivers).
 *
 * Requêtes signées selon l'API OVHcloud :
 *   X-Ovh-Signature = "$1$" + SHA1(secret + "+" + consumerKey + "+" + méthode + "+" + URL + "+" + corps + "+" + horodatage)
 * Droits à donner à la clé : POST /sms/{service}/jobs (rien d'autre). Voir deploy/README.md.
 */
"use strict";

const crypto = require("crypto");

const OVH_API = "https://eu.api.ovh.com/1.0";

/**
 * Numéro de mobile français (06 ou 07, y compris saisi en +33 ou 0033) au format international,
 * ou null. Seuls les mobiles français sont acceptés : pas de numéros surtaxés ni étrangers,
 * ce qui limite les abus possibles d'une route qui envoie des SMS à nos frais.
 */
function normalizeFrenchMobile(raw) {
    const s = String(raw == null ? "" : raw).replace(/[\s.\-()]/g, "");
    const m = /^(?:0|\+33|0033)([67]\d{8})$/.exec(s);
    return m ? `+33${m[1]}` : null;
}

/** Texte sans accents ni caractères spéciaux : un SMS standard (160 caractères) au lieu d'un SMS « Unicode » (70). */
function toSmsText(text) {
    return String(text)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^\x20-\x7E\n]/g, "")
        .trim();
}

// SHA-1 imposé par le protocole de signature de l'API OVHcloud (« $1$ » = SHA-1), on ne peut
// pas en choisir un autre. Les collisions SHA-1 ne permettent ni de retrouver le secret ni de
// forger une requête signée ; l'alerte CodeQL « weak cryptographic algorithm » est classée
// « ne sera pas corrigée » pour cette raison.
function ovhSignature({ appSecret, consumerKey, method, url, body, timestamp }) {
    const raw = [appSecret, consumerKey, method, url, body, timestamp].join("+");
    return "$1$" + crypto.createHash("sha1").update(raw).digest("hex");
}

/**
 * @param {object} cfg { appKey, appSecret, consumerKey, serviceName, sender?, fetchImpl?, now? }
 *   sender : nom d'expéditeur validé chez OVHcloud ; sans lui, OVHcloud envoie depuis un numéro court.
 */
function createOvhSmsClient(cfg) {
    const { appKey, appSecret, consumerKey, serviceName, sender } = cfg;
    if (!appKey || !appSecret || !consumerKey || !serviceName) {
        throw new Error("Configuration SMS OVHcloud incomplète (clé, secret, clé consommateur, service).");
    }
    const fetchImpl = cfg.fetchImpl || globalThis.fetch;
    const now = cfg.now || (() => Date.now());

    return {
        kind: "ovh",
        /**
         * Envoie un même message à plusieurs numéros (déjà normalisés).
         * @returns {{ validReceivers: string[], invalidReceivers: string[], ids: number[] }}
         */
        async send({ receivers, message }) {
            const url = `${OVH_API}/sms/${encodeURIComponent(serviceName)}/jobs`;
            const job = {
                message: toSmsText(message),
                receivers,
                priority: "high",
                // Alerte personnelle, pas un message commercial : pas de mention « STOP ».
                noStopClause: true,
                ...(sender ? { sender } : { senderForResponse: true }),
            };
            const body = JSON.stringify(job);
            const timestamp = String(Math.floor(now() / 1000));
            const res = await fetchImpl(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Ovh-Application": appKey,
                    "X-Ovh-Consumer": consumerKey,
                    "X-Ovh-Timestamp": timestamp,
                    "X-Ovh-Signature": ovhSignature({ appSecret, consumerKey, method: "POST", url, body, timestamp }),
                },
                body,
            });
            const text = await res.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
            if (!res.ok) {
                throw new Error(`OVHcloud a refusé l'envoi (HTTP ${res.status}) : ${data.message || text.slice(0, 200)}`);
            }
            return {
                validReceivers: Array.isArray(data.validReceivers) ? data.validReceivers : [],
                invalidReceivers: Array.isArray(data.invalidReceivers) ? data.invalidReceivers : [],
                ids: Array.isArray(data.ids) ? data.ids : [],
            };
        },
    };
}

/** Client depuis les variables d'environnement, ou null si l'envoi de SMS n'est pas configuré. */
function smsClientFromEnv(env = process.env) {
    if (!env.OVH_SMS_APP_KEY) return null;
    return createOvhSmsClient({
        appKey: env.OVH_SMS_APP_KEY,
        appSecret: env.OVH_SMS_APP_SECRET,
        consumerKey: env.OVH_SMS_CONSUMER_KEY,
        serviceName: env.OVH_SMS_SERVICE,
        sender: env.OVH_SMS_SENDER || undefined,
    });
}

module.exports = { createOvhSmsClient, smsClientFromEnv, normalizeFrenchMobile, toSmsText, ovhSignature, OVH_API };
