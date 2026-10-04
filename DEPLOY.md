# Déploiement en production sur IONOS

Ce guide déploie PilotManager **à côté** de votre site PHP existant dans
`/var/www/`, sans y toucher. PilotManager tourne dans ses propres conteneurs
Docker et n'est accessible que sur un port dédié (`http://VOTRE_IP:8080` par
défaut) — Apache/PHP continue de servir le port 80/443 comme avant.

> ⚠️ Vous n'avez pas encore de nom de domaine : le site sera accessible en
> **HTTP simple** (pas de HTTPS) via l'IP du serveur. Comme l'app gère des
> mots de passe et un token JWT, évitez d'y mettre des données sensibles
> réelles tant que le HTTPS n'est pas en place, et envisagez de restreindre
> l'accès au port par IP source (voir section Sécurité en bas).

## 1. Transférer le projet sur le serveur

Depuis votre machine, connectez-vous en SSH au serveur IONOS, puis clonez le
dépôt à un endroit **différent** de `/var/www/<site-php>` (ne mélangez pas les
deux projets) :

```bash
ssh votre_user@VOTRE_IP
cd /opt   # ou ~/apps, peu importe, hors de /var/www
git clone git@github.com:mehdiraddadi/pilotManager.git
cd pilotManager
```

Si le dépôt GitHub est privé et que vous n'avez pas de clé SSH configurée sur
le serveur, alternative simple depuis votre machine locale :

```bash
rsync -avz --exclude node_modules --exclude .git \
  /home/mradadi/homework/pilotManager/ votre_user@VOTRE_IP:/opt/pilotManager/
```

## 2. Configurer les variables d'environnement

Sur le serveur, dans `/opt/pilotManager` :

```bash
cp .env.prod.example .env.prod
cp server/.env.production.example server/.env.production
```

Éditez **`.env.prod`** (identifiants Postgres + port public) :

```env
POSTGRES_USER=pilotmanager
POSTGRES_PASSWORD=<mot de passe fort, ex: openssl rand -base64 24>
POSTGRES_DB=pilotmanager
CLIENT_PORT=8080
```

Éditez **`server/.env.production`** :
- `JWT_SECRET` : générez une vraie valeur avec `openssl rand -base64 48`
- `CLIENT_URL` : `http://VOTRE_IP:8080` (le port doit correspondre à
  `CLIENT_PORT` ci-dessus)
- `SMTP_FROM` : adresse d'expéditeur affichée. L'hôte et le port SMTP sont
  imposés par `docker-compose.prod.yml` (conteneur MailCatcher, voir plus bas)

Ces deux fichiers contiennent des secrets : ils sont dans `.gitignore`, ne
les committez jamais.

## 3. Ouvrir le port sur le firewall

Deux endroits à vérifier (souvent les deux sur un VPS IONOS) :

```bash
# Firewall du système (ufw, si actif)
sudo ufw allow 8080/tcp
```

Et si votre serveur IONOS a un firewall géré depuis le Cloud Panel / DCD
(Data Center Designer), ajoutez-y aussi une règle entrante TCP sur le port
8080 — sinon le port restera bloqué même avec `ufw` ouvert.

## 4. Build et démarrage

```bash
./deploy.sh
```

Ce script build les images de prod (`docker-compose.prod.yml`) et démarre 4
conteneurs isolés de tout autre projet Docker sur la machine :
- `pilotmanager-prod-db` (Postgres, pas de port exposé sur l'hôte)
- `pilotmanager-prod-server` (API Node, pas de port exposé — uniquement
  joignable par le conteneur client, en interne)
- `pilotmanager-prod-client` (Nginx : sert le build React + proxy `/api`
  vers le serveur) — seul conteneur exposé publiquement, sur le port `CLIENT_PORT`
- `pilotmanager-prod-mailcatcher` (capture les emails envoyés par l'API) —
  interface web sur `127.0.0.1:MAILCATCHER_PORT` uniquement

Les migrations Prisma sont appliquées automatiquement à chaque démarrage du
conteneur serveur.

## 5. Créer le compte administrateur (premier déploiement uniquement)

Il n'y a pas de page d'inscription publique : le premier compte se crée via :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec server npm run seed
```

Identifiants créés :
- email : `admin@boondclone.local`
- mot de passe : `Admin1234!`

⚠️ Connectez-vous immédiatement et changez ce mot de passe (ou modifiez
`server/prisma/seed.ts` avant de seed si vous préférez un autre compte).

## 6. Vérifier

```bash
curl http://localhost:8080/api/health
```

Doit répondre `{"status":"ok",...}`. Puis ouvrez `http://VOTRE_IP:8080` dans
un navigateur — vous devez arriver sur la page de login.

Vérifiez aussi que votre site PHP existant répond toujours normalement sur
son port habituel (80/443) : ces conteneurs ne le touchent pas.

## Emails (MailCatcher)

Aucun email n'est réellement délivré : MailCatcher les capture tous (liens de
confirmation d'inscription, envois de factures...). Pour les consulter depuis
votre machine, ouvrez un tunnel SSH :

```bash
ssh -L 1080:127.0.0.1:1080 votre_user@VOTRE_IP
```

puis ouvrez `http://localhost:1080` dans votre navigateur. Ne publiez pas ce
port dans le firewall : n'importe qui pourrait y lire les liens de
confirmation et activer des comptes.

Conséquence : un utilisateur qui s'inscrit ne reçoit pas son email de
confirmation. C'est à vous de lui transmettre le lien depuis MailCatcher,
jusqu'à la mise en place d'un vrai serveur SMTP.

## Mises à jour futures

Après un nouveau `git push` sur votre dépôt :

```bash
cd /opt/pilotManager
./deploy.sh
```

## Commandes utiles

| Commande | Description |
|---|---|
| `docker compose -f docker-compose.prod.yml --env-file .env.prod ps` | État des conteneurs |
| `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f server` | Logs backend en direct |
| `docker compose -f docker-compose.prod.yml --env-file .env.prod down` | Arrête les conteneurs (garde les données) |
| `docker compose -f docker-compose.prod.yml --env-file .env.prod exec server sh` | Shell dans le conteneur backend |

## Sécurité — à faire dès que possible

1. **Restreindre l'accès au port 8080 par IP source** dans le firewall
   (Cloud Panel IONOS ou `ufw`) le temps de ne pas avoir de HTTPS, si l'app
   contient des données réelles.
2. **Passer en HTTPS** dès que vous avez un nom de domaine : pointez-le vers
   `VOTRE_IP`, installez Certbot, et remplacez l'exposition directe du port
   8080 par un reverse-proxy Apache (`mod_proxy`) vers `127.0.0.1:8080`,
   avec certificat Let's Encrypt sur le vhost du sous-domaine. Dites-le moi
   quand vous aurez le domaine, je vous prépare cette étape.
3. Changez le mot de passe admin créé par le seed (étape 5).



docker compose -f docker-compose.prod.yml --env-file .env.prod ps
