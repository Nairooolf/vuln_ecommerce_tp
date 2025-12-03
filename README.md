# TP DevSecOps – Version vulnérable & version sécurisée

Ce dépôt contient deux versions d'une application e-commerce :

- **main** → version vulnérable  
- **secure** → version corrigée

L'objectif du TP est d’identifier les failles, les corriger et mettre en place un pipeline DevSecOps.

---

##  1. Branches du projet

- **main** : secrets en clair, eval(), routes non protégées, XSS, path traversal, etc.  
- **secure** : backend, frontend et Docker corrigés (suppression des secrets, validation, sanitization, auth, etc.).

Détails :
- Vulnérabilités → `VULNERABILITIES.md`
- Corrections → `CORRECTIONS.md`
- Analyse du pipeline → `SECURITY_PIPELINE.md`

---

##  2. Lancer la version sécurisée

### 1️ Cloner et passer sur secure
```bash
git clone https://github.com/Nairooolf/vuln_ecommerce_tp.git
cd vuln_ecommerce_tp
git checkout secure

---

### 2️ Créer le fichier .env dans backend/

JWT_SECRET=secret
SESSION_SECRET=secret
ADMIN_API_KEY=key
STRIPE_SECRET_KEY=stripe

---

### 3️ Lancer en Docker

docker compose up --build

    Frontend : http://localhost:3000

Backend : http://localhost:5001

---

## 3. Pipeline de sécurité (GitHub Actions)

Le workflow security.yml exécute automatiquement :

    Gitleaks → détecte les secrets

    Semgrep → analyse statique du code (SAST)

    Trivy → scan des images Docker

Le pipeline tourne sur main et secure.

---

## 4. Contenu important du dépôt

backend/      → serveur Node.js
frontend/     → app React
.github/      → pipeline CI/CD
docker-compose.yml
VULNERABILITIES.md
CORRECTIONS.md
SECURITY_PIPELINE.md

---

### 5. Objectif final

    Montrer la différence entre un projet vulnérable et sécurisé

    Comprendre l’apport d’un pipeline DevSecOps

    Démontrer la sécurisation du backend, frontend et Docker
