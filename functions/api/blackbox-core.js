/**
 * BLACK BOX — LOGIQUE MÉTIER PURE & CRYPTOGRAPHIE PROBANTE (sans dépendance Firebase)
 * ─────────────────────────────────────────────────────────────────────────────
 * Source de vérité serveur pour :
 *  - le format des numéros de série :
 *      * Prototypes : BB50V1-P01 à BB50V1-P10 (lettre P réservée aux 10 prototypes)
 *      * Série commerciale : débute à A01 (BB50V1-A01...A99, B01...B99, BB50V2-A01...)
 *      * Le 00 est STRICTEMENT EXCLU de la numérotation (A00, B00, P00 interdits)
 *  - le code Bluetooth unique (PIN 6 chiffres / passkey BLE sécurisé)
 *  - la machine à états du cycle de vie d'un boîtier (fabrication, QA, stock, vente)
 *  - la validation positive (allowlist) des champs saisis par l'admin
 *  - la tarification de la boutique (calculée serveur, jamais client)
 *  - la garantie de livraison (< 24h) et le partenariat Francelog S.A. (Linselles)
 *  - la chaîne de confiance cryptographique (Réf. EXP-BB50-2026-REV3) :
 *      * Chaînage de hachage de Merkle SHA-256 anti-troncature (ISO/IEC 27037)
 *      * Vérification de signature asymétrique matérielle ECDSA P-256 (eIDAS / Art. 1366 C. Civ.)
 *      * Filtrage de la fenêtre d'incident RGPD (±30 secondes autour de l'impact)
 *
 * ⚠️ Miroir client : src/js/blackbox-core.js
 *    La parité des deux fichiers est vérifiée par tests/blackbox-core.test.js.
 *
 * Conformité : OWASP ASVS v5.0.0-2.2.1 (validation allowlist), v5.0.0-2.3.3, v5.0.0-11.x.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const crypto = require("crypto");

// ─── Numérotation ────────────────────────────────────────────────────────────
const SERIAL_PREFIX = "BB50";
const HW_REVISIONS = ["V1", "V2"]; // V1 (Prototypes & Série initiale) + V2 (PCB Automotive ISO 7637-2 / LiFePO4)
const PROTOTYPE_REVISION = "V1"; // La lettre P est réservée aux 10 prototypes V1
const MAX_PROTOTYPES = 10;
const SERIES_BATCH_MAX = 100; // Plafond par appel (anti-DoS / limite transaction Firestore)

// Lettres autorisées pour la production en série (P est exclu car réservé aux 10 prototypes)
const SERIES_LETTERS = "ABCDEFGHIJKLMNOQRSTUVWXYZ"; // 25 lettres
const UNITS_PER_LETTER = 99; // 01 à 99 (le 00 est exclu)
const SERIES_MAX = SERIES_LETTERS.length * UNITS_PER_LETTER; // 2475 unités pour série à 1 lettre

// Regex de validation :
// - Prototypes : BB50V1-P01 à BB50V1-P10
// - Série commerciale : BB50V1-A01 à BB50V2-Z99 (ou AA01..ZZ99), 00 strictement exclu !
const SERIAL_REGEX = /^BB50(V[1-9])-(?:P(0[1-9]|10)|([A-Z]{1,2}(?:0[1-9]|[1-9][0-9])))$/;
const SHORT_CODE_REGEX = /^(?:P(0[1-9]|10)|([A-Z]{1,2}(?:0[1-9]|[1-9][0-9])))$/;

const UNIT_TYPES = Object.freeze({ PROTOTYPE: "PROTOTYPE", SERIES: "SERIES" });

// ─── Fabrication & Partenaire ────────────────────────────────────────────────
const DEFAULT_MANUFACTURER = "Francelog S.A.";
const DEFAULT_MANUFACTURING_SITE = "Linselles (59)";
const PARTNER_SERIES_STATUS = "En attente validation Francelog pour production en série";
const PARTNER_PROTOTYPE_STATUS = "Validé (10 prototypes V1)";
const DELIVERY_GUARANTEE = "Moins de 24h garantie";

// ─── Paramètres Forensiques & RGPD (EXP-BB50-2026-REV3) ──────────────────────
const CRASH_WINDOW_SECONDS = 30; // RGPD Art. 5 : ±30 secondes autour de l'impact
const P256_SPKI_PREFIX_HEX = "3059301306072a8648ce3d020106082a8648ce3d030107034200";

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
 * @param {string} revision  ex. "V1" ou "V2"
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

    // 1. Format canonique complet : BB50V1-P01 ou BB50V1-A01 / BB50V2-A01
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
 * Correspond au code d'appairage lu par le firmware (NVS « storage », clé ble_pin).
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

// ─── Forensique : Chaînage de Merkle SHA-256 & ECDSA P-256 (EXP-BB50-2026-REV3) ──

/**
 * Calcule un maillon de la chaîne de hachage de Merkle :
 * Hash_N = SHA-256(Hash_{N-1} || Frame_N)
 * @param {string|Buffer} prevHashHex Empreinte précédente (64 caractères hex = 32 octets)
 * @param {string|Buffer} framePayload Contenu de la trame (JSON string, Buffer ou base64)
 * @returns {string} Empreinte SHA-256 résultante en hexadécimal (64 caractères)
 */
function computeMerkleStep(prevHashHex, framePayload) {
    let prevBuf;
    if (Buffer.isBuffer(prevHashHex)) {
        prevBuf = prevHashHex;
    } else if (typeof prevHashHex === "string" && /^[0-9a-fA-F]{64}$/.test(prevHashHex.trim())) {
        prevBuf = Buffer.from(prevHashHex.trim(), "hex");
    } else {
        throw new Error("prevHashHex invalide (doit être un hash SHA-256 de 32 octets / 64 hex).");
    }

    let payloadBuf;
    if (Buffer.isBuffer(framePayload)) {
        payloadBuf = framePayload;
    } else if (typeof framePayload === "string") {
        payloadBuf = Buffer.from(framePayload, "utf8");
    } else {
        throw new Error("framePayload invalide.");
    }

    return crypto.createHash("sha256").update(prevBuf).update(payloadBuf).digest("hex");
}

/**
 * Vérifie l'intégrité d'une séquence de trames liées par chaîne de Merkle et seqId monotone.
 * Détecte toute suppression, insertion ou réordonnancement sélectif de trames (ISO/IEC 27037).
 * @param {Array<{seqId:number, prevHashHex?:string, payload:string|Buffer}>} frames
 * @param {string} initialSeedHex Hash initial attendu pour la première trame (64 caractères hex)
 * @returns {{valid:boolean, checkedCount:number, finalHashHex:string|null, brokenAtIndex:number|null, reason:string|null}}
 */
function verifyMerkleChain(frames, initialSeedHex) {
    if (!Array.isArray(frames) || frames.length === 0) {
        return { valid: false, checkedCount: 0, finalHashHex: null, brokenAtIndex: 0, reason: "Séquence de trames vide." };
    }
    if (typeof initialSeedHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(initialSeedHex.trim())) {
        return { valid: false, checkedCount: 0, finalHashHex: null, brokenAtIndex: 0, reason: "Graine initiale SHA-256 invalide." };
    }

    let runningHashHex = initialSeedHex.trim().toLowerCase();

    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        if (!frame || typeof frame !== "object") {
            return { valid: false, checkedCount: i, finalHashHex: null, brokenAtIndex: i, reason: "Trame malformée." };
        }

        // Vérification de la monotonie stricte de seqId
        if (i > 0 && Number.isInteger(frame.seqId) && Number.isInteger(frames[i - 1].seqId)) {
            if (frame.seqId !== frames[i - 1].seqId + 1) {
                return {
                    valid: false,
                    checkedCount: i,
                    finalHashHex: null,
                    brokenAtIndex: i,
                    reason: `Rupture de séquence détectée à l'index ${i} (attendu seqId=${frames[i - 1].seqId + 1}, reçu=${frame.seqId}).`
                };
            }
        }

        // Vérification du pointeur prevHashHex (supporte 64 chars complets ou 32 chars tronqués 128 bits)
        if (typeof frame.prevHashHex === "string" && frame.prevHashHex.length > 0) {
            const cleanPrev = frame.prevHashHex.trim().toLowerCase();
            const expectedPrefix = runningHashHex.slice(0, cleanPrev.length);
            if (cleanPrev !== expectedPrefix) {
                return {
                    valid: false,
                    checkedCount: i,
                    finalHashHex: null,
                    brokenAtIndex: i,
                    reason: `Rupture de chaîne de Merkle à l'index ${i} (prevHash=${cleanPrev} != attendu=${expectedPrefix}).`
                };
            }
        }

        const rawPayload = frame.payload !== undefined ? frame.payload : (frame.encryptedPayload || "");
        runningHashHex = computeMerkleStep(runningHashHex, rawPayload);
    }

    return {
        valid: true,
        checkedCount: frames.length,
        finalHashHex: runningHashHex,
        brokenAtIndex: null,
        reason: null
    };
}

/**
 * Valide le format d'une clé publique ECDSA P-256 (secp256r1) :
 * - Format non-compressé SEC1 hex : 65 octets ("04" + 128 caractères hex)
 * - Format PEM : "-----BEGIN PUBLIC KEY-----..."
 * @param {string} pubKeyInput
 * @returns {boolean}
 */
function isValidEcdsaPublicKey(pubKeyInput) {
    if (typeof pubKeyInput !== "string") return false;
    const clean = pubKeyInput.trim();
    if (/^04[0-9a-fA-F]{128}$/.test(clean)) return true;
    if (clean.startsWith("-----BEGIN PUBLIC KEY-----") && clean.endsWith("-----END PUBLIC KEY-----")) {
        try {
            const keyObj = crypto.createPublicKey(clean);
            return keyObj.asymmetricKeyType === "ec";
        } catch (_) {
            return false;
        }
    }
    return false;
}

/**
 * Vérifie une signature asymétrique matérielle ECDSA P-256 (secp256r1 / SHA-256).
 * Compatible avec les signatures DER générées par mbedtls sur ESP32-C3.
 * @param {string|Buffer} payload Data signée (ex: hardware_id ou racine de Merkle)
 * @param {string|Buffer} signatureDerHexOrB64 Signature au format DER (hex ou base64)
 * @param {string} publicKeyHexOrPem Clé publique ECDSA P-256 (65B SEC1 hex "04..." ou PEM)
 * @returns {boolean}
 */
function verifyEcdsaP256Signature(payload, signatureDerHexOrB64, publicKeyHexOrPem) {
    if (!payload || !signatureDerHexOrB64 || !isValidEcdsaPublicKey(publicKeyHexOrPem)) {
        return false;
    }

    try {
        let keyObject;
        const cleanPub = publicKeyHexOrPem.trim();
        if (/^04[0-9a-fA-F]{128}$/.test(cleanPub)) {
            const spkiDer = Buffer.from(P256_SPKI_PREFIX_HEX + cleanPub, "hex");
            keyObject = crypto.createPublicKey({ key: spkiDer, format: "der", type: "spki" });
        } else {
            keyObject = crypto.createPublicKey(cleanPub);
        }

        let sigBuf;
        if (Buffer.isBuffer(signatureDerHexOrB64)) {
            sigBuf = signatureDerHexOrB64;
        } else if (typeof signatureDerHexOrB64 === "string") {
            const cleanSig = signatureDerHexOrB64.trim();
            if (/^[0-9a-fA-F]+$/.test(cleanSig) && cleanSig.length % 2 === 0) {
                sigBuf = Buffer.from(cleanSig, "hex");
            } else {
                sigBuf = Buffer.from(cleanSig, "base64");
            }
        } else {
            return false;
        }

        const dataBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
        return crypto.verify("sha256", dataBuf, keyObject, sigBuf);
    } catch (_) {
        return false;
    }
}

/**
 * Filtre les trames télémétriques pour ne conserver que la fenêtre légale d'incident
 * [impactTimestampSec - windowSeconds, impactTimestampSec + windowSeconds] (par défaut ±30s).
 * Conformité RGPD Art. 5 (minimisation des données) & protection contre l'auto-incrimination.
 * @param {Array<{timestamp:number}>} frames
 * @param {number} impactTimestampSec Horodatage UTC de l'impact en secondes
 * @param {number} [windowSeconds=30] Demi-fenêtre temporelle en secondes
 * @returns {Array} Trames comprises dans la fenêtre [t0 - 30s, t0 + 30s]
 */
function filterCrashWindowFrames(frames, impactTimestampSec, windowSeconds = CRASH_WINDOW_SECONDS) {
    if (!Array.isArray(frames)) return [];
    if (typeof impactTimestampSec !== "number" || !Number.isFinite(impactTimestampSec) || impactTimestampSec <= 0) {
        throw new Error("Horodatage d'impact invalide pour le filtrage de la fenêtre probante.");
    }
    const halfWin = typeof windowSeconds === "number" && windowSeconds > 0 && windowSeconds <= 60 ? windowSeconds : CRASH_WINDOW_SECONDS;
    const minTs = impactTimestampSec - halfWin;
    const maxTs = impactTimestampSec + halfWin;

    return frames.filter((f) => f && typeof f.timestamp === "number" && f.timestamp >= minTs && f.timestamp <= maxTs);
}

/**
 * Prochain numéro de série libre pour une révision et un type, d'après les numéros déjà
 * attribués (mise en service en usine : le serveur numérote, jamais l'usine).
 * Prototypes : P01 à P10 en V1 uniquement, puis refus. Série : A01, A02… (P et 00 exclus).
 * @param {string[]} existingSerials numéros déjà enregistrés (toutes révisions)
 * @param {string} revision "V1" | "V2"
 * @param {"PROTOTYPE"|"SERIES"} type
 */
function nextSerial(existingSerials, revision, type) {
    let max = 0;
    for (const s of existingSerials || []) {
        const p = parseSerial(s);
        if (p && p.revision === revision && p.type === type && p.unitNumber > max) max = p.unitNumber;
    }
    if (type === UNIT_TYPES.PROTOTYPE && max >= MAX_PROTOTYPES) {
        throw new Error(`Les ${MAX_PROTOTYPES} prototypes (P01 à P${pad(MAX_PROTOTYPES, 2)}) sont déjà attribués.`);
    }
    return formatSerial(revision, type, max + 1);
}

/**
 * Décode une trame brute du boîtier (blackbox_frame_t, 64 octets little-endian,
 * hardware/firmware/components/blackbox/blackbox_storage.h). C'est ces 64 octets
 * exacts que le firmware chaîne : Hash_N = SHA-256(Hash_{N-1} || trame).
 * @param {string} rawHex 128 caractères hexadécimaux
 */
function decodeRawFrame(rawHex) {
    if (typeof rawHex !== "string" || !/^[0-9a-fA-F]{128}$/.test(rawHex)) {
        throw new Error("Trame brute invalide (64 octets en hexadécimal attendus).");
    }
    const b = Buffer.from(rawHex, "hex");
    const ts = b.readUInt32LE(0);
    const ms = b.readUInt16LE(29);
    return {
        seqId: b.readUInt32LE(25),
        timestamp: ts + Math.min(ms, 999) / 1000,
        timestampUtc: ts,
        timestampMs: ms,
        latitude: b.readInt32LE(4) / 1e7,
        longitude: b.readInt32LE(8) / 1e7,
        speedKmh: b.readUInt16LE(12) / 10,
        headingDeg: b.readUInt16LE(14),
        satellites: b.readUInt8(16),
        hdop: b.readUInt8(17) / 10,
        batteryMv: b.readUInt16LE(18),
        tamperState: b.readUInt8(20),
        flags: b.readUInt8(21),
        isShockFrame: (b.readUInt8(21) & 0x04) !== 0,
        gForce: b.readUInt16LE(22) / 10,
        leanAngleDeg: b.readUInt8(24),
        accelMg: { x: b.readInt16LE(31), y: b.readInt16LE(33), z: b.readInt16LE(35) },
        prevHashHex: b.subarray(37, 53).toString("hex"),
        payload: b
    };
}

/**
 * Trames reçues → trames vérifiables. Une trame `{ raw: "<128 hex>" }` est décodée
 * à partir des octets du boîtier (les champs envoyés à côté par l'appli sont ignorés).
 * Les autres formes sont laissées telles quelles (anciens envois, tests).
 */
function normalizeTelemetryFrames(frames) {
    if (!Array.isArray(frames)) return [];
    return frames.map((f) => (f && typeof f.raw === "string" ? decodeRawFrame(f.raw) : f));
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
    CRASH_WINDOW_SECONDS,
    decodeRawFrame, normalizeTelemetryFrames, nextSerial,
    STATUSES, STATUS_LABELS, TRANSITIONS, ASSIGNMENT_ONLY_TRANSITIONS, REASON_REQUIRED_STATUSES, INITIAL_STATUSES,
    WARRANTY_TYPES, SHOP_PRODUCTS, SHOP_PRICES_CENTS, PROTOTYPE_RESERVATION_MINUTES,
    unitNumberToSeriesCode, seriesCodeToUnitNumber,
    formatSerial, parseSerial, isValidSerial,
    generateBluetoothPasskey, isValidBluetoothPasskey,
    isKnownStatus, canTransition, manualTransitions, isAssignmentOnlyTransition, requiresReason,
    normalizeMac, isValidFirmwareVersion, normalizeBatchNumber, parseIsoDate, sanitizeText,
    computeWarranty, computeShopOrder,
    computeMerkleStep, verifyMerkleChain, isValidEcdsaPublicKey, verifyEcdsaP256Signature, filterCrashWindowFrames,
    shortUid,
};
