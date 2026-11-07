/**
 * weather-advice.js — Conseil météo de l'Assistant Trajet, à partir de la VRAIE météo.
 *
 * Avant (corrigé le 7/11/2026) : l'Assistant Trajet tirait un message au hasard
 * (« Risque de pluie dans 15 min », « Route sèche et dégagée »…) et la bulle météo
 * affichait une température et un vent inventés. Pour une app de sécurité routière,
 * annoncer une route sèche sous la pluie est dangereux.
 *
 * Données : météo actuelle Open-Meteo (codes météo OMM/WMO), récupérée par fetchWeather.
 * Les messages décrivent les conditions ACTUELLES : aucune prévision n'est inventée.
 */

// Codes météo WMO utilisés par Open-Meteo
const STORM = [95, 96, 99];
const ICY = [56, 57, 66, 67, 71, 73, 75, 77, 85, 86]; // bruine/pluie verglaçante, neige
const RAIN = [51, 53, 55, 61, 63, 65, 80, 81, 82];
const FOG = [45, 48];

export const WEATHER_MAX_AGE_MS = 15 * 60 * 1000;
export const STRONG_WIND_KMH = 50;
export const COLD_TEMP_C = 3;

/**
 * @param {{temp:number, wind:number, code:number}} weather  météo actuelle
 * @param {number} hour  heure locale (0-23)
 * @returns {{type:string, icon:string, color:string, message:string}}
 */
export function describeWeather(weather, hour) {
  const temp = Number(weather?.temp);
  const wind = Number(weather?.wind);
  const code = Number(weather?.code);
  const isNight = hour >= 20 || hour < 6;

  if (STORM.includes(code)) {
    return { type: "storm", icon: "fa-cloud-bolt", color: "#f1c40f",
      message: "Orage en cours sur votre secteur. Évitez de rouler si possible." };
  }
  if (ICY.includes(code)) {
    return { type: "ice", icon: "fa-snowflake", color: "#b3e5fc",
      message: "Neige ou pluie verglaçante en cours. Route glissante : roulez très doucement." };
  }
  if (RAIN.includes(code)) {
    return { type: "rain", icon: "fa-cloud-showers-heavy", color: "#00f2ff",
      message: "Pluie en cours. Chaussée glissante : augmentez vos distances de sécurité." };
  }
  if (FOG.includes(code)) {
    return { type: "fog", icon: "fa-smog", color: "#cfd8dc",
      message: "Brouillard en cours. Allumez vos feux et réduisez votre vitesse." };
  }
  if (Number.isFinite(wind) && wind >= STRONG_WIND_KMH) {
    return { type: "wind", icon: "fa-wind", color: "#ffb703",
      message: `Vent fort (${Math.round(wind)} km/h). Attention aux rafales sur deux-roues.` };
  }
  if (Number.isFinite(temp) && temp <= COLD_TEMP_C) {
    return { type: "cold", icon: "fa-temperature-low", color: "#b3e5fc",
      message: `Il fait ${Math.round(temp)} °C : risque de verglas par endroits. Gants recommandés.` };
  }
  if (isNight) {
    return { type: "night", icon: "fa-moon", color: "#e099ff",
      message: "Trajet de nuit : vérifiez vos feux et portez un équipement visible." };
  }
  return { type: "clear", icon: "fa-sun", color: "#ffd700",
    message: "Pas de pluie actuellement sur votre secteur. Bonne route !" };
}

/** Faut-il (re)demander la météo ? Jamais récupérée, ou plus vieille que 15 minutes. */
export function weatherIsStale(weather, now = Date.now()) {
  return !weather || !Number.isFinite(weather.at) || now - weather.at > WEATHER_MAX_AGE_MS;
}
