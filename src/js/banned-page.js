/**
 * banned-page.js — Bouton « Retour au menu » de la page de compte suspendu :
 * efface les données locales puis renvoie vers la connexion.
 * (Auparavant écrit en ligne dans banned.html, incompatible avec une CSP stricte.)
 */
window.leaveBannedSession = function () {
  try {
    localStorage.clear();
  } catch (_) {
    // Stockage indisponible (navigation privée) : rien à effacer
  }
  window.location.href = "login.html";
};
