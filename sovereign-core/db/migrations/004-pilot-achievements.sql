-- ============================================================================
-- Migration 004 (23/11/2026) — badges personnels et trajets déclarés
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Un trajet déclaré vient de la parole du pilote : il n'est jamais mêlé aux km mesurés, au score de
-- conduite ni aux preuves de la Boîte Noire. Lignes incluses dans l'export RGPD, effacées avec le compte.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pilot_achievements (
    user_uid    UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    code        VARCHAR(64) NOT NULL,
    emoji       VARCHAR(16) NOT NULL,
    title       VARCHAR(80) NOT NULL,
    trip        JSONB,      -- { route, date, distance, duration } : trajet déclaré, facultatif
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_uid, code)
);
