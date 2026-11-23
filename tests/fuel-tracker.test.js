/**
 * @jest-environment node
 *
 * Pit Stop : plein déclaré par le pilote (+1 point), rappel honnête, pompes à 30 km.
 */
const fs = require("fs");
const path = require("path");
const { planTransaction, checkDailyCaps } = require("../functions/api/points-rules");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const load = (f, names) => new Function(`${read(f).replace(/^export /gm, "")}; return { ${names.join(", ")} };`)();
const { createFuelTracker, FUEL_KEY } = load("src/js/fuel-tracker.js", ["createFuelTracker", "FUEL_KEY"]);
const { distanceMeters } = load("src/js/geo-math.js", ["distanceMeters"]);

function memoryStorage() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

function setup() {
  const clock = { t: 1_800_000_000_000 };
  const storage = memoryStorage();
  const make = () => createFuelTracker({ storage, distance: distanceMeters, now: () => clock.t });
  return { clock, storage, make, tracker: make() };
}

/** Roule vers le nord à 40 km/h pendant `km` kilomètres, un relevé toutes les 30 s. */
function ride(tracker, clock, km, start = { lat: 45, lng: 4 }) {
  const stepKm = (40 * 30) / 3600;
  let lat = start.lat;
  tracker.track({ lat, lng: start.lng });
  for (let done = 0; done < km; done += stepKm) {
    clock.t += 30000;
    lat += stepKm / 111.2;
    tracker.track({ lat, lng: start.lng, accuracy: 10 });
  }
  return { lat, lng: start.lng };
}

describe("Suivi du plein", () => {
  test("sans plein déclaré : aucune estimation, aucun rappel", () => {
    const { tracker } = setup();
    tracker.track({ lat: 45, lng: 4 });
    expect(tracker.status()).toEqual({ known: false });
  });

  test("compte les km, rappelle une seule fois à 80 % de l'autonomie, et survit au rechargement", () => {
    const { tracker, clock, make } = setup();
    expect(tracker.declareFill(100)).toBe(true);
    const pos = ride(tracker, clock, 70);
    expect(tracker.status().shouldWarn).toBe(false);
    expect(Math.abs(tracker.status().kmSince - 70)).toBeLessThanOrEqual(2);

    const again = make();
    expect(again.status().known).toBe(true);
    ride(again, clock, 12, pos);
    expect(again.status().shouldWarn).toBe(true);
    again.markWarned();
    expect(again.status().shouldWarn).toBe(false);

    expect(again.declareFill(100)).toBe(true);
    expect(again.status()).toMatchObject({ kmSince: 0, remainingKm: 100, shouldWarn: false });
  });

  test("ignore le bruit du GPS, les relevés imprécis et les sauts impossibles", () => {
    const { tracker, clock } = setup();
    tracker.declareFill(100);
    tracker.track({ lat: 45, lng: 4 });
    clock.t += 30000;
    tracker.track({ lat: 45.00001, lng: 4 }); // 1 m
    clock.t += 30000;
    tracker.track({ lat: 45.01, lng: 4, accuracy: 500 }); // imprécis
    clock.t += 30000;
    tracker.track({ lat: 46, lng: 4 }); // 111 km en 30 s
    expect(tracker.status().kmSince).toBe(0);
  });

  test("refuse une autonomie impossible", () => {
    const { tracker } = setup();
    for (const v of [0, 5, 601, "abc", null, NaN]) expect(tracker.declareFill(v)).toBe(false);
    expect(tracker.status().known).toBe(false);
  });

  test("marche sans stockage (navigation privée) et avec une donnée abîmée", () => {
    const sans = createFuelTracker({ storage: null, distance: distanceMeters });
    expect(sans.declareFill(120)).toBe(true);
    expect(sans.status().rangeKm).toBe(120);
    const storage = memoryStorage();
    storage.setItem(FUEL_KEY, "{abîmé");
    expect(createFuelTracker({ storage, distance: distanceMeters }).status().known).toBe(false);
  });
});

describe("Point du plein déclaré", () => {
  test("1 point fixé par le serveur, 2 pleins récompensés par jour au maximum", () => {
    const plan = planTransaction({ action: "AWARD", reason: "FUEL_DECLARED", amount: 999 });
    expect(plan.amount).toBe(1);
    expect(plan.unverified).toBe(true);
    expect(checkDailyCaps(plan, "FUEL_DECLARED", { FUEL_DECLARED: 1 }).ok).toBe(true);
    expect(checkDailyCaps(plan, "FUEL_DECLARED", { FUEL_DECLARED: 2 }).ok).toBe(false);
  });
});

describe("Branchement", () => {
  test("plus de jauge simulée ; on déclare à l'arrêt", () => {
    const src = read("src/js/pit-stops.js");
    expect(src).not.toMatch(/simulateOBDFuelCheck|devDrainFuel|obdFuelLevel/);
    expect(src).toMatch(/if \(window\.isRiding\)/);
    expect(src).toMatch(/BVCManager\.add\(1, "FUEL_DECLARED"\)/);
  });

  test("pompes : 30 km triés par distance, plus jamais Paris par défaut", () => {
    const src = read("src/js/community-gas.js");
    expect(src).toMatch(/GAS_RADIUS_KM = 30/);
    expect(src).toMatch(/order_by=distance/);
    expect(src).not.toMatch(/48\.8566|3km|3 kilomètres/);
  });
});
