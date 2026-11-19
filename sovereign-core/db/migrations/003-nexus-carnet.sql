-- ============================================================================
-- Migration 003 (19/11/2026) — carnet d'apprentissage de Nexus Atlas (server/nexus-brain.js)
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (rejouable sans effet).
-- Une ligne par question (nettoyée de toute donnée personnelle) à laquelle Mistral 7B a répondu.
-- Statuts : a_verifier (par défaut), valide_auto (agent), valide (administrateur), rejete_auto (agent),
-- refuse (administrateur). Seules les réponses « valide » et « valide_auto » sont répétées par Nexus Atlas.
-- Jamais de message d'urgence ni de question de loi ici (bloqués avant Mistral).
-- ============================================================================

CREATE TABLE IF NOT EXISTS nexus_learning (
    id            BIGSERIAL PRIMARY KEY,
    question_norm VARCHAR(500) NOT NULL UNIQUE,
    question      VARCHAR(500) NOT NULL,
    answer        TEXT NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'a_verifier'
                  CHECK (status IN ('a_verifier', 'valide_auto', 'valide', 'rejete_auto', 'refuse')),
    category      VARCHAR(16),
    times_asked   INTEGER NOT NULL DEFAULT 1 CHECK (times_asked >= 1),
    review_note   TEXT,
    reviewed_by   VARCHAR(64),
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nexus_learning_status ON nexus_learning (status, times_asked DESC);
