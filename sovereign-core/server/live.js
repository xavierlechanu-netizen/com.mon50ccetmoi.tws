/**
 * Données « vivantes » (24/11/2026) : SOS communautaire et groupes de balade (cortège, convoi).
 *
 * Elles ne durent qu'une heure (SOS) ou une journée de balade (groupes) : elles restent en
 * mémoire, jamais en base ni sur disque, et s'effacent toutes seules (RGPD : positions éphémères).
 * shortcut: perdues au redémarrage de l'API et propres à un seul serveur ; passer en PostgreSQL
 * s'il faut un jour plusieurs serveurs.
 */

const SOS_TTL_MS = 60 * 60 * 1000; // une alerte s'éteint seule au bout d'une heure
const SOS_RADIUS_M = 10000; // pilotes prévenus dans un rayon de 10 km
const SOS_COOLDOWN_MS = 5 * 60 * 1000; // une alerte par pilote toutes les 5 minutes
const SOS_TYPES = ["Panne d'essence", "Crevaison", "Casse Mécanique", "Accident léger"];
const GROUP_TTL_MS = 12 * 60 * 60 * 1000; // un groupe vit une journée de balade
const MEMBER_STALE_MS = 2 * 60 * 1000; // sans position depuis 2 min : plus affiché
const GROUP_MAX = 20;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 (confusions)

function distanceM(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function createLive({ now = Date.now, randomInt = require("crypto").randomInt } = {}) {
    const alerts = new Map(); // id -> { id, uid, author, type, lat, lng, createdAt, helpers: Map(uid -> nom) }
    const lastSos = new Map(); // uid -> date de la dernière alerte
    const groups = new Map(); // code -> { createdAt, members: Map(uid -> { name, lat, lng, at, signal }) }

    function purge() {
        const t = now();
        for (const [id, a] of alerts) if (t - a.createdAt > SOS_TTL_MS) alerts.delete(id);
        for (const [uid, at] of lastSos) if (t - at > SOS_COOLDOWN_MS) lastSos.delete(uid);
        for (const [code, g] of groups) if (t - g.createdAt > GROUP_TTL_MS) groups.delete(code);
    }

    return {
        SOS_TYPES,

        /** Nouvelle alerte, ou { error: "cooldown" } si le pilote en a lancé une il y a moins de 5 min. */
        createSos({ uid, author, type, lat, lng }) {
            purge();
            if (lastSos.has(uid)) return { error: "cooldown" };
            const id = require("crypto").randomUUID();
            alerts.set(id, { id, uid, author, type, lat, lng, createdAt: now(), helpers: new Map() });
            lastSos.set(uid, now());
            return { id };
        },

        /** Alertes actives à 10 km ; le pilote en détresse voit en plus qui vient l'aider. */
        sosNear({ uid, lat, lng }) {
            purge();
            const list = [];
            for (const a of alerts.values()) {
                const d = distanceM({ lat, lng }, a);
                if (d > SOS_RADIUS_M && a.uid !== uid) continue;
                const mine = a.uid === uid;
                list.push({
                    id: a.id, type: a.type, author: a.author, lat: a.lat, lng: a.lng,
                    createdAt: a.createdAt, distanceM: Math.round(d), mine,
                    ...(mine ? { helpers: [...a.helpers.values()] } : {}),
                });
            }
            return list;
        },

        /** « J'arrive pour aider » : false si l'alerte n'existe plus ou si c'est la sienne. */
        helpSos({ id, uid, name }) {
            purge();
            const a = alerts.get(id);
            if (!a || a.uid === uid) return false;
            a.helpers.set(uid, name);
            return true;
        },

        /** Seul le pilote en détresse clôt son alerte. */
        closeSos({ id, uid }) {
            const a = alerts.get(id);
            if (!a || a.uid !== uid) return false;
            alerts.delete(id);
            return true;
        },

        /** Nouveau groupe : rend son code à 4 caractères. */
        createGroup() {
            purge();
            let code;
            do {
                code = Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
            } while (groups.has(code));
            groups.set(code, { createdAt: now(), members: new Map() });
            return code;
        },

        /**
         * Position (et signal éventuel) d'un membre ; la première fois, il rejoint le groupe.
         * Rend les membres visibles, ou { error: "introuvable" | "complet" }.
         */
        updateMember({ code, uid, name, lat, lng, signal }) {
            purge();
            const g = groups.get(code);
            if (!g) return { error: "introuvable" };
            const t = now();
            const old = g.members.get(uid);
            const fresh = [...g.members].filter(([id, m]) => id !== uid && t - m.at <= MEMBER_STALE_MS);
            if (!old && fresh.length >= GROUP_MAX) return { error: "complet" };
            g.members.set(uid, { name, lat, lng, at: t, signal: signal ? { ...signal, time: t } : old && old.signal });
            return {
                members: [...g.members]
                    .filter(([, m]) => t - m.at <= MEMBER_STALE_MS)
                    .map(([id, m]) => ({ uid: id, name: m.name, lat: m.lat, lng: m.lng, at: m.at, signal: m.signal || null })),
            };
        },

        leaveGroup({ code, uid }) {
            const g = groups.get(code);
            if (g) g.members.delete(uid);
        },
    };
}

module.exports = { createLive, SOS_TYPES, distanceM };
