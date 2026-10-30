
# Docker Advanced Evaluation – Killer Mode

Ce dépôt contient une stack volontairement piégeuse.

Objectif : rendre la stack fonctionnelle et professionnelle.

Contraintes :
- utilisation de Docker Compose
- aucun runtime installé localement
- debug et correction nécessaires

Architecture cible :

Browser -> Nginx -> Frontend -> Backend API -> PostgreSQL

Attention :
- certains éléments semblent fonctionner mais sont incorrects.
- plusieurs anti-patterns sont présents.
