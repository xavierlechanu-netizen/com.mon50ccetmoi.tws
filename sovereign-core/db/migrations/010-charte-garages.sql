-- ============================================================================
-- Migration 010 (25/11/2026) — charte des garages partenaires acceptée avant paiement
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Version de la charte (src/charte-garages.html) acceptée par le garage, gardée avec sa commande
-- du droit d'entrée (payments.js) : la preuve de l'acceptation dure autant que la commande.
-- ============================================================================

ALTER TABLE revolut_orders ADD COLUMN IF NOT EXISTS charter_version VARCHAR(16);
