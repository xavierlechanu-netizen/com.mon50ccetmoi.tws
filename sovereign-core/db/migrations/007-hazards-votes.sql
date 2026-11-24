-- ============================================================================
-- Migration 007 (24/11/2026) — dangers lus par l'appli sur le VPS (fin de Firestore)
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- app_type : type affiché par l'appli (« Police », « animal »…), le serveur garde sa catégorie.
-- hazard_votes : un vote par pilote et par danger (toujours là / disparu).
-- ============================================================================

ALTER TABLE hazards ADD COLUMN IF NOT EXISTS app_type VARCHAR(40);

CREATE TABLE IF NOT EXISTS hazard_votes (
    hazard_id  UUID NOT NULL REFERENCES hazards(hazard_id) ON DELETE CASCADE,
    user_uid   UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    vote       SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
    PRIMARY KEY (hazard_id, user_uid)
);
