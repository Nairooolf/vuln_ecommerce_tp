# ============================
# Backend - Dockerfile (SECURE)
# ============================

FROM node:18-alpine AS build

WORKDIR /app

# Installer uniquement les dépendances nécessaires
COPY package*.json ./
RUN npm install --omit=dev

# Copier le code backend
COPY . .

# Créer un utilisateur non-root
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup
USER nodeuser

EXPOSE 5001

# Healthcheck API
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5001/health || exit 1

CMD ["node", "server.js"]
