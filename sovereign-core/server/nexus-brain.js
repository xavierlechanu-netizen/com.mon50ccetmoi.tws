/**
 * nexus-brain.js — Cerveau de Nexus Atlas sur le serveur souverain (19/11/2026).
 *
 * Décidé avec l'utilisateur : Nexus Atlas répond d'abord avec ce qu'il sait ; s'il n'a pas la réponse,
 * il passe la question à Mistral 7B, installé SUR LE VPS (Ollama, aucun service extérieur, gratuit).
 *
 * Ordre, pour chaque question (l'appli a déjà essayé ses commandes et sa base Légifrance) :
 *   1. URGENCE (chute, accident, blessure, secours…) : réponse « SOS » tout de suite. JAMAIS Mistral,
 *      jamais gardée dans le carnet. Règle absolue de l'utilisateur.
 *   2. Réponses APPRISES et validées (carnet d'apprentissage) : réponse immédiate.
 *   3. LOI (amende, permis, autoroute, débridage…) : jamais Mistral. Elle vient de la base Légifrance
 *      de l'appli ; si elle n'y est pas, Nexus Atlas le dit.
 *   4. MISTRAL 7B : réponse avec la personnalité et les règles de Nexus Atlas. Gardée dans le carnet,
 *      puis vérifiée (nexus-verifier.js).
 *   5. Mistral occupé, trop lent ou absent : « Je n'ai pas la réponse pour l'instant. Réessayez un peu
 *      plus tard. » Jamais de réponse inventée.
 *
 * Testé : tests/nexus-brain.test.js (Mistral simulé).
 */
"use strict";

const REPLY_LATER = "Je n'ai pas la réponse pour l'instant. Réessayez un peu plus tard.";
const REPLY_EMERGENCY = "Urgence détectée. Je préviens vos anges gardiens si vous le souhaitez. " +
    "En cas de blessure ou de danger, appelez le 112.";
const REPLY_LAW_UNKNOWN = "Je ne réponds aux questions de loi qu'avec les textes officiels (Légifrance), " +
    "et celle-ci n'est pas encore dans ma base. Consultez la rubrique « Code de la route » de l'appli " +
    "ou legifrance.gouv.fr.";
const MAX_QUESTION = 500;

/** Texte comparable : minuscules, sans accents, sans ponctuation, espaces simples. */
function normalizeQuestion(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[’`]/g, "'")
        .replace(/[^a-z0-9' ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Urgences : mots et expressions (sur le texte normalisé, sans accents). Mêmes règles que l'appli
// (src/js/nexus-brain-local.js) ; tests/nexus-brain.test.js vérifie que les deux listes sont identiques.
const EMERGENCY_PATTERNS = [
    /\bje (suis|me suis) (tombe|tombee|blesse|blessee)\b/,
    /\b(chute|accident|accidente|collision|percute|renverse)\b/,
    /\b(au secours|aidez moi|aide moi|a l'aide|sos|urgence|urgent)\b/,
    /\b(blesse|blessee|blessure|saigne|saignement|sang|evanoui|inconscient|fracture|casse la jambe|casse le bras)\b/,
    /\bj'ai (tres )?mal\b/,
    /\b(appelle|appeler|prevenir) (les )?(secours|pompiers|samu|police|gendarmerie|112|15|18|17)\b/,
    /\b(samu|pompiers|ambulance|112)\b/,
    /\bje (vais|veux) mourir\b|\bsuicid/,
];
// « Tomber en panne » n'est pas une urgence
const NOT_EMERGENCY = /\btomb\w* en panne\b|\bpanne\b(?!.*\b(blesse|mal|sang)\b)/;

function isEmergency(text) {
    const t = normalizeQuestion(text);
    if (!t) return false;
    const hit = EMERGENCY_PATTERNS.some((re) => re.test(t));
    if (!hit) return false;
    // « je suis tombé en panne » : pas une urgence, sauf si un mot de blessure l'accompagne
    if (NOT_EMERGENCY.test(t) && !/\b(blesse|mal|sang|secours|accident|chute)\b/.test(t)) return false;
    return true;
}

// Loi : jamais Mistral (l'essai du 19/11/2026 : « autoroute pas recommandée » au lieu d'« interdite »)
const LAW_PATTERNS = [
    /\b(loi|legal|legale|illegal|illegale|interdit|interdite|autorise|autorisee|obligatoire|droit de)\b/,
    // (« points » seul viserait aussi les points mon50cc de l'appli : seulement le retrait de points)
    /\b(amende|contravention|sanction|retrait de points|perte de points|retrait de permis|fourriere|confiscation|saisie)\b/,
    /\b(permis|bsr|permis am|age minimum|quel age|a quel age|ans pour conduire)\b/,
    /\b(autoroute|voie rapide|code de la route|article)\b/,
    /\b(debrid\w*|kit|pot non homologue)\b/,
    /\b(assurance|assureur|constat|responsabilite|litige|avocat|tribunal|plainte)\b/,
    /\b(crit ?air|zfe|vignette)\b/,
    /\b(casque|gants)\b.*\b(obligatoire|homologue)\b|\b(obligatoire|homologue)\b.*\b(casque|gants)\b/,
];

function isLawQuestion(text) {
    const t = normalizeQuestion(text);
    return LAW_PATTERNS.some((re) => re.test(t));
}

const VALIDATED = ["valide", "valide_auto"];

/**
 * Réponse apprise pour une question proche : même question normalisée, ou au moins 80 % de mots en
 * commun (questions de 3 mots ou plus). @param {{id, questionNorm, answer}[]} entries validées
 */
function bestLearnedMatch(norm, entries) {
    const exact = entries.find((e) => e.questionNorm === norm);
    if (exact) return exact;
    const words = new Set(norm.split(" ").filter((w) => w.length > 1));
    if (words.size < 3) return null;
    let best = null;
    let bestScore = 0;
    for (const e of entries) {
        const other = new Set(e.questionNorm.split(" ").filter((w) => w.length > 1));
        if (other.size < 3) continue;
        let common = 0;
        for (const w of words) if (other.has(w)) common++;
        const score = common / (words.size + other.size - common);
        if (score > bestScore) { bestScore = score; best = e; }
    }
    return bestScore >= 0.8 ? best : null;
}

/** Retire ce qui pourrait identifier quelqu'un avant de garder une question dans le carnet. */
function sanitizeForNotebook(text) {
    return String(text || "")
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
        .replace(/https?:\/\/\S+/g, "[lien]")
        .replace(/(\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g, "[téléphone]")
        .replace(/\b[A-Z]{2}-?\d{3}-?[A-Z]{2}\b/g, "[plaque]")
        .replace(/\d{5,}/g, "[nombre]")
        .slice(0, MAX_QUESTION)
        .trim();
}

/** Personnalité de Nexus Atlas pour Mistral (sur le serveur : l'appli ne peut pas la remplacer). */
function systemPrompt({ driving }) {
    return [
        "Tu es Nexus Atlas, l'assistant de l'application mon50ccetmoi, pour les conducteurs de scooters 50 cc",
        "et de voitures sans permis (VSP), en France. Tu vouvoies toujours le pilote, avec chaleur et clarté.",
        "Réponds en français, en texte simple (pas de JSON, pas de markdown).",
        driving
            ? "Le pilote roule : réponds en UNE ou DEUX phrases courtes, rien de plus."
            : "Réponds en 6 phrases au plus, de façon concrète.",
        "Règles absolues :",
        "- Ne réponds JAMAIS à une question de loi, d'amende, de permis, d'assurance ou de litige : dis que",
        "  Nexus Atlas répond à ces questions avec les textes officiels, dans la rubrique « Code de la route ».",
        "- Ne gère JAMAIS une urgence (chute, accident, blessure) : dis d'utiliser le bouton SOS et d'appeler le 112.",
        "- Ne conseille jamais le débridage, la conduite sans casque ni la conduite sur autoroute (interdite aux 50 cc et VSP).",
        "- Pour la mécanique, termine par : « ⚠️ Je suis une intelligence artificielle d'assistance. Faites valider",
        "  ces informations par un garagiste. »",
        "- Si tu ne sais pas, dis-le simplement. N'invente jamais un chiffre, un article de loi ou un nom.",
        "- Tu ne demandes ni ne gardes aucune donnée personnelle.",
        "- Si le pilote est grossier ou agressif : rappelle calmement les règles de respect de la communauté.",
        "Ce que tu sais (appris à Nexus Atlas par l'équipe, pour le contexte ; ne cite jamais d'article de loi) :",
        "- 50 cc et VSP : 45 km/h au plus ; autoroutes et voies rapides interdites.",
        "- Le débridage est interdit : amende, saisie du véhicule, assurance annulée en cas d'accident.",
        "- Équipements : casque homologué attaché, gants certifiés CE, gilet jaune à bord.",
        "- BSR / permis AM obligatoire pour les personnes nées à partir du 1er janvier 1988.",
        "- Vignette Crit'Air exigée dans les zones à faibles émissions (ZFE).",
    ].join("\n");
}

/**
 * Client Ollama (Mistral 7B sur le VPS).
 * @param {{url: string, model: string, timeoutMs?: number, fetchImpl?: Function}} opts
 */
function createLlmClient({ url, model, timeoutMs = 120000, fetchImpl = fetch }) {
    const base = String(url).replace(/\/+$/, "");
    return {
        model,
        async chat(messages, { maxTokens = 350 } = {}) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetchImpl(`${base}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model, stream: false, keep_alive: "10m", messages,
                        options: { num_predict: maxTokens, temperature: 0.3, num_ctx: 3072 } }),
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error(`Mistral a répondu ${res.status}`);
                const data = await res.json();
                const text = data && data.message && typeof data.message.content === "string" ? data.message.content.trim() : "";
                if (!text) throw new Error("Réponse vide de Mistral");
                return text;
            } finally {
                clearTimeout(timer);
            }
        },
    };
}

function llmFromEnv(env = process.env) {
    if (!env.NEXUS_LLM_URL) return null;
    return createLlmClient({ url: env.NEXUS_LLM_URL, model: env.NEXUS_LLM_MODEL || "mistral:7b",
        timeoutMs: Number(env.NEXUS_LLM_TIMEOUT_MS) || 120000 });
}

/**
 * @param {{store: object, llm: object|null, verifier?: object, log?: object}} deps
 */
function createNexusBrain({ store, llm, verifier = null, log = console }) {
    let busy = false;

    return {
        get llmConfigured() {
            return Boolean(llm);
        },

        /**
         * @param {{question: string, driving?: boolean}} q
         * @returns {Promise<{source: string, reply: string, action: string}>}
         */
        async ask({ question, driving = false }) {
            const text = String(question || "").slice(0, MAX_QUESTION);
            // 1. Urgence : toujours avant tout le reste, jamais Mistral, jamais gardée
            if (isEmergency(text)) return { source: "urgence", reply: REPLY_EMERGENCY, action: "SOS" };

            const norm = normalizeQuestion(text);
            if (!norm) return { source: "nexus", reply: "Je vous écoute. Posez-moi votre question.", action: "CHAT" };

            // 2. Déjà appris et validé
            const learned = await store.findLearnedNexusAnswer(norm);
            if (learned) {
                store.countNexusQuestion(learned.id).catch(() => {});
                return { source: "appris", reply: learned.answer, action: "CHAT" };
            }

            // 3. Loi : jamais Mistral
            if (isLawQuestion(text)) return { source: "loi", reply: REPLY_LAW_UNKNOWN, action: "LAWYER" };

            // 4. Mistral 7B, une question à la fois (le VPS n'a pas de carte graphique)
            if (!llm || busy) return { source: "indisponible", reply: REPLY_LATER, action: "CHAT" };
            busy = true;
            let reply;
            try {
                reply = await llm.chat([
                    { role: "system", content: systemPrompt({ driving }) },
                    { role: "user", content: text },
                ], { maxTokens: driving ? 120 : 350 });
            } catch (e) {
                log.warn("[Nexus] Mistral indisponible :", e.message);
                return { source: "indisponible", reply: REPLY_LATER, action: "CHAT" };
            } finally {
                busy = false;
            }

            // Carnet d'apprentissage : la question nettoyée et la réponse, « à vérifier »
            try {
                const entry = await store.recordNexusAnswer({
                    questionNorm: normalizeQuestion(sanitizeForNotebook(text)),
                    question: sanitizeForNotebook(text),
                    answer: reply,
                });
                if (verifier && entry && entry.created) verifier.enqueue(entry.id);
            } catch (e) {
                log.warn("[Nexus] Carnet d'apprentissage indisponible :", e.message);
            }
            return { source: "mistral", reply, action: "CHAT" };
        },

        /** Vrai si Mistral est libre (l'agent vérificateur ne passe qu'à ce moment-là). */
        isIdle() {
            return !busy;
        },

        /** Utilisé par l'agent vérificateur pour sa seconde lecture (même file d'attente). */
        async withLlm(fn) {
            if (!llm || busy) return null;
            busy = true;
            try {
                return await fn(llm);
            } finally {
                busy = false;
            }
        },
    };
}

module.exports = {
    createNexusBrain, createLlmClient, llmFromEnv, isEmergency, isLawQuestion, normalizeQuestion,
    sanitizeForNotebook, systemPrompt, bestLearnedMatch, VALIDATED, EMERGENCY_PATTERNS, REPLY_LATER,
    REPLY_EMERGENCY, REPLY_LAW_UNKNOWN,
};
