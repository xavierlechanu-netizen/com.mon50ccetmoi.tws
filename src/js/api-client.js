/**
 * API Client — mon50ccetmoi
 * ─────────────────────────────────────────────────────────────────────────────
 * Passerelle sécurisée d'appels vers les Cloud Functions (europe-west1).
 * Garantit l'authentification Firebase Auth (ASVS v5.0.0-3.5.1 / V4).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { auth, CONFIG } from './config.js';

export class AuthRequiredError extends Error {
  constructor(message = "Authentification requise pour cette opération.") {
    super(message);
    this.name = "AuthRequiredError";
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
