# Image du serveur souverain mon50ccetmoi (à construire depuis la racine du dépôt) :
#   docker build -f sovereign-core/Dockerfile -t mon50cc-api .
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app/sovereign-core

# Dépendances d'abord (mise en cache des couches Docker).
# npm ci installe exactement les versions figées dans package-lock.json (image reproductible,
# pas de nouvelle version d'une dépendance installée à l'insu du projet).
COPY sovereign-core/package.json sovereign-core/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Code du serveur + modules partagés de vérification (boîte noire, signature Revolut)
COPY sovereign-core/server ./server
COPY sovereign-core/db ./db
# Outils d'exploitation (sauvegardes vers l'Object Storage, lancés par deploy/backup.sh)
COPY sovereign-core/scripts ./scripts
COPY functions/api/blackbox-core.js functions/api/revolut-signature.js functions/api/points-rules.js /app/functions/api/

# Coffre WORM des preuves : appartient à l'utilisateur non privilégié
RUN mkdir -p /app/sovereign-core/worm_vault && chown -R node:node /app/sovereign-core/worm_vault
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/v1/health >/dev/null || exit 1
CMD ["node", "server/index.js"]
