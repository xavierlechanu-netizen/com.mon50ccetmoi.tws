/**
 * cookie-consent.js — Bandeau cookies (16/11/2026).
 *
 * Avant : deux bandeaux en même temps. Le nôtre n'avait qu'un bouton « J'ai compris » et disait
 * « en continuant votre navigation, vous acceptez » (ce n'est pas un consentement pour la CNIL),
 * et celui d'Axeptio, en anglais, demandait l'accord pour un « partage de données avec Google »
 * qui n'existe plus depuis le retrait de Firebase Analytics.
 *
 * Maintenant : un seul bandeau, en français, avec « Tout refuser » et « Tout accepter » au même
 * niveau (refuser doit être aussi simple qu'accepter). Le site n'utilise que des traceurs
 * indispensables (connexion, préférences), dispensés de consentement : le choix ne concerne que
 * d'éventuels traceurs facultatifs futurs, qui devront appeler optionalTrackersAllowed().
 * Le choix est gardé 6 mois (recommandation CNIL), puis redemandé. On peut le changer à tout
 * moment depuis la page Cookies (bouton « Modifier mes choix » → action openCookieChoices).
 *
 * Construit sans innerHTML (createElement / textContent). Testé : tests/cookie-consent.test.js.
 */
import { registerAction } from './actionRegistry.js';

export const CONSENT_KEY = "cookie_consent_choice";
// Ancien bandeau « J'ai compris » : pas un vrai choix, on le redemande une fois.
const LEGACY_KEY = "cookie_consent_accepted";
export const CONSENT_VERSION = 1;
export const CHOICE_TTL_MS = 182 * 24 * 3600 * 1000; // environ 6 mois
const BANNER_ID = "cookie-consent-banner";

function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // navigation privée stricte : le bandeau reviendra à chaque page
  }
}

/** Choix encore valable ({ choice, date, version }) ou null s'il faut redemander. */
export function readChoice(storage, now = Date.now()) {
  try {
    const raw = storage && storage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record || record.version !== CONSENT_VERSION) return null;
    if (record.choice !== "accepted" && record.choice !== "refused") return null;
    const at = Date.parse(record.date);
    if (!Number.isFinite(at) || now - at > CHOICE_TTL_MS || at - now > 60 * 1000) return null;
    return record;
  } catch {
    return null;
  }
}

/** Enregistre le choix (preuve datée, sur l'appareil uniquement). */
export function saveChoice(storage, choice, now = Date.now()) {
  const record = {
    choice: choice === "accepted" ? "accepted" : "refused",
    date: new Date(now).toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    storage.setItem(CONSENT_KEY, JSON.stringify(record));
    storage.removeItem(LEGACY_KEY);
  } catch {
    /* stockage indisponible : le choix vaut pour cette page seulement */
  }
  return record;
}

/** Vrai seulement après « Tout accepter » encore valable. À appeler avant tout traceur facultatif. */
export function optionalTrackersAllowed(storage = defaultStorage(), now = Date.now()) {
  const record = readChoice(storage, now);
  return Boolean(record && record.choice === "accepted");
}

const BUTTON_STYLE =
  "flex:1 1 140px; background:#ffb703; color:#000; border:none; padding:10px 18px; border-radius:30px; " +
  "font-weight:bold; font-size:0.95rem; cursor:pointer; white-space:nowrap;";

function makeButton(doc, label, choice, onChoice) {
  const button = doc.createElement("button");
  button.type = "button";
  button.dataset.cookieChoice = choice;
  button.textContent = label;
  // Même style pour les deux boutons : refuser n'est ni plus petit, ni plus pâle qu'accepter.
  button.style.cssText = BUTTON_STYLE;
  button.addEventListener("click", () => onChoice(choice));
  return button;
}

/** Construit le bandeau (sans l'afficher). onChoice reçoit "refused" ou "accepted". */
export function createBanner(doc, onChoice) {
  const banner = doc.createElement("div");
  banner.id = BANNER_ID;
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookies et traceurs");
  banner.style.cssText =
    "position:fixed; bottom:0; left:0; width:100%; background:#1a1a1a; color:#fff; padding:15px 20px; " +
    "z-index:9999999; display:flex; justify-content:space-between; align-items:center; gap:12px; " +
    "border-top:2px solid #ffb703; flex-wrap:wrap; box-sizing:border-box; font-family:'Inter', sans-serif;";

  const text = doc.createElement("p");
  text.style.cssText = "flex:1 1 300px; margin:0; font-size:0.9rem; line-height:1.4;";
  text.append(
    "Ce site n'utilise que des traceurs indispensables à son fonctionnement (connexion, préférences). " +
      "Aucun traceur publicitaire ni de mesure d'audience. Aucun traceur facultatif ne sera déposé sans " +
      "votre accord, et vous pouvez changer d'avis à tout moment. ",
  );
  const link = doc.createElement("a");
  link.href = "cookies.html";
  link.textContent = "En savoir plus";
  link.style.cssText = "color:#ffb703; text-decoration:underline; font-weight:bold;";
  text.append(link);

  const buttons = doc.createElement("div");
  buttons.style.cssText = "display:flex; gap:10px; flex:1 1 300px; max-width:420px;";
  buttons.append(
    makeButton(doc, "Tout refuser", "refused", onChoice),
    makeButton(doc, "Tout accepter", "accepted", onChoice),
  );

  banner.append(text, buttons);
  return banner;
}

/**
 * Affiche le bandeau si aucun choix valable n'existe (ou toujours avec force: true).
 * Renvoie le bandeau affiché, ou null s'il n'y a rien à demander.
 */
export function showCookieBanner({ doc = document, storage = defaultStorage(), force = false, now } = {}) {
  if (!force && readChoice(storage, now === undefined ? Date.now() : now)) return null;
  const existing = doc.getElementById(BANNER_ID);
  if (existing) return existing;
  const banner = createBanner(doc, (choice) => {
    saveChoice(storage, choice);
    banner.remove();
  });
  doc.body.appendChild(banner);
  return banner;
}

// Page Cookies : bouton « Modifier mes choix »
registerAction("openCookieChoices", () => showCookieBanner({ force: true }));
