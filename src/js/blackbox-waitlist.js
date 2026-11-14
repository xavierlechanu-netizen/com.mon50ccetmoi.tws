/**
 * Liste d'attente de la Boîte Noire.
 *
 * Le boîtier n'est pas encore fabriqué (sortie dans 6 mois au plus tôt) : on ne le vend pas,
 * on propose seulement d'être prévenu par email à sa sortie. Aucun paiement.
 * Enregistrement dans Firestore « blackbox_waitlist » : création seule, lecture réservée
 * aux administrateurs (firestore.rules). Mêmes contrôles côté client et dans les règles.
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

if (typeof document !== "undefined" && document.getElementById("bb-waitlist-form")) {
  const firestore = () => window.db;
  initBlackboxWaitlist(
    document,
    (entry) => firestore().collection(WAITLIST_COLLECTION).add(entry),
    () => window.firebase.firestore.FieldValue.serverTimestamp()
  );
}
