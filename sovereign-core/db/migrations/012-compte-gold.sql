-- ============================================================================
-- Migration 012 (25/11/2026) — compte GOLD (freemium)
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Le GPS et la sécurité (SOS, chute, dangers) restent gratuits ; le reste demande GOLD.
-- GOLD = abonnement payé (GOLD_ANNUAL, 29 € pour 1 an, payments.js) jusqu'à premium_until,
-- ou compte « Fondateur » (inscrit avant le 26/11/2026, gratuit à vie : index.js).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
