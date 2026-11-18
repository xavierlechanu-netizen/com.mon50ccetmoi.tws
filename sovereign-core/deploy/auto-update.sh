#!/usr/bin/env bash
# ============================================================================
# Mise à jour automatique du site depuis la branche main (lancé toutes les 5 minutes par cron,
# programmé par install.sh : /etc/cron.d/mon50cc-auto-update).
#
#   sudo /opt/mon50cc/sovereign-core/deploy/auto-update.sh      (à la main : même effet)
#
# - Rien de nouveau sur main : ne fait rien et n'écrit rien (journal léger).
# - Du nouveau : avance le dépôt du VPS (avance rapide seulement, jamais de fusion ni d'écrasement),
#   puis republie le site (publish-site.sh : construction dans un conteneur, bascule d'un seul coup ;
#   si la construction échoue, le site en ligne ne change pas).
# - L'API n'est PAS reconstruite automatiquement (elle sert les alertes SOS) : si le code du serveur
#   a changé, le journal et check.sh le signalent, et on la reconstruit à la main.
# - Modifications locales ou historique divergent sur le VPS : refuse et l'écrit dans le journal.
# Journal : /var/log/mon50cc-auto-update.log
# ============================================================================
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

# Points d'entrée pour les tests (tests/vps-auto-update.test.js) ; valeurs normales sinon.
REPO_DIR="${AUTO_UPDATE_REPO:-$(cd "$CORE_DIR/.." && pwd)}"
BRANCH="${AUTO_UPDATE_BRANCH:-main}"
PUBLISH_CMD="${AUTO_UPDATE_PUBLISH_CMD:-$CORE_DIR/deploy/publish-site.sh}"
LOCK_FILE="${AUTO_UPDATE_LOCK:-/run/lock/mon50cc-auto-update.lock}"

[ "$(id -u)" -eq 0 ] || [ -n "${AUTO_UPDATE_REPO:-}" ] || die "lancez ce script en root (sudo)"

# Une seule mise à jour à la fois (la construction du site peut durer plus de 5 minutes).
if command -v flock >/dev/null; then
    exec 9>"$LOCK_FILE"
    flock -n 9 || exit 0
fi

# Erreur datée dans le journal (cron), puis arrêt.
fail() { log "ERREUR : $*" >&2; exit 1; }

g() { git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" "$@"; }

g fetch --quiet origin "$BRANCH" || fail "impossible de joindre le dépôt (réseau ?) : rien n'a changé"
avant="$(g rev-parse HEAD)"
apres="$(g rev-parse "origin/$BRANCH")"
[ "$avant" = "$apres" ] && exit 0

if ! g diff --quiet || ! g diff --cached --quiet; then
    fail "le dépôt du VPS a des modifications locales : mise à jour refusée (sudo git -C $REPO_DIR status)"
fi
g merge --quiet --ff-only "origin/$BRANCH" \
    || fail "le dépôt du VPS a divergé de $BRANCH : mise à jour refusée (sudo git -C $REPO_DIR log --oneline -3)"

log "Mise à jour ${avant:0:7} → ${apres:0:7} : $(g log -1 --format=%s)"
changes="$(g diff --name-only "$avant" "$apres")"

"$PUBLISH_CMD" || fail "publication du site échouée : le site en ligne n'a pas changé (sudo $CORE_DIR/deploy/publish-site.sh --rollback si besoin)"

if grep -qE '^sovereign-core/(server/|db/|Dockerfile|package(-lock)?\.json|scripts/)' <<<"$changes"; then
    log "⚠️  Le code de l'API a changé : à reconstruire à la main → cd $CORE_DIR && sudo docker compose -f docker-compose.vps.yml up -d --build"
fi
log "Terminé."
