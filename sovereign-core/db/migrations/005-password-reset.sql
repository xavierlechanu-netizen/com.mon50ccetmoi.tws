-- ============================================================================
-- Migration 005 (23/11/2026) — mot de passe oublié
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Un seul lien en cours par pilote. Seule l'empreinte du lien est gardée : lire cette table ne permet
-- pas de changer un mot de passe. La ligne disparaît dès que le lien sert.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    user_uid    UUID PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL
);
