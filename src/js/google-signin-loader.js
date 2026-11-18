/**
 * google-signin-loader.js — Connexion Google chargée seulement au clic (RGPD / CNIL, 18/11/2026).
 *
 * Avant : la page de connexion chargeait le script de Google (accounts.google.com/gsi/client) dès
 * son ouverture. Google recevait alors l'adresse IP du visiteur, et pouvait lire ses cookies, avant
 * tout clic et sans qu'il ait choisi Google.
 * Maintenant : la page affiche un bouton du site, « Continuer avec Google ». Au clic seulement, le
 * script de Google est chargé et son vrai bouton prend la place du nôtre (2 clics au lieu d'un).
 * Garde-fou : tests/rgpd-age-google.test.js.
 */
import { registerAction } from "./actionRegistry.js";

export const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let gsiLoading = null;

/** Charge le script de Google une seule fois ; promesse résolue avec google.accounts.id. */
export function loadGsiScript(doc = document, win = window) {
  if (win.google?.accounts?.id) return Promise.resolve(win.google.accounts.id);
  if (gsiLoading) return gsiLoading;
  gsiLoading = new Promise((resolve, reject) => {
    const s = doc.createElement("script");
    s.src = GSI_SCRIPT_URL;
    s.async = true;
    s.onload = () => (win.google?.accounts?.id
      ? resolve(win.google.accounts.id)
      : reject(new Error("Google Identity Services indisponible")));
    s.onerror = () => reject(new Error("Chargement de Google impossible"));
    doc.head.appendChild(s);
  }).catch((err) => {
    gsiLoading = null; // un nouveau clic pourra réessayer
    throw err;
  });
  return gsiLoading;
}

function setStatus(doc, text) {
  const status = doc.getElementById("google-signin-status");
  if (status) status.textContent = text;
}

/** Clic sur « Continuer avec Google » : charge Google, puis affiche son bouton. */
export async function startGoogleSignIn(doc = document, win = window) {
  const trigger = doc.getElementById("google-signin-trigger");
  const slot = doc.getElementById("google-signin-slot");
  if (!trigger || !slot || trigger.disabled) return false; // chargement déjà en cours
  trigger.disabled = true;
  setStatus(doc, "Chargement de Google…");
  try {
    const gsi = await loadGsiScript(doc, win);
    gsi.initialize({
      client_id: trigger.dataset.clientId,
      callback: (response) => win.handleCredentialResponse?.(response),
      ux_mode: "popup",
      context: "signin",
      auto_select: false,
    });
    gsi.renderButton(slot, {
      type: "standard",
      shape: "rectangular",
      theme: "outline",
      text: "signin_with",
      size: "large",
      logo_alignment: "left",
    });
    trigger.style.display = "none";
    setStatus(doc, "Cliquez maintenant sur le bouton Google pour choisir votre compte.");
    return true;
  } catch (err) {
    console.warn("[Google] Connexion indisponible :", err.message);
    trigger.disabled = false;
    setStatus(doc, "Google ne répond pas. Réessayez, ou connectez-vous avec votre pseudo et votre mot de passe.");
    return false;
  }
}

registerAction("startGoogleSignIn", () => startGoogleSignIn());
