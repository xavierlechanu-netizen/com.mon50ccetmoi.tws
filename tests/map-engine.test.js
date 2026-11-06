/**
 * @jest-environment node
 *
 * Carte souveraine (sortie de Google Maps) : src/js/map-engine.js
 */
const fs = require("fs");
const path = require("path");

// Le module est en ESM (navigateur) : on retire les "export" pour l'évaluer ici, comme les autres tests.
function loadEngine() {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/js/map-engine.js"), "utf8")
    .replace(/^export (const|function|async function) /gm, "$1 ");
  const names = ["readLatLng", "distanceMeters", "bearingDeg", "decodePolyline", "isNearPath", "formatDistance",
    "formatDuration", "prettyRoadName", "maneuverFromTurn", "buildSteps", "computeRoute", "geocodeAddress",
    "reverseGeocode", "completeAddress", "findNearbyGarages", "SPEED_CAP_MS", "OVERPASS_ENDPOINTS"];
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn { ${names.join(", ")} };`)();
}

const E = loadEngine();

function fakeFetch(body, ok = true) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok, status: ok ? 200 : 500, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

describe("Géométrie", () => {
  test("distance Paris → Lyon ≈ 392 km, et accepte les formats Google, littéral et tableau", () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const lyon = { lat: () => 45.764, lng: () => 4.8357 };
    const d = E.distanceMeters(paris, lyon);
    expect(d).toBeGreaterThan(390000);
    expect(d).toBeLessThan(394000);
    expect(E.distanceMeters([48.8566, 2.3522], paris)).toBe(0);
  });

  test("décodage de polyline (exemple de référence)", () => {
    const pts = E.decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toHaveLength(3);
    expect(pts[0].lat).toBeCloseTo(38.5, 5);
    expect(pts[0].lng).toBeCloseTo(-120.2, 5);
    expect(pts[2].lat).toBeCloseTo(43.252, 5);
    expect(pts[2].lng).toBeCloseTo(-126.453, 5);
  });

  test("isNearPath : un danger sur le tracé est compté, un danger à 1 km ne l'est pas", () => {
    const route = [{ lat: 48.85, lng: 2.30 }, { lat: 48.85, lng: 2.40 }];
    expect(E.isNearPath({ lat: 48.8502, lng: 2.35 }, route, 0.001)).toBe(true);
    expect(E.isNearPath({ lat: 48.86, lng: 2.35 }, route, 0.001)).toBe(false);
  });

  test("sens des virages", () => {
    expect(E.maneuverFromTurn(5)).toBe("straight");
    expect(E.maneuverFromTurn(90)).toBe("turn-right");
    expect(E.maneuverFromTurn(-90)).toBe("turn-left");
    expect(E.maneuverFromTurn(-30)).toBe("turn-slight-left");
    expect(E.maneuverFromTurn(175)).toBe("uturn-right");
  });

  test("noms de rues BD TOPO lisibles", () => {
    expect(E.prettyRoadName("R SAINT-MARTIN")).toBe("Rue Saint-Martin");
    expect(E.prettyRoadName("QU DE L'HORLOGE")).toBe("Quai de l'Horloge");
    expect(E.prettyRoadName("R D ARCOLE")).toBe("Rue d'Arcole");
    expect(E.prettyRoadName("AV DU BOIS DE VERRIERES")).toBe("Avenue du Bois de Verrieres");
  });

  test("formats d'affichage", () => {
    expect(E.formatDistance(850)).toBe("850 m");
    expect(E.formatDistance(12345)).toBe("12,3 km");
    expect(E.formatDuration(540)).toBe("9 min");
    expect(E.formatDuration(4500)).toBe("1 h 15");
  });
});

describe("Étapes de navigation", () => {
  // Deux tronçons de la même rue vers l'est, puis une rue vers le nord : un seul virage à gauche.
  const seg = (name, coords, distance, duration) => ({
    attributes: { nom_1_droite: name },
    geometry: { coordinates: coords },
    distance,
    duration,
    instruction: {},
  });
  const ign = [
    seg("R DE RIVOLI", [[2.3500, 48.8500], [2.3510, 48.8500]], 73, 10),
    seg("R DE RIVOLI", [[2.3510, 48.8500], [2.3520, 48.8500]], 73, 10),
    seg("R SAINT-MARTIN", [[2.3520, 48.8500], [2.3520, 48.8510]], 111, 12),
  ];

  test("fusionne les tronçons d'une même rue et calcule le virage", () => {
    const steps = E.buildSteps(ign);
    expect(steps).toHaveLength(2);
    expect(steps[0].instructions).toBe("Partez par Rue de Rivoli");
    expect(steps[0].distanceMeters).toBe(146);
    expect(steps[1].maneuver).toBe("turn-left");
    expect(steps[1].instructions).toBe("Tournez à gauche sur Rue Saint-Martin");
  });

  test("durées plafonnées à 45 km/h (50 cc)", () => {
    const steps = E.buildSteps(ign, E.SPEED_CAP_MS.DRIVING);
    // 146 m à 12,5 m/s = 11,7 s minimum, alors qu'IGN donne 20 s en voiture : on garde 20 s.
    expect(steps[0].durationSec).toBe(20);
    const fast = E.buildSteps([seg("RTE NATIONALE", [[2.0, 48.0], [2.1, 48.0]], 7400, 300)]);
    // 7,4 km en 300 s = 89 km/h en voiture → recalculé à 45 km/h : 592 s
    expect(fast[0].durationSec).toBe(592);
  });
});

describe("Services IGN (réseau simulé)", () => {
  const ignRoute = {
    distance: 257,
    duration: 32,
    geometry: { coordinates: [[2.3500, 48.8500], [2.3520, 48.8500], [2.3520, 48.8510]] },
    portions: [{ steps: [
      { attributes: { nom_1_droite: "R DE RIVOLI" }, geometry: { coordinates: [[2.3500, 48.8500], [2.3520, 48.8500]] }, distance: 146, duration: 20 },
      { attributes: { nom_1_droite: "R SAINT-MARTIN" }, geometry: { coordinates: [[2.3520, 48.8500], [2.3520, 48.8510]] }, distance: 111, duration: 12 },
    ] }],
  };

  test("l'itinéraire interdit toujours les autoroutes (Code de la route R421-2)", async () => {
    const f = fakeFetch(ignRoute);
    const r = await E.computeRoute({ lat: 48.85, lng: 2.35 }, { lat: 48.851, lng: 2.352 }, {}, f);
    const url = new URL(f.calls[0].url);
    expect(url.hostname).toBe("data.geopf.fr");
    expect(url.searchParams.get("resource")).toBe("bdtopo-pgr");
    expect(url.searchParams.get("start")).toBe("2.35,48.85");
    expect(JSON.parse(url.searchParams.get("constraints"))).toEqual(
      { constraintType: "banned", key: "waytype", operator: "=", value: "autoroute" });
    expect(r.distanceMeters).toBe(257);
    expect(r.steps).toHaveLength(2);
    expect(r.path[0]).toEqual({ lat: 48.85, lng: 2.35 });
  });

  test("une réponse sans tracé est une erreur (pas d'itinéraire inventé)", async () => {
    await expect(E.computeRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, {}, fakeFetch({}))).rejects.toThrow("Aucun itinéraire");
    await expect(E.computeRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, {}, fakeFetch({}, false))).rejects.toThrow("HTTP 500");
  });

  test("géocodage : adresse + code postal + département", async () => {
    const f = fakeFetch({ features: [{
      geometry: { coordinates: [2.290084, 49.897442] },
      properties: { label: "8 Boulevard du Port 80000 Amiens", name: "8 Boulevard du Port", housenumber: "8",
        street: "Boulevard du Port", postcode: "80000", city: "Amiens", context: "80, Somme, Hauts-de-France", id: "x", type: "housenumber" },
    }] });
    const [p] = await E.geocodeAddress("8 boulevard du port amiens", {}, f);
    expect(p.label).toBe("8 Boulevard du Port 80000 Amiens");
    expect(p.lat).toBeCloseTo(49.897442);
    const postal = p.addressComponents.find((c) => c.types.includes("postal_code"));
    expect(postal.long_name).toBe("80000");
    const dept = p.addressComponents.find((c) => c.types.includes("administrative_area_level_2"));
    expect(dept.short_name).toBe("80");
    expect(await E.geocodeAddress("ab", {}, f)).toEqual([]); // trop court : pas d'appel
    expect(f.calls).toHaveLength(1);
  });

  test("autocomplétion : x/y IGN convertis en lat/lng", async () => {
    const f = fakeFetch({ status: "OK", results: [{ fulltext: "Place Bellecour, 69002 Lyon", x: 4.831662, y: 45.757597 }] });
    const items = await E.completeAddress("place bellecour", {}, f);
    expect(items).toEqual([{ label: "Place Bellecour, 69002 Lyon", lat: 45.757597, lng: 4.831662 }]);
  });

  test("garages OpenStreetMap : nom obligatoire, adresse composée", async () => {
    const f = fakeFetch({ elements: [
      { type: "node", id: 1, lat: 48.85, lon: 2.35, tags: { name: "Scoot Service", "addr:housenumber": "12", "addr:street": "Rue X", "addr:city": "Paris" } },
      { type: "way", id: 2, center: { lat: 48.86, lon: 2.36 }, tags: { name: "Moto Atelier" } },
      { type: "node", id: 3, lat: 48.87, lon: 2.37, tags: {} },
    ] });
    const list = await E.findNearbyGarages({ lat: 48.85, lng: 2.35 }, 3000, f);
    expect(list.map((g) => g.name)).toEqual(["Scoot Service", "Moto Atelier"]);
    expect(list[0].vicinity).toBe("12 Rue X, Paris");
    expect(list[1].lat).toBe(48.86);
    expect(f.calls[0].init.method).toBe("POST");
  });

  test("garages : si le premier serveur Overpass est saturé, le second prend le relais", async () => {
    const urls = [];
    const f = async (url) => {
      urls.push(url);
      if (urls.length === 1) return { ok: false, status: 502, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ elements: [{ type: "node", id: 9, lat: 1, lon: 2, tags: { name: "Relais" } }] }) };
    };
    const list = await E.findNearbyGarages({ lat: 1, lng: 2 }, 1000, f);
    expect(list[0].name).toBe("Relais");
    expect(urls[0]).not.toBe(urls[1]);

    const down = async () => ({ ok: false, status: 504, json: async () => ({}) });
    await expect(E.findNearbyGarages({ lat: 1, lng: 2 }, 1000, down)).rejects.toThrow("HTTP 504");
  });
});
