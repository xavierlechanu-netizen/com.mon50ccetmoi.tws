-- ============================================================================
-- Migration 003 (19/11/2026) — effacements RGPD à finir dans Firebase
-- ============================================================================
-- Appliquée par le serveur à chaque démarrage (store-pg.js, migrate()) : chaque instruction peut
-- être rejouée sans effet. Rien à taper sur le VPS : elle passe au prochain redémarrage de l'API.
--
-- Pourquoi : quand un pilote efface son compte (DELETE /api/v1/rgpd/account), le serveur anonymise
-- tout de suite ce qu'il garde. Mais tant que le déménagement n'est pas fini, une partie de ses
-- données est encore chez Firebase (profil, signalements, compte de connexion…), et la fonction qui
-- les effaçait est coupée depuis le 14/11/2026. Cette table est la liste des effacements à finir à la
-- main dans la console Firebase (sovereign-core/deploy/rgpd-firebase.sh), sous 30 jours (politique de confidentialité).
--
-- Elle empêche aussi l'import des comptes Firebase (scripts/import-firebase-users.js) de recréer un
-- compte effacé : l'anonymisation retire l'email et l'identifiant Firebase du compte, l'import ne le
-- reconnaîtrait plus.
--
-- On n'y garde que le nécessaire pour retrouver la personne chez Firebase, et seulement le temps de
-- le faire : la ligne est supprimée dès que l'effacement est fini (« rgpd-firebase.sh fait <n> »).
-- ============================================================================

CREATE TABLE IF NOT EXISTS rgpd_firebase_a_effacer (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    firebase_uid  VARCHAR(128),            -- connu pour les comptes importés de Firebase
    demande_le    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rgpd_firebase_a_effacer_email ON rgpd_firebase_a_effacer(email);
