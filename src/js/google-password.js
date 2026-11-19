/**
 * Comptes « Google seul » : choisir un mot de passe (18/11/2026).
 *
 * Le serveur souverain (OVHcloud) ne connaîtra pas la connexion Google. Les pilotes qui ne se
 * connectent qu'avec Google n'ont pas de mot de passe : sans lui, ils ne pourront plus se connecter
 * après la bascule des comptes (docs/PLAN_DEMENAGEMENT_GOOGLE.md, § 6).
 *
 * Après une connexion Google (comptes encore sur Firebase), l'appli leur propose d'en choisir un.
 * Firebase l'ajoute au même compte (linkWithCredential) : même identifiant, mêmes données. Au
 * prochain import des comptes, le serveur souverain reçoit son empreinte (jamais le mot de passe)
 * et le pilote se connecte avec son adresse Gmail et ce mot de passe.
 * « Plus tard » : on redemande 7 jours après. Rien n'est gardé sur le téléphone, sauf cette date.
 *
 * Aucun import : testé directement (tests/google-password.test.js). Branchement : inline-login-3.js.
 */

export const GOOGLE_PASSWORD_MIN = 8; // même règle que le serveur souverain
export const GOOGLE_PASSWORD_MAX = 256;
export const GOOGLE_PASSWORD_LATER_KEY = "google_password_later";
const LATER_MS = 7 * 24 * 3600 * 1000;

/** Vrai si le compte n'a pas encore de mot de passe (connexion Google seulement). */
export function needsPassword(user) {
  if (!user || !user.email) return false;
  const providers = Array.isArray(user.providerData) ? user.providerData : [];
  return !providers.some((p) => p && p.providerId === "password");
}

/** Faut-il le proposer maintenant ? (« Plus tard » choisi il y a moins de 7 jours : non) */
export function shouldAsk(storage, now = Date.now()) {
  try {
    const later = Number(storage.getItem(GOOGLE_PASSWORD_LATER_KEY));
    return !(Number.isFinite(later) && later > 0 && now - later < LATER_MS);
  } catch {
    return true;
  }
}

/** Message d'erreur, ou null si le mot de passe convient. */
export function checkPassword(pw, confirmation) {
  const s = String(pw || "");
  if (s.length < GOOGLE_PASSWORD_MIN) return `Au moins ${GOOGLE_PASSWORD_MIN} caractères.`;
  if (s.length > GOOGLE_PASSWORD_MAX) return `${GOOGLE_PASSWORD_MAX} caractères au plus.`;
  if (s !== String(confirmation || "")) return "Les deux mots de passe ne sont pas identiques.";
  return null;
}

/**
 * Fenêtre « Choisissez un mot de passe ». Résout le mot de passe, ou null pour « Plus tard ».
 * Construite avec les fonctions du DOM (aucun HTML injecté).
 */
export function showPasswordDialog(doc, email) {
  return new Promise((resolve) => {
    const el = (tag, style, text) => {
      const e = doc.createElement(tag);
      if (style) e.style.cssText = style;
      if (text) e.textContent = text;
      return e;
    };
    const overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100000;" +
      "display:flex;align-items:center;justify-content:center;padding:16px;");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "gpw-title");
    const box = el("div", "background:#16181d;color:#e3e3e3;border-radius:14px;max-width:420px;width:100%;" +
      "padding:22px;font-family:inherit;box-shadow:0 10px 40px rgba(0,0,0,.5);");
    const title = el("h2", "margin:0 0 10px;font-size:1.15rem;color:#fff;", "Choisissez un mot de passe");
    title.id = "gpw-title";
    const intro = el("p", "margin:0 0 14px;font-size:.92rem;line-height:1.4;",
      "Bientôt, mon50ccetmoi ne proposera plus la connexion avec Google. Pour garder votre compte, " +
      "vos points et vos données, choisissez un mot de passe : vous vous connecterez ensuite avec " +
      `votre adresse ${email} et ce mot de passe.`);
    const field = (label) => {
      const wrap = el("label", "display:block;margin:0 0 10px;font-size:.85rem;", label);
      const input = el("input", "display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px;" +
        "border-radius:8px;border:1px solid #444;background:#0d0f13;color:#fff;font-size:1rem;");
      input.type = "password";
      input.autocomplete = "new-password";
      input.maxLength = GOOGLE_PASSWORD_MAX;
      wrap.appendChild(input);
      return { wrap, input };
    };
    const pw1 = field(`Mot de passe (${GOOGLE_PASSWORD_MIN} caractères au moins)`);
    const pw2 = field("Le même, une seconde fois");
    const error = el("p", "min-height:1.2em;margin:4px 0 10px;color:#ff6b6b;font-size:.85rem;");
    error.setAttribute("role", "alert");
    const row = el("div", "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;");
    const later = el("button", "padding:10px 14px;border-radius:8px;border:1px solid #555;background:transparent;" +
      "color:#e3e3e3;cursor:pointer;", "Plus tard");
    const save = el("button", "padding:10px 14px;border-radius:8px;border:0;background:#00c2ff;color:#000;" +
      "font-weight:bold;cursor:pointer;", "Enregistrer");
    later.type = "button";
    save.type = "button";
    row.append(later, save);
    box.append(title, intro, pw1.wrap, pw2.wrap, error, row);
    overlay.appendChild(box);

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    later.addEventListener("click", () => close(null));
    save.addEventListener("click", () => {
      const problem = checkPassword(pw1.input.value, pw2.input.value);
      if (problem) {
        error.textContent = problem;
        return;
      }
      close(pw1.input.value);
    });
    pw2.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save.click();
    });
    doc.body.appendChild(overlay);
    pw1.input.focus();
  });
}

/**
 * Proposé juste après une connexion Google réussie (comptes sur Firebase).
 * @returns {Promise<"skip"|"later"|"linked"|"error">}
 */
export async function offerGooglePassword({ user, firebaseNs, doc, storage, notify, now = Date.now() }) {
  if (!needsPassword(user) || !shouldAsk(storage, now)) return "skip";
  const pw = await showPasswordDialog(doc, user.email);
  if (!pw) {
    try {
      storage.setItem(GOOGLE_PASSWORD_LATER_KEY, String(now));
    } catch {
      /* on redemandera à la prochaine connexion */
    }
    return "later";
  }
  try {
    const credential = firebaseNs.auth.EmailAuthProvider.credential(user.email, pw);
    await user.linkWithCredential(credential);
    try {
      storage.removeItem(GOOGLE_PASSWORD_LATER_KEY);
    } catch {
      /* rien à effacer */
    }
    notify(`Mot de passe enregistré. Vous pourrez vous connecter avec ${user.email} et ce mot de passe.`);
    return "linked";
  } catch (e) {
    const code = e && e.code;
    notify(code === "auth/weak-password"
      ? "Mot de passe trop faible : choisissez-en un plus long. Il vous sera redemandé à la prochaine connexion."
      : code === "auth/requires-recent-login"
        ? "Pour des raisons de sécurité, reconnectez-vous avec Google : le mot de passe vous sera redemandé."
        : "Le mot de passe n'a pas pu être enregistré. Il vous sera redemandé à la prochaine connexion.");
    return "error";
  }
}
