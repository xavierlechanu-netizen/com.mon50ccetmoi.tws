/**
 * Guidage vocal pendant le trajet : src/js/route-guidance.js (16/11/2026).
 * Chaque annonce une seule fois par événement : pas deux « Dans 300 m », pas de recalcul après
 * « Vous êtes arrivé », pas de recalcul en boucle.
 */
const fs = require("fs");
const path = require("path");

const JS = path.resolve(__dirname, "../src/js");
const read = (f) => fs.readFileSync(path.join(JS, f), "utf8");
const strip = (code) => code.replace(/^import .*$/gm, "").replace(/^export (const|function|async function) /gm, "$1 ");

const EXPORTS = [
  "createGuidance", "createRideTimer", "createGpsWatch", "distanceToPath", "spokenDistance", "spokenKm", "spokenDuration",
  "departureMessage", "rerouteMessage", "remainingMessage", "startGuidance", "stopGuidance", "isGuiding", "onGpsFix",
  "checkGpsLoss", "announce", "PHRASE_RECALCUL", "PHRASE_ARRIVEE", "PHRASE_CINQ_MIN", "PHRASE_PAUSE", "PHRASE_GPS_PERDU",
  "PHRASE_GPS_RETROUVE", "PHRASE_ANNULE",
];

// isVoiceBusy vient de voice-engine.js : voix du téléphone (simulée ici) ou enregistrement en cours
function loadModule({ speak = jest.fn(), isVoiceBusy = () => !!window.speechSynthesis?.speaking } = {}) {
  window.__routeGuidanceTimer = true; // pas de minuterie réelle pendant les tests
  const api = new Function("speak", "isVoiceBusy", `${strip(read("map-engine.js"))}\n${strip(read("route-guidance.js"))}\nreturn { ${EXPORTS.join(", ")} };`)(speak, isVoiceBusy);
  return { ...api, speak };
}

const voice = new Function(`${read("voice-phrases.js").replace(/^export (const|function) /gm, "$1 ")}\nreturn { translateForVoice };`)();

// Repère local : x mètres vers l'est, y mètres vers le nord autour de (45°N, 5°E)
const LAT0 = 45;
const LNG0 = 5;
const P = (x, y) => ({ lat: LAT0 + y / 111195, lng: LNG0 + x / (111195 * Math.cos((LAT0 * Math.PI) / 180)) });

// 1 km vers l'est, virage à gauche, 5 km vers le nord
const ROUTE = {
  steps: [
    { instructions: "Partez par Rue A", maneuver: "straight", distanceMeters: 1000, start_location: P(0, 0) },
    { instructions: "Tournez à gauche sur Rue B", maneuver: "turn-left", distanceMeters: 5000, start_location: P(1000, 0) },
  ],
  path: [P(0, 0), P(1000, 0), P(1000, 5000)],
  destination: P(1000, 5000),
};

/** Points tous les `step` mètres le long du tracé */
function drive(step = 10) {
  const out = [];
  for (let x = 0; x <= 1000; x += step) out.push(P(x, 0));
  for (let y = step; y <= 5000; y += step) out.push(P(1000, y));
  return out;
}

/** Rejoue un trajet (une position par seconde) et renvoie les annonces avec leur seconde */
function replay(g, points, t0 = 0) {
  const said = [];
  points.forEach((p, i) => g.update(p, t0 + i * 1000).forEach((ev) => said.push({ t: i, ...ev })));
  return said;
}

describe("Fonctions pures", () => {
  const G = loadModule();

  test("distances et durées dites à voix haute", () => {
    expect(G.spokenDistance(287)).toBe("300 m");
    expect(G.spokenDistance(160)).toBe("150 m");
    expect(G.spokenDistance(42)).toBe("40 m");
    expect(G.spokenDistance(3400)).toBe("3,4 km");
    expect(G.spokenKm(3000)).toBe("3 km");
    expect(G.spokenKm(3540)).toBe("3,5 km");
    expect(G.spokenKm(12300)).toBe("12 km");
    expect(G.spokenDuration(60)).toBe("1 minute");
    expect(G.spokenDuration(1200)).toBe("20 minutes");
    expect(G.spokenDuration(3 * 3600)).toBe("3 heures");
  });

  test("distance au tracé", () => {
    const line = [P(0, 0), P(1000, 0)];
    expect(G.distanceToPath(P(500, 100), line)).toBeCloseTo(100, -1);
    expect(G.distanceToPath(P(1100, 0), line)).toBeCloseTo(100, -1);
    expect(G.distanceToPath(P(0, 0), [])).toBe(Infinity);
  });

  test("annonce de départ : sans autoroute, puis « Bonne route et prudence »", () => {
    expect(G.departureMessage("12,3 km", "14:35")).toBe("Itinéraire calculé sans autoroute. 12,3 km, arrivée prévue à 14:35. Bonne route et prudence.");
    expect(G.departureMessage("12,3 km", "14:35", { rodage: true })).toMatch(/^Itinéraire rodage calculé sans autoroute\. 12,3 km à parcourir/);
  });
});

describe("Guidage le long d'un trajet", () => {
  const G = loadModule();

  test("une annonce à 300 m, une au virage, la ligne droite, la mi-parcours, l'arrivée : chacune une fois", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800 });
    const said = replay(g, drive()).map((e) => e.text);
    expect(said).toEqual([
      "Dans 300 m, Tournez à gauche sur Rue B.",
      "Tournez à gauche sur Rue B.",
      "Continuez sur 5 km.",
      "Il vous reste 3 km, soit environ 7 minutes.",
      "Vous êtes arrivé à destination. Bonne journée.",
    ]);
    expect(g.state.finished).toBe(true);
  });

  test("GPS qui hésite autour de 300 m : jamais deux « Dans 300 m »", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800 });
    const jitter = [690, 705, 695, 710, 700, 698, 702].map((x) => P(x, 0));
    const said = replay(g, jitter).filter((e) => e.kind === "maneuver");
    expect(said).toHaveLength(1);
  });

  test("virage tout proche dès la première annonce : pas de seconde annonce au virage", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800 });
    const said = replay(g, [P(890, 0), P(920, 0), P(950, 0), P(980, 0)]).filter((e) => e.kind === "maneuver");
    expect(said.map((e) => e.text)).toEqual(["Dans 100 m, Tournez à gauche sur Rue B."]);
  });

  test("pendant les annonces de départ, rien ; ensuite le virage est annoncé", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800, quietUntil: 5000 });
    expect(g.update(P(750, 0), 1000)).toEqual([]);
    expect(g.update(P(760, 0), 6000)).toEqual([{ kind: "maneuver", text: "Dans 250 m, Tournez à gauche sur Rue B." }]);
  });

  test("« Arrivée prévue dans 5 minutes » une fois sur un long trajet", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 1800 });
    const said = replay(g, drive(20)).map((e) => e.text);
    expect(said.filter((t) => t === "Arrivée prévue dans 5 minutes.")).toHaveLength(1);
    expect(said[said.length - 1]).toBe("Vous êtes arrivé à destination. Bonne journée.");
  });
});

describe("Recalcul", () => {
  const G = loadModule();
  const off = (n, t0) => Array.from({ length: n }, (_, i) => [P(500, 100 + i), t0 + i * 1000]);

  test("hors du tracé 3 positions de suite : un seul recalcul, puis attente de plus en plus longue", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800 });
    g.update(P(400, 0), 0);
    // une position sur le tracé avant chaque série : le compteur repart de zéro
    const kinds = (list) => [[P(400, 0), list[0][1] - 500], ...list].flatMap(([p, t]) => g.update(p, t)).map((e) => e.kind);
    expect(kinds(off(10, 1000))).toEqual(["reroute"]);
    expect(kinds(off(10, 30000))).toEqual([]); // moins d'une minute après
    expect(kinds(off(3, 70000))).toEqual(["reroute"]); // recalcul resté sans effet : on réessaie
    expect(kinds(off(10, 130000))).toEqual([]); // l'attente est passée à 2 min
    expect(kinds(off(3, 200000))).toEqual(["reroute"]);
  });

  test("départ d'un parking à 80 m de la route : pas de recalcul tant qu'on n'a pas rejoint le tracé", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800 });
    const said = [0, 1, 2, 3, 4].flatMap((i) => g.update(P(0, 80), i * 1000));
    expect(said).toEqual([]);
  });

  test("position imprécise (> 50 m) : pas de recalcul", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800 });
    g.update(P(400, 0), 0);
    const said = [1, 2, 3, 4].flatMap((i) => g.update(P(500, 200), i * 1000, { accuracy: 120 }));
    expect(said).toEqual([]);
  });

  test("après « Vous êtes arrivé », plus aucune annonce ni recalcul", () => {
    const g = G.createGuidance({ ...ROUTE, durationSec: 800 });
    replay(g, drive());
    const after = [1, 2, 3, 4, 5].flatMap((i) => g.update(P(1500, 5500), 999000 + i * 1000));
    expect(after).toEqual([]);
  });
});

describe("Pause et signal GPS", () => {
  const G = loadModule();

  test("pause conseillée après 2 h de conduite, une fois ; un arrêt de 15 min remet à zéro", () => {
    const t = G.createRideTimer();
    const said = [];
    for (let s = 0; s <= 2 * 3600 + 60; s += 30) {
      const m = t.tick(s * 1000, true);
      if (m) said.push(s);
    }
    expect(said).toEqual([7200]);

    const t2 = G.createRideTimer();
    let now = 0;
    const ride = (min) => { for (let i = 0; i < min * 2; i++) { now += 30000; if (t2.tick(now, true)) return true; } return false; };
    const stop = (min) => { for (let i = 0; i < min * 2; i++) { now += 30000; t2.tick(now, false); } };
    expect(ride(100)).toBe(false);
    stop(5); // feu rouge, plein d'essence : ce n'est pas une pause
    expect(ride(25)).toBe(true);
    expect(ride(100)).toBe(false);
    stop(16); // 30 s entre deux positions : 15 min pleines à l'arrêt
    expect(ride(100)).toBe(false);
  });

  test("appli en arrière-plan : un trou d'une heure ne compte pas comme une heure de conduite", () => {
    const t = G.createRideTimer();
    t.tick(0, true);
    expect(t.tick(3 * 3600 * 1000, true)).toBeNull();
  });

  test("signal perdu après 20 s puis retrouvé : chaque annonce une fois", () => {
    const w = G.createGpsWatch();
    expect(w.check(5000, true)).toBeNull(); // jamais eu de position
    expect(w.fix(0)).toBeNull();
    expect(w.check(15000, true)).toBeNull();
    expect(w.check(25000, false)).toBeNull(); // à l'arrêt, sans guidage : on ne dit rien
    expect(w.check(25000, true)).toBe(G.PHRASE_GPS_PERDU);
    expect(w.check(30000, true)).toBeNull();
    expect(w.fix(31000)).toBe(G.PHRASE_GPS_RETROUVE);
    expect(w.fix(32000)).toBeNull();
  });
});

describe("Branchement : file d'attente de la voix", () => {
  afterEach(() => {
    delete window.speechSynthesis;
  });

  test("une annonce ne coupe pas la voix en cours ; une consigne de virage trop vieille est abandonnée", () => {
    jest.useFakeTimers();
    const G = loadModule();
    window.speechSynthesis = { speaking: true };
    G.startGuidance({ leg: { steps: ROUTE.steps }, path: ROUTE.path }, { destination: ROUTE.destination, durationSec: 800 });
    G.onGpsFix(P(700, 0).lat, P(700, 0).lng, { now: Date.now() });
    expect(G.speak).not.toHaveBeenCalled();
    jest.advanceTimersByTime(7000);
    window.speechSynthesis.speaking = false;
    jest.advanceTimersByTime(1000);
    expect(G.speak).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("un enregistrement qui joue n'est pas coupé : l'annonce suivante attend la fin", () => {
    jest.useFakeTimers();
    let recordingPlays = true;
    const G = loadModule({ isVoiceBusy: () => recordingPlays });
    G.startGuidance({ leg: { steps: ROUTE.steps }, path: ROUTE.path }, { destination: ROUTE.destination, durationSec: 800 });
    G.onGpsFix(ROUTE.destination.lat, ROUTE.destination.lng);
    jest.advanceTimersByTime(3000);
    expect(G.speak).not.toHaveBeenCalled();
    recordingPlays = false;
    jest.advanceTimersByTime(600);
    expect(G.speak).toHaveBeenCalledWith("Vous êtes arrivé à destination. Bonne journée.");
    jest.useRealTimers();
  });

  test("arrivée : annonce, fin du guidage, puis plus rien", () => {
    const G = loadModule();
    const onArrive = jest.fn();
    const onReroute = jest.fn();
    G.startGuidance({ leg: { steps: ROUTE.steps }, path: ROUTE.path }, { destination: ROUTE.destination, durationSec: 800, onArrive, onReroute });
    const end = ROUTE.destination;
    G.onGpsFix(end.lat, end.lng);
    expect(G.speak).toHaveBeenCalledWith("Vous êtes arrivé à destination. Bonne journée.");
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(G.isGuiding()).toBe(false);
    for (let i = 0; i < 5; i++) G.onGpsFix(end.lat + 0.01, end.lng);
    expect(onReroute).not.toHaveBeenCalled();
    expect(G.speak).toHaveBeenCalledTimes(1);
  });

  test("hors du tracé : « Recalcul de l'itinéraire en cours. » et demande de nouvel itinéraire, une fois", () => {
    const G = loadModule();
    const onReroute = jest.fn();
    G.startGuidance({ leg: { steps: ROUTE.steps }, path: ROUTE.path }, { destination: ROUTE.destination, durationSec: 800, onReroute });
    const t0 = Date.now();
    G.onGpsFix(P(400, 0).lat, P(400, 0).lng, { now: t0 });
    for (let i = 1; i <= 6; i++) G.onGpsFix(P(500, 150).lat, P(500, 150).lng, { now: t0 + i * 1000 });
    expect(onReroute).toHaveBeenCalledTimes(1);
    expect(G.speak).toHaveBeenCalledWith("Recalcul de l'itinéraire en cours.");
  });

  test("perte du signal pendant le guidage puis retour", () => {
    const G = loadModule();
    G.startGuidance({ leg: { steps: ROUTE.steps }, path: ROUTE.path }, { destination: ROUTE.destination, durationSec: 800 });
    const t0 = Date.now();
    G.onGpsFix(P(100, 0).lat, P(100, 0).lng, { now: t0 });
    G.checkGpsLoss(t0 + 25000);
    G.checkGpsLoss(t0 + 30000);
    G.onGpsFix(P(110, 0).lat, P(110, 0).lng, { now: t0 + 31000 });
    expect(G.speak.mock.calls.map((c) => c[0])).toEqual(["Signal GPS perdu, prudence.", "Signal GPS récupéré."]);
  });
});

describe("Traductions anglaise et espagnole", () => {
  const G = loadModule();
  const messages = [
    G.PHRASE_RECALCUL, G.PHRASE_ARRIVEE, G.PHRASE_CINQ_MIN, G.PHRASE_PAUSE, G.PHRASE_GPS_PERDU, G.PHRASE_GPS_RETROUVE, G.PHRASE_ANNULE,
    G.departureMessage("12,3 km", "14:35"), G.departureMessage("12,3 km", "14:35", { rodage: true }),
    G.rerouteMessage("8 km", "14:40"), G.remainingMessage(12000, 1200), G.remainingMessage(300000, 4 * 3600),
    "Dans 300 m, Tournez à droite sur Rue B.", "Continuez sur 3 km.", "Guidage démarré. Partez par Rue A.",
    "Vous quittez la zone à faibles émissions.",
  ];
  test.each(["en", "es"])("%s", (lang) => {
    const missing = messages.filter((m) => !voice.translateForVoice(m, lang).translated);
    expect(missing).toEqual([]);
  });
});
