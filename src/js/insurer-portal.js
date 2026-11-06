import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

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
      alert("Accès refusé : Identifiants invalides ou compte inexistant.");
    }
  },

  signup: function () {
    alert(
      "La création de compte Assureur est gérée manuellement par notre équipe pour des raisons de sécurité. Veuillez nous contacter.",
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

  verifyCode: async function () {
    const input = document
      .getElementById("insurer-code-input")
      .value.trim()
      .toUpperCase();
    if (!input.startsWith("LITIGE-")) {
      alert("Code Invalide. Le format attendu est LITIGE-XXXXXX");
      return;
    }

    try {
      if (typeof db === "undefined") {
        alert("Base sécurisée indisponible. Réessayez dans un instant.");
        return;
      }
      // Avant paiement, l'assureur ne voit que l'aperçu (aucune donnée de conduite) :
      // les données complètes ne lui deviennent lisibles qu'après paiement confirmé par le serveur.
      const doc = await db.collection("litigation_previews").doc(input).get();
      if (!doc.exists) {
        alert("Dossier introuvable. Vérifiez le code transmis par le pilote.");
        return;
      }
      const preview = doc.data();
      if (typeof preview.expiresAt === "number" && Date.now() > preview.expiresAt) {
        alert("Code expiré : il est valable 72 h. Le pilote doit générer un nouveau code depuis son application.");
        return;
      }
      this.currentPreview = preview;

      document.getElementById("insurer-dashboard-box").classList.add("hidden");
      document.getElementById("insurer-pricing-box").classList.remove("hidden");
      this.currentCode = input;
    } catch (e) {
        console.error("Erreur Firestore :", e);
        alert("Erreur de connexion à la base sécurisée.");
    }
  },

  // Paiement réel par Revolut. Le rapport n'est débloqué que lorsque le serveur reçoit la
  // confirmation de Revolut (webhook) : aucun écran « transaction validée » sans paiement.
  buyReport: async function (type, price) {
    const codes = { Standard: "SIMPLE", "Intermédiaire": "INTERMEDIAIRE", Expert: "EXPERT" };
    const reportType = codes[type];
    if (!reportType || !this.currentCode) {
      alert("Saisissez d'abord un code de dossier valide.");
      return;
    }
    if (!window.InsurancePortal || typeof window.InsurancePortal.payInstant !== "function") {
      alert("Module de paiement non chargé. Rechargez la page.");
      return;
    }
    // L'acheteur doit être une entreprise vérifiée (son SIREN figure sur la facture)
    const company = await this.ensureCompanyProfile();
    if (!company) return;

    const ht = Math.round(price * 100);
    const ttc = ht + Math.round(ht * 0.2);
    const fmt = (c) => (c / 100).toFixed(2).replace(".", ",");
    if (!confirm(`Confirmez-vous l'achat du rapport ${type} ?\n\n${fmt(ht)} € HT + TVA 20 % = ${fmt(ttc)} € TTC\nFacturé à : ${company.name} (SIREN ${company.siren})\n\nPaiement sécurisé par Revolut. Le rapport sera accessible dès la confirmation du paiement.`)) {
      return;
    }
    const overlay = document.getElementById("screen-overlay");
    if (overlay) overlay.classList.remove("hidden");
    await window.InsurancePortal.payInstant(this.currentCode, reportType, ttc / 100);
  },

  /**
   * Vérifie (une seule fois) l'entreprise de l'acheteur à partir de son SIREN, via le serveur
   * qui consulte l'annuaire public des entreprises. Renvoie { name, siren } ou null.
   */
  ensureCompanyProfile: async function () {
    if (typeof firebase === "undefined" || !firebase.functions) {
      alert("Service indisponible. Rechargez la page.");
      return null;
    }
    const fns = firebase.functions("europe-west1");
    try {
      const existing = await fns.httpsCallable("getInsurerProfile")();
      if (existing.data && existing.data.registered) return existing.data;
    } catch (e) {
      alert("Connectez-vous à votre compte pour acheter un rapport.");
      return null;
    }
    const siren = prompt("Achat réservé aux professionnels de l'assurance (assureurs, courtiers, experts, avocats).\n\nNuméro SIREN de votre entreprise (9 chiffres) :");
    if (!siren) return null;
    const billingEmail = prompt("Adresse email où recevoir les factures :");
    if (!billingEmail) return null;
    try {
      const res = await fns.httpsCallable("registerInsurerProfile")({ siren: siren.trim(), billingEmail: billingEmail.trim() });
      const c = res.data;
      alert(`Entreprise vérifiée : ${c.name}\n${c.address}\nActivité : ${c.nafLabel}\nN° TVA : ${c.vatNumber}`);
      return c;
    } catch (e) {
      alert(e.message || "Vérification de l'entreprise impossible.");
      return null;
    }
  },
};
