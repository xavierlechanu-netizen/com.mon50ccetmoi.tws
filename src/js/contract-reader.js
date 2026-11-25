/**
 * contract-reader.js — Nexus Atlas lit un contrat d'assurance 50 cc / VSP (25/11/2026, compte GOLD).
 *
 * Tout se passe dans le téléphone : le PDF n'est envoyé nulle part (données personnelles du contrat).
 * Pas d'IA : on cherche les garanties connues et on montre la phrase exacte du contrat. Jamais
 * « vous êtes couvert » : « le contrat en parle », car une phrase peut limiter ou exclure la garantie.
 * shortcut: recherche par mots, pas de compréhension ; un contrat qui dit « vol » seulement dans une
 * exclusion lointaine sera marqué « trouvé ». La phrase citée permet de vérifier ; Mistral plus tard.
 */

/** Garanties d'une assurance deux-roues ou VSP, et ce qui les annonce dans un contrat. */
export const GUARANTEES = [
  { key: "rc", label: "Responsabilité civile (obligatoire)", re: /responsabilite civile|\brc\b/ },
  { key: "defense", label: "Défense pénale et recours", re: /defense (penale )?(et )?recours|recours (et|&) defense/ },
  { key: "conducteur", label: "Garantie du conducteur (vos blessures)", re: /garantie (du |des )?(conducteur|pilote)|garantie corporelle|dommages corporels du conducteur|individuelle (accident|conducteur)/ },
  { key: "vol", label: "Vol", re: /\bvol\b|tentative de vol/ },
  { key: "incendie", label: "Incendie", re: /incendie/ },
  { key: "dommages", label: "Dommages à votre véhicule (tous accidents)", re: /dommages tous accidents|tous risques|dommages (au|du) vehicule|dommages collision/ },
  { key: "assistance", label: "Assistance / dépannage", re: /assistance|depannage|remorquage/ },
  { key: "juridique", label: "Protection juridique", re: /protection juridique/ },
  { key: "equipements", label: "Équipements (casque, gants, blouson)", re: /equipements? (du |de protection )?(pilote|motard|conducteur)|\bcasque\b|\bgants\b|blouson|airbag/ },
  { key: "catnat", label: "Catastrophes naturelles", re: /catastrophes? naturelles?/ },
  { key: "pret", label: "Prêt du véhicule à un autre conducteur", re: /pret (de|du) (guidon|volant|vehicule)|conducteur occasionnel|tout conducteur/ },
];

// Près du mot trouvé, ces tournures peuvent limiter ou exclure la garantie : on le signale
const CAUTION_RE = /\bexclu|\b(non|pas) (couvert|garanti|souscrit|compris|inclus|pris en charge)|ne (sont|couvre|garantit|prend) pas|\bsauf\b|\bhors\b|\boption(nel|nelle)?\b|\bsans\b/;

/** Minuscules sans accents, mêmes positions que le texte d'origine (un caractère pour un caractère). */
export function fold(text) {
  return String(text).toLowerCase().replace(/[À-ſ]/g, (c) => c.normalize("NFD")[0]).replace(/[’`]/g, "'");
}

/** Phrase (ou ligne, pour une liste de garanties) autour d'une position, pour citer le contrat. */
function sentenceAround(text, index, max = 220) {
  const before = Math.max(text.lastIndexOf(".", index), text.lastIndexOf("\n", index));
  let start = before + 1;
  const stops = [text.indexOf(".", index), text.indexOf("\n", index)].filter((i) => i !== -1);
  let end = stops.length ? Math.min(...stops) + 1 : text.length;
  let cut = false;
  if (end - start > max) {
    start = Math.max(start, index - max / 2);
    end = Math.min(end, start + max);
    cut = true;
  }
  let quote = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (cut) quote = `… ${quote.replace(/^\S*\s/, "").replace(/\s\S*$/, "")} …`; // jamais un mot coupé
  return quote;
}

/** Montants de franchise cités (« franchise de 150 € »). */
export function findDeductibles(text) {
  const t = fold(text);
  const out = new Set();
  const re = /franchise[^.€]{0,60}?(\d{1,3}(?:[ . ]?\d{3})*(?:,\d{1,2})?)\s?(?:€|euros?\b)/g;
  let m;
  while ((m = re.exec(t)) && out.size < 6) out.add(`${m[1].replace(/[ . ]/g, "")} €`);
  return [...out];
}

/**
 * Cases « Accident : OUI », « Véhicule de remplacement : NON GARANTIE » (mémo, attestation) :
 * [{ label, yes }] sans doublon, dans l'ordre du document.
 */
export function findYesNo(text) {
  const raw = String(text || "");
  const re = /([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' -]{2,40}?)\s*:\s*(NON GARANTIE|NON GARANTI|GARANTIE|GARANTI|OUI|NON)\b/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(raw))) {
    const label = m[1].replace(/^[-–•\s]+/, "").trim();
    const k = fold(label);
    if (!seen.has(k)) seen.set(k, { label, yes: !/^non/i.test(m[2]) });
  }
  return [...seen.values()];
}

// Attestation, carte verte, mémo : la preuve de l'assurance obligatoire, pas le contrat lui-même
const ATTESTATION_RE = /attestation d'?\s?assurance|certificat d'?\s?assurance|carte internationale d'?\s?assurance|memo vehicule assure/;

/**
 * Analyse le texte d'un contrat (ou d'une attestation).
 * @returns {{readable: boolean, attestation: boolean, items: Array<{key, label, status: "trouve"|"a_verifier"|"absent", quote: string|null}>, yesNo: Array<{label, yes}>, deductibles: string[], zeroKm: boolean}}
 */
export function analyseContract(text) {
  const raw = String(text || "");
  const t = fold(raw);
  const readable = t.replace(/\s/g, "").length >= 200;
  const attestation = readable && ATTESTATION_RE.test(t);
  const items = GUARANTEES.map(({ key, label, re }) => {
    const m = readable ? re.exec(t) : null;
    if (!m) {
      // L'attestation n'existe que pour l'assurance obligatoire : la responsabilité civile (L211-1)
      if (key === "rc" && attestation) return { key, label, status: "trouve", quote: "Attestation d'assurance : elle prouve l'assurance obligatoire (responsabilité civile)." };
      return { key, label, status: "absent", quote: null };
    }
    const quote = sentenceAround(raw, m.index);
    return { key, label, status: CAUTION_RE.test(fold(quote)) ? "a_verifier" : "trouve", quote };
  });
  return { readable, attestation, items, yesNo: readable ? findYesNo(raw) : [], deductibles: readable ? findDeductibles(raw) : [],
    zeroKm: readable && /\b0 ?km\b|kilometre zero|des le domicile/.test(t) };
}

/** Réponse de Nexus, en texte simple (affichée avec textContent). */
export function contractSummary(result) {
  if (!result.readable) {
    return "Je n'arrive pas à lire ce PDF : c'est sans doute un scan (une image). Téléchargez plutôt le PDF de vos conditions particulières depuis l'espace client de votre assureur. La lecture des photos arrive bientôt.";
  }
  const lines = ["Voici ce que j'ai trouvé dans votre contrat. Je cite le texte : vérifiez toujours avec votre assureur, c'est lui qui fait foi.", ""];
  if (result.attestation) {
    lines.push("ℹ️ Ce document est une attestation d'assurance, pas votre contrat : il ne liste pas toutes vos garanties. Pour tout savoir, demandez vos « Conditions particulières » à votre assureur ou à votre courtier (souvent dans votre espace client).", "");
  }
  if (result.yesNo?.length) {
    lines.push("📋 Le document indique :", ...result.yesNo.map((y) => `   ${y.yes ? "✅" : "❌"} ${y.label} : ${y.yes ? "oui" : "non"}`), "");
  }
  for (const it of result.items) {
    if (it.status === "trouve") lines.push(`✅ ${it.label}\n   « ${it.quote} »`);
    else if (it.status === "a_verifier") lines.push(`⚠️ ${it.label} : le contrat en parle, peut-être pour la limiter ou l'exclure\n   « ${it.quote} »`);
    else lines.push(`❓ ${it.label} : pas trouvé. Demandez à votre assureur si vous en avez besoin.`);
  }
  if (result.zeroKm) lines.push("", "🛵 Assistance : le contrat mentionne une assistance dès 0 km (panne devant chez vous).");
  if (result.deductibles.length) lines.push("", `💶 Franchises citées : ${result.deductibles.join(", ")}.`);
  lines.push("", "Ceci est une aide à la lecture, pas un avis juridique.");
  return lines.join("\n");
}

/** Texte d'un PDF, lu dans le téléphone (pdf.js hébergé chez nous). Au plus 60 pages. */
export async function readPdfText(file, maxPages = 60) {
  const pdfjs = await import(/* @vite-ignore */ "/vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((x) => x.str + (x.hasEOL ? "\n" : " ")).join("")); // garde les lignes : citations propres
  }
  await doc.destroy();
  return pages.join("\n");
}
