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
        label: "Rapport Assurance Standard"
    },
    'INTERMEDIAIRE': {
        price_cents: 8999,
        category: CATEGORIES.LITIGATION,
        label: "Rapport Assurance Approfondi"
    },
    'EXPERT': {
        price_cents: 19999,
        category: CATEGORIES.LITIGATION,
        label: "Rapport d'Expertise Complète & Reconstitution IA"
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

    // Matériel physique Black Box
    'BLACKBOX_UNIT': {
        price_cents: 8999, // Prix standard (dynamique pour les 10 premiers prototypes à 49,99€)
        category: CATEGORIES.BLACKBOX_HW,
        label: "Boîtier Matériel Black Box V1 Indestructible"
    },
    'BLACKBOX_DUO': {
        price_cents: 16198,
        category: CATEGORIES.BLACKBOX_HW,
        label: "Pack Duo 2 Boîtes Noires V1"
    },
    'BLACKBOX_PACK_SUB': {
        price_cents: 4999,
        category: CATEGORIES.BLACKBOX_SUB,
        label: "Pack Boîte Noire + Abonnement (Caution 49,99€)"
    },
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

module.exports = {
    CATEGORIES,
    CATALOG,
    getCatalogItem,
    isValidCaseId
};
