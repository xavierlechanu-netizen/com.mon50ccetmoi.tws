#!/usr/bin/env bash
# ============================================================================
# Publie le site (mon50ccetmoi.com) sur le VPS, servi par Caddy.
#   sudo /opt/mon50cc/sovereign-core/deploy/publish-site.sh
#
# 1. Construit le site (npm run build) dans un conteneur Node jetable : rien à installer sur le VPS.
#    Seul ce qui est enregistré dans git est publié (les fichiers modifiés à la main sont ignorés).
# 2. Range la version dans $SITE_ROOT/releases/<date>/ puis bascule « current » dessus d'un seul
#    coup : les visiteurs ne voient jamais un site à moitié copié.
# 3. Garde les 3 dernières versions. Revenir à la précédente : sudo .../publish-site.sh --rollback
# ============================================================================
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=lib.sh
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root (sudo)"
command -v docker >/dev/null || die "Docker absent → sudo sovereign-core/deploy/install.sh"

REPO_DIR="$(cd "$CORE_DIR/.." && pwd)"
SITE_ROOT="$( [ -r "$ENV_FILE" ] && env_get SITE_ROOT || true )"
SITE_ROOT="${SITE_ROOT:-/srv/mon50cc/site}"
KEEP=3
NODE_IMAGE="node:22-alpine"

# Bascule atomique du lien « current » (relatif, pour être valable aussi dans le conteneur Caddy).
switch_to() {
    ln -sfn "releases/$1" "$SITE_ROOT/current.tmp"
    mv -Tf "$SITE_ROOT/current.tmp" "$SITE_ROOT/current"
}

if [ "${1:-}" = "--rollback" ]; then
    now="$(readlink "$SITE_ROOT/current" 2>/dev/null || true)"
    now="${now#releases/}"
    prev="$(find "$SITE_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | grep -B1 -x -- "$now" | head -n 1 || true)"
    [ -n "$prev" ] && [ "$prev" != "$now" ] || die "aucune version précédente à remettre (actuelle : ${now:-aucune})"
    switch_to "$prev"
    log "Site revenu à la version $prev (au lieu de $now)."
    exit 0
fi

stamp="$(date '+%Y%m%d-%H%M%S')"
work="$(mktemp -d /tmp/mon50cc-site.XXXXXX)"
cleanup() { [ -n "${work:-}" ] && [ -d "$work" ] && rm -rf -- "$work"; }
trap cleanup EXIT

log "Copie de la version enregistrée dans git ($(git -C "$REPO_DIR" log -1 --format='%h %s'))"
mkdir -p "$work/src"
git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" archive HEAD | tar -x -C "$work/src"

log "Construction du site dans un conteneur $NODE_IMAGE (quelques minutes)"
docker run --rm -v "$work/src:/app" -w /app "$NODE_IMAGE" \
    sh -c 'npm ci --no-audit --no-fund --loglevel=error && npm run build' \
    || die "la construction a échoué : le site en ligne n'a pas changé"

for page in index.html app.html 404.html sw.js; do
    [ -s "$work/src/dist/$page" ] || die "construction incomplète ($page manquant) : le site en ligne n'a pas changé"
done

mkdir -p "$SITE_ROOT/releases"
cp -a "$work/src/dist" "$SITE_ROOT/releases/$stamp"
chmod -R a+rX "$SITE_ROOT/releases/$stamp"
switch_to "$stamp"
log "Site publié : version $stamp"

# Ménage : on garde les $KEEP versions les plus récentes (dont celle en ligne).
find "$SITE_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +$((KEEP + 1)) \
    | while read -r old; do rm -rf -- "${SITE_ROOT:?}/releases/$old"; done

log "Terminé. Vérification : sudo $CORE_DIR/deploy/check.sh"
