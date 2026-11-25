/**
 * gold-gate.js — Freemium (25/11/2026) : le GPS et la sécurité sont gratuits, le reste demande le
 * compte GOLD (29 € pour 1 an, sans renouvellement automatique ; Fondateurs gratuits à vie).
 * Le serveur décide qui est GOLD (session.isGold, sovereign-session.js) ; ici on ne fait qu'afficher.
 *
 * Vente sur le site web seulement : dans l'appli du Play Store, Google interdit de vendre un
 * abonnement numérique hors de sa facturation, et même d'y renvoyer. L'appli Android s'ouvre sur
 * « / » avec la provenance android-app:// ; on s'en souvient pour tout l'onglet.
 */
import { registerAction } from "./actionRegistry.js";
import { authFetch } from "./api-client.js";

const PLAY_KEY = "mon50cc_playstore";
export const GOLD_PRODUCT = "GOLD_ANNUAL";

/** Appli Play Store (Trusted Web Activity) : vrai dès que la première page venait d'android-app://. */
export function isPlayStoreApp(referrer = typeof document !== "undefined" ? document.referrer : "") {
  let known = false;
  try {
    known = sessionStorage.getItem(PLAY_KEY) === "1";
    if (!known && String(referrer).startsWith("android-app://")) {
      sessionStorage.setItem(PLAY_KEY, "1");
      known = true;
    }
  } catch {
    known = known || String(referrer).startsWith("android-app://");
  }
  return known;
}
isPlayStoreApp(); // à charger sur la page d'accueil : c'est elle que l'appli Android ouvre

export const isGold = () => window.session?.isGold === true;

/** Lance l'achat de GOLD (page de paiement Revolut, retour dans l'appli). */
export async function buyGold() {
  if (isPlayStoreApp()) return;
  try {
    const order = await authFetch("createRevolutOrder", { method: "POST", body: { report_type: GOLD_PRODUCT } });
    if (order.checkout_url) window.location.href = order.checkout_url;
    else alert("Une commande GOLD est déjà en cours : réessayez dans 30 minutes ou écrivez à contact@mon50ccetmoi.com.");
  } catch (e) {
    alert(e?.status === 401 ? "Connectez-vous d'abord à votre compte." : (e?.message || "Paiement impossible pour le moment."));
  }
}

/** Option réservée à GOLD : explique, et propose l'achat seulement sur le site web. */
export function openGoldOffer(feature = "Cette option") {
  const base = `« ${feature} » fait partie du compte GOLD.\n\nGratuit pour tous : GPS sans autoroute, SOS, détection de chute, dangers signalés.`;
  if (isPlayStoreApp()) {
    alert(base);
    return;
  }
  if (confirm(`${base}\n\nGOLD : 29 € pour 1 an, sans renouvellement automatique. Passer GOLD ?`)) buyGold();
}

/** Enveloppe une action : elle ne s'ouvre que pour un compte GOLD (vérifié au moment du clic). */
export function goldOnly(feature, action) {
  return (...args) => (isGold() ? action(...args) : openGoldOffer(feature));
}

registerAction("openGoldOffer", openGoldOffer);
registerAction("buyGold", buyGold);
