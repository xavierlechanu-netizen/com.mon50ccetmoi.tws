/**
 * PAYMENTS CATALOG — mon50ccetmoi
 * ─────────────────────────────────────────────────────────────────────────────
 * Source unique de vérité pour la tarification et le typage des commandes.
 * Empêche le contournement des montants et la mauvaise attribution (ASVS v5.0.0-2.2.1 / C4).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CATEGORIES = {
    LITIGATION: "LITIGATION",
    BATTERY_CERT: "BATTERY_CERT",
    BLACKBOX_HW: "BLACKBOX_HW",
    BLACKBOX_SUB: "BLACKBOX_SUB",
    GARAGE: "GARAGE",
    POINTS: "POINTS",
    DIAGNOSTIC: "DIAGNOSTIC"
};

const CATALOG = {
    // Rapports d'expertise & Sinistres (Litiges)
    'SIMPLE': {
        price_cents: 4999,
        category: CATEGORIES.LITIGATION,
        label: "Rapport Assurance Standard",
        vat_mode: "HT" // prix B2B affiché HORS TAXE : la TVA s'ajoute au paiement
    },
    'INTERMEDIAIRE': {
        price_cents: 8999,
        category: CATEGORIES.LITIGATION,
        label: "Rapport Assurance Approfondi",
        vat_mode: "HT" // prix B2B affiché HORS TAXE : la TVA s'ajoute au paiement
    },
    'EXPERT': {
        price_cents: 19999,
        category: CATEGORIES.LITIGATION,
        label: "Rapport d'Expertise Complète & Reconstitution IA",
        vat_mode: "HT" // prix B2B affiché HORS TAXE : la TVA s'ajoute au paiement
    },

    // Diagnostics IA ponctuels
    'DIAGNOSTIC_IA': {
        price_cents: 499,
        category: CATEGORIES.DIAGNOSTIC,
        label: "Diagnostic Mécanique IA & Pulse"
    },

    // Certificats Batterie SOH
    'BATTERY_CERT_BASIQUE': {
        price_cents: 499,
        category: CATEGORIES.BATTERY_CERT,
        label: "Certificat Batterie SOH Basique"
    },
    'BATTERY_CERT_PREMIUM': {
        price_cents: 1499,
        category: CATEGORIES.BATTERY_CERT,
        label: "Certificat Batterie SOH Premium (+ Style IA)"
    },
    'BATTERY_CERT_QUANTUM': {
        price_cents: 2999,
        category: CATEGORIES.BATTERY_CERT,
        label: "Certificat Batterie SOH Quantum Shield E2EE"
    },

    // Frais d'adhésion Pro
    'GARAGE_FEE': {
        price_cents: 5000,
        category: CATEGORIES.GARAGE,
        label: "Droit d'entrée Garage Partenaire Certifié"
    },

    // Matériel physique Black Box (BLACKBOX_UNIT, BLACKBOX_DUO) : retiré du catalogue le 12/11/2026.
    // Le boîtier n'est pas encore fabriqué (sortie dans 6 mois au plus tôt) : le serveur refuse
    // de l'encaisser. Le site propose une liste d'attente gratuite à la place.
    // BLACKBOX_PACK_SUB (caution 49,99 € + engagement 24 mois) : offre suspendue le 7/11/2026,
    // le paiement mensuel n'existait pas. Retirée du catalogue : le serveur refuse cet achat.
    'BLACKBOX_CARE_MONTHLY': {
        price_cents: 499,
        category: CATEGORIES.BLACKBOX_SUB,
        label: "Abonnement Boîte Noire+ (Mensuel)"
    },
    'BLACKBOX_CARE_ANNUAL': {
        price_cents: 5000,
        category: CATEGORIES.BLACKBOX_SUB,
        label: "Abonnement Boîte Noire+ (Annuel)"
    },

    // Packs de Points mon50cc (BVC Coins)
    'POINTS_100': {
        price_cents: 299,
        category: CATEGORIES.POINTS,
        points: 100,
        label: "Pack Starter — 100 Points mon50cc"
    },
    'POINTS_250': {
        price_cents: 599,
        category: CATEGORIES.POINTS,
        points: 250,
        label: "Pack Pilote — 250 Points mon50cc (+25% bonus)"
    },
    'POINTS_600': {
        price_cents: 1199,
        category: CATEGORIES.POINTS,
        points: 600,
        label: "Pack Pro Rider — 600 Points mon50cc (+50% bonus)"
    },
    'POINTS_1500': {
        price_cents: 2499,
        category: CATEGORIES.POINTS,
        points: 1500,
        label: "Coffre Légende — 1 500 Points mon50cc (+100% bonus)"
    }
};

/**
 * Valide et récupère les informations de catalogue d'un produit
 * @param {string} reportType 
 * @returns {Object|null}
 */
function getCatalogItem(reportType) {
    if (!reportType || typeof reportType !== 'string') return null;
    return CATALOG[reportType] || null;
}

/**
 * Valide le format d'un case_id
 * @param {string} caseId 
 * @returns {boolean}
 */
function isValidCaseId(caseId) {
    if (!caseId || typeof caseId !== 'string') return false;
    return /^[A-Za-z0-9_-]{4,64}$/.test(caseId);
}

const VAT_RATE = 0.20;

/**
 * Montants HT / TVA / TTC d'un article (en centimes).
 * - vat_mode "HT" (rapports assureurs, B2B) : price_cents est HT, l'acheteur paie HT + 20 %.
 * - par défaut (B2C) : price_cents est le prix TTC payé, la TVA y est incluse.
 */
function computeAmounts(item) {
    if (item.vat_mode === "HT") {
        const ht = item.price_cents;
        const vat = Math.round(ht * VAT_RATE);
        return { ht_cents: ht, vat_cents: vat, ttc_cents: ht + vat, vat_rate: VAT_RATE * 100 };
    }
    const ttc = item.price_cents;
    const ht = Math.round(ttc / (1 + VAT_RATE));
    return { ht_cents: ht, vat_cents: ttc - ht, ttc_cents: ttc, vat_rate: VAT_RATE * 100 };
}

module.exports = {
    CATEGORIES,
    CATALOG,
    VAT_RATE,
    computeAmounts,
    getCatalogItem,
    isValidCaseId
};
