/**
 * store-pg.js — Stockage PostgreSQL (production : OVHcloud Managed PostgreSQL, schéma db/schema.sql).
 *
 * Même contrat que store-memory.js. Requêtes paramétrées uniquement ($1, $2…) : aucune
 * concaténation de données utilisateur dans le SQL.
 */
"use strict";

const { Pool } = require("pg");
const { StoreError } = require("./store-errors");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapUser(r) {
    if (!r) return null;
    return {
        uid: r.uid,
        email: r.email,
        username: r.username,
        passwordHash: r.password_hash,
        role: r.role,
        braveCoins: r.brave_coins,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
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
                const { rowCount } = await client.query(
                    `UPDATE users SET email = $2, username = $3, password_hash = '!', brave_coins = 0,
                            is_premium = FALSE, premium_plan = NULL, ban_reason = NULL,
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
                await client.query("COMMIT");
                return true;
            } catch (e) {
                await client.query("ROLLBACK").catch(() => {});
                throw e;
            } finally {
                client.release();
            }
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

        /** Classement : points GAGNÉS (jamais achetés ni dépensés), comptes anonymisés exclus. */
        async topPilots(limit = 10) {
            const { rows } = await db.query(
                `SELECT u.username, SUM(l.delta)::int AS points
                   FROM points_ledger l JOIN users u ON u.uid = l.user_uid
                  WHERE l.action = 'AWARD' AND u.deleted_at IS NULL
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
