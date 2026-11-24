-- ============================================================================
-- Migration 008 (24/11/2026) — liste d'attente de la Boîte Noire (fin de Firestore)
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Une adresse et la date, rien d'autre ; consentement coché obligatoire (vérifié par la route).
-- Effacement sur demande à contact@mon50ccetmoi.com : DELETE FROM blackbox_waitlist WHERE email = '…'.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blackbox_waitlist (
    email       VARCHAR(254) PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
