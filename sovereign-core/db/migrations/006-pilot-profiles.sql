-- ============================================================================
-- Migration 006 (23/11/2026) — profil du pilote repris de Firebase
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Seulement ce que l'appli affiche. Ni adresse IP, ni empreinte d'appareil, ni rôle, ni points.
-- Lignes incluses dans l'export RGPD, effacées avec le compte.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pilot_profiles (
    user_uid       UUID PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    brand          VARCHAR(60),
    model          VARCHAR(60),
    department     VARCHAR(3),
    ghost_mode     BOOLEAN NOT NULL DEFAULT FALSE,
    registered_at  TIMESTAMPTZ,  -- date d'inscription d'origine (offre Fondateur)
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
