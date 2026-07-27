/* --- B2B INSURER PORTAL (WEB4) --- */

window.InsurerPortal = {
  currentCode: null,
  currentInsurer: null,

  open: function () {
    document.getElementById("insurer-portal-screen").classList.remove("hidden");
    if (this.currentInsurer) {
      document.getElementById("insurer-login-box").classList.add("hidden");
      document
        .getElementById("insurer-dashboard-box")
        .classList.remove("hidden");
    } else {
      document.getElementById("insurer-login-box").classList.remove("hidden");
      document.getElementById("insurer-dashboard-box").classList.add("hidden");
    }
    document.getElementById("insurer-pricing-box").classList.add("hidden");
  },

  close: function () {
    document.getElementById("insurer-portal-screen").classList.add("hidden");
  },

  login: async function () {
    const id = document.getElementById("insurer-id-input").value.trim();
    const pwd = document.getElementById("insurer-pwd-input").value.trim();

    if (!id || !pwd) {
      alert("Veuillez saisir votre Identifiant et Mot de passe.");
      return;
    }

    try {
      await firebase.auth().signInWithEmailAndPassword(id, pwd);
      this.currentInsurer = id;
      document.getElementById("insurer-name-display").innerText =
        this.currentInsurer;
      document.getElementById("insurer-login-box").classList.add("hidden");
      document
        .getElementById("insurer-dashboard-box")
        .classList.remove("hidden");
    } catch (error) {
      console.error("Auth error:", error);
      alert("AccÃ¨s refusÃ© : Identifiants invalides ou compte inexistant.");
    }
  },

  signup: function () {
    alert(
      "La crÃ©ation de compte Assureur est gÃ©rÃ©e manuellement par notre Ã©quipe pour des raisons de sÃ©curitÃ©. Veuillez nous contacter.",
    );
  },

  logout: function () {
    this.currentInsurer = null;
    this.currentCode = null;
    document.getElementById("insurer-id-input").value = "";
    document.getElementById("insurer-pwd-input").value = "";
    document.getElementById("insurer-code-input").value = "";
    document.getElementById("insurer-login-box").classList.remove("hidden");
    document.getElementById("insurer-dashboard-box").classList.add("hidden");
    document.getElementById("insurer-pricing-box").classList.add("hidden");
  },

  verifyCode: function () {
    const input = document
      .getElementById("insurer-code-input")
      .value.trim()
      .toUpperCase();
    if (!input.startsWith("LITIGE-")) {
      alert("Code Invalide. Le format attendu est LITIGE-XXXXXX");
      return;
    }

    const parts = input.split("-");
    if (parts.length >= 2) {
      const tsStr = parts[1].toLowerCase();
      const timestamp = parseInt(tsStr, 36);
      if (!isNaN(timestamp)) {
        const now = Date.now();
        const diffHours = (now - timestamp) / (1000 * 60 * 60);
        if (diffHours > 72) {
          alert(
            "Code ExpirÃ©. Le code litige est valable uniquement 72h. Le pilote doit gÃ©nÃ©rer un nouveau code depuis son application.",
          );
          return;
        }
      }
    }

    // Simuler la recherche dans le coffre-fort Firebase
    document.getElementById("insurer-dashboard-box").classList.add("hidden");
    document.getElementById("insurer-pricing-box").classList.remove("hidden");
    this.currentCode = input;
  },

  buyReport: function (type, price, rewardBvc) {
    if (
      confirm(
        `[SÃ‰CURITÃ‰ ZERO-TRUST]\nConfirmez-vous l'achat du rapport [${type}] pour ${price}â‚¬ HT ?\n\nâš ï¸ CONDITIONS B2B : Les donnÃ©es chiffrÃ©es sont dÃ©finitives.\nLe paiement sera instantanÃ©ment prÃ©levÃ© via le Smart Contract.`,
      )
    ) {
      // Premium WOW Effect for success
      const pricingBox = document.getElementById("insurer-pricing-box");
      pricingBox.innerHTML = `
                <div style="text-align:center; padding: 40px;">
                    <i class="fa-solid fa-circle-check" style="font-size: 5rem; color: #00ffcc; text-shadow: 0 0 30px #00ffcc; margin-bottom:20px; animation: pulse 1s infinite;"></i>
                    <h2 style="color:#fff; font-size:2rem; font-weight:900;">TRANSACTION VALIDÃ‰E</h2>
                    <p style="color:#00d2ff; font-family:'JetBrains Mono', monospace;">ClÃ© de dÃ©chiffrement gÃ©nÃ©rÃ©e pour le dossier ${this.currentCode}</p>
                    <div style="margin-top:30px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; border-radius:12px; padding:15px; color:#fff;">
                        <i class="fa-solid fa-envelope"></i> Le rapport a Ã©tÃ© envoyÃ© de maniÃ¨re sÃ©curisÃ©e Ã  votre adresse pro.
                    </div>
                </div>
            `;

      setTimeout(() => {
        // DÃ©clenchement du Smart Contract Web4 : RÃ©tribution du pilote
        if (window.Web4Economy && rewardBvc > 0) {
          window.Web4Economy.mineToken(
            rewardBvc,
            `Smart Contract: L'assureur a achetÃ© le rapport (${type})`,
          );
          if (typeof speak === "function") {
            speak(
              "Transaction confirmÃ©e. Votre assureur a consultÃ© le rapport. Les tokens ont Ã©tÃ© crÃ©ditÃ©s.",
            );
          }
        }
        setTimeout(() => this.close(), 3000);
      }, 2000);
    }
  },
};
