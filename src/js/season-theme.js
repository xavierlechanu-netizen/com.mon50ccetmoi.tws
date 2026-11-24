/**
 * season-theme.js — Les thèmes qui changent pendant l'année : couleur du trajet et message d'accueil.
 * Calculé sur le téléphone, sans serveur. Les animations restent sur le tableau de bord, jamais en conduite.
 */

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus). */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** La fête du jour, ou null. Du vendredi saint au lundi pour Pâques ; l'Épiphanie couvre son dimanche. */
export function seasonOf(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const easter = easterSunday(date.getFullYear());
  const today = new Date(date.getFullYear(), date.getMonth(), day);
  const fromEaster = Math.round((today - easter) / 86400000);

  if (month === 1 && day <= 2) return { name: "Nouvel An", color: null, message: "🎆 Bonne année et bonne route !", fireworks: true };
  if (month === 1 && day <= 8) return { name: "Épiphanie", color: "#e0a800", message: "👑 Bonne Épiphanie ! Qui aura la fève ?" };
  if (fromEaster >= -2 && fromEaster <= 1) return { name: "Pâques", color: "#2e9e4f", message: "🐣 Joyeuses Pâques et bonne balade !" };
  if (month === 7 && (day === 13 || day === 14)) return { name: "14 Juillet", color: "#0055a4", message: "🇫🇷 Bonne fête nationale !", fireworks: true };
  if (month === 10 && day === 31) return { name: "Halloween", color: "#ff6a00", message: "🎃 Joyeux Halloween !" };
  if (month === 10) return { name: "Octobre Rose", color: "#ff007f", message: "🎀 Octobre Rose : pensez au dépistage." };
  if (month === 12 && day >= 20 && day <= 26) return { name: "Noël", color: "#d6001c", message: "🎄 Joyeux Noël et bonne route !" };
  return null;
}

/** Couleur du trajet : la fête du jour, sinon le thème Rose débloqué, sinon la couleur habituelle. */
export function routeColor(fallback, date = new Date()) {
  const festive = seasonOf(date)?.color;
  if (festive) return festive;
  try {
    if (localStorage.getItem("unlockedTheme_Pink") === "true") return "#ff007f";
  } catch {
    // Stockage indisponible : le trajet doit quand même s'afficher.
  }
  return fallback;
}
