/**
 * 🔄 BOURSE D'ÉCHANGE
 * Marketplace communautaire de pièces d'occasion via Firebase Firestore.
 * Sécurité : Validation des entrées, modération GuardianBot, textContent pour l'affichage.
 */

window.ExchangeMarket = {

    listings: [],
    firestoreUnsubscribe: null,

    init: function() {
        this.listenToListings();
        console.log("[ExchangeMarket] Module chargé.");
    },

    /**
     * Écoute en temps réel les annonces de la communauté.
     * Limite à 50 annonces pour éviter surcharge (A11 OWASP - DoS).
     */
    listenToListings: function() {
        if (!window.db) {
            console.warn("[ExchangeMarket] Firestore non disponible.");
            return;
        }

        if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();

        this.firestoreUnsubscribe = window.db.collection("exchange_listings")
            .orderBy("createdAt", "desc")
            .limit(50)
            .onSnapshot((snapshot) => {
                this.listings = [];
                snapshot.forEach((doc) => {
                    this.listings.push({ id: doc.id, ...doc.data() });
                });
                this.renderListings();
            });
    },

    /**
     * Publie une nouvelle annonce.
     * @param {string} title - Titre de la pièce
     * @param {string} description - Description
     * @param {string} priceType - "bvc" ou "euro"
     * @param {number} price - Prix
     * @param {string} category - Catégorie (carenage, pot, galets, variateur, pneus, autre)
     */
    publishListing: async function(title, description, priceType, price, category) {
        if (!window.db) { alert("Connexion Firestore requise."); return; }
        if (!window.session || window.session.isGuest) { alert("Vous devez être connecté pour publier."); return; }

        // Validation des entrées (CIS 16.10 - Never trust user input)
        title = (title || '').trim();
        description = (description || '').trim();
        price = parseFloat(price) || 0;

        if (!title || title.length < 3 || title.length > 100) {
            alert("Le titre doit faire entre 3 et 100 caractères.");
            return;
        }
        if (description.length > 500) {
            alert("La description ne peut pas dépasser 500 caractères.");
            return;
        }
        if (price <= 0 || price > 50000) {
            alert("Le prix doit être entre 1 et 50 000.");
            return;
        }

        const listing = {
            title: title,
            description: description,
            priceType: priceType === 'bvc' ? 'bvc' : 'euro',
            price: price,
            category: category || 'autre',
            seller: window.session.username,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Modération GuardianBot
        if (window.GuardianBot && !window.GuardianBot.analyzeContent("Annonce", listing, window.session.username)) {
            return;
        }

        try {
            await window.db.collection("exchange_listings").add(listing);
            alert("Annonce publiée avec succès !");
            this.closePublishForm();
        } catch (e) {
            console.error("[ExchangeMarket] Publication échouée :", e);
            alert("Erreur lors de la publication.");
        }
    },

    /**
     * Supprime une annonce (uniquement par son auteur).
     * @param {string} listingId
     * @param {string} seller
     */
    deleteListing: async function(listingId, seller) {
        if (!window.session || window.session.username !== seller) {
            alert("Vous ne pouvez supprimer que vos propres annonces.");
            return;
        }
        if (!confirm("Supprimer cette annonce ?")) return;

        try {
            await window.db.collection("exchange_listings").doc(listingId).delete();
        } catch(e) {
            console.error("[ExchangeMarket] Suppression échouée :", e);
        }
    },

    /**
     * Contacte le vendeur via un message dans Firestore.
     */
    contactSeller: async function(listingId, sellerName) {
        if (!window.session || window.session.isGuest) { alert("Connectez-vous d'abord."); return; }
        if (window.session.username === sellerName) { alert("C'est votre annonce !"); return; }

        try {
            await window.db.collection("exchange_messages").add({
                listingId: listingId,
                from: window.session.username,
                to: sellerName,
                message: `Salut ! Je suis intéressé(e) par ton annonce. On en discute ?`,
                read: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Message envoyé au vendeur ! Il sera notifié.");
        } catch(e) {
            console.error("[ExchangeMarket] Contact fail :", e);
            alert("Erreur lors de l'envoi.");
        }
    },

    // ==================== UI ====================

    getCategoryIcon: function(cat) {
        const icons = {
            carenage: 'fa-shield-halved',
            pot: 'fa-wind',
            galets: 'fa-gear',
            variateur: 'fa-gears',
            pneus: 'fa-circle-dot',
            autre: 'fa-box-open'
        };
        return icons[cat] || icons.autre;
    },

    getCategoryLabel: function(cat) {
        const labels = {
            carenage: 'Carénage',
            pot: 'Pot d\'échappement',
            galets: 'Galets',
            variateur: 'Variateur',
            pneus: 'Pneus',
            autre: 'Autre'
        };
        return labels[cat] || 'Autre';
    },

    renderListings: function() {
        const container = document.getElementById('exchange-listings-container');
        if (!container) return;

        if (this.listings.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; color:#666;">
                    <i class="fa-solid fa-box-open" style="font-size:3rem; margin-bottom:15px;"></i>
                    <p>Aucune annonce pour le moment. Soyez le premier à publier !</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.listings.forEach(listing => {
            const icon = this.getCategoryIcon(listing.category);
            const catLabel = this.getCategoryLabel(listing.category);
            const priceLabel = listing.priceType === 'bvc'
                ? `${listing.price} Pts BVC`
                : `${listing.price} €`;
            const isOwner = window.session && window.session.username === listing.seller;
            const date = listing.createdAt?.toDate ? listing.createdAt.toDate().toLocaleDateString('fr-FR') : '';

            html += `
                <div class="product-card" style="position:relative;">
                    <div class="product-img">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <span style="position:absolute; top:15px; right:15px; background:rgba(0,210,255,0.2); color:#00d2ff; padding:3px 10px; border-radius:10px; font-size:0.7rem;">${catLabel}</span>
                    <h3 id="listing-title-${listing.id}"></h3>
                    <p style="color:#888; font-size:0.85rem;" id="listing-desc-${listing.id}"></p>
                    <div class="price-tag">${priceLabel}</div>
                    <p style="color:#555; font-size:0.75rem; margin-bottom:10px;">
                        <i class="fa-solid fa-user"></i> <span id="listing-seller-${listing.id}"></span> ${date ? `• ${date}` : ''}
                    </p>
                    ${isOwner
                        ? `<button class="buy-btn" style="background:#ff4d4d;" onclick="ExchangeMarket.deleteListing('${listing.id}', '${listing.seller}')"><i class="fa-solid fa-trash"></i> Supprimer</button>`
                        : `<button class="buy-btn" onclick="ExchangeMarket.contactSeller('${listing.id}', '${listing.seller}')"><i class="fa-solid fa-envelope"></i> Contacter</button>`
                    }
                </div>
            `;
        });

        container.innerHTML = html;

        // Injection sécurisée via textContent (A03 OWASP - XSS Prevention)
        this.listings.forEach(listing => {
            const titleEl = document.getElementById(`listing-title-${listing.id}`);
            const descEl = document.getElementById(`listing-desc-${listing.id}`);
            const sellerEl = document.getElementById(`listing-seller-${listing.id}`);
            if (titleEl) titleEl.textContent = listing.title;
            if (descEl) descEl.textContent = listing.description;
            if (sellerEl) sellerEl.textContent = listing.seller;
        });
    },

    openPublishForm: function() {
        let form = document.getElementById('exchange-publish-form');
        if (form) { form.style.display = 'block'; return; }

        form = document.createElement('div');
        form.id = 'exchange-publish-form';
        form.style = `
            position:fixed; top:0; left:0; width:100vw; height:100vh;
            background:rgba(10,15,25,0.95); z-index:50000;
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            color:#fff; font-family:'Inter',sans-serif; backdrop-filter:blur(15px);
        `;
        form.innerHTML = `
            <button onclick="ExchangeMarket.closePublishForm()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-tag" style="font-size:2.5rem; color:#00d2ff; margin-bottom:10px;"></i>
            <h2 style="color:#00d2ff; margin-bottom:20px;">Publier une Annonce</h2>
            <div style="width:90%; max-width:400px;">
                <input type="text" id="ex-title" placeholder="Titre (ex: Galets Malossi 6.5g)" maxlength="100" style="width:100%; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; margin-bottom:10px; outline:none;">
                <textarea id="ex-desc" placeholder="Description (état, compatibilité...)" maxlength="500" rows="3" style="width:100%; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; margin-bottom:10px; outline:none; resize:none;"></textarea>
                <select id="ex-category" style="width:100%; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; margin-bottom:10px; outline:none;">
                    <option value="galets">Galets</option>
                    <option value="variateur">Variateur</option>
                    <option value="pot">Pot d'échappement</option>
                    <option value="carenage">Carénage</option>
                    <option value="pneus">Pneus</option>
                    <option value="autre">Autre</option>
                </select>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="number" id="ex-price" placeholder="Prix" min="1" style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                    <select id="ex-price-type" style="width:120px; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                        <option value="euro">Euros (€)</option>
                        <option value="bvc">Pts BVC</option>
                    </select>
                </div>
                <button onclick="ExchangeMarket.publishListing(
                    document.getElementById('ex-title').value,
                    document.getElementById('ex-desc').value,
                    document.getElementById('ex-price-type').value,
                    document.getElementById('ex-price').value,
                    document.getElementById('ex-category').value
                )" style="width:100%; background:linear-gradient(135deg,#00d2ff,#0090ff); color:#fff; border:none; padding:15px; border-radius:15px; font-weight:bold; font-size:1rem; cursor:pointer;">
                    <i class="fa-solid fa-paper-plane"></i> Publier
                </button>
            </div>
        `;
        document.body.appendChild(form);
    },

    closePublishForm: function() {
        const form = document.getElementById('exchange-publish-form');
        if (form) form.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Délai pour laisser Firebase s'initialiser
    setTimeout(() => {
        ExchangeMarket.init();
    }, 1500);
});
