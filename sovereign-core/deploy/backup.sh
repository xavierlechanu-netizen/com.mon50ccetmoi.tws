#!/usr/bin/env bash
# ============================================================================
# Sauvegarde chiffrée de la base PostgreSQL (lancée chaque nuit par cron, voir install.sh).
#   1. pg_dump (format custom) dans le conteneur de la base
#   2. chiffrement AES-256 (openssl, clé dérivée de BACKUP_PASSPHRASE par PBKDF2)
#   3. vérification : la sauvegarde se déchiffre et se relit (pg_restore --list)
#   4. copie locale (7 jours) + envoi dans l'Object Storage (BACKUP_RETENTION_DAYS jours)
#
# Usage : sudo deploy/backup.sh
# Les preuves de la Boîte Noire ne sont pas concernées : elles sont déjà dans le coffre
# Object Lock et ne peuvent être ni modifiées ni supprimées.
# ============================================================================
set -euo pipefail
umask 077

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mon50cc}"
LOCAL_KEEP_DAYS="${LOCAL_KEEP_DAYS:-7}"

BACKUP_PASSPHRASE="$(env_get BACKUP_PASSPHRASE)"
[ "${#BACKUP_PASSPHRASE}" -ge 20 ] || die "BACKUP_PASSPHRASE absente ou trop courte dans $ENV_FILE"
export BACKUP_PASSPHRASE
DB_USER="$(env_get DB_USER)"; DB_USER="${DB_USER:-mon50cc_admin}"

# Points d'entrée remplaçables par les tests (base PostgreSQL locale au lieu de Docker).
dump_db() {
    if [ -n "${PG_DUMP_CMD:-}" ]; then bash -c "$PG_DUMP_CMD"; return; fi
    compose exec -T postgres-postgis pg_dump -U "$DB_USER" -d mon50ccetmoi -Fc
}
list_dump() {
    if [ -n "${PG_LIST_CMD:-}" ]; then bash -c "$PG_LIST_CMD"; return; fi
    compose exec -T postgres-postgis pg_restore --list
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
name="mon50cc-$(date -u '+%Y%m%d-%H%M%S').dump.enc"
tmp="$BACKUP_DIR/.$name.part"
trap 'rm -f "$tmp"' EXIT

log "Sauvegarde de la base → $name"
dump_db | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -salt -pass env:BACKUP_PASSPHRASE -out "$tmp"

log "Vérification (déchiffrement et relecture)"
entries="$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:BACKUP_PASSPHRASE -in "$tmp" | list_dump | grep -c 'TABLE DATA' || true)"
[ "${entries:-0}" -gt 0 ] || die "la sauvegarde ne se relit pas (aucune table trouvée) : rien n'est envoyé"
mv "$tmp" "$BACKUP_DIR/$name"
trap - EXIT
log "OK : $entries tables, $(du -h "$BACKUP_DIR/$name" | cut -f1)"

find "$BACKUP_DIR" -maxdepth 1 -name 'mon50cc-*.dump.enc' -mtime +"$LOCAL_KEEP_DAYS" -delete

if [ -n "$(env_get BACKUP_S3_BUCKET)" ] && [ -z "${SKIP_UPLOAD:-}" ]; then
    log "Envoi dans l'Object Storage"
    s3_backup "$BACKUP_DIR" put "/backup/$name"
    retention="$(env_get BACKUP_RETENTION_DAYS)"
    s3_backup "$BACKUP_DIR" prune "${retention:-30}"
else
    log "ATTENTION : BACKUP_S3_BUCKET vide, la sauvegarde reste seulement sur ce serveur."
fi
log "Terminé."
