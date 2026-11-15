/**
 * @jest-environment node
 *
 * Contrat Bluetooth appli ↔ boîtier : les UUID 128 bits construits par l'appli
 * (src/js/blackbox-ble.js) doivent être valides et identiques à ceux du firmware
 * (hardware/firmware/components/ble_comm/ble_comm.c, macro UUID128_50CC).
 */
const fs = require("fs");
const path = require("path");

// Fins de ligne Unix : sous Windows, git extrait les sources en CRLF (core.autocrlf)
const lire = (relatif) => fs.readFileSync(path.join(__dirname, relatif), "utf8").replace(/\r\n/g, "\n");
const app = lire("../src/js/blackbox-ble.js");
const fw = lire("../hardware/firmware/components/ble_comm/ble_comm.c");
const fwHeader = lire("../hardware/firmware/components/ble_comm/ble_comm.h");

const suffix = /baseUuidSuffix\s*=\s*"([^"]+)"/.exec(app)[1];
const appUuid = (shortHex) => `50cc${shortHex}${suffix}`;

/** UUID textuel reconstruit depuis les 16 octets little-endian de la macro du firmware */
function firmwareUuid(id) {
    const macro = /#define UUID128_50CC\(id\) BLE_UUID128_DECLARE\(([\s\S]*?)\)\s*\n/.exec(fw)[1];
    const parts = macro.replace(/\\\n/g, " ").split(",").map((t) => t.trim());
    const bytes = parts.map((t) => {
        if (/\(id\) & 0xFF/.test(t)) return id & 0xff;
        if (/\(id\) >> 8/.test(t)) return id >> 8;
        return parseInt(t, 16);
    });
    expect(bytes).toHaveLength(16);
    const hex = bytes.reverse().map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

describe("Contrat Bluetooth appli ↔ boîtier", () => {
    const ids = [...app.matchAll(/buildUuid\("([0-9a-f]{4})"\)/g)].map((m) => m[1]);

    test("l'appli construit des UUID 128 bits valides (8-4-4-4-12)", () => {
        expect(ids.length).toBeGreaterThanOrEqual(8);
        for (const id of ids) {
            expect(appUuid(id)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        }
    });

    test("chaque UUID de l'appli est exactement celui que déclare le firmware", () => {
        for (const id of ids) {
            const n = parseInt(id, 16);
            expect(fwHeader).toMatch(new RegExp(`#define BLE_UUID_\\w+\\s+0x${id}\\b`, "i"));
            expect(appUuid(id)).toBe(firmwareUuid(n));
        }
    });

    test("le firmware n'utilise plus d'UUID 16 bits réservés pour ses services", () => {
        expect(fw).not.toMatch(/#define (SVC|CHR)_UUID\(id\)\s+BLE_UUID16_DECLARE/);
    });
});
