# PilotManager

ERP/CRM pour ESN : gestion des clients, projets,
staffing des consultants, CRA, factures...

Ce dépôt contient l'**initialisation** du projet : architecture, authentification,
et un premier module complet (Clients) qui sert de modèle pour développer les
modules suivants (Projets, CRA, Factures, Recrutement...).

## Stack technique

| | |
|---|---|
| **Frontend** | React 19 + Vite + TypeScript + Tailwind CSS v4 + React Router + TanStack Query |
| **Backend** | Node.js + Express + TypeScript + Prisma |
| **Base de données** | PostgreSQL |
| **Auth** | JWT (access token, bcrypt pour les mots de passe) |

## Architecture

```
pilotmanager/
├── client/                  # Frontend React
│   ├── src/
│   │   ├── components/      # Layout, ProtectedRoute...
│   │   ├── context/         # AuthContext (état de connexion)
│   │   ├── pages/           # Login, Dashboard, Clients, Projets...
│   │   ├── services/        # Instance axios (api.ts)
│   │   └── types/           # Types TypeScript partagés
│   └── Dockerfile
│
├── server/                  # Backend Express
│   ├── prisma/
│   │   ├── schema.prisma    # Modèles de données
│   │   ├── migrations/      # Migrations SQL versionnées
│   │   └── seed.ts          # Crée un utilisateur admin de test
│   ├── src/
│   │   ├── config/          # env.ts, prisma.ts
│   │   ├── controllers/     # Logique métier (auth, clients...)
│   │   ├── middleware/      # auth.ts (JWT), errorHandler.ts
│   │   └── routes/          # Définition des routes Express
│   └── Dockerfile
│
├── docker-compose.yml        # Orchestre db + server + client
├── .dockerignore
└── package.json               # Workspace racine (scripts communs)
```

## Prérequis

- **Docker** + **Docker Compose** (méthode recommandée, aucune installation locale de Node/PostgreSQL requise)
- *Ou*, pour une installation manuelle : **Node.js** ≥ 18 et **PostgreSQL** ≥ 14

## Lancer avec Docker (recommandé)

Toute la stack (PostgreSQL + backend + frontend) tourne dans des conteneurs, avec
hot reload sur le code (les dossiers `client/` et `server/` sont montés en volume).

### 1. Configurer l'environnement

```bash
cp server/.env.example server/.env
```

Rien à modifier pour un premier lancement : `docker-compose.yml` surcharge automatiquement
`DATABASE_URL` et `CLIENT_URL` pour pointer vers les conteneurs.

### 2. Démarrer les conteneurs

```bash
docker compose up --build
```

Cela va :
- démarrer **PostgreSQL** (port `5432`, données persistées dans un volume Docker)
- construire et démarrer le **backend**, appliquer automatiquement les migrations Prisma, puis lancer le serveur en mode dev (port `4000`)
- construire et démarrer le **frontend** Vite en mode dev (port `5173`)

Au premier démarrage, le build des images (`npm ci` dans chaque conteneur) peut prendre
1 à 2 minutes. Les démarrages suivants seront quasi instantanés grâce au cache Docker.

### 3. Créer l'utilisateur de test

Une fois les conteneurs démarrés (attendre que les logs du service `server` affichent
`🚀 API démarrée`) :

```bash
docker compose exec server npm run seed
```

Puis rendez-vous sur **http://localhost:5173/login** :
- **email** : `admin@pilotmanager.local`
- **mot de passe** : `Admin1234!`

### Commandes Docker utiles

| Commande | Description |
|---|---|
| `docker compose up --build` | Démarre (et reconstruit si besoin) tous les services |
| `docker compose up -d` | Démarre en arrière-plan |
| `docker compose logs -f server` | Suit les logs du backend |
| `docker compose exec server sh` | Ouvre un shell dans le conteneur backend |
| `docker compose exec server npx prisma studio` | Ouvre Prisma Studio (accessible sur http://localhost:5555) |
| `docker compose down` | Arrête les conteneurs (garde les données) |
| `docker compose down -v` | Arrête et **supprime aussi la base de données** (repart de zéro) |

> 💡 Ce `docker-compose.yml` est orienté développement (hot reload, pas d'optimisation
> de taille d'image). Dites-moi si vous voulez aussi un `docker-compose.prod.yml` avec
> des images de production optimisées (multi-stage, build Vite statique servi par Nginx...).

---

## Installation manuelle (sans Docker)

### 1. Installer les dépendances

Depuis la racine du projet (npm workspaces installe client + serveur en une fois) :

```bash
npm install
```

### 2. Configurer la base de données

Copiez le fichier d'environnement du backend et renseignez votre URL PostgreSQL :

```bash
cp server/.env.example server/.env
```

Éditez `server/.env` :

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/pilotmanager?schema=public"
PORT=4000
JWT_SECRET="change-cette-valeur-en-production"
JWT_EXPIRES_IN="7d"
CLIENT_URL="http://localhost:5173"
```

> 💡 Si vous n'avez pas PostgreSQL en local, le plus rapide :
> `docker run --name pilotmanager-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pilotmanager -p 5432:5432 -d postgres:16`

### 3. Générer le client Prisma et appliquer les migrations

Une migration initiale est déjà versionnée dans `server/prisma/migrations/`,
il suffit de l'appliquer :

```bash
npm run prisma:generate
npm run prisma:deploy
```

### 4. Créer un utilisateur de test

```bash
npm run seed
```

Cela crée un compte administrateur :
- **email** : `admin@pilotmanager.local`
- **mot de passe** : `Admin1234!`

⚠️ Pensez à changer ce mot de passe ou à supprimer ce compte avant toute mise en production.

### 5. Lancer l'application

```bash
npm run dev
```

Cela démarre en parallèle :
- Le backend sur **http://localhost:4000** (API sur `/api`)
- Le frontend sur **http://localhost:5173**

Connectez-vous sur http://localhost:5173/login avec le compte admin créé à l'étape 4.

## Scripts disponibles (racine)

| Commande | Description |
|---|---|
| `npm run dev` | Lance backend + frontend en parallèle |
| `npm run dev:server` | Lance uniquement le backend |
| `npm run dev:client` | Lance uniquement le frontend |
| `npm run build` | Build de production (les deux packages) |
| `npm run prisma:migrate` | Applique les migrations Prisma |
| `npm run prisma:studio` | Ouvre Prisma Studio (interface visuelle de la DB) |
| `npm run seed` | Recrée l'utilisateur admin de test |

## État actuel du projet

✅ Fait :
- Authentification (register / login / me) avec JWT
- Modèles de données de base : `User`, `Client`, `Contact`, `Project`, `Assignment`
- Module **Clients** complet (liste + création, connecté à l'API)
- Layout applicatif (sidebar, navigation, routes protégées)

🚧 À développer ensuite (le schéma Prisma est déjà prêt à être étendu) :
- Module **Projets** (CRUD complet + affectation de consultants)
- **Staffing / planning** des ressources (utilise déjà le modèle `Assignment`)
- **CRA** (comptes-rendus d'activité / time tracking)
- **Notes de frais**
- **Facturation**
- **Recrutement** (candidats, pipeline)
- Gestion des rôles plus fine (permissions par module)
- Tests automatisés (backend : Jest/Vitest + Supertest, frontend : Vitest + Testing Library)

## Notes

- Le token JWT est stocké dans `localStorage` côté frontend. Pour une vraie mise en
  production, envisager des cookies `httpOnly` pour plus de sécurité contre le XSS.
- Le proxy Vite redirige automatiquement `/api/*` vers `http://localhost:4000` en dev
  (voir `client/vite.config.ts`), donc pas besoin de gérer CORS manuellement en développement.
