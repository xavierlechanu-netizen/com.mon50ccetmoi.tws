/**
 * Alertes de danger pendant la conduite : src/js/hazard-alerts.js
 * (sorti de app-core.js, étape 5 du plan de dette technique, 7/11/2026).
 */
const fs = require("fs");
const path = require("path");

const JS = path.resolve(__dirname, "../src/js");
const read = (f) => fs.readFileSync(path.join(JS, f), "utf8");

// Modules ESM (navigateur) : on retire imports et "export" pour les évaluer ici
function loadModule({ speak, vibrate, store }) {
  const geo = read("geo-math.js").replace(/^export (const|function) /gm, "$1 ");
  const code = read("hazard-alerts.js").replace(/^import .*$/gm, "").replace(/^export (const|function) /gm, "$1 ");
  const secureGetItem = (k) => store[k] ?? null;
  const secureSetItem = (k, v) => { store[k] = v; };
  return new Function(
    "speak", "vibrate", "secureGetItem", "secureSetItem",
    `${geo}\n${code}\nreturn { HAZARD_RULES, hazardKey, hazardAlertFor, checkHazardProximity, showHazardConfirmation, confirmHazard };`,
  )(speak, vibrate, secureGetItem, secureSetItem);
}

// Lille, et un point ~ 50 m / 300 m / 800 m plus au nord (1° de latitude ≈ 111 km)
const HERE = { lat: 50.6292, lng: 3.0573 };
const north = (m) => HERE.lat + m / 111195;

describe("hazardAlertFor : quelle alerte pour quel danger", () => {
  const { hazardAlertFor } = loadModule({ speak() {}, vibrate() {}, store: {} });
  const now = Date.parse("2026-11-07T12:00:00Z");
  const minutesAgo = (m) => new Date(now - m * 60000).toISOString();

  test.each([
    ["danger immédiat récent à 800 m", { type: "danger_immediat", date: minutesAgo(5) }, 800, "red"],
    ["danger immédiat trop ancien (20 min)", { type: "danger_immediat", date: minutesAgo(20) }, 800, null],
    ["danger immédiat à 1,2 km", { type: "danger_immediat", date: minutesAgo(1) }, 1200, null],
    ["animal à 400 m", { type: "animal" }, 400, "animal"],
    ["chien à 499 m", { type: "chien" }, 499, "animal"],
    ["animal à 600 m", { type: "animal" }, 600, null],
    ["trou à 80 m", { type: "trou" }, 80, "standard"],
    ["gravillons à 150 m", { type: "gravillons" }, 150, null],
    ["distance inconnue", { type: "trou" }, NaN, null],
  ])("%s", (_name, hazard, distance, expected) => {
    expect(hazardAlertFor(hazard, distance, now)).toBe(expected);
  });
});

describe("checkHazardProximity : annonces pendant la conduite", () => {
  let speak;
  let store;
  let mod;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = "";
    speak = jest.fn();
    store = {};
    mod = loadModule({ speak, vibrate: jest.fn(), store });
  });
  afterEach(() => jest.useRealTimers());

  const setHazards = (list) => { store.hazards = JSON.stringify(list); };

  test("un danger proche est annoncé une seule fois, avec « Toujours là ? »", () => {
    setHazards([{ type: "trou", lat: north(50), lon: HERE.lng }]);
    mod.checkHazardProximity(HERE.lat, HERE.lng);
    mod.checkHazardProximity(HERE.lat, HERE.lng);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toContain("trou");
    expect(document.querySelector(".hazard-toast")).not.toBeNull();
  });

  test("deux dangers dont la somme lat + lon est égale ne se masquent plus", () => {
    // Avant : identifiés par lat + lon → même identifiant, le 2e n'était jamais annoncé
    const a = { type: "trou", lat: north(40), lon: HERE.lng };
    const b = { type: "huile", lat: north(40) - 0.0002, lon: HERE.lng + 0.0002 };
    expect(a.lat + a.lon).toBeCloseTo(b.lat + b.lon, 10);
    setHazards([a, b]);
    mod.checkHazardProximity(HERE.lat, HERE.lng);
    expect(speak.mock.calls.map((c) => c[0]).join(" ")).toMatch(/trou[\s\S]*huile/);
  });

  test("deux dangers proches ne sont pas répétés en boucle à chaque position GPS", () => {
    setHazards([{ type: "trou", lat: north(40), lon: HERE.lng }, { type: "huile", lat: north(60), lon: HERE.lng }]);
    for (let i = 0; i < 5; i++) mod.checkHazardProximity(HERE.lat, HERE.lng);
    expect(speak).toHaveBeenCalledTimes(2);
  });

  test("on est prévenu de nouveau en repassant plus tard (après s'être éloigné de 2 km)", () => {
    setHazards([{ type: "trou", lat: north(50), lon: HERE.lng }]);
    mod.checkHazardProximity(HERE.lat, HERE.lng);
    mod.checkHazardProximity(north(3000), HERE.lng); // loin
    mod.checkHazardProximity(HERE.lat, HERE.lng); // retour
    expect(speak).toHaveBeenCalledTimes(2);
  });

  test("un danger loin n'est pas annoncé", () => {
    setHazards([{ type: "trou", lat: north(300), lon: HERE.lng }]);
    mod.checkHazardProximity(HERE.lat, HERE.lng);
    expect(speak).not.toHaveBeenCalled();
  });

  test("conduite dangereuse signalée à 800 m : annonce avec la distance", () => {
    setHazards([{ type: "danger_immediat", lat: north(800), lon: HERE.lng, date: new Date().toISOString(), description: "voiture en zigzag" }]);
    mod.checkHazardProximity(HERE.lat, HERE.lng);
    expect(speak).toHaveBeenCalledWith(expect.stringMatching(/voiture en zigzag à 8\d\d mètres/));
  });

  test("stockage illisible : aucune alerte, pas de plantage", () => {
    store.hazards = "{pas du json";
    expect(() => mod.checkHazardProximity(HERE.lat, HERE.lng)).not.toThrow();
  });

  test("le type de danger est affiché comme du texte, jamais comme du HTML", () => {
    mod.showHazardConfirmation(0, '<img src=x onerror="alert(1)">');
    const toast = document.querySelector(".hazard-toast");
    expect(toast.querySelector("img")).toBeNull();
    expect(toast.querySelector("strong").textContent).toBe('<img src=x onerror="alert(1)">');
  });

  test("« Non, plus là » retire le signalement de la liste", () => {
    setHazards([{ type: "trou", lat: 1, lon: 1 }, { type: "huile", lat: 2, lon: 2 }]);
    mod.confirmHazard(0, false);
    expect(JSON.parse(store.hazards)).toEqual([{ type: "huile", lat: 2, lon: 2 }]);
  });
});
