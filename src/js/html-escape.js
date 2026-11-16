/**
 * html-escape.js — Affichage sûr des textes écrits par les membres (audit du 16/11/2026).
 *
 * DOMPurify (dom-security.js) retire déjà les <script> et les on…=, mais il garde les attributs
 * data-action et style : ce sont eux qui font marcher les boutons de l'appli. Un message de crew,
 * une annonce ou un arrêt pouvait donc contenir un faux bouton invisible, posé sur tout l'écran,
 * qui déclenchait une fonction de l'appli (réserver une annonce, etc.) au premier toucher.
 * Tout texte venant d'un autre membre passe donc par escapeHtml avant d'être mis dans du HTML,
 * et tout identifiant mis dans un data-action passe par safeId.
 *
 * Aucun import : testé directement (tests/html-escape.test.js).
 */

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

/** Texte affiché tel quel (balises montrées, jamais interprétées). null/undefined → "". */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"'`]/g, (c) => HTML_ESCAPES[c]);
}

// Identifiant de document ou pseudo placé entre '…' dans un data-action. Le navigateur
// décode &#39; avant que l'action ne soit lue : l'échappement HTML ne suffit donc pas ici.
const SAFE_ID_RE = /^[A-Za-z0-9_.-]{1,128}$/;

/** Identifiant sûr dans un data-action ; "" s'il contient autre chose. */
export function safeId(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return SAFE_ID_RE.test(s) ? s : "";
}

// Pseudo (anciens comptes : espaces, accents) placé entre '…' dans un data-action. Le lecteur
// d'actions (dom-security.js) coupe sur « ; » et une apostrophe ferme l'argument : refusés.
// eslint-disable-next-line no-control-regex
const UNSAFE_ACTION_TEXT_RE = /['"`;\\<>&\u0000-\u001f\u007f]/;

/** Texte sûr dans un argument '…' de data-action ; "" s'il pourrait en sortir. */
export function safeActionText(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return s.length <= 128 && !UNSAFE_ACTION_TEXT_RE.test(s) ? s : "";
}

/** Nombre fini, sinon la valeur de repli (jamais du texte dans un data-action ou un calcul). */
export function safeNumber(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/** Adresse d'image : https:// ou image intégrée (data:image/…;base64). Sinon "". */
export function safeImageUrl(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (DATA_IMAGE_RE.test(s)) return s;
  try {
    const url = new URL(s);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
