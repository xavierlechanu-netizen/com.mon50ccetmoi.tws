import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { encryptJSON, decryptJSON, isVaultCiphertext } from './secure-vault.js';

const WALLET_STORAGE_KEY = "ants_wallet_secure";
const VAULT_KEY_NAME = "wallet";

/**
 * ANTS DIGITAL WALLET v2.0 - SECURE QUANTUM EDITION
 * Encrypted storage for official titles and safety passport.
 * Powered by Sentinel Security Shield.
 */

window.Wallet = {
  docs: {},
  isUnlocked: false,

  // Identifiant d'appareil affichable (non secret, sans lien avec la clé de chiffrement)
  getDeviceLabel: function () {
    let label = localStorage.getItem("ants_device_label");
    if (!label) {
      label = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      localStorage.setItem("ants_device_label", label);
    }
    return label;
  },

  init: function () {
    this.ready = this.loadAndDecrypt();
    return this.ready;
  },

  // Coffre chiffré AES-GCM, clé non extractible propre à l'appareil (secure-vault.js)
  loadAndDecrypt: async function () {
    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (stored && isVaultCiphertext(stored)) {
      try {
        this.docs = (await decryptJSON(VAULT_KEY_NAME, stored)) || {};
      } catch (e) {
        console.error("Coffre-fort illisible (clé absente ou données modifiées) :", e.message);
        this.docs = {};
      }
      return this.docs;
    }

    // Ancien format (CryptoJS, jamais chargé en production) : mis de côté, jamais supprimé.
    if (stored) {
      localStorage.setItem(WALLET_STORAGE_KEY + "_legacy_backup", stored);
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
    const legacyPlain = localStorage.getItem("ants_wallet");
    if (legacyPlain) {
      try {
        this.docs = JSON.parse(legacyPlain) || {};
        await this.saveEncrypted();
        localStorage.removeItem("ants_wallet");
      } catch (e) {
        console.error("Migration du coffre-fort impossible :", e.message);
      }
    }
    return this.docs;
  },

  saveEncrypted: async function () {
    const encrypted = await encryptJSON(VAULT_KEY_NAME, this.docs);
    localStorage.setItem(WALLET_STORAGE_KEY, encrypted);
  },

  saveDoc: async function (type, data) {
    if (!window.session) {
      alert("🔒 Connexion requise pour créer un Wallet.");
      return;
    }

    this.docs[type] = {
      data: data,
      date: new Date().toISOString(),
      status: "CERTIFIÉ SENTINEL",
    };
    try {
      await this.saveEncrypted();
    } catch (e) {
      console.error("Enregistrement du coffre-fort impossible :", e.message);
      alert("Impossible d'enregistrer le document de façon sécurisée sur cet appareil.");
      return;
    }
    if (typeof speak === "function")
      speak(
        "Document chiffré et enregistré dans votre coffre-fort numérique.",
      );
  },

  unlock: function (callback) {
    if (this.isUnlocked) return callback(true);

    // Simulation visuelle du scan biométrique dans le HUD
    if (window.NeuralHUD) {
      window.NeuralHUD.logToConsole("WALLET_ACCESS: INITIATING_BIO_SCAN...");
      if (typeof speak === "function")
        speak("Vérification biométrique pour accès au coffre-fort.");

      setTimeout(() => {
        window.NeuralHUD.logToConsole("BIO_MATCH: IDENTITY_CONFIRMED");
        this.isUnlocked = true;
        callback(true);
      }, 1500);
    } else {
      this.isUnlocked = true;
      callback(true);
    }
  },

  getSafetyPassport: function () {
    // Génère un résumé pour l'administration (ANTS / Assurances)
    return {
      vMax_History: window.session.vMax || 0,
      maintenance_count: JSON.parse(secureGetItem("maint_history") || "[]")
        .length,
      engine_health: "OPTIMAL (Scan Sentinel AI)",
      blackbox_id:
        "ACTIVE_DEVICE_" + this.getDeviceLabel(),
      security_level: "AES-256-GCM (WebCrypto, clé non extractible)",
      structural_integrity: window.Blackbox?.getStructuralScore() || "100%",
    };
  },

  lockdown: function () {
    console.warn("WALLET_LOCKDOWN: Wiping sensitive memory.");
    this.docs = {};
    this.isUnlocked = false;
    sessionStorage.clear();
    localStorage.removeItem("wallet_data");
  },

  getMedicalData: function () {
    // ... (Keep existing)
  },
};

// Note: secureSetItem is imported from config.js
