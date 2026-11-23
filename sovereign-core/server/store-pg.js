/**
 * store-pg.js — Stockage PostgreSQL (production : OVHcloud Managed PostgreSQL, schéma db/schema.sql).
 *
 * Même contrat que store-memory.js. Requêtes paramétrées uniquement ($1, $2…) : aucune
 * concaténation de données utilisateur dans le SQL.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { StoreError } = require("./store-errors");
const { sealEntry, AUDIT_RETENTION_DAYS } = require("./audit-log");
const { bestLearnedMatch, VALIDATED } = require("./nexus-brain");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIGRATIONS_DIR = path.join(__dirname, "../db/migrations");
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

function mapUser(r) {
    if (!r) return null;
    return {
        uid: r.uid,
        email: r.email,
        username: r.username,
        passwordHash: r.password_hash,
        role: r.role,
        braveCoins: r.brave_coins,
        hideFromLeaderboard: Boolean(r.hide_from_leaderboard),
        isBanned: Boolean(r.is_banned),
        isCertifiedGarage: Boolean(r.is_certified_garage),
        createdAt: iso(r.created_at),
    };
}

/** Commande Revolut (table revolut_orders), même forme que store-memory.js. */
/** Entrée du carnet d'apprentissage de Nexus Atlas (table nexus_learning). */
function mapNexus(r) {
    if (!r) return null;
    return {
        id: Number(r.id), questionNorm: r.question_norm, question: r.question, answer: r.answer, status: r.status,
        category: r.category, timesAsked: r.times_asked, reviewNote: r.review_note, reviewedBy: r.reviewed_by,
        reviewedAt: iso(r.reviewed_at) || null, createdAt: iso(r.created_at),
    };
}

function mapOrder(r) {
    if (!r) return null;
    return {
        revolutOrderId: r.revolut_order_id,
        caseId: r.case_id,
        uid: r.user_uid,
        product: r.report_type,
        category: r.category,
        amountCents: r.amount_cents,
        currency: String(r.currency || "EUR").trim(),
        status: r.status,
        orderToken: r.order_token,
        createdAt: iso(r.created_at),
        completedAt: iso(r.completed_at) || null,
    };
}

function mapAudit(r) {
    return {
        seq: Number(r.seq),
        at: iso(r.at),
        actorUid: r.actor_uid,
        actorRole: r.actor_role,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        outcome: r.outcome,
        details: r.details || {},
        prevHash: r.prev_hash,
        hash: r.hash,
    };
}

function mapUnit(r) {
    if (!r) return null;
    return {
        serial: r.serial,
        revision: r.revision,
        status: r.status,
        ecdsaPublicKey: r.ecdsa_public_key,
        ownerUid: r.owner_uid,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    };
}

function createPgStore({ connectionString, pool } = {}) {
    const db = pool || new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000 });

    return {
        kind: "postgres",
        pool: db,

        async createUser({ uid, email, username, passwordHash, role = "user" }) {
            try {
                const { rows } = await db.query(
                    `INSERT INTO users (uid, email, username, password_hash, role)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [uid, email, username, passwordHash, role]
                );
                return mapUser(rows[0]);
            } catch (e) {
                if (e.code === "23505") {
                    const onEmail = /email/i.test(`${e.constraint || ""} ${e.detail || ""}`);
                    throw onEmail
                        ? new StoreError("EMAIL_TAKEN", "Cet email est déjà enregistré.")
                        : new StoreError("USERNAME_TAKEN", "Ce pseudonyme est déjà pris.");
                }
                throw e;
            }
        },

        async findUserByEmail(email) {
            const { rows } = await db.query(
                "SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL", [email]
            );
            return mapUser(rows[0]);
        },

        async findUserById(uid) {
            if (!UUID_RE.test(String(uid))) return null;
            const { rows } = await db.query(
                "SELECT * FROM users WHERE uid = $1 AND deleted_at IS NULL", [uid]
            );
            return mapUser(rows[0]);
        },

        async updatePasswordHash(uid, passwordHash) {
            if (!UUID_RE.test(String(uid))) return false;
            const { rowCount } = await db.query(
                "UPDATE users SET password_hash = $2, updated_at = NOW() WHERE uid = $1 AND deleted_at IS NULL",
                [uid, passwordHash]
            );
            return rowCount === 1;
        },

        /**
         * RGPD art. 17 : l'identité est effacée (email, pseudo, mot de passe, clés biométriques).
         * Les preuves (télémétrie, grand livre) sont conservées sous l'identifiant devenu anonyme
         * (art. 17.3.e : constatation et défense de droits en justice). Une suppression physique
         * serait d'ailleurs refusée par les triggers d'immuabilité.
         */
        async anonymizeUser(uid) {
            if (!UUID_RE.test(String(uid))) return false;
            const client = await db.connect();
            try {
                await client.query("BEGIN");
                // Reste à effacer chez Firebase tant que le déménagement n'est pas fini (migration 003) :
                // noté AVANT l'anonymisation, qui retire l'email et l'identifiant Firebase.
                await client.query(
                    `INSERT INTO rgpd_firebase_a_effacer (email, firebase_uid)
                     SELECT email, firebase_uid FROM users WHERE uid = $1 AND deleted_at IS NULL`,
                    [uid]
                );
                const { rowCount } = await client.query(
                    `UPDATE users SET email = $2, username = $3, password_hash = '!', brave_coins = 0, firebase_uid = NULL,
                            is_premium = FALSE, premium_plan = NULL, ban_reason = NULL, hide_from_leaderboard = FALSE,
                            deleted_at = NOW(), updated_at = NOW()
                      WHERE uid = $1 AND deleted_at IS NULL`,
                    [uid, `${uid}@supprime.invalid`, `supprime-${uid}`]
                );
                if (rowCount === 0) {
                    await client.query("ROLLBACK");
                    return false;
                }
                await client.query("DELETE FROM fido_credentials WHERE user_uid = $1", [uid]);
                await client.query("DELETE FROM fido_challenges WHERE user_uid = $1", [uid]);
                await client.query("DELETE FROM pilot_achievements WHERE user_uid = $1", [uid]);
                // Texte libre des signalements (il peut identifier) : effacé ; le danger reste signalé
                await client.query("UPDATE hazards SET description = '' WHERE user_uid = $1 AND description <> ''", [uid]);
                await client.query("COMMIT");
                return true;
            } catch (e) {
                await client.query("ROLLBACK").catch(() => {});
                throw e;
            } finally {
                client.release();
            }
        },

        /** Badge personnel, avec un trajet déclaré facultatif. Faux s'il était déjà attribué. */
        async grantAchievement({ uid, code, emoji, title, trip = null }) {
            const { rowCount } = await db.query(
                `INSERT INTO pilot_achievements (user_uid, code, emoji, title, trip) VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_uid, code) DO NOTHING`,
                [uid, code, emoji, title, trip ? JSON.stringify(trip) : null]
            );
            return rowCount === 1;
        },

        async listAchievements(uid) {
            if (!UUID_RE.test(String(uid))) return [];
            const { rows } = await db.query(
                "SELECT code, emoji, title, trip, granted_at FROM pilot_achievements WHERE user_uid = $1 ORDER BY granted_at", [uid]
            );
            return rows.map((r) => ({ code: r.code, emoji: r.emoji, title: r.title, trip: r.trip, grantedAt: iso(r.granted_at) }));
        },

        /** Effacements RGPD à finir dans Firebase, du plus ancien au plus récent. */
        async listFirebaseErasures() {
            const { rows } = await db.query(
                "SELECT id, email, firebase_uid, demande_le FROM rgpd_firebase_a_effacer ORDER BY id"
            );
            return rows.map((r) => ({ id: Number(r.id), email: r.email, firebaseUid: r.firebase_uid || null,
                requestedAt: new Date(r.demande_le).toISOString() }));
        },

        /** Rectification (RGPD art. 16) et opposition au classement (art. 21). */
        async updateUserProfile(uid, { email, username, hideFromLeaderboard } = {}) {
            if (!UUID_RE.test(String(uid))) throw new StoreError("USER_NOT_FOUND", "Profil utilisateur introuvable.");
            try {
                const { rows } = await db.query(
                    `UPDATE users SET email = COALESCE($2, email), username = COALESCE($3, username),
                            hide_from_leaderboard = COALESCE($4, hide_from_leaderboard), updated_at = NOW()
                      WHERE uid = $1 AND deleted_at IS NULL RETURNING *`,
                    [uid, email === undefined ? null : email, username === undefined ? null : username,
                        hideFromLeaderboard === undefined ? null : Boolean(hideFromLeaderboard)]
                );
                if (!rows[0]) throw new StoreError("USER_NOT_FOUND", "Profil utilisateur introuvable.");
                return mapUser(rows[0]);
            } catch (e) {
                if (e.code === "23505") {
                    const onEmail = /email/i.test(`${e.constraint || ""} ${e.detail || ""}`);
                    throw onEmail
                        ? new StoreError("EMAIL_TAKEN", "Cet email est déjà enregistré.")
                        : new StoreError("USERNAME_TAKEN", "Ce pseudonyme est déjà pris.");
                }
                throw e;
            }
        },

        /** Droit d'accès et portabilité (RGPD art. 15 et 20) : tout ce que le serveur garde sur le compte. */
        async exportUserData(uid) {
            const user = await this.findUserById(uid);
            if (!user) return null;
            const [hz, led, tel, bb, pay, achievements] = await Promise.all([
                db.query(`SELECT hazard_id, type, lat, lng, description, active, created_at FROM hazards
                           WHERE user_uid = $1 ORDER BY created_at`, [uid]),
                db.query(`SELECT action, reason, delta, balance_after, created_at FROM points_ledger
                           WHERE user_uid = $1 ORDER BY created_at`, [uid]),
                db.query(`SELECT session_id, hardware_id, is_crash_report, impact_timestamp, frame_count, merkle_root_hex,
                                 worm_storage_path, worm_sha256_hex, created_at FROM telemetry_sessions
                           WHERE user_uid = $1 ORDER BY created_at`, [uid]),
                db.query("SELECT serial, revision, status, created_at FROM blackbox_units WHERE owner_uid = $1 ORDER BY serial", [uid]),
                db.query("SELECT * FROM revolut_orders WHERE user_uid = $1 ORDER BY created_at", [uid]),
                this.listAchievements(uid),
            ]);
            return {
                account: {
                    uid: user.uid, email: user.email, username: user.username, role: user.role,
                    braveCoins: user.braveCoins, leaderboardVisible: !user.hideFromLeaderboard, createdAt: user.createdAt,
                },
                hazards: hz.rows.map((r) => ({ hazardId: r.hazard_id, type: r.type, lat: r.lat, lng: r.lng,
                    description: r.description, active: r.active, createdAt: iso(r.created_at) })),
                pointsLedger: led.rows.map((r) => ({ action: r.action, reason: r.reason, delta: r.delta,
                    balanceAfter: r.balance_after, createdAt: iso(r.created_at) })),
                telemetrySessions: tel.rows.map((r) => ({ sessionId: r.session_id, hardwareId: r.hardware_id,
                    isCrashReport: r.is_crash_report, impactTimestamp: r.impact_timestamp === null ? null : Number(r.impact_timestamp),
                    frameCount: r.frame_count, merkleRootHex: r.merkle_root_hex, wormStoragePath: r.worm_storage_path,
                    wormSha256Hex: r.worm_sha256_hex, sealedAt: iso(r.created_at) })),
                blackboxUnits: bb.rows.map((r) => ({ serial: r.serial, revision: r.revision, status: r.status, createdAt: iso(r.created_at) })),
                payments: pay.rows.map(mapOrder).map(({ caseId, product, amountCents, currency, status, createdAt, completedAt }) =>
                    ({ caseId, product, amountCents, currency, status, createdAt, completedAt })),
                achievements,
            };
        },

        // ─── Journal d'audit (ajout seul, chaîné : audit-log.js) ────────────

        /** Écrit une entrée sous verrou : deux requêtes simultanées ne cassent jamais la chaîne. */
        async appendAudit(event) {
            const client = await db.connect();
            try {
                await client.query("BEGIN");
                await client.query("SELECT pg_advisory_xact_lock(hashtext('audit_log'))");
                const { rows } = await client.query("SELECT seq, hash FROM audit_log ORDER BY seq DESC LIMIT 1");
                const entry = sealEntry(event, rows[0] ? { seq: Number(rows[0].seq), hash: rows[0].hash } : null);
                await client.query(
                    `INSERT INTO audit_log (seq, at, actor_uid, actor_role, action, target_type, target_id, outcome, details, prev_hash, hash)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [entry.seq, entry.at, entry.actorUid, entry.actorRole, entry.action, entry.targetType, entry.targetId,
                        entry.outcome, JSON.stringify(entry.details), entry.prevHash, entry.hash]
                );
                await client.query("COMMIT");
                return entry;
            } catch (e) {
                await client.query("ROLLBACK").catch(() => {});
                throw e;
            } finally {
                client.release();
            }
        },

        async listAudit({ afterSeq = 0, limit = 200, subjectUid = null } = {}) {
            const max = Math.min(Math.max(Number(limit) || 200, 1), 1000);
            const { rows } = subjectUid
                ? await db.query(
                    `SELECT * FROM audit_log WHERE seq > $1 AND (actor_uid = $2 OR target_id = $2) ORDER BY seq LIMIT $3`,
                    [afterSeq, subjectUid, max])
                : await db.query("SELECT * FROM audit_log WHERE seq > $1 ORDER BY seq LIMIT $2", [afterSeq, max]);
            return rows.map(mapAudit);
        },

        /** Purge des entrées de plus d'un an (seule suppression que le trigger accepte). */
        async purgeAudit() {
            const { rowCount } = await db.query(
                `DELETE FROM audit_log WHERE at < NOW() - make_interval(days => $1)`, [AUDIT_RETENTION_DAYS]
            );
            return rowCount;
        },

        /** Migrations db/migrations/*.sql, rejouables sans effet, appliquées au démarrage. */
        async migrate(dir = MIGRATIONS_DIR) {
            const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d+.*\.sql$/.test(f)).sort() : [];
            for (const f of files) await db.query(fs.readFileSync(path.join(dir, f), "utf8"));
            return files;
        },

        async getBlackboxUnit(serial) {
            const { rows } = await db.query("SELECT * FROM blackbox_units WHERE serial = $1", [serial]);
            return mapUnit(rows[0]);
        },

        async findBlackboxUnitByPublicKey(ecdsaPublicKey) {
            const { rows } = await db.query("SELECT * FROM blackbox_units WHERE lower(ecdsa_public_key) = lower($1)", [ecdsaPublicKey]);
            return mapUnit(rows[0]);
        },

        /**
         * Mise en service en usine : attribue le prochain numéro à une clé publique.
         * Verrou transactionnel : deux postes d'usine ne reçoivent jamais le même numéro.
         * Même clé présentée deux fois (outil relancé) → même numéro, rien de créé.
         */
        async registerFactoryUnit({ ecdsaPublicKey, revision, type, nextSerial }) {
            const client = typeof db.connect === "function" ? await db.connect() : db;
            try {
                await client.query("BEGIN");
                await client.query("SELECT pg_advisory_xact_lock(hashtext('blackbox_serials'))");
                const found = await client.query("SELECT * FROM blackbox_units WHERE lower(ecdsa_public_key) = lower($1)", [ecdsaPublicKey]);
                if (found.rows[0]) {
                    await client.query("COMMIT");
                    return { unit: mapUnit(found.rows[0]), created: false };
                }
                const { rows: all } = await client.query("SELECT serial FROM blackbox_units");
                const serial = nextSerial(all.map((r) => r.serial), revision, type);
                const { rows } = await client.query(
                    `INSERT INTO blackbox_units (serial, revision, status, ecdsa_public_key)
                     VALUES ($1, $2, 'IN_STOCK', $3) RETURNING *`,
                    [serial, revision, ecdsaPublicKey]
                );
                await client.query(
                    "INSERT INTO blackbox_unit_history (serial, action, details) VALUES ($1, $2, $3)",
                    [serial, "FACTORY_REGISTERED", JSON.stringify({ type })]
                );
                await client.query("COMMIT");
                return { unit: mapUnit(rows[0]), created: true };
            } catch (e) {
                await client.query("ROLLBACK").catch(() => {});
                throw e;
            } finally {
                if (client !== db && typeof client.release === "function") client.release();
            }
        },

        async createBlackboxUnit({ serial, revision = "V1", ecdsaPublicKey, ownerUid = null }) {
            try {
                const { rows } = await db.query(
                    `INSERT INTO blackbox_units (serial, revision, status, ecdsa_public_key, owner_uid, activated_at)
                     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5::uuid IS NULL THEN NULL ELSE NOW() END)
                     RETURNING *`,
                    [serial, revision, ownerUid ? "ACTIVE" : "IN_STOCK", ecdsaPublicKey, ownerUid]
                );
                await db.query(
                    "INSERT INTO blackbox_unit_history (serial, action, details) VALUES ($1, $2, $3)",
                    [serial, "REGISTERED", JSON.stringify({ ownerUid })]
                );
                return mapUnit(rows[0]);
            } catch (e) {
                if (e.code === "23505" && /pubkey/.test(e.constraint || "")) throw new StoreError("KEY_EXISTS", "Cette clé appartient déjà à un autre boîtier.");
                if (e.code === "23505") throw new StoreError("UNIT_EXISTS", "Boîtier déjà enregistré (la clé ne peut pas être remplacée).");
                if (e.code === "23503" || e.code === "22P02") throw new StoreError("OWNER_NOT_FOUND", "Propriétaire du boîtier introuvable.");
                throw e;
            }
        },

        async insertTelemetrySession(rec) {
            const { rows } = await db.query(
                `INSERT INTO telemetry_sessions
                   (session_id, user_uid, hardware_id, is_crash_report, impact_timestamp, merkle_verified,
                    merkle_root_hex, ecdsa_verified, frame_count, worm_storage_path, worm_sha256_hex)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING session_id, created_at`,
                [rec.sessionId, rec.uid, rec.hardwareId, rec.isCrashReport, rec.impactTimestamp,
                    rec.merkleVerified, rec.merkleRootHex, rec.ecdsaVerified, rec.frameCount,
                    rec.wormStoragePath, rec.wormSha256Hex]
            );
            return { ...rec, sessionId: rows[0].session_id };
        },

        // ─── Dangers signalés ───────────────────────────────────────────────

        async createHazard({ uid, type, lat, lng, description = "" }) {
            const { rows } = await db.query(
                `INSERT INTO hazards (user_uid, type, lat, lng, description)
                 VALUES ($1, $2, $3, $4, $5) RETURNING hazard_id, created_at`,
                [uid, type, lat, lng, description]
            );
            return { hazardId: rows[0].hazard_id, type, lat, lng, description, createdAt: rows[0].created_at.toISOString() };
        },

        async countHazardsSince(uid, sinceMs) {
            const { rows } = await db.query(
                "SELECT count(*)::int AS n FROM hazards WHERE user_uid = $1 AND created_at > to_timestamp($2 / 1000.0)",
                [uid, sinceMs]
            );
            return rows[0].n;
        },

        /** Dangers actifs dans un rayon (mètres) : pré-filtre par rectangle, puis distance exacte (haversine). */
        async findHazardsNear({ lat, lng, radiusM, limit = 200 }) {
            const dLat = radiusM / 111320;
            const dLng = radiusM / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
            const { rows } = await db.query(
                `SELECT * FROM (
                    SELECT hazard_id, type, lat, lng, description, votes, created_at,
                           2 * 6371000 * asin(sqrt(
                               power(sin(radians(lat - $1) / 2), 2) +
                               cos(radians($1)) * cos(radians(lat)) * power(sin(radians(lng - $2) / 2), 2)
                           )) AS distance_m
                      FROM hazards
                     WHERE active AND lat BETWEEN $1 - $4 AND $1 + $4 AND lng BETWEEN $2 - $5 AND $2 + $5
                 ) h WHERE distance_m <= $3 ORDER BY distance_m LIMIT $6`,
                [lat, lng, radiusM, dLat, dLng, limit]
            );
            return rows.map((r) => ({
                hazardId: r.hazard_id, type: r.type, lat: r.lat, lng: r.lng, description: r.description,
                votes: r.votes, createdAt: r.created_at.toISOString(), distanceM: Math.round(r.distance_m),
            }));
        },

        // ─── Points (grand livre immuable) ──────────────────────────────────

        /**
         * Applique une transaction de points de façon atomique (verrou sur le compte).
         * @param {object} t { uid, action, reason, description, amount, unverified, idempotencyKey, metadata,
         *                     hazardId?, checkCaps(quotaData) → {ok, reason} }
         */
        async applyPointsTransaction(t) {
            if (!UUID_RE.test(String(t.uid))) throw new StoreError("USER_NOT_FOUND", "Profil utilisateur introuvable.");
            const client = await db.connect();
            try {
                await client.query("BEGIN");
                const u = await client.query(
                    "SELECT brave_coins, is_banned FROM users WHERE uid = $1 AND deleted_at IS NULL FOR UPDATE", [t.uid]
                );
                if (!u.rows[0]) throw new StoreError("USER_NOT_FOUND", "Profil utilisateur introuvable.");
                if (u.rows[0].is_banned) throw new StoreError("BANNED", "Compte suspendu. Transactions bloquées.");

                if (t.idempotencyKey) {
                    const prev = await client.query(
                        "SELECT balance_after FROM points_ledger WHERE user_uid = $1 AND idempotency_key = $2", [t.uid, t.idempotencyKey]
                    );
                    if (prev.rows[0]) {
                        await client.query("ROLLBACK");
                        return { idempotent: true, balance: prev.rows[0].balance_after, delta: 0 };
                    }
                }

                if (t.hazardId) {
                    const ok = UUID_RE.test(String(t.hazardId)) && (await client.query(
                        `SELECT 1 FROM hazards WHERE hazard_id = $1 AND user_uid = $2 AND created_at > NOW() - INTERVAL '48 hours'`,
                        [t.hazardId, t.uid]
                    )).rowCount === 1;
                    if (!ok) throw new StoreError("PROOF_FAILED", "Signalement introuvable, trop ancien ou créé par un autre compte.");
                }

                if (t.action === "AWARD") {
                    const q = await client.query(
                        "SELECT reason, amount FROM points_daily_quota WHERE user_uid = $1 AND day = CURRENT_DATE", [t.uid]
                    );
                    const quota = Object.fromEntries(q.rows.map((r) => [r.reason, r.amount]));
                    const caps = t.checkCaps(quota);
                    if (!caps.ok) throw new StoreError("CAP_REACHED", caps.reason);
                }

                const before = u.rows[0].brave_coins;
                if (t.action === "DEDUCT" && before < t.amount) {
                    throw new StoreError("INSUFFICIENT_FUNDS", `Solde insuffisant : vous avez ${before} Pts mon50cc, il en faut ${t.amount}.`);
                }
                const delta = t.action === "DEDUCT" ? -t.amount : t.amount;
                const after = before + delta;

                await client.query("UPDATE users SET brave_coins = $2, updated_at = NOW() WHERE uid = $1", [t.uid, after]);
                await client.query(
                    `INSERT INTO points_ledger (user_uid, action, reason, description, delta, amount, balance_before,
                                                balance_after, idempotency_key, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [t.uid, t.action, t.reason, t.description, delta, t.amount, before, after,
                        t.idempotencyKey || null, t.metadata ? JSON.stringify(t.metadata) : null]
                );
                if (t.action === "AWARD") {
                    const reasons = t.unverified ? [t.reason, "__unverified"] : [t.reason];
                    for (const r of reasons) {
                        await client.query(
                            `INSERT INTO points_daily_quota (user_uid, day, reason, amount) VALUES ($1, CURRENT_DATE, $2, $3)
                             ON CONFLICT (user_uid, day, reason) DO UPDATE SET amount = points_daily_quota.amount + EXCLUDED.amount`,
                            [t.uid, r, t.amount]
                        );
                    }
                }
                await client.query("COMMIT");
                return { idempotent: false, balance: after, delta };
            } catch (e) {
                await client.query("ROLLBACK").catch(() => {});
                throw e;
            } finally {
                client.release();
            }
        },

        // ─── Paiements Revolut (payments.js) ─────────────────────────────────

        async createPaymentOrder(o) {
            const { rows } = await db.query(
                `INSERT INTO revolut_orders (revolut_order_id, case_id, user_uid, report_type, category, amount_cents,
                                             currency, status, order_token)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8) RETURNING *`,
                [o.revolutOrderId, o.caseId, o.uid, o.product, o.category, o.amountCents, o.currency || "EUR", o.orderToken]
            );
            return mapOrder(rows[0]);
        },

        async findPaymentOrder(revolutOrderId) {
            const { rows } = await db.query("SELECT * FROM revolut_orders WHERE revolut_order_id = $1", [revolutOrderId]);
            return mapOrder(rows[0]);
        },

        async findPaymentOrderByCase(caseId) {
            const { rows } = await db.query("SELECT * FROM revolut_orders WHERE case_id = $1", [caseId]);
            return mapOrder(rows[0]);
        },

        /** Commande en attente récente du même acheteur pour le même produit (double clic, fenêtre fermée). */
        async findReusablePendingOrder(uid, product, sinceMs) {
            if (!UUID_RE.test(String(uid))) return null;
            const { rows } = await db.query(
                `SELECT * FROM revolut_orders WHERE user_uid = $1 AND report_type = $2 AND status = 'PENDING'
                    AND order_token IS NOT NULL AND created_at > to_timestamp($3 / 1000.0)
                  ORDER BY created_at DESC LIMIT 1`,
                [uid, product, sinceMs]
            );
            return mapOrder(rows[0]);
        },

        /**
         * Commande payée : passage à COMPLETED et livraison dans la même transaction, une seule fois.
         * @param {string} revolutOrderId
         * @param {{pointsToCredit?: number, certifyGarage?: boolean, invoice?: object}} delivery
         */
        async completePaymentOrder(revolutOrderId, { pointsToCredit = 0, certifyGarage = false, invoice = null } = {}) {
            const client = await db.connect();
            try {
                await client.query("BEGIN");
                const { rows } = await client.query("SELECT * FROM revolut_orders WHERE revolut_order_id = $1 FOR UPDATE", [revolutOrderId]);
                const order = rows[0];
                if (!order) {
                    await client.query("ROLLBACK");
                    return { notFound: true };
                }
                if (order.status === "COMPLETED") {
                    await client.query("ROLLBACK");
                    return { alreadyProcessed: true, order: mapOrder(order) };
                }
                const done = await client.query(
                    `UPDATE revolut_orders SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
                      WHERE revolut_order_id = $1 RETURNING *`, [revolutOrderId]
                );
                let balance = null;
                if (pointsToCredit > 0) {
                    const u = await client.query("SELECT brave_coins FROM users WHERE uid = $1 FOR UPDATE", [order.user_uid]);
                    const before = u.rows[0].brave_coins;
                    balance = before + pointsToCredit;
                    await client.query("UPDATE users SET brave_coins = $2, updated_at = NOW() WHERE uid = $1", [order.user_uid, balance]);
                    await client.query(
                        `INSERT INTO points_ledger (user_uid, action, reason, description, delta, amount, balance_before,
                                                    balance_after, idempotency_key, metadata)
                         VALUES ($1, 'PURCHASE', 'POINTS_PURCHASE', $2, $3, $3, $4, $5, $6, $7)`,
                        [order.user_uid, `Pack de points ${order.report_type} (Revolut)`, pointsToCredit, before, balance,
                            `revolut:${revolutOrderId}`, JSON.stringify({ revolutOrderId, product: order.report_type })]
                    );
                }
                if (certifyGarage) {
                    await client.query(
                        `UPDATE users SET is_certified_garage = TRUE, certified_at = COALESCE(certified_at, NOW()), updated_at = NOW()
                          WHERE uid = $1`, [order.user_uid]
                    );
                }
                if (invoice) {
                    await client.query(
                        `INSERT INTO invoices_to_issue (revolut_order_id, invoice) VALUES ($1, $2)
                         ON CONFLICT (revolut_order_id) DO NOTHING`, [revolutOrderId, JSON.stringify(invoice)]
                    );
                }
                await client.query("COMMIT");
                return { processed: true, balance, order: mapOrder(done.rows[0]) };
            } catch (e) {
                await client.query("ROLLBACK").catch(() => {});
                throw e;
            } finally {
                client.release();
            }
        },

        /** Paiement refusé ou annulé (jamais une commande déjà payée). Vrai si la commande a changé. */
        async failPaymentOrder(revolutOrderId) {
            const { rowCount } = await db.query(
                `UPDATE revolut_orders SET status = 'FAILED', failed_at = NOW(), updated_at = NOW()
                  WHERE revolut_order_id = $1 AND status = 'PENDING'`, [revolutOrderId]
            );
            return rowCount === 1;
        },

        /** Administrateur : dernières commandes, avec le pseudo et l'identifiant Firebase de l'acheteur. */
        async listPaymentOrders({ limit = 100 } = {}) {
            const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
            const { rows } = await db.query(
                `SELECT o.*, u.username, u.firebase_uid FROM revolut_orders o JOIN users u ON u.uid = o.user_uid
                  ORDER BY o.created_at DESC LIMIT $1`, [max]
            );
            return rows.map((r) => ({ ...mapOrder(r), username: r.username, firebaseUid: r.firebase_uid || null }));
        },

        /** Factures à émettre (export CSV pour Kolecto). */
        async listInvoicesToIssue() {
            const { rows } = await db.query(
                "SELECT invoice, paid_at FROM invoices_to_issue WHERE status = 'A_EMETTRE' ORDER BY paid_at"
            );
            return rows.map((r) => ({ ...r.invoice, paid_at: iso(r.paid_at) }));
        },

        /** Classement : points GAGNÉS (jamais achetés ni dépensés), comptes anonymisés exclus. */
        /** Historique des points d'un pilote, du plus récent au plus ancien. */
        async listPointsHistory(uid, limit = 30) {
            if (!UUID_RE.test(String(uid))) return [];
            const { rows } = await db.query(
                `SELECT action, reason, description, delta, balance_after, created_at FROM points_ledger
                  WHERE user_uid = $1 ORDER BY created_at DESC, ledger_id DESC LIMIT $2`,
                [uid, limit]
            );
            return rows.map((r) => ({ action: r.action, reason: r.reason, description: r.description, delta: r.delta,
                balanceAfter: r.balance_after, createdAt: new Date(r.created_at).toISOString() }));
        },

        // ─── Carnet d'apprentissage de Nexus Atlas (nexus-brain.js) ─────────
        async recordNexusAnswer({ questionNorm, question, answer }) {
            const { rows } = await db.query(
                `INSERT INTO nexus_learning (question_norm, question, answer) VALUES ($1, $2, $3)
                 ON CONFLICT (question_norm) DO UPDATE SET times_asked = nexus_learning.times_asked + 1, updated_at = NOW()
                 RETURNING id, (xmax = 0) AS created`,
                [String(questionNorm).slice(0, 500), String(question).slice(0, 500), answer]
            );
            return { id: Number(rows[0].id), created: rows[0].created };
        },
        async findLearnedNexusAnswer(questionNorm) {
            const { rows } = await db.query(
                `SELECT id, question_norm, answer FROM nexus_learning WHERE status = ANY($1)
                  ORDER BY (question_norm = $2) DESC, times_asked DESC LIMIT 500`,
                [VALIDATED, questionNorm]
            );
            const hit = bestLearnedMatch(questionNorm, rows.map((r) => ({ id: Number(r.id), questionNorm: r.question_norm, answer: r.answer })));
            return hit ? { id: hit.id, answer: hit.answer } : null;
        },
        async countNexusQuestion(id) {
            await db.query("UPDATE nexus_learning SET times_asked = times_asked + 1, updated_at = NOW() WHERE id = $1", [id]);
        },
        async getNexusEntry(id) {
            const { rows } = await db.query("SELECT * FROM nexus_learning WHERE id = $1", [id]);
            return mapNexus(rows[0]);
        },
        async updateNexusEntry(id, { status, answer, category, reviewNote, reviewedBy } = {}) {
            const { rows } = await db.query(
                `UPDATE nexus_learning SET status = COALESCE($2, status), answer = COALESCE($3, answer),
                        category = COALESCE($4, category), review_note = COALESCE($5, review_note),
                        reviewed_by = COALESCE($6, reviewed_by),
                        reviewed_at = CASE WHEN $6::text IS NULL THEN reviewed_at ELSE NOW() END, updated_at = NOW()
                  WHERE id = $1 RETURNING *`,
                [id, status ?? null, answer ?? null, category ?? null, reviewNote ?? null, reviewedBy ?? null]
            );
            return mapNexus(rows[0]);
        },
        async listNexusNotebook({ status = null, limit = 100 } = {}) {
            const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
            const { rows } = status
                ? await db.query("SELECT * FROM nexus_learning WHERE status = $1 ORDER BY times_asked DESC, id DESC LIMIT $2", [status, max])
                : await db.query("SELECT * FROM nexus_learning ORDER BY times_asked DESC, id DESC LIMIT $1", [max]);
            return rows.map(mapNexus);
        },

        async topPilots(limit = 10) {
            const { rows } = await db.query(
                `SELECT u.username, SUM(l.delta)::int AS points
                   FROM points_ledger l JOIN users u ON u.uid = l.user_uid
                  WHERE l.action = 'AWARD' AND u.deleted_at IS NULL AND NOT u.hide_from_leaderboard
                  GROUP BY u.uid, u.username ORDER BY points DESC LIMIT $1`,
                [limit]
            );
            return rows.map((r) => ({ username: r.username, points: r.points }));
        },

        async close() {
            if (!pool) await db.end();
        },
    };
}

module.exports = { createPgStore };
