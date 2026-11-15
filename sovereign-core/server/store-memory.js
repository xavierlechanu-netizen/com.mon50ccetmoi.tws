/**
 * store-memory.js — Stockage en mémoire (développement et tests uniquement).
 *
 * Même contrat que store-pg.js : toutes les méthodes sont asynchrones et renvoient les mêmes
 * formes d'objets. Les données disparaissent à l'arrêt du serveur : interdit en production.
 */
"use strict";

const crypto = require("crypto");
const { StoreError } = require("./store-errors");

function createMemoryStore({ blackboxUnits = [], users = [] } = {}) {
    const usersById = new Map();
    const usersByEmail = new Map();
    const usernames = new Set();
    const units = new Map();
    const sessions = [];
    const hazards = [];
    const ledger = [];
    const quotas = new Map(); // `${uid}|${jour}` → { motif: points, __unverified: points }

    // Utilisateurs pré-enregistrés (tests) : [{ uid, email?, username?, role? }]
    for (const u of users) {
        const user = {
            email: `${u.uid}@test.invalid`, username: u.uid, passwordHash: "!", role: "user",
            braveCoins: 0, createdAt: new Date().toISOString(), ...u,
        };
        usersById.set(user.uid, user);
        usersByEmail.set(user.email, user);
        usernames.add(user.username);
    }

    for (const unit of blackboxUnits) {
        units.set(unit.serial, { status: "ACTIVE", revision: "V1", ownerUid: null, ...unit });
    }

    return {
        kind: "memory",

        async createUser({ uid, email, username, passwordHash, role = "user" }) {
            if (usersByEmail.has(email)) throw new StoreError("EMAIL_TAKEN", "Cet email est déjà enregistré.");
            if (usernames.has(username)) throw new StoreError("USERNAME_TAKEN", "Ce pseudonyme est déjà pris.");
            const user = { uid, email, username, passwordHash, role, braveCoins: 0, createdAt: new Date().toISOString() };
            usersById.set(uid, user);
            usersByEmail.set(email, user);
            usernames.add(username);
            return { ...user };
        },

        async findUserByEmail(email) {
            const u = usersByEmail.get(email);
            return u ? { ...u } : null;
        },

        async findUserById(uid) {
            const u = usersById.get(uid);
            return u && !u.deletedAt ? { ...u } : null;
        },

        /** RGPD : identité effacée, preuves conservées sous un identifiant anonyme. */
        async anonymizeUser(uid) {
            const u = usersById.get(uid);
            if (!u || u.deletedAt) return false;
            usersByEmail.delete(u.email);
            usernames.delete(u.username);
            Object.assign(u, {
                email: `${uid}@supprime.invalid`,
                username: `supprime-${uid}`,
                passwordHash: "!",
                braveCoins: 0,
                deletedAt: new Date().toISOString(),
            });
            return true;
        },

        async getBlackboxUnit(serial) {
            const u = units.get(serial);
            return u ? { ...u } : null;
        },

        async findBlackboxUnitByPublicKey(ecdsaPublicKey) {
            const k = String(ecdsaPublicKey).toLowerCase();
            for (const u of units.values()) if (String(u.ecdsaPublicKey).toLowerCase() === k) return { ...u };
            return null;
        },

        async registerFactoryUnit({ ecdsaPublicKey, revision, type, nextSerial }) {
            const existing = await this.findBlackboxUnitByPublicKey(ecdsaPublicKey);
            if (existing) return { unit: existing, created: false };
            const serial = nextSerial([...units.keys()], revision, type);
            return { unit: await this.createBlackboxUnit({ serial, revision, ecdsaPublicKey }), created: true };
        },

        async createBlackboxUnit({ serial, revision = "V1", ecdsaPublicKey, ownerUid = null }) {
            if (units.has(serial)) throw new StoreError("UNIT_EXISTS", "Boîtier déjà enregistré (la clé ne peut pas être remplacée).");
            if (await this.findBlackboxUnitByPublicKey(ecdsaPublicKey)) {
                throw new StoreError("KEY_EXISTS", "Cette clé appartient déjà à un autre boîtier.");
            }
            const unit = {
                serial,
                revision,
                ecdsaPublicKey,
                ownerUid,
                status: ownerUid ? "ACTIVE" : "IN_STOCK",
                createdAt: new Date().toISOString(),
            };
            units.set(serial, unit);
            return { ...unit };
        },

        async insertTelemetrySession(rec) {
            const session = { ...rec };
            sessions.push(session);
            return { ...session };
        },

        // ─── Dangers ─────────────────────────────────────────────────────────
        async createHazard({ uid, type, lat, lng, description = "" }) {
            const h = { hazardId: crypto.randomUUID(), uid, type, lat, lng, description, votes: 0, active: true,
                createdAt: new Date().toISOString() };
            hazards.push(h);
            return { hazardId: h.hazardId, type, lat, lng, description, createdAt: h.createdAt };
        },
        async countHazardsSince(uid, sinceMs) {
            return hazards.filter((h) => h.uid === uid && Date.parse(h.createdAt) > sinceMs).length;
        },
        async findHazardsNear({ lat, lng, radiusM, limit = 200 }) {
            const R = 6371000;
            const rad = (d) => (d * Math.PI) / 180;
            return hazards
                .filter((h) => h.active)
                .map((h) => {
                    const a = Math.sin(rad(h.lat - lat) / 2) ** 2 +
                        Math.cos(rad(lat)) * Math.cos(rad(h.lat)) * Math.sin(rad(h.lng - lng) / 2) ** 2;
                    return { ...h, distanceM: Math.round(2 * R * Math.asin(Math.sqrt(a))) };
                })
                .filter((h) => h.distanceM <= radiusM)
                .sort((a, b) => a.distanceM - b.distanceM)
                .slice(0, limit)
                .map(({ hazardId, type, lat: la, lng: ln, description, votes, createdAt, distanceM }) =>
                    ({ hazardId, type, lat: la, lng: ln, description, votes, createdAt, distanceM }));
        },

        // ─── Points ──────────────────────────────────────────────────────────
        async applyPointsTransaction(t) {
            const user = usersById.get(t.uid);
            if (!user || user.deletedAt) throw new StoreError("USER_NOT_FOUND", "Profil utilisateur introuvable.");
            if (user.isBanned) throw new StoreError("BANNED", "Compte suspendu. Transactions bloquées.");
            if (t.idempotencyKey) {
                const prev = ledger.find((l) => l.uid === t.uid && l.idempotencyKey === t.idempotencyKey);
                if (prev) return { idempotent: true, balance: prev.balanceAfter, delta: 0 };
            }
            if (t.hazardId) {
                const h = hazards.find((x) => x.hazardId === t.hazardId);
                if (!h || h.uid !== t.uid || Date.now() - Date.parse(h.createdAt) > 48 * 3600 * 1000) {
                    throw new StoreError("PROOF_FAILED", "Signalement introuvable, trop ancien ou créé par un autre compte.");
                }
            }
            const day = new Date().toISOString().slice(0, 10);
            const quota = quotas.get(`${t.uid}|${day}`) || {};
            if (t.action === "AWARD") {
                const caps = t.checkCaps(quota);
                if (!caps.ok) throw new StoreError("CAP_REACHED", caps.reason);
            }
            const before = user.braveCoins || 0;
            if (t.action === "DEDUCT" && before < t.amount) {
                throw new StoreError("INSUFFICIENT_FUNDS", `Solde insuffisant : vous avez ${before} Pts mon50cc, il en faut ${t.amount}.`);
            }
            const delta = t.action === "DEDUCT" ? -t.amount : t.amount;
            user.braveCoins = before + delta;
            ledger.push({ uid: t.uid, action: t.action, reason: t.reason, delta, balanceAfter: user.braveCoins,
                idempotencyKey: t.idempotencyKey || null });
            if (t.action === "AWARD") {
                quota[t.reason] = (quota[t.reason] || 0) + t.amount;
                if (t.unverified) quota.__unverified = (quota.__unverified || 0) + t.amount;
                quotas.set(`${t.uid}|${day}`, quota);
            }
            return { idempotent: false, balance: user.braveCoins, delta };
        },
        async topPilots(limit = 10) {
            const sums = new Map();
            for (const l of ledger) if (l.action === "AWARD") sums.set(l.uid, (sums.get(l.uid) || 0) + l.delta);
            return [...sums.entries()]
                .map(([uid, points]) => ({ user: usersById.get(uid), points }))
                .filter((x) => x.user && !x.user.deletedAt)
                .sort((a, b) => b.points - a.points)
                .slice(0, limit)
                .map((x) => ({ username: x.user.username, points: x.points }));
        },

        async close() {},
    };
}

module.exports = { createMemoryStore };
