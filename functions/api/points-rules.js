/**
 * points-rules.js — Règles du grand livre des points mon50cc (sans dépendance Firebase, testable).
 *
 * Principe (audit 2026-11) : le serveur décide seul du montant d'un gain, et exige une preuve
 * quand l'action est vérifiable. L'application ne peut plus choisir combien elle se donne.
 *
 *  proof:
 *   - "none"      : action non vérifiable côté serveur → montant fixe + plafonds (par motif et global)
 *   - "hazard"    : metadata.hazardId doit désigner un danger créé par l'utilisateur il y a < 48 h
 *   - "milestone" : metadata.milestoneKm doit être un palier connu ; un seul gain par palier, à vie
 *   - "once"      : un seul gain à vie pour ce motif
 *  serverOnly : jamais accordé à la demande de l'application (réservé aux administrateurs / au serveur)
 */
"use strict";

const REASON_RULES = {
    // ---- GAINS (AWARD) ----
    RIDE_COMPLETED: { action: "AWARD", fixedAmount: 12, dailyCap: 36, proof: "none", description: "Trajet terminé" },
    CODE_QUIZ_COMPLETED: { action: "AWARD", fixedAmount: 20, dailyCap: 40, proof: "none", description: "Quiz du Code de la Route complété" },
    CHALLENGE_COMPLETED: { action: "AWARD", fixedAmount: 5, dailyCap: 5, proof: "none", description: "Défi complété" },
    MAINTENANCE_LOGGED: { action: "AWARD", fixedAmount: 10, dailyCap: 10, proof: "none", description: "Entretien véhicule enregistré" },
    RADAR_HAZARD_REPORTED: { action: "AWARD", fixedAmount: 25, dailyCap: 100, proof: "hazard", description: "Signalement de zone de danger" },
    SAFE_RIDER_MILESTONE: { action: "AWARD", proof: "milestone", description: "Palier de conduite prudente atteint" },
    ROUTER_CONTRAT_SIGNED: { action: "AWARD", fixedAmount: 50, proof: "once", description: "Contrat de bonne conduite signé" },
    REFERRAL_BONUS: { action: "AWARD", maxPerCall: 100, dailyCap: 300, serverOnly: true, description: "Parrainage d'un nouveau pilote" },
    CARBON_OFFSET: { action: "AWARD", maxPerCall: 30, dailyCap: 90, serverOnly: true, description: "Économie carbone validée" },
    MODERATION_COMPENSATION: { action: "AWARD", maxPerCall: 50, dailyCap: 50, serverOnly: true, description: "Compensation après sanction annulée" },
    ADMIN_GRANT: { action: "AWARD", maxPerCall: 1000, dailyCap: 5000, serverOnly: true, description: "Attribution manuelle administrateur" },

    // ---- DÉPENSES (DEDUCT) ----
    MECA_WIZARD_DIAGNOSTIC: { action: "DEDUCT", maxPerCall: 200, description: "Diagnostic mécano virtuel" },
    POCKET_LAWYER_QUERY: { action: "DEDUCT", maxPerCall: 100, description: "Consultation Nexus Atlas Juridique" },
    MARKETPLACE_PURCHASE: { action: "DEDUCT", maxPerCall: 5000, description: "Achat sur la marketplace d'équipements" },
    EXCHANGE_PURCHASE: { action: "DEDUCT", maxPerCall: 5000, description: "Échange de points contre récompense" },
    WEB4_MINING_STAKE: { action: "DEDUCT", maxPerCall: 1000, description: "Stake Web4 de points" },
    GENERIC_SPEND: { action: "DEDUCT", maxPerCall: 1000, description: "Utilisation de points" },
};

/** Paliers de conduite prudente (km → points), alignés sur src/js/safe-rider.js. */
const SAFE_RIDER_MILESTONES = { 50: 10, 100: 25, 500: 100, 1000: 500 };

/** Plafond quotidien global des gains non vérifiables (tous motifs "none" confondus). */
const UNVERIFIED_DAILY_CAP = 100;

/** Ancienneté maximale d'un danger pour être récompensé. */
const HAZARD_MAX_AGE_MS = 48 * 3600 * 1000;

class RuleError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/**
 * Valide une demande et calcule ce que le serveur accorde réellement.
 * @returns {{ rule, amount, forcedIdempotencyKey: string|null, needsHazardCheck: boolean, unverified: boolean }}
 */
function planTransaction({ action, reason, amount, metadata }, { isAdmin = false } = {}) {
    if (action !== "AWARD" && action !== "DEDUCT") {
        throw new RuleError("invalid-argument", "Action invalide : doit être 'AWARD' ou 'DEDUCT'.");
    }
    const rule = REASON_RULES[reason];
    if (!rule) throw new RuleError("invalid-argument", `Motif de transaction non autorisé : '${reason}'.`);
    if (rule.action !== action) {
        throw new RuleError("invalid-argument", `L'action '${action}' ne correspond pas au motif '${reason}'.`);
    }
    if (rule.serverOnly && !isAdmin) {
        throw new RuleError("permission-denied", "Ce gain de points est attribué uniquement par le serveur ou un administrateur.");
    }

    const meta = metadata && typeof metadata === "object" ? metadata : {};
    let finalAmount;
    let forcedIdempotencyKey = null;

    if (action === "DEDUCT" || rule.serverOnly) {
        finalAmount = Math.floor(Number(amount));
        if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
            throw new RuleError("invalid-argument", "Le montant doit être un entier strictement positif.");
        }
        if (finalAmount > rule.maxPerCall) {
            throw new RuleError("out-of-range", `Le montant ${finalAmount} dépasse le plafond unitaire (${rule.maxPerCall}) pour '${reason}'.`);
        }
    } else if (rule.proof === "milestone") {
        const km = Number(meta.milestoneKm);
        if (!Object.prototype.hasOwnProperty.call(SAFE_RIDER_MILESTONES, km)) {
            throw new RuleError("invalid-argument", "Palier de conduite inconnu.");
        }
        finalAmount = SAFE_RIDER_MILESTONES[km];
        forcedIdempotencyKey = `milestone:${km}`;
    } else {
        // Le montant demandé par l'application est ignoré : le serveur applique le barème.
        finalAmount = rule.fixedAmount;
    }

    if (rule.proof === "hazard") {
        const id = meta.hazardId;
        if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
            throw new RuleError("invalid-argument", "Signalement de danger introuvable (hazardId requis).");
        }
        forcedIdempotencyKey = `hazard:${id}`;
    }
    if (rule.proof === "once") forcedIdempotencyKey = `once:${reason}`;

    return {
        rule,
        amount: finalAmount,
        forcedIdempotencyKey,
        needsHazardCheck: rule.proof === "hazard",
        unverified: action === "AWARD" && rule.proof === "none",
    };
}

/** Le danger existe-t-il, appartient-il à l'utilisateur et est-il récent ? */
function checkHazardProof(hazard, uid, now = Date.now()) {
    if (!hazard) return { ok: false, reason: "Signalement de danger introuvable." };
    const owner = hazard.authorUid || hazard.userId || hazard.uid;
    if (owner !== uid) return { ok: false, reason: "Ce signalement n'a pas été créé par vous." };
    const ts = hazard.createdAt || hazard.created_at || hazard.timestamp;
    const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : typeof ts === "number" ? ts : NaN;
    if (!Number.isFinite(ms)) return { ok: false, reason: "Date du signalement inconnue." };
    if (now - ms > HAZARD_MAX_AGE_MS) return { ok: false, reason: "Signalement trop ancien pour être récompensé." };
    return { ok: true };
}

/** Vérifie les plafonds quotidiens (par motif et global non vérifié) à partir du document de quota. */
function checkDailyCaps(plan, reason, quotaData = {}) {
    const { rule, amount, unverified } = plan;
    if (rule.action !== "AWARD") return { ok: true };
    if (rule.dailyCap && (quotaData[reason] || 0) + amount > rule.dailyCap) {
        return { ok: false, reason: `Plafond journalier de ${rule.dailyCap} Pts atteint pour '${rule.description}'.` };
    }
    if (unverified && (quotaData.__unverified || 0) + amount > UNVERIFIED_DAILY_CAP) {
        return { ok: false, reason: `Plafond journalier de ${UNVERIFIED_DAILY_CAP} Pts atteint pour les gains automatiques.` };
    }
    return { ok: true };
}

module.exports = {
    REASON_RULES,
    SAFE_RIDER_MILESTONES,
    UNVERIFIED_DAILY_CAP,
    HAZARD_MAX_AGE_MS,
    RuleError,
    planTransaction,
    checkHazardProof,
    checkDailyCaps,
};
