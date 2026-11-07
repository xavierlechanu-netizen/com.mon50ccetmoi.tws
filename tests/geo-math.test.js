/**
 * @jest-environment node
 *
 * Calculs de conduite partagés : src/js/geo-math.js (étape 5 du plan de dette technique).
 */
const fs = require("fs");
const path = require("path");

const JS = path.resolve(__dirname, "../src/js");

// Le module est en ESM (navigateur) : on retire les "export" pour l'évaluer ici
function loadModule() {
  const src = fs.readFileSync(path.join(JS, "geo-math.js"), "utf8").replace(/^export (const|function) /gm, "$1 ");
  return new Function(`${src}\nreturn { distanceMeters, createSpeedSmoother, isNightHour, vehicleIconFor, EARTH_RADIUS_M };`)();
}

const { distanceMeters, createSpeedSmoother, isNightHour, vehicleIconFor } = loadModule();

describe("distanceMeters", () => {
  test("même point : 0 m", () => {
    expect(distanceMeters(50.6292, 3.0573, 50.6292, 3.0573)).toBe(0);
  });

  test("Lille → Paris : environ 204 km", () => {
    const d = distanceMeters(50.6292, 3.0573, 48.8566, 2.3522);
    expect(d / 1000).toBeGreaterThan(202);
    expect(d / 1000).toBeLessThan(206);
  });

  test("1 minute de latitude ≈ 1 852 m (mille marin)", () => {
    expect(distanceMeters(45, 0, 45 + 1 / 60, 0)).toBeCloseTo(1853, -1);
  });

  test("symétrique", () => {
    expect(distanceMeters(43.3, 5.4, 45.76, 4.84)).toBeCloseTo(distanceMeters(45.76, 4.84, 43.3, 5.4), 6);
  });

  test("coordonnée manquante : NaN (jamais une distance inventée)", () => {
    expect(distanceMeters(undefined, 3, 50, 3)).toBeNaN();
  });
});

describe("createSpeedSmoother", () => {
  test("moyenne glissante sur les 5 dernières mesures", () => {
    const smooth = createSpeedSmoother(5);
    [10, 20, 30, 40, 50].forEach((v) => smooth(v));
    expect(smooth(60)).toBe(40); // 20..60
  });

  test("une vitesse absente (null) n'est pas comptée comme un arrêt", () => {
    const smooth = createSpeedSmoother(5);
    smooth(40);
    smooth(40);
    expect(smooth(0, true)).toBe(40);
  });

  test("chaque lisseur a sa propre mémoire", () => {
    const a = createSpeedSmoother();
    const b = createSpeedSmoother();
    a(100);
    expect(b(10)).toBe(10);
  });
});

describe("isNightHour", () => {
  test.each([[20, true], [23, true], [0, true], [7, true], [8, false], [12, false], [19, false]])("%i h → %s", (h, night) => {
    expect(isNightHour(h)).toBe(night);
  });
});

describe("vehicleIconFor", () => {
  test.each([
    ["Aixam", "City", "fa-car"],
    ["Citroën", "Ami", "fa-car"],
    ["Ligier", "JS50", "fa-car"],
    ["Peugeot", "Kisbee", "fa-motorcycle"],
    ["Yamaha", "Aerox", "fa-motorcycle"],
    [undefined, undefined, "fa-motorcycle"],
  ])("%s %s → %s", (brand, model, icon) => {
    expect(vehicleIconFor(brand, model)).toBe(icon);
  });
});

describe("plus aucune formule de distance recopiée", () => {
  test("seul geo-math.js contient le rayon terrestre", () => {
    const copies = fs.readdirSync(JS)
      .filter((f) => f.endsWith(".js") && f !== "geo-math.js")
      .filter((f) => /\b6371(e3|008\.8|000)?\b/.test(fs.readFileSync(path.join(JS, f), "utf8")));
    expect(copies).toEqual([]);
  });
});
