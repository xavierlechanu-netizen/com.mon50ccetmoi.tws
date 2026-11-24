/**
 * Liste d'attente de la Boîte Noire.
 *
 * Le boîtier n'est pas encore fabriqué (sortie dans 6 mois au plus tôt) : on ne le vend pas,
 * on propose seulement d'être prévenu par email à sa sortie. Aucun paiement.
 * Enregistrement sur le serveur souverain (POST /api/v1/waitlist, table blackbox_waitlist) depuis
 * le 24/11/2026 ; avant, dans Firestore. Mêmes contrôles côté client et sur le serveur.
 */

// Même motif que dans firestore.rules (adresse déjà mise en minuscules).
export const WAITLIST_EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
export const WAITLIST_COLLECTION = "blackbox_waitlist";

/** Adresse nettoyée (minuscules, sans espaces), ou null si elle n'est pas valable. */
export function normalizeWaitlistEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (email.length > 254 || !WAITLIST_EMAIL_RE.test(email)) return null;
  return email;
}

/** Document envoyé à Firestore : exactement les champs autorisés par les règles. */
export function buildWaitlistEntry(email, serverTimestamp) {
  return { email, consent: true, source: "marketplace", createdAt: serverTimestamp };
}

/**
 * Branche le formulaire #bb-waitlist-form.
 * `save(entry)` enregistre l'inscription (Firestore en production, simulé dans les tests).
 */
export function initBlackboxWaitlist(doc, save, serverTimestamp) {
  const form = doc.getElementById("bb-waitlist-form");
  if (!form) return false;
  const input = doc.getElementById("bb-waitlist-email");
  const consent = doc.getElementById("bb-waitlist-consent");
  const button = doc.getElementById("bb-waitlist-submit");
  const status = doc.getElementById("bb-waitlist-status");

  const say = (text, ok) => {
    status.textContent = text;
    status.dataset.state = ok ? "ok" : "error";
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = normalizeWaitlistEmail(input.value);
    if (!email) {
      say("Cette adresse email ne semble pas valable.", false);
      return;
    }
    if (!consent.checked) {
      say("Cochez la case pour accepter d'être prévenu par email.", false);
      return;
    }
    button.disabled = true;
    try {
      await save(buildWaitlistEntry(email, serverTimestamp()));
      form.reset();
      say("C'est noté ! Nous vous écrirons à la sortie de la Boîte Noire, et seulement pour ça.", true);
    } catch (err) {
      console.warn("[Liste d'attente] Enregistrement impossible :", err);
      say("L'inscription n'a pas pu être enregistrée. Réessayez dans un moment.", false);
    } finally {
      button.disabled = false;
    }
  });
  return true;
}

/** Envoi au serveur souverain ; rejette si le serveur refuse ou ne répond pas. */
export async function saveToServer(entry, fetchFn = fetch, apiUrl = (window.CONFIG && window.CONFIG.SOVEREIGN && window.CONFIG.SOVEREIGN.API_URL) || "https://api.mon50ccetmoi.com/api/v1") {
  const res = await fetchFn(`${apiUrl}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: entry.email, consent: entry.consent === true }),
  });
  if (!res.ok) throw new Error(`Serveur : ${res.status}`);
}

if (typeof document !== "undefined" && document.getElementById("bb-waitlist-form")) {
  initBlackboxWaitlist(document, (entry) => saveToServer(entry), () => new Date().toISOString());
}
