/**
 * axeptio-config.js — Bannière de consentement aux cookies (Axeptio), commune à toutes les pages.
 *
 * Avant (7/11/2026) : ces réglages étaient copiés dans un <script> écrit dans chaque page,
 * ce qui obligeait la politique de sécurité (CSP) à autoriser tout script en ligne
 * ('unsafe-inline'). Ils sont maintenant dans ce fichier, chargé par chaque page.
 */
window.axeptioSettings = {
  clientId: "6abf7d654bd86ad927014c33",
  cookiesVersion: "73984ab7-6f43-4eef-9577-94f735eedc51",
  googleConsentMode: {
    default: {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500,
    },
  },
};

if (!document.querySelector('script[src="https://static.axept.io/sdk.js"]')) {
  const sdk = document.createElement("script");
  sdk.async = true;
  sdk.src = "https://static.axept.io/sdk.js";
  document.head.appendChild(sdk);
}
