/**
 * CONFIGURATION GLOBALE - mon50ccetmoi
 * Centralisation des clés et configurations sensibles.
 */
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import localforage from 'localforage';

export const CONFIG = {
  // Google Maps API Keys
  MAPS: {
    PC: "AIzaSyCN_fevTiG8AvWPuDS2Kc_WpwlYfDy4k4M",
    ANDROID: "AIzaSyCN_fevTiG8AvWPuDS2Kc_WpwlYfDy4k4M",
    MAP_ID: "", // Laisser vide si non configuré sur Google Cloud
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
    apiKey: "AIzaSyBufZ5hmzEoDoOZ9YofpHvL3HJDbuEOc7I",
    authDomain: "mon50ccetmoi.firebaseapp.com",
    projectId: "mon50ccetmoi",
    storageBucket: "mon50ccetmoi.firebasestorage.app",
    messagingSenderId: "618915667828",
    appId: "1:618915667828:web:8508e0362e4edd0a0dd621",
    measurementId: "G-S482ZE7TKG"
  },

  // ─────────────────────────────────────────────────────
  // REVOLUT BUSINESS — Paiements Merchant
  // Clé publique Merchant (pk_...) — sans danger côté client
  // La clé secrète (sk_...) ne va JAMAIS ici — Firebase Functions uniquement
  // ─────────────────────────────────────────────────────
  REVOLUT: {
    PUBLIC_KEY: "pk_kkwSOEhfQdseB6OVcsYEIpdAwxNxY0JvSUtgtQlLuNlFpNED", // Clé Merchant publique
    PAYMENT_LINK: "", // Laisser vide — on utilise le SDK embarqué
    MERCHANT_ID: "", // Rempli automatiquement par l'API
    CURRENCY: "EUR",
    AMOUNT_CENTS: 4999, // 49,99 €
    SUCCESS_REDIRECT: "https://mon50ccetmoi.com/?payment=success",
    FAIL_REDIRECT: "https://mon50ccetmoi.com/?payment=failed",
  },

  // ─────────────────────────────────────────────────────
  // PORTAIL ASSURANCE — Paramètres IA litige
  // ─────────────────────────────────────────────────────
  INSURANCE: {
    FIRESTORE_COLLECTION: "litigation_proposals", // Collection Firestore des propositions
    REPORT_PRICE_EUR: 49.99,
    // Seuils IA pour la sélection automatique du type de rapport
    AI_THRESHOLDS: {
      IMPACT_G: 3.5, // Au-dessus ←’ Rapport Impact
      EXPERT_G: 5.0, // Au-dessus ←’ Rapport Expertise Complète
      HIGH_SPEED_KMH: 60, // Vitesse considérée élevée pour le contexte 50cc
      LEAN_ANGLE_DEG: 35, // Angle d'inclinaison critique
    },
  },
};

// Initialize Firebase once
if (!firebase.apps.length) {
    firebase.initializeApp(CONFIG.FIREBASE);
    if (typeof firebase.appCheck === 'function') {
      const recaptchaKey = CONFIG?.FIREBASE?.RECAPTCHA_SITE_KEY;
      if (recaptchaKey && recaptchaKey !== 'INSERER_CLE_RECAPTCHA_ICI') {
        try {
          const appCheck = firebase.appCheck();
          appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider(recaptchaKey),
            true
          );
        } catch (e) {
          console.warn('[AppCheck] Initialisation ignor�e ou �chou�e:', e);
        }
      }
    }
}
export const db = firebase.firestore();
export const auth = firebase.auth();
export { firebase };

if (typeof window !== 'undefined') {
  window.firebase = firebase;
  window.db = db;
  window.auth = auth;
  window.CONFIG = CONFIG;
}


// --- HYBRID INDEXEDDB / LOCALSTORAGE LAYER (Phase 5) ---
// Initialize localforage for scalable, non-blocking asynchronous storage
localforage.config({
  name: 'mon50ccetmoi',
  storeName: 'app_storage',
  description: 'Stockage local haute performance mon50ccetmoi'
});

// Cache mémoire pour accès synchrone 0ms compatible avec les 260 appels existants
const memoryCache = new Map();

// Hydratation initiale depuis localStorage
try {
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) memoryCache.set(k, localStorage.getItem(k));
    }
  }
} catch (e) {
  console.warn('[Storage] Avertissement initialisation cache local:', e);
}

// Hydratation asynchrone depuis IndexedDB en arrière-plan
localforage.iterate((value, key) => {
  memoryCache.set(key, typeof value === 'string' ? value : JSON.stringify(value));
}).catch(err => console.warn('[Storage] Hydratation IndexedDB:', err));

// Fonctions modernes asynchrones
export async function setItemAsync(key, value) {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  memoryCache.set(key, strVal);
  try { localStorage.setItem(key, strVal); } catch (e) {}
  return localforage.setItem(key, strVal);
}

export async function getItemAsync(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  const idbVal = await localforage.getItem(key);
  if (idbVal !== null && idbVal !== undefined) {
    const str = typeof idbVal === 'string' ? idbVal : JSON.stringify(idbVal);
    memoryCache.set(key, str);
    return str;
  }
  return localStorage.getItem(key);
}

// Wrappers synchrones haute performance compatibles avec tout le code existant
window.secureSetItem = function (key, value) {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  memoryCache.set(key, strVal);
  try {
    localStorage.setItem(key, strVal);
  } catch (e) {
    console.warn('[Storage] Quota localStorage dépassé, persistance exclusive en IndexedDB:', e);
  }
  // Sauvegarde asynchrone dans IndexedDB (pas de limite 5 Mo)
  localforage.setItem(key, strVal).catch(err => {
    console.error('[Storage] Erreur sauvegarde IndexedDB:', err);
  });
  return strVal;
};

window.secureGetItem = function (key) {
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  try {
    const val = localStorage.getItem(key);
    if (val !== null) {
      memoryCache.set(key, val);
      return val;
    }
  } catch (e) {}
  return null;
};

export const secureSetItem = window.secureSetItem;
export const secureGetItem = window.secureGetItem;
export { localforage };

// --- COOKIE CONSENT BANNER ---
document.addEventListener("DOMContentLoaded", function () {
  if (localStorage.getItem("cookie_consent_accepted") !== "true") {
    const banner = document.createElement("div");
    banner.id = "cookie-consent-banner";
    banner.style.cssText = "position:fixed; bottom:0; left:0; width:100%; background:#1a1a1a; color:white; padding:15px 20px; z-index:9999999; display:flex; justify-content:space-between; align-items:center; border-top:2px solid #ffb703; flex-wrap:wrap; box-sizing:border-box; font-family:'Inter', sans-serif;";
    // eslint-disable-next-line no-restricted-syntax
    banner.innerHTML = `
      <div style="flex: 1 1 300px; margin-right: 15px; font-size: 0.9rem; margin-bottom: 10px;">
        Nous utilisons des cookies strictement nécessaires pour assurer le bon fonctionnement de l'application (authentification, préférences locales). 
        En continuant votre navigation, vous acceptez l'utilisation de ces traceurs fonctionnels. 
        <a href="cookies.html" style="color:#ffb703; text-decoration:underline; font-weight:bold;">En savoir plus</a>
      </div>
      <button id="btn-accept-cookies" style="background:#ffb703; color:black; border:none; padding:10px 20px; border-radius:30px; font-weight:bold; cursor:pointer; white-space:nowrap; transition:transform 0.2s;">
        J'ai compris
      </button>
    `;
    document.body.appendChild(banner);

    document.getElementById("btn-accept-cookies").addEventListener("click", function () {
      localStorage.setItem("cookie_consent_accepted", "true");
      banner.style.display = "none";
    });
  }
});

// --- AXEPTIO CMP (RGPD — Chargement idempotent sans doublon) ---
if (!window.axeptioSettings) {
  window.axeptioSettings = {
    clientId: "6abf7d654bd86ad927014c33",
    cookiesVersion: "356689da-708f-406a-a78f-f026435aa81f",
    googleConsentMode: {
      default: {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500
      }
    }
  };
}

(function(d, s) {
  if (window.__axeptioSdkInjected || d.querySelector('script[src*="static.axept.io/sdk.js"]')) {
    return;
  }
  window.__axeptioSdkInjected = true;
  var t = d.getElementsByTagName(s)[0], e = d.createElement(s);
  e.async = true; e.src = "https://static.axept.io/sdk.js";
  if (t) t.parentNode.insertBefore(e, t);
  else d.head.appendChild(e);
})(document, "script");
