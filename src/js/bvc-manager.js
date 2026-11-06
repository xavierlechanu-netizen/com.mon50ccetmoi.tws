import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * BVC Manager (Brave Coins / Points de Bonne Conduite)
 * Gestion hautement sécurisée de la monnaie virtuelle via Cloud Function transactPoints
 * Conforme OWASP ASVS v5.0.0-2.2.1, 2.2.2, 2.3.3 (Atomicité & Grand Livre Immuable)
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
            this.balance = data.braveCoins !== undefined ? data.braveCoins : ((data.bvc_points !== undefined) ? data.bvc_points : (data.points || 0));
            window.braveCoins = this.balance;
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
        this.balance = data.braveCoins !== undefined ? data.braveCoins : ((data.bvc_points !== undefined) ? data.bvc_points : (data.points || 0));
        window.braveCoins = this.balance;
        this.updateUI();
      }
    } catch (e) {
      console.error("[BVC] Sync Error:", e);
    }
  },

  // Le serveur fixe le montant et vérifie la preuve : `amount` sert seulement à l'affichage immédiat.
  add: async function(amount, reason, metadata = {}) {
    if (!reason) {
      console.warn("[BVC] Gain de points ignoré : motif manquant.");
      return false;
    }
    if (!window.session || !window.session.uid || amount <= 0) return false;
    const previousBalance = this.balance;
    try {
      // Maj Optimiste locale
      this.balance += amount;
      window.braveCoins = this.balance;
      this.updateUI();

      if (typeof firebase !== "undefined" && firebase.functions) {
        const transact = firebase.app().functions("europe-west1").httpsCallable("transactPoints");
        const res = await transact({
          action: "AWARD",
          reason: reason,
          amount: Math.floor(amount),
          metadata: metadata
        });
        if (res && res.data && res.data.success) {
          this.balance = res.data.balance;
          window.braveCoins = this.balance;
          this.updateUI();
          return true;
        }
      }
      return true;
    } catch (e) {
      console.error("[BVC] Add Error:", e);
      // Rollback en cas d'erreur
      this.balance = previousBalance;
      window.braveCoins = this.balance;
      this.updateUI();
      if (e.message && e.message.includes("Plafond")) {
        alert("ℹ️ " + e.message);
      }
      return false;
    }
  },

  deduct: async function(amount, reason = "GENERIC_SPEND", metadata = {}) {
    if (!window.session || !window.session.uid || amount <= 0) return false;
    if (this.balance < amount) return false;

    const previousBalance = this.balance;
    try {
      // Maj Optimiste locale
      this.balance -= amount;
      window.braveCoins = this.balance;
      this.updateUI();

      if (typeof firebase !== "undefined" && firebase.functions) {
        const transact = firebase.app().functions("europe-west1").httpsCallable("transactPoints");
        const res = await transact({
          action: "DEDUCT",
          reason: reason,
          amount: Math.floor(amount),
          metadata: metadata
        });
        if (res && res.data && res.data.success) {
          this.balance = res.data.balance;
          window.braveCoins = this.balance;
          this.updateUI();
          return true;
        }
      }
      return true;
    } catch (e) {
      console.error("[BVC] Deduct Error:", e);
      // Rollback
      this.balance = previousBalance;
      window.braveCoins = this.balance;
      this.updateUI();
      return false;
    }
  },

  getHistory: async function(limit = 30) {
    if (!window.session || !window.session.uid || typeof firebase === "undefined") return [];
    try {
      const getHistoryFn = firebase.app().functions("europe-west1").httpsCallable("getPointsHistory");
      const res = await getHistoryFn({ limit });
      return res.data?.history || [];
    } catch (e) {
      console.error("[BVC] Erreur chargement historique :", e);
      return [];
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
