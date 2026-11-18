-- ============================================================================
-- Migration 001 (17/11/2026) — journal d'audit et droit d'opposition au classement
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : chaque instruction
-- peut être rejouée sans effet (IF NOT EXISTS, CREATE OR REPLACE). Une base déjà en service
-- (VPS) la reçoit donc au prochain redémarrage de l'API, sans commande à taper.
-- ============================================================================

-- 1. Journal d'audit (sovereign-core/server/audit-log.js)
--    Aucune donnée d'identité : identifiants internes (UUID), action d'une liste fermée, détails filtrés.
CREATE TABLE IF NOT EXISTS audit_log (
    seq         BIGINT PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL,
    actor_uid   VARCHAR(64),
    actor_role  VARCHAR(20),
    action      VARCHAR(48) NOT NULL,
    target_type VARCHAR(32),
    target_id   VARCHAR(64),
    outcome     VARCHAR(12) NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_hash   CHAR(64) NOT NULL,
    hash        CHAR(64) NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_uid, seq);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log (target_id, seq);

-- Ajout seul : aucune modification ; suppression seulement au-delà d'un an (durée de conservation).
CREATE OR REPLACE FUNCTION audit_log_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.at < NOW() - INTERVAL '365 days' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'VIOLATION D''INTÉGRITÉ : le journal d''audit est en ajout seul (% refusé).', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_guard ON audit_log;
CREATE TRIGGER trg_audit_log_guard
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_guard();

CREATE OR REPLACE FUNCTION audit_log_no_truncate()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLATION D''INTÉGRITÉ : le journal d''audit ne peut pas être vidé.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
CREATE TRIGGER trg_audit_log_no_truncate
BEFORE TRUNCATE ON audit_log
FOR EACH STATEMENT EXECUTE FUNCTION audit_log_no_truncate();

-- 2. Droit d'opposition (RGPD art. 21) : ne pas apparaître dans le classement des pilotes
ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_from_leaderboard BOOLEAN NOT NULL DEFAULT FALSE;
