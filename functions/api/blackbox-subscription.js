/**
 * blackbox-subscription.js — Ce que donne chaque achat « Boîte Noire » (logique pure,
 * testée dans tests/blackbox-subscription.test.js). Utilisé par le webhook Revolut.
 *
 * Corrigé le 7/11/2026 :
 * - les CGV promettent 1 an d'abonnement Boîte Noire+ offert avec le boîtier : rien ne
 *   l'accordait. Il est maintenant accordé au paiement (1 an par boîtier acheté) ;
 * - l'achat d'un abonnement (mensuel ou annuel) était enregistré comme la vente d'un
 *   boîtier et n'activait aucun abonnement.
 * Un nouvel achat prolonge l'abonnement en cours au lieu de le remplacer.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const PURCHASES = {
    BLACKBOX_UNIT: { hardwareUnits: 1, saleType: "UNIT", grant: { months: 12, plan: "INCLUDED_FIRST_YEAR" } },
    BLACKBOX_DUO: { hardwareUnits: 2, saleType: "DUO", grant: { months: 12, plan: "INCLUDED_FIRST_YEAR" } },
    BLACKBOX_PACK_SUB: { hardwareUnits: 1, saleType: "PACK_SUBSCRIPTION", grant: { months: 24, plan: "PACK_24M" } },
    BLACKBOX_CARE_MONTHLY: { hardwareUnits: 0, saleType: "SUBSCRIPTION", grant: { months: 1, plan: "MONTHLY" } },
    BLACKBOX_CARE_ANNUAL: { hardwareUnits: 0, saleType: "SUBSCRIPTION", grant: { months: 12, plan: "ANNUAL" } },
};

/** Ajoute des mois calendaires (le 31 janvier + 1 mois = dernier jour de février). */
function addMonths(ms, months) {
    const d = new Date(ms);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d.getTime();
}

/**
 * @param {string} reportType  article du catalogue (BLACKBOX_UNIT…)
 * @param {number|null} currentEndsAtMs  fin de l'abonnement actuel (null si aucun)
 * @param {number} nowMs
 * @returns {null | { hardwareUnits, saleType, subscription: { plan, startsAtMs, endsAtMs, monthsGranted } }}
 */
function planBlackboxPurchase(reportType, currentEndsAtMs, nowMs) {
    const p = PURCHASES[reportType];
    if (!p) return null;
    // Prolonge à partir de la fin actuelle si l'abonnement court encore
    const startsAtMs = Number.isFinite(currentEndsAtMs) && currentEndsAtMs > nowMs ? currentEndsAtMs : nowMs;
    return {
        hardwareUnits: p.hardwareUnits,
        saleType: p.saleType,
        subscription: {
            plan: p.grant.plan,
            startsAtMs,
            endsAtMs: addMonths(startsAtMs, p.grant.months),
            monthsGranted: p.grant.months,
        },
    };
}

function isSubscriptionActive(endsAtMs, nowMs) {
    return Number.isFinite(endsAtMs) && endsAtMs > nowMs;
}

/**
 * Régularisation des achats payés avant la correction du 7/11/2026.
 * @param {Array<{orderId, userId, reportType, paidAtMs}>} orders  paiements réussis
 * @param {Set<string>} alreadyGranted  commandes déjà traitées par la nouvelle version
 * @param {Object<string, number|null>} currentEndsByUser  fin d'abonnement actuelle par membre
 * @returns {{ users: Object, orders: Array, boxesWronglyCounted: number }}
 */
function planRegularization(orders, alreadyGranted, currentEndsByUser = {}) {
    const users = {};
    const planned = [];
    let boxesWronglyCounted = 0;
    const todo = orders
        .filter((o) => PURCHASES[o.reportType] && o.userId && o.userId !== "unknown" && !alreadyGranted.has(o.orderId))
        .sort((a, b) => a.paidAtMs - b.paidAtMs);

    for (const o of todo) {
        const current = users[o.userId]?.endsAtMs ?? currentEndsByUser[o.userId] ?? null;
        // L'abonnement court depuis la date d'achat (pas depuis aujourd'hui)
        const plan = planBlackboxPurchase(o.reportType, current, o.paidAtMs);
        users[o.userId] = {
            plan: plan.subscription.plan,
            startsAtMs: users[o.userId]?.startsAtMs ?? plan.subscription.startsAtMs,
            endsAtMs: plan.subscription.endsAtMs,
            lastOrderId: o.orderId,
        };
        // Avant la correction, chaque achat comptait au moins 1 boîtier vendu
        const countedBefore = o.reportType === "BLACKBOX_DUO" ? 2 : 1;
        const wronglyCounted = countedBefore - plan.hardwareUnits;
        boxesWronglyCounted += wronglyCounted;
        planned.push({
            orderId: o.orderId,
            userId: o.userId,
            reportType: o.reportType,
            saleType: plan.saleType,
            hardwareUnits: plan.hardwareUnits,
            monthsGranted: plan.subscription.monthsGranted,
            endsAtMs: plan.subscription.endsAtMs,
            wronglyCounted,
        });
    }
    return { users, orders: planned, boxesWronglyCounted };
}

module.exports = { PURCHASES, DAY_MS, addMonths, planBlackboxPurchase, isSubscriptionActive, planRegularization };
