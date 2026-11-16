/**
 * route-planner.js — Itinéraire sans autoroute : recherche de la destination, calcul (IGN, par le
 * DirectionsService souverain de gmaps-compat.js), tracé sur la carte, bandeau de guidage, annonces
 * vocales et ouverture dans l'application GPS du téléphone.
 *
 * Sorti de app-map.js (étape 5 du plan de dette technique, tranche 5, 14/11/2026). Corrigé au passage :
 * - deux recherches rapprochées dessinaient deux itinéraires, et une recherche annulée pouvait encore
 *   s'afficher (ou annoncer « Guidage interne démarré ») après « Arrêter » : seul le dernier calcul
 *   demandé est affiché, et les annonces en attente tombent à l'annulation ;
 * - l'alerte « ferry » continuait après l'annulation ; le bouton d'annulation de la recherche restait
 *   affiché ; la durée restait en rouge après un itinéraire sous la pluie ;
 * - l'icône de manœuvre se fiait au texte (« Rue de la Rive Gauche » donnait un virage à gauche) :
 *   elle suit maintenant la manœuvre calculée par l'IGN ;
 * - distances au format français (« 12,3 km ») et lien GPS jamais construit sans coordonnées.
 * Retiré : appel à startPremiumNavigation (définie nulle part), journaux NeuralHUD et Telemetry
 * (fichiers supprimés à l'étape 1), titre .route-title et DirectionsRenderer (absents de la page).
 */
import { registerAction } from "./actionRegistry.js";
import { readLatLng, formatDistance, formatDuration } from "./map-engine.js";
import { speak } from "./voice-engine.js";
import { departureMessage, rerouteMessage, startGuidance, stopGuidance, isGuiding, announce } from "./route-guidance.js";

/** Vitesse moyenne réaliste d'un 50 cc, arrêts compris (32 km/h). */
export const AVG_SPEED_MS = 32 / 3.6;
/** Feux et priorités en ville : +20 % sur la durée calculée par l'IGN (déjà plafonnée à 45 km/h). */
export const CITY_FACTOR = 1.2;
/** Durée affichée quand la météo est dangereuse sur l'itinéraire : +20 %. */
export const WEATHER_FACTOR = 1.2;
/** Passager sur un deux-roues 50 cc : +10 % (accélérations et montées plus lentes). Estimation, pas une mesure. */
export const DUO_FACTOR = 1.1;

// Deux-roues 50 cc (vehicle-config-screen.html) : seuls véhicules où un passager ralentit vraiment le trajet.
// Pas la VSP (voiture), ni le vélo, ni la trottinette (passager interdit, art. R412-43-1).
const TWO_WHEEL_50CC = new Set(["2t", "4t", "moto"]);

// ---------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------

/** Mode de calcul : vélo pour les vélos et trottinettes, voiture (sans autoroute) sinon. */
export function travelModeFor(motor) {
  return motor === "trottinette" || motor === "velo" ? "BICYCLING" : "DRIVING";
}

const legDistance = (route) => Number(route?.legs?.[0]?.distance?.value) || 0;

/** Itinéraire retenu : le premier, ou le plus long quand on évite les centres-villes. */
export function pickRouteIndex(routes, avoidCityCenters = false) {
  if (!avoidCityCenters || !Array.isArray(routes) || routes.length < 2) return 0;
  let best = 0;
  routes.forEach((r, i) => {
    if (legDistance(r) > legDistance(routes[best])) best = i;
  });
  return best;
}

/** { path, leg } à partir d'un DirectionsResult (format Google, voir gmaps-compat.js), sinon null. */
export function routeFromDirections(result, { avoidCityCenters = false } = {}) {
  const routes = result?.routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  const route = routes[pickRouteIndex(routes, avoidCityCenters)];
  const raw = route?.legs?.[0];
  if (!raw) return null;
  return {
    path: route.overview_path || [],
    leg: {
      distance: raw.distance,
      duration: raw.duration,
      distanceMeters: Number(raw.distance?.value) || 0,
      durationSec: Number(raw.duration?.value) || 0,
      steps: (raw.steps || []).map((s) => ({
        instructions: s.instructions || "",
        maneuver: s.maneuver || "",
        distance: s.distance,
        distanceMeters: Number(s.distance?.value) || 0,
        duration: s.duration,
        durationSec: Number(s.duration?.value) || 0,
        start_location: s.start_location,
        end_location: s.end_location,
      })),
    },
  };
}

/** Trajet en duo sur un deux-roues 50 cc (profil du véhicule, vehicle-config.js) ? */
export function isDuoRide(session) {
  return session?.crewMode === "duo" && TWO_WHEEL_50CC.has(session?.motor || "2t");
}

/**
 * Durée annoncée : +20 % en ville, jamais plus rapide que 32 km/h de moyenne, puis +10 % en duo
 * (options.duo, voir isDuoRide).
 */
export function estimateDurationSec(durationSec, distanceMeters, { duo = false } = {}) {
  let sec = Math.round((Number(durationSec) || 0) * CITY_FACTOR);
  const dist = Number(distanceMeters) || 0;
  if (dist > 0 && (sec <= 0 || dist / sec > AVG_SPEED_MS)) sec = Math.round(dist / AVG_SPEED_MS);
  return duo ? Math.round(sec * DUO_FACTOR) : sec;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Consigne en texte brut (celles de l'IGN le sont déjà ; celles de Google contenaient du HTML). */
export function instructionText(step) {
  return String(step?.instructions ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_m, e) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();
}

const ICONS = {
  left: { className: "fa-solid fa-arrow-turn-up", transform: "scaleX(-1) rotate(90deg)" },
  right: { className: "fa-solid fa-arrow-turn-up", transform: "rotate(90deg)" },
  roundabout: { className: "fa-solid fa-arrows-spin", transform: "rotate(0deg)" },
  uturn: { className: "fa-solid fa-rotate-left", transform: "rotate(0deg)" },
  straight: { className: "fa-solid fa-arrow-up", transform: "rotate(0deg)" },
};

/** Sens de la manœuvre : celui calculé par l'IGN (« turn-left »…), sinon déduit de la consigne. */
export function maneuverKind(step) {
  const m = String(step?.maneuver || "").toLowerCase();
  if (m) {
    if (m.includes("roundabout")) return "roundabout";
    if (m.startsWith("uturn")) return "uturn";
    if (m.includes("left")) return "left";
    if (m.includes("right")) return "right";
    return "straight";
  }
  const text = instructionText(step).toLowerCase();
  if (text.includes("gauche")) return "left";
  if (text.includes("droite")) return "right";
  if (text.includes("rond-point")) return "roundabout";
  return "straight";
}

/** Icône Font Awesome de la manœuvre : { className, transform }. */
export function maneuverIcon(step) {
  return ICONS[maneuverKind(step)];
}

/** Étapes qui traversent en ferry (alerte à l'approche : checkFerryProximity, app-features.js). */
export function ferrySteps(steps) {
  return (steps || []).filter((s) => instructionText(s).toLowerCase().includes("ferry"));
}

/** Heure d'arrivée « 14:35 ». */
export function arrivalTimeText(durationSec, now = Date.now()) {
  return new Date(now + (Number(durationSec) || 0) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Lien vers l'application GPS du téléphone (Waze, Plans, OsmAnd… au choix de l'utilisateur, jamais
 * Google imposé), ou null sans coordonnées. Attention : l'itinéraire sans autoroute est celui calculé
 * dans l'application ; une application externe peut en proposer un autre.
 */
export function nativeGpsUrl(dest, userAgent = "") {
  const p = readLatLng(dest);
  if (!p) return null;
  const { lat, lng } = p;
  if (/Android/i.test(userAgent)) return `geo:${lat},${lng}?q=${lat},${lng}`;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return `maps://?daddr=${lat},${lng}&dirflg=d`;
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=15/${lat}/${lng}`;
}

// ---------------------------------------------------------------------------
// Carte et écran
// ---------------------------------------------------------------------------

let routeLayers = []; // tracé et drapeau d'arrivée de l'itinéraire affiché
let routeTicket = 0; // numéro du dernier calcul demandé : les réponses plus anciennes sont ignorées

const byId = (id) => document.getElementById(id);
const setText = (id, text) => {
  const el = byId(id);
  if (el) el.textContent = text;
};

function clearRouteLayers() {
  routeLayers.forEach((layer) => {
    try {
      layer.setMap(null);
    } catch {
      /* déjà retiré de la carte */
    }
  });
  routeLayers = [];
}

/** Annonce différée, abandonnée si l'itinéraire a été annulé ou remplacé entre-temps. */
function later(ticket, ms, fn) {
  setTimeout(() => {
    if (ticket === routeTicket) fn();
  }, ms);
}

function requestDirections(origin, destination) {
  const g = window.google?.maps;
  if (!g?.DirectionsService) return Promise.reject(new Error("carte non chargée"));
  const request = {
    origin: new g.LatLng(origin.lat, origin.lng),
    destination: new g.LatLng(destination.lat, destination.lng),
    travelMode: g.TravelMode?.[travelModeFor(window.session?.motor)] || g.TravelMode?.DRIVING || "DRIVING",
    avoidHighways: true, // Code de la route R421-2 : autoroutes interdites aux 50 cc et VSP
    avoidTolls: true,
    provideRouteAlternatives: !!(window.isRodageActive || window.avoidCityCenters),
  };
  return new Promise((resolve, reject) => {
    new g.DirectionsService().route(request, (res, status) => {
      if (status === g.DirectionsStatus.OK && res?.routes?.length > 0) resolve(res);
      else reject(new Error(`DirectionsService : ${status}`));
    });
  });
}

/** Météo dangereuse à l'arrivée (SafeRide, safe-ride.js) : alerte vocale et durée allongée de 20 %. */
function showWeatherDelay(ticket, durationSec, destination) {
  window.SafeRide.checkWeatherForRoute(destination.lat, destination.lng).then((weather) => {
    if (ticket !== routeTicket || !weather?.isDangerous) return;
    const issues = (weather.issues || []).join(" et ");
    later(ticket, 9000, () =>
      speak(`Alerte Safe Ride : ${issues} sur votre itinéraire. Équipez-vous et soyez très prudent avant de prendre la route.`),
    );
    const timeEl = byId("nav-time");
    const etaEl = byId("nav-eta");
    if (!timeEl || !etaEl) return;
    const slower = Math.round(durationSec * WEATHER_FACTOR);
    timeEl.textContent = `${formatDuration(slower)} (Météo)`;
    etaEl.textContent = arrivalTimeText(slower);
    timeEl.style.color = "#ff4d4d";
    etaEl.style.color = "#ff4d4d";
  });
}

function showRoute(ticket, route, destination, { reroute = false } = {}) {
  const { path, leg } = route;
  const g = window.google.maps;
  const map = window.map;

  routeLayers.push(new g.Polyline({ path, map, strokeColor: "#00d2ff", strokeOpacity: 0.8, strokeWeight: 6 }));
  if (path.length > 0) {
    const bounds = new g.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds);
  }

  const durationSec = estimateDurationSec(leg.durationSec, leg.distanceMeters, { duo: isDuoRide(window.session) });
  const distText = formatDistance(leg.distanceMeters);
  const etaText = arrivalTimeText(durationSec);

  byId("nav-info-bar")?.style.setProperty("display", "flex", "important");
  byId("btn-stop-nav")?.classList.remove("hidden");
  setText("nav-dist", distText);
  setText("nav-time", formatDuration(durationSec));
  setText("nav-eta", etaText);
  ["nav-time", "nav-eta"].forEach((id) => {
    const el = byId(id);
    if (el) el.style.color = ""; // couleur d'une éventuelle alerte météo précédente
  });

  // Bandeau de guidage : première consigne
  byId("nav-instruction")?.classList.remove("hidden");
  const first = leg.steps[0];
  if (first) {
    const text = instructionText(first);
    const dist = formatDistance(first.distanceMeters);
    setText("next-step-name", text);
    setText("next-step-dist", dist);
    const icon = document.querySelector("#nav-instruction .nav-icon i");
    if (icon) {
      const { className, transform } = maneuverIcon(first);
      icon.className = className;
      icon.style.transform = transform;
    }
    // Après l'annonce de l'heure d'arrivée. La consigne 0 se fait au départ : « Dans … » viendra
    // avec le premier virage (route-guidance.js).
    if (!reroute) later(ticket, 6000, () => speak(`Guidage démarré. ${text}.`));
  }

  window.routeFerries = ferrySteps(leg.steps);
  window.lastSpokenFerryIndex = -1;
  if (window.routeFerries.length > 0 && !reroute) later(ticket, 4000, () => speak("ferry_detected"));

  // Recalcul : dit après « Recalcul de l'itinéraire. », sans le couper
  if (reroute) announce(rerouteMessage(distText, etaText));
  else speak(departureMessage(distText, etaText, { rodage: !!window.isRodageActive }));

  // Guidage pendant le trajet : virages, temps restant, recalcul, arrivée
  startGuidance(route, {
    destination,
    durationSec,
    quietUntil: Date.now() + (reroute ? 0 : 9000), // laisse finir les annonces de départ
    textOf: instructionText,
    onReroute: () => rerouteFromHere(destination),
    onArrive: () => cancelRoute({ silent: true }),
  });

  if (window.SafeRide?.checkWeatherForRoute) showWeatherDelay(ticket, durationSec, destination);

  const Marker = window.googleLibraries?.AdvancedMarkerElement;
  if (Marker) {
    const flag = document.createElement("div");
    flag.style.color = "white";
    flag.style.fontSize = "24px";
    flag.style.textShadow = "0 0 5px black";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-flag-checkered";
    flag.appendChild(icon);
    routeLayers.push(new Marker({ position: destination, map, content: flag }));
  }
}

/**
 * Calcule et affiche l'itinéraire sans autoroute de start à end ({lat, lng}, LatLng ou {lat, lon}).
 * Renvoie l'itinéraire affiché ({ path, leg }) ou null.
 */
export async function calculateRouteSansAutoroute(start, end, { reroute = false } = {}) {
  const origin = readLatLng(start);
  const destination = readLatLng(end);
  if (!origin || !destination) {
    console.error("[Itinéraire] Départ ou arrivée invalide.", { start, end });
    if (!origin) speak("Signal GPS insuffisant pour démarrer l'itinéraire.");
    return null;
  }

  window.currentRouteDestination = end; // pour le bouton « GO » (application GPS du téléphone)
  const ticket = ++routeTicket;
  if (!reroute) {
    stopGuidance(); // nouvel itinéraire demandé : l'ancien guidage s'arrête
    clearRouteLayers();
  }

  let route = null;
  try {
    route = routeFromDirections(await requestDirections(origin, destination), {
      avoidCityCenters: !!window.avoidCityCenters,
    });
  } catch (err) {
    console.warn("[Itinéraire] Aucun itinéraire :", err.message);
  }
  if (ticket !== routeTicket) return null; // annulé ou remplacé pendant le calcul

  // Pas de repli OSRM : le serveur public ne sait pas exclure les autoroutes, interdites aux 50 cc.
  if (!route) {
    speak("Impossible de calculer l'itinéraire pour le moment. Vérifiez votre connexion.");
    return null;
  }

  try {
    clearRouteLayers(); // recalcul : l'ancien tracé restait affiché jusqu'ici
    showRoute(ticket, route, destination, { reroute });
  } catch (err) {
    console.error("[Itinéraire] Affichage impossible :", err);
    speak("Erreur de calcul d'itinéraire.");
  }
  return route;
}

let rerouting = false;

/** Sorti du tracé : nouvel itinéraire depuis la position actuelle (un seul calcul à la fois). */
async function rerouteFromHere(destination) {
  if (rerouting || !window.currentPosition) return;
  rerouting = true;
  try {
    await calculateRouteSansAutoroute(window.currentPosition, destination, { reroute: true });
  } finally {
    rerouting = false;
  }
}

/** Bouton « Arrêter » : annonce « Itinéraire annulé. » ; options.silent à l'arrivée. */
export function cancelRoute(options) {
  const silent = options?.silent === true;
  const wasActive = routeLayers.length > 0 || isGuiding();
  routeTicket++; // calcul en cours et annonces en attente abandonnés
  stopGuidance({ clear: !silent });
  clearRouteLayers();
  if (!silent && wasActive) speak("Itinéraire annulé.");
  window.routeFerries = [];

  byId("nav-instruction")?.classList.add("hidden");
  const navBar = byId("nav-info-bar");
  if (navBar) navBar.style.setProperty("display", "none");
  ["btn-stop-nav", "btn-reroute", "btn-cancel-route"].forEach((id) => byId(id)?.classList.add("hidden"));

  const search = byId("route-search");
  if (search) search.value = "";
}

export function toggleManualStart() {
  const box = byId("manual-start-box");
  if (!box) return;
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) byId("route-start")?.focus();
}

function geocodeOne(address) {
  return new Promise((resolve) => {
    window.geocoder.geocode({ address }, (results, status) => {
      resolve(status === "OK" && results?.[0] ? results[0].geometry.location : null);
    });
  });
}

/** Bouton « Rechercher » : départ saisi ou position GPS, vers la destination saisie. */
export async function searchDestination() {
  const query = (byId("route-search")?.value || "").trim();
  const startQuery = (byId("route-start")?.value || "").trim();
  if (!query) return;

  if (!window.geocoder || !window.map) {
    speak("Carte en cours de chargement, veuillez patienter.");
    return;
  }

  // Départ saisi à la main
  if (startQuery) {
    const startPos = await geocodeOne(startQuery);
    if (!startPos) {
      speak("Lieu de départ introuvable.");
      return;
    }
    const dest = await geocodeOne(query);
    if (!dest) {
      speak("Destination introuvable.");
      return;
    }
    window.currentRouteDestination = dest;
    calculateRouteSansAutoroute(startPos, dest);
    return;
  }

  // Départ à la position GPS : la recherche reprendra au premier signal (updatePosition, app-core.js)
  if (!window.currentPosition) {
    speak("Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.");
    window.pendingDestinationName = query;
    return;
  }

  const dest = await geocodeOne(query);
  if (!dest) {
    speak("Destination introuvable.");
    return;
  }
  window.currentRouteDestination = dest;
  calculateRouteSansAutoroute(window.currentPosition, dest);
  window.map.panTo(dest);
  byId("btn-cancel-route")?.classList.remove("hidden");
}

/** Bouton « GO » : ouvre la destination dans l'application GPS du téléphone. */
export function launchNativeGPS() {
  const url = nativeGpsUrl(window.currentRouteDestination, navigator.userAgent);
  if (!url) return;
  if (url.startsWith("http")) window.open(url, "_blank", "noopener");
  else window.location.href = url;
}

// Appelées par les boutons de la page (data-action) et par d'autres modules (assistant vocal,
// roadbooks, mode rodage…) à travers window.
const PUBLIC = { calculateRouteSansAutoroute, cancelRoute, toggleManualStart, searchDestination, launchNativeGPS };
for (const [name, fn] of Object.entries(PUBLIC)) {
  registerAction(name, fn);
  window[name] = fn;
}
