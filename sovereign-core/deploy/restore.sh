#!/usr/bin/env bash
# ============================================================================
# Restauration d'une sauvegarde de la base.
#
#   sudo deploy/restore.sh --list                 → sauvegardes disponibles dans l'Object Storage
#   sudo deploy/restore.sh <nom ou fichier> --yes → REMPLACE la base actuelle par cette sauvegarde
#
# <nom> : un nom affiché par --list (téléchargé depuis l'Object Storage),
#         ou le chemin d'un fichier local (/var/backups/mon50cc/...).
# L'API est arrêtée pendant la restauration, puis relancée.
# ============================================================================
set -euo pipefail
umask 077

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

usage() { echo "Usage : $0 --list | <nom ou fichier> --yes" >&2; exit 2; }
[ $# -ge 1 ] || usage

if [ "$1" = "--list" ]; then
    work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
    s3_backup "$work" list
    exit 0
fi

source_arg="$1"
[ "${2:-}" = "--yes" ] || die "ajoutez --yes pour confirmer : la base actuelle sera REMPLACÉE"

BACKUP_PASSPHRASE="$(env_get BACKUP_PASSPHRASE)"
[ -n "$BACKUP_PASSPHRASE" ] || die "BACKUP_PASSPHRASE absente de $ENV_FILE"
export BACKUP_PASSPHRASE
DB_USER="$(env_get DB_USER)"; DB_USER="${DB_USER:-mon50cc_admin}"

restore_db() {
    if [ -n "${PG_RESTORE_CMD:-}" ]; then bash -c "$PG_RESTORE_CMD"; return; fi
    compose exec -T postgres-postgis pg_restore -U "$DB_USER" -d mon50ccetmoi \
        --clean --if-exists --no-owner --single-transaction --exit-on-error
}
stop_api()  { [ -n "${PG_RESTORE_CMD:-}" ] || compose stop sovereign-api; }
start_api() { [ -n "${PG_RESTORE_CMD:-}" ] || compose start sovereign-api; }

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
if [ -f "$source_arg" ]; then
    file="$source_arg"
else
    log "Téléchargement de $source_arg"
    s3_backup "$work" get "$source_arg" "/backup/$source_arg"
    file="$work/$source_arg"
fi
[ -s "$file" ] || die "sauvegarde introuvable ou vide : $file"

log "Déchiffrement"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:BACKUP_PASSPHRASE \
    -in "$file" -out "$work/restore.dump" || die "déchiffrement impossible (mauvaise phrase ou fichier abîmé)"

log "Arrêt de l'API et restauration"
stop_api
trap 'start_api; rm -rf "$work"' EXIT
restore_db < "$work/restore.dump"
log "Base restaurée depuis $(basename "$file")."
