#!/usr/bin/env bash
# ============================================================================
# Bilan de santé du VPS mon50ccetmoi. Ne modifie RIEN : il regarde et il dit.
# À lancer après l'installation, puis de temps en temps :
#   sudo sovereign-core/deploy/check.sh
# Chaque ligne : ✅ en ordre, ⚠️  à surveiller, ❌ à corriger.
# Code de sortie 1 s'il y a au moins un ❌ (utilisable dans un script).
# ============================================================================
set -uo pipefail
# Jamais « commande | grep -q » ici : avec pipefail, grep -q s'arrête au premier résultat, la
# commande reçoit SIGPIPE en écrivant la suite et le test échoue au hasard (fausse alerte, ou pire,
# faux « en ordre »). On garde la sortie dans une variable, puis grep -q … <<<"$variable".
# (tests/vps-scripts-pipefail.test.js le vérifie.)

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root (sudo)"

failures=0
ok()   { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }
bad()  { echo "❌ $*"; failures=$((failures + 1)); }

# --- 1. Fichier .env ---------------------------------------------------------
domain=""
if [ -r "$ENV_FILE" ]; then
    mode="$(stat -c '%a' "$ENV_FILE")"
    if [ "$mode" = "600" ]; then
        ok ".env présent, lisible par root seulement"
    else
        bad ".env en $mode (attendu : 600) → sudo chmod 600 $ENV_FILE"
    fi
    for v in WORM_S3_ACCESS_KEY_ID WORM_S3_SECRET_ACCESS_KEY BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY; do
        [ -n "$(env_get "$v")" ] || bad "$v vide dans .env (clés de l'Object Storage, deploy/README.md étape 1)"
    done
    if [ -n "$(env_get OVH_SMS_APP_KEY)" ]; then
        ok "SMS d'urgence configurés (alerte SOS)"
    else
        warn "SMS d'urgence non configurés : l'alerte SOS ne peut pas prévenir les proches (deploy/README.md, étape 9)"
    fi
    meteo_key="$(env_get METEO_FRANCE_API_KEY)"
    [ -n "$meteo_key" ] || warn "vigilance Météo-France non configurée : pas de bandeau « vigilance rouge » dans l'appli (deploy/README.md, étape 9 bis)"
    domain="$(env_get API_DOMAIN)"
else
    bad ".env introuvable ($ENV_FILE) → sudo sovereign-core/deploy/install.sh"
fi

# --- 2. Conteneurs -------------------------------------------------------------
for svc in postgres-postgis sovereign-api caddy; do
    state="$(compose ps --format '{{.State}} {{.Health}}' "$svc" 2>/dev/null | head -n 1)"
    case "$state" in
        "running healthy"|"running ") ok "conteneur $svc : en marche" ;;
        running*)                     warn "conteneur $svc : $state (démarrage en cours ?)" ;;
        *)                            bad "conteneur $svc : ${state:-arrêté} → cd $CORE_DIR && sudo docker compose -f docker-compose.vps.yml up -d" ;;
    esac
done

# --- 3. API publique : DNS, certificat HTTPS, réponse ---------------------------
if [ -n "$domain" ]; then
    if body="$(curl -fsS --max-time 15 "https://$domain/api/v1/health" 2>&1)" && grep -q '"status":"OK"' <<<"$body"; then
        ok "API joignable en HTTPS : https://$domain/api/v1/health"
    else
        bad "API injoignable sur https://$domain (DNS, certificat ou API) : ${body:0:160}"
    fi
    if [ -n "${meteo_key:-}" ]; then
        meteo="$(curl -fsS --max-time 20 "https://$domain/api/v1/meteo/vigilance" 2>/dev/null)"
        case "$meteo" in
            *'"fallback":true'*) warn "vigilance Météo-France : aucune carte (clé refusée ou Météo-France muet) → sudo docker compose -f $COMPOSE_FILE logs sovereign-api | grep Meteo" ;;
            *'"stale":true'*)    warn "vigilance Météo-France : Météo-France ne répond plus, ancienne carte servie" ;;
            *'"product"'*)       ok "vigilance Météo-France : carte du jour reçue" ;;
            *)                   warn "vigilance Météo-France : réponse inattendue de l'API" ;;
        esac
    fi
fi

# --- 3 bis. Le site ----------------------------------------------------------------
site_domain="$( [ -r "$ENV_FILE" ] && env_get SITE_DOMAIN || true )"
site_root="$( [ -r "$ENV_FILE" ] && env_get SITE_ROOT || true )"
site_root="${site_root:-/srv/mon50cc/site}"
if [ ! -e "$site_root/current/index.html" ]; then
    warn "site pas encore publié sur le VPS → sudo $CORE_DIR/deploy/publish-site.sh"
elif [ -n "$site_domain" ]; then
    if curl -fsS --max-time 15 -o /dev/null "https://$site_domain/app"; then
        ok "site en ligne depuis le VPS : https://$site_domain (version $(readlink "$site_root/current" | sed 's|releases/||'))"
    else
        bad "site injoignable sur https://$site_domain (DNS chez Amen.fr ou certificat HTTPS)"
    fi
elif compose exec -T caddy wget -qO /dev/null http://127.0.0.1:8081/app 2>/dev/null; then
    ok "site publié, prêt à l'intérieur du VPS (SITE_DOMAIN vide : le public voit encore l'ancien hébergement)"
else
    bad "site publié mais Caddy ne le sert pas → sudo docker compose -f $COMPOSE_FILE logs caddy"
fi

# --- 3 ter. Comptes importés de Firebase ------------------------------------------
db_user="$( [ -r "$ENV_FILE" ] && env_get DB_USER || true )"
pending="$(compose exec -T postgres-postgis psql -U "${db_user:-mon50cc_admin}" -d mon50ccetmoi -tAc \
    "SELECT count(*) FROM users WHERE password_hash LIKE 'firebase-scrypt\$%'" 2>/dev/null | tr -dc '0-9')"
if [ "${pending:-0}" -gt 0 ]; then
    if [ -n "$( [ -r "$ENV_FILE" ] && env_get FIREBASE_SCRYPT_SIGNER_KEY || true )" ]; then
        ok "$pending compte(s) Firebase pas encore reconnecté(s) (paramètres de hachage présents)"
    else
        bad "$pending compte(s) importé(s) de Firebase ne peuvent pas se connecter : FIREBASE_SCRYPT_* vides dans .env (README, étape 11)"
    fi
fi

# --- 4. La base n'est pas exposée sur Internet --------------------------------
if ! port_5432="$(ss -ltnH 'sport = :5432' 2>&1)"; then
    warn "impossible de vérifier le port 5432 (ss a échoué) : ${port_5432:0:120}"
elif [ -n "$port_5432" ]; then
    bad "un service écoute sur le port 5432 de l'hôte : la base ne doit jamais être exposée"
else
    ok "base PostgreSQL non exposée (aucun port 5432 ouvert sur le serveur)"
fi

# --- 5. Pare-feu et SSH --------------------------------------------------------
ufw_status="$(ufw status 2>/dev/null)"
if grep -qiE '^(status|état) *: *(active|actif)' <<<"$ufw_status"; then
    ok "pare-feu actif (SSH, HTTP et HTTPS seulement)"
else
    bad "pare-feu inactif → sudo ufw --force enable"
fi
sshd_config="$(sshd -T 2>/dev/null)"
if grep -qi '^passwordauthentication no' <<<"$sshd_config"; then
    ok "SSH : connexion par clé uniquement"
else
    warn "SSH : connexion par mot de passe encore possible (deploy/README.md, étape 3)"
fi

# --- 6. Sauvegardes ------------------------------------------------------------
if [ -f /etc/cron.d/mon50cc-backup ]; then
    ok "sauvegarde nocturne programmée (3 h 30)"
else
    bad "sauvegarde nocturne non programmée → sudo sovereign-core/deploy/install.sh"
fi
last="$(find /var/backups/mon50cc -maxdepth 1 -name 'mon50cc-*.dump.enc' -mmin -1560 2>/dev/null | sort | tail -n 1)"
if [ -n "$last" ]; then
    ok "sauvegarde de moins de 26 h : $(basename "$last")"
else
    warn "aucune sauvegarde de moins de 26 h (normal le premier jour) → sudo sovereign-core/deploy/backup.sh"
fi
if [ -f /var/log/mon50cc-backup.log ]; then
    last_backup_status="$(tail -n 50 /var/log/mon50cc-backup.log | grep -E 'Terminé\.|ERREUR' | tail -n 1)"
    if grep -q 'ERREUR' <<<"$last_backup_status"; then
        bad "la dernière sauvegarde a échoué → sudo tail -n 30 /var/log/mon50cc-backup.log"
    fi
fi

# --- 6 bis. Mise à jour automatique du site, API à jour ------------------------
if [ -f /etc/cron.d/mon50cc-auto-update ]; then
    ok "mise à jour automatique du site programmée (toutes les 5 minutes depuis main)"
else
    warn "mise à jour automatique du site non programmée → sudo sovereign-core/deploy/install.sh"
fi
if [ -f /var/log/mon50cc-auto-update.log ]; then
    last_update_status="$(tail -n 50 /var/log/mon50cc-auto-update.log | grep -E 'Terminé\.|ERREUR' | tail -n 1)"
    if grep -q 'ERREUR' <<<"$last_update_status"; then
        bad "la dernière mise à jour automatique a échoué → sudo tail -n 20 /var/log/mon50cc-auto-update.log"
    fi
fi
# L'API n'est pas reconstruite automatiquement : son code a-t-il changé depuis la construction de l'image ?
repo_dir="$(cd "$CORE_DIR/.." && pwd)"
api_code_ts="$(git -c safe.directory="$repo_dir" -C "$repo_dir" log -1 --format=%ct -- \
    sovereign-core/server sovereign-core/db sovereign-core/Dockerfile sovereign-core/package.json \
    sovereign-core/package-lock.json sovereign-core/scripts 2>/dev/null || true)"
api_image_date="$(docker image inspect -f '{{.Created}}' mon50cc-sovereign-api 2>/dev/null || true)"
api_image_ts="$( [ -n "$api_image_date" ] && date -d "$api_image_date" +%s 2>/dev/null || true)"
if [ -n "$api_code_ts" ] && [ -n "$api_image_ts" ]; then
    if [ "$api_code_ts" -gt "$api_image_ts" ]; then
        warn "API pas à jour : son code a changé depuis sa construction → cd $CORE_DIR && sudo docker compose -f $COMPOSE_FILE up -d --build"
    else
        ok "API construite avec le dernier code du serveur"
    fi
fi

# --- 7. Disque, mises à jour, redémarrage ---------------------------------------
use="$(df --output=pcent / | tail -n 1 | tr -dc '0-9')"
if [ "${use:-0}" -lt 80 ]; then
    ok "disque utilisé à ${use} %"
else
    warn "disque utilisé à ${use} % → faire de la place (vieilles images : sudo docker image prune -a)"
fi
if grep -qs 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades; then
    ok "mises à jour de sécurité automatiques"
else
    warn "mises à jour de sécurité automatiques non configurées"
fi
if [ -f /var/run/reboot-required ]; then
    warn "une mise à jour demande un redémarrage → sudo reboot (les services repartent seuls)"
fi

echo
if [ "$failures" -eq 0 ]; then
    echo "Bilan : tout est en ordre."
    exit 0
fi
echo "Bilan : $failures point(s) à corriger."
exit 1
