#!/usr/bin/env bash
# ============================================================================
# Préparation d'un VPS OVHcloud neuf (Ubuntu 24.04 / 26.04 ou Debian 12 / 13) pour mon50ccetmoi.
# À lancer en root, depuis le dépôt cloné (on peut le relancer sans risque) :
#   sudo sovereign-core/deploy/install.sh
#
# Ce que fait le script :
#   - installe Docker (dépôt officiel, sinon paquets de la distribution) et git
#   - pare-feu : seuls SSH, HTTP et HTTPS entrent
#   - SSH : connexion par clé uniquement, SI une clé est déjà installée (sinon, rien ne change)
#   - mises à jour de sécurité automatiques
#   - 2 Go de swap si le serveur n'en a pas
#   - crée sovereign-core/.env avec des secrets neufs (mot de passe de la base,
#     clés JWT, phrase de chiffrement des sauvegardes) — jamais écrasé s'il existe
#   - programme la sauvegarde chaque nuit à 3 h 30
# Il ne démarre rien : il reste à compléter .env (clés S3, domaine), voir deploy/README.md.
# ============================================================================
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root (sudo)"
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in
    debian|ubuntu) ;;
    *) die "système non prévu : ${PRETTY_NAME:-inconnu} (Ubuntu ou Debian attendu)" ;;
esac
export DEBIAN_FRONTEND=noninteractive

log "1/7 Paquets de base"
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git openssl ufw unattended-upgrades cron

log "2/7 Docker"
if ! command -v docker >/dev/null 2>&1; then
    # Dépôt officiel de Docker s'il connaît déjà cette version du système (${VERSION_CODENAME}) ;
    # sinon (version très récente), paquets de la distribution, un peu moins à jour.
    if curl -fsSL -o /dev/null "https://download.docker.com/linux/${ID}/dists/${VERSION_CODENAME}/Release"; then
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
            > /etc/apt/sources.list.d/docker.list
        apt-get update -q
        apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
        log "Dépôt Docker pas encore prêt pour ${PRETTY_NAME:-ce système} : paquets de la distribution."
        apt-get install -y -q docker.io
        apt-get install -y -q docker-compose-v2 || apt-get install -y -q docker-compose
    fi
fi
systemctl enable --now docker
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 introuvable (commande « docker compose »)"

log "3/7 Pare-feu (SSH, HTTP, HTTPS seulement)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
# Note : Docker ouvre lui-même les ports qu'il publie. Seul Caddy en publie (80 et 443) ;
# la base et l'API n'en publient aucun (voir docker-compose.vps.yml).

log "4/7 SSH : connexion par clé uniquement"
# Seulement si l'administrateur a déjà une clé installée : sans elle, couper les mots de passe
# l'enfermerait dehors. Le fichier « 10-… » passe avant « 50-cloud-init.conf » des images cloud
# (pour sshd, la première valeur lue l'emporte).
admin_user="${SUDO_USER:-root}"
admin_home="$(getent passwd "$admin_user" | cut -d: -f6)"
ssh_conf=/etc/ssh/sshd_config.d/10-mon50cc.conf
if grep -qsE '^[[:space:]]*(ssh-(ed25519|rsa)|ecdsa-sha2-|sk-)' "$admin_home/.ssh/authorized_keys"; then
    cat > "$ssh_conf" <<'EOF'
# mon50ccetmoi (deploy/install.sh) : connexion SSH par clé uniquement
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
    if sshd -t; then
        systemctl reload ssh 2>/dev/null || systemctl reload sshd
        log "SSH : mots de passe refusés désormais ; la clé de « $admin_user » reste valable."
    else
        rm -f "$ssh_conf"
        log "ATTENTION : sshd refuse cette configuration, SSH n'est pas modifié."
    fi
else
    log "ATTENTION : aucune clé SSH pour « $admin_user » : la connexion par mot de passe reste ouverte."
    log "            Installez votre clé (deploy/README.md, étape 3), puis relancez ce script."
fi

log "5/7 Mises à jour de sécurité automatiques"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

log "6/7 Swap"
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "7/7 Fichier .env et sauvegarde nocturne"
if [ -e "$ENV_FILE" ]; then
    log "$ENV_FILE existe déjà : laissé tel quel."
else
    "$CORE_DIR/deploy/make-env.sh"
fi

cat > /etc/cron.d/mon50cc-backup <<EOF
# Sauvegarde chiffrée de la base mon50ccetmoi, chaque nuit à 3 h 30
30 3 * * * root $CORE_DIR/deploy/backup.sh >> /var/log/mon50cc-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/mon50cc-backup

log "Préparation terminée. Étapes suivantes : deploy/README.md (compléter .env, DNS, démarrage)."
