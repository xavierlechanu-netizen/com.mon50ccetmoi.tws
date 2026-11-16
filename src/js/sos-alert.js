/**
 * Alerte SOS (chute détectée ou SOS manuel) — 15/11/2026.
 *
 * Avant : l'appli annonçait « Ange(s) Gardien(s) notifiés par SMS » alors qu'aucun SMS n'était
 * jamais parti (file Firestore que rien ne lisait), avec une position fictive.
 * Maintenant :
 *  1. vraie position GPS ;
 *  2. envoi automatique des SMS par le serveur souverain (OVHcloud) quand l'appli y est connectée,
 *     et succès annoncé SEULEMENT si le serveur confirme l'envoi ;
 *  3. sinon, l'appli le dit et propose en un geste : appeler le 112, ou envoyer sa position par SMS
 *     depuis le téléphone (application SMS pré-remplie).
 */

const FRESH_MS = 2 * 60 * 1000;

/** Lien de carte (OpenStreetMap) vers une position. */
export function mapLink(pos) {
  const lat = pos.lat.toFixed(5);
  const lng = pos.lng.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/** Texte du SMS envoyé depuis le téléphone du pilote. */
export function sosText(pos, kind = "fall") {
  const debut = kind === "manual"
    ? "ALERTE SOS mon50ccetmoi : j'ai besoin d'aide."
    : "ALERTE SOS mon50ccetmoi : j'ai peut-être chuté et j'ai besoin d'aide.";
  const ou = pos ? ` Ma position : ${mapLink(pos)}` : " Ma position n'a pas pu être obtenue.";
  return `${debut}${ou} Si je ne réponds pas, appelez le 112.`;
}

/** Numéros nettoyés (chiffres et « + »), sans doublons ni vides. */
export function cleanNumbers(list) {
  return [...new Set((list || []).map((n) => String(n || "").replace(/[^\d+]/g, "")).filter((n) => n.length >= 6))];
}

/** Lien qui ouvre l'application SMS pré-remplie (syntaxe iPhone ou Android). */
export function smsHref(numbers, text, userAgent = "") {
  const body = encodeURIComponent(text);
  const nums = cleanNumbers(numbers);
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return nums.length > 1 ? `sms:/open?addresses=${nums.join(",")}&body=${body}` : `sms:${nums[0] || ""}&body=${body}`;
  }
  return `sms:${nums.join(",")}?body=${body}`;
}

/** Position actuelle : celle de l'appli si elle est récente, sinon une nouvelle mesure GPS (null si impossible). */
export function getSosPosition({ win = globalThis, timeoutMs = 8000 } = {}) {
  const cur = win.currentPosition;
  if (cur && Number.isFinite(cur.lat) && Number.isFinite(cur.lng) &&
      (!cur.timestamp || Date.now() - cur.timestamp < FRESH_MS)) {
    return Promise.resolve({ lat: cur.lat, lng: cur.lng, accuracy: cur.accuracy });
  }
  const geo = win.navigator && win.navigator.geolocation;
  if (!geo) return Promise.resolve(null);
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

/**
 * Envoi automatique par le serveur souverain. Renvoie toujours { sent, reason } :
 * sent > 0 seulement si le serveur a confirmé l'envoi.
 */
export async function sendSosAuto({ position, contacts, kind }, { client = globalThis.sovereignClient } = {}) {
  if (!contacts || contacts.length === 0) return { sent: 0, reason: "Aucun ange gardien enregistré." };
  if (!position) return { sent: 0, reason: "Position GPS introuvable." };
  if (!client || typeof client.sendSos !== "function") {
    return { sent: 0, reason: "L'envoi automatique des SMS n'est pas encore en service." };
  }
  // Jeton SOS (30 jours) obtenu à la connexion par mot de passe : voir sovereign-session.js
  if (!client.sosToken && !client.token) {
    return { sent: 0, reason: "L'envoi automatique des SMS n'est pas activé sur ce téléphone." };
  }
  try {
    const res = await client.sendSos({ lat: position.lat, lng: position.lng, accuracy: position.accuracy, contacts, kind });
    const sent = Number(res && res.sent) || 0;
    return sent > 0 ? { sent } : { sent: 0, reason: "Aucun SMS n'a pu partir." };
  } catch (e) {
    return { sent: 0, reason: (e && e.message) || "L'envoi des SMS a échoué." };
  }
}
