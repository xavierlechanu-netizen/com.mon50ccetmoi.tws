/**
 * Cerveau de Nexus Atlas, côté appli (19/11/2026). Décidé avec l'utilisateur :
 * Nexus Atlas traite toutes les demandes en premier ; s'il n'a pas la réponse, il passe la question à
 * Mistral 7B, sur le serveur du VPS (sovereign-core/server/nexus-brain.js). Jamais Mistral pour une urgence.
 *
 *   1. URGENCE → « SOS » tout de suite (l'alerte demande confirmation avant d'envoyer les SMS).
 *   2. Commandes de l'appli (itinéraire, carburant, blague…) → Nexus Atlas lui-même (nexus-atlas-voice.js).
 *   3. Loi → base Légifrance de l'appli (legal-database.js).
 *   4. Sinon → serveur : réponses apprises et validées, puis Mistral 7B.
 *   5. Serveur ou Mistral indisponible → « Je n'ai pas la réponse pour l'instant. Réessayez un peu plus tard. »
 *
 * Aucun import : testé directement (tests/nexus-brain.test.js). Branchement : nexus-atlas-gemini.js.
 */

export const REPLY_LATER = "Je n'ai pas la réponse pour l'instant. Réessayez un peu plus tard.";
export const REPLY_EMERGENCY = "Urgence détectée. Je préviens vos anges gardiens si vous le souhaitez. " +
  "En cas de blessure ou de danger, appelez le 112.";

/** Texte comparable : minuscules, sans accents, sans ponctuation (même règle que le serveur). */
export function normalizeQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Mêmes règles que sovereign-core/server/nexus-brain.js (tests/nexus-brain.test.js compare les deux)
export const EMERGENCY_PATTERNS = [
  /\bje (suis|me suis) (tombe|tombee|blesse|blessee)\b/,
  /\b(chute|accident|accidente|collision|percute|renverse)\b/,
  /\b(au secours|aidez moi|aide moi|a l'aide|sos|urgence|urgent)\b/,
  /\b(blesse|blessee|blessure|saigne|saignement|sang|evanoui|inconscient|fracture|casse la jambe|casse le bras)\b/,
  /\bj'ai (tres )?mal\b/,
  /\b(appelle|appeler|prevenir) (les )?(secours|pompiers|samu|police|gendarmerie|112|15|18|17)\b/,
  /\b(samu|pompiers|ambulance|112)\b/,
  /\bje (vais|veux) mourir\b|\bsuicid/,
];
const NOT_EMERGENCY = /\btomb\w* en panne\b|\bpanne\b(?!.*\b(blesse|mal|sang)\b)/;

export function isEmergency(text) {
  const t = normalizeQuestion(text);
  if (!t) return false;
  if (!EMERGENCY_PATTERNS.some((re) => re.test(t))) return false;
  if (NOT_EMERGENCY.test(t) && !/\b(blesse|mal|sang|secours|accident|chute)\b/.test(t)) return false;
  return true;
}

// Réponses de nexus-atlas-voice.js qui ne sont pas des commandes : on les affiche, rien à exécuter
const INFO_ACTIONS = new Set(["JOKE", "IDENTITY", "DRUGS_WARNING"]);

/**
 * Texte simple à partir d'un extrait HTML de la base juridique (<strong>, <br>…).
 * Le résultat ne contient jamais « < » ni « > » : aucune balise ne peut en sortir, même mal formée.
 */
export function plainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, "")
    .replace(/&nbsp;/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&(lt|gt);/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Réponse tirée de la base Légifrance, ou null. @param {object|null} legalDb window.LegalDatabase */
export function legalAnswer(text, legalDb) {
  if (!legalDb || typeof legalDb.search !== "function") return null;
  let results = [];
  try {
    results = legalDb.search(text) || [];
  } catch {
    return null;
  }
  const first = Array.isArray(results) ? results.find((r) => r && r.title && r.content) : null;
  if (!first) return null;
  return `${plainText(first.title)}\n${plainText(first.content)}${first.source ? `\nSource : ${plainText(first.source)}` : ""}`;
}

/**
 * @param {{
 *   localEngine: {processQuery: Function, executeAction?: Function}|null,  // window.NexusAtlasEngine
 *   loadLegal: () => Promise<object|null>,                                  // base Légifrance (chargée à la demande)
 *   askServer: (q: {question: string, driving: boolean}) => Promise<{source: string, reply: string, action: string}>,
 *   log?: object,
 * }} deps
 */
export function createNexusBrainLocal({ localEngine, loadLegal, askServer, log = console }) {
  return {
    /**
     * @param {string} question
     * @param {{driving?: boolean, document?: boolean}} [opts] document : lecture d'un document (pas une
     *   question du pilote) ; jamais d'urgence ni de commande déduite, réservé au serveur.
     * @returns {Promise<{reply: string, action: string, parameter?: string, source: string}>}
     */
    async ask(question, { driving = false, document = false } = {}) {
      const text = String(question || "").trim();
      if (document) return { reply: REPLY_LATER, action: "NONE", source: "indisponible" };

      // 1. Urgence : jamais Mistral
      if (isEmergency(text)) return { reply: REPLY_EMERGENCY, action: "SOS", source: "urgence" };

      // 2. Commandes et réponses intégrées de Nexus Atlas
      if (localEngine && typeof localEngine.processQuery === "function") {
        let local = null;
        try {
          local = localEngine.processQuery(text);
        } catch (e) {
          log.warn("[Nexus] Réponse intégrée impossible :", e && e.message);
        }
        // « police » seul n'est pas une urgence : le contrôle ci-dessus fait foi
        if (local && local.action && local.action !== "UNKNOWN" && local.action !== "EMERGENCY_CALL") {
          if (!INFO_ACTIONS.has(local.action) && typeof localEngine.executeAction === "function") {
            localEngine.executeAction(local);
            return { reply: local.reply, action: "NONE", source: "nexus", executed: true };
          }
          return { reply: local.reply, action: "CHAT", source: "nexus" };
        }
      }

      // 3. Loi : base Légifrance
      let legalDb = null;
      try {
        legalDb = await loadLegal();
      } catch {
        legalDb = null;
      }
      const law = legalAnswer(text, legalDb);
      if (law) return { reply: law, action: "CHAT", source: "loi" };

      // 4. Serveur du VPS (réponses apprises, puis Mistral)
      try {
        const out = await askServer({ question: text, driving });
        if (out && typeof out.reply === "string" && out.reply) {
          return { reply: out.reply, action: out.action || "CHAT", source: out.source || "serveur" };
        }
      } catch (e) {
        log.warn("[Nexus] Serveur indisponible :", e && e.message);
      }
      return { reply: REPLY_LATER, action: "CHAT", source: "indisponible" };
    },
  };
}
