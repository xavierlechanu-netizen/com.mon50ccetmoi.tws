# Fonctions communes aux scripts de deploy/ (à « sourcer », pas à exécuter).
# shellcheck shell=bash

CORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$CORE_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$CORE_DIR/docker-compose.vps.yml}"

die() { echo "ERREUR : $*" >&2; exit 1; }
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Lit une variable du fichier .env sans l'exécuter (le fichier n'est jamais « sourcé »).
env_get() {
    local name="$1" line value
    [ -r "$ENV_FILE" ] || die "fichier $ENV_FILE introuvable"
    line="$(grep -E "^${name}=" "$ENV_FILE" | tail -n 1 || true)"
    value="${line#*=}"
    # Retire un commentaire de fin de ligne (« valeur   # note ») et les espaces.
    value="$(printf '%s' "$value" | sed -E 's/[[:space:]]+#.*$//; s/^[[:space:]]+//; s/[[:space:]]+$//')"
    # Retire les guillemets autour.
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    printf '%s' "$value"
}

compose() {
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# Lance backup-s3.js dans le conteneur de l'API, avec les identifiants des sauvegardes seulement.
# $1 = dossier de l'hôte monté sur /backup ; le reste = arguments du script.
s3_backup() {
    local dir="$1"; shift
    (
        export BACKUP_S3_BUCKET BACKUP_S3_ENDPOINT BACKUP_S3_REGION BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY
        BACKUP_S3_BUCKET="$(env_get BACKUP_S3_BUCKET)"
        BACKUP_S3_ENDPOINT="$(env_get BACKUP_S3_ENDPOINT)"
        BACKUP_S3_REGION="$(env_get BACKUP_S3_REGION)"
        BACKUP_S3_ACCESS_KEY_ID="$(env_get BACKUP_S3_ACCESS_KEY_ID)"
        BACKUP_S3_SECRET_ACCESS_KEY="$(env_get BACKUP_S3_SECRET_ACCESS_KEY)"
        # Même utilisateur que le script (root via cron) : les fichiers de sauvegarde sont en 600.
        compose run --rm --no-deps -T \
            --user "$(id -u):$(id -g)" \
            -v "$dir:/backup" \
            -e BACKUP_S3_BUCKET -e BACKUP_S3_ENDPOINT -e BACKUP_S3_REGION \
            -e BACKUP_S3_ACCESS_KEY_ID -e BACKUP_S3_SECRET_ACCESS_KEY \
            --entrypoint node sovereign-api scripts/backup-s3.js "$@"
    )
}
