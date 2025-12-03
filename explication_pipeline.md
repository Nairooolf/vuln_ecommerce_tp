# Analyse du pipeline security.yml

Ce pipeline GitHub Actions exécute automatiquement trois analyses de sécurité sur le projet :

1. Gitleaks (détection de secrets)  
   - Analyse tout le dépôt pour repérer des clés API, tokens, JWT, mots de passe codés en dur.
   - Permet de garantir que les secrets ne sont plus présents dans la branche secure.

2. Semgrep (SAST)
   - Analyse statiquement le code du backend et frontend.
   - Détecte des vulnérabilités courantes : injections, XSS, eval(), mauvaise gestion d’input.
   - Vérifie que les corrections appliquées dans la branche secure corrigent bien les failles majeures.

3. Trivy (scan Docker)
   - Analyse les images Docker backend et frontend.
   - Cherche les CVE (failles de sécurité des librairies et du système).
   - Permet de vérifier que l’image Docker sécurisée (alpine + user non-root) réduit le nombre de vulnérabilités.

Le pipeline se déclenche automatiquement :
- à chaque push sur les branches `main` et `secure`
- à chaque pull request vers ces branches

Objectif : intégrer la sécurité dans le workflow DevSecOps en détectant les problèmes dès le développement, avant déploiement.
