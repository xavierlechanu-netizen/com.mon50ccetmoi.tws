/**
 * store-memory.js — Stockage en mémoire (développement et tests uniquement).
 *
 * Même contrat que store-pg.js : toutes les méthodes sont asynchrones et renvoient les mêmes
 * formes d'objets. Les données disparaissent à l'arrêt du serveur : interdit en production.
 */
"use strict";

const crypto = require("crypto");
const { StoreError } = require("./store-errors");
const { sealEntry, AUDIT_RETENTION_DAYS } = require("./audit-log");
const { bestLearnedMatch, VALIDATED } = require("./nexus-brain");

function createMemoryStore({ blackboxUnits = [], users = [] } = {}) {
    const usersById = new Map();
    const usersByEmail = new Map();
    const usernames = new Set();
    const units = new Map();
    const sessions = [];
    const hazards = [];
    const ledger = [];
    const quotas = new Map(); // `${uid}|${jour}` → { motif: points, __unverified: points }
    const audit = []; // journal d'audit (ajout seul, chaîné : audit-log.js)
    const nexus = new Map(); // carnet d'apprentissage de Nexus Atlas, par numéro
    let nexusSeq = 0;
    const orders = new Map(); // commandes Revolut, par identifiant Revolut (payments.js)
    const invoices = new Map(); // factures à émettre, par identifiant de commande
    const firebaseErasures = []; // effacements RGPD à finir dans Firebase (migration 003)
    let firebaseErasureSeq = 0;
    const passwordResets = new Map(); // empreinte du lien → { uid, expiresAt } (migration 005)
    const achievements = new Map(); // `${uid}|${code}` → badge personnel (migration 004)

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

        async updatePasswordHash(uid, passwordHash) {
            const u = usersById.get(uid);
            if (!u || u.deletedAt) return false;
            u.passwordHash = passwordHash;
            return true;
        },

        /** Mot de passe oublié : un seul lien en cours par pilote. */
        async createPasswordReset({ uid, tokenHash, expiresAt }) {
            for (const [k, r] of passwordResets) if (r.uid === uid) passwordResets.delete(k);
            passwordResets.set(tokenHash, { uid, expiresAt });
        },

        /** Lien valable : le consomme et change le mot de passe. Renvoie l'identifiant, sinon null. */
        async consumePasswordReset(tokenHash, passwordHash) {
            const reset = passwordResets.get(tokenHash);
            if (!reset || Date.parse(reset.expiresAt) <= Date.now()) return null;
            passwordResets.delete(tokenHash);
            const u = usersById.get(reset.uid);
            if (!u || u.deletedAt || u.isBanned) return null;
            u.passwordHash = passwordHash;
            u.passwordChangedAt = new Date().toISOString();
            return u.uid;
        },

        /** RGPD : identité effacée, preuves conservées sous un identifiant anonyme. */
        async anonymizeUser(uid) {
            const u = usersById.get(uid);
            if (!u || u.deletedAt) return false;
            // Reste à effacer chez Firebase (store-pg.js, même règle)
            firebaseErasures.push({ id: ++firebaseErasureSeq, email: u.email, firebaseUid: u.firebaseUid || null,
                requestedAt: new Date().toISOString() });
            usersByEmail.delete(u.email);
            usernames.delete(u.username);
            Object.assign(u, {
                email: `${uid}@supprime.invalid`,
                username: `supprime-${uid}`,
                passwordHash: "!",
                braveCoins: 0,
                firebaseUid: null,
                hideFromLeaderboard: false,
                deletedAt: new Date().toISOString(),
            });
            // Texte libre des signalements (il peut identifier) : effacé ; le danger reste signalé
            for (const h of hazards) if (h.uid === uid) h.description = "";
            for (const [k, a] of achievements) if (a.uid === uid) achievements.delete(k);
            for (const [k, r] of passwordResets) if (r.uid === uid) passwordResets.delete(k);
            return true;
        },

        /** Badge personnel, avec un trajet déclaré facultatif. Faux s'il était déjà attribué. */
        async grantAchievement({ uid, code, emoji, title, trip = null }) {
            const key = `${uid}|${code}`;
            if (achievements.has(key)) return false;
            achievements.set(key, { uid, code, emoji, title, trip, grantedAt: new Date().toISOString() });
            return true;
        },

        async listAchievements(uid) {
            return [...achievements.values()].filter((a) => a.uid === uid)
                .map(({ code, emoji, title, trip, grantedAt }) => ({ code, emoji, title, trip, grantedAt }));
        },

        /** Effacements RGPD à finir dans Firebase, du plus ancien au plus récent. */
        async listFirebaseErasures() {
            return firebaseErasures.map((e) => ({ ...e }));
        },

        /** Rectification (RGPD art. 16) et opposition au classement (art. 21). */
        async updateUserProfile(uid, { email, username, hideFromLeaderboard } = {}) {
            const u = usersById.get(uid);
            if (!u || u.deletedAt) throw new StoreError("USER_NOT_FOUND", "Profil utilisateur introuvable.");
            if (email !== undefined && email !== u.email && usersByEmail.has(email)) {
                throw new StoreError("EMAIL_TAKEN", "Cet email est déjà enregistré.");
            }
            if (username !== undefined && username !== u.username && usernames.has(username)) {
                throw new StoreError("USERNAME_TAKEN", "Ce pseudonyme est déjà pris.");
            }
            if (email !== undefined && email !== u.email) {
                usersByEmail.delete(u.email);
                u.email = email;
                usersByEmail.set(email, u);
            }
            if (username !== undefined && username !== u.username) {
                usernames.delete(u.username);
                u.username = username;
                usernames.add(username);
            }
            if (hideFromLeaderboard !== undefined) u.hideFromLeaderboard = Boolean(hideFromLeaderboard);
            return { ...u };
        },

        /** Droit d'accès et portabilité (RGPD art. 15 et 20) : tout ce que le serveur garde sur le compte. */
        async exportUserData(uid) {
            const u = usersById.get(uid);
            if (!u || u.deletedAt) return null;
            return {
                account: {
                    uid: u.uid, email: u.email, username: u.username, role: u.role, braveCoins: u.braveCoins || 0,
                    leaderboardVisible: !u.hideFromLeaderboard, createdAt: u.createdAt,
                },
                hazards: hazards.filter((h) => h.uid === uid).map(({ hazardId, type, lat, lng, description, active, createdAt }) =>
                    ({ hazardId, type, lat, lng, description, active, createdAt })),
                pointsLedger: ledger.filter((l) => l.uid === uid).map(({ action, reason, delta, balanceAfter, createdAt }) =>
                    ({ action, reason, delta, balanceAfter, createdAt: createdAt || null })),
                telemetrySessions: sessions.filter((s) => s.uid === uid).map((s) => ({
                    sessionId: s.sessionId, hardwareId: s.hardwareId, isCrashReport: s.isCrashReport,
                    impactTimestamp: s.impactTimestamp, frameCount: s.frameCount, merkleRootHex: s.merkleRootHex,
                    wormStoragePath: s.wormStoragePath, wormSha256Hex: s.wormSha256Hex, sealedAt: s.sealedAt || null,
                })),
                blackboxUnits: [...units.values()].filter((x) => x.ownerUid === uid)
                    .map(({ serial, revision, status, createdAt }) => ({ serial, revision, status, createdAt })),
                payments: [...orders.values()].filter((o) => o.uid === uid)
                    .map(({ caseId, product, amountCents, currency, status, createdAt, completedAt }) =>
                        ({ caseId, product, amountCents, currency, status, createdAt, completedAt })),
                achievements: await this.listAchievements(uid),
            };
        },

        // ─── Journal d'audit (ajout seul, chaîné) ───────────────────────────
        async appendAudit(event) {
            const entry = sealEntry(event, audit[audit.length - 1] || null);
            audit.push(Object.freeze({ ...entry, details: Object.freeze({ ...entry.details }) }));
            return { ...entry };
        },
        async listAudit({ afterSeq = 0, limit = 200, subjectUid = null } = {}) {
            return audit
                .filter((e) => e.seq > afterSeq && (!subjectUid || e.actorUid === subjectUid || e.targetId === subjectUid))
                .slice(0, Math.min(Math.max(limit, 1), 1000))
                .map((e) => ({ ...e, details: { ...e.details } }));
        },
        async purgeAudit(now = Date.now()) {
            const limit = now - AUDIT_RETENTION_DAYS * 24 * 3600 * 1000;
            let n = 0;
            while (audit.length && Date.parse(audit[0].at) < limit) {
                audit.shift();
                n += 1;
            }
            return n;
        },

        async migrate() {
            return [];
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
            ledger.push({ uid: t.uid, action: t.action, reason: t.reason, description: t.description || t.reason,
                delta, balanceAfter: user.braveCoins, idempotencyKey: t.idempotencyKey || null,
                createdAt: new Date().toISOString() });
            if (t.action === "AWARD") {
                quota[t.reason] = (quota[t.reason] || 0) + t.amount;
                if (t.unverified) quota.__unverified = (quota.__unverified || 0) + t.amount;
                quotas.set(`${t.uid}|${day}`, quota);
            }
            return { idempotent: false, balance: user.braveCoins, delta };
        },
        // ─── Paiements Revolut (payments.js) ─────────────────────────────────
        async createPaymentOrder(o) {
            if ([...orders.values()].some((x) => x.caseId === o.caseId) || orders.has(o.revolutOrderId)) {
                throw new StoreError("ORDER_EXISTS", "Commande déjà enregistrée.");
            }
            const order = { revolutOrderId: o.revolutOrderId, caseId: o.caseId, uid: o.uid, product: o.product,
                category: o.category, amountCents: o.amountCents, currency: o.currency || "EUR", status: "PENDING",
                orderToken: o.orderToken, createdAt: new Date().toISOString(), completedAt: null };
            orders.set(order.revolutOrderId, order);
            return { ...order };
        },
        async findPaymentOrder(revolutOrderId) {
            const o = orders.get(revolutOrderId);
            return o ? { ...o } : null;
        },
        async findPaymentOrderByCase(caseId) {
            const o = [...orders.values()].find((x) => x.caseId === caseId);
            return o ? { ...o } : null;
        },
        async findReusablePendingOrder(uid, product, sinceMs) {
            const o = [...orders.values()].reverse().find((x) => x.uid === uid && x.product === product &&
                x.status === "PENDING" && x.orderToken && Date.parse(x.createdAt) > sinceMs);
            return o ? { ...o } : null;
        },
        async completePaymentOrder(revolutOrderId, { pointsToCredit = 0, certifyGarage = false, invoice = null } = {}) {
            const o = orders.get(revolutOrderId);
            if (!o) return { notFound: true };
            if (o.status === "COMPLETED") return { alreadyProcessed: true, order: { ...o } };
            o.status = "COMPLETED";
            o.completedAt = new Date().toISOString();
            const user = usersById.get(o.uid);
            let balance = null;
            if (pointsToCredit > 0 && user) {
                user.braveCoins = (user.braveCoins || 0) + pointsToCredit;
                balance = user.braveCoins;
                ledger.push({ uid: o.uid, action: "PURCHASE", reason: "POINTS_PURCHASE", delta: pointsToCredit,
                    balanceAfter: balance, idempotencyKey: `revolut:${revolutOrderId}`, createdAt: o.completedAt });
            }
            if (certifyGarage && user) {
                user.isCertifiedGarage = true;
                user.certifiedAt = user.certifiedAt || o.completedAt;
            }
            if (invoice && !invoices.has(revolutOrderId)) invoices.set(revolutOrderId, { ...invoice, paid_at: o.completedAt });
            return { processed: true, balance, order: { ...o } };
        },
        async failPaymentOrder(revolutOrderId) {
            const o = orders.get(revolutOrderId);
            if (!o || o.status !== "PENDING") return false;
            o.status = "FAILED";
            return true;
        },
        async listPaymentOrders({ limit = 100 } = {}) {
            return [...orders.values()].reverse().slice(0, Math.min(Math.max(limit, 1), 500)).map((o) => {
                const u = usersById.get(o.uid);
                return { ...o, username: u ? u.username : null, firebaseUid: (u && u.firebaseUid) || null };
            });
        },
        async listInvoicesToIssue() {
            return [...invoices.values()].map((i) => ({ ...i }));
        },

        /** Historique des points d'un pilote, du plus récent au plus ancien (store-pg.js, même forme). */
        async listPointsHistory(uid, limit = 30) {
            return ledger.filter((l) => l.uid === uid).slice(-limit).reverse()
                .map(({ action, reason, description, delta, balanceAfter, createdAt }) =>
                    ({ action, reason, description: description || reason, delta, balanceAfter, createdAt }));
        },

        // ─── Carnet d'apprentissage de Nexus Atlas (nexus-brain.js) ─────────
        async recordNexusAnswer({ questionNorm, question, answer }) {
            const existing = [...nexus.values()].find((e) => e.questionNorm === questionNorm);
            if (existing) {
                existing.timesAsked += 1;
                return { id: existing.id, created: false };
            }
            const id = ++nexusSeq;
            nexus.set(id, { id, questionNorm, question, answer, status: "a_verifier", category: null, timesAsked: 1,
                reviewNote: null, reviewedBy: null, reviewedAt: null, createdAt: new Date().toISOString() });
            return { id, created: true };
        },
        async findLearnedNexusAnswer(questionNorm) {
            const validated = [...nexus.values()].filter((e) => VALIDATED.includes(e.status));
            const hit = bestLearnedMatch(questionNorm, validated);
            return hit ? { id: hit.id, answer: hit.answer } : null;
        },
        async countNexusQuestion(id) {
            const e = nexus.get(Number(id));
            if (e) e.timesAsked += 1;
        },
        async getNexusEntry(id) {
            const e = nexus.get(Number(id));
            return e ? { ...e } : null;
        },
        async updateNexusEntry(id, { status, answer, category, reviewNote, reviewedBy } = {}) {
            const e = nexus.get(Number(id));
            if (!e) return null;
            if (status !== undefined) e.status = status;
            if (answer !== undefined) e.answer = answer;
            if (category !== undefined) e.category = category;
            if (reviewNote !== undefined) e.reviewNote = reviewNote;
            if (reviewedBy !== undefined) { e.reviewedBy = reviewedBy; e.reviewedAt = new Date().toISOString(); }
            return { ...e };
        },
        async listNexusNotebook({ status = null, limit = 100 } = {}) {
            return [...nexus.values()]
                .filter((e) => !status || e.status === status)
                .sort((a, b) => b.timesAsked - a.timesAsked || b.id - a.id)
                .slice(0, Math.min(Math.max(limit, 1), 500))
                .map((e) => ({ ...e }));
        },

        async topPilots(limit = 10) {
            const sums = new Map();
            for (const l of ledger) if (l.action === "AWARD") sums.set(l.uid, (sums.get(l.uid) || 0) + l.delta);
            return [...sums.entries()]
                .map(([uid, points]) => ({ user: usersById.get(uid), points }))
                .filter((x) => x.user && !x.user.deletedAt && !x.user.hideFromLeaderboard)
                .sort((a, b) => b.points - a.points)
                .slice(0, limit)
                .map((x) => ({ username: x.user.username, points: x.points }));
        },

        async close() {},
    };
}

module.exports = { createMemoryStore };
