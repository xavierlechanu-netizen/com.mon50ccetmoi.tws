/**
 * BLACK BOX — LOGIQUE MÉTIER PURE (sans dépendance Firebase)
 * ─────────────────────────────────────────────────────────────────────────────
 * Source de vérité serveur pour :
 *  - le format des numéros de série :
 *      * Prototypes : BB50V1-P01 à BB50V1-P10 (lettre P réservée aux 10 prototypes)
 *      * Série commerciale : débute à A01 (BB50V1-A01...A99, B01...B99)
 *      * Le 00 est STRICTEMENT EXCLU de la numérotation (A00, B00, P00 interdits)
 *  - le code Bluetooth unique (PIN 6 chiffres / passkey BLE sécurisé)
 *  - la machine à états du cycle de vie d'un boîtier (fabrication, QA, stock, vente)
 *  - la validation positive (allowlist) des champs saisis par l'admin
 *  - la tarification de la boutique (calculée serveur, jamais client)
 *  - la garantie de livraison (< 24h) et le partenariat Francelog S.A. (Linselles)
 *
 * ⚠️ Miroir client : src/js/blackbox-core.js
 *    La parité des deux fichiers est vérifiée par tests/blackbox-core.test.js.
 *
 * Conformité : OWASP ASVS v5.0.0-2.2.1 (validation allowlist), v5.0.0-2.3.3
 * (les transitions sont appliquées en transaction par blackbox-registry.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const crypto = require("crypto");

// ─── Numérotation ────────────────────────────────────────────────────────────
const SERIAL_PREFIX = "BB50";
const HW_REVISIONS = ["V1"]; // Allowlist : ajouter "V2" lors de la prochaine révision PCB
const PROTOTYPE_REVISION = "V1"; // La lettre P est réservée aux 10 prototypes V1
const MAX_PROTOTYPES = 10;
const SERIES_BATCH_MAX = 100; // Plafond par appel (anti-DoS / limite transaction Firestore)

// Lettres autorisées pour la production en série (P est exclu car réservé aux 10 prototypes)
const SERIES_LETTERS = "ABCDEFGHIJKLMNOQRSTUVWXYZ"; // 25 lettres
const UNITS_PER_LETTER = 99; // 01 à 99 (le 00 est exclu)
const SERIES_MAX = SERIES_LETTERS.length * UNITS_PER_LETTER; // 2475 unités pour série V1 à 1 lettre

// Regex de validation :
// - Prototypes : BB50V1-P01 à BB50V1-P10
// - Série commerciale : BB50V1-A01 à BB50V1-Z99 (ou AA01..ZZ99), 00 strictement exclu !
const SERIAL_REGEX = /^BB50(V[1-9])-(?:P(0[1-9]|10)|([A-Z]{1,2}(?:0[1-9]|[1-9][0-9])))$/;
const SHORT_CODE_REGEX = /^(?:P(0[1-9]|10)|([A-Z]{1,2}(?:0[1-9]|[1-9][0-9])))$/;

const UNIT_TYPES = Object.freeze({ PROTOTYPE: "PROTOTYPE", SERIES: "SERIES" });

// ─── Fabrication & Partenaire ────────────────────────────────────────────────
const DEFAULT_MANUFACTURER = "Francelog S.A.";
const DEFAULT_MANUFACTURING_SITE = "Linselles (59)";
const PARTNER_SERIES_STATUS = "En attente validation Francelog pour production en série";
const PARTNER_PROTOTYPE_STATUS = "Validé (10 prototypes V1)";
const DELIVERY_GUARANTEE = "Moins de 24h garantie";

// ─── Cycle de vie ────────────────────────────────────────────────────────────
const STATUSES = Object.freeze({
    MANUFACTURING: "MANUFACTURING",
    QA: "QA",
    IN_STOCK: "IN_STOCK",
    SOLD: "SOLD",
    ACTIVE: "ACTIVE",
    RMA: "RMA",
    STOLEN: "STOLEN",
    DECOMMISSIONED: "DECOMMISSIONED",
});

const STATUS_LABELS = Object.freeze({
    MANUFACTURING: "En fabrication",
    QA: "Contrôle qualité",
    IN_STOCK: "En stock",
    SOLD: "Vendu",
    ACTIVE: "Activé",
    RMA: "SAV / Retour",
    STOLEN: "Volé / Perdu",
    DECOMMISSIONED: "Mis au rebut",
});

const TRANSITIONS = Object.freeze({
    MANUFACTURING: ["QA", "DECOMMISSIONED"],
    QA: ["IN_STOCK", "MANUFACTURING", "DECOMMISSIONED"],
    IN_STOCK: ["SOLD", "QA", "DECOMMISSIONED"],
    SOLD: ["ACTIVE", "IN_STOCK", "RMA"],
    ACTIVE: ["RMA", "STOLEN"],
    RMA: ["ACTIVE", "IN_STOCK", "DECOMMISSIONED"],
    STOLEN: ["ACTIVE", "DECOMMISSIONED"],
    DECOMMISSIONED: [],
});

// Transitions qui passent OBLIGATOIREMENT par une action dédiée (attribution / désattribution)
const ASSIGNMENT_ONLY_TRANSITIONS = Object.freeze(["IN_STOCK>SOLD", "SOLD>IN_STOCK"]);
const REASON_REQUIRED_STATUSES = Object.freeze(["RMA", "STOLEN", "DECOMMISSIONED"]);
const INITIAL_STATUSES = Object.freeze(["MANUFACTURING", "QA", "IN_STOCK"]);

// ─── Garantie ────────────────────────────────────────────────────────────────
const WARRANTY_TYPES = Object.freeze({ LIFETIME: "LIFETIME", LEGAL_2Y: "LEGAL_2Y" });

// ─── Boutique (tarifs en centimes, TTC) ──────────────────────────────────────
const SHOP_PRODUCTS = Object.freeze(["UNIT", "DUO"]);
const SHOP_PRICES_CENTS = Object.freeze({
    PROTOTYPE_OFFER: 4999, // 49,99 € — 10 prototypes garantis à vie
    UNIT: 8999, //           89,99 € — boîtier de série
    DUO: 16198, //           161,98 € — 2 boîtiers de série, sans garantie à vie
});
const PROTOTYPE_RESERVATION_MINUTES = 30;

// ─── Numéros de série & Conversion Série ─────────────────────────────────────

function pad(num, size) {
    let s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
}

/**
 * Convertit un indice numérique 1-based (ex: 1, 99, 100) en code série (ex: "A01", "A99", "B01").
 * Le 00 est STRICTEMENT EXCLU de la numérotation.
 * La lettre P est réservée aux 10 prototypes.
 * @param {number} unitNumber  entier >= 1
 * @returns {string}  ex: "A01", "A99", "B01", etc.
 */
function unitNumberToSeriesCode(unitNumber) {
    if (!Number.isInteger(unitNumber) || unitNumber < 1) {
        throw new Error("Numéro d'unité invalide (doit être un entier >= 1).");
    }
    const zeroBased = unitNumber - 1;
    const letterIdx = Math.floor(zeroBased / UNITS_PER_LETTER);
    const numInLetter = (zeroBased % UNITS_PER_LETTER) + 1; // 1..99 (00 exclu)
    const numPart = pad(numInLetter, 2);

    if (letterIdx < SERIES_LETTERS.length) {
        return `${SERIES_LETTERS[letterIdx]}${numPart}`;
    }

    // Extension multi-lettres si dépassement de 25 lettres (ex: AA01..ZZ99)
    const l1 = Math.floor(letterIdx / SERIES_LETTERS.length) - 1;
    const l2 = letterIdx % SERIES_LETTERS.length;
    if (l1 >= 0 && l1 < SERIES_LETTERS.length) {
        return `${SERIES_LETTERS[l1]}${SERIES_LETTERS[l2]}${numPart}`;
    }
    throw new Error("Capacité maximale de numérotation de série atteinte.");
}

/**
 * Convertit un code de série (ex: "A01", "B01", "A99") en indice numérique 1-based.
 * Retourne null si invalide ou si contient "00" ou la lettre réservée "P".
 * @param {string} code
 * @returns {number|null}
 */
function seriesCodeToUnitNumber(code) {
    if (typeof code !== "string") return null;
    const clean = code.trim().toUpperCase();
    const m = /^([A-Z]{1,2})(0[1-9]|[1-9][0-9])$/.exec(clean);
    if (!m) return null; // Rejette 00 (A00, B00...)
    const letters = m[1];
    const numInLetter = parseInt(m[2], 10);
    if (numInLetter < 1 || numInLetter > UNITS_PER_LETTER) return null;

    if (letters === "P") return null; // P est réservé aux prototypes

    if (letters.length === 1) {
        const idx = SERIES_LETTERS.indexOf(letters);
        if (idx === -1) return null;
        return idx * UNITS_PER_LETTER + numInLetter;
    }

    const l1 = SERIES_LETTERS.indexOf(letters[0]);
    const l2 = SERIES_LETTERS.indexOf(letters[1]);
    if (l1 === -1 || l2 === -1) return null;
    return ((l1 + 1) * SERIES_LETTERS.length + l2) * UNITS_PER_LETTER + numInLetter;
}

/**
 * Construit un numéro de série canonique. Lève une erreur si les paramètres sont hors bornes.
 * @param {string} revision  ex. "V1"
 * @param {"PROTOTYPE"|"SERIES"} type
 * @param {number|string} unitNumber  1..10 (prototype) ou entier >= 1 / code "A01" (série)
 */
function formatSerial(revision, type, unitNumber) {
    if (!HW_REVISIONS.includes(revision)) throw new Error("Révision matérielle inconnue.");

    if (type === UNIT_TYPES.PROTOTYPE) {
        const num = typeof unitNumber === "string" ? parseInt(unitNumber.replace(/^P/i, ""), 10) : unitNumber;
        if (!Number.isInteger(num)) throw new Error("Numéro d'unité invalide.");
        if (revision !== PROTOTYPE_REVISION) throw new Error("Les prototypes n'existent qu'en " + PROTOTYPE_REVISION + ".");
        if (num < 1 || num > MAX_PROTOTYPES) throw new Error("Numéro de prototype hors bornes (1-10). Le 00 est exclu.");
        return `${SERIAL_PREFIX}${revision}-P${pad(num, 2)}`;
    }

    if (type === UNIT_TYPES.SERIES) {
        if (typeof unitNumber === "string") {
            const cleanCode = unitNumber.trim().toUpperCase();
            const n = seriesCodeToUnitNumber(cleanCode);
            if (n === null) throw new Error(`Code de série '${cleanCode}' invalide. La série commence à A01 et le 00 est exclu.`);
            return `${SERIAL_PREFIX}${revision}-${cleanCode}`;
        }
        if (!Number.isInteger(unitNumber) || unitNumber < 1) {
            throw new Error("Numéro de série hors bornes (entier >= 1). Le 00 est exclu.");
        }
        const code = unitNumberToSeriesCode(unitNumber);
        return `${SERIAL_PREFIX}${revision}-${code}`;
    }

    throw new Error("Type d'unité inconnu.");
}

/**
 * Analyse un numéro de série (canonique "BB50V1-A01" ou court "A01" / "P01").
 * Retourne null si invalide (format, 00 interdit, ou révision inconnue).
 * @returns {{serial:string, revision:string, type:string, unitNumber:number, unitCode:string}|null}
 */
function parseSerial(input) {
    if (typeof input !== "string") return null;
    const clean = input.trim().toUpperCase();
    if (clean.length > 20 || clean.length < 3) return null;

    // 1. Format canonique complet : BB50V1-P01 ou BB50V1-A01
    const m = SERIAL_REGEX.exec(clean);
    if (m) {
        const revision = m[1];
        if (!HW_REVISIONS.includes(revision)) return null;

        if (m[2]) {
            // Prototype : P01 à P10
            if (revision !== PROTOTYPE_REVISION) return null;
            const num = parseInt(m[2], 10);
            return {
                serial: clean,
                revision,
                type: UNIT_TYPES.PROTOTYPE,
                unitNumber: num,
                unitCode: `P${pad(num, 2)}`
            };
        }

        // Série : A01 à Z99 (00 exclu)
        const code = m[3];
        const num = seriesCodeToUnitNumber(code);
        if (num === null) return null;
        return {
            serial: clean,
            revision,
            type: UNIT_TYPES.SERIES,
            unitNumber: num,
            unitCode: code
        };
    }

    // 2. Format court direct : "A01", "B05", "P01"
    const sm = SHORT_CODE_REGEX.exec(clean);
    if (sm) {
        if (sm[1]) {
            const num = parseInt(sm[1], 10);
            return {
                serial: `${SERIAL_PREFIX}V1-P${pad(num, 2)}`,
                revision: "V1",
                type: UNIT_TYPES.PROTOTYPE,
                unitNumber: num,
                unitCode: `P${pad(num, 2)}`
            };
        }
        const code = sm[2];
        const num = seriesCodeToUnitNumber(code);
        if (num === null) return null;
        return {
            serial: `${SERIAL_PREFIX}V1-${code}`,
            revision: "V1",
            type: UNIT_TYPES.SERIES,
            unitNumber: num,
            unitCode: code
        };
    }

    return null;
}

function isValidSerial(input) {
    return parseSerial(input) !== null;
}

// ─── Code Bluetooth Unique (BLE Passkey / PIN) ──────────────────────────────

/**
 * Génère un code Bluetooth unique et sécurisé (passkey 6 chiffres, 100000..999999).
 * Correspond au static passkey requis par l'ESP32 dans blackbox_ble.ino.
 * @returns {string} 6 chiffres
 */
function generateBluetoothPasskey() {
    return String(crypto.randomInt(100000, 1000000));
}

/**
 * Valide un code Bluetooth (6 chiffres décimaux).
 * @param {string} code
 * @returns {boolean}
 */
function isValidBluetoothPasskey(code) {
    return typeof code === "string" && /^\d{6}$/.test(code.trim());
}

// ─── Machine à états ─────────────────────────────────────────────────────────

function isKnownStatus(status) {
    return typeof status === "string" && Object.prototype.hasOwnProperty.call(TRANSITIONS, status);
}

function canTransition(from, to) {
    if (!isKnownStatus(from) || !isKnownStatus(to)) return false;
    return TRANSITIONS[from].includes(to);
}

/** Transitions disponibles via l'action générique « changer le statut ». */
function manualTransitions(from) {
    if (!isKnownStatus(from)) return [];
    return TRANSITIONS[from].filter((to) => !ASSIGNMENT_ONLY_TRANSITIONS.includes(`${from}>${to}`));
}

function isAssignmentOnlyTransition(from, to) {
    return ASSIGNMENT_ONLY_TRANSITIONS.includes(`${from}>${to}`);
}

function requiresReason(to) {
    return REASON_REQUIRED_STATUSES.includes(to);
}

// ─── Validation des champs (allowlist) ───────────────────────────────────────

/** Normalise une adresse MAC BLE (AA:BB:CC:DD:EE:FF). Retourne null si invalide. */
function normalizeMac(input) {
    if (typeof input !== "string") return null;
    const mac = input.trim().toUpperCase().replace(/-/g, ":");
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) return null;
    if (mac === "00:00:00:00:00:00" || mac === "FF:FF:FF:FF:FF:FF") return null;
    return mac;
}

function isValidFirmwareVersion(input) {
    return typeof input === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}(-[A-Za-z0-9.]{1,20})?$/.test(input.trim());
}

/** N° de lot Francelog : majuscules, chiffres, tirets (2 à 32 caractères). */
function normalizeBatchNumber(input) {
    if (typeof input !== "string") return null;
    const v = input.trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(v) ? v : null;
}

/** Date ISO AAAA-MM-JJ, entre 2024-01-01 et aujourd'hui + 1 an. */
function parseIsoDate(input, now = new Date()) {
    if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
    const d = new Date(input + "T00:00:00.000Z");
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input) return null;
    const min = Date.UTC(2024, 0, 1);
    const max = now.getTime() + 365 * 24 * 3600 * 1000;
    if (d.getTime() < min || d.getTime() > max) return null;
    return d;
}

/** Texte libre : suppression des caractères de contrôle, trim, longueur max. */
function sanitizeText(input, maxLen) {
    if (input === undefined || input === null) return "";
    if (typeof input !== "string") return null;
    // eslint-disable-next-line no-control-regex
    const cleaned = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (cleaned.length > maxLen) return null;
    return cleaned;
}

// ─── Garantie ────────────────────────────────────────────────────────────────

/**
 * Prototypes : garantie à vie (offre de lancement).
 * Série : garantie légale de conformité 2 ans (C. conso. art. L217-3) à compter de la remise.
 */
function computeWarranty(unitType, lifetimeOffer, startDate) {
    if (unitType === UNIT_TYPES.PROTOTYPE || lifetimeOffer === true) {
        return { warrantyType: WARRANTY_TYPES.LIFETIME, warrantyEndsAt: null };
    }
    const end = new Date(startDate.getTime());
    end.setUTCFullYear(end.getUTCFullYear() + 2);
    return { warrantyType: WARRANTY_TYPES.LEGAL_2Y, warrantyEndsAt: end };
}

// ─── Boutique ────────────────────────────────────────────────────────────────

/**
 * Calcule le contenu et le prix d'une commande à partir de l'état serveur.
 * @param {"UNIT"|"DUO"} product
 * @param {number} prototypeOffersTaken  offres prototype déjà réservées ou payées
 */
function computeShopOrder(product, prototypeOffersTaken) {
    if (!SHOP_PRODUCTS.includes(product)) throw new Error("Produit inconnu.");
    const taken = Number.isInteger(prototypeOffersTaken) && prototypeOffersTaken > 0 ? prototypeOffersTaken : 0;
    if (product === "DUO") {
        return { product, quantity: 2, amountCents: SHOP_PRICES_CENTS.DUO, unitType: UNIT_TYPES.SERIES, prototypeOffer: false, lifetimeWarranty: false };
    }
    if (taken < MAX_PROTOTYPES) {
        return { product, quantity: 1, amountCents: SHOP_PRICES_CENTS.PROTOTYPE_OFFER, unitType: UNIT_TYPES.PROTOTYPE, prototypeOffer: true, lifetimeWarranty: true };
    }
    return { product, quantity: 1, amountCents: SHOP_PRICES_CENTS.UNIT, unitType: UNIT_TYPES.SERIES, prototypeOffer: false, lifetimeWarranty: false };
}

/** UID tronqué pour les journaux (RGPD : jamais d'UID complet ni de PII dans les logs). */
function shortUid(uid) {
    return typeof uid === "string" && uid.length > 0 ? uid.substring(0, 6) + "…" : "anon";
}

module.exports = {
    SERIAL_PREFIX, HW_REVISIONS, PROTOTYPE_REVISION, MAX_PROTOTYPES,
    SERIES_MAX, SERIES_BATCH_MAX, SERIES_LETTERS, UNITS_PER_LETTER,
    SERIAL_REGEX, SHORT_CODE_REGEX,
    UNIT_TYPES, DEFAULT_MANUFACTURER, DEFAULT_MANUFACTURING_SITE,
    PARTNER_SERIES_STATUS, PARTNER_PROTOTYPE_STATUS, DELIVERY_GUARANTEE,
    STATUSES, STATUS_LABELS, TRANSITIONS, ASSIGNMENT_ONLY_TRANSITIONS, REASON_REQUIRED_STATUSES, INITIAL_STATUSES,
    WARRANTY_TYPES, SHOP_PRODUCTS, SHOP_PRICES_CENTS, PROTOTYPE_RESERVATION_MINUTES,
    unitNumberToSeriesCode, seriesCodeToUnitNumber,
    formatSerial, parseSerial, isValidSerial,
    generateBluetoothPasskey, isValidBluetoothPasskey,
    isKnownStatus, canTransition, manualTransitions, isAssignmentOnlyTransition, requiresReason,
    normalizeMac, isValidFirmwareVersion, normalizeBatchNumber, parseIsoDate, sanitizeText,
    computeWarranty, computeShopOrder, shortUid,
};
