# TP Docker — Dockerfile, image et layers

## Objectifs

À la fin de ce TP, vous serez capable de :

- écrire un `Dockerfile` simple ;
- construire une image Docker ;
- lancer un conteneur avec redirection de port ;
- comprendre le fonctionnement du cache Docker ;
- identifier les layers d’une image ;
- inspecter le contenu d’un layer ;
- comprendre pourquoi un secret supprimé peut rester présent dans une image Docker.

---

## Prérequis

Vous devez disposer de :

- Docker installé et fonctionnel ;
- un terminal ;
- un éditeur de code ;
- un navigateur web.

Vérifiez que Docker fonctionne :

```bash
docker version
```

---

# Partie 1 — Création de l’application

Créez un dossier :

```text
docker-lab/
```

À l’intérieur, créez les fichiers suivants :

```text
docker-lab/
├── app.py
├── requirements.txt
├── message.txt
└── Dockerfile
```

## 1.1 Fichier `app.py`

Créez une petite application Flask.

Le fichier doit :

- créer une application Flask ;
- exposer une route `/` ;
- lire le contenu du fichier `message.txt` ;
- retourner le contenu dans une balise HTML `<h1>` ;
- écouter sur toutes les interfaces réseau ;
- utiliser le port `5000`.

Exemple de résultat attendu dans le navigateur :

```text
Bonjour depuis mon conteneur Docker !
```

---

## 1.2 Fichier `requirements.txt`

Ajoutez Flask comme dépendance :

```text
flask==3.0.3
```

---

## 1.3 Fichier `message.txt`

Ajoutez le contenu suivant :

```text
Bonjour depuis mon conteneur Docker !
```

---

# Partie 2 — Création du Dockerfile

Créez un fichier nommé :

```text
Dockerfile
```

Votre Dockerfile devra :

1. partir d’une image Python 3.12 légère ;
2. utiliser `/app` comme répertoire de travail ;
3. copier le fichier `requirements.txt` ;
4. installer les dépendances Python ;
5. copier `app.py` ;
6. copier `message.txt` ;
7. documenter l’utilisation du port `5000` ;
8. démarrer l’application Python.

Vous pouvez utiliser l’image de base :

```dockerfile
python:3.12-slim
```

### Question 1

Quelle est la différence entre :

```dockerfile
RUN
```

et :

```dockerfile
CMD
```

### Question 2

Quel est le rôle de :

```dockerfile
WORKDIR /app
```

### Question 3

À quoi sert :

```dockerfile
EXPOSE 5000
```

Est-ce que cette instruction publie automatiquement le port sur votre machine ?

---

# Partie 3 — Construction de l’image

Construisez l’image Docker avec le nom :

```text
docker-lab
```

et le tag :

```text
v1
```

La commande devra respecter la forme suivante :

```bash
docker build ...
```

Vérifiez ensuite que l’image a bien été créée.

### Question 4

Quelle commande permet d’afficher les images Docker présentes sur votre machine ?

### Question 5

Quelle est la taille de votre image `docker-lab:v1` ?

---

# Partie 4 — Lancement du conteneur

Lancez un conteneur basé sur votre image.

Contraintes :

- le conteneur doit fonctionner en arrière-plan ;
- il doit s’appeler `docker-lab` ;
- le port `8080` de votre machine doit être redirigé vers le port `5000` du conteneur.

Vous devez donc obtenir le flux suivant :

```text
Navigateur
    |
    | localhost:8080
    v
Machine hôte : 8080
    |
    v
Conteneur : 5000
    |
    v
Application Flask
```

Testez ensuite dans votre navigateur :

```text
http://localhost:8080
```

Vous devez obtenir :

```text
Bonjour depuis mon conteneur Docker !
```

### Question 6

Expliquez la signification de :

```bash
-p 8080:5000
```

### Question 7

Quelle commande permet d’afficher les conteneurs actuellement en cours d’exécution ?

### Question 8

Quelle commande permet d’afficher les logs du conteneur ?

---

# Partie 5 — Analyse des layers

Affichez l’historique de l’image :

```bash
docker history docker-lab:v1
```

Puis affichez une version plus détaillée :

```bash
docker history --no-trunc docker-lab:v1
```

Observez les différentes lignes.

### Question 9

Identifiez les instructions de votre Dockerfile apparaissant dans l’historique de l’image.

### Question 10

Parmi les instructions suivantes, lesquelles participent à la construction de layers contenant des fichiers ou des modifications du système de fichiers ?

```dockerfile
FROM
WORKDIR
COPY
RUN
EXPOSE
CMD
```

### Question 11

Quel layer semble occuper le plus de place ?

Expliquez pourquoi.

---

# Partie 6 — Comprendre le cache Docker

Modifiez uniquement le fichier :

```text
message.txt
```

Remplacez son contenu par :

```text
Docker est incroyable !
```

Construisez une nouvelle version :

```text
docker-lab:v2
```

Observez attentivement les messages affichés pendant le build.

### Question 12

Quelles étapes sont marquées :

```text
CACHED
```

### Question 13

Pourquoi Docker ne réinstalle-t-il pas Flask ?

### Question 14

À partir de quelle instruction le cache est-il invalidé ?

---

# Partie 7 — Mauvaise optimisation du Dockerfile

Modifiez maintenant votre Dockerfile afin de copier l’ensemble du projet avant l’installation des dépendances.

Vous devez obtenir une structure proche de :

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5000

CMD ["python", "app.py"]
```

Construisez une nouvelle image :

```text
docker-lab:v3
```

Puis modifiez uniquement :

```text
message.txt
```

Relancez le build.

### Question 15

L’étape :

```dockerfile
RUN pip install --no-cache-dir -r requirements.txt
```

est-elle toujours récupérée depuis le cache ?

### Question 16

Expliquez pourquoi ce Dockerfile est moins performant lors des builds.

### Question 17

Proposez une version optimisée du Dockerfile.

---

# Partie 8 — Inspection du contenu de l’image

Sauvegardez votre image dans une archive :

```bash
docker save docker-lab:v1 -o docker-lab.tar
```

Créez ensuite un dossier :

```text
docker-image
```

et extrayez l’archive à l’intérieur.

Sous Linux/macOS, vous pouvez utiliser :

```bash
mkdir docker-image
tar -xf docker-lab.tar -C docker-image
```

Sous PowerShell :

```powershell
New-Item -ItemType Directory docker-image
tar -xf docker-lab.tar -C docker-image
```

Explorez le contenu :

```bash
ls docker-image
```

Sous PowerShell :

```powershell
Get-ChildItem docker-image
```

Recherchez notamment :

```text
manifest.json
```

### Question 18

Que contient le fichier :

```text
manifest.json
```

### Question 19

Combien de layers composent votre image ?

---

# Partie 9 — Recherche d’un fichier dans les layers

Votre objectif est maintenant de retrouver le layer dans lequel le fichier :

```text
message.txt
```

a été ajouté.

Selon la version et le format utilisé par Docker, les layers peuvent apparaître sous forme de fichiers `.tar` ou de blobs.

Recherchez les archives présentes dans le dossier extrait.

Sous Linux/macOS :

```bash
find docker-image -name "*.tar"
```

Vous pouvez afficher le contenu d’une archive avec :

```bash
tar -tf <layer.tar>
```

Cherchez :

```text
message.txt
```

### Question 20

Dans quel layer trouvez-vous `message.txt` ?

### Question 21

Le layer contient-il tout le système de fichiers de l’image ?

Expliquez.

---

# Partie 10 — Challenge sécurité

Nous allons maintenant observer un comportement important des images Docker.

Créez un fichier :

```text
password.txt
```

avec par exemple :

```text
SuperSecretPassword123!
```

Ajoutez temporairement ce fichier dans votre Dockerfile :

```dockerfile
COPY password.txt .
```

Puis ajoutez plus loin :

```dockerfile
RUN rm password.txt
```

Construisez une nouvelle image :

```bash
docker build -t docker-lab:secret .
```

Lancez un conteneur et vérifiez que le fichier n’est plus présent dans le système de fichiers final.

Ensuite :

1. sauvegardez l’image avec `docker save` ;
2. extrayez l’archive ;
3. inspectez les différents layers.

### Question 22

Le fichier `password.txt` est-il réellement absent de l’image ?

### Question 23

Dans quel layer est-il encore présent ?

### Question 24

Pourquoi cette pratique est-elle dangereuse ?

### Question 25

Peut-on considérer cette approche comme correcte ?

```dockerfile
COPY password.txt .
RUN utilisation_du_password
RUN rm password.txt
```

Justifiez votre réponse.

---

# Partie 11 — Bonus : `.dockerignore`

Créez un fichier :

```text
.dockerignore
```

Ajoutez par exemple :

```text
.git
.gitignore
docker-lab.tar
docker-image/
__pycache__/
*.pyc
.env
password.txt
```

### Question 26

Quel est le rôle du fichier `.dockerignore` ?

### Question 27

Quel impact peut-il avoir sur :

- la sécurité ;
- la taille du contexte de build ;
- la vitesse du build ?

---

# Livrable attendu

Vous devez fournir :

```text
docker-lab/
├── app.py
├── requirements.txt
├── message.txt
├── Dockerfile
└── .dockerignore
```

Ajoutez également un fichier :

```text
REPONSES.md
```

contenant vos réponses aux différentes questions.

---

# Résultat attendu

À la fin du TP, vous devez être capable d’expliquer le cycle suivant :

```text
Dockerfile
    |
    v
docker build
    |
    v
Image Docker
    |
    +--> Layers
    |
    v
docker run
    |
    v
Conteneur
    |
    v
Application accessible sur localhost:8080
```

Vous devez également comprendre qu’une image Docker est constituée d’une succession de layers et que la suppression d’un fichier dans un layer ultérieur ne garantit pas sa disparition des layers précédents.
