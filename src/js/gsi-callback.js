/**
 * gsi-callback.js — Relais de la connexion Google (Google Identity Services).
 *
 * Google appelle window.handleCredentialResponse après le clic sur « Se connecter avec
 * Google ». Le vrai traitement (inline-login-3.js) peut ne pas être encore chargé : la
 * réponse est alors gardée en attente et traitée dès qu'il l'est.
 * Auparavant écrit en ligne dans login.html (incompatible avec une CSP stricte).
 */
if (typeof window.handleCredentialResponse !== "function") {
  window.handleCredentialResponse = function (response) {
    if (typeof window._handleCredentialResponseReal === "function") {
      window._handleCredentialResponseReal(response);
    } else {
      window._pendingGoogleResponse = response;
    }
  };
}
