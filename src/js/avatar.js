/**
 * avatar.js — Avatar aux initiales, fabriqué dans le téléphone.
 *
 * Avant (corrigé le 7/11/2026) : le pseudo de chaque pilote était envoyé au service
 * américain ui-avatars.com pour fabriquer son avatar (transfert d'une donnée personnelle
 * hors UE, sans consentement). Plus aucun envoi : l'image est une petite SVG locale.
 */

export function initialsOf(name) {
  const words = String(name || "").trim().split(/[\s._-]+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || "P").slice(0, 2);
  return letters.toUpperCase().replace(/[^A-Z0-9À-Ý]/g, "") || "P";
}

/** URL data: d'un avatar rond (fond sombre, initiales colorées). */
export function initialsAvatar(name, color = "#ffffff", background = "#111111") {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="64" fill="${background}"/>` +
    `<text x="64" y="64" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" ` +
    `font-size="52" font-weight="bold" fill="${color}">${initialsOf(name)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
