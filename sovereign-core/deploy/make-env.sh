#!/usr/bin/env bash
# ============================================================================
# Crée sovereign-core/.env à partir de deploy/env.vps.example, avec des secrets neufs :
# mot de passe de la base, paire de clés JWT ES256, phrase de chiffrement des sauvegardes.
# Les clés que vous seul pouvez créer restent vides, à coller vous-même dans .env (deploy/README.md) :
# Object Storage (WORM_S3_*, BACKUP_S3_*), SMS (OVH_SMS_*), vigilance Météo-France (METEO_FRANCE_API_KEY).
# N'écrase jamais un .env existant. Appelé par install.sh ; utilisable seul :
#   sovereign-core/deploy/make-env.sh            (ENV_FILE=... pour un autre chemin)
# Affiche la phrase de chiffrement sur la sortie standard, à recopier tout de suite.
# ============================================================================
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

[ ! -e "$ENV_FILE" ] || die "$ENV_FILE existe déjà : rien n'est modifié"
command -v openssl >/dev/null || die "openssl est requis"

tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT
openssl ecparam -name prime256v1 -genkey -noout -out "$tmpdir/ec.pem"
openssl pkcs8 -topk8 -nocrypt -in "$tmpdir/ec.pem" -out "$tmpdir/priv.pem"
openssl ec -in "$tmpdir/ec.pem" -pubout -out "$tmpdir/pub.pem" 2>/dev/null

# Clé PEM sur une seule ligne, retours à la ligne écrits « \n » (l'API les remet).
# Les « \r » sont retirés : certains openssl (Windows) écrivent des fins de ligne CRLF.
oneline() { tr -d '\r' < "$1" | awk 'BEGIN { ORS = "\\n" } { print }' | sed 's/\\n$//'; }
# Secret aléatoire sur une ligne, sans fin de ligne parasite.
secret() { openssl rand "$@" | tr -d '\r\n'; }

# Les valeurs passent par l'environnement (ENVIRON) et non par « awk -v » :
# « -v » interpréterait les « \n » et casserait les clés.
umask 077
MK_DBPASS="$(secret -hex 24)" \
MK_PRIV="$(oneline "$tmpdir/priv.pem")" \
MK_PUB="$(oneline "$tmpdir/pub.pem")" \
MK_PASSPHRASE="$(secret -base64 33)" \
awk '
    /^DB_PASSWORD=/               { print "DB_PASSWORD=" ENVIRON["MK_DBPASS"]; next }
    /^SOVEREIGN_JWT_PRIVATE_KEY=/ { print "SOVEREIGN_JWT_PRIVATE_KEY=\047" ENVIRON["MK_PRIV"] "\047"; next }
    /^SOVEREIGN_JWT_PUBLIC_KEY=/  { print "SOVEREIGN_JWT_PUBLIC_KEY=\047" ENVIRON["MK_PUB"] "\047"; next }
    /^BACKUP_PASSPHRASE=/         { print "BACKUP_PASSPHRASE=" ENVIRON["MK_PASSPHRASE"]; next }
    { print }
' "$CORE_DIR/deploy/env.vps.example" > "$tmpdir/env"

# Contrôle : chaque secret est bien sur une seule ligne et rempli.
for v in DB_PASSWORD SOVEREIGN_JWT_PRIVATE_KEY SOVEREIGN_JWT_PUBLIC_KEY BACKUP_PASSPHRASE; do
    [ "$(grep -c "^$v=" "$tmpdir/env")" -eq 1 ] || die "génération de $v ratée"
    ENV_FILE="$tmpdir/env" env_get "$v" | grep -q . || die "$v vide"
done
grep -q '^-----' "$tmpdir/env" && die "une clé s'est répartie sur plusieurs lignes"

install -m 600 "$tmpdir/env" "$ENV_FILE"
log "$ENV_FILE créé avec des secrets neufs."
echo
echo "  >>> Recopiez MAINTENANT cette phrase dans un gestionnaire de mots de passe."
echo "  >>> Sans elle, aucune sauvegarde ne pourra être relue :"
echo
echo "      $(ENV_FILE="$ENV_FILE" env_get BACKUP_PASSPHRASE)"
echo
