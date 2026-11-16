/**
 * axeptio-config.js — Bandeau de consentement aux cookies (Axeptio), le SEUL du site.
 *
 * Chargé par config.js (donc par presque toutes les pages) et directement par quelques pages
 * sans config.js. Le module ne s'exécute qu'une fois par page, et le SDK n'est injecté qu'une fois.
 *
 * Avant (16/11/2026) :
 *  - config.js avait sa propre copie de ces réglages avec une AUTRE version (française), et
 *    ajoutait son propre bandeau « J'ai compris » (sans bouton pour refuser) : deux bandeaux à la fois ;
 *  - ce fichier utilisait la version anglaise (73984ab7-…) : selon la page et l'ordre de chargement,
 *    le visiteur voyait l'une ou l'autre.
 * Maintenant : une seule version, la française (« Non merci » / « Je choisis » / « OK pour moi »).
 * Plus de googleConsentMode : le site n'a plus aucune balise Google (Firebase Analytics retiré).
 * Le retrait de l'étape « Partage de données avec Google » se fait dans la console Axeptio.
 *
 * Avant (7/11/2026) : ces réglages étaient copiés dans un <script> écrit dans chaque page,
 * ce qui obligeait la CSP à autoriser tout script en ligne ('unsafe-inline').
 */
export const AXEPTIO_CLIENT_ID = "6abf7d654bd86ad927014c33";
export const AXEPTIO_COOKIES_VERSION_FR = "356689da-708f-406a-a78f-f026435aa81f";
const SDK_URL = "https://static.axept.io/sdk.js";

window.axeptioSettings = {
  clientId: AXEPTIO_CLIENT_ID,
  cookiesVersion: AXEPTIO_COOKIES_VERSION_FR,
};

if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
  const sdk = document.createElement("script");
  sdk.async = true;
  sdk.src = SDK_URL;
  document.head.appendChild(sdk);
}
