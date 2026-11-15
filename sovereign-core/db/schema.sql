-- ============================================================================
-- mon50ccetmoi.com — Schéma Base de Données Souveraine (PostgreSQL 16 + PostGIS)
-- ============================================================================
-- Remplace intégralement Google Cloud Firestore et firestore.rules.
-- Conformité :
--   - OWASP ASVS v5.0.0 (Contrôle d'accès RBAC, intégrité transactionnelle ACID)
--   - ISO/IEC 27037 & Art. 1366 Code Civil (Immuabilité des preuves Boîte Noire)
--   - RGPD Art. 17 & Art. 32 (Droit à l'effacement en cascade & pseudonymisation)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- 1. FONCTIONS & TRIGGERS D'IMMUABILITÉ FORENSIQUE (Remplace allow update, delete: if false)
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_modification_or_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLATION D''INTÉGRITÉ FORENSIQUE : La table % est strictement immuable (Append-Only).', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABLE UTILISATEURS & AUTHENTIFICATION SOUVERAINE (Remplace Firebase Auth + /users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    uid                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    username            VARCHAR(64) UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    role                VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'garage', 'insurer', 'admin')),
    brave_coins         INTEGER NOT NULL DEFAULT 0 CHECK (brave_coins >= 0),
    is_premium          BOOLEAN NOT NULL DEFAULT FALSE,
    premium_plan        VARCHAR(64),
    premium_since       TIMESTAMPTZ,
    is_certified_garage BOOLEAN NOT NULL DEFAULT FALSE,
    certified_at        TIMESTAMPTZ,
    is_banned           BOOLEAN NOT NULL DEFAULT FALSE,
    ban_reason          TEXT,
    blackbox_serial     VARCHAR(32),
    deleted_at          TIMESTAMPTZ, -- RGPD : compte anonymisé (voir anonymizeUser dans store-pg.js)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bases déjà créées avant l'ajout de la colonne
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- RGPD : un compte n'est jamais supprimé physiquement (les tables de preuves immuables qui le
-- référencent bloqueraient la suppression en cascade). Il est ANONYMISÉ : email, pseudo, mot de
-- passe et clés biométriques effacés ; preuves conservées (art. 17.3.e, défense de droits en justice).

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================================
-- 3. CLÉS BIOMÉTRIQUES FIDO2 / WEBAUTHN
-- ============================================================================
CREATE TABLE IF NOT EXISTS fido_credentials (
    credential_id         TEXT PRIMARY KEY,
    user_uid              UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    credential_public_key TEXT NOT NULL,
    counter               BIGINT NOT NULL DEFAULT 0,
    transports            TEXT[] DEFAULT ARRAY['internal'],
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fido_challenges (
    user_uid   UUID PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    challenge  TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. GRAND LIVRE MONÉTAIRE DES POINTS (Append-Only — OWASP ASVS v5.0.0-2.3.3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS points_ledger (
    ledger_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid        UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    action          VARCHAR(10) NOT NULL CHECK (action IN ('AWARD', 'DEDUCT')),
    reason          VARCHAR(64) NOT NULL,
    description     TEXT NOT NULL,
    delta           INTEGER NOT NULL,
    amount          INTEGER NOT NULL CHECK (amount > 0),
    balance_before  INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
    idempotency_key VARCHAR(128),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_uid, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger(user_uid, created_at DESC);

DROP TRIGGER IF EXISTS trg_immutable_points_ledger ON points_ledger;
CREATE TRIGGER trg_immutable_points_ledger
BEFORE UPDATE OR DELETE ON points_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();

-- ============================================================================
-- 5. REGISTRE MATÉRIEL BOÎTE NOIRE (Francelog S.A. — EXP-BB50-2026-REV3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS blackbox_units (
    serial           VARCHAR(32) PRIMARY KEY,
    revision         VARCHAR(8) NOT NULL DEFAULT 'V1',
    status           VARCHAR(24) NOT NULL DEFAULT 'IN_STOCK'
                     CHECK (status IN ('IN_STOCK', 'RESERVED', 'SOLD', 'SHIPPED', 'ACTIVE', 'RMA', 'DECOMMISSIONED')),
    ecdsa_public_key TEXT NOT NULL, -- secp256r1 : point non compressé (04 + 64 octets hex) ou PEM
    owner_uid        UUID REFERENCES users(uid) ON DELETE SET NULL,
    sale_order_id    VARCHAR(128),
    activated_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blackbox_unit_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial     VARCHAR(32) NOT NULL REFERENCES blackbox_units(serial) ON DELETE RESTRICT,
    action     VARCHAR(64) NOT NULL,
    actor_uid  UUID,
    details    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE blackbox_units ALTER COLUMN ecdsa_public_key TYPE TEXT;

-- Une clé de boîtier n'appartient qu'à un seul numéro de série
CREATE UNIQUE INDEX IF NOT EXISTS uq_blackbox_units_pubkey ON blackbox_units (lower(ecdsa_public_key));

-- Le lien numéro de série ↔ clé publique est définitif (fixé à la mise en service en usine)
CREATE OR REPLACE FUNCTION prevent_blackbox_key_change() RETURNS trigger AS $$
BEGIN
    IF NEW.serial IS DISTINCT FROM OLD.serial OR NEW.ecdsa_public_key IS DISTINCT FROM OLD.ecdsa_public_key THEN
        RAISE EXCEPTION 'INTÉGRITÉ : le lien numéro de série / clé du boîtier % est définitif', OLD.serial;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blackbox_key_immutable ON blackbox_units;
CREATE TRIGGER trg_blackbox_key_immutable
BEFORE UPDATE ON blackbox_units
FOR EACH ROW EXECUTE FUNCTION prevent_blackbox_key_change();

DROP TRIGGER IF EXISTS trg_immutable_bb_history ON blackbox_unit_history;
CREATE TRIGGER trg_immutable_bb_history
BEFORE UPDATE OR DELETE ON blackbox_unit_history
FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();

-- ============================================================================
-- 6. SESSIONS TÉLÉMÉTRIQUES & PREUVES FORENSIQUES (Zero-Knowledge WORM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS telemetry_sessions (
    session_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid          UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    hardware_id       VARCHAR(64) NOT NULL,
    is_crash_report   BOOLEAN NOT NULL DEFAULT FALSE,
    impact_timestamp  BIGINT,
    merkle_verified   BOOLEAN,
    merkle_root_hex   CHAR(64),
    ecdsa_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    frame_count       INTEGER NOT NULL CHECK (frame_count > 0 AND frame_count <= 5000),
    worm_storage_path TEXT NOT NULL,
    worm_sha256_hex   CHAR(64) NOT NULL,
    ign_qualification JSONB, -- Qualification juridique IGN API Carto (Domaine public vs privé)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_immutable_telemetry_sessions ON telemetry_sessions;
CREATE TRIGGER trg_immutable_telemetry_sessions
BEFORE UPDATE OR DELETE ON telemetry_sessions
FOR EACH ROW EXECUTE FUNCTION prevent_modification_or_deletion();

-- ============================================================================
-- 7. RADAR COMMUNAUTAIRE & DANGERS GÉOSPATIAUX (PostGIS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hazards (
    hazard_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid    UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    type        VARCHAR(24) NOT NULL CHECK (type IN ('pothole', 'accident', 'police', 'roadwork', 'obstacle', 'weather', 'other')),
    location    GEOGRAPHY(POINT, 4326), -- rempli automatiquement depuis lat/lng (trigger PostGIS ci-dessous)
    lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    description VARCHAR(500) NOT NULL DEFAULT '',
    votes       INTEGER NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hazards ALTER COLUMN location DROP NOT NULL;
-- Recherche « autour de moi » en SQL standard (lat/lng) : fonctionne avec ou sans PostGIS
CREATE INDEX IF NOT EXISTS idx_hazards_latlng ON hazards (lat, lng) WHERE active;
CREATE INDEX IF NOT EXISTS idx_hazards_user_day ON hazards (user_uid, created_at DESC);

-- [POSTGIS-DEBUT] (retiré par les tests sur PostgreSQL portable, qui n'a pas PostGIS)
CREATE INDEX IF NOT EXISTS idx_hazards_geo ON hazards USING GIST (location);
CREATE OR REPLACE FUNCTION hazards_fill_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_hazards_location ON hazards;
CREATE TRIGGER trg_hazards_location
BEFORE INSERT OR UPDATE OF lat, lng ON hazards
FOR EACH ROW EXECUTE FUNCTION hazards_fill_location();
-- [POSTGIS-FIN]

-- Plafonds quotidiens de gains de points (même barème que functions/api/points-rules.js)
CREATE TABLE IF NOT EXISTS points_daily_quota (
    user_uid UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    day      DATE NOT NULL,
    reason   VARCHAR(64) NOT NULL, -- '__unverified' = total des gains non vérifiables
    amount   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_uid, day, reason)
);

-- ============================================================================
-- 8. PAIEMENTS REVOLUT & COMMANDES (Idempotence stricte)
-- ============================================================================
CREATE TABLE IF NOT EXISTS revolut_orders (
    revolut_order_id VARCHAR(128) PRIMARY KEY,
    case_id          VARCHAR(128) UNIQUE NOT NULL,
    user_uid         UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    report_type      VARCHAR(64) NOT NULL,
    category         VARCHAR(32) NOT NULL,
    amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
    currency         CHAR(3) NOT NULL DEFAULT 'EUR',
    status           VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    order_token      TEXT,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. ROW-LEVEL SECURITY (RLS — Équivalent Souverain de firestore.rules)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_sessions ENABLE ROW LEVEL SECURITY;

