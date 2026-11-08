/**
 * Signalements de dangers : src/js/hazard-reports.js
 * (sorti de app-map.js, étape 5 du plan de dette technique, tranche 4, 8/11/2026).
 */
const fs = require("fs");
const path = require("path");
const geofire = require("geofire-common");

const JS = path.resolve(__dirname, "../src/js");
const read = (f) => fs.readFileSync(path.join(JS, f), "utf8");

// Modules ESM (navigateur) : on retire imports et "export" pour les évaluer ici
function loadModule({ db = null, store = {} } = {}) {
  const geo = read("geo-math.js").replace(/^export (const|function) /gm, "$1 ");
  const code = read("hazard-reports.js").replace(/^import .*$/gm, "").replace(/^export (const|function|async function) /gm, "$1 ");
  const secureGetItem = (k) => store[k] ?? null;
  const secureSetItem = (k, v) => { store[k] = v; };
  return new Function(
    "db", "secureGetItem", "secureSetItem", "registerAction", "geofire",
    `${geo}\n${code}\nreturn { HAZARD_SEARCH_RADIUS_M, hazardLabel, hazardColor, hazardPosition, isHazardExpired,
      selectNearbyHazards, hazardInfoContent, toggleHazardMenu, saveHazard, loadHazards };`,
  )(db, secureGetItem, secureSetItem, () => {}, geofire);
}

const LILLE = { lat: 50.6292, lng: 3.0573 };
const north = (m) => LILLE.lat + m / 111195; // 1° de latitude ≈ 111 km
const NOW = Date.parse("2026-11-08T12:00:00Z");
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString();

describe("Fonctions pures", () => {
  const H = loadModule();

  test.each([
    ["format enregistré par l'app {lat, lon}", { lat: 50.1, lon: 3.1 }, { lat: 50.1, lng: 3.1 }],
    ["format {lat, lng}", { lat: 50.1, lng: 3.1 }, { lat: 50.1, lng: 3.1 }],
    ["format {pos}", { pos: { lat: 50.1, lng: 3.1 } }, { lat: 50.1, lng: 3.1 }],
    ["nombres en texte", { lat: "50.1", lon: "3.1" }, { lat: 50.1, lng: 3.1 }],
    ["sans position", { type: "trou" }, null],
    ["position (0, 0)", { lat: 0, lon: 0 }, null],
    ["position illisible", { lat: "nord", lon: 3 }, null],
  ])("position : %s", (_name, h, expected) => {
    expect(H.hazardPosition(h)).toEqual(expected);
  });

  test("libellés lisibles et couleurs", () => {
    expect(H.hazardLabel("danger_immediat")).toBe("Danger immédiat");
    expect(H.hazardLabel("chien")).toBe("Animal sur la route");
    expect(H.hazardLabel("gravillons")).toBe("gravillons");
    expect(H.hazardLabel(undefined)).toBe("Danger");
    expect(H.hazardColor("Police")).toBe("#00d2ff");
    expect(H.hazardColor("animal")).toBe("#e67e22");
    expect(H.hazardColor("trou")).toBe("#ff4d4d");
  });

  test.each([
    ["animal signalé il y a 29 min", { type: "animal", date: minutesAgo(29) }, false],
    ["animal signalé il y a 31 min", { type: "animal", date: minutesAgo(31) }, true],
    ["chien signalé il y a 2 h", { type: "chien", date: minutesAgo(120) }, true],
    ["animal sans date", { type: "animal" }, false],
    ["route dégradée ancienne", { type: "Route Dégradée", date: minutesAgo(10000) }, false],
  ])("expiration : %s", (_name, h, expected) => {
    expect(H.isHazardExpired(h, NOW)).toBe(expected);
  });

  test("sélection autour du centre de la carte", () => {
    const records = [
      { id: "a", type: "trou", lat: north(500), lon: LILLE.lng },
      { id: "a", type: "trou", lat: north(500), lon: LILLE.lng }, // même document, deux zones geohash
      { id: "b", type: "Police", pos: { lat: north(1000), lng: LILLE.lng } },
      { id: "c", type: "trou", lat: north(30000), lon: LILLE.lng }, // à 30 km
      { id: "d", type: "animal", date: minutesAgo(45), lat: north(100), lon: LILLE.lng }, // expiré
      { id: "e", payload: "ancien document chiffré", lat: north(100), lon: LILLE.lng },
      { id: "f", type: "trou" }, // sans position
    ];
    const kept = H.selectNearbyHazards(records, LILLE, H.HAZARD_SEARCH_RADIUS_M, NOW);
    expect(kept.map((k) => k.hazard.id)).toEqual(["a", "b"]);
    expect(kept[1].position).toEqual({ lat: north(1000), lng: LILLE.lng });
  });

  test("sans identifiant : doublons reconnus par date et auteur", () => {
    const h = { type: "trou", date: minutesAgo(1), author: "pilote", lat: north(10), lon: LILLE.lng };
    expect(H.selectNearbyHazards([h, { ...h }], LILLE, 25000, NOW)).toHaveLength(1);
  });

  test("bulle : le pseudo de l'auteur reste du texte", () => {
    const box = H.hazardInfoContent({ type: "animal", author: '<img src=x onerror="alert(1)">' });
    expect(box.querySelector("img")).toBeNull();
    expect(box.textContent).toBe('🐾 Animal sur la route<img src=x onerror="alert(1)">');
  });
});

describe("saveHazard", () => {
  let store;
  let H;
  beforeEach(() => {
    document.body.innerHTML = '<div id="hazard-options"></div><button id="btn-hazard-quick"></button>';
    store = {};
    H = loadModule({ store });
    window.alert = jest.fn();
    window.publishHazardCloud = jest.fn(async () => true);
    window.isUserBanned = () => false;
    window.session = { username: "pilote59", bannedUntil: 0 };
    window.currentPosition = { ...LILLE };
    window.map = null; // loadHazards ne fait rien sans carte
  });

  test("enregistre localement et publie pour la communauté", () => {
    H.saveHazard("Police");
    const saved = JSON.parse(store.hazards);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ type: "Police", lat: LILLE.lat, lon: LILLE.lng, author: "pilote59" });
    expect(saved[0].geohash).toBe(geofire.geohashForLocation([LILLE.lat, LILLE.lng]));
    expect(window.publishHazardCloud).toHaveBeenCalledWith(saved[0]);
    expect(window.alert).toHaveBeenCalledWith("Signalement « Police » enregistré. Merci à vous.");
  });

  test("ajoute aux signalements déjà enregistrés, même si le stockage est abîmé", () => {
    store.hazards = "{pas du json";
    H.saveHazard("animal");
    H.saveHazard("Route Dégradée");
    expect(JSON.parse(store.hazards).map((h) => h.type)).toEqual(["animal", "Route Dégradée"]);
  });

  test("compte suspendu : rien n'est enregistré", () => {
    window.isUserBanned = () => true;
    window.session.bannedUntil = Date.now() + 10 * 60000;
    H.saveHazard("Police");
    expect(store.hazards).toBeUndefined();
    expect(window.publishHazardCloud).not.toHaveBeenCalled();
    expect(window.alert.mock.calls[0][0]).toMatch(/suspendu/);
  });

  test("sans position GPS : rien n'est enregistré", () => {
    window.currentPosition = null;
    H.saveHazard("Police");
    expect(store.hazards).toBeUndefined();
  });

  test("le menu se referme après le signalement", () => {
    H.toggleHazardMenu();
    document.getElementById("hazard-options").classList.add("hidden");
    H.toggleHazardMenu();
    expect(document.getElementById("hazard-options").classList.contains("hidden")).toBe(false);
    H.saveHazard("Police");
    expect(document.getElementById("hazard-options").classList.contains("hidden")).toBe(true);
  });
});

describe("loadHazards : affichage sur la carte", () => {
  function setupMap(docsByRange) {
    const markers = [];
    window.googleLibraries = {
      AdvancedMarkerElement: jest.fn(function (opts) {
        this.opts = opts;
        this.setMap = jest.fn();
        this.addListener = jest.fn();
        markers.push(this);
      }),
    };
    global.google = { maps: { InfoWindow: jest.fn(function (o) { this.content = o.content; this.open = jest.fn(); }) } };
    window.map = { getCenter: () => ({ lat: LILLE.lat, lng: LILLE.lng }) };
    let call = 0;
    const db = {
      collection: (name) => {
        expect(name).toBe("hazards");
        const q = { orderBy: () => q, startAt: () => q, endAt: () => q,
          get: async () => ({ docs: (docsByRange[call++] || []).map(({ id, ...data }) => ({ id, data: () => data })) }) };
        return q;
      },
    };
    return { markers, db };
  }

  afterEach(() => { delete global.google; });

  test("un marqueur par danger, y compris au format {pos}, sans doublon", async () => {
    const shared = { id: "a", type: "trou", lat: north(200), lon: LILLE.lng };
    const { markers, db } = setupMap([
      [shared, { id: "b", type: "Police", pos: { lat: north(800), lng: LILLE.lng } }],
      [shared],
    ]);
    const old = { setMap: jest.fn() };
    window.hazardMarkers = [old];
    const H = loadModule({ db });
    await H.loadHazards();
    expect(old.setMap).toHaveBeenCalledWith(null);
    expect(markers.map((m) => m.opts.position)).toEqual([
      { lat: north(200), lng: LILLE.lng },
      { lat: north(800), lng: LILLE.lng },
    ]);
    expect(window.hazardMarkers).toHaveLength(2);
    expect(markers[1].opts.content.style.backgroundColor).toBe("rgb(0, 210, 255)");
  });

  test("lecture impossible : les marqueurs existants restent affichés", async () => {
    const { db } = setupMap([]);
    db.collection = () => { const q = { orderBy: () => q, startAt: () => q, endAt: () => q, get: async () => { throw new Error("hors ligne"); } }; return q; };
    const old = { setMap: jest.fn() };
    window.hazardMarkers = [old];
    jest.spyOn(console, "error").mockImplementation(() => {});
    await loadModule({ db }).loadHazards();
    expect(old.setMap).not.toHaveBeenCalled();
    expect(window.hazardMarkers).toEqual([old]);
    console.error.mockRestore();
  });
});

describe("app-map.js délègue les dangers à hazard-reports.js", () => {
  const appMap = read("app-map.js");
  test("importé, et plus redéfini dans app-map.js", () => {
    expect(appMap).toMatch(/import '\.\/hazard-reports\.js'/);
    expect(appMap).not.toMatch(/saveHazard\s*=|function loadHazards|toggleHazardMenu\s*=/);
  });
});
