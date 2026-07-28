/* --- WEB 4 MINING & ECONOMY --- */

window.Web4Economy = {
  balance: 0.0,
  prices: {
    legal_report: 5.0, // Prix fixe pour l'avocat de poche
    insurance_report: 10.0, // Prix fixe pour le rapport d'assurance IA
  },

  init: function () {
    this.checkYearlyExpiration();
    this.balance = parseFloat(localStorage.getItem("braveCoins") || "0");
    this.updateUI();

    // Simulation de minage passif (ex: 0.1 BVC par minute de trajet)
    setInterval(() => {
      if (window.isRiding) {
        // Variable de app.js
        this.mineToken(0.05, "Minage : Conduite Active");
      }
    }, 60000);
  },

  checkYearlyExpiration: function () {
    const currentYear = new Date().getFullYear();
    const lastYear =
      localStorage.getItem("mon50_bvc_year") || currentYear.toString();

    if (parseInt(currentYear) > parseInt(lastYear)) {
      localStorage.setItem("braveCoins", "0.00");
      localStorage.setItem("mon50_tokens", "0.00");
      if (window.NeuralHUD) window.NeuralHUD.tokenBalance = 0;
      window.braveCoins = 0;

      // Show alert to user if they open the app
      setTimeout(
        () =>
          alert(
            "Nouvelle Saison ! Vos points BVC (Rouler & Gagner) ont expiré et ont été remis à zéro pour l'année civile en cours.",
          ),
        2000,
      );
    }
    localStorage.setItem("mon50_bvc_year", currentYear.toString());
  },

  mineToken: function (amount, reason) {
    this.balance += amount;
    localStorage.setItem("braveCoins", this.balance.toFixed(2));
    this.updateUI();

    // Animation HUD
    this.showMiningHUD(amount);
  },

  spendToken: function (amount, reason) {
    if (this.balance >= amount) {
      this.balance -= amount;
      localStorage.setItem("braveCoins", this.balance.toFixed(2));
      this.updateUI();

      return true; // Achat réussi
    } else {
      console.warn(`[Web4] Fonds insuffisants pour : ${reason}`);
      return false; // Achat refusé
    }
  },

  updateUI: function () {
    const balanceEl = document.getElementById("crypto-balance");
    if (balanceEl) {
      balanceEl.innerText = this.balance.toFixed(2) + " BVC";
    }
    window.braveCoins = this.balance; // Sync with legacy variables

    // Restriction : Bloquer l'Avocat de Poche si solde insuffisant
    const lawyerBtn = document.getElementById("dock-btn-lawyer");
    if (lawyerBtn) {
      const lawyerPrice = this.prices.legal_report || 5;
      if (this.balance < lawyerPrice) {
        lawyerBtn.style.opacity = "0.4";
        lawyerBtn.style.filter = "grayscale(100%)";
        lawyerBtn.innerHTML =
          '<i class="fa-solid fa-lock" style="filter: drop-shadow(0 0 5px #ff4d4d); color: #ff4d4d;"></i>';
        lawyerBtn.title = `Nécessite ${lawyerPrice} BVC`;
      } else {
        lawyerBtn.style.opacity = "1";
        lawyerBtn.style.filter = "none";
        lawyerBtn.innerHTML =
          '<i class="fa-solid fa-scale-balanced" style="filter: drop-shadow(0 0 5px #cca300);"></i>';
        lawyerBtn.title = "Avocat de Poche";
      }
    }
  },

  showMiningHUD: function (amount) {
    // Create a floating coin element in the UI
    const coin = document.createElement("div");
    coin.className = "web4-coin-drop";
    coin.innerHTML = `<i class="fa-brands fa-ethereum"></i> +${amount.toFixed(2)}`;
    document.body.appendChild(coin);

    setTimeout(() => coin.remove(), 2000);
  },
};

window.addEventListener("load", () => {
  window.Web4Economy.init();
});
