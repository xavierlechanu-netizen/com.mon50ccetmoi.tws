#!/usr/bin/env bash
# ============================================================================
# Enregistre UNE clé secrète dans sovereign-core/.env, sans éditeur et sans l'afficher.
# Pour les clés que vous seul pouvez créer (Object Storage, SMS, Météo-France, Revolut) :
# on la colle dans le terminal du VPS, elle reste invisible, et elle n'est écrite que dans .env (root, 600).
# Ne jamais la coller ailleurs (e-mail, conversation, capture d'écran).
#
#   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh WORM_S3_ACCESS_KEY_ID
#   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh            (liste des noms acceptés)
#
# Remplace la valeur si le nom existe déjà dans .env, l'ajoute sinon. N'affiche que la longueur.
# ============================================================================
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

ALLOWED=(
    WORM_S3_ACCESS_KEY_ID WORM_S3_SECRET_ACCESS_KEY
    BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY
    OVH_SMS_APP_KEY OVH_SMS_APP_SECRET OVH_SMS_CONSUMER_KEY OVH_SMS_SERVICE OVH_SMS_SENDER
    METEO_FRANCE_API_KEY REVOLUT_WEBHOOK_SECRET ACME_EMAIL
)

name="${1:-}"
if [ -z "$name" ]; then
    echo "Usage : sudo $0 NOM"
    echo "Noms acceptés : ${ALLOWED[*]}"
    exit 1
fi

allowed=0
for n in "${ALLOWED[@]}"; do [ "$n" = "$name" ] && allowed=1; done
[ "$allowed" = 1 ] || die "« $name » n'est pas une clé à saisir ici. Noms acceptés : ${ALLOWED[*]}"
[ -f "$ENV_FILE" ] || die "fichier $ENV_FILE introuvable (lancez d'abord install.sh)"
[ -w "$ENV_FILE" ] || die "impossible d'écrire dans $ENV_FILE : relancez avec sudo"

if [ -t 0 ]; then
    read -r -s -p "Collez la valeur de $name (elle reste invisible), puis Entrée : " value
    echo
else
    IFS= read -r value || true
fi

# Retire un éventuel retour chariot (copier-coller depuis Windows) et les espaces autour.
value="$(printf '%s' "$value" | tr -d '\r' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
[ -n "$value" ] || die "valeur vide : rien n'est modifié"
# Caractères qui casseraient le fichier .env ou que Docker Compose interpréterait ($).
case "$value" in
    *[[:space:]]* | *\"* | *\'* | *'$'* | *'#'* | *'\'* | *'`'*)
        die "la valeur contient un espace, un guillemet ou un caractère spécial (\$ # \\ \`) : vérifiez le copier-coller" ;;
esac

tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
NAME="$name" VALUE="$value" awk '
    BEGIN { done = 0 }
    $0 ~ "^" ENVIRON["NAME"] "=" { if (!done) { print ENVIRON["NAME"] "=" ENVIRON["VALUE"]; done = 1 } ; next }
    { print }
    END { if (!done) print ENVIRON["NAME"] "=" ENVIRON["VALUE"] }
' "$ENV_FILE" > "$tmp"
# Réécrit le fichier existant (mêmes droits 600 et même propriétaire), sans jamais afficher la valeur.
cat "$tmp" > "$ENV_FILE"

echo "✅ $name enregistrée dans $ENV_FILE (${#value} caractères)."
