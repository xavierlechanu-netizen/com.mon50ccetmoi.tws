import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { pointsSouverains, messagePoints } from './points.js';

/**
 * BVC Manager (Brave Coins / Points de Bonne Conduite)
 * Le serveur décide de tout (barème, preuves, plafonds : functions/api/points-rules.js) ; l'appli
 * n'affiche que ce qu'il répond. Conforme OWASP ASVS v5.0.0-2.2.1, 2.2.2, 2.3.3.
 *
 * Interrupteur CONFIG.BACKEND_MODE.points (points.js) :
 *   "SOVEREIGN" : serveur du VPS (POST /points/transact, GET /points) ;
 *   "FIREBASE"  : Cloud Functions transactPoints / getPointsHistory (coupées depuis le 14/11/2026).
 */
window.BVCManager = {
  balance: 0,

  init: async function() {
    await this.sync();
    if (pointsSouverains) {
      // Pas d'écoute en temps réel sur le serveur : on relit le solde en revenant sur l'appli
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") this.sync();
      });
      return;
    }
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
    if (pointsSouverains) {
      if (!pointsSouverains.possible()) return;
      try {
        const { balance } = await pointsSouverains.soldeEtHistorique(1);
        this.setBalance(balance);
      } catch (e) {
        console.warn("[BVC] Solde indisponible :", e && e.message);
      }
      return;
    }
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

  setBalance: function(balance) {
    this.balance = balance;
    window.braveCoins = balance;
    this.updateUI();
  },

  /** Mouvement sur le serveur du VPS. Faux si refusé (message montré pour un plafond ou un solde). */
  mouvementSouverain: async function(action, reason, amount, metadata) {
    if (!pointsSouverains.possible()) return false;
    try {
      const res = await pointsSouverains.mouvement({ action, reason, amount, metadata });
      this.setBalance(res.balance);
      return true;
    } catch (e) {
      console.warn(`[BVC] ${action} refusé :`, e && (e.status || ""), e && e.message);
      // Plafond du jour ou solde insuffisant : le pilote doit savoir pourquoi rien ne bouge
      if (e && (e.status === 429 || e.status === 402)) alert("ℹ️ " + messagePoints(e));
      return false;
    }
  },

  // Le serveur fixe le montant et vérifie la preuve : `amount` sert seulement à l'affichage immédiat.
  add: async function(amount, reason, metadata = {}) {
    if (!reason) {
      console.warn("[BVC] Gain de points ignoré : motif manquant.");
      return false;
    }
    if (pointsSouverains) {
      if (amount <= 0) return false;
      return this.mouvementSouverain("AWARD", reason, amount, metadata);
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
    if (amount <= 0) return false;
    if (pointsSouverains) {
      if (this.balance < amount) return false;
      return this.mouvementSouverain("DEDUCT", reason, amount, metadata);
    }
    if (!window.session || !window.session.uid) return false;
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
    if (pointsSouverains) {
      if (!pointsSouverains.possible()) return [];
      try {
        const { balance, history } = await pointsSouverains.soldeEtHistorique(limit);
        this.setBalance(balance);
        // Même forme qu'avant (getPointsHistory) pour les écrans qui l'affichent
        return history.map((h) => ({ ...h, amount: Math.abs(h.delta), created_at: h.createdAt }));
      } catch (e) {
        console.error("[BVC] Erreur chargement historique :", e);
        return [];
      }
    }
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
