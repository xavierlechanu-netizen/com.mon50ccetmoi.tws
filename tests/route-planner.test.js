/**
 * Itinéraire sans autoroute : src/js/route-planner.js
 * (sorti de app-map.js, étape 5 du plan de dette technique, tranche 5, 14/11/2026).
 */
const fs = require("fs");
const path = require("path");

const JS = path.resolve(__dirname, "../src/js");
const read = (f) => fs.readFileSync(path.join(JS, f), "utf8");
const stripModule = (code) =>
  code.replace(/^import .*$/gm, "").replace(/^export (const|function|async function) /gm, "$1 ");

const EXPORTS = [
  "AVG_SPEED_MS", "DUO_FACTOR", "isDuoRide", "travelModeFor", "pickRouteIndex", "routeFromDirections", "estimateDurationSec",
  "instructionText", "maneuverKind", "maneuverIcon", "ferrySteps", "nativeGpsUrl",
  "calculateRouteSansAutoroute", "cancelRoute", "searchDestination", "launchNativeGPS", "onGpsFix", "isGuiding",
];

// Modules ESM (navigateur) : on retire imports et "export" pour les évaluer ici, avec les vraies
// fonctions de map-engine.js (format des distances et durées, lecture des coordonnées) et le
// guidage en route (route-guidance.js).
function loadModule({ speak = jest.fn() } = {}) {
  window.__routeGuidanceTimer = true; // pas de minuterie réelle pendant les tests
  const engine = stripModule(read("map-engine.js"));
  const guidance = stripModule(read("route-guidance.js"));
  const code = stripModule(read("route-planner.js"));
  const isVoiceBusy = () => !!window.speechSynthesis?.speaking; // voice-engine.js, simulé
  const api = new Function(
    "speak", "registerAction", "isVoiceBusy",
    `${engine}\n${guidance}\n${code}\nreturn { ${EXPORTS.join(", ")} };`,
  )(speak, () => {}, isVoiceBusy);
  return { ...api, speak };
}

const LILLE = { lat: 50.6292, lng: 3.0573 };
const ROUBAIX = { lat: 50.6942, lng: 3.1746 };

/** DirectionsResult tel que le produit gmaps-compat.js (toDirectionsResult) à partir de l'IGN. */
function directionsResult({ distance = 12345, duration = 1000, steps } = {}) {
  const st = steps || [
    { instructions: "Partez par Rue Nationale", maneuver: "straight", distance: 300, duration: 40 },
    { instructions: "Tournez à droite sur Boulevard de la Liberté", maneuver: "turn-right", distance: 12045, duration: 960 },
  ];
  return {
    routes: [{
      overview_path: [LILLE, ROUBAIX],
      legs: [{
        distance: { text: "", value: distance },
        duration: { text: "", value: duration },
        steps: st.map((s) => ({
          instructions: s.instructions,
          maneuver: s.maneuver,
          distance: { text: "", value: s.distance },
          duration: { text: "", value: s.duration },
          start_location: LILLE,
          end_location: ROUBAIX,
        })),
      }],
    }],
  };
}

describe("Fonctions pures", () => {
  const R = loadModule();

  test("mode de calcul : vélo pour vélos et trottinettes, voiture sinon", () => {
    expect(R.travelModeFor("velo")).toBe("BICYCLING");
    expect(R.travelModeFor("trottinette")).toBe("BICYCLING");
    expect(R.travelModeFor("2t")).toBe("DRIVING");
    expect(R.travelModeFor("vsp")).toBe("DRIVING");
    expect(R.travelModeFor(undefined)).toBe("DRIVING");
  });

  test("itinéraire retenu : le premier, ou le plus long pour éviter les centres-villes", () => {
    const routes = [3000, 5000, 4000].map((value) => ({ legs: [{ distance: { value } }] }));
    expect(R.pickRouteIndex(routes, false)).toBe(0);
    expect(R.pickRouteIndex(routes, true)).toBe(1);
    expect(R.pickRouteIndex(routes.slice(0, 1), true)).toBe(0);
    expect(R.pickRouteIndex(undefined, true)).toBe(0);
  });

  test("lecture d'un DirectionsResult", () => {
    const r = R.routeFromDirections(directionsResult());
    expect(r.path).toEqual([LILLE, ROUBAIX]);
    expect(r.leg.distanceMeters).toBe(12345);
    expect(r.leg.durationSec).toBe(1000);
    expect(r.leg.steps).toHaveLength(2);
    expect(r.leg.steps[1]).toMatchObject({
      instructions: "Tournez à droite sur Boulevard de la Liberté",
      maneuver: "turn-right",
      distanceMeters: 12045,
      durationSec: 960,
      start_location: LILLE,
    });
    expect(R.routeFromDirections({ routes: [] })).toBeNull();
    expect(R.routeFromDirections(null)).toBeNull();
    expect(R.routeFromDirections({ routes: [{ legs: [] }] })).toBeNull();
  });

  test.each([
    ["ville lente : +20 %", 300, 1000, 360],
    ["trop rapide pour un 50 cc : 32 km/h de moyenne", 600, 10000, 1125],
    ["durée absente : 32 km/h de moyenne", 0, 3200, 360],
    ["rien à parcourir", 0, 0, 0],
    ["valeurs illisibles", "abc", undefined, 0],
  ])("durée annoncée : %s", (_name, sec, meters, expected) => {
    expect(R.estimateDurationSec(sec, meters)).toBe(expected);
  });

  test.each([
    ["scooter 2T en duo", { motor: "2t", crewMode: "duo" }, true],
    ["scooter 4T en duo", { motor: "4t", crewMode: "duo" }, true],
    ["moto 50 à boîte en duo", { motor: "moto", crewMode: "duo" }, true],
    ["profil sans moteur (scooter 2T par défaut) en duo", { crewMode: "duo" }, true],
    ["scooter seul", { motor: "2t", crewMode: "solo" }, false],
    ["voiture sans permis avec passager", { motor: "vsp", crewMode: "duo" }, false],
    ["vélo", { motor: "velo", crewMode: "duo" }, false],
    ["trottinette (passager interdit)", { motor: "trottinette", crewMode: "duo" }, false],
    ["aucun profil", undefined, false],
  ])("trajet en duo : %s", (_name, session, expected) => {
    expect(R.isDuoRide(session)).toBe(expected);
  });

  test("duo : +10 % après la règle des 32 km/h", () => {
    expect(R.DUO_FACTOR).toBe(1.1);
    expect(R.estimateDurationSec(300, 1000, { duo: true })).toBe(396); // 360 s + 10 %
    expect(R.estimateDurationSec(600, 10000, { duo: true })).toBe(1238); // 1 125 s + 10 %
    expect(R.estimateDurationSec(600, 10000, { duo: false })).toBe(1125);
    expect(R.estimateDurationSec(0, 0, { duo: true })).toBe(0);
  });

  test("jamais plus rapide que 32 km/h de moyenne", () => {
    for (const [sec, m] of [[1, 100000], [100, 2000], [3600, 45000]]) {
      const d = R.estimateDurationSec(sec, m);
      expect(m / d).toBeLessThanOrEqual(R.AVG_SPEED_MS + 0.01);
    }
  });

  test("consignes en texte brut", () => {
    expect(R.instructionText({ instructions: "Tournez à gauche sur Rue X" })).toBe("Tournez à gauche sur Rue X");
    expect(R.instructionText({ instructions: "Tournez à <b>gauche</b>&nbsp;sur <div>Rue&amp;Co</div>" }))
      .toBe("Tournez à gauche sur Rue&Co");
    expect(R.instructionText({ instructions: '<img src=x onerror="alert(1)">Partez' })).toBe("Partez");
    expect(R.instructionText({})).toBe("");
    expect(R.instructionText(null)).toBe("");
  });

  test.each([
    ["manœuvre IGN à gauche", { maneuver: "turn-left", instructions: "Tournez à gauche" }, "left"],
    ["manœuvre IGN serrez à droite", { maneuver: "turn-slight-right", instructions: "Serrez à droite" }, "right"],
    ["demi-tour", { maneuver: "uturn-left", instructions: "Faites demi-tour" }, "uturn"],
    ["rond-point (Google)", { maneuver: "roundabout-right", instructions: "Au rond-point…" }, "roundabout"],
    // Avant : l'icône suivait le texte et « Rive Gauche » donnait un virage à gauche
    ["tout droit sur une rue « Gauche »", { maneuver: "straight", instructions: "Continuez tout droit sur Rue de la Rive Gauche" }, "straight"],
    ["sans manœuvre : d'après le texte (gauche)", { instructions: "Tournez à gauche" }, "left"],
    ["sans manœuvre : d'après le texte (droite)", { instructions: "Tournez à droite" }, "right"],
    ["sans manœuvre : rond-point", { instructions: "Prenez le rond-point" }, "roundabout"],
    ["sans manœuvre ni sens", { instructions: "Partez" }, "straight"],
  ])("icône de manœuvre : %s", (_name, step, kind) => {
    expect(R.maneuverKind(step)).toBe(kind);
    expect(R.maneuverIcon(step).className).toMatch(/^fa-solid fa-/);
  });

  test("étapes en ferry", () => {
    const steps = [
      { instructions: "Partez par Quai Gambetta" },
      { instructions: "Prenez le <b>ferry</b> vers l'île d'Aix" },
      { instructions: "Continuez sur Rue du Bac" },
    ];
    expect(R.ferrySteps(steps)).toEqual([steps[1]]);
    expect(R.ferrySteps(undefined)).toEqual([]);
  });

  test("lien vers l'application GPS du téléphone", () => {
    expect(R.nativeGpsUrl(LILLE, "Mozilla/5.0 (Linux; Android 14)")).toBe("geo:50.6292,3.0573?q=50.6292,3.0573");
    expect(R.nativeGpsUrl(LILLE, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")).toBe("maps://?daddr=50.6292,3.0573&dirflg=d");
    expect(R.nativeGpsUrl(LILLE, "Mozilla/5.0 (Windows NT 10.0)"))
      .toBe("https://www.openstreetmap.org/directions?to=50.6292%2C3.0573#map=15/50.6292/3.0573");
    // LatLng de gmaps-compat (lat() / lng())
    expect(R.nativeGpsUrl({ lat: () => 50.6292, lng: () => 3.0573 }, "Android")).toBe("geo:50.6292,3.0573?q=50.6292,3.0573");
    expect(R.nativeGpsUrl(null, "Android")).toBeNull();
    expect(R.nativeGpsUrl({ lat: "nord", lng: 3 }, "Android")).toBeNull();
  });
});

describe("Calcul et affichage de l'itinéraire", () => {
  const PAGE = `
    <input id="route-search" value="Roubaix"><input id="route-start" value="">
    <div id="manual-start-box" class="hidden"></div>
    <button id="btn-cancel-route" class="hidden"></button>
    <div id="nav-instruction" class="hidden"><div class="nav-icon"><i class="fa-solid fa-arrow-turn-up"></i></div>
      <div id="next-step-name">Calibrage GPS...</div><div id="next-step-dist">--- m</div></div>
    <div id="nav-info-bar" style="display:none"><div id="nav-eta">--:--</div><div id="nav-dist">-- km</div>
      <div id="nav-time">-- min</div></div>
    <button id="btn-stop-nav" class="hidden"></button><button id="btn-reroute" class="hidden"></button>`;

  let layers;
  let requests;
  let respond; // (request) => [result, status] ou une promesse

  function installMap() {
    layers = [];
    requests = [];
    class Layer {
      constructor(opts) { this.opts = opts; this.onMap = !!opts.map; layers.push(this); }
      setMap(m) { this.onMap = !!m; }
    }
    window.google = {
      maps: {
        LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } },
        LatLngBounds: class { constructor() { this.points = []; } extend(p) { this.points.push(p); } },
        Polyline: class extends Layer {},
        TravelMode: { DRIVING: "DRIVING", BICYCLING: "BICYCLING" },
        DirectionsStatus: { OK: "OK" },
        DirectionsService: class {
          route(request, cb) {
            requests.push(request);
            Promise.resolve(respond(request)).then(([res, status]) => cb(res, status));
          }
        },
      },
    };
    window.googleLibraries = { AdvancedMarkerElement: class extends Layer {} };
    window.map = { fitBounds: jest.fn(), panTo: jest.fn() };
  }

  const visible = (layer) => layer.onMap;
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    jest.useRealTimers();
    document.body.textContent = "";
    document.body.insertAdjacentHTML("beforeend", PAGE);
    installMap();
    respond = () => [directionsResult(), "OK"];
    delete window.session;
    delete window.SafeRide;
    delete window.isRodageActive;
    delete window.avoidCityCenters;
    delete window.currentPosition;
  });

  test("itinéraire sans autoroute tracé, bandeau rempli et annoncé", async () => {
    const R = loadModule();
    const route = await R.calculateRouteSansAutoroute(LILLE, ROUBAIX);

    expect(route.leg.distanceMeters).toBe(12345);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ avoidHighways: true, avoidTolls: true, travelMode: "DRIVING" });
    expect(requests[0].origin).toMatchObject(LILLE);

    const [line, flag] = layers;
    expect(line.opts.path).toEqual([LILLE, ROUBAIX]);
    expect(visible(line)).toBe(true);
    expect(flag.opts.position).toEqual(ROUBAIX);
    expect(window.map.fitBounds).toHaveBeenCalledTimes(1);

    const text = (id) => document.getElementById(id).textContent;
    expect(document.getElementById("nav-info-bar").style.display).toBe("flex");
    expect(document.getElementById("btn-stop-nav").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("nav-instruction").classList.contains("hidden")).toBe(false);
    expect(text("nav-dist")).toBe("12,3 km");
    expect(text("nav-time")).toBe("23 min"); // 12 345 m à 32 km/h de moyenne
    expect(text("nav-eta")).toMatch(/\d{1,2}:\d{2}/);
    expect(text("next-step-name")).toBe("Partez par Rue Nationale");
    expect(text("next-step-dist")).toBe("300 m");
    expect(document.querySelector(".nav-icon i").className).toBe("fa-solid fa-arrow-up");
    expect(R.speak).toHaveBeenCalledWith(
      expect.stringMatching(/^Itinéraire calculé sans autoroute\. 12,3 km, arrivée prévue à \d.*\. Bonne route et prudence\.$/),
    );
    expect(R.isGuiding()).toBe(true);
    expect(window.currentRouteDestination).toBe(ROUBAIX);
  });

  test("vélo et trottinette : calcul en mode vélo", async () => {
    window.session = { motor: "trottinette" };
    await loadModule().calculateRouteSansAutoroute(LILLE, ROUBAIX);
    expect(requests[0].travelMode).toBe("BICYCLING");
    expect(requests[0].avoidHighways).toBe(true);
  });

  test("en duo sur un scooter : durée affichée +10 % ; en VSP : inchangée", async () => {
    window.session = { motor: "2t", crewMode: "duo" };
    const R = loadModule();
    await R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    expect(document.getElementById("nav-time").textContent).toBe("25 min"); // 1 389 s + 10 %

    window.session = { motor: "vsp", crewMode: "duo" };
    await R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    expect(document.getElementById("nav-time").textContent).toBe("23 min");
  });

  test("un nouvel itinéraire efface le précédent", async () => {
    const R = loadModule();
    await R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    const first = layers.slice();
    await R.calculateRouteSansAutoroute(ROUBAIX, LILLE);
    expect(first.every((l) => !visible(l))).toBe(true);
    expect(layers.filter(visible)).toHaveLength(2); // tracé + drapeau du second
  });

  test("deux recherches rapprochées : seule la dernière est affichée", async () => {
    let releaseFirst;
    const late = new Promise((r) => { releaseFirst = r; });
    respond = (req) => (req.destination.lat === ROUBAIX.lat ? late : [directionsResult({ distance: 800 }), "OK"]);
    const R = loadModule();

    const slow = R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    await R.calculateRouteSansAutoroute(LILLE, { lat: 50.63, lng: 3.06 });
    releaseFirst([directionsResult(), "OK"]);

    expect(await slow).toBeNull();
    expect(layers.filter(visible)).toHaveLength(2);
    expect(document.getElementById("nav-dist").textContent).toBe("800 m");
  });

  test("arrêter la navigation efface tout et coupe les annonces en attente", async () => {
    jest.useFakeTimers();
    const R = loadModule();
    const done = R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    await jest.advanceTimersByTimeAsync(0);
    await done;
    document.getElementById("btn-cancel-route").classList.remove("hidden");
    window.routeFerries = [{}];

    R.cancelRoute();
    jest.advanceTimersByTime(10000);

    expect(layers.some(visible)).toBe(false);
    expect(document.getElementById("nav-info-bar").style.display).toBe("none");
    for (const id of ["nav-instruction", "btn-stop-nav", "btn-reroute", "btn-cancel-route"]) {
      expect(document.getElementById(id).classList.contains("hidden")).toBe(true);
    }
    expect(document.getElementById("route-search").value).toBe("");
    expect(window.routeFerries).toEqual([]);
    expect(R.speak).not.toHaveBeenCalledWith(expect.stringMatching(/^Guidage démarré/));
    expect(R.speak).toHaveBeenLastCalledWith("Itinéraire annulé.");
    expect(R.isGuiding()).toBe(false);
  });

  test("annonce de la première consigne après celle de l'arrivée", async () => {
    jest.useFakeTimers();
    const R = loadModule();
    const done = R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    await jest.advanceTimersByTimeAsync(0);
    await done;
    jest.advanceTimersByTime(6000);
    expect(R.speak).toHaveBeenLastCalledWith("Guidage démarré. Partez par Rue Nationale.");
  });

  test("arrivée : « Vous êtes arrivé », guidage arrêté sans « Itinéraire annulé » ni recalcul", async () => {
    const R = loadModule();
    await R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    R.onGpsFix(ROUBAIX.lat, ROUBAIX.lng);
    expect(R.speak).toHaveBeenLastCalledWith("Vous êtes arrivé à destination. Bonne journée.");
    expect(R.isGuiding()).toBe(false);
    expect(layers.some(visible)).toBe(false);
    expect(document.getElementById("nav-info-bar").style.display).toBe("none");
    window.currentPosition = { lat: 50.75, lng: 3.3 };
    for (let i = 0; i < 5; i++) R.onGpsFix(50.75, 3.3);
    await flush();
    expect(requests).toHaveLength(1);
    expect(R.speak).not.toHaveBeenCalledWith("Itinéraire annulé.");
    expect(R.speak).not.toHaveBeenCalledWith("Recalcul de l'itinéraire en cours.");
  });

  test("sorti du tracé : recalcul depuis la position actuelle, l'ancien tracé reste jusqu'au nouveau", async () => {
    const R = loadModule();
    await R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    const first = layers.slice();
    let release;
    respond = () => new Promise((r) => { release = r; });
    R.onGpsFix(LILLE.lat, LILLE.lng); // sur le tracé
    window.currentPosition = { lat: 50.6, lng: 3.0 }; // à plusieurs km du tracé
    for (let i = 0; i < 6; i++) R.onGpsFix(50.6, 3.0);
    expect(R.speak).toHaveBeenCalledWith("Recalcul de l'itinéraire en cours.");
    expect(requests).toHaveLength(2); // un seul recalcul
    expect(requests[1].origin).toMatchObject({ lat: 50.6, lng: 3.0 });
    expect(first.every(visible)).toBe(true);
    release([directionsResult({ distance: 8000 }), "OK"]);
    await flush();
    await flush();
    expect(first.some(visible)).toBe(false);
    expect(R.speak).toHaveBeenCalledWith(expect.stringMatching(/^Itinéraire recalculé\. 8,0 km, arrivée prévue à \d/));
    expect(R.speak).not.toHaveBeenCalledWith(expect.stringMatching(/sans autoroute.*8,0 km/));
  });

  test("un calcul annulé pendant la requête ne s'affiche pas", async () => {
    let release;
    respond = () => new Promise((r) => { release = r; });
    const R = loadModule();
    const pending = R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    await flush();
    R.cancelRoute();
    release([directionsResult(), "OK"]);
    expect(await pending).toBeNull();
    expect(layers).toHaveLength(0);
    expect(document.getElementById("nav-info-bar").style.display).toBe("none");
  });

  test("aucun itinéraire : on le dit, sans repli vers un service qui autoriserait l'autoroute", async () => {
    respond = () => [{ routes: [] }, "ZERO_RESULTS"];
    const R = loadModule();
    expect(await R.calculateRouteSansAutoroute(LILLE, ROUBAIX)).toBeNull();
    expect(layers).toHaveLength(0);
    expect(R.speak).toHaveBeenCalledWith("Impossible de calculer l'itinéraire pour le moment. Vérifiez votre connexion.");
  });

  test("sans position GPS : message, aucune requête", async () => {
    const R = loadModule();
    expect(await R.calculateRouteSansAutoroute(null, ROUBAIX)).toBeNull();
    expect(requests).toHaveLength(0);
    expect(R.speak).toHaveBeenCalledWith("Signal GPS insuffisant pour démarrer l'itinéraire.");
  });

  test("météo dangereuse : durée allongée de 20 %, puis couleur normale au trajet suivant", async () => {
    window.SafeRide = { checkWeatherForRoute: jest.fn(async () => ({ isDangerous: true, issues: ["Pluie détectée"] })) };
    const R = loadModule();
    await R.calculateRouteSansAutoroute(LILLE, ROUBAIX);
    await flush();
    const time = document.getElementById("nav-time");
    expect(window.SafeRide.checkWeatherForRoute).toHaveBeenCalledWith(ROUBAIX.lat, ROUBAIX.lng);
    expect(time.textContent).toBe("28 min (Météo)");
    expect(time.style.color).not.toBe("");

    window.SafeRide.checkWeatherForRoute.mockResolvedValue({ isDangerous: false, issues: [] });
    await R.calculateRouteSansAutoroute(ROUBAIX, LILLE);
    await flush();
    expect(time.textContent).toBe("23 min");
    expect(time.style.color).toBe("");
  });

  test("étapes en ferry : retenues pour l'alerte d'approche", async () => {
    respond = () => [directionsResult({ steps: [
      { instructions: "Partez par Quai Gambetta", maneuver: "straight", distance: 100, duration: 10 },
      { instructions: "Prenez le ferry", maneuver: "straight", distance: 2000, duration: 900 },
    ] }), "OK"];
    window.lastSpokenFerryIndex = 3;
    await loadModule().calculateRouteSansAutoroute(LILLE, ROUBAIX);
    expect(window.routeFerries).toHaveLength(1);
    expect(window.lastSpokenFerryIndex).toBe(-1);
  });

  describe("recherche de destination", () => {
    beforeEach(() => {
      window.geocoder = {
        geocode: jest.fn(({ address }, cb) => {
          const places = { Roubaix: ROUBAIX, Lille: LILLE };
          if (places[address]) cb([{ geometry: { location: places[address] } }], "OK");
          else cb([], "ZERO_RESULTS");
        }),
      };
      window.currentPosition = LILLE;
      delete window.pendingDestinationName;
    });

    test("depuis la position GPS", async () => {
      const R = loadModule();
      await R.searchDestination();
      await flush();
      expect(requests[0].destination).toMatchObject(ROUBAIX);
      expect(requests[0].origin).toMatchObject(LILLE);
      expect(window.map.panTo).toHaveBeenCalledWith(ROUBAIX);
      expect(document.getElementById("btn-cancel-route").classList.contains("hidden")).toBe(false);
    });

    test("depuis un départ saisi", async () => {
      document.getElementById("route-start").value = "Lille";
      window.currentPosition = null;
      await loadModule().searchDestination();
      await flush();
      expect(requests[0].origin).toMatchObject(LILLE);
      expect(requests[0].destination).toMatchObject(ROUBAIX);
    });

    test("destination introuvable", async () => {
      document.getElementById("route-search").value = "Nulle-part-sur-Mer";
      const R = loadModule();
      await R.searchDestination();
      expect(R.speak).toHaveBeenCalledWith("Destination introuvable. Essayez une autre adresse.");
      expect(requests).toHaveLength(0);
    });

    test("en attente du GPS : la destination est gardée pour le premier signal", async () => {
      window.currentPosition = null;
      await loadModule().searchDestination();
      expect(window.pendingDestinationName).toBe("Roubaix");
      expect(requests).toHaveLength(0);
    });
  });

  test("bouton GO : ouvre la destination hors de l'app (ordinateur : OpenStreetMap)", async () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const R = loadModule();
    window.currentRouteDestination = ROUBAIX;
    R.launchNativeGPS();
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/www\.openstreetmap\.org\/directions\?to=50\.6942%2C3\.1746/), "_blank", "noopener");
    open.mockClear();
    window.currentRouteDestination = null;
    R.launchNativeGPS();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("Garde-fous", () => {
  test("app-map.js ne recalcule plus d'itinéraire lui-même", () => {
    const appMap = read("app-map.js");
    expect(appMap).toMatch(/import '\.\/route-planner\.js'/);
    expect(appMap).not.toMatch(/DirectionsService|calculateRouteSansAutoroute\s*\(/);
  });

  test("aucun repli vers un service d'itinéraire qui autorise l'autoroute", () => {
    const code = read("route-planner.js");
    expect(code).not.toMatch(/project-osrm\.org|graphhopper\.com|maps\.googleapis\.com|routing\.openstreetmap|fetch\(/i);
    expect(code).toMatch(/avoidHighways: true/);
  });
});
