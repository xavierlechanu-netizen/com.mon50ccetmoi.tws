/**
 * store-memory.js — Stockage en mémoire (développement et tests uniquement).
 *
 * Même contrat que store-pg.js : toutes les méthodes sont asynchrones et renvoient les mêmes
 * formes d'objets. Les données disparaissent à l'arrêt du serveur : interdit en production.
 */
"use strict";

const { StoreError } = require("./store-errors");

function createMemoryStore({ blackboxUnits = [], users = [] } = {}) {
    const usersById = new Map();
    const usersByEmail = new Map();
    const usernames = new Set();
    const units = new Map();
    const sessions = [];

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

        async createBlackboxUnit({ serial, revision = "V1", ecdsaPublicKey, ownerUid = null }) {
            if (units.has(serial)) throw new StoreError("UNIT_EXISTS", "Boîtier déjà enregistré (la clé ne peut pas être remplacée).");
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

        async close() {},
    };
}

module.exports = { createMemoryStore };
