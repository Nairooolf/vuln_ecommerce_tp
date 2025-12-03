import React, { useEffect, useState } from 'react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

function decodeJwt(token) {
  try {
    const base64Payload = token.split('.')[1];
    const jsonPayload = atob(base64Payload);
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

function App() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reviews, setReviews] = useState([]);

  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });

  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [checkoutQuantity, setCheckoutQuantity] = useState(1);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // ----------------------------------
  // Helpers
  // ----------------------------------

  const resetMessages = () => {
    setMessage(null);
    setError(null);
  };

  const authHeaders = () => {
    if (!authToken) return {};
    return { Authorization: `Bearer ${authToken}` };
  };

  // ----------------------------------
  // API Calls
  // ----------------------------------

  const fetchProducts = async () => {
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`);
      if (!res.ok) {
        throw new Error('Erreur lors du chargement des produits');
      }
      const data = await res.json();
      setProducts(data);
      setFilteredProducts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (productId) => {
    resetMessages();
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${productId}/reviews`);
      if (!res.ok) {
        throw new Error('Erreur lors du chargement des avis');
      }
      const data = await res.json();
      setReviews(data || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value || '';
    setSearchQuery(value);
    const lower = value.toLowerCase();
    const filtered = products.filter((p) =>
      p.name.toLowerCase().includes(lower)
    );
    setFilteredProducts(filtered);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setCheckoutQuantity(1);
    setReviewForm({ rating: 5, comment: '' });
    fetchReviews(product.id);
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleReviewChange = (e) => {
    const { name, value } = e.target;
    setReviewForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckoutQuantityChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) {
      setCheckoutQuantity(1);
      return;
    }
    setCheckoutQuantity(Math.max(1, value));
  };

  // ----------------------------------
  // Auth
  // ----------------------------------

  const handleLogin = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!loginForm.username || !loginForm.password) {
      setError('Veuillez renseigner un nom d’utilisateur et un mot de passe.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      if (!res.ok) {
        throw new Error('Identifiants incorrects');
      }

      const data = await res.json();
      if (!data.token) {
        throw new Error('Réponse de login invalide (token manquant)');
      }

      const payload = decodeJwt(data.token);
      setAuthToken(data.token);
      setCurrentUser(
        payload
          ? { id: payload.id, username: payload.username, role: payload.role }
          : null
      );
      setMessage('Connexion réussie');
    } catch (e) {
      setError(e.message);
      setAuthToken(null);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      setError('Veuillez remplir tous les champs pour créer un compte.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la création du compte');
      }

      const data = await res.json();
      setMessage(data.message || 'Compte créé avec succès, vous pouvez vous connecter.');
      setRegisterForm({ username: '', email: '', password: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    resetMessages();
    setAuthToken(null);
    setCurrentUser(null);
    setMessage('Déconnexion effectuée.');
  };

  // ----------------------------------
  // Reviews & Checkout
  // ----------------------------------

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!selectedProduct) {
      setError('Veuillez sélectionner un produit avant de laisser un avis.');
      return;
    }

    if (!reviewForm.comment.trim()) {
      setError('Le commentaire ne peut pas être vide.');
      return;
    }

    const rating = Number(reviewForm.rating);
    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      setError('La note doit être comprise entre 1 et 5.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/products/${selectedProduct.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          rating,
          comment: reviewForm.comment.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error('Erreur lors de l’envoi de l’avis.');
      }

      const data = await res.json();
      setMessage('Avis envoyé avec succès.');
      setReviewForm({ rating: 5, comment: '' });

      // Rafraîchir la liste des avis
      if (data.review && data.review.productId) {
        fetchReviews(data.review.productId);
      } else if (selectedProduct) {
        fetchReviews(selectedProduct.id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    resetMessages();

    if (!authToken || !currentUser) {
      setError('Vous devez être connecté pour passer une commande.');
      return;
    }

    if (!selectedProduct) {
      setError('Veuillez sélectionner un produit.');
      return;
    }

    const quantity = Number(checkoutQuantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      setError('La quantité doit être un entier strictement positif.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          productId: selectedProduct.id,
          quantity,
          // On ne transmet PAS de numéro de carte ici.
          // Supposé : backend utilise un PSP externe ou un token.
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || 'Erreur lors du checkout.';
        throw new Error(msg);
      }

      const data = await res.json();
      setMessage(`Commande validée. Total: ${data.order?.total ?? 'N/A'} €`);
      fetchProducts(); // met à jour les stocks
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------
  // Initial load
  // ----------------------------------

  useEffect(() => {
    fetchProducts();
  }, []);

  // ----------------------------------
  // Render
  // ----------------------------------

  return (
    <div className="App">
      <header className="App-header">
        <h1>E-Commerce sécurisé (DevSecOps)</h1>
        <p>Version frontend durcie (pas de secrets, pas d&apos;eval, pas de XSS).</p>
      </header>

      <main className="App-main">
        {/* Messages globaux */}
        {(message || error || loading) && (
          <div className="status-bar">
            {loading && <div className="status loading">Chargement...</div>}
            {message && <div className="status success">{message}</div>}
            {error && <div className="status error">{error}</div>}
          </div>
        )}

        {/* Auth / Profil */}
        <section className="panel auth-panel">
          <h2>Authentification</h2>

          {currentUser ? (
            <div className="auth-info">
              <p>
                Connecté en tant que <strong>{currentUser.username}</strong>
                {currentUser.role && (
                  <>
                    {' '}
                    (<em>{currentUser.role}</em>)
                  </>
                )}
              </p>
              <button type="button" onClick={handleLogout}>
                Se déconnecter
              </button>
            </div>
          ) : (
            <div className="auth-forms">
              <form onSubmit={handleLogin} className="auth-form">
                <h3>Connexion</h3>
                <label>
                  Nom d&apos;utilisateur
                  <input
                    type="text"
                    name="username"
                    value={loginForm.username}
                    onChange={handleLoginChange}
                    autoComplete="username"
                  />
                </label>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    name="password"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    autoComplete="current-password"
                  />
                </label>
                <button type="submit" disabled={loading}>
                  Se connecter
                </button>
              </form>

              <form onSubmit={handleRegister} className="auth-form">
                <h3>Créer un compte</h3>
                <label>
                  Nom d&apos;utilisateur
                  <input
                    type="text"
                    name="username"
                    value={registerForm.username}
                    onChange={handleRegisterChange}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                  />
                </label>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    name="password"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                  />
                </label>
                <button type="submit" disabled={loading}>
                  S&apos;inscrire
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Produits & recherche */}
        <section className="panel products-panel">
          <h2>Produits</h2>

          <div className="search-bar">
            <label>
              Recherche produits
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </label>
          </div>

          <div className="products-list">
            {filteredProducts.length === 0 && <p>Aucun produit trouvé.</p>}
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`product-card ${
                  selectedProduct && selectedProduct.id === product.id ? 'selected' : ''
                }`}
                onClick={() => handleSelectProduct(product)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectProduct(product);
                }}
              >
                <h3>{product.name}</h3>
                <p>Catégorie : {product.category}</p>
                <p>Prix : {product.price} €</p>
                <p>Stock : {product.stock}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Détails produit, avis, checkout */}
        <section className="panel details-panel">
          <h2>Détails & Avis</h2>

          {!selectedProduct && <p>Sélectionnez un produit dans la liste.</p>}

          {selectedProduct && (
            <>
              <div className="product-details">
                <h3>{selectedProduct.name}</h3>
                <p>Catégorie : {selectedProduct.category}</p>
                <p>Prix : {selectedProduct.price} €</p>
                <p>Stock disponible : {selectedProduct.stock}</p>
              </div>

              <div className="checkout-section">
                <h3>Commander ce produit</h3>
                <label>
                  Quantité
                  <input
                    type="number"
                    min="1"
                    value={checkoutQuantity}
                    onChange={handleCheckoutQuantityChange}
                  />
                </label>
                <button type="button" onClick={handleCheckout} disabled={loading}>
                  Valider la commande
                </button>
              </div>

              <div className="reviews-section">
                <h3>Avis</h3>
                {(!reviews || reviews.length === 0) && (
                  <p>Aucun avis pour ce produit pour l&apos;instant.</p>
                )}
                <ul className="reviews-list">
                  {reviews.map((review) => (
                    <li key={review.id} className="review-item">
                      <strong>Note : {review.rating}/5</strong>
                      <p>{review.comment}</p>
                      <span className="review-date">
                        {review.date ? new Date(review.date).toLocaleString() : ''}
                      </span>
                    </li>
                  ))}
                </ul>

                <form onSubmit={handleSubmitReview} className="review-form">
                  <h4>Laisser un avis</h4>
                  <label>
                    Note (1-5)
                    <input
                      type="number"
                      name="rating"
                      min="1"
                      max="5"
                      value={reviewForm.rating}
                      onChange={handleReviewChange}
                    />
                  </label>
                  <label>
                    Commentaire
                    <textarea
                      name="comment"
                      value={reviewForm.comment}
                      onChange={handleReviewChange}
                      rows={3}
                    />
                  </label>
                  <button type="submit" disabled={loading}>
                    Envoyer l&apos;avis
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
