/**
 * hazard-alerts.js — Alertes de danger pendant la conduite : à chaque position GPS, on regarde
 * les dangers signalés autour du pilote et on prévient (voix, écran rouge, « Toujours là ? »).
 *
 * Sorti de app-core.js (étape 5 du plan de dette technique, 7/11/2026). Corrigé au passage :
 * - un danger était reconnu par la somme latitude + longitude : deux dangers différents ayant
 *   la même somme se masquaient l'un l'autre. Il est maintenant reconnu par ses coordonnées ;
 * - le type de danger (texte saisi par un utilisateur) était inséré comme du HTML.
 */
import { secureGetItem, secureSetItem } from "./config.js";
import { distanceMeters } from "./geo-math.js";
import { speak, vibrate } from "./voice-engine.js";

/** Distances et durée des alertes */
export const HAZARD_RULES = {
  RED_ALERT_RADIUS_M: 1000, // conduite dangereuse signalée (« danger immédiat »)
  RED_ALERT_MAX_AGE_MIN: 15, // au-delà, le signalement est trop ancien
  ANIMAL_RADIUS_M: 500, // animaux : on prévient plus tôt
  STANDARD_RADIUS_M: 100, // autres dangers (trou, gravillons…)
};

/** Identifiant d'un danger : ses coordonnées */
export function hazardKey(h) {
  return `${h.lat},${h.lon}`;
}

/**
 * Quelle alerte donner pour ce danger, à cette distance ? (fonction pure, testée)
 * @returns {"red"|"animal"|"standard"|null}
 */
export function hazardAlertFor(h, distance, now = Date.now()) {
  if (!h || !Number.isFinite(distance)) return null;
  if (h.type === "danger_immediat") {
    const ageMin = (now - new Date(h.date).getTime()) / 60000;
    return distance < HAZARD_RULES.RED_ALERT_RADIUS_M && ageMin <= HAZARD_RULES.RED_ALERT_MAX_AGE_MIN ? "red" : null;
  }
  if (h.type === "animal" || h.type === "chien") {
    return distance < HAZARD_RULES.ANIMAL_RADIUS_M ? "animal" : null;
  }
  return distance < HAZARD_RULES.STANDARD_RADIUS_M ? "standard" : null;
}

function readHazards() {
  try {
    const raw = secureGetItem("hazards");
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return []; // stockage illisible : aucune alerte plutôt qu'un plantage en pleine route
  }
}

// Dangers déjà annoncés. Avant, seul le dernier était retenu : avec deux dangers proches,
// l'app les répétait en boucle à chaque position GPS.
const announced = new Set();
// Un danger annoncé peut l'être de nouveau quand on s'en est éloigné (prochain passage)
const FORGET_DISTANCE_M = 2000;

/** Appelée à chaque position GPS (app-core.js, updatePosition) */
export function checkHazardProximity(lat, lng) {
  readHazards().forEach((h, index) => {
    const dist = distanceMeters(lat, lng, h.lat, h.lon);
    const key = hazardKey(h);
    if (dist > FORGET_DISTANCE_M) announced.delete(key);

    const alert = hazardAlertFor(h, dist);
    if (!alert || announced.has(key)) return;
    announced.add(key);

    if (alert === "red") {
      triggerRedAlert(Math.round(dist), h.description || "");
      return;
    }
    speak(
      alert === "animal"
        ? `Attention, ${h.type} signalé à environ 500 mètres. Restez vigilant.`
        : `Attention : ${h.type} signalé à proximité.`,
    );
    showHazardConfirmation(index, h.type);
  });
}

/** Conduite dangereuse signalée devant : annonce vocale + bord de l'écran rouge clignotant */
export function triggerRedAlert(distance, description) {
  let alertMsg = "Attention, conduite dangereuse signalée";
  if (description) alertMsg += ` : ${description}`;
  alertMsg += ` à ${distance} mètres devant vous. Restez vigilant.`;
  speak(alertMsg);

  const overlay = document.createElement("div");
  overlay.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; box-shadow: inset 0 0 50px 20px rgba(255, 0, 0, 0.8); z-index:999999; pointer-events:none; transition: opacity 0.5s;";
  document.body.appendChild(overlay);

  let count = 0;
  const interval = setInterval(() => {
    overlay.style.opacity = count % 2 === 0 ? "0" : "1";
    count++;
    if (count > 10) {
      clearInterval(interval);
      overlay.remove();
    }
  }, 500);
}

/** Petite fenêtre « Toujours là : <danger> ? » (8 secondes) */
export function showHazardConfirmation(index, type) {
  const toast = document.createElement("div");
  toast.className = "hazard-toast glassmorphism";

  const question = document.createElement("p");
  const label = document.createElement("strong");
  label.textContent = String(type);
  question.append("Toujours là : ", label, " ?");

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex; gap:10px;";
  const yes = document.createElement("button");
  yes.setAttribute("data-action", `confirmHazard(${Number(index)}, true)`);
  yes.textContent = "✅ Oui";
  const no = document.createElement("button");
  no.setAttribute("data-action", `confirmHazard(${Number(index)}, false)`);
  no.textContent = "❌ Non";
  buttons.append(yes, no);

  toast.append(question, buttons);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

/** Réponse à « Toujours là ? » : « Non » retire le signalement de la liste locale */
export function confirmHazard(index, exists) {
  if (!exists) {
    const hazards = readHazards();
    hazards.splice(index, 1);
    secureSetItem("hazards", JSON.stringify(hazards));
    if (typeof window.loadHazards === "function") window.loadHazards();
    speak("Merci, signalement mis à jour.");
  } else {
    speak("Merci de votre vigilance.");
  }
  const toast = document.querySelector(".hazard-toast");
  if (toast) toast.remove();
  vibrate(30);
}

window.triggerRedAlert = triggerRedAlert;
window.confirmHazard = confirmHazard;
