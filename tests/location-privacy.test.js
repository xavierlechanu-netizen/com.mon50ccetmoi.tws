/**
 * @jest-environment node
 *
 * Positions partagées avec la communauté : src/js/location-privacy.js
 */
const fs = require("fs");
const path = require("path");

// Le module est en ESM (navigateur) : on retire les "export" pour l'évaluer ici, comme les autres tests.
function loadModule() {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/js/location-privacy.js"), "utf8")
    .replace(/^export (const|function) /gm, "$1 ");
  const names = ["coarseCoord", "coarsePosition", "recentCutoff", "RECENT_WINDOW_MS", "MAX_SHARED_POSITIONS"];
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn { ${names.join(", ")} };`)();
}

const { coarseCoord, coarsePosition, recentCutoff, RECENT_WINDOW_MS, MAX_SHARED_POSITIONS } = loadModule();

describe("Positions partagées (location-privacy.js)", () => {
  test("arrondit à ~100 m (3 décimales)", () => {
    expect(coarsePosition(50.629251, 3.057256)).toEqual({ lat: 50.629, lng: 3.057 });
    expect(coarsePosition(43.6, -1.23456)).toEqual({ lat: 43.6, lng: -1.235 });
  });

  test("deux positions à 20 m l'une de l'autre deviennent identiques", () => {
    // 0,0002° de latitude ≈ 22 m
    expect(coarsePosition(50.6291, 3.0571)).toEqual(coarsePosition(50.6293, 3.0573));
  });

  test("refuse les positions invalides", () => {
    expect(coarsePosition(null, 3)).toBeNull();
    expect(coarsePosition("abc", 3)).toBeNull();
    expect(coarsePosition(95, 3)).toBeNull();
    expect(coarsePosition(45, 200)).toBeNull();
    expect(coarseCoord(Infinity)).toBeNull();
  });

  test("n'écoute que les positions des 15 dernières minutes, en nombre limité", () => {
    const now = Date.UTC(2026, 10, 7, 12, 0, 0);
    expect(RECENT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(recentCutoff(now).toISOString()).toBe("2026-11-07T11:45:00.000Z");
    expect(MAX_SHARED_POSITIONS).toBeLessThanOrEqual(100);
  });
});
