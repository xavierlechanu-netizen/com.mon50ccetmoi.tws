-- ============================================================================
-- Migration 009 (25/11/2026) — espace garage et carnet d'entretien (remplacent Firestore)
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : rejouable sans effet.
-- Un garage n'écrit dans le carnet d'un pilote que si le pilote lui a donné un code (accord),
-- et le pilote peut retirer cet accord à tout moment. Une intervention notée par un garage est une
-- PREUVE : scellée dans le coffre (Object Lock 5 ans, comme la Boîte Noire), jamais modifiée ni
-- effacée, même avec le compte (RGPD art. 17.3.e). Le reste s'efface avec le compte.
-- ============================================================================

-- Fiche publique d'un garage certifié (carte des pilotes) : coordonnées professionnelles seulement
CREATE TABLE IF NOT EXISTS garage_profiles (
    user_uid    UUID PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    name        VARCHAR(80)  NOT NULL,
    address     VARCHAR(160) NOT NULL,
    phone       VARCHAR(20),
    lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Code d'accord donné par le pilote à son garage : un seul à la fois, 15 minutes, empreinte seulement
CREATE TABLE IF NOT EXISTS garage_access_codes (
    pilot_uid   UUID PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    code_hash   CHAR(64) NOT NULL UNIQUE,
    km          INTEGER CHECK (km BETWEEN 0 AND 1000000),
    expires_at  TIMESTAMPTZ NOT NULL
);

-- Garages autorisés par un pilote (km : dernier kilométrage connu, pour les rappels d'entretien)
CREATE TABLE IF NOT EXISTS garage_clients (
    garage_uid  UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    pilot_uid   UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    km          INTEGER CHECK (km BETWEEN 0 AND 1000000),
    linked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (garage_uid, pilot_uid)
);
CREATE INDEX IF NOT EXISTS garage_clients_pilot_idx ON garage_clients (pilot_uid);

-- Carnet d'entretien : garage_uid NULL = noté par le pilote lui-même (non certifié)
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id           BIGSERIAL PRIMARY KEY,
    pilot_uid    UUID NOT NULL REFERENCES users(uid),
    garage_uid   UUID REFERENCES users(uid),
    category     VARCHAR(40)  NOT NULL,
    description  VARCHAR(300) NOT NULL DEFAULT '',
    km           INTEGER CHECK (km BETWEEN 0 AND 1000000),
    worm_storage_path TEXT,      -- preuve scellée dans le coffre (intervention d'un garage)
    worm_sha256_hex   CHAR(64),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (garage_uid IS NULL OR (worm_storage_path IS NOT NULL AND worm_sha256_hex IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS maintenance_logs_pilot_idx ON maintenance_logs (pilot_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS maintenance_logs_garage_idx ON maintenance_logs (garage_uid, created_at DESC);

-- Intervention d'un garage : ni UPDATE, ni DELETE avant 5 ans (effacée ensuite par le serveur,
-- store-pg.js purgeExpiredProofs) ; une note du pilote reste effaçable avec son compte
CREATE OR REPLACE FUNCTION protect_sealed_maintenance() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR (OLD.garage_uid IS NOT NULL AND OLD.created_at >= NOW() - INTERVAL '5 years') THEN
        RAISE EXCEPTION 'INTÉGRITÉ : l''intervention % est scellée par un garage, ni modifiable ni effaçable', OLD.id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sealed_maintenance ON maintenance_logs;
CREATE TRIGGER trg_sealed_maintenance
BEFORE UPDATE OR DELETE ON maintenance_logs
FOR EACH ROW EXECUTE FUNCTION protect_sealed_maintenance();
