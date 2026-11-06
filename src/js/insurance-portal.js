import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * PORTAIL ASSURANCE mon50ccetmoi
 * Paiements via Revolut Merchant API (SDK RevolutCheckout embarqué)
 * Flow : client ←’ Firebase Function (création ordre) ←’ Revolut ←’ webhook ←’ Firestore
 */
window.InsurancePortal = {
  // Clé publique Merchant (config.js) — utilisée côté client uniquement
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
  cases: {}, // Liste des dossiers en attente ou débloqués

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

    // eslint-disable-next-line no-restricted-syntax
container.innerHTML = `
            <div class="insurance-portal-container">
                <h3><i class="fa-solid fa-building-shield"></i> Portail Pro Assurance</h3>
                <div class="wallet-status">
                    <span>Votre Solde :</span>
                    <strong id="portal-balance">${this.balance.toFixed(2)} €</strong>
                </div>

                <div class="case-header">
                    <h4>Dossier : <span class="case-id">${caseId}</span></h4>
                    <p class="case-status status-${status}">${this.getStatusLabel(status)}</p>
                </div>

                ${isUnlocked ? this.renderUnlockedView(caseId) : this.renderPaymentOptions(caseId)}

                ${this.renderTransactionHistory()}

                <button data-action="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-close-portal">

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
                    Veuillez transmettre ce code de dossier à votre assureur :
                </p>
                <div class="case-code-badge" style="justify-content:center; margin: 20px 0;">
                    <i class="fa-solid fa-hashtag"></i>
                    <strong style="font-size:1.3rem;">${caseId}</strong>
                </div>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Votre assureur pourra déverrouiller le rapport depuis le <strong>Portail Expert</strong>.<br>
                    Le rapport sera disponible ici automatiquement dès validation du paiement.
                </p>
                <button data-action="InsurancePortal.pollPaymentConfirmation('${caseId}')" class="btn-litigation-start" style="margin-top:20px;">
                    <i class="fa-solid fa-rotate"></i> Rafraîchir le statut
                </button>
            </div>
        `;
  },

  renderUnlockedView(caseId) {
    return `
            <div class="unlocked-view">
                <p class="success-msg"><i class="fa-solid fa-circle-check"></i> Rapport débloqué avec succès.</p>
                <button data-action="window.BlackBoxInsurance.generateReport()" class="btn-download-report">
                    <i class="fa-solid fa-file-pdf"></i> Télécharger le Rapport Certifié
                </button>
                <button data-action="window.BlackBoxReplay.replay()" class="btn-replay-report">
                    <i class="fa-solid fa-play"></i> Rejouer le Trajet en 3D
                </button>
                <button data-action="InsurancePortal.showSealedReport('${caseId}')" class="btn-download-report">
                    <i class="fa-solid fa-stamp"></i> Voir le rapport scellé (assureur)
                </button>
            </div>
        `;
  },

  /**
   * Rapport tel qu'il a été scellé par le serveur au moment du paiement (lisible seulement
   * par le pilote, l'admin et l'assureur qui a payé). Construit avec textContent : aucune
   * donnée du dossier n'est interprétée comme du HTML.
   */
  async showSealedReport(caseId) {
    const content = document.getElementById("screen-content");
    if (!content || typeof db === "undefined") return;
    let data;
    try {
      const doc = await db.collection("litigation_proposals").doc(caseId).get();
      if (!doc.exists) throw new Error("Dossier introuvable");
      data = doc.data();
    } catch (e) {
      alert("Rapport non accessible : il n'est lisible qu'après paiement confirmé.");
      return;
    }
    const t = data.telemetry || {};
    const ai = data.ai || {};
    const sealedAt = data.sealed_at && data.sealed_at.toDate ? data.sealed_at.toDate().toLocaleString("fr-FR") : "—";
    const rows = [
      ["Dossier", data.caseCode || caseId],
      ["Date de l'incident", data.dateLabel || "—"],
      ["Niveau acheté", (data.paid_tiers && window.session?.uid && data.paid_tiers[window.session.uid]) || data.paid_tier || "—"],
      ["Force maximale", t.maxG_force != null ? `${t.maxG_force} G` : "—"],
      ["Position GPS", data.gpsIncident ? `${data.gpsIncident.lat}, ${data.gpsIncident.lng}` : (t.gpsIncident ? `${t.gpsIncident.lat}, ${t.gpsIncident.lng}` : "—")],
      ["Gravité estimée (IA)", ai.severityScore != null ? `${ai.severityScore} / 100` : "—"],
      ["Analyse IA", ai.reportDescription || "—"],
      ["Scellé par le serveur le", sealedAt],
      ["Empreinte SHA-256", data.evidence_sha256 || "—"],
      ["Horodatage", data.qualified_timestamp
        ? "Qualifié eIDAS"
        : data.free_timestamps
          ? `Non qualifié — FreeTSA : ${data.free_timestamps.rfc3161?.genTime ? new Date(data.free_timestamps.rfc3161.genTime).toLocaleString("fr-FR") : "échec"} · OpenTimestamps (Bitcoin) : ${data.free_timestamps.opentimestamps?.status ? "ancrage en cours" : "échec"}`
          : "En cours"],
      ["Intégrité", data.integrity_alert ? "ALERTE : données modifiées après le premier paiement" : "Conforme au sceau"],
    ];
    while (content.firstChild) content.removeChild(content.firstChild);
    const box = document.createElement("div");
    box.style.cssText = "padding:16px; color:#fff;";
    const h = document.createElement("h3");
    h.textContent = "Rapport de sinistre scellé";
    box.appendChild(h);
    const table = document.createElement("table");
    table.style.cssText = "width:100%; border-collapse:collapse; font-size:0.85rem;";
    for (const [label, value] of rows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = label;
      th.style.cssText = "text-align:left; padding:6px; color:#aaa; vertical-align:top; width:40%;";
      const td = document.createElement("td");
      td.textContent = String(value);
      td.style.cssText = "padding:6px; word-break:break-all;";
      tr.append(th, td);
      table.appendChild(tr);
    }
    box.appendChild(table);
    const note = document.createElement("p");
    note.style.cssText = "font-size:0.75rem; color:#888; margin-top:12px;";
    note.textContent = "L'empreinte SHA-256 permet de vérifier que les données n'ont pas été modifiées depuis le paiement.";
    box.appendChild(note);
    content.appendChild(box);
  },

  getStatusLabel(status) {
    const labels = {
      pending_payment: "En attente de paiement",
      waiting_for_funds: "Virement en cours (Attente réception)",
      pending_verification: "Vérification de la preuve en cours",
      unlocked: "Accès Autorisé",
    };
    return labels[status] || status;
  },

  // ──────────────────────────────────────────────────
  // OPTION 1 : Paiement Revolut Merchant (flow complet)
  // 1. Appel Firebase Function ←’ création ordre Revolut (clé secrète serveur)
  // 2. Récupération du order_token
  // 3. RevolutCheckout(token).payWithPopup()
  // 4. Webhook Revolut ←’ Firebase ←’ déblocage rapport
  // ──────────────────────────────────────────────────
  // reportType : code du catalogue (SIMPLE, INTERMEDIAIRE, EXPERT) choisi par l'assureur
  async payInstant(caseId, reportType, displayPrice) {
    this._displayPrice = typeof displayPrice === "number" ? displayPrice : null;
    const pubKey = this.revolutPublicKey;
    if (!pubKey) {
      alert("⚠ï¸ Clé publique Revolut manquante dans config.js");
      return;
    }

    // Étape 1 : Afficher le spinner de chargement
    this.cases[caseId] = { status: "waiting_for_funds", unlocked: false };
    this.renderRevolutLoadingModal(caseId);

    try {
      // Étape 2 : Créer l'ordre côté serveur via Firebase Function
      speak("Initialisation du paiement sécurisé Revolut.");
      const orderData = await this.createOrderViaFunction(caseId, reportType);

      if (!orderData?.order_token) {
        throw new Error("Token de paiement Revolut non reçu.");
      }

      // Étape 3 : Lancer le checkout Revolut avec le token
      await this.launchRevolutCheckout(caseId, orderData);
    } catch (err) {
      console.error("[Revolut] Erreur paiement :", err);
      this.renderRevolutErrorModal(caseId, err.message);
    }
  },

  // ─ Appel Firebase Function : création de l'ordre Revolut ────────────
  async createOrderViaFunction(caseId, requestedType) {
    // L'ancien code envoyait « STANDARD », absent du catalogue : le paiement échouait toujours.
    const valid = ["SIMPLE", "INTERMEDIAIRE", "EXPERT"];
    const reportType = valid.includes(requestedType)
      ? requestedType
      : window.LitigationAI?.toCatalogType
        ? window.LitigationAI.toCatalogType(window.LitigationAI?.lastAnalysis?.reportType)
        : "SIMPLE";

    if (!window.ApiClient) {
      throw new Error("Module API non chargé.");
    }

    return await window.ApiClient.authFetch("createRevolutOrder", {
      method: "POST",
      body: {
        case_id: caseId,
        report_type: reportType,
      },
    });
  },

  // ─ Lance RevolutCheckout avec le token reçu ───────────────────
  async launchRevolutCheckout(caseId, orderData) {
    if (typeof RevolutCheckout !== "function") {
      // SDK pas encore chargé (async) — attendre 2s et réessayer
      await new Promise((r) => setTimeout(r, 2000));
      if (typeof RevolutCheckout !== "function") {
        throw new Error("SDK Revolut non chargé. Vérifiez votre connexion.");
      }
    }

    const instance = await RevolutCheckout(orderData.order_token, "prod");
    
    // Vider le texte de chargement
    const container = document.getElementById("revolut-pay-button-container");
    if (container) {
        // eslint-disable-next-line no-restricted-syntax
container.innerHTML = "";
    }

    // Utilisation de Revolut Pay (bouton natif) au lieu de la popup classique
    instance.revolutPay({
      target: document.getElementById("revolut-pay-button-container"),
      onSuccess: () => {
        speak("Paiement Revolut confirmé. Vérification en cours.");
        this.renderRevolutPendingConfirmation(caseId, orderData.order_id);
        // Le webhook Revolut va débloquer le rapport dans Firestore.
        this.pollPaymentConfirmation(caseId);
      },
      onError: (message) => {
        console.error("[Revolut] Erreur checkout :", message);
        this.renderRevolutErrorModal(caseId, message);
      },
      onCancel: () => {
        speak("Paiement annulé.");
        this.cases[caseId] = { status: "pending_payment", unlocked: false };
        this.showPortal(caseId);
      },
    });
  },

  // ─ Poll Firestore pour détecter la confirmation webhook ────────
  async pollPaymentConfirmation(caseId, attempts = 0) {
    if (attempts > 20) {
      // Timeout après ~60s
      this.renderRevolutErrorModal(
        caseId,
        "Délai de confirmation dépassé. Contactez le support.",
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 3000));

    try {
      // Vérifier dans Firestore si le webhook a confirmé le paiement
      if (typeof db !== "undefined") {
        // Le dossier n'est lisible que par le pilote, l'admin et l'assureur qui a payé :
        // s'il est lisible et débloqué, le paiement a été confirmé par le serveur.
        let unlocked = false;
        try {
          const caseDoc = await db.collection("litigation_proposals").doc(caseId).get();
          unlocked = caseDoc.exists && caseDoc.data().report_unlocked === true;
        } catch (e) {
          unlocked = false; // pas encore payé : lecture refusée par les règles
        }
        if (unlocked) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport débloqué avec succès.");
          return;
        }
        const doc = await db
          .collection("payment_confirmations")
          .doc(caseId)
          .get()
          .catch(() => ({ exists: false }));
        if (doc.exists) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport débloqué avec succès. Bonne route.");
          return;
        }
      } else {
        // Fallback : vérifier via la Cloud Function sécurisée
        if (window.ApiClient) {
          const data = await window.ApiClient.authFetch("checkPaymentStatus", {
            method: "GET",
            query: { case_id: caseId, user_id: window.session?.uid || "" }
          });
          if (data && data.paid) {
            this.unlockCase(caseId, "revolut_webhook");
            this.renderRevolutSuccess(caseId);
            speak("Rapport débloqué avec succès.");
            return;
          }
        }
      }
    } catch (e) {
      console.warn("[Revolut Poll] Erreur :", e);
    }

    // Continuer à poller
    this.pollPaymentConfirmation(caseId, attempts + 1);
  },

  // ─ Modals UI ─────────────────────────────────────────────────
  renderRevolutSuccess(caseId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
content.innerHTML = `
            <div class="litigation-portal" style="animation: portal-fade-in 0.5s ease-out;">
                <div class="litigation-analyzing" style="text-align:center; padding: 40px 20px;">
                    <div class="revolut-logo-ring" style="border-color: #00ff00; box-shadow: 0 0 30px rgba(0,255,0,0.5);">
                        <i class="fa-solid fa-unlock" style="color:#00ff00; font-size:2rem; animation: pulse-halo 2s infinite;"></i>
                    </div>
                    <h3 style="color:#00ff00; font-size:1.5rem; margin-top:20px;">Paiement Validé</h3>
                    <p style="color:#fff; font-size:0.9rem; margin-top:10px;">Le webhook Revolut a confirmé la transaction.</p>
                    <p style="color:#00d2ff; font-size:1rem; margin-top:5px; font-weight:bold;">Rapport Déverrouillé</p>
                </div>
            </div>`;

    // Après 3 secondes, on affiche le portail complet
    setTimeout(() => {
      this.showPortal(caseId);
    }, 3000);
  },

  renderRevolutLoadingModal(caseId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    const price = this._displayPrice || (CONFIG?.REVOLUT?.AMOUNT_CENTS || 4999) / 100;
    // eslint-disable-next-line no-restricted-syntax
content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-analyzing">
                    <div class="revolut-pay-header">
                        <div class="revolut-logo-ring">
                            <i class="fa-solid fa-lock" style="color:#7c4dff; font-size:1.8rem;"></i>
                        </div>
                        <h3>Paiement Sécurisé</h3>
                        <p style="color:#aaa; font-size:0.82rem;">Préparation de <strong style="color:#fff;">Revolut Pay</strong>…</p>
                    </div>
                    <div class="revolut-amount-badge">
                        <span class="revolut-amount-value">${price.toFixed(2)} €</span>
                        <span class="revolut-amount-label">Rapport Assurance certifié — ${caseId}</span>
                    </div>
                    <div id="revolut-pay-button-container" style="margin-top:20px; min-height:50px; display:flex; justify-content:center; align-items:center;">
                        <p class="ai-status-text" id="revolut-status-txt">Génération du lien de paiement…</p>
                    </div>
                </div>
            </div>`;
  },

  renderRevolutPendingConfirmation(caseId, orderId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-satellite-dish fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3 style="margin-top:15px;">Confirmation en cours…</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">
                    Votre paiement a été soumis. En attente de la confirmation Revolut.
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
                    <i class="fa-solid fa-clock"></i> Vérification automatique toutes les 3 secondes…
                </p>
            </div>`;
  },

  renderRevolutErrorModal(caseId, message) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
content.innerHTML = `
            <div class="litigation-portal litigation-error">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#ff4d4d;"></i>
                <h3>Erreur de paiement</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">${message || "Une erreur est survenue."}</p>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn-litigation-start" data-action="InsurancePortal.payInstant('${caseId}')" style="flex:1;">
                        <i class="fa-solid fa-rotate-right"></i> Réessayer
                    </button>
                    <button class="btn-close-litigation" data-action="document.getElementById('screen-overlay').classList.add('hidden')" style="flex:1;">
                        <i class="fa-solid fa-times"></i> Fermer
                    </button>
                </div>
            </div>`;
  },

  // DOSSIER LITIGE IA — Lance l'analyse Blackbox intelligente
  openLitigationWizard(caseId) {
    if (typeof window.LitigationAI === "undefined") {
      alert(
        "Module LitigationAI non chargé. Vérifiez que litigation-ai.js est inclus dans la page.",
      );
      return;
    }
    window.LitigationAI.openPortal();
  },

  // OPTION 2 : Portefeuille
  // Ancien « portefeuille » : son solde était stocké dans le navigateur, donc modifiable par
  // n'importe qui. Désactivé : seul un paiement Revolut confirmé par le serveur débloque un rapport.
  payWithWallet(caseId) {
    alert("Le paiement par portefeuille n'est pas disponible. Utilisez le paiement sécurisé Revolut.");
    this.showPortal(caseId);
  },

  // Ancienne « preuve de virement » : n'importe quel PDF débloquait le rapport au bout de 5 s,
  // sans aucune vérification. Désactivé tant qu'une vérification par un administrateur n'existe pas.
  uploadProof(caseId) {
    alert("Le paiement par virement n'est pas encore disponible. Utilisez le paiement sécurisé Revolut.");
    this.showPortal(caseId);
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
                            <span class="t-amount">-${t.amount}€</span>
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

    this.notify(`Transaction confirmée pour le dossier ${caseId}.`);
  },
};
