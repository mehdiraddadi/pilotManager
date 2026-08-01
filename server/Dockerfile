# Image de développement pour le backend (hot reload via bind mount + ts-node-dev)
FROM node:22-alpine

# Nécessaire pour bcryptjs/prisma sur Alpine
RUN apk add --no-cache libc6-compat openssl

WORKDIR /repo

# On copie tout le monorepo : nécessaire pour que `npm ci` (npm workspaces)
# résolve correctement les dépendances des deux packages.
COPY . .

RUN npm ci

WORKDIR /repo/server

# Génération explicite du client Prisma : le postinstall automatique de
# @prisma/client (déclenché par `npm ci` ci-dessus) s'exécute depuis la
# racine du monorepo et ne trouve donc pas server/prisma/schema.prisma.
# On le régénère ici avec le bon répertoire de travail.
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
