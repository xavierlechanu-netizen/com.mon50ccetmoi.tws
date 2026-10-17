import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * BVC Manager (Brave Coins / Points de Bonne Conduite)
 * Gestion sécurisée de la monnaie virtuelle via Firestore (OWASP A01)
 * Remplace l'ancienne logique basée sur localStorage.
 */
window.BVCManager = {
  balance: 0,
  
  init: async function() {
    await this.sync();
    // Écoute temps réel des changements si modifié depuis un autre onglet/appareil
    if (window.session && window.session.uid && typeof firebase !== "undefined") {
      firebase.firestore().collection("users").doc(window.session.uid)
        .onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            // On s'assure d'initialiser si le champ n'existe pas
            if (data.braveCoins === undefined) {
              this.balance = data.points || 0; // Legacy migration
            } else {
              this.balance = data.braveCoins;
            }
            window.braveCoins = this.balance; // Rétrocompatibilité pour la lecture
            this.updateUI();
          }
        });
    }
  },

  sync: async function() {
    if (!window.session || !window.session.uid) return;
    try {
      const doc = await firebase.firestore().collection("users").doc(window.session.uid).get();
      if (doc.exists) {
        const data = doc.data();
        this.balance = data.braveCoins !== undefined ? data.braveCoins : (data.points || 0);
        window.braveCoins = this.balance;
        this.updateUI();
      }
    } catch (e) {
      console.error("[BVC] Sync Error:", e);
    }
  },

  add: async function(amount) {
    if (!window.session || !window.session.uid || amount <= 0) return;
    try {
      // Maj Optimiste
      this.balance += amount;
      window.braveCoins = this.balance;
      this.updateUI();
      
      await firebase.firestore().collection("users").doc(window.session.uid).update({
        braveCoins: firebase.firestore.FieldValue.increment(amount)
      });
    } catch (e) {
      console.error("[BVC] Add Error:", e);
      // Rollback en cas d'erreur
      this.balance -= amount;
      window.braveCoins = this.balance;
      this.updateUI();
    }
  },

  deduct: async function(amount) {
    if (!window.session || !window.session.uid || amount <= 0) return false;
    if (this.balance < amount) return false;
    
    try {
      // Maj Optimiste
      this.balance -= amount;
      window.braveCoins = this.balance;
      this.updateUI();
      
      await firebase.firestore().collection("users").doc(window.session.uid).update({
        braveCoins: firebase.firestore.FieldValue.increment(-amount)
      });
      return true;
    } catch (e) {
      console.error("[BVC] Deduct Error:", e);
      // Rollback
      this.balance += amount;
      window.braveCoins = this.balance;
      this.updateUI();
      return false;
    }
  },

  updateUI: function() {
    const els = document.querySelectorAll(".bvc-balance-display");
    els.forEach(el => el.innerText = Math.floor(this.balance) + " Pts mon50cc");
    
    const balanceEl = document.getElementById("wallet-balance");
    if (balanceEl) balanceEl.innerText = Math.floor(this.balance) + " Pts mon50cc";
    
    const tokenEl = document.getElementById("bvc-count");
    if (tokenEl) tokenEl.innerText = Math.floor(this.balance);
  }
};
