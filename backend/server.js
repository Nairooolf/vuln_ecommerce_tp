// backend/server.js - version sécurisée (branche `secure`)

require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5001;

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Secrets chargés depuis .env (dev fallback, mais ne PAS utiliser en prod tel quel)
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev_session_secret_change_me";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "dev_stripe_key_change_me";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "dev_admin_key_change_me";

// ============================================
// Middlewares globaux
// ============================================

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000")
        .split(",")
        .map(o => o.trim());

      // Autoriser requêtes sans origin (curl, Postman…)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    },
  })
);

// ============================================
// "Base de données" in-memory
// ============================================

const db = {
  users: [],
  products: [],
  orders: [],
  reviews: [],
};

// Seed users (admin + user) avec hash de mot de passe
(function seedUsers() {
  if (!db.users.find(u => u.username === "admin")) {
    const adminHashed = bcrypt.hashSync("admin123", 10);
    db.users.push({
      id: 1,
      username: "admin",
      password: adminHashed,
      email: "admin@ecommerce.com",
      role: "admin",
      apiKey: ADMIN_API_KEY,
      stripeKey: STRIPE_SECRET_KEY,
    });
  }

  if (!db.users.find(u => u.username === "user")) {
    const userHashed = bcrypt.hashSync("user123", 10);
    db.users.push({
      id: 2,
      username: "user",
      password: userHashed,
      email: "user@example.com",
      role: "customer",
    });
  }
})();

db.products = [
  { id: 1, name: "Laptop HP", price: 799, stock: 10, category: "electronics" },
  { id: 2, name: "iPhone 14", price: 999, stock: 15, category: "electronics" },
  { id: 3, name: "T-Shirt Nike", price: 29, stock: 50, category: "clothing" },
  { id: 4, name: "Chaussures Adidas", price: 89, stock: 30, category: "clothing" },
];

// ============================================
// Helpers
// ============================================

function sanitize(str) {
  return String(str || "").replace(/[&<>"]/g, c => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return map[c] || c;
  });
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
      algorithm: "HS256",
    }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  const token = bearerToken || req.session.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = payload;
    next();
  });
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date(), env: NODE_ENV });
});

// Recherche produits (sans eval)
app.get("/api/products/search", (req, res) => {
  const query = (req.query.q || "").toLowerCase();

  const results = db.products.filter(p =>
    p.name.toLowerCase().includes(query)
  );

  res.json(results);
});

// Inscription (REGISTER) avec hash
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ message: "Username, password and email are required" });
    }

    const existing = db.users.find(
      u => u.username === username || u.email === email
    );
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: db.users.length + 1,
      username,
      password: hashedPassword,
      email,
      role: "customer",
    };

    db.users.push(newUser);

    res.json({
      success: true,
      message: "Utilisateur créé",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Login (sans backdoor, sans mot de passe en clair)
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = db.users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }

    const token = generateToken(user);
    req.session.token = token;

    res.json({
      success: true,
      token,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Liste des utilisateurs (admin only, sans mots de passe)
app.get("/api/users", authMiddleware, adminOnly, (req, res) => {
  const safeUsers = db.users.map(u => {
    const { password, apiKey, stripeKey, ...rest } = u;
    return rest;
  });
  res.json(safeUsers);
});

// Détail user (lui-même ou admin)
app.get("/api/users/:id", authMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ message: "Utilisateur non trouvé" });
  }

  if (req.user.role !== "admin" && req.user.id !== userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { password, apiKey, stripeKey, ...safeUser } = user;
  res.json(safeUser);
});

// Ajout d’un avis produit (sanitisation)
app.post("/api/products/:id/review", authMiddleware, (req, res) => {
  const productId = Number(req.params.id);
  const { rating, comment } = req.body;

  const product = db.products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ message: "Produit non trouvé" });
  }

  const numRating = Number(rating);
  if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  }

  const review = {
    id: Date.now(),
    productId,
    rating: numRating,
    comment: sanitize(comment),
    date: new Date(),
    userId: req.user.id,
  };

  db.reviews.push(review);

  res.json({
    success: true,
    review,
  });
});

// Récupération des avis
app.get("/api/products/:id/reviews", (req, res) => {
  const productId = Number(req.params.id);
  const productReviews = db.reviews.filter(r => r.productId === productId);
  res.json(productReviews);
});

// Liste des produits
app.get("/api/products", (req, res) => {
  res.json(db.products);
});

// Checkout sécurisé (pas de creditCard brut, validation, auth)
app.post("/api/checkout", authMiddleware, (req, res) => {
  const { userId, productId, quantity, paymentMethodId } = req.body;

  const uid = Number(userId);
  const pid = Number(productId);
  const qty = Number(quantity);

  if (!Number.isInteger(uid) || !Number.isInteger(pid) || !Number.isInteger(qty)) {
    return res.status(400).json({ message: "Invalid userId/productId/quantity" });
  }

  if (qty <= 0) {
    return res.status(400).json({ message: "Quantity must be positive" });
  }

  if (!paymentMethodId || typeof paymentMethodId !== "string") {
    return res.status(400).json({ message: "Invalid payment method" });
  }

  if (req.user.id !== uid && req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  const product = db.products.find(p => p.id === pid);
  if (!product) {
    return res.status(404).json({ message: "Produit non trouvé" });
  }

  if (product.stock < qty) {
    return res.status(400).json({ message: "Stock insuffisant" });
  }

  product.stock -= qty;

  const order = {
    id: db.orders.length + 1,
    userId: uid,
    productId: pid,
    quantity: qty,
    total: product.price * qty,
    date: new Date(),
    paymentMethodId,
  };

  db.orders.push(order);

  res.json({
    success: true,
    order,
  });
});

// Stats admin (sans exposer secrets)
app.get("/api/admin/stats", authMiddleware, adminOnly, (req, res) => {
  res.json({
    totalUsers: db.users.length,
    totalProducts: db.products.length,
    totalOrders: db.orders.length,
    users: db.users.map(u => {
      const { password, apiKey, stripeKey, ...rest } = u;
      return rest;
    }),
    orders: db.orders,
  });
});

// Lecture de fichiers sécurisée (admin only, path traversal protégé)
app.get("/api/files/:filename", authMiddleware, adminOnly, (req, res) => {
  const filename = path.basename(req.params.filename);
  const fullPath = path.join(__dirname, "uploads", filename);

  fs.readFile(fullPath, "utf8", (err, content) => {
    if (err) {
      return res.status(404).json({ message: "Fichier non trouvé" });
    }
    res.send(content);
  });
});

// Endpoint debug : seulement en dev + admin, sans secrets
if (!isProd) {
  app.get("/api/debug", authMiddleware, adminOnly, (req, res) => {
    res.json({
      env: {
        NODE_ENV,
        PORT,
      },
      databaseSummary: {
        usersCount: db.users.length,
        productsCount: db.products.length,
        ordersCount: db.orders.length,
        reviewsCount: db.reviews.length,
      },
    });
  });
}

// Route par défaut
app.get("/", (req, res) => {
  res.json({
    endpoints: [
    `
- GET /health
- GET /api/products
- GET /api/products/search?q=query
- POST /api/register
- POST /api/login
- GET /api/users          (admin)
- GET /api/users/:id      (self ou admin)
- POST /api/products/:id/review
- GET /api/products/:id/reviews
- POST /api/checkout
- GET /api/admin/stats    (admin)
- GET /api/files/:filename (admin)
- GET /api/debug (dev + admin only)
    `
    ],
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur sécurisé démarré sur le port ${PORT} (${NODE_ENV})`);
});
