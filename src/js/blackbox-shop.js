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
  realStockCount: null,
  prototypeStockCount: null,
  isProcessing: false,

  /**
   * Initialisation : Récupérer le stock réel de l'atelier depuis Firestore
   */
  init: async function () {
    try {
      if (typeof db !== "undefined") {
        // 1. Lire stats/blackbox_stock (compteurs synchronisés depuis blackbox_units)
        let stockDoc = await db.collection("stats").doc("blackbox_stock").get();
        if (!stockDoc.exists) {
          stockDoc = await db.collection("stats").doc("blackbox_sales").get();
        }

        if (stockDoc.exists) {
          const sData = stockDoc.data();
          if (typeof sData.inStockCount === "number") {
            this.realStockCount = sData.inStockCount;
          }
          if (typeof sData.prototypeInStockCount === "number") {
            this.prototypeStockCount = sData.prototypeInStockCount;
          }
          this.salesCount = sData.count || 0;
        }

        // 2. Si un admin est connecté, tenter le décompte exact direct sur la collection
        if (typeof auth !== "undefined" && auth.currentUser) {
          try {
            const countSnap = await db.collection("blackbox_units")
              .where("status", "==", "IN_STOCK")
              .count()
              .get();
            if (countSnap && typeof countSnap.data().count === "number") {
              this.realStockCount = countSnap.data().count;
            }

            const protoSnap = await db.collection("blackbox_units")
              .where("type", "==", "PROTOTYPE")
              .where("status", "==", "IN_STOCK")
              .count()
              .get();
            if (protoSnap && typeof protoSnap.data().count === "number") {
              this.prototypeStockCount = protoSnap.data().count;
            }
          } catch (_) {
            // Visiteur standard : le compteur sécurisé de stats/blackbox_stock est utilisé
          }
        }
      }
      this.updateUI();
    } catch (error) {
      console.warn("[BlackBoxShop] Avertissement chargement stock atelier :", error);
    }
  },

  /**
   * Met à jour l'interface (100% textContent sécurisé)
   */
  updateUI: function () {
    // Si des prototypes sont physiquement en stock dans l'atelier, la promo lancement s'applique
    const remainingProtos = this.prototypeStockCount !== null
      ? this.prototypeStockCount
      : Math.max(0, this.maxPrototypeLifetime - this.salesCount);
    const isPromo = remainingProtos > 0;
    const currentPrice = isPromo ? this.pricing.first10 : this.pricing.standard;

    const btnUnit = document.getElementById("bb-buy-unit-btn");
    if (btnUnit) {
      btnUnit.textContent = "";
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-cart-shopping";
      icon.style.marginRight = "8px";
      btnUnit.appendChild(icon);

      const label = document.createTextNode(
        isPromo
          ? `Commander (${currentPrice.toFixed(2).replace('.', ',')} €) - Reste ${remainingProtos} Protos`
          : `Commander ma Boîte Noire (${currentPrice.toFixed(2).replace('.', ',')} €)`
      );
      btnUnit.appendChild(label);
    }

    const stockBadge = document.getElementById("bb-stock-count");
    if (stockBadge) {
      const displayStock = this.realStockCount !== null
        ? this.realStockCount
        : Math.max(0, 100 - this.salesCount);
      stockBadge.textContent = String(displayStock);
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
      this.init();
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
              alert("🎉 Félicitations ! Votre commande est officiellement enregistrée et validée. Expédition express garantie en moins de 24h !");
            }
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
   * Pack Boîte Noire avec Abonnement (Engagement 24 mois & Dépôt de garantie 49,99 €)
   */
  buyPackSubscription: async function () {
    if (this.isProcessing) return;
    const msg = "Pack Boîte Noire + Abonnement (Engagement 24 mois)\n\n" +
      "• Boîtier officiel Francelog mis à disposition sous caution\n" +
      "• Dépôt de garantie initial : 49,99 € TTC (restituable à la fin du contrat)\n" +
      "• Abonnement mensuel : 4,99 € /mois (IA Litige, Alertes Assureur, Historique illimité)\n" +
      "• Engagement : 24 mois\n\n" +
      "Confirmer la commande et régler le dépôt de garantie de 49,99 € via Revolut ?";

    if (confirm(msg)) {
      await this.processRevolutPayment("BLACKBOX_PACK_SUB", "Pack Boîte Noire + Abonnement (Caution 49,99 €)");
    }
  },

  /**
   * Rétro-compatibilité : Abonnement Premium appelle le Pack Abonnement
   */
  subscribePremium: async function () {
    return this.buyPackSubscription();
  }
};

// Exposer globalement pour dom-security et l'ActionRegistry
window.BlackBoxShop = BlackBoxShop;
window.buyPointsPack = (packId) => BlackBoxShop.buyPointsPack(packId);

registerAction("BlackBoxShop.buyUnit", () => BlackBoxShop.buyUnit());
registerAction("BlackBoxShop.buyPack", () => BlackBoxShop.buyPack());
registerAction("BlackBoxShop.buyPackSubscription", () => BlackBoxShop.buyPackSubscription());
registerAction("BlackBoxShop.subscribePremium", () => BlackBoxShop.subscribePremium());
registerAction("BlackBoxShop.buyPointsPack", (packId) => BlackBoxShop.buyPointsPack(packId));
registerAction("BlackBoxShop.buyPoints100", () => BlackBoxShop.buyPointsPack("POINTS_100"));
registerAction("BlackBoxShop.buyPoints250", () => BlackBoxShop.buyPointsPack("POINTS_250"));
registerAction("BlackBoxShop.buyPoints600", () => BlackBoxShop.buyPointsPack("POINTS_600"));
registerAction("BlackBoxShop.buyPoints1500", () => BlackBoxShop.buyPointsPack("POINTS_1500"));
registerAction("buyPointsPack", (packId) => BlackBoxShop.buyPointsPack(packId));

// Initialisation automatique
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("blackbox-shop-section") || document.getElementById("recharge-points-section")) {
    BlackBoxShop.init();
  }
});
