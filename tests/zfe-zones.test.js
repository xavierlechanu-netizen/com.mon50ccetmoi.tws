/**
 * Alerte à l'entrée d'une ZFE : src/js/zfe-zones.js et src/public/data/zfe.geojson.
 */
const fs = require("fs");
const path = require("path");

const JS = path.resolve(__dirname, "../src/js");
const strip = (file) =>
  fs.readFileSync(path.join(JS, file), "utf8").replace(/^import [\s\S]*?;$/gm, "").replace(/^export (const|function) /gm, "$1 ");

function loadModule({ speak = () => {}, vibrate = () => {}, fetchImpl } = {}) {
  const critAir = new Function(`${strip("crit-air.js")}\nreturn { critAirBadge, NON_CLASSE };`)();
  return new Function(
    "speak",
    "vibrate",
    "critAirBadge",
    "NON_CLASSE",
    "fetch",
    `${strip("zfe-zones.js")}\nreturn { pointInRing, pointInPolygon, pointInGeometry, isZoneActive, findZfe, bboxOf, zfeAlertMessage, checkZfeEntry };`,
  )(speak, vibrate, critAir.critAirBadge, critAir.NON_CLASSE, fetchImpl);
}

const M = loadModule();
const DATA = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/public/data/zfe.geojson"), "utf8"));

// Carré 0..10 avec un trou 4..6
const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];

describe("Point dans polygone", () => {
  test("dedans, dehors", () => {
    expect(M.pointInRing(5, 5, square)).toBe(true);
    expect(M.pointInRing(11, 5, square)).toBe(false);
    expect(M.pointInRing(-0.1, 5, square)).toBe(false);
  });
  test("le trou n'est pas dans la zone", () => {
    expect(M.pointInPolygon(5, 5, [square, hole])).toBe(false);
    expect(M.pointInPolygon(2, 2, [square, hole])).toBe(true);
  });
  test("polygone concave (en U)", () => {
    const u = [[0, 0], [9, 0], [9, 9], [6, 9], [6, 3], [3, 3], [3, 9], [0, 9], [0, 0]];
    expect(M.pointInRing(4.5, 6, u)).toBe(false); // dans le creux du U
    expect(M.pointInRing(1, 6, u)).toBe(true);
    expect(M.pointInRing(7, 6, u)).toBe(true);
  });
  test("MultiPolygon et géométries invalides", () => {
    const g = { type: "MultiPolygon", coordinates: [[square], [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]] };
    expect(M.pointInGeometry(25, 25, g)).toBe(true);
    expect(M.pointInGeometry(15, 15, g)).toBe(false);
    expect(M.pointInGeometry(1, 1, null)).toBe(false);
    expect(M.pointInGeometry(1, 1, { type: "Point", coordinates: [1, 1] })).toBe(false);
    expect(M.pointInPolygon(1, 1, [])).toBe(false);
  });
  test("bbox", () => {
    expect(M.bboxOf({ type: "Polygon", coordinates: [square] })).toEqual([0, 0, 10, 10]);
    expect(M.bboxOf(null)).toBeNull();
  });
});

describe("Dates de mise en vigueur", () => {
  test.each([
    [{ debut: "2025-01-01", fin: null }, "2024-12-31", false],
    [{ debut: "2025-01-01", fin: null }, "2025-01-01", true],
    [{ debut: "2025-01-01", fin: "2026-12-31" }, "2026-12-31", true],
    [{ debut: "2025-01-01", fin: "2026-12-31" }, "2027-01-01", false],
    [{}, "2026-11-16", true],
  ])("%j le %s → %s", (props, day, expected) => {
    expect(M.isZoneActive(props, day)).toBe(expected);
  });
});

describe("Fichier des ZFE (base nationale, transport.data.gouv.fr)", () => {
  test("format GeoJSON, source et licence citées", () => {
    expect(DATA.type).toBe("FeatureCollection");
    expect(DATA.source).toMatch(/transport\.data\.gouv\.fr/);
    expect(DATA.source).toMatch(/ODbL/);
    expect(DATA.features.length).toBeGreaterThan(10);
    for (const f of DATA.features) {
      expect(typeof f.properties.nom).toBe("string");
      expect(["Polygon", "MultiPolygon"]).toContain(f.geometry.type);
    }
  });
  test("fichier léger (moins de 150 Ko)", () => {
    expect(fs.statSync(path.resolve(__dirname, "../src/public/data/zfe.geojson")).size).toBeLessThan(150 * 1024);
  });
  test.each([
    ["Lyon, place Bellecour", 45.7578, 4.8320, "Métropole de Lyon"],
    ["Paris, Hôtel de Ville", 48.8566, 2.3522, "Ville de Paris"],
    ["Toulouse, Capitole", 43.6045, 1.4440, "Toulouse Métropole"],
    ["Grenoble, centre", 45.1885, 5.7245, "Grenoble Alpes métropole"],
  ])("%s → %s", (_, lat, lng, nom) => {
    expect(M.findZfe(DATA.features, lat, lng, "2026-11-16")).toBe(nom);
  });
  test.each([
    ["campagne du Cher", 46.95, 2.4],
    ["Vierzon", 47.222, 2.068],
  ])("%s : hors ZFE", (_, lat, lng) => {
    expect(M.findZfe(DATA.features, lat, lng, "2026-11-16")).toBeNull();
  });
  test("position invalide : pas de zone", () => {
    expect(M.findZfe(DATA.features, NaN, 2, "2026-11-16")).toBeNull();
    expect(M.findZfe(null, 45, 4, "2026-11-16")).toBeNull();
  });
});

describe("Message d'alerte", () => {
  test("vignette enregistrée", () => {
    expect(M.zfeAlertMessage("Métropole de Lyon", 2)).toBe(
      "Vous entrez dans la zone à faibles émissions : Métropole de Lyon. Votre vignette : Crit'Air 2. Vérifiez qu'elle y est autorisée et bien collée.",
    );
  });
  test("non classé", () => {
    expect(M.zfeAlertMessage("X", "non classé")).toMatch(/non classé : il peut y être interdit/);
  });
  test("pas de vignette renseignée", () => {
    expect(M.zfeAlertMessage("X", null)).toMatch(/peut y être exigée/);
    expect(M.zfeAlertMessage("X", "inconnu")).toMatch(/peut y être exigée/);
  });
  test("jamais d'affirmation « autorisé » ou « interdit » catégorique", () => {
    for (const c of [0, 1, 2, 3, 4, "non classé", null]) {
      expect(M.zfeAlertMessage("X", c)).not.toMatch(/vous êtes (autorisé|interdit)/i);
    }
  });
});

describe("checkZfeEntry pendant la conduite", () => {
  const zoneData = {
    features: [{ type: "Feature", properties: { nom: "Zone test", debut: "2000-01-01", fin: null }, geometry: { type: "Polygon", coordinates: [square] } }],
  };

  test("charge le fichier une fois, alerte à l'entrée, une seule fois, puis se réarme à la sortie", async () => {
    const speak = jest.fn();
    const fetchImpl = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(zoneData) }));
    const mod = loadModule({ speak, fetchImpl });
    document.body.innerHTML = "";

    mod.checkZfeEntry(5, 5); // déclenche le chargement
    mod.checkZfeEntry(5, 5);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/data/zfe.geojson");
    await new Promise((r) => setTimeout(r, 0));

    mod.checkZfeEntry(5, 5);
    mod.checkZfeEntry(5.1, 5.1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toMatch(/Zone test/);
    const toast = document.querySelector(".hazard-toast p");
    expect(toast.textContent).toMatch(/Zone test/);

    mod.checkZfeEntry(50, 50); // une position dehors (GPS qui hésite en bordure) : rien
    mod.checkZfeEntry(5, 5);
    expect(speak).toHaveBeenCalledTimes(1);

    mod.checkZfeEntry(50, 50); // sortie confirmée à la 3e position dehors
    mod.checkZfeEntry(50, 50);
    mod.checkZfeEntry(50, 50);
    mod.checkZfeEntry(50, 50);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith("Vous quittez la zone à faibles émissions.");

    mod.checkZfeEntry(5, 5); // nouvelle entrée
    expect(speak).toHaveBeenCalledTimes(3);
  });

  test("le nom de zone n'est jamais interprété comme du HTML", async () => {
    const evil = { features: [{ ...zoneData.features[0], properties: { nom: "<img src=x onerror=alert(1)>" } }] };
    const fetchImpl = () => Promise.resolve({ ok: true, json: () => Promise.resolve(evil) });
    const mod = loadModule({ fetchImpl });
    document.body.innerHTML = "";
    mod.checkZfeEntry(5, 5);
    await new Promise((r) => setTimeout(r, 0));
    mod.checkZfeEntry(5, 5);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector(".hazard-toast p").textContent).toMatch(/<img/);
  });

  test("fichier inaccessible (hors ligne) : aucune alerte, aucune erreur", async () => {
    const speak = jest.fn();
    const mod = loadModule({ speak, fetchImpl: () => Promise.reject(new Error("offline")) });
    mod.checkZfeEntry(5, 5);
    await new Promise((r) => setTimeout(r, 0));
    expect(() => mod.checkZfeEntry(5, 5)).not.toThrow();
    expect(speak).not.toHaveBeenCalled();
  });
});
