# ============================
# Frontend - Dockerfile (SECURE)
# ============================

# ---------- Stage 1 : Build ----------
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npm run build

# ---------- Stage 2 : Serveur Nginx ----------
FROM nginx:alpine

# Copier le build React vers nginx
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 3000

# Healthcheck Nginx
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]
