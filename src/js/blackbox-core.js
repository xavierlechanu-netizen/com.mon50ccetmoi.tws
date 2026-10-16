/**
 * BLACK BOX — LOGIQUE MÉTIER CLIENT (ESM)
 * ─────────────────────────────────────────────────────────────────────────────
 * Miroir client de functions/api/blackbox-core.js.
 * Utilisé pour :
 *  - les contrôles de saisie avant soumission (UI réactive)
 *  - l'affichage des libellés et badges de statut
 *  - la prévisualisation des numéros de série (A01..Z99, 00 exclu)
 *  - la génération / validation des codes Bluetooth uniques (PIN 6 chiffres)
 *  - la détection des transitions de statut valides dans la console admin
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SERIAL_PREFIX = "BB50";
export const HW_REVISIONS = ["V1"];
export const PROTOTYPE_REVISION = "V1";
export const MAX_PROTOTYPES = 10;
export const SERIES_BATCH_MAX = 100;

export const SERIES_LETTERS = "ABCDEFGHIJKLMNOQRSTUVWXYZ"; // 25 lettres (P réservé aux 10 prototypes)
export const UNITS_PER_LETTER = 99; // 01 à 99 (00 strictement exclu)
export const SERIES_MAX = SERIES_LETTERS.length * UNITS_PER_LETTER; // 2475

export const SERIAL_REGEX = /^BB50(V[1-9])-(?:P(0[1-9]|10)|([A-Z]{1,2}(?:0[1-9]|[1-9][0-9])))$/;
export const SHORT_CODE_REGEX = /^(?:P(0[1-9]|10)|([A-Z]{1,2}(?:0[1-9]|[1-9][0-9])))$/;

export const UNIT_TYPES = Object.freeze({
    PROTOTYPE: "PROTOTYPE",
    SERIES: "SERIES"
});

export const DEFAULT_MANUFACTURER = "Francelog S.A.";
export const DEFAULT_MANUFACTURING_SITE = "Linselles (59)";
export const PARTNER_SERIES_STATUS = "En attente validation Francelog pour production en série";
export const PARTNER_PROTOTYPE_STATUS = "Validé (10 prototypes V1)";
export const DELIVERY_GUARANTEE = "Moins de 24h garantie";

export const STATUSES = Object.freeze({
    MANUFACTURING: "MANUFACTURING",
    QA: "QA",
    IN_STOCK: "IN_STOCK",
    SOLD: "SOLD",
    ACTIVE: "ACTIVE",
    RMA: "RMA",
    STOLEN: "STOLEN",
    DECOMMISSIONED: "DECOMMISSIONED"
});

export const STATUS_LABELS = Object.freeze({
    MANUFACTURING: "En fabrication",
    QA: "Contrôle qualité",
    IN_STOCK: "En stock",
    SOLD: "Vendu",
    ACTIVE: "Activé",
    RMA: "SAV / Retour",
    STOLEN: "Volé / Perdu",
    DECOMMISSIONED: "Mis au rebut"
});

export const STATUS_BADGES = Object.freeze({
    MANUFACTURING: { color: "#ffb700", bg: "rgba(255, 183, 0, 0.15)", icon: "fa-industry" },
    QA: { color: "#00f2ff", bg: "rgba(0, 242, 255, 0.15)", icon: "fa-microchip" },
    IN_STOCK: { color: "#00ff88", bg: "rgba(0, 255, 136, 0.15)", icon: "fa-boxes-stacked" },
    SOLD: { color: "#8a2be2", bg: "rgba(138, 43, 226, 0.15)", icon: "fa-tag" },
    ACTIVE: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)", icon: "fa-circle-check" },
    RMA: { color: "#f97316", bg: "rgba(249, 115, 22, 0.15)", icon: "fa-wrench" },
    STOLEN: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", icon: "fa-shield-halved" },
    DECOMMISSIONED: { color: "#64748b", bg: "rgba(100, 116, 139, 0.15)", icon: "fa-ban" }
});

export const TRANSITIONS = Object.freeze({
    MANUFACTURING: ["QA", "DECOMMISSIONED"],
    QA: ["IN_STOCK", "MANUFACTURING", "DECOMMISSIONED"],
    IN_STOCK: ["SOLD", "QA", "DECOMMISSIONED"],
    SOLD: ["ACTIVE", "IN_STOCK", "RMA"],
    ACTIVE: ["RMA", "STOLEN"],
    RMA: ["ACTIVE", "IN_STOCK", "DECOMMISSIONED"],
    STOLEN: ["ACTIVE", "DECOMMISSIONED"],
    DECOMMISSIONED: []
});

export const ASSIGNMENT_ONLY_TRANSITIONS = Object.freeze(["IN_STOCK>SOLD", "SOLD>IN_STOCK"]);
export const REASON_REQUIRED_STATUSES = Object.freeze(["RMA", "STOLEN", "DECOMMISSIONED"]);

export const WARRANTY_TYPES = Object.freeze({
    LIFETIME: "LIFETIME",
    LEGAL_2Y: "LEGAL_2Y"
});

function pad(num, size) {
    let s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
}

export function unitNumberToSeriesCode(unitNumber) {
    if (!Number.isInteger(unitNumber) || unitNumber < 1) {
        throw new Error("Numéro d'unité invalide (doit être un entier >= 1).");
    }
    const zeroBased = unitNumber - 1;
    const letterIdx = Math.floor(zeroBased / UNITS_PER_LETTER);
    const numInLetter = (zeroBased % UNITS_PER_LETTER) + 1;
    const numPart = pad(numInLetter, 2);

    if (letterIdx < SERIES_LETTERS.length) {
        return `${SERIES_LETTERS[letterIdx]}${numPart}`;
    }

    const l1 = Math.floor(letterIdx / SERIES_LETTERS.length) - 1;
    const l2 = letterIdx % SERIES_LETTERS.length;
    if (l1 >= 0 && l1 < SERIES_LETTERS.length) {
        return `${SERIES_LETTERS[l1]}${SERIES_LETTERS[l2]}${numPart}`;
    }
    throw new Error("Capacité maximale de numérotation de série atteinte.");
}

export function seriesCodeToUnitNumber(code) {
    if (typeof code !== "string") return null;
    const clean = code.trim().toUpperCase();
    const m = /^([A-Z]{1,2})(0[1-9]|[1-9][0-9])$/.exec(clean);
    if (!m) return null; // Rejette 00
    const letters = m[1];
    const numInLetter = parseInt(m[2], 10);
    if (numInLetter < 1 || numInLetter > UNITS_PER_LETTER) return null;

    if (letters === "P") return null; // Réservé prototypes

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

export function formatSerial(revision, type, unitNumber) {
    if (!HW_REVISIONS.includes(revision)) throw new Error("Révision inconnue.");

    if (type === UNIT_TYPES.PROTOTYPE) {
        const num = typeof unitNumber === "string" ? parseInt(unitNumber.replace(/^P/i, ""), 10) : unitNumber;
        if (!Number.isInteger(num)) throw new Error("Numéro d'unité invalide.");
        if (revision !== PROTOTYPE_REVISION) throw new Error("Prototypes en " + PROTOTYPE_REVISION + " uniquement.");
        if (num < 1 || num > MAX_PROTOTYPES) throw new Error("Prototypes limités à 1..10. Le 00 est exclu.");
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

    throw new Error("Type invalide.");
}

export function parseSerial(input) {
    if (typeof input !== "string") return null;
    const clean = input.trim().toUpperCase();
    if (clean.length > 20 || clean.length < 3) return null;

    const m = SERIAL_REGEX.exec(clean);
    if (m) {
        const revision = m[1];
        if (!HW_REVISIONS.includes(revision)) return null;

        if (m[2]) {
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

export function isValidSerial(input) {
    return parseSerial(input) !== null;
}

export function generateBluetoothPasskey() {
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        return String(100000 + (array[0] % 900000));
    }
    return String(Math.floor(100000 + Math.random() * 900000));
}

export function isValidBluetoothPasskey(code) {
    return typeof code === "string" && /^\d{6}$/.test(code.trim());
}

export function canTransition(from, to) {
    if (!TRANSITIONS[from]) return false;
    return TRANSITIONS[from].includes(to);
}

export function manualTransitions(from) {
    if (!TRANSITIONS[from]) return [];
    return TRANSITIONS[from].filter((to) => !ASSIGNMENT_ONLY_TRANSITIONS.includes(`${from}>${to}`));
}

export function normalizeMac(input) {
    if (typeof input !== "string") return null;
    const mac = input.trim().toUpperCase().replace(/-/g, ":");
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) return null;
    if (mac === "00:00:00:00:00:00" || mac === "FF:FF:FF:FF:FF:FF") return null;
    return mac;
}

export function isValidFirmwareVersion(input) {
    return typeof input === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}(-[A-Za-z0-9.]{1,20})?$/.test(input.trim());
}

export function normalizeBatchNumber(input) {
    if (typeof input !== "string") return null;
    const v = input.trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(v) ? v : null;
}

export function escapeCSVCell(str) {
    if (str === null || str === undefined) return '""';
    let s = String(str);
    // Protection injection CSV (OWASP) : préfixer d'une apostrophe si commence par = + - @
    if (/^[=+\-@\t\r]/.test(s)) {
        s = "'" + s;
    }
    return '"' + s.replace(/"/g, '""') + '"';
}
