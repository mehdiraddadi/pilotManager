# Image de développement pour le frontend (hot reload via bind mount + Vite dev server)
FROM node:22-alpine

WORKDIR /repo

# Voir server/Dockerfile pour l'explication du COPY complet du monorepo
COPY . .

RUN npm ci

WORKDIR /repo/client

EXPOSE 5173

CMD ["npm", "run", "dev"]
