/**
 * 🔄 BOURSE D'ÉCHANGE
 * Marketplace communautaire de pièces d'occasion & équipements via Firebase Firestore.
 * Sécurité : Validation des entrées (CIS 16.10), modération GuardianBot, textContent pour l'affichage (OWASP A03 - XSS).
 */

window.ExchangeMarket = {
  listings: [],
  filteredListings: [],
  firestoreUnsubscribe: null,
  userUnsubscribe: null,
  currentCategory: "all",
  searchQuery: "",
  priceTypeFilter: "all",
  stateFilter: "all",
  garageFilterActive: false,
  sortBy: "newest",
  userBvc: 0,

  init: function () {
    this.listenToUserBvc();
    this.listenToListings();
    this.setupUIListeners();
  },

  /**
   * Écoute en temps réel le solde BVC de l'utilisateur connecté via Firestore.
   */
  listenToUserBvc: function () {
    if (this.userUnsubscribe) this.userUnsubscribe();

    const checkUser = () => {
      if (!window.db) return;
      const user = firebase.auth().currentUser;
      if (user) {
        this.userUnsubscribe = window.db
          .collection("users")
          .doc(user.uid)
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              this.userBvc = data.bvc_points || data.bvcPoints || data.bvc || 0;
              if (window.session) {
                window.session.vehicleModel = data.vehicleModel || "universel";
              }
              localStorage.setItem("bvc_points", this.userBvc);
              this.updateBvcDisplay(this.userBvc);
              this.applyFiltersAndRender(); // Re-render in case vehicleModel changed
            }
          });
      } else {
        const localBvc = parseInt(localStorage.getItem("bvc_points")) || 1450;
        this.userBvc = localBvc;
        this.updateBvcDisplay(localBvc);
      }
    };

    if (window.firebase && firebase.auth()) {
      firebase.auth().onAuthStateChanged(() => checkUser());
    } else {
      checkUser();
    }
  },

  updateBvcDisplay: function (amount) {
    const el = document.getElementById("user-bvc-balance");
    if (el) {
      el.textContent = `${amount.toLocaleString("fr-FR")} BVC`;
    }
  },

  /**
   * Écoute en temps réel les annonces de la communauté dans Firestore.
   * Limite à 50 annonces pour éviter la surcharge (A11 OWASP - DoS).
   */
  listenToListings: function () {
    if (!window.db) {
      console.warn("[ExchangeMarket] Firestore non disponible.");
      return;
    }

    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();

    this.firestoreUnsubscribe = window.db
      .collection("exchange_listings")
      .orderBy("createdAt", "desc")
      .limit(50)
      .onSnapshot((snapshot) => {
        this.listings = [];
        snapshot.forEach((doc) => {
          this.listings.push({ id: doc.id, ...doc.data() });
        });
        this.applyFiltersAndRender();
      }, (error) => {
        console.error("[ExchangeMarket] Erreur d'écoute Firestore:", error);
      });
  },

  setupUIListeners: function () {
    const searchInput = document.getElementById("market-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFiltersAndRender();
      });
    }

    const sortSelect = document.getElementById("market-sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.sortBy = e.target.value;
        this.applyFiltersAndRender();
      });
    }

    const priceFilterSelect = document.getElementById("market-pricetype-select");
    if (priceFilterSelect) {
      priceFilterSelect.addEventListener("change", (e) => {
        this.priceTypeFilter = e.target.value;
        this.applyFiltersAndRender();
      });
    }

    const stateFilterSelect = document.getElementById("market-state-select");
    if (stateFilterSelect) {
      stateFilterSelect.addEventListener("change", (e) => {
        this.stateFilter = e.target.value;
        this.applyFiltersAndRender();
      });
    }

    const garageFilterToggle = document.getElementById("market-garage-filter");
    if (garageFilterToggle) {
      garageFilterToggle.addEventListener("change", (e) => {
        this.garageFilterActive = e.target.checked;
        this.applyFiltersAndRender();
      });
    }
  },

  setCategory: function (category, btnElement) {
    this.currentCategory = category;

    // Mise à jour des classes actives sur les boutons de filtre
    const buttons = document.querySelectorAll(".market-cat-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));
    if (btnElement) {
      btnElement.classList.add("active");
    }

    this.applyFiltersAndRender();
  },

  applyFiltersAndRender: function () {
    let result = [...this.listings];

    // Filtre par catégorie
    if (this.currentCategory !== "all") {
      result = result.filter((item) => {
        if (this.currentCategory === "mecanique") {
          return ["galets", "variateur", "pot", "moteur"].includes(item.category);
        }
        return item.category === this.currentCategory;
      });
    }

    // Filtre par type de prix
    if (this.priceTypeFilter !== "all") {
      result = result.filter((item) => item.priceType === this.priceTypeFilter);
    }

    // Filtre par état (neuf, occasion, service)
    if (this.stateFilter !== "all") {
      result = result.filter((item) => item.condition === this.stateFilter);
    }

    // Filtre Garage Virtuel
    if (this.garageFilterActive && window.session && window.session.vehicleModel) {
      const myVehicle = window.session.vehicleModel;
      if (myVehicle !== "universel") {
        result = result.filter((item) => {
          return !item.compatibility || item.compatibility === "universel" || item.compatibility === myVehicle;
        });
      }
    }

    // Filtre par recherche textuelle
    if (this.searchQuery) {
      result = result.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const seller = (item.seller || "").toLowerCase();
        return title.includes(this.searchQuery) || desc.includes(this.searchQuery) || seller.includes(this.searchQuery);
      });
    }

    // Tri
    result.sort((a, b) => {
      if (this.sortBy === "price_asc") return a.price - b.price;
      if (this.sortBy === "price_desc") return b.price - a.price;
      // Default: newest
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return dateB - dateA;
    });

    this.filteredListings = result;
    this.renderListings();
  },

  /**
   * Publie une nouvelle annonce dans Firestore.
   */
  publishListing: async function (title, description, priceType, price, category, condition, photoUrl, compatibility) {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session || window.session.isGuest) {
      alert("Vous devez être connecté pour publier une annonce.");
      return;
    }

    // Validation des entrées (CIS 16.10 - Secure by Design)
    title = (title || "").trim();
    description = (description || "").trim();
    price = parseFloat(price) || 0;
    photoUrl = (photoUrl || "").trim();

    if (!title || title.length < 3 || title.length > 100) {
      alert("Le titre doit contenir entre 3 et 100 caractères.");
      return;
    }
    if (description.length > 500) {
      alert("La description ne peut pas dépasser 500 caractères.");
      return;
    }
    if (price <= 0 || price > 50000) {
      alert("Le prix doit être compris entre 1 et 50 000.");
      return;
    }

    const listing = {
      title: title,
      description: description,
      priceType: priceType === "bvc" ? "bvc" : "euro",
      price: price,
      category: category || "autre",
      condition: condition || "good",
      compatibility: compatibility || "universel",
      photoUrl: photoUrl || "",
      seller: window.session.username || "Membre",
      sellerUid: firebase.auth().currentUser ? firebase.auth().currentUser.uid : "",
      status: "active",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Modération automatique GuardianBot
    if (
      window.GuardianBot &&
      !window.GuardianBot.analyzeContent("Annonce", listing, window.session.username)
    ) {
      return;
    }

    try {
      await window.db.collection("exchange_listings").add(listing);
      
      // Mettre à jour le profil utilisateur pour débloquer le Badge Mécano
      if (listing.sellerUid) {
        await window.db.collection('users').doc(listing.sellerUid).update({
            hasPublishedListing: true
        }).catch(e => console.warn("Erreur MAJ Badge Mécano:", e));
      }

      alert("🚀 Annonce publiée avec succès sur le réseau !");
      this.closePublishForm();
    } catch (e) {
      console.error("[ExchangeMarket] Publication échouée :", e);
      alert("Erreur lors de la publication de l'annonce.");
    }
  },

  /**
   * Réservation / Achat direct d'une annonce en Pts BVC ou demande de réservation.
   */
  reserveListing: async function (listingId, price, priceType) {
    if (!window.session || window.session.isGuest) {
      alert("Veuillez vous connecter pour effectuer un échange.");
      return;
    }

    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing) return;

    if (listing.status === "reserved" || listing.status === "sold") {
      alert("Cette article a déjà été réservé.");
      return;
    }

    if (priceType === "bvc") {
      if (this.userBvc < price) {
        alert(`Solde insuffisant ! Il vous manque ${price - this.userBvc} BVC pour procéder à la réservation.`);
        return;
      }

      if (!confirm(`Confirmer la réservation de "${listing.title}" pour ${price} Pts BVC ?`)) {
        return;
      }

      try {
        const user = firebase.auth().currentUser;
        if (!user || !window.db) throw new Error("Utilisateur non connecté");
        
        const userRef = window.db.collection("users").doc(user.uid);
        const listingRef = window.db.collection("exchange_listings").doc(listingId);

        await window.db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const listingDoc = await transaction.get(listingRef);

          if (!userDoc.exists) throw new Error("Utilisateur introuvable");
          if (!listingDoc.exists) throw new Error("Annonce introuvable");

          const currentBvc = userDoc.data().bvc_points || 0;
          if (currentBvc < price) throw new Error("Solde insuffisant");

          if (listingDoc.data().status === "reserved" || listingDoc.data().status === "sold") {
            throw new Error("Cette annonce a déjà été réservée par quelqu'un d'autre.");
          }

          transaction.update(userRef, { bvc_points: currentBvc - price });
          transaction.update(listingRef, {
            status: "reserved",
            buyer: window.session.username,
            reservedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        });

        // Contacter le vendeur automatiquement
        await this.contactSeller(listingId, listing.seller, `J'ai réservé ta pièce "${listing.title}" pour ${price} Pts BVC ! Merci de me contacter pour la remise.`);

        alert("✅ Réservation confirmée ! Les BVC ont été transférés et le vendeur a été notifié.");
      } catch (e) {
        console.error("[ExchangeMarket] Réservation échouée :", e);
        alert("Erreur lors du traitement de la réservation.");
      }
    } else {
      // Réservation en Euros
      this.contactSeller(listingId, listing.seller, `Bonjour ! Je souhaite acheter ta pièce "${listing.title}" au prix de ${price} €. Discutons des modalités de livraison.`);
    }
  },

  /**
   * Supprime une annonce (uniquement par son auteur).
   */
  deleteListing: async function (listingId, seller) {
    if (!window.session || window.session.username !== seller) {
      alert("Vous ne pouvez supprimer que vos propres annonces.");
      return;
    }
    if (!confirm("Voulez-vous vraiment supprimer cette annonce ?")) return;

    try {
      await window.db.collection("exchange_listings").doc(listingId).delete();
      alert("Annonce supprimée.");
    } catch (e) {
      console.error("[ExchangeMarket] Suppression échouée :", e);
    }
  },

  /**
   * Contacte le vendeur via la messagerie Firestore.
   */
  contactSeller: async function (listingId, sellerName, customMsg) {
    if (!window.session || window.session.isGuest) {
      alert("Connectez-vous d'abord pour envoyer un message.");
      return;
    }
    if (window.session.username === sellerName) {
      alert("Vous êtes le propriétaire de cette annonce !");
      return;
    }

    const messageText = customMsg || `Salut ! Je suis intéressé(e) par ton annonce sur la Marketplace. Est-elle toujours disponible ?`;

    try {
      await window.db.collection("exchange_messages").add({
        listingId: listingId,
        from: window.session.username,
        to: sellerName,
        message: messageText,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (!customMsg) {
        alert("✉️ Message envoyé au vendeur ! Il recevra une notification.");
      }
    } catch (e) {
      console.error("[ExchangeMarket] Contact échoué :", e);
      alert("Erreur lors de l'envoi du message.");
    }
  },

  // ==================== ICONS & LABELS ====================

  getCategoryIcon: function (cat) {
    const icons = {
      galets: "fa-gear",
      variateur: "fa-gears",
      pot: "fa-wind",
      carenage: "fa-shield-halved",
      pneus: "fa-circle-dot",
      equipement: "fa-helmet-safety",
      moteur: "fa-oil-can",
      autre: "fa-box-open",
    };
    return icons[cat] || icons.autre;
  },

  getCategoryLabel: function (cat) {
    const labels = {
      galets: "Galets",
      variateur: "Variateur",
      pot: "Échappement",
      carenage: "Carénage",
      pneus: "Pneus & Freins",
      equipement: "Équipement",
      moteur: "Moteur",
      autre: "Autre",
    };
    return labels[cat] || "Autre";
  },

  getConditionLabel: function (cond) {
    const labels = {
      new: "✨ Neuf",
      like_new: "🌟 Très bon état",
      good: "👍 Bon état",
      parts: "🛠️ Pour pièces",
    };
    return labels[cond] || "Bon état";
  },

  // ==================== RENDERING ====================

  renderListings: function () {
    const container = document.getElementById("exchange-listings-container");
    if (!container) return;

    if (this.filteredListings.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:50px 20px; background:rgba(15,20,30,0.5); border-radius:15px; border:1px dashed rgba(0,242,255,0.2);">
          <i class="fa-solid fa-box-open" style="font-size:3rem; color:#00f2ff; margin-bottom:15px; opacity:0.6;"></i>
          <h3 style="color:#fff; margin-bottom:8px;">Aucune annonce trouvée</h3>
          <p style="color:#888; font-size:0.9rem;">Modifiez vos filtres ou soyez le premier à publier une annonce dans cette catégorie !</p>
        </div>
      `;
      return;
    }

    let html = "";
    this.filteredListings.forEach((listing) => {
      const icon = this.getCategoryIcon(listing.category);
      const catLabel = this.getCategoryLabel(listing.category);
      const isBvc = listing.priceType === "bvc";
      const priceLabel = isBvc ? `${listing.price} Pts BVC` : `${listing.price.toFixed(2)} €`;

      const isService = listing.condition === "service";
      const isAffordable = listing.priceType === "bvc" && this.userBvc >= listing.price;
      
      let conditionBadge = "";
      let condLabel = "";
      if (isService) {
        conditionBadge = `<span class="badge" style="background: rgba(0, 242, 255, 0.2); color: #00f2ff; border-color: #00f2ff;"><i class="fa-solid fa-bolt"></i> Recharge</span>`;
        condLabel = "Service Recharge";
      } else {
        const conditionText = listing.condition === "neuf" ? "Neuf" : "Occasion";
        const conditionColor = listing.condition === "neuf" ? "#00ff88" : "#ffb703";
        conditionBadge = `<span class="badge" style="color: ${conditionColor}; border-color: ${conditionColor}">${conditionText}</span>`;
        condLabel = this.getConditionLabel(listing.condition);
      }
      
      const isOwner = window.session && window.session.username === listing.seller;
      const isReserved = listing.status === "reserved" || listing.status === "sold";
      const date = listing.createdAt?.toDate ? listing.createdAt.toDate().toLocaleDateString("fr-FR") : "";

      const imageContent = listing.photoUrl
        ? `<img src="${listing.photoUrl}" alt="Photo annonce" style="width:100%; height:100%; object-fit:cover; border-radius:10px;" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid ${icon}\\'></i>'">`
        : `<i class="fa-solid ${icon}"></i>`;

      html += `
        <div class="product-card" style="position:relative; ${isReserved ? 'opacity:0.75;' : ''}">
          ${isReserved ? `<div style="position:absolute; top:12px; left:12px; z-index:5; background:#ff0055; color:#fff; font-weight:bold; font-size:0.75rem; padding:4px 10px; border-radius:8px; box-shadow:0 0 10px rgba(255,0,85,0.6);">RÉSERVÉ</div>` : ''}
          <div class="product-img" style="position:relative;">
            ${imageContent}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="background:rgba(0,242,255,0.15); border:1px solid rgba(0,242,255,0.3); color:#00f2ff; padding:3px 10px; border-radius:12px; font-size:0.7rem; font-weight:600;">
              ${catLabel}
            </span>
            <span style="color:#aaa; font-size:0.7rem;">${condLabel}</span>
          </div>
          <h3 id="listing-title-${listing.id}" style="margin:5px 0; font-size:1.1rem; color:#fff; font-weight:600;"></h3>
          <p id="listing-desc-${listing.id}" style="color:#99a; font-size:0.85rem; line-height:1.4; height:38px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-bottom:12px;"></p>
          <div class="price-tag" style="display:flex; align-items:center; gap:8px;">
            ${isBvc ? `<i class="fa-brands fa-ethereum" style="color:#b700ff;"></i>` : `<i class="fa-solid fa-tag" style="color:#00f2ff;"></i>`}
            <span>${priceLabel}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; color:#667; font-size:0.75rem; margin-bottom:15px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
            <span><i class="fa-solid fa-user-circle"></i> <span id="listing-seller-${listing.id}"></span></span>
            ${date ? `<span><i class="fa-regular fa-clock"></i> ${date}</span>` : ""}
          </div>
          ${
            isOwner
              ? `<button class="buy-btn" style="background:linear-gradient(135deg, #ff4d4d, #cc0000);" onclick="ExchangeMarket.deleteListing('${listing.id}', '${listing.seller}')"><i class="fa-solid fa-trash-can"></i> Supprimer</button>`
              : isReserved
              ? `<button class="buy-btn" style="background:#333; color:#777; cursor:not-allowed;" disabled><i class="fa-solid fa-lock"></i> Indisponible</button>`
              : `<div style="display:flex; gap:8px;">
                  <button class="buy-btn" style="flex:1; background:linear-gradient(135deg, #00f2ff, #0077ff);" onclick="ExchangeMarket.reserveListing('${listing.id}', ${listing.price}, '${listing.priceType}')">
                    ${isBvc ? '<i class="fa-solid fa-cart-shopping"></i> Réserver' : '<i class="fa-solid fa-handshake"></i> Acheter'}
                  </button>
                  <button class="buy-btn" style="width:42px; padding:0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);" onclick="ExchangeMarket.contactSeller('${listing.id}', '${listing.seller}')" title="Contacter">
                    <i class="fa-solid fa-envelope"></i>
                  </button>
                </div>`
          }
        </div>
      `;
    });

    container.innerHTML = html;

    // Injection sécurisée via textContent (A03 OWASP - XSS Prevention)
    this.filteredListings.forEach((listing) => {
      const titleEl = document.getElementById(`listing-title-${listing.id}`);
      const descEl = document.getElementById(`listing-desc-${listing.id}`);
      const sellerEl = document.getElementById(`listing-seller-${listing.id}`);
      if (titleEl) titleEl.textContent = listing.title;
      if (descEl) descEl.textContent = listing.description;
      if (sellerEl) sellerEl.textContent = listing.seller;
    });
  },

  // ==================== FORM MODAL ====================

  openPublishForm: function () {
    let form = document.getElementById("exchange-publish-form");
    if (form) {
      form.style.display = "flex";
      return;
    }

    form = document.createElement("div");
    form.id = "exchange-publish-form";
    form.style = `
      position:fixed; top:0; left:0; width:100vw; height:100vh;
      background:rgba(6,9,19,0.96); z-index:50000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      color:#fff; font-family:'Inter',sans-serif; backdrop-filter:blur(20px); padding:20px; box-sizing:border-box;
    `;
    form.innerHTML = `
      <div style="width:100%; max-width:480px; background:rgba(20,25,40,0.8); border:1px solid rgba(0,242,255,0.3); border-radius:20px; padding:25px; box-shadow:0 0 30px rgba(0,242,255,0.2); position:relative; max-height:90vh; overflow-y:auto;">
        <button onclick="ExchangeMarket.closePublishForm()" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#889; font-size:1.5rem; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#889'">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div style="text-align:center; margin-bottom:20px;">
          <div style="width:50px; height:50px; background:rgba(0,242,255,0.1); border:1px solid #00f2ff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#00f2ff; font-size:1.5rem; margin-bottom:10px;">
            <i class="fa-solid fa-plus-circle"></i>
          </div>
          <h2 style="color:#fff; margin:0; font-size:1.4rem;">Publier une Annonce</h2>
          <p style="color:#889; font-size:0.85rem; margin-top:5px;">Vendez ou troquez vos pièces 50cc avec la communauté</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Titre de l'annonce *</label>
            <input type="text" id="ex-title" placeholder="ex: Galets Malossi 6.5g Neufs" maxlength="100" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
          </div>

          <div>
            <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Description *</label>
            <textarea id="ex-desc" placeholder="Précisez l'état, la compatibilité de la pièce (ex: Booster/MBK Nitro)..." maxlength="500" rows="3" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none; resize:none;"></textarea>
          </div>

          <div style="display:flex; gap:10px;">
            <div style="flex:1;">
              <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Catégorie *</label>
              <select id="ex-category" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                <option value="galets">⚙️ Galets</option>
                <option value="variateur">⚙️ Variateur</option>
                <option value="pot">💨 Échappement</option>
                <option value="carenage">🛡️ Carénage</option>
                <option value="pneus">🔘 Pneus & Freins</option>
                <option value="equipement">🪖 Équipement</option>
                <option value="moteur">🛢️ Moteur & Huile</option>
                <option value="autre">📦 Autre</option>
              </select>
            </div>

            <div style="flex:1;">
              <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">État *</label>
              <select id="ex-condition" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                <option value="good">Bon état</option>
                <option value="new">Neuf (Emballé)</option>
                <option value="like_new">Très bon état</option>
                <option value="parts">Pour pièces</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Compatibilité (Garage Virtuel) *</label>
            <select id="ex-compatibility" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
              <option value="universel">Universel</option>
              <option value="ami">Citroën Ami</option>
              <option value="kisbee">Peugeot Kisbee</option>
              <option value="booster">MBK Booster / Stunt</option>
              <option value="typhoon">Piaggio Typhoon</option>
              <option value="ludix">Peugeot Ludix</option>
              <option value="chatenet">Chatenet</option>
              <option value="aixam">Aixam</option>
            </select>
          </div>

          <div style="margin-top: 10px;">
            <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Lien Photo / Image (Optionnel)</label>
            <input type="url" id="ex-photourl" placeholder="https://..." style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
          </div>

          <div style="display:flex; gap:10px;">
            <div style="flex:2;">
              <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Prix *</label>
              <input type="number" id="ex-price" placeholder="Prix" min="1" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
            </div>
            <div style="flex:1;">
              <label style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Monnaie</label>
              <select id="ex-price-type" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                <option value="bvc">Pts BVC</option>
                <option value="euro">Euros (€)</option>
              </select>
            </div>
          </div>

          <button onclick="ExchangeMarket.publishListing(
            document.getElementById('ex-title').value,
            document.getElementById('ex-desc').value,
            document.getElementById('ex-price-type').value,
            document.getElementById('ex-price').value,
            document.getElementById('ex-category').value,
            document.getElementById('ex-condition').value,
            document.getElementById('ex-photourl').value,
            document.getElementById('ex-compatibility').value
          )" style="margin-top:10px; width:100%; background:linear-gradient(135deg, #00f2ff, #0077ff); color:#fff; border:none; padding:15px; border-radius:12px; font-weight:bold; font-size:1rem; cursor:pointer; box-shadow:0 0 15px rgba(0,242,255,0.3);">
            <i class="fa-solid fa-paper-plane"></i> Publier l'annonce
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(form);
  },

  closePublishForm: function () {
    const form = document.getElementById("exchange-publish-form");
    if (form) form.style.display = "none";
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    ExchangeMarket.init();
  }, 1000);
});
