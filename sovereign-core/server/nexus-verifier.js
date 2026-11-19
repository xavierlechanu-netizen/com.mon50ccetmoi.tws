/**
 * nexus-verifier.js — Agent vérificateur du carnet d'apprentissage de Nexus Atlas (19/11/2026).
 *
 * Chaque réponse de Mistral gardée dans le carnet passe par cet agent, sur le VPS :
 *   1. Contrôles sans IA : contradiction avec les faits connus (autoroute interdite, débridage interdit,
 *      casque obligatoire, BSR / permis AM dès 14 ans…), article de loi inventé, donnée personnelle.
 *      → « rejete_auto » (jamais répétée par Nexus Atlas).
 *   2. Seconde lecture par Mistral, quand il est libre : « cette réponse contient-elle une erreur ou un
 *      conseil dangereux ? ». Elle attrape une partie des erreurs, pas toutes.
 *   3. Tri par risque :
 *      - conversation (salutations, blagues, identité, conseils généraux) et deux contrôles bons →
 *        « valide_auto » : Nexus Atlas la répète désormais lui-même ;
 *      - mécanique, santé, sécurité, ou doute → « a_verifier » avec l'avis de l'agent : l'administrateur
 *        tranche (page admin-nexus.html).
 *   La loi et les urgences n'arrivent jamais ici (nexus-brain.js).
 *
 * Testé : tests/nexus-brain.test.js.
 */
"use strict";

const { normalizeQuestion } = require("./nexus-brain");

const CATEGORIES = [
    ["sante", /\b(mal|douleur|blessure|medecin|sante|malade|fatigue|alcool|medicament|vertige)\b/],
    ["mecanique", /\b(moteur|bougie|carbu\w*|frein\w*|pneu\w*|chaine|courroie|vidange|huile|batterie|demarre|demarrage|panne|reparer|reparation|piece|variateur|embrayage|pot|filtre)\b/],
    ["securite", /\b(securite|nuit|pluie|verglas|vent|danger|dangereux|prudence|visibilite|equipement|gilet)\b/],
    ["conversation", /\b(bonjour|salut|bonsoir|merci|blague|qui es tu|tu es qui|ca va|comment vas tu|ton nom|raconte)\b/],
];

/** Catégorie de la question (la plus prudente l'emporte). */
function categorize(question) {
    const t = normalizeQuestion(question);
    for (const [name, re] of CATEGORIES) if (re.test(t)) return name;
    return "general";
}

// Faits connus : une réponse qui les contredit est rejetée d'office.
const RULES = [
    { why: "autoroute présentée comme possible (elle est interdite aux 50 cc et VSP)",
        test: (a) => /\bautoroute/.test(a) && !/\binterdit/.test(a) },
    { why: "débridage présenté comme acceptable (il est interdit)",
        test: (a) => /\bdebrid/.test(a) && !/\binterdit/.test(a) },
    { why: "conduite sans casque présentée comme acceptable (casque obligatoire)",
        test: (a) => /\bsans casque\b/.test(a) && !/\b(interdit|obligatoire)/.test(a) },
    { why: "brevet inventé (le vrai nom : BSR, aujourd'hui permis AM)",
        test: (a) => /\bbrevet (specialise|special|regional)/.test(a) },
    { why: "âge minimum faux (BSR / permis AM dès 14 ans)",
        test: (a) => /\b(bsr|permis am|sans permis|50 ?cc)\b/.test(a) && /\b(16|18|21) ans\b/.test(a) && !/\b14 ans\b/.test(a) },
    { why: "article de loi cité (la loi ne vient que de Légifrance)",
        test: (a) => /\barticle [lrd] ?\d/.test(a) },
    { why: "vitesse au-delà de 45 km/h présentée comme normale",
        test: (a) => /\b(50|60|70|80|90) ?km ?h\b/.test(a) && !/\b(interdit|depasse|debrid|45)\b/.test(a) },
];
const PERSONAL = /[\w.+-]+@[\w-]+\.[\w.-]+|(\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/;

/** Contrôles sans IA. @returns {{ok: boolean, why: string[]}} */
function ruleCheck(answer) {
    const raw = String(answer || "");
    const a = normalizeQuestion(raw);
    const why = RULES.filter((r) => r.test(a)).map((r) => r.why);
    if (PERSONAL.test(raw)) why.push("donnée personnelle dans la réponse");
    return { ok: why.length === 0, why };
}

const REVIEW_PROMPT = "Tu relis la réponse d'un assistant pour des conducteurs de scooters 50 cc et de voitures sans permis " +
    "en France. Réponds par OUI ou NON sur la première ligne, puis une phrase d'explication : la réponse " +
    "contient-elle une erreur de fait ou un conseil dangereux ?";

/** Interprète la seconde lecture de Mistral. @returns {{doubt: boolean, note: string}} */
function parseReview(text) {
    const s = String(text || "").trim();
    const first = normalizeQuestion(s.split("\n")[0]);
    const doubt = !/^non\b/.test(first); // tout ce qui n'est pas un « NON » net reste un doute
    return { doubt, note: s.slice(0, 300) };
}

/**
 * @param {{store: object, brain: object, intervalMs?: number, log?: object}} deps
 */
function createNexusVerifier({ store, brain, intervalMs = 30000, log = console }) {
    const queue = [];
    let timer = null;

    /** Vérifie une entrée du carnet. @returns {Promise<string|null>} le statut décidé, ou null (à refaire) */
    async function review(id) {
        const entry = await store.getNexusEntry(id);
        if (!entry || entry.status !== "a_verifier" || entry.reviewedBy) return entry ? entry.status : null;
        const category = categorize(entry.question);
        const rules = ruleCheck(entry.answer);
        if (!rules.ok) {
            await store.updateNexusEntry(id, { status: "rejete_auto", category, reviewNote: `Agent : ${rules.why.join(" ; ")}` });
            return "rejete_auto";
        }
        const second = await brain.withLlm((llm) => llm.chat([
            { role: "system", content: REVIEW_PROMPT },
            { role: "user", content: `Question : ${entry.question}\n\nRéponse : ${entry.answer}` },
        ], { maxTokens: 80 }));
        if (second === null) return null; // Mistral occupé : on réessaiera
        const verdict = parseReview(second);
        if (category === "conversation" && !verdict.doubt) {
            await store.updateNexusEntry(id, { status: "valide_auto", category, reviewNote: `Agent : contrôles bons, relu par Mistral (${verdict.note})` });
            return "valide_auto";
        }
        await store.updateNexusEntry(id, { status: "a_verifier", category, reviewNote:
            `Agent : contrôles bons ; ${verdict.doubt ? "DOUTE de Mistral" : "relu par Mistral, rien vu"} — ${verdict.note}` });
        return "a_verifier";
    }

    async function tick() {
        while (queue.length && brain.isIdle()) {
            const id = queue[0];
            try {
                const done = await review(id);
                if (done === null) return; // occupé : on garde la place
            } catch (e) {
                log.warn("[Nexus] Vérification impossible :", e.message);
            }
            queue.shift();
        }
    }

    return {
        review,
        enqueue(id) {
            if (!queue.includes(id)) queue.push(id);
            setImmediate(() => tick().catch(() => {}));
        },
        start() {
            if (!timer) {
                timer = setInterval(() => tick().catch(() => {}), intervalMs);
                timer.unref();
            }
        },
        pending: () => queue.length,
    };
}

module.exports = { createNexusVerifier, ruleCheck, categorize, parseReview };
