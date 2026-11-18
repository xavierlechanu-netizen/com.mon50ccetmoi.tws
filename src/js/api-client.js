/**
 * API Client — mon50ccetmoi
 * ─────────────────────────────────────────────────────────────────────────────
 * Passerelle sécurisée d'appels vers les Cloud Functions (europe-west1).
 * Garantit l'authentification Firebase Auth (ASVS v5.0.0-3.5.1 / V4).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { auth, CONFIG } from './config.js';
import { backendMode } from './backend.js';
import { sovereignSession } from './sovereign.js';

export class AuthRequiredError extends Error {
  constructor(message = "Authentification requise pour cette opération.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

// ─── Paiements sur le serveur souverain (interrupteur CONFIG.BACKEND_MODE.paiements) ───
// Mêmes noms et mêmes réponses que les anciennes Cloud Functions : les écrans d'achat ne changent pas.
// Réponse de la commande : { order_id, order_token, amount, currency, status, case_id, mode }.
const SOVEREIGN_PAYMENT_ROUTES = {
  createRevolutOrder: (o) => ({ method: "POST", endpoint: "/payments/orders", body: o.body || {} }),
  checkPaymentStatus: (o) => ({
    method: "GET",
    endpoint: `/payments/orders?case_id=${encodeURIComponent(String((o.query && o.query.case_id) || ""))}`,
  }),
};

/** Appel souverain correspondant à une Cloud Function de paiement, ou null s'il n'y en a pas. */
export function sovereignPaymentRequest(functionName, options = {}) {
  const route = Object.prototype.hasOwnProperty.call(SOVEREIGN_PAYMENT_ROUTES, functionName)
    ? SOVEREIGN_PAYMENT_ROUTES[functionName] : null;
  return route ? route(options) : null;
}

/** Vrai si les paiements passent par le serveur souverain (réglage du site ou essai sur ce téléphone). */
function sovereignPayments() {
  return typeof backendMode === "function" && backendMode("paiements") === "SOVEREIGN";
}

async function sovereignFetch(request, functionName, timeoutMs) {
  const session = typeof sovereignSession !== "undefined" ? sovereignSession : null;
  if (!session || !session.hasAccount()) {
    // Pas de session sur le serveur souverain (compte pas encore importé, ou connexion trop ancienne)
    throw new AuthRequiredError("Reconnectez-vous pour payer : votre session a expiré.");
  }
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`Délai d'attente dépassé pour ${functionName} (${timeoutMs}ms)`);
      e.status = 408;
      reject(e);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      session.client.request(request.endpoint, { method: request.method, body: request.body || null }),
      timeout,
    ]);
  } catch (e) {
    if (e && e.status === 401) throw new AuthRequiredError("Reconnectez-vous pour payer : votre session a expiré.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Construit l'URL complète de la Cloud Function selon l'environnement
 */
export function getFunctionUrl(functionName) {
  const projectId = CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
  return `https://europe-west1-${projectId}.cloudfunctions.net/${functionName}`;
}

/**
 * Exécute un appel HTTP authentifié vers une Cloud Function Firebase
 * @param {string} functionName Nom de la fonction (ex: 'createRevolutOrder')
 * @param {Object} options Options de fetch ({ method, body, query, timeoutMs })
 * @returns {Promise<any>}
 */
export async function authFetch(functionName, options = {}) {
  const {
    method = "POST",
    body = null,
    query = null,
    timeoutMs = 15000,
    headers = {}
  } = options;

  // 0. Paiements : serveur souverain si l'interrupteur le dit (sinon Cloud Functions, comme avant)
  const sovereignRequest = sovereignPayments() ? sovereignPaymentRequest(functionName, options) : null;
  if (sovereignRequest) return sovereignFetch(sovereignRequest, functionName, timeoutMs);

  // 1. Vérification de la session Auth Firebase
  let currentAuth = auth;
  if (!currentAuth && typeof window !== "undefined" && window.auth) {
    currentAuth = window.auth;
  }

  const currentUser = currentAuth?.currentUser;
  if (!currentUser) {
    console.warn(`[API] Appel bloqué (${functionName}) : utilisateur non authentifié`);
    throw new AuthRequiredError();
  }

  // 2. Récupération dynamique du Bearer Token (auto-refresh géré par SDK)
  const idToken = await currentUser.getIdToken();
  const requestHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
    ...headers
  };

  // 3. Construction de l'URL avec query params éventuels
  let url = getFunctionUrl(functionName);
  if (query && typeof query === "object") {
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }

  // 4. Exécution avec timeout AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions = {
      method,
      headers: requestHeaders,
      signal: controller.signal
    };

    if (body && method !== "GET" && method !== "HEAD") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    if (!response.ok) {
      let errData = {};
      try {
        errData = await response.json();
      } catch (e) {
        errData = { error: `HTTP ${response.status}` };
      }
      const error = new Error(errData.error || errData.message || `Erreur serveur (${response.status})`);
      error.status = response.status;
      error.details = errData;
      throw error;
    }

    // Réponse JSON attendue
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();

  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const timeoutError = new Error(`Délai d'attente dépassé pour ${functionName} (${timeoutMs}ms)`);
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw err;
  }
}

// Exposition globale pour compatibilité avec l'existant
if (typeof window !== "undefined") {
  window.ApiClient = {
    authFetch,
    getFunctionUrl,
    AuthRequiredError
  };
}
