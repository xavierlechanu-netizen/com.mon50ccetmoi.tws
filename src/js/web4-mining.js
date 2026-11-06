import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/* --- WEB 4 MINING & ECONOMY --- */

window.Web4Economy = {
  balance: 0.0,
  prices: {
    legal_report: 5.0, // Prix fixe pour Nexus Atlas Juridique
    insurance_report: 10.0, // Prix fixe pour le rapport d'assurance IA
  },

  init: function () {
    this.checkYearlyExpiration();
    
    // Simulation de minage passif (ex: 0.1 BVC par minute de trajet)
    setInterval(() => {
      if (window.isRiding) {
        this.mineToken(0.05, "Minage : Conduite Active");
      }
    }, 60000);

    // Synchronisation de l'UI avec BVCManager
    setInterval(() => this.updateUI(), 2000);
  },

  checkYearlyExpiration: function () {
    const currentYear = new Date().getFullYear();
    const lastYear =
      localStorage.getItem("mon50_bvc_year") || currentYear.toString();

    if (parseInt(currentYear) > parseInt(lastYear)) {
      if (window.BVCManager && window.BVCManager.balance > 0) {
        window.BVCManager.deduct(window.BVCManager.balance);
      }
      localStorage.setItem("mon50_tokens", "0.00");
      if (window.NeuralHUD) window.NeuralHUD.tokenBalance = 0;

      // Show alert to user if they open the app
      setTimeout(
        () =>
          alert(
            "Nouvelle Saison ! Vos points mon50cc (Rouler & Gagner) ont expiré et ont été remis à zéro pour l'année civile en cours.",
          ),
        2000,
      );
    }
    localStorage.setItem("mon50_bvc_year", currentYear.toString());
  },

  // serverReason : motif du barème serveur (ex. "CHALLENGE_COMPLETED"). Sans motif, affichage local seulement.
  mineToken: function (amount, reason, serverReason) {
    if (window.BVCManager && serverReason) window.BVCManager.add(amount, serverReason);
    this.showMiningHUD(amount);
  },

  spendToken: async function (amount, reason) {
    if (window.BVCManager) {
      const success = await window.BVCManager.deduct(amount);
      if (!success) console.warn(`[Web4] Fonds insuffisants pour : ${reason}`);
      return success;
    }
    return false;
  },

  updateUI: function () {
    const bal = window.BVCManager ? window.BVCManager.balance : 0;
    const balanceEl = document.getElementById("crypto-balance");
    if (balanceEl) {
      balanceEl.innerText = bal.toFixed(2) + " BVC";
    }

    // Restriction : Bloquer Nexus Atlas Juridique si solde insuffisant
    const lawyerBtn = document.getElementById("dock-btn-lawyer");
    if (lawyerBtn) {
      const lawyerPrice = this.prices.legal_report || 5;
      if (bal < lawyerPrice) {
        lawyerBtn.style.opacity = "0.4";
        lawyerBtn.style.filter = "grayscale(100%)";
        // eslint-disable-next-line no-restricted-syntax
lawyerBtn.innerHTML = '<i class="fa-solid fa-lock" style="filter: drop-shadow(0 0 5px #ff4d4d); color: #ff4d4d;"></i>';
        lawyerBtn.title = `Nécessite ${lawyerPrice} BVC`;
      } else {
        lawyerBtn.style.opacity = "1";
        lawyerBtn.style.filter = "none";
        // eslint-disable-next-line no-restricted-syntax
lawyerBtn.innerHTML = '<i class="fa-solid fa-scale-balanced" style="filter: drop-shadow(0 0 5px #cca300);"></i>';
        lawyerBtn.title = "Nexus Atlas Juridique";
      }
    }
  },

  showMiningHUD: function (amount) {
    // Create a floating coin element in the UI
    const coin = document.createElement("div");
    coin.className = "web4-coin-drop";
    // eslint-disable-next-line no-restricted-syntax
coin.innerHTML = `<i class="fa-brands fa-ethereum"></i> +${amount.toFixed(2)}`;
    document.body.appendChild(coin);

    setTimeout(() => coin.remove(), 2000);
  },
};

window.addEventListener("load", () => {
  window.Web4Economy.init();
});
