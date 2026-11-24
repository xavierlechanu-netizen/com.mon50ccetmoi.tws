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

/** Fête des mères (France) : dernier dimanche de mai, ou 1er dimanche de juin si c'est la Pentecôte. */
export function mothersDay(year) {
  const d = new Date(year, 4, 31);
  d.setDate(31 - d.getDay());
  const pentecost = easterSunday(year);
  pentecost.setDate(pentecost.getDate() + 49);
  if (d.getTime() === pentecost.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

/** Fête des pères : 3e dimanche de juin. */
export function fathersDay(year) {
  const first = new Date(year, 5, 1);
  return new Date(year, 5, 1 + ((7 - first.getDay()) % 7) + 14);
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
  if (month === 2 && day === 2) return { name: "Chandeleur", color: "#e0a800", message: "🥞 Bonne Chandeleur ! Crêpes à l'arrivée." };
  if (month === 2 && day === 14) return { name: "Saint-Valentin", color: "#e0245e", message: "💘 Bonne Saint-Valentin ! Roulez prudemment, on vous attend." };
  if (fromEaster >= -2 && fromEaster <= 1) return { name: "Pâques", color: "#2e9e4f", message: "🐣 Joyeuses Pâques et bonne balade !" };
  if (month === 5 && day === 1) return { name: "1er Mai", color: "#2e9e4f", message: "🌿 Bon 1er Mai ! Un brin de muguet et bonne route." };
  if (month === 5 && day === 8) return { name: "8 Mai", color: null, message: "🇫🇷 8 mai 1945 : souvenons-nous." };
  if (today.getTime() === mothersDay(date.getFullYear()).getTime()) return { name: "Fête des mères", color: "#e0245e", message: "💐 Bonne fête à toutes les mamans !" };
  if (today.getTime() === fathersDay(date.getFullYear()).getTime()) return { name: "Fête des pères", color: "#0055a4", message: "👔 Bonne fête à tous les papas !" };
  if (month === 6 && day === 21) return { name: "Fête de la musique", color: "#8a2be2", message: "🎶 Bonne Fête de la musique ! Pas d'écouteurs en roulant." };
  if (month === 7 && (day === 13 || day === 14)) return { name: "14 Juillet", color: "#0055a4", message: "🇫🇷 Bonne fête nationale !", fireworks: true };
  if (month === 10 && day === 31) return { name: "Halloween", color: "#ff6a00", message: "🎃 Joyeux Halloween !" };
  if (month === 10) return { name: "Octobre Rose", color: "#ff007f", message: "🎀 Octobre Rose : pensez au dépistage." };
  if (month === 11 && day === 11) return { name: "11 Novembre", color: null, message: "🇫🇷 11 novembre 1918 : souvenons-nous." };
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
