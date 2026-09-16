/**
 * GARAGE PRO - Logique Métier
 * Inscription, Tarification Dynamique et Cahier d'Entretien
 */

window.GaragePro = {
  // Configuration
  pricing: {
    first50: 19.99,
    standard: 49.99,
    maxPromotionalGarages: 50
  },
  
  registeredCount: 0,

  /**
   * Initialise le flux d'inscription en récupérant le compteur Firestore
   */
  initRegistration: async function() {
    try {
      if (typeof db !== "undefined") {
        const statsRef = db.collection("stats").doc("garage_registrations");
        const doc = await statsRef.get();
        if (doc.exists) {
          this.registeredCount = doc.data().count || 0;
        } else {
          // Lecture uniquement. La création se fera via Admin SDK / Cloud Function.
          this.registeredCount = 0;
        }
      } else {
        this.registeredCount = parseInt(localStorage.getItem('sim_garage_count') || '0');
      }
      this.showRegistrationModal();
    } catch (e) {
      console.warn("Erreur chargement stats Garages", e);
      this.showRegistrationModal(); // Fallback
    }
  },

  /**
   * Affiche la modale d'inscription avec le bon prix
   */
  showRegistrationModal: function() {
    const isPromo = this.registeredCount < this.pricing.maxPromotionalGarages;
    const currentPrice = isPromo ? this.pricing.first50 : this.pricing.standard;
    const remaining = Math.max(0, this.pricing.maxPromotionalGarages - this.registeredCount);

    const title = isPromo ? `Offre Pionnier (-60%)` : `Inscription Garage Pro`;
    const subtitle = isPromo ? `Il reste ${remaining} places au tarif préférentiel de lancement.` : `Rejoignez le réseau national de garages certifiés.`;

    const html = `
      <div id="garage-reg-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:flex; align-items:center; justify-content:center;">
        <div style="background:#141414; border:1px solid #ffb703; border-radius:12px; padding:30px; width:400px; text-align:center; color:#fff;">
          <i class="fa-solid fa-wrench" style="font-size:3rem; color:#ffb703; margin-bottom:15px;"></i>
          <h2>${title}</h2>
          <p style="color:#888; font-size:0.9rem; margin:10px 0 20px;">${subtitle}</p>
          
          <div style="font-size:2.5rem; font-weight:bold; color:#00ff88; margin-bottom:20px;">
            ${currentPrice} € <span style="font-size:0.8rem; color:#888;">(HT)</span>
          </div>

          <input type="email" id="garage-reg-email" placeholder="Email du garage" style="width:100%; padding:10px; margin-bottom:10px; border-radius:5px; border:1px solid #333; background:#000; color:#fff;" />
          <input type="password" id="garage-reg-pwd" placeholder="Mot de passe" style="width:100%; padding:10px; margin-bottom:20px; border-radius:5px; border:1px solid #333; background:#000; color:#fff;" />
          
          <button onclick="GaragePro.processPaymentAndRegister(${isPromo}, ${currentPrice})" style="width:100%; padding:12px; background:#ffb703; color:#000; font-weight:bold; border:none; border-radius:5px; cursor:pointer; margin-bottom:10px;">
            <i class="fa-solid fa-lock"></i> Payer l'accès à vie
          </button>
          <button onclick="document.getElementById('garage-reg-modal').remove()" style="width:100%; padding:12px; background:transparent; color:#888; border:1px solid #333; border-radius:5px; cursor:pointer;">
            Annuler
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  /**
   * Traite le paiement et enregistre le garage
   */
  processPaymentAndRegister: async function(isPromo, amount) {
    const email = document.getElementById("garage-reg-email").value.trim();
    const pwd = document.getElementById("garage-reg-pwd").value;

    if (!email || !pwd || pwd.length < 6) {
      alert("Veuillez saisir un email valide et un mot de passe (min 6 caractères).");
      return;
    }

    // 1. Simulation Paiement
    if (!confirm(`Confirmez-vous le paiement de ${amount} € HT (Paiement Revolut) ?`)) return;
    
    // 2. Création Auth + Profil Firestore
    try {
      if (typeof db !== "undefined" && typeof firebase !== "undefined") {
        // Auth Firebase
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, pwd);
        const uid = userCredential.user.uid;

        const batch = db.batch();
        
        // Création document Garage dans 'users'
        const userRef = db.collection("users").doc(uid);
        batch.set(userRef, {
          email: email,
          role: "user", 
          isCertifiedGarage: true, // CLÉ pour l'accès au cahier d'entretien
          registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
          entryFeePaid: amount
        });

        // Incrément du compteur
        const statsRef = db.collection("stats").doc("garage_registrations");
        batch.update(statsRef, {
          count: firebase.firestore.FieldValue.increment(1)
        });

        await batch.commit();
        this.registeredCount++;

      } else {
        this.registeredCount++;
        localStorage.setItem('sim_garage_count', this.registeredCount);
      }

      alert("✅ Transaction validée !\n\nBienvenue dans le réseau Garage Pro. Vous pouvez maintenant vous connecter avec vos identifiants pour accéder au Cahier d'Entretien Digital.");
      document.getElementById('garage-reg-modal').remove();

    } catch (e) {
      console.error("Erreur inscription garage", e);
      alert("Erreur lors de l'inscription : " + e.message);
    }
  },

  /**
   * Envoi d'un rapport d'entretien
   */
  submitMaintenanceLog: async function() {
    const clientUid = document.getElementById("maint-client-uid").value.trim();
    const category = document.getElementById("maint-category").value;
    const mileage = document.getElementById("maint-mileage").value;
    const description = document.getElementById("maint-desc").value.trim();

    if (!clientUid || !category || !mileage || !description) {
      alert("Veuillez remplir tous les champs du rapport d'entretien.");
      return;
    }

    if (!confirm("Voulez-vous sceller ce rapport dans le carnet d'entretien numérique du client ?\n\n⚠️ Cette action est IRRÉVERSIBLE (Technologie Blockchain/Firestore Immuable).")) {
      return;
    }

    try {
      if (typeof db !== "undefined") {
        const garageUid = firebase.auth().currentUser.uid;
        
        await db.collection("maintenance_logs").add({
          vehicleOwnerUid: clientUid,
          garageUid: garageUid,
          certified: true,
          category: category,
          mileage: parseInt(mileage),
          description: description,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      alert("✅ Rapport scellé avec succès ! Le client le verra apparaître dans son application.");
      // Reset form
      document.getElementById("maint-client-uid").value = "";
      document.getElementById("maint-mileage").value = "";
      document.getElementById("maint-desc").value = "";

    } catch (e) {
      console.error("Erreur rapport", e);
      alert("Erreur de certification : " + e.message);
    }
  }
};
