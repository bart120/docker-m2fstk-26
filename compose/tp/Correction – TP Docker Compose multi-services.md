# Correction – TP Docker Compose multi-services

Voici une solution complète du TP, démarrable avec `docker compose up -d --build`, suivie des réponses aux questions. D'autres solutions sont valables si elles respectent les critères de validation du sujet.

## Étape 1 – Images des applications

### Arborescence de la solution

```text
docker-compose-tp/
├── docker-compose.yml
├── .env
├── .env.example
├── front/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── next.config.js
│   └── ...
├── back/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── server.js
└── nginx/
    ├── Dockerfile
    └── default.conf
```

### Frontend Next (multi-stage, mode standalone)

On active d'abord la sortie autonome de Next dans `front/next.config.js`. Le build produit alors un dossier `.next/standalone` avec un `server.js` et uniquement les dépendances utiles à l'exécution.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
module.exports = nextConfig;
```

`front/Dockerfile` :

```dockerfile
# --- Étape 1 : dépendances (en cache tant que package*.json ne change pas)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Étape 2 : build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Étape 3 : exécution (ni sources, ni devDependencies)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

À retenir :

- `HOSTNAME=0.0.0.0` fait écouter Next sur toutes les interfaces du conteneur. Sans cette variable, Nginx ne peut pas le joindre et renvoie une erreur 502.
- Si votre projet n'a pas de dossier `public/`, supprimez la ligne correspondante, sinon le build échoue.
- L'application tourne avec un utilisateur non root (`nextjs`), une bonne pratique de sécurité.

**Variante export statique.** Si l'application n'utilise ni rendu serveur, ni routes API Next, ni middleware, on peut mettre `output: 'export'` dans `next.config.js` et servir les fichiers générés avec Nginx, sans Node.js dans l'image finale :

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build          # produit le dossier out/

FROM nginx:1.27-alpine
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
```

Le frontend écoute alors sur le port 80, et le reverse proxy doit pointer vers `http://frontend:80`.

### Backend Express

Exemple de `back/server.js`. L'essentiel est l'écoute sur `0.0.0.0` et la lecture de la configuration dans les variables d'environnement.

```js
const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.get('/api1', (req, res) => {
  res.json({ service: 'backend', route: 'api1', time: new Date() });
});

app.get('/api2', async (req, res) => {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS visites (id SERIAL PRIMARY KEY, date TIMESTAMPTZ DEFAULT now())');
    await pool.query('INSERT INTO visites DEFAULT VALUES');
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM visites');
    res.json({ route: 'api2', visites: rows[0].total });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`API sur le port ${PORT}`));
```

La route `/api2` compte les visites en base : elle sert aussi à vérifier la persistance des données.

`back/Dockerfile` :

```dockerfile
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

### Fichiers `.dockerignore` (bonus)

Identiques dans `front/` et `back/` :

```text
node_modules
.next
out
.git
.gitignore
npm-debug.log*
.env
.env.*
Dockerfile
.dockerignore
```

Exclure `node_modules` évite aussi un piège : un `node_modules` installé sous Windows ou macOS contient des binaires natifs incompatibles avec une image Linux Alpine.

## Étape 2 – Reverse proxy Nginx

`nginx/default.conf` :

```nginx
upstream frontend_app {
    server frontend:3000;
}

upstream backend_api {
    server backend:3000;
}

server {
    listen 80;
    server_name localhost;

    # En-têtes transmis aux services
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api1 {
        proxy_pass http://backend_api;
    }

    location /api2 {
        proxy_pass http://backend_api;
    }

    location / {
        proxy_pass http://frontend_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Trois points à bien comprendre :

- **`frontend` et `backend` sont les noms des services Compose**, résolus par le DNS interne de Docker. On n'utilise jamais `localhost` pour joindre un autre conteneur.
- **Attention à la barre finale de `proxy_pass`.** `proxy_pass http://backend_api;` (sans chemin) transmet l'URI telle quelle : Express reçoit `/api1`. Avec `proxy_pass http://backend:3000/;`, Nginx retire le préfixe de la `location` et Express reçoit `/`, ce qui donne une 404 si les routes s'appellent `/api1` et `/api2`.
- **Nginx choisit la `location` au préfixe le plus long** : `/api1` l'emporte sur `/`, quel que soit l'ordre dans le fichier.

`nginx/Dockerfile` :

```dockerfile
FROM nginx:1.27-alpine
COPY default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Le `COPY` remplace le fichier `default.conf` d'origine, qui affiche la page d'accueil de Nginx.

## Étape 3 – Fichier docker-compose.yml

### Fichier `.env`

À placer à la racine, à côté du `docker-compose.yml`. Compose le lit automatiquement et remplace les `${...}`.

```text
POSTGRES_DB=tpdb
POSTGRES_USER=tpuser
POSTGRES_PASSWORD=changez-moi
```

Ne versionnez pas ce fichier (ajoutez-le au `.gitignore`). Versionnez à la place un `.env.example` avec les mêmes clés et des valeurs vides.

### `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  backend:
    build: ./back
    restart: unless-stopped
    environment:
      PORT: 3000
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: ${POSTGRES_DB}
      DB_USER: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
    expose:
      - "3000"
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./front
    restart: unless-stopped
    expose:
      - "3000"

  nginx:
    build: ./nginx
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
```

Ce qu'il faut remarquer :

- **Seul Nginx a une section `ports`.** La base, le backend et le frontend ne sont joignables que depuis le réseau Docker.
- **`DB_HOST: db`** : le backend joint PostgreSQL par le nom de son service.
- **Version de PostgreSQL figée.** À partir de PostgreSQL 18, l'image officielle range ses données dans `/var/lib/postgresql` et non plus dans `/var/lib/postgresql/data`. Avec `postgres:latest`, le volume ci-dessus ne protégerait plus les données.
- **Healthcheck (bonus)** : `pg_isready` teste si la base accepte les connexions. Le double `$$` empêche Compose de remplacer la variable : c'est le shell du conteneur qui la lit.
- **`condition: service_healthy`** : le backend attend que la base soit réellement prête, et pas seulement que son conteneur soit lancé.
- **`expose`** est informatif entre services d'un même réseau : Nginx joindrait le backend même sans cette ligne.

### Bonus – Limiter l'accès aux services

On remplace le réseau par défaut par trois réseaux, et chaque service n'est branché que sur ceux dont il a besoin. Le réseau de la base est `internal` : il n'a aucun accès vers l'extérieur.

```yaml
services:
  db:
    # ... (inchangé)
    networks: [db_net]

  backend:
    # ... (inchangé)
    networks: [back_net, db_net]

  frontend:
    # ... (inchangé)
    networks: [front_net]

  nginx:
    # ... (inchangé)
    networks: [front_net, back_net]

networks:
  front_net:
  back_net:
  db_net:
    internal: true
```

| Service | front\_net | back\_net | db\_net | Joignable par |
| --- | --- | --- | --- | --- |
| nginx | oui | oui | non | la machine hôte (port 80) |
| frontend | oui | non | non | nginx |
| backend | non | oui | oui | nginx |
| db | non | non | oui | backend |

Ainsi, le frontend ne peut plus atteindre la base, et une faille dans Nginx ne donne aucun accès réseau à PostgreSQL. Pour le vérifier, `docker compose exec frontend getent hosts db` ne renvoie rien, alors que la même commande lancée depuis `backend` renvoie une adresse IP.

## Tester sa solution

### Démarrer et vérifier les URLs

```bash
docker compose up -d --build
docker compose ps
```

Vous devez voir quatre services `Up`, `db` en `(healthy)`, et seul `nginx` avec `0.0.0.0:80->80/tcp` dans la colonne des ports.

```bash
curl -i http://localhost/        # 200, page Next
curl http://localhost/api1       # {"service":"backend","route":"api1",...}
curl http://localhost/api2       # {"route":"api2","visites":1}
```

### Vérifier la persistance

1. Appelez `/api2` trois fois : le compteur `visites` passe à 3.
2. Lancez `docker compose down` puis `docker compose up -d`.
3. Appelez `/api2` : le compteur affiche 4, les données ont été conservées.
4. Lancez `docker compose down -v` puis `docker compose up -d` : le compteur repart à 1, car le volume a été supprimé.

Vous pouvez aussi interroger la base directement :

```bash
docker compose exec db psql -U tpuser -d tpdb -c "SELECT count(*) FROM visites;"
```

### Diagnostiquer

```bash
docker compose logs -f nginx            # erreurs 502, service injoignable
docker compose logs backend             # erreurs de connexion à PostgreSQL
docker compose exec backend sh
  getent hosts db                       # adresse IP du service db
  wget -qO- http://localhost:3000/api1  # l'API répond-elle dans son conteneur ?
docker compose exec nginx sh -c "wget -qO- http://backend:3000/api1"
docker network ls
docker network inspect docker-compose-tp_default
```

Le réseau par défaut s'appelle `<nom du dossier>_default`. Les images Alpine contiennent `wget` mais pas `curl`, et `ping` n'est pas toujours disponible.

## Réponses aux questions 1 à 43

### Frontend (1 à 4)

**1.** Chaque instruction du Dockerfile crée une couche mise en cache. Si l'on copie d'abord `package.json` (et le lockfile) puis qu'on lance `npm ci`, cette couche n'est reconstruite que lorsque les dépendances changent. Modifier le code source n'invalide que les couches suivantes.

**2.** `npm install` est l'étape la plus longue du build. Grâce au cache, elle est réutilisée tant que les dépendances ne changent pas : un rebuild après une modification de code passe de plusieurs minutes à quelques secondes.

**3.** L'image finale ne contient que le résultat du build : ni code source, ni devDependencies, ni outils de compilation. Elle est beaucoup plus légère (environ 150 Mo au lieu de plus de 1 Go), démarre plus vite et offre moins de surface d'attaque.

**4.** Cela dépend du mode de rendu. Avec du rendu serveur (SSR), des routes API Next ou un middleware, Node.js reste nécessaire pour faire tourner le serveur Next. Avec `output: 'export'`, Next génère des fichiers statiques qu'un simple serveur web comme Nginx peut servir, sans Node.js.

### Backend (5 à 7)

**5.** Dans un conteneur, `localhost` (127.0.0.1) désigne le conteneur lui-même. Une application qui n'écoute que sur cette adresse refuse les connexions venant de l'extérieur du conteneur, donc de Nginx ou de la machine hôte. `0.0.0.0` signifie « écouter sur toutes les interfaces ».

**6.** `EXPOSE 3000` documente le port utilisé par l'image, mais n'ouvre rien. `-p 3000:3000` publie réellement le port : il redirige le port 3000 de la machine hôte vers le port 3000 du conteneur.

**7.** Toutes les requêtes passent par Nginx, qui joint le backend par le réseau interne de Compose. Publier le port du backend créerait un second point d'entrée qui contourne le proxy, sans aucun intérêt.

### Reverse proxy (8 à 11)

**8.** Un reverse proxy reçoit les requêtes des clients et les transmet au bon service interne, selon le chemin ou le nom de domaine. Il peut aussi gérer le HTTPS, la compression, le cache, la limitation de débit et la répartition de charge.

**9.** Dans le conteneur Nginx, `localhost` désigne le conteneur Nginx lui-même, où aucun backend ne tourne. Le backend est un autre conteneur, avec sa propre adresse réseau.

**10.** Docker fournit un serveur DNS interne (à l'adresse 127.0.0.11 dans chaque conteneur). Sur un réseau créé par Compose, chaque nom de service y est enregistré et résolu vers l'adresse IP du conteneur correspondant.

**11.** Une seule URL et un seul port pour l'utilisateur, pas de problème de CORS entre le front et l'API (même origine), et un seul endroit pour gérer le HTTPS, les logs d'accès et les règles de sécurité. Les services internes restent masqués.

### PostgreSQL et volumes (12 à 15)

**12.** Le système de fichiers d'un conteneur est éphémère : il disparaît quand le conteneur est supprimé ou recréé (changement de configuration, nouvelle version d'image). Le volume stocke les données en dehors du cycle de vie du conteneur.

**13.** Supprimer un conteneur détruit ses fichiers internes mais laisse le volume intact : un nouveau conteneur qui monte ce volume retrouve les données. Supprimer le volume détruit définitivement les données.

**14.** `docker compose down` supprime les conteneurs et le réseau, mais conserve les volumes nommés : les données sont toujours là au prochain `up`.

**15.** `docker compose down -v` supprime en plus les volumes nommés du projet : la base repart vide au prochain démarrage.

### Communication backend → PostgreSQL (16 à 18)

**16.** Depuis le conteneur backend, `localhost` désigne le backend lui-même, où PostgreSQL ne tourne pas. On obtient l'erreur `ECONNREFUSED 127.0.0.1:5432`.

**17.** Le nom du service PostgreSQL dans le fichier Compose : `db`.

**18.** Il relie les conteneurs du projet entre eux, leur permet de se trouver par nom de service et les isole des conteneurs des autres projets.

### Variables d'environnement (19 à 21)

**19.** Une même image peut tourner dans plusieurs environnements (développement, recette, production) avec des paramètres différents, sans être reconstruite. Les mots de passe ne sont pas écrits dans le code.

**20.** La configuration d'une image est fixée au moment du build (instructions `ENV`, `ARG`, fichiers copiés) et identique pour tous ses conteneurs. La configuration d'un conteneur est donnée au lancement (`environment`, `-e`, volumes, ports) et propre à chaque instance.

**21.** Le mot de passe resterait inscrit dans une couche de l'image : il serait visible avec `docker history` ou `docker inspect`, et partagé avec toute personne qui récupère l'image. Il faudrait aussi reconstruire l'image pour le changer.

### Dépendances (22 et 23)

**22.** Un conteneur démarré a seulement son processus principal lancé. Un service prêt est capable de traiter les requêtes. PostgreSQL met quelques secondes à s'initialiser avant d'accepter les connexions.

**23.** Le healthcheck indique à Docker quand la base accepte vraiment des connexions. Avec `depends_on` et `condition: service_healthy`, il empêche le backend de démarrer trop tôt et de planter sur une erreur de connexion.

### Réseau (24 à 27)

**24.** Un seul, nommé `<dossier>_default`, créé automatiquement (trois dans la version bonus avec réseaux séparés).

**25.** Les quatre : `nginx`, `frontend`, `backend` et `db`. On les voit dans la section `Containers` de `docker network inspect`.

**26.** Oui, techniquement, les conteneurs d'un même réseau peuvent communiquer par leurs adresses IP.

**27.** L'adresse IP est attribuée automatiquement et peut changer à chaque recréation du conteneur. Le nom du service, lui, reste stable et est toujours résolu vers la bonne adresse.

### Ports (28 à 30)

**28.** Publier le port 5432 rend la base accessible depuis la machine hôte, voire depuis le réseau, et l'expose à des tentatives de connexion. Cela peut aussi entrer en conflit avec un PostgreSQL déjà installé sur la machine.

**29.** La surface d'attaque est réduite : un seul point d'entrée exposé et contrôlé, et des services internes joignables uniquement depuis le réseau Docker.

**30.** `expose` documente un port accessible aux autres conteneurs du même réseau, sans l'ouvrir sur la machine hôte. `ports` publie le port sur la machine hôte (`hôte:conteneur`).

### Logs (31 à 33)

**31.** Dans les logs de `nginx` : ils indiquent quel service est injoignable (`connect() failed`, `host not found`). On regarde ensuite les logs de ce service pour trouver la cause.

**32.** Dans les logs de `backend`, qui affichent l'erreur de connexion, et dans ceux de `db` pour les erreurs d'authentification ou d'initialisation.

**33.** `docker compose logs -f`, ou `docker compose logs -f <service>` pour un seul service.

### Diagnostic (34 à 36)

**34.** Une adresse privée du réseau Compose, par exemple `172.18.0.2`. La valeur exacte varie selon les machines : lisez-la avec `getent hosts db`.

**35.** Non. Il faut toujours utiliser le nom du service.

**36.** Le nouveau conteneur pourrait recevoir une autre adresse IP. Une configuration écrite avec l'ancienne adresse ne fonctionnerait plus, alors que le nom `db` serait automatiquement résolu vers la nouvelle.

### Arrêt et nettoyage (37 à 39)

**37.** `stop` arrête les conteneurs sans les supprimer, et `start` les relance tels quels. `down` arrête et supprime les conteneurs ainsi que le réseau du projet.

**38.** `down -v` supprime en plus les volumes nommés, donc les données persistantes.

**39.** Dès qu'il y a des données à conserver : environnement partagé, données de test longues à recréer et, bien sûr, en production. On ne l'utilise que pour repartir volontairement d'une base vide.

### Healthcheck (40)

**40.** Docker connaît l'état réel de chaque service (`healthy` ou `unhealthy`). On peut ainsi démarrer les services dans le bon ordre, voir immédiatement un service bloqué dans `docker compose ps` et, avec un orchestrateur, redémarrer automatiquement un service défaillant.

### `.dockerignore` (41 à 43)

**41.** Il exclut des fichiers et dossiers du contexte de build envoyé à Docker, comme `.gitignore` le fait pour Git.

**42.** Le contexte envoyé est beaucoup plus petit (un dossier `node_modules` pèse souvent plusieurs centaines de Mo), donc le build démarre plus vite. Le cache est aussi moins souvent invalidé par des fichiers inutiles.

**43.** Le secret serait copié dans une couche de l'image, lisible par toute personne qui récupère l'image, et impossible à retirer sans reconstruire l'image.

## Questions de synthèse

**1. Image et conteneur.** Une image est un modèle en lecture seule, composé de couches (système, dépendances, code). Un conteneur est une instance en cours d'exécution de cette image, avec sa propre couche modifiable. Une même image peut lancer plusieurs conteneurs.

**2. Docker Compose** décrit une application multi-conteneurs dans un fichier YAML (services, réseaux, volumes, variables) et la pilote avec quelques commandes : `up`, `down`, `logs`, `ps`. L'environnement devient reproductible et versionnable.

**3. Communication entre conteneurs.** Compose crée un réseau commun au projet. Les conteneurs s'y joignent directement, sur les ports internes de leurs applications, sans passer par la machine hôte.

**4. Nom du service comme hostname.** Le DNS interne de Docker résout ce nom vers l'adresse IP actuelle du conteneur. Le nom est stable, alors que l'adresse IP peut changer à chaque recréation.

**5. Volume Docker.** Il stocke des données en dehors du cycle de vie du conteneur : elles survivent à sa suppression et à sa recréation, et peuvent être partagées entre conteneurs.

**6. Reverse proxy.** C'est le point d'entrée unique : il reçoit les requêtes et les répartit vers les services internes selon le chemin ou le domaine. Il masque l'architecture interne et centralise HTTPS, logs et sécurité.

**7. Ne pas publier tous les ports.** Chaque port publié est une porte ouverte sur la machine. Les services internes communiquent déjà par le réseau Docker : seul le point d'entrée doit être exposé.

**8. Variables d'environnement.** Elles transmettent la configuration au lancement (adresse de la base, identifiants, ports). Une même image fonctionne ainsi dans tous les environnements, sans valeur ni secret inscrit dans l'image.

**9. `stop` et `down`.** `stop` arrête les conteneurs sans les supprimer (`start` les relance). `down` les supprime avec le réseau. Les volumes sont conservés dans les deux cas, sauf avec `down -v`.

**10. Healthcheck.** Il distingue un conteneur lancé d'un service prêt. Les services dépendants démarrent au bon moment (`condition: service_healthy`), et un service défaillant est repéré, voire redémarré automatiquement.

## Erreurs fréquentes

Si votre stack ne fonctionne pas, cherchez votre symptôme ici avant de tout reconstruire.

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| 502 Bad Gateway sur `/` | Next n'écoute pas sur `0.0.0.0`, ou mauvais port dans `proxy_pass` | `HOSTNAME=0.0.0.0` dans le Dockerfile ; port 3000 en standalone, 80 en export statique |
| 404 sur `/api1` renvoyée par Express | Barre finale dans `proxy_pass` : le préfixe `/api1` est retiré | `proxy_pass http://backend:3000;` sans barre finale |
| `ECONNREFUSED 127.0.0.1:5432` | `DB_HOST=localhost` | `DB_HOST=db` |
| Le backend plante au premier démarrage, puis fonctionne | La base n'était pas encore prête | Healthcheck sur `db` + `condition: service_healthy` |
| `host not found in upstream "backend"` | Nginx démarre avant les services, ou nom de service différent | `depends_on`, et le même nom dans Compose et dans `default.conf` |
| Page d'accueil de Nginx au lieu du site | `default.conf` copié au mauvais endroit | `COPY default.conf /etc/nginx/conf.d/default.conf` |
| Données perdues après `down` puis `up` | Pas de volume, ou volume monté au mauvais endroit | Volume nommé sur `/var/lib/postgresql/data` avec PostgreSQL 17 |
| Données jamais conservées avec `postgres:latest` | PostgreSQL 18 a changé le dossier des données | Utiliser `postgres:17-alpine`, ou monter le volume sur `/var/lib/postgresql` |
| Nouveau mot de passe du `.env` refusé | PostgreSQL ne lit ces variables qu'à la création d'une base vide | `docker compose down -v` puis `up` (les données sont perdues) |
| Build très lent, erreurs de modules natifs | `node_modules` local copié dans l'image | Ajouter un `.dockerignore` |
| `COPY failed: /app/public: not found` | Le projet Next n'a pas de dossier `public/` | Supprimer cette ligne du Dockerfile ou créer le dossier |
| Port 80 déjà utilisé | Un autre serveur web tourne sur votre poste | Publier `"8080:80"` et tester sur `http://localhost:8080` |
