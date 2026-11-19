/**
 * route-guidance.js — Ce que Nexus Atlas dit PENDANT le trajet (16/11/2026).
 *
 * Avant : sur l'écran principal, seule la première consigne était annoncée au départ, puis plus
 * rien (ni virage, ni arrivée, ni recalcul). Désormais, à chaque position GPS :
 * - « Dans 300 m, Tournez à droite sur … » puis « Tournez à droite sur … » au moment du virage ;
 * - « Continuez sur 3 km. » après un virage suivi d'une longue ligne ;
 * - « Il vous reste 12 km, soit environ 20 minutes. » à mi-parcours, « Arrivée prévue dans 5 minutes. » ;
 * - « Recalcul de l'itinéraire en cours. » quand on quitte le tracé, « Vous êtes arrivé à destination. » ;
 * - « Pause conseillée … » après 2 h de conduite sans vraie pause (15 min à l'arrêt) ;
 * - « Signal GPS perdu, prudence. » / « Signal GPS récupéré. ».
 *
 * Chaque annonce n'est dite qu'une fois par événement (défauts entendus dans la démo : deux
 * « Dans 300 m » à 5 s d'écart, un recalcul juste après « Vous êtes arrivé »). Une annonce
 * n'en coupe pas une autre : elle attend que la voix se taise, et les consignes de virage
 * trop vieilles sont abandonnées plutôt que dites en retard.
 *
 * Toutes les distances et durées viennent de l'itinéraire IGN et du GPS : aucune donnée inventée.
 * Les fonctions create* sont pures (testées dans tests/route-guidance.test.js).
 */
import { readLatLng, distanceMeters, formatDistance } from "./map-engine.js";
import { speak, isVoiceBusy } from "./voice-engine.js";

/** Annonce « Dans … » : à 300 m du virage (≈ 25 s à 45 km/h). */
export const FAR_M = 300;
/** Annonce du virage lui-même. */
export const NEAR_M = 60;
/** Virage considéré comme passé. */
export const PASSED_M = 30;
/** Arrivée : à moins de 30 m de la destination. */
export const ARRIVAL_M = 30;
/** Hors du tracé au-delà de 60 m, sur 3 positions de suite. */
export const OFF_ROUTE_M = 60;
export const OFF_ROUTE_FIXES = 3;
/** Positions trop imprécises (> 50 m) : ne déclenchent pas de recalcul. */
export const MAX_ACCURACY_M = 50;
/** Ligne droite annoncée après un virage : 2 km et plus. */
export const LONG_STEP_M = 2000;

export const PHRASE_RECALCUL = "Recalcul de l'itinéraire en cours.";
export const PHRASE_ARRIVEE = "Vous êtes arrivé à destination. Bonne journée.";
export const PHRASE_CINQ_MIN = "Arrivée prévue dans 5 minutes.";
export const PHRASE_PAUSE = "Pause conseillée : vous roulez depuis deux heures.";
export const PHRASE_GPS_PERDU = "Signal GPS perdu, prudence.";
export const PHRASE_GPS_RETROUVE = "Signal GPS récupéré.";
export const PHRASE_ANNULE = "Itinéraire annulé.";

// ---------------------------------------------------------------------------
// Phrases à partie variable (traduites par PATTERNS dans voice-phrases.js)
// ---------------------------------------------------------------------------

/** Annonce de départ : rappelle que les autoroutes sont évitées (Code de la route R421-2). */
export function departureMessage(distText, etaText, { rodage = false } = {}) {
  if (rodage) return `Itinéraire rodage calculé sans autoroute. ${distText} à parcourir. Bonne route et prudence.`;
  return `Itinéraire calculé sans autoroute. ${distText}, arrivée prévue à ${etaText}. Bonne route et prudence.`;
}

export function rerouteMessage(distText, etaText) {
  return `Itinéraire recalculé. ${distText}, arrivée prévue à ${etaText}.`;
}

/** Distance dite à voix haute : arrondie à 50 m (à 10 m sous 100 m) pour ne pas dire « 287 mètres ». */
export function spokenDistance(m) {
  if (m >= 1000) return formatDistance(m);
  if (m >= 100) return `${Math.round(m / 50) * 50} m`;
  return `${Math.max(10, Math.round(m / 10) * 10)} m`;
}

/** « 20 minutes », « 3 heures » (au-delà de 2 h). */
export function spokenDuration(sec) {
  const min = Math.max(1, Math.round((Number(sec) || 0) / 60));
  if (min < 120) return `${min} minute${min > 1 ? "s" : ""}`;
  return `${Math.round(min / 60)} heures`;
}

/** « 12 km », « 3,5 km », « 3 km » (jamais « 3,0 km »), « 800 m ». */
export function spokenKm(m) {
  if (m < 1000) return spokenDistance(m);
  const km = m / 1000;
  if (km >= 10) return `${Math.round(km)} km`;
  return `${km.toFixed(1).replace(/\.0$/, "").replace(".", ",")} km`;
}

export function remainingMessage(distMeters, sec) {
  return `Il vous reste ${spokenKm(distMeters)}, soit environ ${spokenDuration(sec)}.`;
}

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------

/** Distance (m) d'un point à une polyligne [{lat,lng}], par projection locale (suffisant à l'échelle d'une rue). */
export function distanceToPath(p, path) {
  if (!p || !Array.isArray(path) || path.length === 0) return Infinity;
  if (path.length === 1) return distanceMeters(p, path[0]);
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110540;
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = (path[i].lng - p.lng) * kx;
    const ay = (path[i].lat - p.lat) * ky;
    const bx = (path[i + 1].lng - p.lng) * kx;
    const by = (path[i + 1].lat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Guidage (pur) : une position en entrée, des annonces en sortie
// ---------------------------------------------------------------------------

/**
 * @param {object} o
 * @param {Array<{instructions:string, maneuver?:string, distanceMeters:number, start_location:any}>} o.steps
 *   étapes de l'itinéraire (route-planner.js) : la consigne i se fait au DÉBUT de l'étape i
 * @param {Array} o.path tracé complet (LatLng ou {lat,lng})
 * @param {any} o.destination
 * @param {number} o.durationSec durée annoncée au départ (déjà adaptée au 50 cc)
 * @param {number} [o.quietUntil] pas d'annonce de virage avant cet instant (annonces de départ en cours)
 * @param {(step:object)=>string} [o.textOf] texte d'une consigne
 */
export function createGuidance({ steps = [], path = [], destination, durationSec = 0, quietUntil = 0, textOf } = {}) {
  const text = textOf || ((s) => String(s?.instructions || "").trim());
  const pts = (path || []).map(readLatLng).filter(Boolean);
  const dest = readLatLng(destination) || pts[pts.length - 1] || null;
  const st = (steps || []).map((s) => ({
    text: text(s),
    straight: !s.maneuver || s.maneuver === "straight",
    length: Number(s.distanceMeters) || 0,
    at: readLatLng(s.start_location),
  }));
  const total = st.reduce((a, s) => a + s.length, 0);

  const state = {
    finished: false,
    next: 1, // étape 0 = départ ; prochaine consigne à annoncer
    minD: Infinity,
    farAt: null, // distance à laquelle « Dans … » a été dit (null = pas encore)
    nearSaid: false,
    joined: false, // déjà passé sur le tracé
    offCount: 0,
    rerouteAt: -Infinity,
    rerouteWait: 60000, // doublé à chaque recalcul resté sans effet
    halfSaid: total < 5000,
    fiveSaid: durationSec < 900,
  };

  function passed(i) {
    state.next = i + 1;
    state.minD = Infinity;
    state.farAt = null;
    state.nearSaid = false;
  }

  function remainingMeters(p) {
    if (state.next >= st.length || !st[state.next].at) return dest ? distanceMeters(p, dest) : 0;
    let r = distanceMeters(p, st[state.next].at);
    for (let i = state.next; i < st.length; i++) r += st[i].length;
    return r;
  }

  /** @returns {Array<{kind:string, text:string}>} annonces à faire pour cette position */
  function update(position, now = Date.now(), { accuracy = 0 } = {}) {
    const p = readLatLng(position);
    if (state.finished || !p) return [];
    const out = [];

    // 1. Arrivée : fin du guidage, plus jamais de recalcul ensuite
    if (dest && distanceMeters(p, dest) <= ARRIVAL_M) {
      state.finished = true;
      return [{ kind: "arrive", text: PHRASE_ARRIVEE }];
    }

    // 2. Hors du tracé : recalcul (une fois, puis attente de plus en plus longue s'il échoue).
    // Seulement après avoir rejoint le tracé : partir d'un parking à 80 m de la route n'est pas une erreur.
    if (pts.length > 1 && !(accuracy > MAX_ACCURACY_M)) {
      const off = distanceToPath(p, pts) > OFF_ROUTE_M;
      if (!off) state.joined = true;
      state.offCount = off && state.joined ? state.offCount + 1 : 0;
      if (state.offCount >= OFF_ROUTE_FIXES) {
        state.offCount = 0;
        if (now - state.rerouteAt >= state.rerouteWait) {
          if (state.rerouteAt > -Infinity) state.rerouteWait *= 2;
          state.rerouteAt = now;
          return [{ kind: "reroute", text: PHRASE_RECALCUL }];
        }
      }
      if (state.offCount > 0) return []; // en train de sortir du tracé : on n'annonce pas un virage faux
    }

    // 3. Virages passés
    let longStep = null;
    while (state.next < st.length && st[state.next].at) {
      const d = distanceMeters(p, st[state.next].at);
      state.minD = Math.min(state.minD, d);
      if (d <= PASSED_M || (state.minD <= 80 && d > state.minD + 40)) {
        longStep = st[state.next].length >= LONG_STEP_M ? st[state.next] : null;
        passed(state.next);
      } else break;
    }

    const quiet = now < quietUntil;

    // 4. Prochain virage
    if (!quiet && state.next < st.length && st[state.next].at) {
      const s = st[state.next];
      const d = distanceMeters(p, s.at);
      if (state.farAt === null && d <= FAR_M && d > NEAR_M) {
        state.farAt = d;
        out.push({ kind: "maneuver", text: `Dans ${spokenDistance(d)}, ${s.text}.` });
      } else if (!state.nearSaid && d <= NEAR_M) {
        state.nearSaid = true;
        // déjà annoncé tout près (étape courte) ou simple « continuez » : pas de deuxième annonce
        const justSaid = state.farAt !== null && state.farAt < 150;
        if (!justSaid && !s.straight) out.push({ kind: "maneuver", text: `${s.text}.` });
        if (state.farAt === null) state.farAt = d;
      }
    }
    if (!quiet && longStep && out.length === 0) {
      out.push({ kind: "continue", text: `Continuez sur ${Math.round(longStep.length / 1000)} km.` });
    }

    // 5. Temps et distance restants (jamais dans la même seconde qu'une consigne)
    if (!quiet && out.length === 0 && total > 0) {
      const rest = remainingMeters(p);
      const sec = durationSec * Math.min(1, rest / total);
      if (!state.fiveSaid && sec <= 300 && rest > 300) {
        state.fiveSaid = true;
        state.halfSaid = true;
        out.push({ kind: "remaining", text: PHRASE_CINQ_MIN });
      } else if (!state.halfSaid && rest <= total / 2) {
        state.halfSaid = true;
        out.push({ kind: "remaining", text: remainingMessage(rest, sec) });
      }
    }
    return out;
  }

  return { update, state };
}

/**
 * Pause conseillée après 2 h de conduite. Une vraie pause = 15 min à l'arrêt (le compteur repart
 * de zéro). Les trous entre deux positions (appli en arrière-plan) comptent au plus 1 min.
 */
export function createRideTimer({ limitMs = 2 * 3600 * 1000, breakMs = 15 * 60 * 1000 } = {}) {
  let riding = 0;
  let last = null;
  let stoppedSince = null;
  return {
    tick(now, moving) {
      const dt = last === null ? 0 : Math.max(0, Math.min(60000, now - last));
      last = now;
      if (moving) {
        riding += dt;
        stoppedSince = null;
      } else {
        if (stoppedSince === null) stoppedSince = now;
        if (now - stoppedSince >= breakMs) riding = 0;
      }
      if (riding >= limitMs) {
        riding = 0; // prochain rappel dans 2 h si toujours pas de pause
        return PHRASE_PAUSE;
      }
      return null;
    },
  };
}

/** Perte du signal GPS (plus de position depuis 20 s alors qu'on roulait ou qu'on était guidé). */
export function createGpsWatch({ lostAfterMs = 20000 } = {}) {
  let lastFix = null;
  let lost = false;
  return {
    fix(now) {
      lastFix = now;
      if (!lost) return null;
      lost = false;
      return PHRASE_GPS_RETROUVE;
    },
    check(now, watching) {
      if (lost || lastFix === null || !watching || now - lastFix < lostAfterMs) return null;
      lost = true;
      return PHRASE_GPS_PERDU;
    },
  };
}

// ---------------------------------------------------------------------------
// Branchement (route-planner.js démarre le guidage, app-core.js transmet chaque position)
// ---------------------------------------------------------------------------

let active = null; // { guidance, onReroute, onArrive }
let queue = []; // annonces en attente que la voix se taise : { text, expires }
let flushTimer = null;
let wasRiding = false;
const rideTimer = createRideTimer();
const gpsWatch = createGpsWatch();

// Voix du téléphone ou enregistrement (recorded-voice.js) : on ne coupe ni l'une ni l'autre
const isSpeaking = () => isVoiceBusy();

function flush(now = Date.now()) {
  queue = queue.filter((m) => m.expires > now);
  if (queue.length > 0 && !isSpeaking()) speak(queue.shift().text);
  clearTimeout(flushTimer);
  flushTimer = queue.length > 0 ? setTimeout(() => flush(), 500) : null;
}

/** Une consigne de virage n'a plus de sens 6 s plus tard ; le reste peut attendre 1 min. */
function say(text, kind, now) {
  queue.push({ text, expires: now + (kind === "maneuver" ? 6000 : 60000) });
}

/**
 * Démarre le guidage d'un itinéraire affiché.
 * @param {object} route { path, leg } (route-planner.js)
 * @param {object} handlers { onReroute(), onArrive() } ; options de createGuidance (destination, durationSec, quietUntil)
 */
export function startGuidance(route, { destination, durationSec, quietUntil = 0, textOf, onReroute, onArrive } = {}) {
  active = {
    guidance: createGuidance({ steps: route?.leg?.steps, path: route?.path, destination, durationSec, quietUntil, textOf }),
    onReroute,
    onArrive,
  };
}

/** Arrête le guidage ; clear : oublie aussi les annonces pas encore dites (bouton « Arrêter »). */
export function stopGuidance({ clear = false } = {}) {
  active = null;
  if (clear) queue = [];
}

export const isGuiding = () => active !== null;

/** Annonce dite dès que la voix se tait (sans couper la phrase en cours). */
export function announce(text, now = Date.now()) {
  say(text, "info", now);
  flush(now);
}

/** Appelée à chaque position GPS (app-core.js). */
export function onGpsFix(lat, lng, { moving = false, accuracy = 0, now = Date.now() } = {}) {
  wasRiding = moving;
  const back = gpsWatch.fix(now);
  if (back) say(back, "info", now);

  if (active) {
    const current = active;
    for (const ev of current.guidance.update({ lat, lng }, now, { accuracy })) {
      if (ev.kind === "arrive") queue = []; // plus aucune consigne de virage après l'arrivée
      say(ev.text, ev.kind, now);
      if (ev.kind === "reroute") current.onReroute?.();
      if (ev.kind === "arrive") {
        active = null;
        current.onArrive?.();
      }
    }
  }

  const pause = rideTimer.tick(now, moving);
  if (pause) say(pause, "info", now);
  flush(now);
}

/** Vérifiée toutes les 5 s : plus de position depuis 20 s alors qu'on roulait ou qu'on était guidé. */
export function checkGpsLoss(now = Date.now()) {
  const lost = gpsWatch.check(now, wasRiding || active !== null);
  if (lost) {
    say(lost, "info", now);
    flush(now);
  }
}

if (typeof window !== "undefined" && typeof setInterval === "function" && !window.__routeGuidanceTimer) {
  window.__routeGuidanceTimer = setInterval(() => checkGpsLoss(), 5000);
}
