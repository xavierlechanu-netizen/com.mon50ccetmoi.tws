#!/usr/bin/env bash
# ============================================================================
# Effacements RGPD à finir dans Firebase (table rgpd_firebase_a_effacer, migration 003).
#
# Quand un pilote efface son compte depuis l'appli, le serveur du VPS anonymise tout de suite ce
# qu'il garde. Ce qui est encore chez Firebase (compte de connexion, profil, signalements…) reste à
# effacer à la main, sous 30 jours (politique de confidentialité) : la fonction Firebase qui le faisait est coupée
# depuis le 14/11/2026. Marche à suivre : deploy/README.md, étape 13.
#
#   sudo sovereign-core/deploy/rgpd-firebase.sh          → la liste des effacements à finir
#   sudo sovereign-core/deploy/rgpd-firebase.sh fait 3   → n° 3 fini chez Firebase : la ligne est
#                                                          supprimée (plus rien ne mène à la personne)
#
# check.sh prévient tant que la liste n'est pas vide (❌ au-delà de 25 jours).
# ============================================================================
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root (sudo)"

db_user="$(env_get DB_USER)"
psql_db() {
    compose exec -T postgres-postgis psql -U "${db_user:-mon50cc_admin}" -d mon50ccetmoi \
        -v ON_ERROR_STOP=1 -qtA "$@"
}

table="$(psql_db -c "SELECT to_regclass('rgpd_firebase_a_effacer')")"
[ -n "$table" ] || die "table rgpd_firebase_a_effacer absente : l'API n'a pas encore été reconstruite → cd $CORE_DIR && sudo docker compose -f docker-compose.vps.yml up -d --build"

case "${1:-}" in
    "")
        rows="$(psql_db -F ' | ' -c "
            SELECT id,
                   to_char(demande_le AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
                   to_char((demande_le + INTERVAL '30 days') AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
                   email,
                   COALESCE(firebase_uid, '(à lire dans Authentication, par l''email)')
              FROM rgpd_firebase_a_effacer ORDER BY id")"
        if [ -z "$rows" ]; then
            echo "Aucun effacement à finir dans Firebase."
            exit 0
        fi
        echo "Effacements à finir dans Firebase :"
        echo "  n° | demandé le | au plus tard le | email | identifiant Firebase"
        while IFS= read -r line; do echo "  $line"; done <<<"$rows"
        echo
        echo "Pour chacun : deploy/README.md, étape 13 (console Firebase, projet mon50ccetmoi)."
        echo "Une fois fini chez Firebase : sudo $0 fait <n°>"
        ;;
    fait)
        id="${2:-}"
        [[ "$id" =~ ^[0-9]{1,18}$ ]] || die "numéro attendu : sudo $0 fait <n°> (la liste : sudo $0)"
        removed="$(psql_db -c "WITH d AS (DELETE FROM rgpd_firebase_a_effacer WHERE id = $id RETURNING id) SELECT count(*) FROM d")"
        if [ "$removed" = "1" ]; then
            log "Effacement n° $id noté comme fini : la ligne est supprimée."
        else
            die "aucun effacement n° $id dans la liste (déjà fait ?). La liste : sudo $0"
        fi
        ;;
    *)
        die "usage : sudo $0            (la liste)
       sudo $0 fait <n°>   (effacement fini chez Firebase)"
        ;;
esac
