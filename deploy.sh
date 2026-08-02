#!/usr/bin/env bash
# Script de (re)déploiement de PilotManager en production.
# À exécuter depuis le dossier du projet, sur le serveur IONOS.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env.prod ]; then
  echo "Erreur : .env.prod manquant. Copiez .env.prod.example vers .env.prod et remplissez-le." >&2
  exit 1
fi

if [ ! -f server/.env.production ]; then
  echo "Erreur : server/.env.production manquant. Copiez server/.env.production.example et remplissez-le." >&2
  exit 1
fi

echo "==> Récupération de la dernière version du code"
git pull

echo "==> Build et démarrage des conteneurs de production"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "==> Déploiement terminé."
echo "    Logs serveur : docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f server"
echo "    Statut       : docker compose -f docker-compose.prod.yml --env-file .env.prod ps"