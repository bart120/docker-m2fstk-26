# TP ÉVALUATION — Docker Advanced Killer Mode
Master 2 — Développement Web
Durée : 5 heures

---

## Contexte

Vous rejoignez une équipe ayant quitté un projet web en urgence.

Une stack Docker complète existe déjà, mais elle présente des problèmes subtils.
À première vue, certains services semblent fonctionner, mais plusieurs défauts
d’architecture et de configuration empêchent un fonctionnement fiable et
professionnel.

Votre mission consiste à analyser, diagnostiquer et corriger cette stack afin
d’obtenir une architecture stable, sécurisée et optimisée.

---

## Important

Ce TP est volontairement difficile.

Certaines erreurs sont visibles immédiatement.
D’autres nécessitent une analyse approfondie.

Aucune procédure étape par étape n’est fournie.

Vous devez :

- analyser
- expérimenter
- comprendre
- corriger
- justifier vos décisions

---

## Stack fournie

```
project/
│
├── docker-compose.yml
├── frontend/        (React + Vite)
├── backend/         (Node.js API)
├── nginx/           (Reverse proxy)
└── secrets/
```

---

## Architecture cible attendue

```
Browser
   |
Nginx (reverse proxy)
   |
Frontend
   |
Backend API
   |
PostgreSQL
```

---

## État initial (volontairement trompeur)

À première vue :

- certains conteneurs démarrent
- certaines pages se chargent

Mais en réalité :

- le frontend appelle l’API de manière incorrecte
- la base de données ne fonctionne pas toujours
- le backend peut démarrer sans être réellement opérationnel
- les performances de build sont mauvaises
- des failles de sécurité existent
- des mauvaises pratiques Docker sont présentes

---

## Objectif final attendu

- accès via http://localhost:8080
- frontend accessible via Nginx
- appels API fonctionnels via reverse proxy
- API répond correctement
- base PostgreSQL stable et persistante
- secrets sécurisés (pas de mots de passe en clair)
- healthchecks opérationnels
- Dockerfiles optimisés

---

## PARTIE 1 — Diagnostic avancé (45 min)

Identifier les problèmes suivants :

- mauvaise communication entre services
- utilisation incorrecte de localhost
- configuration réseau incorrecte
- ordre de démarrage fragile
- dépendances implicites non gérées

Livrable :

Liste argumentée des problèmes identifiés.

---

## PARTIE 2 — Debugging Docker Compose (1h15)

Corriger :

- configuration réseau Docker
- variables d’environnement incorrectes
- dépendances entre services
- reverse proxy mal configuré

Contraintes :

- ne pas supprimer l’architecture globale
- conserver nginx comme point d’entrée

---

## PARTIE 3 — Dockerfile senior (1h)

Le Dockerfile backend contient plusieurs mauvaises pratiques.

Objectifs :

- améliorer cache Docker
- réduire la taille de l’image
- éviter COPY global non maîtrisé
- exécution en utilisateur non-root
- optimiser installation des dépendances

---

## PARTIE 4 — Secrets et sécurité (45 min)

Actuellement :

- credentials exposés en clair

Objectifs :

- migration vers Docker secrets
- utilisation des variables *_FILE
- suppression des secrets du compose YAML

---

## PARTIE 5 — Healthchecks et résilience (45 min)

Ajouter :

- healthcheck PostgreSQL
- healthcheck backend
- orchestration basée sur service_healthy

Objectif :

Garantir un démarrage robuste même si la DB est lente.

---

## PARTIE 6 — Optimisation développeur (30 min)

Améliorer :

- vitesse de rebuild
- cache npm
- expérience développeur (hot reload si nécessaire)

---

## BONUS — Diagnostic expert (30 min)

Identifier et expliquer :

- pourquoi localhost est un piège dans Docker
- pourquoi depends_on ne garantit pas la disponibilité
- pourquoi COPY . . peut casser le cache Docker
- pourquoi exposer tous les ports est une mauvaise pratique
- pourquoi utiliser l’image node officielle sans optimisation peut poser problème

---

## Critères d’évaluation

| Compétence | Points |
|---|---|
| Analyse et diagnostic | 6 |
| Debugging architecture | 5 |
| Dockerfile avancé | 4 |
| Sécurité (secrets) | 3 |
| Healthchecks | 2 |

---

## Contraintes

- Docker Compose obligatoire
- Aucun runtime installé localement
- Solution reproductible
- Justification des choix techniques demandée

---

## Objectif pédagogique implicite

Évaluer votre capacité à raisonner comme un développeur expérimenté face à une stack réelle imparfaite.

## Format de rendu

Le rendu s'effectu sur moodle.
Le contenu du rendu doit etre un fichier zip, dans le nom est composé de la manière suivante: *nom*-*prenom*-m2flstk.zip
Le fichier doit contenur les différents fichiers yaml, Dockerfile, ... et un fichier md pour les réponses écritent.
