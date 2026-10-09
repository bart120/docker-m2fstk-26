# TP Avancé Docker Compose — Déploiement d'une application multi-services

## Contexte

Votre entreprise souhaite mettre en place une application web composée de plusieurs services indépendants.

L'objectif est de conteneuriser chaque composant puis d'orchestrer l'ensemble avec **Docker Compose** afin de faciliter :

- le démarrage de l'environnement ;
- la communication entre les services ;
- la gestion de la base de données ;
- l'exposition de l'application via un reverse proxy ;
- le déploiement de l'ensemble avec une commande unique.

L'application est composée de quatre éléments :

- un **frontend React** situé dans le dossier `front` ;
- un **backend Node.js / Express** situé dans le dossier `back` ;
- une **base de données PostgreSQL** ;
- un **reverse proxy Nginx** chargé de distribuer les requêtes vers le frontend et le backend.

---

# 1. Objectifs pédagogiques

À la fin de ce TP, vous devez être capable de :

- créer un `Dockerfile` pour une application frontend ;
- créer un `Dockerfile` pour une API Node.js / Express ;
- créer une image Docker personnalisée pour Nginx ;
- utiliser une image officielle PostgreSQL ;
- créer un fichier `docker-compose.yml` ;
- configurer plusieurs services Docker ;
- comprendre la résolution DNS interne de Docker Compose ;
- utiliser des variables d'environnement ;
- utiliser un volume Docker pour persister les données ;
- mettre en place un reverse proxy avec Nginx ;
- exposer plusieurs applications derrière un point d'entrée unique ;
- démarrer et arrêter une stack complète avec Docker Compose ;
- diagnostiquer les problèmes de communication entre conteneurs.

---

# 2. Architecture cible

Vous devez mettre en place l'architecture suivante :

```text
                    Navigateur
                        |
                        |
                http://localhost:80
                        |
                        v
                    +-------+
                    | Nginx |
                    +-------+
                     /     \
                    /       \
                   v         v
            +----------+   +----------+
            | Frontend |   | Backend  |
            |  React   |   | Express  |
            +----------+   +----------+
                               |
                               |
                               v
                         +------------+
                         | PostgreSQL |
                         +------------+
```

Le navigateur ne doit accéder directement qu'au serveur **Nginx**.

Nginx doit ensuite rediriger les requêtes vers le bon service.

---

# 3. URLs attendues

Une fois l'environnement démarré, les URLs suivantes doivent fonctionner :

```text
http://localhost/
```

Accès au frontend React.

```text
http://localhost/api1
```

Accès à une première route de l'API.

```text
http://localhost/api2
```

Accès à une seconde route de l'API.

Le reverse proxy Nginx doit déterminer vers quel conteneur transmettre chaque requête.

---

# 4. Arborescence attendue

Vous pouvez organiser le projet de la manière suivante :

```text
docker-compose-tp/
│
├── docker-compose.yml
│
├── front/
│   ├── Dockerfile
│   ├── package.json
│   └── ...
│
├── back/
│   ├── Dockerfile
│   ├── package.json
│   └── ...
│
└── nginx/
    ├── Dockerfile
    └── default.conf
```

L'arborescence exacte peut être adaptée si nécessaire.

---

# 5. Étape 1 — Préparer les images des applications

## 5.1 Frontend React

Le frontend est fourni dans le dossier :

```text
front/
```

Vous devez créer un fichier :

```text
front/Dockerfile
```

L'image finale doit permettre de servir l'application React.

### Travail demandé

Le Dockerfile du frontend devra notamment :

1. choisir une image Node.js adaptée ;
2. définir un répertoire de travail ;
3. copier les fichiers nécessaires à l'installation des dépendances ;
4. installer les dépendances ;
5. copier le code source ;
6. construire l'application React ;
7. rendre l'application disponible dans le conteneur.

Vous êtes libres de choisir entre :

- une image unique ;
- ou un **multi-stage build**.

### Recommandation

Pour une application React destinée à la production, un multi-stage build est généralement plus adapté :

```text
Étape 1
Node.js
   |
   | npm install
   | npm run build
   v
Fichiers statiques
   |
   v
Étape 2
Serveur web léger
```

Le but est de ne pas conserver Node.js et les dépendances de compilation dans l'image finale lorsque cela n'est pas nécessaire.

### Vérifications

Construisez l'image séparément avant de passer à Docker Compose :

```bash
docker build -t tp-frontend ./front
```

Vérifiez ensuite :

```bash
docker images
```

### Questions

1. Pourquoi est-il préférable de copier `package.json` avant le reste du code source ?
2. Quel est l'intérêt du cache Docker lors d'un `npm install` ?
3. Quel avantage apporte un multi-stage build pour une application React ?
4. Le frontend React a-t-il besoin de Node.js dans l'image finale après le build ?

---

## 5.2 Backend Node.js / Express

Le backend est fourni dans :

```text
back/
```

Vous devez créer :

```text
back/Dockerfile
```

Le backend doit être accessible uniquement depuis le réseau Docker.

Il n'est pas nécessaire de publier directement son port vers la machine hôte si toutes les requêtes passent par Nginx.

### Travail demandé

Le Dockerfile devra :

1. utiliser une image Node.js adaptée ;
2. définir le répertoire de travail ;
3. copier les fichiers nécessaires ;
4. installer les dépendances ;
5. copier l'application ;
6. exposer le port utilisé par Express ;
7. définir la commande de démarrage.

Exemple de port possible :

```text
3000
```

L'application Express doit écouter sur :

```text
0.0.0.0
```

et non uniquement sur :

```text
localhost
```

Sinon elle ne sera pas accessible depuis les autres conteneurs.

### Test de l'image

Construisez l'image :

```bash
docker build -t tp-backend ./back
```

Vous pouvez temporairement la tester avec :

```bash
docker run --rm -p 3000:3000 tp-backend
```

### Questions

5. Pourquoi l'application doit-elle écouter sur `0.0.0.0` dans un conteneur ?
6. Quelle différence existe entre `EXPOSE 3000` et `-p 3000:3000` ?
7. Pourquoi n'est-il pas nécessaire d'exposer le backend directement sur la machine hôte dans l'architecture finale ?

---

# 6. Étape 2 — Préparer l'image du reverse proxy Nginx

Vous devez créer un dossier :

```text
nginx/
```

contenant au minimum :

```text
nginx/
├── Dockerfile
└── default.conf
```

Nginx sera le seul service directement accessible depuis la machine hôte.

---

## 6.1 Configuration du reverse proxy

Nginx doit écouter sur le port :

```text
80
```

et router les requêtes.

Le comportement attendu est le suivant :

```text
/       -> frontend
/api1   -> backend
/api2   -> backend
```

Vous devrez utiliser la directive :

```nginx
proxy_pass
```

Pour contacter les autres conteneurs, utilisez les noms des services Docker Compose.

Exemple conceptuel :

```text
http://frontend:PORT
http://backend:PORT
```

Vous ne devez pas utiliser :

```text
localhost
```

pour communiquer avec un autre conteneur.

### Pourquoi ?

Dans le conteneur Nginx :

```text
localhost
```

désigne le conteneur Nginx lui-même.

Docker Compose fournit automatiquement une résolution DNS interne basée sur le nom des services.

---

## 6.2 Dockerfile Nginx

Créez :

```text
nginx/Dockerfile
```

L'image devra :

1. partir d'une image Nginx officielle ;
2. copier votre configuration Nginx ;
3. exposer le port 80.

Construisez l'image :

```bash
docker build -t tp-nginx ./nginx
```

### Questions

8. Quel est le rôle d'un reverse proxy ?
9. Pourquoi le backend n'est-il pas appelé avec `localhost` depuis Nginx ?
10. Comment Docker Compose permet-il de résoudre le nom `backend` ?
11. Quel est l'intérêt d'avoir un point d'entrée unique pour l'application ?

---

# 7. Étape 3 — Création du fichier `docker-compose.yml`

À la racine du projet, créez :

```text
docker-compose.yml
```

Le fichier doit orchestrer quatre services.

Vous pouvez utiliser les noms suivants :

```text
frontend
backend
db
nginx
```

---

# 8. Service PostgreSQL

La base de données doit utiliser une image officielle PostgreSQL.

Par exemple :

```yaml
image: postgres:...
```

Vous devez configurer au minimum :

- le nom de la base ;
- l'utilisateur PostgreSQL ;
- le mot de passe ;
- un volume pour conserver les données.

Les variables couramment utilisées par l'image PostgreSQL sont :

```text
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
```

Ne mettez pas nécessairement les vraies valeurs directement dans le fichier si vous choisissez d'utiliser un fichier `.env`.

---

## 8.1 Persistance des données

Les données PostgreSQL ne doivent pas disparaître à chaque recréation du conteneur.

Vous devez donc créer un volume Docker.

Exemple conceptuel :

```yaml
volumes:
  postgres_data:
```

et le monter dans le répertoire utilisé par PostgreSQL.

Le principe doit être :

```text
Conteneur PostgreSQL
        |
        v
Répertoire de données PostgreSQL
        |
        v
Volume Docker
        |
        v
Données persistantes
```

### Test à réaliser

1. démarrez la stack ;
2. ajoutez une donnée en base ;
3. arrêtez les conteneurs ;
4. recréez les conteneurs ;
5. vérifiez que la donnée est toujours présente.

### Questions

12. Pourquoi un volume est-il nécessaire pour PostgreSQL ?
13. Quelle différence existe entre supprimer un conteneur et supprimer un volume ?
14. Que se passe-t-il avec les données si vous utilisez :

```bash
docker compose down
```

15. Que se passe-t-il si vous utilisez :

```bash
docker compose down -v
```

---

# 9. Communication Backend → PostgreSQL

Le backend doit pouvoir communiquer avec PostgreSQL.

Dans un environnement Docker Compose, le serveur PostgreSQL ne doit pas être configuré avec :

```text
localhost
```

Le hostname doit correspondre au nom du service PostgreSQL.

Par exemple :

```text
db
```

La chaîne de connexion pourra donc utiliser des informations de ce type :

```text
host=db
port=5432
database=...
user=...
password=...
```

### Questions

16. Pourquoi `localhost` ne fonctionne-t-il pas pour joindre PostgreSQL depuis le backend ?
17. Quel hostname doit être utilisé ?
18. Quel est le rôle du réseau interne créé par Docker Compose ?

---

# 10. Variables d'environnement

La configuration de l'application ne doit idéalement pas être codée en dur dans les images.

Vous devez utiliser des variables d'environnement pour transmettre au backend les informations nécessaires.

Exemples :

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
```

Vous pouvez les définir directement dans Compose :

```yaml
environment:
  DB_HOST: db
```

ou utiliser un fichier :

```text
.env
```

Exemple :

```text
POSTGRES_DB=mydb
POSTGRES_USER=myuser
POSTGRES_PASSWORD=...
```

### Attention

Un fichier `.env` ne constitue pas à lui seul un mécanisme sécurisé de gestion des secrets.

Il est pratique pour un TP ou un environnement local, mais les solutions de production utilisent généralement un gestionnaire de secrets.

### Questions

19. Pourquoi utiliser des variables d'environnement ?
20. Quelle est la différence entre la configuration d'une image et la configuration d'un conteneur ?
21. Pourquoi éviter de placer un mot de passe directement dans un Dockerfile ?

---

# 11. Dépendances entre services

Le backend dépend de PostgreSQL.

Nginx dépend du frontend et du backend.

Vous pouvez utiliser :

```yaml
depends_on:
```

pour exprimer certaines dépendances de démarrage.

Exemple conceptuel :

```text
db
 |
 v
backend
 |
 v
nginx
```

### Attention

`depends_on` ne garantit pas nécessairement que PostgreSQL est déjà prêt à accepter des connexions.

Il garantit principalement l'ordre de démarrage des conteneurs.

Pour aller plus loin, vous pouvez ajouter un :

```text
healthcheck
```

sur PostgreSQL.

### Questions

22. Quelle est la différence entre un conteneur démarré et un service réellement prêt ?
23. Pourquoi un `healthcheck` peut-il être utile pour une base de données ?

---

# 12. Réseau Docker Compose

Docker Compose crée automatiquement un réseau pour les services du projet.

Les différents services peuvent communiquer grâce à leurs noms :

```text
frontend
backend
db
nginx
```

Par exemple :

```text
nginx -> backend
backend -> db
```

Vous pouvez afficher les réseaux avec :

```bash
docker network ls
```

Puis inspecter le réseau créé par Compose :

```bash
docker network inspect <nom-du-reseau>
```

### Questions

24. Combien de réseaux votre fichier Compose crée-t-il ?
25. Quels conteneurs sont connectés à ce réseau ?
26. Les conteneurs peuvent-ils communiquer par leur adresse IP ?
27. Pourquoi vaut-il mieux utiliser le nom du service que son adresse IP ?

---

# 13. Publication des ports

Dans l'architecture attendue, seul Nginx doit obligatoirement publier un port sur la machine hôte.

Exemple :

```text
Machine hôte : 80
        |
        v
Nginx : 80
```

Le frontend, le backend et PostgreSQL peuvent rester accessibles uniquement sur le réseau Docker.

Cela permet d'obtenir une architecture proche de :

```text
Internet / utilisateur
         |
         v
       Nginx
         |
    +----+----+
    |         |
    v         v
Frontend   Backend
              |
              v
          PostgreSQL
```

### Questions

28. Pourquoi ne pas exposer PostgreSQL sur le port 5432 de la machine hôte si ce n'est pas nécessaire ?
29. Quel avantage apporte cette approche en matière de sécurité ?
30. Quelle différence existe entre un port `expose` et un port publié avec `ports` ?

---

# 14. Étape 4 — Démarrage de l'environnement

Une fois le fichier Compose terminé, démarrez la stack :

```bash
docker compose up
```

Puis en arrière-plan :

```bash
docker compose up -d
```

Vérifiez l'état :

```bash
docker compose ps
```

Vous devez retrouver les quatre services.

---

# 15. Tests fonctionnels

Testez les URLs demandées.

## Frontend

```text
http://localhost/
```

Le frontend React doit s'afficher.

## API 1

```text
http://localhost/api1
```

La requête doit être transmise par Nginx vers le backend.

## API 2

```text
http://localhost/api2
```

La seconde route doit également fonctionner.

---

# 16. Analyse des logs

Affichez tous les logs :

```bash
docker compose logs
```

Suivez les logs :

```bash
docker compose logs -f
```

Pour un service particulier :

```bash
docker compose logs backend
```

ou :

```bash
docker compose logs nginx
```

### Questions

31. Dans quels logs recherchez-vous une erreur HTTP 502 retournée par Nginx ?
32. Dans quels logs recherchez-vous une erreur de connexion PostgreSQL ?
33. Quelle commande permet de suivre les logs en temps réel ?

---

# 17. Diagnostic depuis les conteneurs

Vous pouvez ouvrir un shell dans un conteneur.

Exemple :

```bash
docker compose exec backend sh
```

Puis tester la résolution DNS :

```bash
getent hosts db
```

Si l'outil est disponible, vous pouvez également tester :

```bash
ping db
```

Depuis Nginx, vous pouvez vérifier que le nom du backend est résolu.

### Questions

34. Quelle adresse IP est associée au service `db` ?
35. Cette adresse IP doit-elle être placée dans la configuration de l'application ?
36. Que se passerait-il si le conteneur était recréé ?

---

# 18. Arrêt et nettoyage

Arrêtez les services :

```bash
docker compose stop
```

Redémarrez-les :

```bash
docker compose start
```

Supprimez les conteneurs et le réseau :

```bash
docker compose down
```

Pour supprimer également les volumes :

```bash
docker compose down -v
```

### Questions

37. Quelle différence existe entre `stop` et `down` ?
38. Quelle différence existe entre `down` et `down -v` ?
39. Dans quel cas faut-il éviter `down -v` ?

---

# 19. Bonus — Healthcheck PostgreSQL

Ajoutez un `healthcheck` au service PostgreSQL.

Vous pouvez vous appuyer sur la commande PostgreSQL :

```text
pg_isready
```

L'objectif est que Docker puisse distinguer :

```text
conteneur démarré
```

de :

```text
PostgreSQL prêt à recevoir des connexions
```

Vérifiez ensuite l'état du service :

```bash
docker compose ps
```

### Question

40. Quel intérêt présente un healthcheck dans une architecture multi-services ?

---

# 20. Bonus — Limiter l'accès aux services

Modifiez votre fichier Compose afin que :

- Nginx soit accessible depuis la machine hôte ;
- le frontend soit accessible uniquement depuis Nginx ;
- le backend soit accessible uniquement depuis Nginx et les services internes ;
- PostgreSQL soit accessible uniquement depuis le backend.

Expliquez les changements réalisés.

---

# 21. Bonus — `.dockerignore`

Ajoutez un fichier `.dockerignore` dans `front` et `back`.

Exemples d'éléments qui ne doivent généralement pas être envoyés dans le contexte de build :

```text
node_modules
.git
.gitignore
npm-debug.log
.env
```

### Questions

41. Quel est le rôle de `.dockerignore` ?
42. Quel impact peut-il avoir sur la vitesse d'un build ?
43. Pourquoi faut-il éviter de copier un fichier `.env` contenant des secrets dans une image ?

---

# 22. Commandes utiles

## Construire toutes les images

```bash
docker compose build
```

## Construire sans utiliser le cache

```bash
docker compose build --no-cache
```

## Démarrer

```bash
docker compose up -d
```

## Afficher les services

```bash
docker compose ps
```

## Afficher les logs

```bash
docker compose logs
```

## Afficher les logs en temps réel

```bash
docker compose logs -f
```

## Entrer dans un conteneur

```bash
docker compose exec <service> sh
```

## Arrêter

```bash
docker compose stop
```

## Supprimer les conteneurs

```bash
docker compose down
```

## Supprimer les conteneurs et les volumes

```bash
docker compose down -v
```

---

# 23. Résultat attendu

L'architecture finale doit respecter le fonctionnement suivant :

```text
                       localhost:80
                            |
                            v
                      +-----------+
                      |   Nginx   |
                      +-----------+
                         /     \
                        /       \
                       v         v
                +----------+  +----------+
                | Frontend |  | Backend  |
                |  React   |  | Express  |
                +----------+  +----------+
                                  |
                                  v
                            +------------+
                            | PostgreSQL |
                            +------------+
                                  |
                                  v
                             Volume Docker
```

Les composants doivent pouvoir être démarrés avec une commande unique :

```bash
docker compose up -d
```

---

# 24. Livrable attendu

Vous devez rendre une archive ZIP contenant votre travail.

Le rendu doit contenir au minimum :

```text
docker-compose.yml

front/
└── Dockerfile

back/
└── Dockerfile

nginx/
├── Dockerfile
└── default.conf
```

Ajoutez également les éventuels fichiers nécessaires à l'exécution de votre projet.

Le projet doit pouvoir être démarré avec :

```bash
docker compose up -d --build
```

sans modification manuelle du fichier Compose.

---

# 25. Critères de validation

Le TP sera considéré comme fonctionnel si :

- les quatre services démarrent ;
- le frontend est accessible via `http://localhost/` ;
- `/api1` est correctement routé vers le backend ;
- `/api2` est correctement routé vers le backend ;
- le backend peut communiquer avec PostgreSQL ;
- les données PostgreSQL sont persistantes ;
- le frontend et le backend disposent de leurs Dockerfiles ;
- Nginx utilise une configuration personnalisée ;
- l'ensemble peut être démarré avec Docker Compose ;
- les conteneurs communiquent par leurs noms de services ;
- PostgreSQL n'est pas inutilement exposé vers l'extérieur.

---

# 26. Questions de synthèse

À la fin du TP, vous devez être capable d'expliquer clairement les notions suivantes :

1. Quelle est la différence entre une image et un conteneur ?
2. À quoi sert Docker Compose ?
3. Comment deux conteneurs d'un même projet Compose communiquent-ils ?
4. Pourquoi utilise-t-on le nom du service comme hostname ?
5. À quoi sert un volume Docker ?
6. À quoi sert un reverse proxy ?
7. Pourquoi ne faut-il pas nécessairement publier tous les ports ?
8. À quoi servent les variables d'environnement ?
9. Quelle est la différence entre `docker compose stop` et `docker compose down` ?
10. Quel est l'intérêt d'un healthcheck dans une application multi-services ?
