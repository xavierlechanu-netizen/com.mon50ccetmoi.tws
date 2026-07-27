/**
 * CONFIGURATION GLOBALE - mon50ccetmoi
 * Centralisation des clÃ©s et configurations sensibles.
 */
const CONFIG = {
  // Google Maps API Keys
  MAPS: {
    PC: atob("QUl6YVN5Q05fZmV2VGlHOEF2V1B1RFMyS2NfV3B3bFlmRHk0azRN"),
    ANDROID: atob("QUl6YVN5Q05fZmV2VGlHOEF2V1B1RFMyS2NfV3B3bFlmRHk0azRN"),
    MAP_ID: "", // Laisser vide si non configurÃ© sur Google Cloud
  },

  // Auth Configuration
  AUTH: {
    GOOGLE_CLIENT_ID:
      "618915667828-ebv4uc1ehq7mhks9l1qajrtg7k833jab.apps.googleusercontent.com",
  },

  // App Versioning
  VERSION: "50.1.8-GOLD",

  // Firebase Cloud Database (Firestore)
  FIREBASE: {
    apiKey: atob("QUl6YVN5QnVmWjVobXpFb0RvT1o5WW9mcEh2TDNISkRidUVPYzdJ"),
    authDomain: "mon50ccetmoi.firebaseapp.com",
    projectId: "mon50ccetmoi",
    storageBucket: "mon50ccetmoi.appspot.com",
    messagingSenderId: "618915667828",
    appId: "1:618915667828:web:7f6d4e21a3b5c0d9e1f2",
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // REVOLUT BUSINESS â€” Paiements Merchant
  // ClÃ© publique Merchant (pk_...) â€” sans danger cÃ´tÃ© client
  // La clÃ© secrÃ¨te (sk_...) ne va JAMAIS ici â€” Firebase Functions uniquement
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  REVOLUT: {
    PUBLIC_KEY: "pk_kkwSOEhfQdseB6OVcsYEIpdAwxNxY0JvSUtgtQlLuNlFpNED", // ClÃ© Merchant publique
    PAYMENT_LINK: "", // Laisser vide â€” on utilise le SDK embarquÃ©
    MERCHANT_ID: "", // Rempli automatiquement par l'API
    CURRENCY: "EUR",
    AMOUNT_CENTS: 4999, // 49,99 â‚¬
    SUCCESS_REDIRECT: "https://mon50ccetmoi.com/?payment=success",
    FAIL_REDIRECT: "https://mon50ccetmoi.com/?payment=failed",
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PORTAIL ASSURANCE â€” ParamÃ¨tres IA litige
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSURANCE: {
    FIRESTORE_COLLECTION: "litigation_proposals", // Collection Firestore des propositions
    REPORT_PRICE_EUR: 49.99,
    // Seuils IA pour la sÃ©lection automatique du type de rapport
    AI_THRESHOLDS: {
      IMPACT_G: 3.5, // Au-dessus â†’ Rapport Impact
      EXPERT_G: 5.0, // Au-dessus â†’ Rapport Expertise ComplÃ¨te
      HIGH_SPEED_KMH: 60, // Vitesse considÃ©rÃ©e Ã©levÃ©e pour le contexte 50cc
      LEAN_ANGLE_DEG: 35, // Angle d'inclinaison critique
    },
  },
};

// --- FALLBACK SÃ‰CURISÃ‰ GLOBAL ---
// UtilisÃ© pour assurer que les fonctions existent avant le chargement des autres scripts
if (typeof window.secureSetItem === "undefined") {
  window.secureSetItem = function (key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("secureSetItem fallback error:", e);
    }
  };
}
if (typeof window.secureGetItem === "undefined") {
  window.secureGetItem = function (key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };
}
var secureSetItem = window.secureSetItem;
var secureGetItem = window.secureGetItem;
