# CORRECTIONS.md

Ce document décrit les **corrections prévues/appliquées** pour les vulnérabilités identifiées dans `VULNERABILITIES.md` (Phase 1 – Analyse) et servira de base à la branche `secure` du dépôt Git, conformément aux consignes du projet DevSecOps.   

---

## 1. Méthodologie de correction

- **Étape 1 – Analyse** : inventaire des vulnérabilités (SCA via `npm audit`, analyse manuelle frontend/backend). :contentReference[oaicite:1]{index=1}  
- **Étape 2 – Conception des corrections** : pour chaque vulnérabilité, définition :
  - de la **mesure technique** (patch de code / mise à jour dépendance),
  - de l’**impact sur la sécurité**,
  - de la **catégorie OWASP** associée.
- **Étape 3 – Implémentation** :
  - Corrections appliquées dans le code sur la branche `secure`.
  - Mise à jour des dépendances (`npm update`, `npm audit fix` si pertinent).
- **Étape 4 – Vérification** :
  - Relancer les audits (`npm audit` front/back).
  - Vérifier le comportement fonctionnel.
  - Vérifier que les secrets ne sont plus exposés et que les contrôles d’accès fonctionnent.

---

## 2. Corrections liées aux dépendances (`npm audit`)

### 2.1 Frontend (React / CRA / axios)

**Vulnérabilités identifiées :** dépendances vulnérables dans `react-scripts` 4.x, `webpack-dev-server`, écosystème PostCSS, `axios <= 0.30.1`, etc. (XSS, Prototype Pollution, DoS, SSRF). :contentReference[oaicite:2]{index=2}  

**Objectif :** réduire la surface d’attaque liée aux librairies tierces.

#### Actions de correction

1. **Mise à jour de `react-scripts`**
   - Passage de `react-scripts` 4.x à **5.x** (ou remplacement par Vite si souhaité).
   - Commandes typiques :
     ```bash
     cd frontend
     npm install react-scripts@latest
     npm audit fix
     ```
   - Ajustement éventuel de la config (scripts `start`, `build`, `test`).

2. **Mise à jour d’`axios`**
   - Dans `frontend/package.json` :
     ```json
     {
       "dependencies": {
         "axios": "^1.7.0"
       }
     }
     ```
   - Puis :
     ```bash
     npm install
     ```

3. **Vérification SCA post-correction**
   - Relancer :
     ```bash
     npm audit --production
     ```
   - Documenter les éventuelles vulnérabilités restantes (faible criticité ou non patchées upstream).

**Résultat attendu :**
- Diminution du nombre de vulnérabilités connues sur le frontend.
- Pas de vulnérabilités **CRITICAL/HIGH** ignorées sans justification.

---

### 2.2 Backend (Express / JWT / Mongo)

**Vulnérabilités identifiées :** dépendances obsolètes (`express`, `jsonwebtoken`, `mongoose`, etc.) avec risques DoS, Prototype Pollution, problèmes de validation JWT. :contentReference[oaicite:3]{index=3}  

#### Actions de correction

1. **Mise à jour d’Express et dépendances associées**
   - Dans `backend/package.json`, mise à jour d’`express` vers une version récente (ex. `^4.22.x`).
   - Exemple :
     ```bash
     cd backend
     npm install express@latest
     npm audit fix
     ```

2. **Mise à jour de `jsonwebtoken`**
   - Passage vers `jsonwebtoken@^9.x` pour corriger les vulnérabilités connues.
   - Dans `package.json` :
     ```json
     {
       "dependencies": {
         "jsonwebtoken": "^9.0.0"
       }
     }
     ```

3. **Mise à jour ou rationalisation des dépendances Mongo**
   - Mise à jour de `mongoose` vers une version supportée (7/8 selon compatibilité).
   - Si Mongo n’est pas utilisé réellement (DB in-memory dans ce projet), limiter l’usage et/ou supprimer les dépendances inutiles.

4. **Vérification SCA backend**
   - Relancer :
     ```bash
     npm audit --production
     ```
   - Documenter les vulnérabilités restantes, si non corrigibles (en indiquant pourquoi).

---

## 3. Corrections applicatives – Frontend (`App.js`)

### 3.1 Clé secrète exposée dans le frontend

**Problème :** Clé de type `sk_live_...` hardcodée dans `App.js` et potentiellement loggée. :contentReference[oaicite:4]{index=4}  

#### Correction appliquée/proposée

- **Suppression complète** de toute clé secrète côté frontend.
- Les appels nécessitant des secrets sont déplacés vers le **backend**.

**Avant (schéma) :**
```js
// App.js
const SECRET_KEY = "sk_live_...";
console.log("Secret:", SECRET_KEY);

Après (schéma) :

// App.js
// Aucune clé secrète ici
// On appelle une route sécurisée du backend
fetch("/api/payment-intent", {
  method: "POST",
  credentials: "include",
});



3.2 JWT dans localStorage + log des tokens

Problème : stockage du token dans localStorage + affichage dans la console. 

Correction appliquée/proposée

Remplacement du stockage localStorage par une session basée sur cookie httpOnly + Secure émis par le backend.

Suppression de tous les console.log(token).


Avant :

localStorage.setItem("token", data.token);
console.log("JWT:", data.token);

Après :

// Le backend pose un cookie de session sécurisé à la connexion
// Côté frontend, pas de stockage manuel du token
// et plus aucun log de token.

3.3 eval() dans la recherche produit

Problème : utilisation d’eval() avec une chaîne contenant la requête utilisateur pour filtrer les produits. 

Correction appliquée/proposée

Suppression totale de eval().

Utilisation de la méthode filter() avec comparaison de chaînes simple.

Avant :

const searchCode = `products.filter(p => p.name.toLowerCase().includes('${query}'.toLowerCase()))`;
const results = eval(searchCode);


Après :

const results = products.filter(p =>
  p.name.toLowerCase().includes(query.toLowerCase())
);

3.4 dangerouslySetInnerHTML avec données non filtrées

Problème : affichage de product.name, review.comment, etc. via dangerouslySetInnerHTML. 

Correction appliquée/proposée

Remplacement de dangerouslySetInnerHTML par des expressions JSX normales.

Si HTML riche indispensable : appliquer un sanitizer côté back ou utiliser DOMPurify côté front.

Avant :

<div dangerouslySetInnerHTML={{ __html: product.name }} />


Après (texte simple) :

<div>{product.name}</div>


Ou (HTML + nettoyage côté back) :

<div dangerouslySetInnerHTML={{ __html: sanitizedProductName }} />

3.5 Collecte naïve du numéro de carte bancaire

Problème : saisie du numéro de carte via prompt() et en clair. 

Correction appliquée/proposée

Suppression du prompt et de toute collecte de PAN côté frontend.

Intégration d’un PSP (Stripe Checkout, Payment Element, etc.) :

Le frontend n’envoie jamais le numéro de carte,

Le backend ne voit que des tokens (ex: payment_method_id).

Avant (schéma) :

const creditCard = prompt("Entrez votre numéro de carte:");
fetch("/api/checkout", { method: "POST", body: JSON.stringify({ creditCard }) });


Après (schéma) :

// Utilisation d’un widget Stripe ou autre
// Le frontend reçoit un token de paiement
fetch("/api/checkout", {
  method: "POST",
  body: JSON.stringify({ paymentMethodId }),
});

3.6 IDOR potentiel sur /users/:id

Problème : saisie libre d’un userId pour requêter /users/:id sans contrôle de droits côté front. 

Correction appliquée/proposée

Côté frontend : suppression de tout champ "debug" permettant de saisir un ID arbitraire pour afficher un profil.

Côté backend (cf. section backend) : ajout de contrôles d’accès (l’utilisateur ne peut voir que son propre profil, sauf rôle admin).

Avant (schéma) :

const id = prompt("ID utilisateur ?");
fetch(`/api/users/${id}`).then(...);


Après (schéma) :

// Le frontend se base sur l’utilisateur connecté
fetch("/api/me").then(...); // géré par le backend via le JWT/cookie

4. Corrections applicatives – Backend (server.js)
4.1 Secrets hardcodés dans le code

Problème : JWT_SECRET, SESSION_SECRET, STRIPE_SECRET_KEY, ADMIN_API_KEY codés en dur dans server.js. 

Correction appliquée/proposée

Créer un fichier .env (non committé) :

JWT_SECRET=changeme_jwt
SESSION_SECRET=changeme_session
STRIPE_SECRET_KEY=sk_live_xxx
ADMIN_API_KEY=admin_xxx


Utiliser dotenv dans server.js :

require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;


Ajouter .env au .gitignore.

4.2 CORS trop permissif

Problème : origin: '*' + credentials: true. 

Correction appliquée/proposée

Configuration CORS avec whitelist des origines autorisées en production.

Avant :

app.use(cors({
  origin: '*',
  credentials: true
}));


Après :

const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:3000"];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true
}));

4.3 Cookies de session non sécurisés

Problème : httpOnly: false, secure: false, saveUninitialized: true. 

Correction appliquée/proposée

Avant :

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: false,
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));


Après :

const isProd = process.env.NODE_ENV === "production";

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,       // true en prod + HTTPS
    httpOnly: true,       // non accessible en JS
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
  }
}));

4.4 Mots de passe en clair → hash (bcrypt)

Problème : stockage et comparaison des mots de passe en clair. 

Correction appliquée/proposée

Ajouter bcrypt dans backend :

npm install bcrypt


Au moment de l’inscription :
Avant :

const newUser = {
  id: db.users.length + 1,
  username,
  password,
  email,
  role: 'customer'
};


Après :

const bcrypt = require("bcrypt");
const hashedPassword = await bcrypt.hash(password, 10);

const newUser = {
  id: db.users.length + 1,
  username,
  password: hashedPassword,
  email,
  role: "customer"
};


À la connexion :

const user = db.users.find(u => u.username === username);
if (!user) return res.status(401).json({ message: "Invalid credentials" });

const ok = await bcrypt.compare(password, user.password);
if (!ok) return res.status(401).json({ message: "Invalid credentials" });

4.5 Backdoor / Auth contournable (' OR '1'='1)

Problème : condition explicite permettant de bypasser l’auth. 

Correction appliquée/proposée

Avant :

const user = db.users.find(u => {
  if (username.includes("' OR '1'='1")) {
    return true;
  }
  return u.username === username && u.password === password;
});


Après :

const user = db.users.find(u => u.username === username);
if (!user) { ... }
// Vérification via bcrypt (cf. 4.4)


Suppression complète de toute logique de backdoor ou d’“émulation” SQLi.

4.6 JWT sans expiration ni algo explicite

Problème : jwt.sign sans expiresIn ni algorithm. 

Correction appliquée/proposée

Avant :

const token = jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  JWT_SECRET
);


Après :

const token = jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  JWT_SECRET,
  {
    expiresIn: "1h",
    algorithm: "HS256"
  }
);


Mise en place, si besoin, d’un mécanisme de refresh token et de blacklist (en option avancée).

4.7 Absence de contrôle d’accès sur routes sensibles

Problème : /api/users, /api/users/:id, /api/admin/stats, /api/debug accessibles sans auth ni vérification de rôle. 

Correction appliquée/proposée

Middleware d’authentification (JWT) :

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.sendStatus(403);
  next();
}


Protection des routes :

app.get("/api/users", authMiddleware, adminOnly, (req, res) => { ... });
app.get("/api/users/:id", authMiddleware, (req, res) => {
  if (req.user.role !== "admin" && req.user.id !== Number(req.params.id)) {
    return res.sendStatus(403);
  }
  // renvoyer les infos de l'utilisateur
});

app.get("/api/admin/stats", authMiddleware, adminOnly, (req, res) => { ... });


Suppression / restriction de /api/debug (cf. 4.8).

4.8 Endpoint /api/debug qui leak tout

Problème : expose process.env, secrets et la base entière. 

Correction appliquée/proposée

En production : suppression pure et simple.

En développement : éventuellement gardé mais :

derrière authMiddleware + adminOnly,

et sans secrets.

Après (option dev uniquement) :

if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug", authMiddleware, adminOnly, (req, res) => {
    res.json({
      env: {
        NODE_ENV: process.env.NODE_ENV
      },
      databaseSummary: {
        usersCount: db.users.length,
        productsCount: db.products.length
      }
    });
  });
}

4.9 Path Traversal / LFI sur /api/files/:filename

Problème : filename utilisé directement dans fs.readFileSync("./uploads/" + filename). 

Correction appliquée/proposée

Utilisation de path et sécurisation du nom de fichier :

const path = require("path");
app.get("/api/files/:filename", (req, res) => {
  const filename = path.basename(req.params.filename); // enlève ../
  const fullPath = path.join(__dirname, "uploads", filename);

  fs.readFile(fullPath, "utf8", (err, content) => {
    if (err) return res.status(404).json({ message: "Fichier non trouvé" });
    res.send(content);
  });
});


Option : limiter aux fichiers connus (liste blanche) ou à certaines extensions.

4.10 Injection de code via eval (recherche produits)

Problème : eval(searchCode) avec query utilisateur. 

Correction appliquée/proposée

Avant :

const searchCode = `db.products.filter(p => p.name.toLowerCase().includes('${query}'.toLowerCase()))`;
const results = eval(searchCode);


Après :

const q = (query || "").toLowerCase();
const results = db.products.filter(p =>
  p.name.toLowerCase().includes(q)
);


eval totalement supprimé, aucune exécution dynamique de code.

4.11 XSS stockée via commentaires produits

Problème : comment stocké tel quel, renvoyé puis affiché avec dangerouslySetInnerHTML. 

Correction appliquée/proposée

Sanitisation côté backend :

Utilisation d’une bibliothèque de nettoyage (ex: xss ou équivalent) :

const xss = require("xss");

app.post("/api/products/:id/review", (req, res) => {
  const { rating, comment } = req.body;
  const safeComment = xss(comment || "");

  const review = {
    id: Date.now(),
    productId,
    rating,
    comment: safeComment,
    date: new Date()
  };

  db.reviews.push(review);
  res.status(201).json(review);
});


Côté frontend : afficher les commentaires en texte simple (cf. 3.4) autant que possible.

4.12 Manque de validation sur /api/checkout

Problème : aucun contrôle sur userId, productId, quantity, creditCard. 

Correction appliquée/proposée

Validation des données (exemple simple sans lib) :

app.post("/api/checkout", authMiddleware, (req, res) => {
  const { userId, productId, quantity, paymentMethodId } = req.body;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "Quantité invalide" });
  }

  const product = db.products.find(p => p.id === Number(productId));
  if (!product) {
    return res.status(404).json({ message: "Produit introuvable" });
  }

  if (req.user.id !== Number(userId) && req.user.role !== "admin") {
    return res.status(403).json({ message: "Accès interdit" });
  }

  // Appel au PSP avec paymentMethodId (pas de carte brute)
  res.status(200).json({ message: "Commande validée (simulation)" });
});


Suppression de tout champ creditCard :

Utilisation exclusive de tokens de paiement fournis par un PSP (cf. 3.5).
