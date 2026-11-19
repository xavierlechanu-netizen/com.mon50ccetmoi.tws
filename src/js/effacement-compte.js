/**
 * Effacement du compte à la demande du pilote (RGPD art. 17), par le serveur du VPS — 19/11/2026.
 *
 * Avant : une Cloud Function (deleteUserAccount) effaçait le compte Firebase et les données Firestore.
 * Elle est coupée depuis le 14/11/2026 ; la demande partait donc par e-mail.
 *
 * Maintenant, si ce téléphone a une session sur le serveur du VPS (comptes sur "SOVEREIGN", ou
 * connexion par mot de passe en "FIREBASE", faite en parallèle pour l'alerte SOS) :
 *   1. DELETE /api/v1/rgpd/account : le serveur anonymise tout de suite ce qu'il garde (email, pseudo,
 *      mot de passe, points, textes des signalements) et note ce qui reste chez Firebase ;
 *   2. ce reste (compte de connexion Firebase, profil, signalements…) est effacé à la main, sous 30 jours (promis par la politique de confidentialité),
 *      depuis la liste du serveur (sovereign-core/deploy/rgpd-firebase.sh). Le pilote n'a rien à faire.
 * Sans session sur le serveur : il faut se reconnecter avec son mot de passe, ou écrire (e-mail).
 *
 * Aucun import : testé directement (tests/effacement-compte.test.js). Branchement : rgpd-cnil.js.
 */

export const EFFACEMENT_CONTACT = "contact@mon50ccetmoi.com";

export const EFFACEMENT_TEXTES = {
  confirmation:
    "ATTENTION : action IRRÉVERSIBLE.\n\n" +
    "Votre compte sera supprimé : email, pseudo, mot de passe, points, et les données gardées pour vous " +
    "(profil, signalements…).\n\nConfirmer ?",
  efface:
    "Votre compte est supprimé.\n\n" +
    "Notre serveur a effacé tout de suite votre email, votre pseudo, votre mot de passe et vos points. " +
    "Ce qui était encore sur l'ancienne plateforme (Firebase : profil, signalements…) sera effacé par nos " +
    "soins sous 30 jours au plus. Vous n'avez rien d'autre à faire.\n\n" +
    "Seules les preuves d'accident déjà scellées par la Boîte Noire restent gardées 5 ans, sans plus rien " +
    "qui mène à vous.",
  sansSession:
    "Pour supprimer votre compte tout de suite, reconnectez-vous avec votre email et votre mot de passe, " +
    "puis revenez ici (Sécurité & RGPD).\n\n" +
    `Sinon, appuyez sur OK pour envoyer votre demande par e-mail à ${EFFACEMENT_CONTACT}. ` +
    "Elle sera traitée sous 30 jours au plus.",
  erreur: (detail) =>
    `La suppression ne répond pas pour le moment (${detail || "erreur réseau"}). Rien n'a été effacé.\n\n` +
    "Réessayez dans un instant, ou appuyez sur OK pour envoyer votre demande par e-mail à " +
    `${EFFACEMENT_CONTACT}. Elle sera traitée sous 30 jours au plus.`,
};

/**
 * @param {{
 *   sovereign: object|null,   // createSovereignSession(...) (sovereign-session.js), ou null
 *   firebaseAuth?: object|null, // firebase.auth() (version compat), pour se déconnecter de Firebase
 *   log?: {warn: Function},
 * }} deps
 */
export function createEffacementCompte({ sovereign, firebaseAuth = null, log = console }) {
  const possible = () => Boolean(sovereign && sovereign.hasAccount());

  return {
    /** Vrai si l'effacement peut se faire tout de suite depuis ce téléphone. */
    possible,

    /**
     * Efface le compte sur le serveur du VPS.
     * @returns {Promise<{statut: "efface"} | {statut: "sans-session"} | {statut: "erreur", erreur: Error}>}
     *   efface : fait (ce téléphone est déconnecté partout) ;
     *   sans-session : pas de session valable sur le serveur, il faut se reconnecter ;
     *   erreur : serveur injoignable ou en panne, RIEN n'a été effacé.
     */
    async effacer() {
      if (!possible()) return { statut: "sans-session" };
      try {
        await sovereign.client.deleteMyAccountRgpd();
      } catch (e) {
        if (e && e.status === 401) {
          // Session refusée (expirée, compte déjà effacé ou banni) : elle ne sert plus à rien
          sovereign.forget();
          return { statut: "sans-session" };
        }
        return { statut: "erreur", erreur: e };
      }
      sovereign.forget();
      try {
        if (firebaseAuth && typeof firebaseAuth.signOut === "function") await firebaseAuth.signOut();
      } catch (e) {
        log.warn("[RGPD] Déconnexion Firebase :", e && (e.code || e.message));
      }
      return { statut: "efface" };
    },
  };
}
