/**
 * garages.js — Espace garage et carnet d'entretien (remplacent Firestore, fermé le 24/11/2026).
 *
 * - Un garage certifié (droit d'entrée payé : payments.js) remplit sa fiche et apparaît sur la carte.
 * - Le pilote donne son accord en montrant un code à 6 chiffres (15 minutes, un seul usage) ;
 *   le garage peut alors inscrire ses interventions dans le carnet du pilote. Le pilote voit ses
 *   garages et peut retirer l'accord à tout moment (les interventions déjà notées restent à lui).
 * - Une intervention notée par un garage est une PREUVE : scellée dans le coffre des preuves
 *   (Object Lock 5 ans, comme la Boîte Noire) avant d'être enregistrée, puis jamais modifiée ni
 *   effacée, même avec le compte (migration 009, RGPD art. 17.3.e). La table accepte aussi des
 *   entretiens notés par le pilote (garage_uid NULL), sans écran pour l'instant.
 */
"use strict";

const crypto = require("crypto");

const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_RE = /^\d{6}$/;
// Texte d'une ligne : ni caractère de contrôle, ni chevron (le texte est affiché chez d'autres)
// eslint-disable-next-line no-control-regex -- les caractères de contrôle sont justement ceux qu'on refuse
const LINE_RE = /^[^\u0000-\u001f\u007f<>]*$/;
const PHONE_RE = /^[0-9 +.]{6,20}$/;

class GarageError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function text(value, min, max) {
    const s = typeof value === "string" ? value.trim() : "";
    return s.length >= min && s.length <= max && LINE_RE.test(s) ? s : null;
}

/** Kilométrage facultatif : entier de 0 à 1 000 000, sinon null. */
function km(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 1000000 ? n : undefined;
}

const hashCode = (code) => crypto.createHash("sha256").update(`garage-code:${code}`).digest("hex");

function profileFromBody(body) {
    const name = text(body.name, 2, 80);
    const address = text(body.address, 5, 160);
    const phone = body.phone ? (PHONE_RE.test(String(body.phone).trim()) ? String(body.phone).trim() : undefined) : null;
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!name || !address || phone === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)
        || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { name, address, phone, lat, lng };
}

function logFromBody(body) {
    const category = text(body.category, 1, 40);
    const description = body.description ? text(body.description, 0, 300) : "";
    const kilometres = km(body.km);
    if (!category || description === null || kilometres === undefined) return null;
    return { category, description, km: kilometres };
}

function createGaragesService({ store, wormVault, now = () => Date.now() }) {
    async function connectedUser(authUser) {
        const user = authUser ? await store.findUserById(authUser.uid) : null;
        if (!user) throw new GarageError(401, "Connectez-vous pour continuer.");
        return user;
    }

    async function certifiedGarage(authUser) {
        const user = await connectedUser(authUser);
        if (!user.isCertifiedGarage) {
            throw new GarageError(403, "Espace réservé aux garages certifiés (droit d'entrée de 50 € TTC).");
        }
        return user;
    }

    return {
        /** Carte des pilotes : garages certifiés ayant rempli leur fiche (sans identifiant interne). */
        async publicList() {
            return { garages: await store.listCertifiedGarages() };
        },

        async dashboard(authUser) {
            const garage = await certifiedGarage(authUser);
            const [profile, clients, logs] = await Promise.all([
                store.getGarageProfile(garage.uid),
                store.listGarageClients(garage.uid),
                store.listMaintenanceByGarage(garage.uid, 200),
            ]);
            return { profile, clients, logs };
        },

        async saveProfile(authUser, body = {}) {
            const garage = await certifiedGarage(authUser);
            const profile = profileFromBody(body);
            if (!profile) throw new GarageError(400, "Fiche incomplète : nom, adresse trouvée sur la carte, téléphone valide.");
            await store.saveGarageProfile(garage.uid, profile);
            return { profile };
        },

        /** Le garage saisit le code montré par le pilote : il devient son garage. */
        async linkClient(authUser, body = {}) {
            const garage = await certifiedGarage(authUser);
            const code = String(body.code || "").trim();
            const grant = CODE_RE.test(code) ? await store.consumeGarageCode(hashCode(code)) : null;
            if (!grant) throw new GarageError(404, "Code inconnu ou expiré : demandez au pilote d'en afficher un nouveau.");
            if (grant.pilotUid === garage.uid) throw new GarageError(400, "Ce code est le vôtre.");
            await store.linkGarageClient({ garageUid: garage.uid, pilotUid: grant.pilotUid, km: grant.km });
            const client = (await store.listGarageClients(garage.uid)).find((c) => c.pilotUid === grant.pilotUid);
            return { client };
        },

        /** Intervention scellée dans le carnet d'un pilote qui a donné son accord. */
        async addGarageLog(authUser, body = {}) {
            const garage = await certifiedGarage(authUser);
            const pilotUid = String(body.pilotUid || "");
            const log = logFromBody(body);
            if (!log) throw new GarageError(400, "Intervention invalide : catégorie, description (300 caractères au plus), kilométrage.");
            if (!(await store.isGarageClient(garage.uid, pilotUid))) {
                throw new GarageError(403, "Ce pilote ne vous a pas donné son accord (ou l'a retiré).");
            }
            // Scellée d'abord : sans preuve dans le coffre, rien n'est écrit au carnet
            const proof = await wormVault.sealTelemetryEvidence(pilotUid, {
                kind: "maintenance", pilotUid, garageUid: garage.uid, ...log, sealedAt: new Date(now()).toISOString(),
            });
            return { log: await store.addMaintenanceLog({ pilotUid, garageUid: garage.uid, ...log,
                wormStoragePath: proof.storagePath, wormSha256Hex: proof.sha256Hex }) };
        },

        async pilotCarnet(authUser) {
            const pilot = await connectedUser(authUser);
            const [logs, garages] = await Promise.all([
                store.listMaintenanceByPilot(pilot.uid, 100),
                store.listPilotGarages(pilot.uid),
            ]);
            return { logs, garages };
        },/** Code d'accord à montrer au garage (remplace le précédent). */
        async createCode(authUser, body = {}) {
            const pilot = await connectedUser(authUser);
            const kilometres = km(body.km);
            if (kilometres === undefined) throw new GarageError(400, "Kilométrage invalide.");
            const expiresAt = new Date(now() + CODE_TTL_MS).toISOString();
            for (let i = 0; i < 5; i++) {
                const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
                if (await store.saveGarageCode({ pilotUid: pilot.uid, codeHash: hashCode(code), km: kilometres, expiresAt })) {
                    return { code, expiresAt };
                }
            }
            throw new GarageError(503, "Réessayez dans un instant.");
        },

        async revokeGarage(authUser, garageUid) {
            const pilot = await connectedUser(authUser);
            if (!(await store.unlinkGarageClient(String(garageUid || ""), pilot.uid))) {
                throw new GarageError(404, "Ce garage n'a pas (ou plus) accès à votre carnet.");
            }
            return { revoked: true };
        },
    };
}

module.exports = { createGaragesService, GarageError, hashCode, CODE_TTL_MS };
