/**
 * CONFIGURATION GLOBALE - mon50ccetmoi
 * Centralisation des clés et configurations sensibles.
 */
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
// Indispensable : sans ce module, firebase.functions n'existe pas et TOUS les appels serveur
// (points, achat de rapports, envoi de la boîte noire, profil assureur) étaient ignorés en silence.
import 'firebase/compat/functions';
import localforage from 'localforage';
import { installServiceGuard } from './service-guard.js';
import { showCookieBanner } from './cookie-consent.js';

export const CONFIG = {
  // Carte : Leaflet + IGN Géoplateforme (voir gmaps-compat.js), aucune clé Google nécessaire.
  MAPS: {},
  // Cloud Functions Firebase à l'arrêt (facturation Google coupée le 14/11/2026), en attendant le
  // serveur souverain OVHcloud. À repasser à true quand les services serveur répondent à nouveau.
  SERVICES_SERVEUR_ACTIFS: false,

  // Serveur souverain OVHcloud (sovereign-core/), branché par sovereign.js.
  // Actif : à la connexion, l'appli s'y connecte aussi pour l'alerte SOS automatique (SMS aux anges
  // gardiens). Tant que api.mon50ccetmoi.com n'existe pas, rien ne part et l'alerte propose le 112.
  SOVEREIGN: {
    ACTIF: true,
    // Développement : VITE_SOVEREIGN_API_URL=/api/v1 (serveur souverain local, voir vite.config.js)
    API_URL: import.meta.env?.VITE_SOVEREIGN_API_URL || "https://api.mon50ccetmoi.com/api/v1",
  },

  // Interrupteur du déménagement (phase A, 18/11/2026 ; mode d'emploi : backend-mode.js).
  // Domaine par domaine : "FIREBASE" = comme avant, "SOVEREIGN" = serveur souverain OVHcloud.
  // Retour arrière : remettre "FIREBASE" et republier le site. Ne passer les comptes sur "SOVEREIGN"
  // qu'APRÈS l'import des comptes Firebase sur le serveur (docs/PLAN_DEMENAGEMENT_GOOGLE.md, § 6).
  BACKEND_MODE: {
    comptes: "SOVEREIGN",
    // Paiements Revolut par le serveur souverain (§ 7 du plan). "SOVEREIGN" seulement une fois la clé
    // Revolut sur le VPS, le webhook redirigé et un achat d'essai réussi. Les acheteurs doivent avoir
    // une session sur le serveur souverain (comptes importés, reconnexion depuis).
    paiements: "FIREBASE",
    // Points, historique et classement par le serveur souverain (§ 8 du plan). "SOVEREIGN" en même
    // temps que les comptes, APRÈS la reprise des soldes (scripts/import-firebase-points.js) : sans
    // session sur le serveur, on ne gagne pas de points.
    points: "SOVEREIGN",
  },
  // Comptes sur "SOVEREIGN" : tant que les données sont dans Firestore, la connexion souveraine ouvre
  // aussi une session Firebase (même email, même mot de passe) pour les lire. À couper (false) quand
  // plus rien ne lit Firestore.
  PONT_FIREBASE: import.meta.env?.VITE_PONT_FIREBASE !== "0",

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
    appId: "1:618915667828:web:8508e0362e4edd0a0dd621"
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
      IMPACT_G: 3.5, // Au-dessus → Rapport Impact
      EXPERT_G: 5.0, // Au-dessus → Rapport Expertise Complète
      HIGH_SPEED_KMH: 60, // Vitesse considérée élevée pour le contexte 50cc
      LEAN_ANGLE_DEG: 35, // Angle d'inclinaison critique
    },
  },
};

// Initialize Firebase once
if (!firebase.apps.length) {
    firebase.initializeApp(CONFIG.FIREBASE);
    // App Check (reCAPTCHA de Google) retiré le 19/11/2026 : il n'a jamais été activé (aucune clé).
}
// Fonctions serveur Firebase à l'arrêt : échec immédiat avec un message clair (service-guard.js)
installServiceGuard({
  win: typeof window !== 'undefined' ? window : null,
  firebaseNs: firebase,
  actif: CONFIG.SERVICES_SERVEUR_ACTIFS,
});

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

// --- BANDEAU COOKIES (cookie-consent.js), gratuit ---
// « Tout refuser » et « Tout accepter » au même niveau (CNIL). Axeptio retiré le 17/11/2026 : devenu payant,
// et inutile pour un site qui n'utilise que des traceurs indispensables.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => showCookieBanner());
} else {
  showCookieBanner();
}
