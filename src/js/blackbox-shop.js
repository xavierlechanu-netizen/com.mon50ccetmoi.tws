/**
 * BLACK BOX SHOP - Gestion des Ventes de Boîtiers Matériels (Revolut Checkout)
 * ─────────────────────────────────────────────────────────────────────────────
 * Intégration officielle Revolut Merchant API & Cloud Functions sécurisées.
 * 
 * Sécurité :
 *  - Aucune écriture directe client dans blackbox_sales (OWASP ASVS v5.0.0-2.3.3)
 *  - Paiement certifié par le Webhook Revolut (signature HMAC SHA-256)
 *  - Zero innerHTML dynamique (ASVS v5.0.0-3.2.2)
 *  - Tarification dynamique calculée et vérifiée côté serveur
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

export const BlackBoxShop = {
  // Configuration des prix (affichage)
  pricing: {
    first10: 49.99, // Offre lancement : Prototype garanti à vie
    standard: 89.99, // Tarif unitaire standard
    duo: 161.98, // Pack Duo (2 boîtiers)
  },

  salesCount: 0,
  maxPrototypeLifetime: 10,
  isProcessing: false,

  /**
   * Initialisation : Récupérer le nombre de ventes depuis Firestore
   */
  init: async function () {
    try {
      if (typeof db !== "undefined") {
        const statsRef = db.collection("stats").doc("blackbox_sales");
        const doc = await statsRef.get();
        if (doc.exists) {
          this.salesCount = doc.data().count || 0;
        }
      }
      this.updateUI();
    } catch (error) {
      console.warn("[BlackBoxShop] Avertissement chargement compteur ventes :", error);
    }
  },

  /**
   * Met à jour l'interface (100% textContent sécurisé)
   */
  updateUI: function () {
    const isPromo = this.salesCount < this.maxPrototypeLifetime;
    const currentPrice = isPromo ? this.pricing.first10 : this.pricing.standard;
    const remaining = Math.max(0, this.maxPrototypeLifetime - this.salesCount);

    const btnUnit = document.getElementById("bb-buy-unit-btn");
    if (btnUnit) {
      btnUnit.textContent = "";
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-cart-shopping";
      icon.style.marginRight = "8px";
      btnUnit.appendChild(icon);

      const label = document.createTextNode(
        isPromo
          ? `Commander (${currentPrice.toFixed(2).replace('.', ',')} €) - Reste ${remaining} Protos`
          : `Commander ma Boîte Noire (${currentPrice.toFixed(2).replace('.', ',')} €)`
      );
      btnUnit.appendChild(label);
    }

    const stockBadge = document.getElementById("bb-stock-count");
    if (stockBadge) {
      const estimatedStock = Math.max(0, 100 - this.salesCount);
      stockBadge.textContent = String(estimatedStock);
    }
  },

  /**
   * Commande Boîte Noire Unitaire
   */
  buyUnit: async function () {
    if (this.isProcessing) return;
    const isPromo = this.salesCount < this.maxPrototypeLifetime;
    const price = isPromo ? this.pricing.first10 : this.pricing.standard;
    const msg = isPromo
      ? `Offre de Lancement Francelog ! Vous commandez un Prototype garanti à vie.\nMontant: ${price} € TTC\nConfirmer le paiement sécurisé ?`
      : `Commande Boîte Noire 50 cc Standard.\nMontant: ${price} € TTC\nConfirmer le paiement sécurisé ?`;

    if (confirm(msg)) {
      await this.processRevolutPayment("BLACKBOX_UNIT", "Boîte Noire V1");
    }
  },

  /**
   * Commande Pack Duo
   */
  buyPack: async function () {
    if (this.isProcessing) return;
    const price = this.pricing.duo;
    if (confirm(`Commande Pack Duo (2 Boîtiers Standard Francelog).\nMontant: ${price} € TTC\nConfirmer le paiement sécurisé ?`)) {
      await this.processRevolutPayment("BLACKBOX_DUO", "Pack Duo Black Box");
    }
  },

  /**
   * Tunnel de Paiement Officiel Revolut Merchant API
   */
  processRevolutPayment: async function (reportType, label) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const projectId = CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
    const functionBaseUrl = `https://europe-west1-${projectId}.cloudfunctions.net`;
    const caseId = "BB-SALE-" + Date.now();

    try {
      // 1. Obtenir le token de session utilisateur si connecté
      let authHeader = "";
      if (typeof auth !== "undefined" && auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken(true);
        authHeader = `Bearer ${idToken}`;
      } else {
        alert("Veuillez vous connecter pour commander votre boîte noire et assurer le suivi de garantie.");
        window.location.href = "login.html";
        this.isProcessing = false;
        return;
      }

      // 2. Appel Cloud Function sécurisée createRevolutOrder
      const response = await fetch(`${functionBaseUrl}/createRevolutOrder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify({
          case_id: caseId,
          report_type: reportType
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erreur serveur (${response.status})`);
      }

      const orderData = await response.json();
      if (!orderData?.order_token) {
        throw new Error("Jeton de paiement Revolut introuvable.");
      }

      // 3. Charger et lancer le SDK Revolut Checkout
      if (typeof window.RevolutCheckout !== "function") {
        await new Promise(r => setTimeout(r, 1500));
        if (typeof window.RevolutCheckout !== "function") {
          throw new Error("SDK Revolut non initialisé. Veuillez vérifier votre connexion.");
        }
      }

      const instance = await window.RevolutCheckout(orderData.order_token, "prod");

      instance.payWithPopup({
        onSuccess: () => {
          alert("✅ Paiement Revolut validé ! Enregistrement de votre commande en cours...");
          this.pollConfirmation(caseId);
        },
        onError: (err) => {
          console.error("[Revolut Checkout] Erreur :", err);
          alert("Erreur lors de la transaction : " + (err.message || err));
          this.isProcessing = false;
        },
        onCancel: () => {
          console.log("[Revolut Checkout] Annulé par l'utilisateur.");
          this.isProcessing = false;
        }
      });

    } catch (err) {
      console.error("[BlackBoxShop] Échec paiement :", err);
      alert("Impossible d'initialiser le paiement sécurisé : " + err.message);
      this.isProcessing = false;
    }
  },

  /**
   * Polling de confirmation de commande
   */
  pollConfirmation: function (caseId, attempts = 0) {
    if (attempts > 15) {
      alert("Votre paiement est confirmé par Revolut et votre commande sera traitée sous peu. Consultez votre profil.");
      this.isProcessing = false;
      this.init();
      return;
    }

    setTimeout(async () => {
      try {
        if (typeof db !== "undefined") {
          const doc = await db.collection("blackbox_sales").doc(caseId).get();
          if (doc.exists) {
            alert("🎉 Félicitations ! Votre commande est officiellement enregistrée et validée. Expédition express garantie en moins de 24h !");
            this.isProcessing = false;
            await this.init();
            return;
          }
        }
      } catch (e) {
        console.warn("[BlackBoxShop] Poll avertissement :", e);
      }
      this.pollConfirmation(caseId, attempts + 1);
    }, 2500);
  },

  /**
   * Abonnement Premium
   */
  subscribePremium: async function () {
    if (confirm("Abonnement Boîte Noire+ (1er mois) - 4,99 €\nConfirmer l'abonnement ?")) {
      await this.processRevolutPayment("BLACKBOX_CARE_MONTHLY", "Abonnement Boîte Noire+");
    }
  }
};

// Exposer globalement pour dom-security et l'ActionRegistry
window.BlackBoxShop = BlackBoxShop;
registerAction("BlackBoxShop.buyUnit", () => BlackBoxShop.buyUnit());
registerAction("BlackBoxShop.buyPack", () => BlackBoxShop.buyPack());
registerAction("BlackBoxShop.subscribePremium", () => BlackBoxShop.subscribePremium());

// Initialisation automatique
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("blackbox-shop-section")) {
    BlackBoxShop.init();
  }
});
