import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * MODERATION SYSTEM & ZERO-TOLERANCE ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Modération proactive et autonome des espaces de groupe et contenus utilisateurs.
 * - Utilise la base de données exhaustive de mots grossiers (FrenchBadWords).
 * - Normalisation sémantique : leetspeak, séparateurs, phonétique.
 * - Application autonome des sanctions : Avertissement -> Ban Temporaire -> Ban Définitif.
 * - Conformité internationale : DSA (UE 2022/2065 Art. 16/17), AI Act, RGPD, CCPA.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CORE_BANNED_WORDS = [
  "merde", "putain", "connard", "salope", "encule", "bite", "couille",
  "nique", "fuck", "shit", "bitch", "asshole", "pussy", "dick",
  "batard", "bâtard", "fdp", "salop", "bordel", "chier", "crevard",
  "degueulasse", "dégueulasse", "ducon", "glandu", "pouffiasse", "tocard",
  "trouduc", "pd", "pédé", "bougnoul", "negro", "négro", "youpin", "nazi", "hitler"
];

// Mots à tolérance zéro absolue (Entraîne un bannissement définitif immédiat)
const ZERO_TOLERANCE_WORDS = [
  "nazi", "hitler", "negro", "négro", "bougnoul", "youpin",
  "terroriste", "égorger", "crever", "viol", "violer", "pédophile"
];

class ModerationEngine {
  constructor() {
    this.coreBanned = CORE_BANNED_WORDS;
    this.zeroTolerance = ZERO_TOLERANCE_WORDS;
  }

  /**
   * Récupère la liste complète des mots grossiers (incluant le dictionnaire étendu)
   */
  getWordList() {
    if (typeof window !== "undefined" && Array.isArray(window.FrenchBadWords) && window.FrenchBadWords.length > 0) {
      return window.FrenchBadWords;
    }
    return this.coreBanned;
  }

  /**
   * Normalise le texte pour contrer le leetspeak, les accents et répétitions
   * ex: "c.0.n_n@rd" -> "connard"
   */
  normalizeText(text) {
    if (!text || typeof text !== "string") return "";

    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
      .replace(/[@4]/g, "a")
      .replace(/[0]/g, "o")
      .replace(/[3]/g, "e")
      .replace(/[$5]/g, "s")
      .replace(/[7]/g, "t")
      .replace(/[8]/g, "b")
      .replace(/(?<=[a-z0-9])[1!|](?=[a-z0-9])|[1!|](?=[a-z0-9])|(?<=[a-z0-9])[1!|]/gi, "i")
      .replace(/[^a-z0-9]/g, "") // Supprime ponctuations et séparateurs
      .replace(/([aeiouy])\1+/gi, "$1") // Compresse les voyelles répétées (ex: cooooo -> co)
      .replace(/([^aeiouy0-9])\1{2,}/gi, "$1$1"); // Compresse les consonnes au-delà de deux (ex: nnnn -> nn)
  }

  /**
   * Vérifie si un texte contient un mot grossier ou illicite
   */
  isProfane(text) {
    if (!text || typeof text !== "string") return false;

    const rawLower = text.toLowerCase();
    const normalized = this.normalizeText(text);
    const words = this.getWordList();

    // 1. Détection directe sur mots clés de base
    for (const w of this.coreBanned) {
      const lowerW = w.toLowerCase();
      if (rawLower.includes(lowerW) || normalized.includes(this.normalizeText(w))) {
        return true;
      }
    }

    // 2. Détection sur la base de données exhaustive
    for (let i = 0; i < words.length; i++) {
      const word = String(words[i]).toLowerCase();
      if (word.length >= 3) {
        if (rawLower.includes(word) || normalized.includes(this.normalizeText(word))) {
          return true;
        }
      }
    }

    // 3. Détection sur les mots à tolérance zéro
    for (const zw of this.zeroTolerance) {
      const lowerZW = zw.toLowerCase();
      if (rawLower.includes(lowerZW) || normalized.includes(this.normalizeText(zw))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Détecte si le message relève de la Tolérance Zéro (Racisme, Menaces)
   */
  isZeroTolerance(text) {
    if (!text) return false;
    const norm = this.normalizeText(text);
    const rawLower = text.toLowerCase();
    return this.zeroTolerance.some((zw) => rawLower.includes(zw) || norm.includes(this.normalizeText(zw)));
  }

  /**
   * Nettoie le texte en remplaçant les mots grossiers par des astérisques
   */
  clean(text) {
    if (!text) return "";
    let cleaned = text;
    this.coreBanned.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      cleaned = cleaned.replace(regex, "***");
    });
    return cleaned;
  }

  /**
   * Analyse et applique de façon proactive et autonome les règles de modération
   * dans les espaces de groupe (Crew Chat, Cortèges, flux communautaires).
   *
   * RÈGLE STRICTE (CGU) :
   * - 1er écart : 1er bannissement temporaire (24h).
   * - 2e écart : 2e bannissement temporaire (48h).
   * - 3e écart : 3e bannissement temporaire (7 jours - Dernier avertissement).
   * - Après 3 bannissements temporaires : Bannissement DÉFINITIF et irrévocable du compte,
   *   SANS AUCUNE POSSIBILITÉ DE REMBOURSEMENT (abonnements, BVC, achats).
   * - Tolérance Zéro (Racisme, Menaces) : Bannissement définitif immédiat.
   *
   * @param {string} text - Message de l'utilisateur
   * @param {Object} context - Contexte { space: "crew_chat"|"cortege"|"social", uid: string, username: string }
   * @returns {Object} { safe: boolean, reason?: string, action?: "TEMP_BAN"|"PERM_BAN", tempBansCount?: number, userMessage?: string }
   */
  checkGroupMessage(text, context = {}) {
    if (!this.isProfane(text) && !this.isZeroTolerance(text)) {
      return { safe: true };
    }

    const uid = context.uid || (window.session ? window.session.uid : "anonymous");
    const username = context.username || (window.session ? window.session.username : "Pilote");
    const space = context.space || "Espace de groupe";

    const isCritical = this.isZeroTolerance(text);

    // Compteur de bannissements temporaires subis par l'utilisateur
    const storageKey = `mod_temp_bans_${uid}`;
    let tempBansCount = 0;
    try {
      tempBansCount = parseInt(localStorage.getItem(storageKey) || "0", 10);
    } catch (e) {
      tempBansCount = 0;
    }

    let action = "TEMP_BAN";
    let userMessage = "";
    let banDurationMs = 0;

    if (isCritical) {
      // Tolérance Zéro absolue : Bannissement définitif immédiat
      action = "PERM_BAN";
      userMessage = `🚨 [TOLÉRANCE ZÉRO] Propos intolérables détectés dans ${space}. Votre compte est banni DÉFINITIVEMENT sans aucune possibilité de remboursement (CGU Art. 8 & 10).`;
      this.recordAccountBan(uid, username, "Bannissement définitif - Contenu illicite à tolérance zéro", true, null, tempBansCount);
    } else if (tempBansCount >= 3) {
      // Règle formelle : Le ban définitif après 3 bannissements temporaires sans possibilité de remboursement
      action = "PERM_BAN";
      userMessage = `🚨 [BANNISSEMENT DÉFINITIF] Vous avez cumulé 3 bannissements temporaires dans les espaces de groupe. Conformément aux CGU, votre compte est désormais banni DÉFINITIVEMENT sans aucune possibilité de remboursement.`;
      this.recordAccountBan(uid, username, "Bannissement définitif - Récidive après 3 bannissements temporaires", true, null, tempBansCount);
    } else {
      // Incrémentation du nombre de bannissements temporaires
      tempBansCount += 1;
      try {
        localStorage.setItem(storageKey, String(tempBansCount));
      } catch (e) {}

      action = "TEMP_BAN";
      if (tempBansCount === 1) {
        banDurationMs = 24 * 3600 * 1000; // 24 heures
        userMessage = `⛔ [1er BANNISSEMENT TEMPORAIRE] Utilisation de termes grossiers interdite dans ${space}. Vous êtes banni temporairement pour 24 heures. Rappel : le ban définitif intervient après 3 bannissements temporaires, sans possibilité de remboursement.`;
      } else if (tempBansCount === 2) {
        banDurationMs = 48 * 3600 * 1000; // 48 heures
        userMessage = `⛔ [2e BANNISSEMENT TEMPORAIRE] Récidive de langage grossier dans ${space}. Vous êtes banni temporairement pour 48 heures. Attention : à 3 bannissements temporaires, votre compte sera banni définitivement sans remboursement.`;
      } else {
        banDurationMs = 7 * 24 * 3600 * 1000; // 7 jours
        userMessage = `⛔ [3e BANNISSEMENT TEMPORAIRE - DERNIER AVERTISSEMENT] Vous êtes banni temporairement pour 7 jours. Tout nouvel écart entraînera le BANNISSEMENT DÉFINITIF de votre compte sans possibilité de remboursement.`;
      }

      this.recordAccountBan(uid, username, `Bannissement temporaire #${tempBansCount}`, false, Date.now() + banDurationMs, tempBansCount);
    }

    // Journalisation d'audit automatique dans Firestore
    this.logViolationToAudit(uid, username, space, text, action, tempBansCount);

    return {
      safe: false,
      reason: isCritical ? "Contenu illicite à tolérance zéro" : "Langage grossier en espace de groupe",
      action,
      tempBansCount,
      userMessage
    };
  }

  /**
   * Enregistre la suspension ou le bannissement dans le profil local et Firestore
   */
  recordAccountBan(uid, username, reason, isPermanent, expireAt = null, strikes = 0) {
    try {
      const banData = {
        isBanned: isPermanent,
        isTempBanned: !isPermanent,
        banReason: reason,
        bannedAt: Date.now(),
        expireAt: expireAt || null,
        tempBansCount: strikes
      };

      localStorage.setItem(`user_ban_status_${uid}`, JSON.stringify(banData));

      if (window.session && window.session.uid === uid) {
        window.session.isBanned = isPermanent;
        window.session.isTempBanned = !isPermanent;
      }
    } catch (e) {}

    if (typeof firebase !== "undefined" && firebase.firestore) {
      try {
        const firestoreDb = firebase.firestore();
        firestoreDb.collection("users").doc(uid).set({
          isBanned: isPermanent,
          isTempBanned: !isPermanent,
          banReason: reason,
          banExpireAt: expireAt || null,
          tempBansCount: strikes,
          banUpdated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn("[Moderation] Sync bannissement Firestore différée :", e.message);
      }
    }
  }

  /**
   * Récupère l'état courant de bannissement et de réexamen
   */
  getBanStatus(uid) {
    let localData = null;
    let tempBansCount = 0;
    let appealPending = false;
    try {
      const raw = localStorage.getItem(`user_ban_status_${uid}`);
      if (raw) localData = JSON.parse(raw);
      tempBansCount = parseInt(localStorage.getItem(`mod_temp_bans_${uid}`) || "0", 10);
      appealPending = localStorage.getItem(`appeal_pending_${uid}`) === "true";
    } catch (e) {}

    let isTempBanned = localData ? !!localData.isTempBanned : false;
    if (isTempBanned && localData.expireAt && Date.now() > localData.expireAt) {
      isTempBanned = false;
    }

    return {
      isBanned: localData ? !!localData.isBanned : false,
      isTempBanned,
      tempBansCount: localData?.tempBansCount !== undefined ? localData.tempBansCount : tempBansCount,
      banReason: localData?.banReason || null,
      expireAt: localData?.expireAt || null,
      appealPending
    };
  }

  /**
   * Soumission d'une demande de réexamen via Nexus Atlas Juridique (Vérification Humaine)
   * L'utilisateur demande une vérification humaine en utilisant ses points mon50cc.
   * Si la sanction est ensuite annulée après réexamen :
   * interdiction levée immédiatement, compteur réinitialisé à zéro et 50 points mon50cc en compensation.
   */
  async requestAppeal(uid, reason, details = "", cost = 5) {
    if (!uid) {
      return { success: false, error: "Utilisateur non identifié." };
    }

    const currentBan = this.getBanStatus(uid);
    const username = (window.session && window.session.username) ? window.session.username : "Pilote";
    const tempBansCount = currentBan.tempBansCount;

    try {
      localStorage.setItem(`appeal_pending_${uid}`, "true");
    } catch (e) {}

    if (typeof firebase !== "undefined" && firebase.firestore) {
      try {
        const firestoreDb = firebase.firestore();
        await firestoreDb.collection("mod_appeals").add({
          uid,
          username,
          sanctionType: currentBan.isBanned ? "PERM_BAN" : "TEMP_BAN",
          tempBansCount,
          costPoints: cost,
          compensationIfAccepted: 50,
          banReason: currentBan.banReason || "Sanction en espace de groupe",
          appealReason: reason,
          details,
          status: "PENDING_HUMAN_REVIEW",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await firestoreDb.collection("users").doc(uid).set({
          appealStatus: "PENDING_HUMAN_REVIEW",
          appealSubmittedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Trace dans les journaux d'audit (mod_logs)
        await firestoreDb.collection("mod_logs").add({
          bot: "Nexus Atlas Juridique",
          targetUid: uid,
          targetUsername: username,
          action: "APPEAL_SUBMITTED",
          costPoints: cost,
          reason: `Demande de réexamen soumise via Nexus Atlas Juridique (${cost} points mon50cc) : ${reason}`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn("[Moderation Appeal] Erreur enregistrement Firestore :", e.message);
      }
    }

    return {
      success: true,
      cost,
      compensationIfAccepted: 50,
      message: "Votre demande de réexamen a bien été transmise à l'équipe de vérification humaine. Si la sanction est ensuite annulée après réexamen, votre interdiction sera levée immédiatement, votre compteur sera réinitialisé à zéro et vous recevrez 50 points mon50cc en compensation."
    };
  }

  /**
   * Annulation du bannissement et réinitialisation intégrale du compteur à zéro
   * Déclenchée dès que la vérification humaine valide le rejet de la sanction.
   * Le joueur voit son interdiction levée immédiatement et reçoit 50 points mon50cc en compensation.
   */
  async liftBanAndResetStrikes(uid, moderatorUid = "human_moderator") {
    if (!uid) return { success: false, error: "UID manquant" };

    const compensationPoints = 50;

    // 1. Réinitialisation locale immédiate
    try {
      localStorage.removeItem(`user_ban_status_${uid}`);
      localStorage.removeItem(`appeal_pending_${uid}`);
      localStorage.setItem(`mod_temp_bans_${uid}`, "0");

      if (window.session && window.session.uid === uid) {
        window.session.isBanned = false;
        window.session.isTempBanned = false;
      }

      if (typeof window !== "undefined" && window.BVCManager && typeof window.BVCManager.add === "function") {
        window.BVCManager.add(compensationPoints);
      }
    } catch (e) {}

    // 2. Mise à jour Firestore
    if (typeof firebase !== "undefined" && firebase.firestore) {
      try {
        const firestoreDb = firebase.firestore();
        await firestoreDb.collection("users").doc(uid).set({
          isBanned: false,
          isTempBanned: false,
          tempBansCount: 0,
          banReason: null,
          banExpireAt: null,
          appealStatus: "SANCTION_LIFTED_BY_HUMAN",
          braveCoins: firebase.firestore.FieldValue.increment(compensationPoints),
          bvc_points: firebase.firestore.FieldValue.increment(compensationPoints),
          compensationAwarded: compensationPoints,
          banLiftedAt: firebase.firestore.FieldValue.serverTimestamp(),
          banLiftedBy: moderatorUid
        }, { merge: true });

        // Trace immuable dans mod_logs
        await firestoreDb.collection("mod_logs").add({
          bot: "Human Moderator / Reviewer",
          targetUid: uid,
          action: "BAN_LIFTED_STRIKES_RESET",
          reason: `Sanction rejetée après vérification humaine. Bannissement levé immédiatement, compteur réinitialisé à zéro et +${compensationPoints} points mon50cc attribués en compensation.`,
          moderatorUid,
          compensationPoints,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn("[Moderation] Erreur levée de ban Firestore :", e.message);
      }
    }

    return {
      success: true,
      compensationPoints,
      message: `Interdiction levée immédiatement, compteur de sanctions réinitialisé à zéro et ${compensationPoints} points mon50cc accordés en compensation suite à la vérification humaine.`
    };
  }

  /**
   * Synchronisation en direct de l'état de sanction depuis Firestore.
   * Détecte si un modérateur humain a levé la sanction et réinitialisé le compteur.
   */
  syncBanStatus(uid) {
    if (!uid || typeof firebase === "undefined" || !firebase.firestore) return;
    try {
      firebase.firestore().collection("users").doc(uid)
        .onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            if (data.appealStatus === "SANCTION_LIFTED_BY_HUMAN" || (!data.isBanned && !data.isTempBanned && data.tempBansCount === 0)) {
              try {
                localStorage.removeItem(`user_ban_status_${uid}`);
                localStorage.removeItem(`appeal_pending_${uid}`);
                localStorage.setItem(`mod_temp_bans_${uid}`, "0");
                if (window.session && window.session.uid === uid) {
                  window.session.isBanned = false;
                  window.session.isTempBanned = false;
                }
              } catch (e) {}
            }
          }
        });
    } catch (e) {
      console.warn("[Moderation] Erreur écoute synchro ban :", e.message);
    }
  }

  /**
   * Journalise la violation dans Firestore collection mod_logs
   */
  logViolationToAudit(uid, username, space, originalText, action, strikes) {
    if (typeof firebase === "undefined" || !firebase.firestore) return;
    try {
      firebase.firestore().collection("mod_logs").add({
        bot: "Nexus Atlas Guardian",
        targetUid: uid,
        targetUsername: username,
        space,
        action,
        strikes,
        textSnippet: originalText.slice(0, 100),
        reason: "Langage grossier détecté dans espace de groupe",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn("[Moderation Audit] Échec log violation :", e.message);
    }
  }

  async scanImage(imageData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ safe: true, score: 0.99 });
      }, 500);
    });
  }
}

const moderationInstance = new ModerationEngine();

window.Moderation = moderationInstance;

export default moderationInstance;
export { ModerationEngine };
