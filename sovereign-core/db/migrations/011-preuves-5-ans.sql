-- ============================================================================
-- Migration 011 (25/11/2026) — preuves de la Boîte Noire effacées de la base après 5 ans
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Politique de confidentialité : les trames scellées sont gardées 5 ans. Avant, le verrou
-- refusait tout effacement, pour toujours. Maintenant : ni modification ni effacement avant
-- 5 ans ; après, le serveur les efface chaque jour (store-pg.js, purgeExpiredProofs).
-- Le carnet d'entretien suit la même règle (migration 009, protect_sealed_maintenance).
-- ============================================================================

CREATE OR REPLACE FUNCTION protect_telemetry_retention() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.created_at < NOW() - INTERVAL '5 years' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'VIOLATION D''INTÉGRITÉ FORENSIQUE : preuve de moins de 5 ans, % refusé.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_telemetry_sessions ON telemetry_sessions;
CREATE TRIGGER trg_immutable_telemetry_sessions
BEFORE UPDATE OR DELETE ON telemetry_sessions
FOR EACH ROW EXECUTE FUNCTION protect_telemetry_retention();
