/**
 * PORTAIL ASSURANCE mon50ccetmoi
 * Paiements via Revolut Merchant API (SDK RevolutCheckout embarquÃ©)
 * Flow : client â†’ Firebase Function (crÃ©ation ordre) â†’ Revolut â†’ webhook â†’ Firestore
 */
window.InsurancePortal = {
  // ClÃ© publique Merchant (config.js) â€” utilisÃ©e cÃ´tÃ© client uniquement
  get revolutPublicKey() {
    return CONFIG?.REVOLUT?.PUBLIC_KEY || "";
  },

  // URL de la Firebase Cloud Function (region europe-west1)
  get functionBaseUrl() {
    const projectId = CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
    return `https://europe-west1-${projectId}.cloudfunctions.net`;
  },

  balance: 500.0, // Option 2: Portefeuille virtuel (Acompte)
  transactions: [], // Historique des transactions
  cases: {}, // Liste des dossiers en attente ou dÃ©bloquÃ©s

  init() {},

  notify(message) {
    speak(message);

    // On pourrait ajouter un toast UI ici si besoin
  },

  // Affiche l'interface du portail pro
  showPortal(caseId) {
    const overlay = document.getElementById("screen-overlay");
    const content = document.getElementById("screen-content");
    if (!overlay || !content) return;

    overlay.classList.remove("hidden");
    this.renderPortal(content, caseId);
  },

  renderPortal(container, caseId) {
    const isUnlocked = this.cases[caseId]?.unlocked;
    const status = this.cases[caseId]?.status || "pending_payment";

    container.innerHTML = `
            <div class="insurance-portal-container">
                <h3><i class="fa-solid fa-building-shield"></i> Portail Pro Assurance</h3>
                <div class="wallet-status">
                    <span>Votre Solde :</span>
                    <strong id="portal-balance">${this.balance.toFixed(2)} â‚¬</strong>
                </div>

                <div class="case-header">
                    <h4>Dossier : <span class="case-id">${caseId}</span></h4>
                    <p class="case-status status-${status}">${this.getStatusLabel(status)}</p>
                </div>

                ${isUnlocked ? this.renderUnlockedView(caseId) : this.renderPaymentOptions(caseId)}

                ${this.renderTransactionHistory()}

                <button onclick="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-close-portal">

                    <i class="fa-solid fa-times"></i> Fermer le Portail
                </button>
            </div>
        `;
  },

  renderPaymentOptions(caseId) {
    return `
            <div class="payment-selection" style="text-align:center; padding: 20px;">
                <i class="fa-solid fa-hourglass-half fa-spin" style="font-size:3rem; color:#00d2ff; margin-bottom:20px;"></i>
                <h3 style="color:#fff; font-size:1.4rem;">En attente de l'Assurance</h3>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Veuillez transmettre ce code de dossier Ã  votre assureur :
                </p>
                <div class="case-code-badge" style="justify-content:center; margin: 20px 0;">
                    <i class="fa-solid fa-hashtag"></i>
                    <strong style="font-size:1.3rem;">${caseId}</strong>
                </div>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Votre assureur pourra dÃ©verrouiller le rapport depuis le <strong>Portail Expert</strong>.<br>
                    Le rapport sera disponible ici automatiquement dÃ¨s validation du paiement.
                </p>
                <button onclick="InsurancePortal.pollPaymentConfirmation('${caseId}')" class="btn-litigation-start" style="margin-top:20px;">
                    <i class="fa-solid fa-rotate"></i> RafraÃ®chir le statut
                </button>
            </div>
        `;
  },

  renderUnlockedView(caseId) {
    return `
            <div class="unlocked-view">
                <p class="success-msg"><i class="fa-solid fa-circle-check"></i> Rapport dÃ©bloquÃ© avec succÃ¨s.</p>
                <button onclick="window.BlackBoxInsurance.generateReport()" class="btn-download-report">
                    <i class="fa-solid fa-file-pdf"></i> TÃ©lÃ©charger le Rapport CertifiÃ©
                </button>
                <button onclick="window.BlackBoxReplay.replay()" class="btn-replay-report">
                    <i class="fa-solid fa-play"></i> Rejouer le Trajet en 3D
                </button>
            </div>
        `;
  },

  getStatusLabel(status) {
    const labels = {
      pending_payment: "En attente de paiement",
      waiting_for_funds: "Virement en cours (Attente rÃ©ception)",
      pending_verification: "VÃ©rification de la preuve en cours",
      unlocked: "AccÃ¨s AutorisÃ©",
    };
    return labels[status] || status;
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // OPTION 1 : Paiement Revolut Merchant (flow complet)
  // 1. Appel Firebase Function â†’ crÃ©ation ordre Revolut (clÃ© secrÃ¨te serveur)
  // 2. RÃ©cupÃ©ration du order_token
  // 3. RevolutCheckout(token).payWithPopup()
  // 4. Webhook Revolut â†’ Firebase â†’ dÃ©blocage rapport
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async payInstant(caseId) {
    const pubKey = this.revolutPublicKey;
    if (!pubKey) {
      alert("âš ï¸ ClÃ© publique Revolut manquante dans config.js");
      return;
    }

    // Ã‰tape 1 : Afficher le spinner de chargement
    this.cases[caseId] = { status: "waiting_for_funds", unlocked: false };
    this.renderRevolutLoadingModal(caseId);

    try {
      // Ã‰tape 2 : CrÃ©er l'ordre cÃ´tÃ© serveur via Firebase Function
      speak("Initialisation du paiement sÃ©curisÃ© Revolut.");
      const orderData = await this.createOrderViaFunction(caseId);

      if (!orderData?.order_token) {
        throw new Error("Token de paiement Revolut non reÃ§u.");
      }

      // Ã‰tape 3 : Lancer le checkout Revolut avec le token
      await this.launchRevolutCheckout(caseId, orderData);
    } catch (err) {
      console.error("[Revolut] Erreur paiement :", err);
      this.renderRevolutErrorModal(caseId, err.message);
    }
  },

  // â”€ Appel Firebase Function : crÃ©ation de l'ordre Revolut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async createOrderViaFunction(caseId) {
    const url = `${this.functionBaseUrl}/createRevolutOrder`;
    const reportType =
      window.LitigationAI?.lastAnalysis?.reportType || "STANDARD";

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: CONFIG?.REVOLUT?.AMOUNT_CENTS || 4999,
        currency: CONFIG?.REVOLUT?.CURRENCY || "EUR",
        case_id: caseId,
        user_id: window.session?.uid || "guest",
        report_type: reportType,
      }),
    });

    if (!response.ok) {
      const err = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(err.error || `Erreur serveur (${response.status})`);
    }

    return await response.json();
  },

  // â”€ Lance RevolutCheckout avec le token reÃ§u â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async launchRevolutCheckout(caseId, orderData) {
    if (typeof RevolutCheckout !== "function") {
      // SDK pas encore chargÃ© (async) â€” attendre 2s et rÃ©essayer
      await new Promise((r) => setTimeout(r, 2000));
      if (typeof RevolutCheckout !== "function") {
        throw new Error("SDK Revolut non chargÃ©. VÃ©rifiez votre connexion.");
      }
    }

    const instance = await RevolutCheckout(orderData.order_token, "prod");
    // Mode production activÃ© â€” anciennement 'sandbox'

    instance.payWithPopup({
      onSuccess: () => {
        speak("Paiement Revolut confirmÃ©. VÃ©rification en cours.");
        this.renderRevolutPendingConfirmation(caseId, orderData.order_id);
        // Le webhook Revolut va dÃ©bloquer le rapport dans Firestore.
        // On poll Firebase toutes les 3s pour dÃ©tecter la confirmation.
        this.pollPaymentConfirmation(caseId);
      },
      onError: (message) => {
        console.error("[Revolut] Erreur checkout :", message);
        this.renderRevolutErrorModal(caseId, message);
      },
      onCancel: () => {
        speak("Paiement annulÃ©.");
        this.cases[caseId] = { status: "pending_payment", unlocked: false };
        this.showPortal(caseId);
      },
    });
  },

  // â”€ Poll Firestore pour dÃ©tecter la confirmation webhook â”€â”€â”€â”€â”€â”€â”€â”€
  async pollPaymentConfirmation(caseId, attempts = 0) {
    if (attempts > 20) {
      // Timeout aprÃ¨s ~60s
      this.renderRevolutErrorModal(
        caseId,
        "DÃ©lai de confirmation dÃ©passÃ©. Contactez le support.",
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 3000));

    try {
      // VÃ©rifier dans Firestore si le webhook a confirmÃ© le paiement
      if (typeof db !== "undefined") {
        const doc = await db
          .collection("payment_confirmations")
          .doc(caseId)
          .get();
        if (doc.exists) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport dÃ©bloquÃ© avec succÃ¨s. Bonne route.");
          return;
        }
      } else {
        // Fallback : vÃ©rifier via la Cloud Function
        const url = `${this.functionBaseUrl}/checkPaymentStatus?case_id=${caseId}&user_id=${window.session?.uid || ""}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.paid) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport dÃ©bloquÃ© avec succÃ¨s.");
          return;
        }
      }
    } catch (e) {
      console.warn("[Revolut Poll] Erreur :", e);
    }

    // Continuer Ã  poller
    this.pollPaymentConfirmation(caseId, attempts + 1);
  },

  // â”€ Modals UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderRevolutSuccess(caseId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal" style="animation: portal-fade-in 0.5s ease-out;">
                <div class="litigation-analyzing" style="text-align:center; padding: 40px 20px;">
                    <div class="revolut-logo-ring" style="border-color: #00ff00; box-shadow: 0 0 30px rgba(0,255,0,0.5);">
                        <i class="fa-solid fa-unlock" style="color:#00ff00; font-size:2rem; animation: pulse-halo 2s infinite;"></i>
                    </div>
                    <h3 style="color:#00ff00; font-size:1.5rem; margin-top:20px;">Paiement ValidÃ©</h3>
                    <p style="color:#fff; font-size:0.9rem; margin-top:10px;">Le webhook Revolut a confirmÃ© la transaction.</p>
                    <p style="color:#00d2ff; font-size:1rem; margin-top:5px; font-weight:bold;">Rapport DÃ©verrouillÃ©</p>
                </div>
            </div>`;

    // AprÃ¨s 3 secondes, on affiche le portail complet
    setTimeout(() => {
      this.showPortal(caseId);
    }, 3000);
  },

  renderRevolutLoadingModal(caseId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    const price = (CONFIG?.REVOLUT?.AMOUNT_CENTS || 4999) / 100;
    content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-analyzing">
                    <div class="revolut-pay-header">
                        <div class="revolut-logo-ring">
                            <i class="fa-solid fa-lock" style="color:#7c4dff; font-size:1.8rem;"></i>
                        </div>
                        <h3>Paiement SÃ©curisÃ©</h3>
                        <p style="color:#aaa; font-size:0.82rem;">PrÃ©paration du checkout <strong style="color:#fff;">Revolut</strong>â€¦</p>
                    </div>
                    <div class="revolut-amount-badge">
                        <span class="revolut-amount-value">${price.toFixed(2)} â‚¬</span>
                        <span class="revolut-amount-label">Rapport Assurance certifiÃ© â€” ${caseId}</span>
                    </div>
                    <div class="ai-progress-bar" style="margin-top:20px;">
                        <div class="ai-progress-fill revolut-progress" style="width:30%;"></div>
                    </div>
                    <p class="ai-status-text" id="revolut-status-txt">CrÃ©ation de l'ordre de paiementâ€¦</p>
                </div>
            </div>`;
    // Animation de la barre
    setTimeout(() => {
      const fill = content.querySelector(".revolut-progress");
      const txt = content.querySelector("#revolut-status-txt");
      if (fill) fill.style.width = "70%";
      if (txt) txt.textContent = "Connexion Ã  Revolut Merchantâ€¦";
    }, 800);
    setTimeout(() => {
      const fill = content.querySelector(".revolut-progress");
      const txt = content.querySelector("#revolut-status-txt");
      if (fill) fill.style.width = "90%";
      if (txt) txt.textContent = "Ouverture du checkoutâ€¦";
    }, 1800);
  },

  renderRevolutPendingConfirmation(caseId, orderId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-satellite-dish fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3 style="margin-top:15px;">Confirmation en coursâ€¦</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">
                    Votre paiement a Ã©tÃ© soumis. En attente de la confirmation Revolut.
                </p>
                <div class="case-code-badge" style="margin-top:20px;">
                    <i class="fa-solid fa-hashtag"></i>
                    <span>Dossier :</span>
                    <strong>${caseId}</strong>
                </div>
                <div class="case-code-badge">
                    <i class="fa-brands fa-revolut" style="color:#7c4dff;"></i>
                    <span>Ordre Revolut :</span>
                    <strong style="font-size:0.7rem;">${orderId}</strong>
                </div>
                <p style="font-size:0.7rem; color:#555; margin-top:15px;">
                    <i class="fa-solid fa-clock"></i> VÃ©rification automatique toutes les 3 secondesâ€¦
                </p>
            </div>`;
  },

  renderRevolutErrorModal(caseId, message) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal litigation-error">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#ff4d4d;"></i>
                <h3>Erreur de paiement</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">${message || "Une erreur est survenue."}</p>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn-litigation-start" onclick="InsurancePortal.payInstant('${caseId}')" style="flex:1;">
                        <i class="fa-solid fa-rotate-right"></i> RÃ©essayer
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')" style="flex:1;">
                        <i class="fa-solid fa-times"></i> Fermer
                    </button>
                </div>
            </div>`;
  },

  // DOSSIER LITIGE IA â€” Lance l'analyse Blackbox intelligente
  openLitigationWizard(caseId) {
    if (typeof window.LitigationAI === "undefined") {
      alert(
        "Module LitigationAI non chargÃ©. VÃ©rifiez que litigation-ai.js est inclus dans la page.",
      );
      return;
    }
    window.LitigationAI.openPortal();
  },

  // OPTION 2 : Portefeuille
  payWithWallet(caseId) {
    if (this.balance >= 49.99) {
      this.balance -= 49.99;
      this.unlockCase(caseId, "wallet_debit");
      this.showPortal(caseId); // Refresh
      speak("DÃ©bit effectuÃ© sur votre compte pro. Rapport accessible.");
    } else {
      alert("Solde insuffisant sur votre portefeuille virtuel.");
      speak("Solde insuffisant.");
    }
  },

  // OPTION 3 : Preuve de virement
  uploadProof(caseId) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.cases[caseId] = {
          status: "pending_verification",
          unlocked: false,
        };
        this.showPortal(caseId);
        speak(
          "Preuve de virement reÃ§ue. Notre systÃ¨me vÃ©rifie le document.",
        );

        // Simulation de validation automatique aprÃ¨s 5s
        setTimeout(() => {
          this.unlockCase(caseId, "proof_validated");
          if (
            document
              .getElementById("screen-overlay")
              .classList.contains("hidden") === false
          ) {
            this.showPortal(caseId);
          }
          speak("Justificatif validÃ©. Le rapport est maintenant dÃ©bloquÃ©.");
        }, 5000);
      }
    };
    input.click();
  },

  renderTransactionHistory() {
    if (this.transactions.length === 0) return "";

    return `
            <div class="transaction-history">
                <h5><i class="fa-solid fa-clock-rotate-left"></i> Historique des Transactions</h5>
                <div class="transaction-list">
                    ${this.transactions
                      .map(
                        (t) => `
                        <div class="transaction-item">
                            <span>${new Date(t.date).toLocaleTimeString()} - ${t.caseId}</span>
                            <span class="t-amount">-${t.amount}â‚¬</span>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `;
  },

  unlockCase(caseId, method) {
    const amount = 49.99;
    this.cases[caseId] = {
      status: "unlocked",
      unlocked: true,
      method: method,
      timestamp: Date.now(),
    };

    this.transactions.unshift({
      date: Date.now(),
      caseId: caseId,
      amount: amount,
      method: method,
    });

    this.notify(`Transaction confirmÃ©e pour le dossier ${caseId}.`);
  },
};
