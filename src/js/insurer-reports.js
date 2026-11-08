/**
 * Rapports de sinistre vendus aux assureurs : offres, codes de dossier et contenu du rapport scellé.
 * Fonctions pures, partagées par le portail assureur (assureur.html) et l'app (insurance-portal.js).
 *
 * Les prix doivent rester identiques à functions/api/payments-catalog.js, qui fixe le montant
 * réellement encaissé : tests/insurer-reports.test.js échoue s'ils divergent.
 */

export const VAT_RATE = 0.2;

// Libellés du catalogue serveur. Le contenu livré est aujourd'hui le même pour les trois niveaux
// (voir sealedReportRows) : ne pas promettre ici ce que le rapport ne contient pas.
export const OFFERS = [
  { code: "SIMPLE", label: "Rapport Standard", htCents: 4999 },
  { code: "INTERMEDIAIRE", label: "Rapport Approfondi", htCents: 8999 },
  { code: "EXPERT", label: "Expertise complète", htCents: 19999 },
];

export function offerByCode(code) {
  return OFFERS.find((o) => o.code === code) || null;
}

/** Montant TTC en centimes, arrondi comme le serveur (computeAmounts). */
export function ttcCents(htCents) {
  return htCents + Math.round(htCents * VAT_RATE);
}

/** 4999 → "49,99" */
export function formatEuros(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Code de dossier saisi par l'assureur → forme canonique, ou null s'il est invalide.
 * Tolère minuscules et espaces (code dicté au téléphone). Format actuel : LITIGE-XXXX-XXXX-XXXX-XXXX.
 */
export function normalizeCaseCode(input) {
  if (typeof input !== "string") return null;
  const code = input.replace(/\s+/g, "").toUpperCase();
  return /^LITIGE-[A-Z0-9-]{4,57}$/.test(code) ? code : null;
}

/** Un aperçu de dossier est valable 72 h après sa création par le pilote. */
export function isPreviewExpired(preview, now = Date.now()) {
  return typeof preview?.expiresAt === "number" && now > preview.expiresAt;
}

/** Vrai si cet utilisateur a payé le rapport (le serveur l'ajoute à unlocked_for). */
export function hasPaidAccess(caseData, uid) {
  return Boolean(uid) && Array.isArray(caseData?.unlocked_for) && caseData.unlocked_for.includes(uid);
}

function formatDate(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toLocaleString("fr-FR");
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("fr-FR");
  }
  return "—";
}

function withUnit(value, unit) {
  return value != null && value !== "" ? `${value} ${unit}` : "—";
}

function gpsLabel(data) {
  const p = data.gpsIncident || data.telemetry?.gpsIncident;
  return p && p.lat != null && p.lng != null ? `${p.lat}, ${p.lng}` : "—";
}

function timestampLabel(data) {
  if (data.qualified_timestamp) return "Qualifié eIDAS";
  const free = data.free_timestamps;
  if (!free) return "En cours";
  const tsa = free.rfc3161?.genTime ? formatDate(free.rfc3161.genTime) : "échec";
  const ots = free.opentimestamps?.status ? "ancrage en cours" : "échec";
  return `Non qualifié — FreeTSA : ${tsa} · OpenTimestamps (Bitcoin) : ${ots}`;
}

/**
 * Lignes [libellé, valeur] du rapport tel que le serveur l'a scellé au paiement.
 * Les valeurs sont du texte brut : les afficher avec textContent, jamais innerHTML.
 */
export function sealedReportRows(data, uid) {
  const t = data.telemetry || {};
  const ai = data.ai || {};
  const tier = (uid && data.paid_tiers && data.paid_tiers[uid]) || data.paid_tier;
  return [
    ["Dossier", data.caseCode || "—"],
    ["Date de l'incident", data.dateLabel || "—"],
    ["Niveau acheté", offerByCode(tier)?.label || tier || "—"],
    ["Force maximale", withUnit(t.maxG_force, "G")],
    ["Vitesse maximale", withUnit(t.maxSpeed_kmh, "km/h")],
    ["Inclinaison maximale", withUnit(t.maxLeanAngle_deg, "°")],
    ["Position GPS", gpsLabel(data)],
    ["Gravité estimée par l'application", ai.severityScore != null ? `${ai.severityScore} / 100` : "—"],
    // Seulement le nom du niveau : ai.reportDescription est un texte de présentation
    // (« Replay 3D », « Cadastre IGN »…) qui ne décrit pas ce que contient le dossier.
    ["Niveau conseillé par l'application", ai.reportLabel || "—"],
    ["Scellé par le serveur le", formatDate(data.sealed_at)],
    ["Empreinte SHA-256", data.evidence_sha256 || "—"],
    ["Horodatage", timestampLabel(data)],
    ["Intégrité", data.integrity_alert ? "ALERTE : données modifiées après le premier paiement" : "Conforme au sceau"],
  ];
}
