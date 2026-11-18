-- ============================================================================
-- Migration 002 (18/11/2026) — paiements Revolut sur le serveur souverain (server/payments.js)
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : chaque instruction peut
-- être rejouée sans effet. Rien à taper sur le VPS : elle passe au prochain redémarrage de l'API.
-- ============================================================================

-- 1. Commandes (déjà dans db/schema.sql ; recréée ici pour une base qui ne l'aurait pas)
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
ALTER TABLE revolut_orders ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE revolut_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_revolut_orders_user ON revolut_orders (user_uid, report_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revolut_orders_created ON revolut_orders (created_at DESC);

-- 2. Factures à émettre (invoicing.js), une par commande payée. Données comptables : gardées 10 ans
--    (code de commerce, art. L123-22), même après l'effacement RGPD du compte.
CREATE TABLE IF NOT EXISTS invoices_to_issue (
    revolut_order_id VARCHAR(128) PRIMARY KEY REFERENCES revolut_orders (revolut_order_id),
    status           VARCHAR(16) NOT NULL DEFAULT 'A_EMETTRE',
    invoice          JSONB NOT NULL,
    paid_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Points achetés : mouvement « PURCHASE » dans le grand livre. Le classement ne compte que les
--    « AWARD » (points gagnés) : un pack de points ne fait pas monter au classement.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'points_ledger_action_check'
           AND pg_get_constraintdef(oid) LIKE '%PURCHASE%'
    ) THEN
        ALTER TABLE points_ledger DROP CONSTRAINT IF EXISTS points_ledger_action_check;
        ALTER TABLE points_ledger ADD CONSTRAINT points_ledger_action_check
            CHECK (action IN ('AWARD', 'DEDUCT', 'PURCHASE'));
    END IF;
END $$;
