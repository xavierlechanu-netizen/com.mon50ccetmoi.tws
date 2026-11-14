/**
 * BLACK BOX SHOP - Abonnement Boîte Noire+ et packs de points (Revolut Checkout)
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

import { db } from './config.js';
import { registerAction } from './actionRegistry.js';

export const BlackBoxShop = {
  // Le boîtier n'est pas encore fabriqué : il n'est pas vendu (liste d'attente, js/blackbox-waitlist.js).
  // Ce module garde l'abonnement Boîte Noire+ et les packs de points.
  isProcessing: false,

  /**
   * Abonnement Boîte Noire+ (renouvellement après l'année offerte avec le boîtier).
   * Prix et durée fixés côté serveur (functions/api/payments-catalog.js).
   * @param {"MONTHLY"|"ANNUAL"} plan
   */
  subscribeCare: async function (plan) {
    if (this.isProcessing) return;
    const offers = {
      MONTHLY: { id: "BLACKBOX_CARE_MONTHLY", label: "Abonnement Boîte Noire+ (1 mois)", text: "4,99 € pour 1 mois" },
      ANNUAL: { id: "BLACKBOX_CARE_ANNUAL", label: "Abonnement Boîte Noire+ (1 an)", text: "50 € pour 1 an" },
    };
    const offer = offers[plan];
    if (!offer) return;
    if (!confirm(`Abonnement Boîte Noire+ : ${offer.text}, sans renouvellement automatique.\nConfirmer le paiement sécurisé ?`)) return;
    // Le module de paiement Revolut n'est chargé qu'au moment d'un achat
    if (typeof window.RevolutCheckout !== "function" && typeof window.loadRevolutSDK === "function") {
      await window.loadRevolutSDK().catch(() => {}); // l'échec est signalé par processRevolutPayment
    }
    await this.processRevolutPayment(offer.id, offer.label);
  },

  /**
   * Tunnel de Paiement Officiel Revolut Merchant API
   */
  processRevolutPayment: async function (reportType, label) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const caseId = "BB-SALE-" + Date.now();

    try {
      // 1. Appel Cloud Function sécurisée createRevolutOrder via ApiClient
      const ApiClient = window.ApiClient;
      if (!ApiClient) {
        throw new Error("Module API non chargé.");
      }

      let orderData;
      try {
        orderData = await ApiClient.authFetch("createRevolutOrder", {
          method: "POST",
          body: {
            case_id: caseId,
            report_type: reportType
          }
        });
      } catch (authErr) {
        if (authErr.name === "AuthRequiredError") {
          alert("Veuillez vous connecter pour commander votre boîte noire et assurer le suivi de garantie.");
          window.location.href = "login.html";
          this.isProcessing = false;
          return;
        }
        throw authErr;
      }

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
   * Packs officiels de Points mon50cc (Grille tarifaire à rentabilité maximale)
   */
  pointsPacks: {
    POINTS_100: { id: "POINTS_100", name: "Pack Starter", points: 100, price: 2.99, badge: "Starter" },
    POINTS_250: { id: "POINTS_250", name: "Pack Pilote", points: 250, price: 5.99, badge: "+25% Bonus" },
    POINTS_600: { id: "POINTS_600", name: "Pack Pro Rider", points: 600, price: 11.99, badge: "⭐ Populaire (+50%)", popular: true },
    POINTS_1500: { id: "POINTS_1500", name: "Coffre Légende", points: 1500, price: 24.99, badge: "👑 Max Rentabilité (+100%)", bestValue: true }
  },

  /**
   * Commande Pack de Points mon50cc
   */
  buyPointsPack: async function (packId) {
    if (this.isProcessing) return;
    const pack = this.pointsPacks[packId];
    if (!pack) {
      alert("Pack de points sélectionné non reconnu.");
      return;
    }

    const bonusText = pack.id === 'POINTS_250' ? " (+25% de points offerts)"
      : pack.id === 'POINTS_600' ? " (+50% de bonus inclus)"
      : pack.id === 'POINTS_1500' ? " (+100% de bonus · Double de points)" : "";

    const msg = `Recharger ${pack.points} Points mon50cc${bonusText}\n` +
      `Formule : ${pack.name}\n` +
      `Montant : ${pack.price.toFixed(2).replace('.', ',')} € TTC\n\n` +
      `Procéder au paiement sécurisé via Revolut Pay / Carte Bancaire ?`;

    if (confirm(msg)) {
      await this.processRevolutPayment(pack.id, `${pack.name} (${pack.points} PTS)`);
    }
  },

  /**
   * Polling de confirmation de commande
   */
  pollConfirmation: function (caseId, attempts = 0) {
    if (attempts > 15) {
      alert("Votre paiement est confirmé par Revolut et votre solde/commande sera mis à jour sous peu. Consultez votre profil.");
      this.isProcessing = false;
      return;
    }

    setTimeout(async () => {
      try {
        if (typeof db !== "undefined") {
          let doc = await db.collection("blackbox_sales").doc(caseId).get();
          if (!doc.exists) {
            doc = await db.collection("payment_confirmations").doc(caseId).get();
          }
          if (doc.exists) {
            const data = doc.data();
            const isPoints = data?.report_type && data.report_type.startsWith("POINTS_");
            if (isPoints) {
              const pts = data?.points_credited || (this.pointsPacks[data?.report_type]?.points) || "";
              alert(`🎉 Félicitations ! Votre recharge de ${pts ? pts + ' ' : ''}Points mon50cc a été créditée avec succès sur votre compte.`);
              if (window.BVCManager && typeof window.BVCManager.sync === "function") {
                await window.BVCManager.sync();
              }
            } else {
              alert("🎉 Votre achat est confirmé et enregistré.");
            }
            this.isProcessing = false;
            return;
          }
        }
      } catch (e) {
        console.warn("[BlackBoxShop] Poll avertissement :", e);
      }
      this.pollConfirmation(caseId, attempts + 1);
    }, 2500);
  },

  // Pack « caution + engagement 24 mois » : suspendu le 7/11/2026 (aucun prélèvement mensuel
  // n'existait). L'achat d'un boîtier inclut 1 an d'abonnement Boîte Noire+.
};

// Exposer globalement pour dom-security et l'ActionRegistry
window.BlackBoxShop = BlackBoxShop;
window.buyPointsPack = (packId) => BlackBoxShop.buyPointsPack(packId);

registerAction("BlackBoxShop.buyPointsPack", (packId) => BlackBoxShop.buyPointsPack(packId));
registerAction("BlackBoxShop.buyPoints100", () => BlackBoxShop.buyPointsPack("POINTS_100"));
registerAction("BlackBoxShop.buyPoints250", () => BlackBoxShop.buyPointsPack("POINTS_250"));
registerAction("BlackBoxShop.buyPoints600", () => BlackBoxShop.buyPointsPack("POINTS_600"));
registerAction("BlackBoxShop.buyPoints1500", () => BlackBoxShop.buyPointsPack("POINTS_1500"));
registerAction("buyPointsPack", (packId) => BlackBoxShop.buyPointsPack(packId));

