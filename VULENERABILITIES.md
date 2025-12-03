# VULNERABILITIES.md

## 1. Vulnérabilités issues des dépendances (`npm audit`)

### 1.1 Frontend (React)

Source : `npm audit` dans `frontend/`. :contentReference[oaicite:2]{index=2}  

**Principales dépendances vulnérables :**

- `react-scripts` 4.x et sa chaîne de dépendances :
  - `webpack-dev-server`, `webpack-dev-middleware`
  - `ansi-html`, `braces`, `micromatch`, `chokidar`
  - `postcss` + écosystème (`autoprefixer`, `cssnano`, etc.)
  - `ejs`, `loader-utils`, `shell-quote`, `rollup`, `semver`, etc.
- `axios <= 0.30.1`

**Types de vulnérabilités :**

- XSS via outils de dev (`webpack-dev-server`, `ansi-html`, `rollup`)
- Prototype Pollution (ex : `immer`, `loader-utils`)
- DoS / ReDoS (regex lourdes dans `browserslist`, `cross-spawn`, `minimatch`, etc.)
- SSRF et fuite de credentials dans `axios`
- Path Traversal (`webpack-dev-middleware`)

**Impact global :**

- Surface d’attaque importante si l’environnement de build ou de dev est exposé.
- Risques élevés si l’application est déployée en production sans mise à jour.

**Recommandation générale :**

- Migrer vers `react-scripts@5.0.1` ou remplacer CRA par un setup plus moderne (Vite, etc.).
- Mettre à jour `axios` vers une version récente (`^1.x`).

---

### 1.2 Backend (Node.js / Express / JWT / Mongo)

Source : `npm audit` dans `backend/`.   

**Principales dépendances vulnérables :**

- `express` (via `body-parser`, `cookie`, `qs`, `send`, `path-to-regexp`, `serve-static`)
- `jsonwebtoken <= 8.5.1`
- `mongoose <= 6.13.5` via `mongodb 3.6.x` et `mpath`
- `express-session` (via `cookie`, `on-headers`)
- `nodemon` / `update-notifier` / `got` (dépendances de dev)

**Types de vulnérabilités :**

- DoS via `body-parser` (payloads URL-encodés volumineux)
- Prototype Pollution via `qs`
- ReDoS via `path-to-regexp`
- XSS via `send` (template injection)
- Mauvaise gestion des cookies (`cookie` < 0.7.0)
- Risques d’attaque sur la validation des JWT (`jsonwebtoken` 8.x)
- Fuites d’infos dans le driver MongoDB (logs/auth)

**Impact global :**

- Possibilité de crash de l’API (DoS)
- Surface de XSS côté fichiers statiques
- Risque de bypass ou de faiblesse sur la validation des tokens JWT
- Exposure potentielle de données d’authentification Mongo logging

**Recommandation générale :**

- Mettre à jour Express vers `4.22.1` ou plus récent (corrige `body-parser`, `qs`, `send`, `path-to-regexp`, etc.).
- Mettre à jour `jsonwebtoken` vers `^9.0.0` et expliciter l’algorithme (ex. `HS256`).
- Mettre à jour `mongoose` vers `^7/8` selon compatibilité.
- Mettre à jour ou supprimer les dépendances de dev vulnérables (`nodemon` / `got` / `update-notifier`).

---

## 2. Vulnérabilités applicatives – Frontend (`App.js`)

### 2.1 Clé "secrète" exposée dans le frontend

- **Fichier** : `frontend/src/App.js`
- **Description** : une clé de type `sk_live_...` est hardcodée dans le code React, et potentiellement loggée dans la console.
- **Impact** : toute personne qui charge l’application peut récupérer la clé (DevTools, bundle JS), et l’utiliser à des fins malveillantes.
- **Catégorie OWASP** : Sensitive Data Exposure / Hardcoded Credentials.
- **Recommandation** :
  - Ne jamais exposer de clé secrète dans le frontend.
  - Déporter l’appel vers le backend, qui lira la clé via variables d’environnement (`process.env`).

---

### 2.2 Token JWT stocké dans `localStorage` et loggué

- **Fichier** : `App.js`
- **Description** :
  - Le token JWT est stocké dans `localStorage`.
  - Le token est affiché dans la console.
- **Impact** :
  - En cas de XSS, le token peut être volé très facilement.
  - Les logs peuvent contenir des tokens valides.
- **Catégorie OWASP** : Broken Authentication / Session Management.
- **Recommandation** :
  - Utiliser des cookies `httpOnly` + `Secure` pour la gestion des sessions.
  - Ne jamais logger les tokens en clair.

---

### 2.3 Utilisation de `eval` sur de l’entrée utilisateur (recherche produit)

- **Fichier** : `App.js`
- **Description** : la recherche de produits utilise `eval()` avec la valeur tapée par l’utilisateur injectée dans une string JavaScript.
- **Impact** : un utilisateur peut injecter du code arbitraire exécuté dans le contexte de la page → XSS DOM / Code Injection.
- **Catégorie OWASP** : Injection.
- **Recommandation** :
  - Supprimer l’usage d’`eval`.
  - Utiliser directement :  
    `p.name.toLowerCase().includes(searchQuery.toLowerCase())`.

---

### 2.4 Usage massif de `dangerouslySetInnerHTML` avec données non filtrées

- **Fichier** : `App.js`
- **Description** :
  - Affichage de `product.name`, `selectedProduct.name`, `review.comment` via `dangerouslySetInnerHTML`.
- **Impact** :
  - Si le backend renvoie du HTML malveillant, c’est exécuté côté client (XSS stockée ou réfléchie).
- **Catégorie OWASP** : Cross-Site Scripting (XSS).
- **Recommandation** :
  - Remplacer l’affichage HTML par des éléments React classiques (texte).
  - Si HTML obligatoire : utiliser un sanitizer côté backend ou DOMPurify côté frontend.

---

### 2.5 Collecte naïve de numéro de carte bancaire

- **Fichier** : `App.js`
- **Description** : récupération du numéro de carte bancaire via un simple `prompt()` sans aucune validation ni masquage.
- **Impact** :
  - Non-conformité totale aux bonnes pratiques de sécurité carte (PCI-DSS).
  - Potentielle fuite de données sensibles via captures, logs ou extensions navigateur.
- **Catégorie OWASP** : Sensitive Data Exposure / Insecure Design.
- **Recommandation** :
  - Ne jamais manipuler de numéros de carte brute dans l’app.
  - Utiliser un prestataire externe (Stripe Checkout, etc.) et des tokens de paiement.

---

### 2.6 IDOR potentiel sur la consultation de profils utilisateurs

- **Fichier** : `App.js`
- **Description** : un champ permet de saisir un `userId`, qui est ensuite directement utilisé pour faire un appel `GET /users/:id` et afficher la réponse.
- **Impact** :
  - Si le backend ne vérifie pas les droits, un utilisateur peut consulter le profil de n’importe quel autre utilisateur.
- **Catégorie OWASP** : Broken Access Control (IDOR).
- **Recommandation** :
  - Côté backend : vérifier que l’ID demandé correspond à l’utilisateur connecté (ou qu’il a les droits).
  - Côté frontend : éviter d’exposer un outil "debug" de ce type aux utilisateurs finaux.

---

## 3. Vulnérabilités applicatives – Bacnd (`server.js`)

### 3.1 Secrets hardcodés dans le code

**Fichier** : `backend/server.js`  
**Extrait :**
const JWT_SECRET = process.env.JWT_SECRET || "sk_live_51Hqp9K2eZvKYlo2C8xO3n4y5z6a7b8c9d0e1f2g3h4i2b";
const SESSION_SECRET = process.env.SESSION_SECRET || "my-session-secret-key";
const STRIPE_SECRET_KEY = "sk_live_51Hqp9K2eZvKYlo2C8xO3n4y5z6a7b8c9d0e1f2g3h4i5p";
const ADMIN_API_KEY = "sk_live_51Hqp9K2eZvKYlo2C8xO3n4y5z6a7b8c9d0e1f2g3h4i3m";

**Description :**
Clés sensibles (JWT, session, Stripe-like, admin API key) codées en dur directement dans le fichier source.

**Impact :**
- Exposition immédiate des secrets via le dépôt Git, l’image Docker, etc.
- Si le repo est public ou compromis, un attaquant a un accès total (génération de JWT, paiements, admin).

**Catégorie OWASP :** Sensitive Data Exposure / Hardcoded Secrets.

**Recommandation :**
- Utiliser uniquement des variables d’environnement (`process.env.JWT_SECRET`).
- Ne jamais définir de valeurs par défaut de production dans le code.
- Mettre en place un fichier `.env` ajouté au `.gitignore`.

---

### 3.2 CORS trop permissif

**Fichier** : `server.js`  
**Extrait :**
app.use(cors({
    origin: '*',
    credentials: true
}));

**Description :**
La configuration CORS autorise toutes les origines (`*`) tout en autorisant les credentials.

**Impact :**
- Permet à n’importe quel site tiers d'effectuer des requêtes authentifiées vers l'API si le navigateur de la victime l'autorise.
- Absence totale de restriction de domaine.

**Catégorie OWASP :** Misconfiguration / Insecure CORS.

**Recommandation :**
- Restreindre `origin` à une liste blanche stricte (ex: `https://mon-front-end.com`).
- Ne jamais utiliser `*` avec `credentials: true` en production.

---

### 3.3 Cookies de session non sécurisés

**Fichier** : `server.js`  
**Extrait :**
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: false,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 jours
    }
}));

**Description :**
- `httpOnly: false` : Le cookie est accessible via JavaScript (document.cookie).
- `secure: false` : Le cookie transite en clair (HTTP).
- `saveUninitialized: true` : Création excessive de sessions vides.

**Impact :**
- Vol de session trivial en cas de faille XSS.
- Interception possible sur réseau non sécurisé (Wi-Fi public).

**Catégorie OWASP :** Broken Authentication / Session Management.

**Recommandation :**
- Passer à `httpOnly: true` et `secure: true` (en HTTPS).
- Réduire la durée de vie (`maxAge`) et définir `saveUninitialized: false`.

---

### 3.4 Mots de passe en clair (pas de hash)

**Fichier** : `server.js`  
**Extrait :**
db.users.push({
    id: 2,
    username: 'user',
    password: 'user123', // Stocké en clair
    ...
});

**Description :**
Les mots de passe sont stockés et comparés en texte clair dans la base de données.

**Impact :**
- En cas de fuite de la base de données (SQL Dump ou endpoint debug), tous les comptes utilisateurs sont immédiatement compromis sans effort de décryptage.

**Catégorie OWASP :** Cryptographic Failures.

**Recommandation :**
- Hacher systématiquement les mots de passe (bcrypt, argon2) avant stockage.
- Ne jamais stocker, logger ou afficher un mot de passe en clair.

---

### 3.5 Authentification contournable (Backdoor SQLi-like)

**Fichier** : `server.js`  
**Extrait :**
const user = db.users.find(u => {
    if (username.includes("' OR '1'='1")) {
        return true; // Backdoor
    }
    return u.username === username && u.password === password;
});

**Description :**
Une condition explicite permet de valider l'authentification si le nom d'utilisateur contient une chaîne spécifique typique d'une injection SQL (`' OR '1'='1`).

**Impact :**
- Un attaquant peut se connecter à n'importe quel compte ou en tant qu'admin sans connaître le mot de passe.

**Catégorie OWASP :** Injection / Broken Authentication.

**Recommandation :**
- Supprimer cette logique de backdoor.
- Ne jamais simuler d'injection SQL ou concaténer des entrées utilisateurs pour des requêtes.

---

### 3.6 JWT sans expiration ni restrictions

**Fichier** : `server.js`  
**Extrait :**
const token = jwt.sign(
    { id: user.id, ... },
    JWT_SECRET
    // Pas d'options
);

**Description :**
Le token JWT est généré sans option `expiresIn` et utilise l'algorithme par défaut sans validation explicite.

**Impact :**
- Les tokens générés sont valides à l'infini (sauf rotation du secret).
- Si un token est volé, l'attaquant a un accès permanent au compte.

**Catégorie OWASP :** Broken Authentication.

**Recommandation :**
- Ajouter une expiration courte : `jwt.sign(payload, secret, { expiresIn: '1h', algorithm: 'HS256' })`.
- Mettre en place un mécanisme de Refresh Token.

---

### 3.7 Absence de contrôle d’accès (RBAC) sur les routes sensibles

**Fichier** : `server.js`  
**Routes :** `/api/users`, `/api/users/:id`, `/api/admin/stats`, `/api/debug`

**Description :**
Aucun middleware ne vérifie si l'utilisateur est connecté ou s'il possède le rôle `admin` avant de renvoyer des données sensibles.

**Impact :**
- Tout visiteur (même non authentifié) peut lister tous les utilisateurs, voir les statistiques de vente ou accéder aux données de debug.
- IDOR (Insecure Direct Object Reference) possible sur `/api/users/:id`.

**Catégorie OWASP :** Broken Access Control.

**Recommandation :**
- Implémenter un middleware d’authentification (vérification JWT/Session).
- Vérifier les rôles (ex: `if (req.user.role !== 'admin') return res.sendStatus(403)`).

---

### 3.8 Endpoint de debug critique (Information Disclosure)

**Fichier** : `server.js`  
**Extrait :**
app.get('/api/debug', (req, res) => {
    res.json({
        env: process.env,
        secrets: { ... },
        database: db
    });
});

**Description :**
Un endpoint expose volontairement les variables d'environnement, les secrets d'API et le contenu complet de la base de données.

**Impact :**
- Compromission totale et immédiate de l'application et de l'infrastructure si accessible.

**Catégorie OWASP :** Security Misconfiguration / Sensitive Data Exposure.

**Recommandation :**
- Supprimer impérativement cet endpoint en production.
- Si nécessaire en dev, le protéger par une authentification forte et une restriction IP.

---

### 3.9 Path Traversal / Local File Inclusion

**Fichier** : `server.js`  
**Extrait :**
const content = fs.readFileSync(`./uploads/${filename}`, 'utf8');

**Description :**
Le paramètre `filename` provenant de l'URL est utilisé directement dans une fonction de système de fichiers sans nettoyage.

**Impact :**
- Un attaquant peut lire des fichiers arbitraires sur le serveur (ex: `../../package.json` ou fichiers système) via une attaque par traversée de répertoire.

**Catégorie OWASP :** Path Traversal.

**Recommandation :**
- Sanitiser le nom de fichier (supprimer `..`, `/`).
- Utiliser `path.basename()` ou une liste blanche de fichiers autorisés.

---

### 3.10 Injection de code (RCE) via eval()

**Fichier** : `server.js`  
**Extrait :**
const searchCode = `db.products.filter(...)`;
const results = eval(searchCode);

**Description :**
L'entrée utilisateur (`req.query.q`) est concaténée dans une chaîne de caractères qui est ensuite exécutée comme du code JavaScript via `eval()`.

**Impact :**
- Remote Code Execution (RCE). Un attaquant peut injecter du code JS arbitraire (ex: `process.exit()`, accès au système de fichiers, reverse shell).

**Catégorie OWASP :** Code Injection.

**Recommandation :**
- Bannir `eval()`.
- Utiliser des méthodes natives sécurisées (ex: `Array.prototype.filter` avec fonctions fléchées standards).

---

### 3.11 Cross-Site Scripting (XSS) stocké

**Fichier** : `server.js`  
**Extrait :**
db.reviews.push({ ..., comment: comment }); // Stockage brut

**Description :**
Les commentaires produits sont stockés sans aucun filtrage ni échappement HTML. Ils sont ensuite restitués tels quels (via `dangerouslySetInnerHTML` côté front).

**Impact :**
- XSS Persistante. Un attaquant peut stocker un script malveillant qui s'exécutera dans le navigateur de tous les utilisateurs visualisant le produit (vol de cookies, redirection).

**Catégorie OWASP :** Cross-Site Scripting (XSS).

**Recommandation :**
- Sanitiser les entrées côté serveur (ex: librairie `dompurify` ou `xss`).
- Échapper les données à l'affichage côté client.

---

### 3.12 Manque de validation des données (Checkout)

**Fichier** : `server.js`  
**Extrait :**
app.post('/api/checkout', (req, res) => {
    const { quantity, creditCard } = req.body;
    // Pas de validation
});

**Description :**
L'API accepte n'importe quelles données pour la commande (quantité négative, types invalides) et manipule des numéros de carte bancaire en clair.

**Impact :**
- Logique métier compromise (commandes gratuites ou remboursant l'utilisateur via quantité négative).
- Non-conformité PCI-DSS grave (manipulation de PAN en clair).

**Catégorie OWASP :** Insecure Design / Data Validation.

**Recommandation :**
- Valider strictement les types et plages de valeurs (quantité > 0).
- Ne jamais traiter les numéros de carte côté serveur applicatif : utiliser la tokenisation (Stripe Elements, etc.).

## 4. Conclusion globale

- Le projet est volontairement vulnérable (pédagogique).
- Les vulnérabilités se répartissent entre :
  - **Dépendances obsolètes** (npm audit, frontend + backend)
  - **Code frontend non sécurisé** (eval, dangerouslySetInnerHTML, gestion des tokens, données sensibles)
  - **backend à durcir** (JWT, Express, Mongo, validation d’entrée)

Ce document sert de base à la **Phase 1 : Analyse** du projet.
