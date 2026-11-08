/**
 * @jest-environment node
 *
 * Portail assureur (assureur.html) et rapports de sinistre : src/js/insurer-reports.js.
 * Le 8/11/2026, le portail était une simulation (faux dossier chiffré, « paiement » validé au bout
 * de 2 s, clé de démo dans le code) et ses boutons appelaient des fonctions inexistantes.
 * Ces tests empêchent le retour de ces défauts et vérifient que les prix affichés sont ceux encaissés.
 */
const fs = require("fs");
const path = require("path");
const { CATALOG, computeAmounts, isValidCaseId } = require("../functions/api/payments-catalog");

const SRC = path.resolve(__dirname, "../src");
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

// Module ESM (navigateur) : on retire les "export" pour l'évaluer ici
const R = new Function(
  `${read("js/insurer-reports.js").replace(/^export (const|function) /gm, "$1 ")}
   return { VAT_RATE, OFFERS, offerByCode, ttcCents, formatEuros, normalizeCaseCode,
            isPreviewExpired, hasPaidAccess, sealedReportRows };`,
)();

describe("Offres : prix identiques au catalogue du serveur", () => {
  test.each(["SIMPLE", "INTERMEDIAIRE", "EXPERT"])("%s", (code) => {
    const offer = R.offerByCode(code);
    const item = CATALOG[code];
    expect(offer).not.toBeNull();
    expect(item.vat_mode).toBe("HT");
    expect(offer.htCents).toBe(item.price_cents);
    expect(R.ttcCents(offer.htCents)).toBe(computeAmounts(item).ttc_cents);
  });

  test("seulement les trois rapports du catalogue", () => {
    expect(R.OFFERS.map((o) => o.code)).toEqual(["SIMPLE", "INTERMEDIAIRE", "EXPERT"]);
  });

  test("format des montants", () => {
    expect(R.formatEuros(4999)).toBe("49,99");
    expect(R.formatEuros(R.ttcCents(19999))).toBe("239,99");
  });

  test("l'écran assureur de l'app affiche les mêmes prix HT et TTC", () => {
    const screen = read("public/screens/insurer-portal-screen.html");
    for (const offer of R.OFFERS) {
      expect(screen).toContain(`${R.formatEuros(offer.htCents)} € HT`);
      expect(screen).toContain(`${R.formatEuros(R.ttcCents(offer.htCents))} € TTC`);
    }
  });
});

describe("Code de dossier", () => {
  test("forme canonique acceptée par le serveur", () => {
    const code = R.normalizeCaseCode("  litige-ab2c-d3ef-gh4j-k5lm ");
    expect(code).toBe("LITIGE-AB2C-D3EF-GH4J-K5LM");
    expect(isValidCaseId(code)).toBe(true);
  });

  test("espaces du code dicté retirés", () => {
    expect(R.normalizeCaseCode("LITIGE-AB2C - D3EF")).toBe("LITIGE-AB2C-D3EF");
  });

  test.each(["", "AB2C-D3EF", "LITIGE-", "LITIGE-AB", "LITIGE-AB2C/D3EF", "LITIGE-<script>", null, 42])(
    "refusé : %p",
    (input) => {
      expect(R.normalizeCaseCode(input)).toBeNull();
    },
  );
});

describe("Aperçu et accès payé", () => {
  test("aperçu expiré après expiresAt", () => {
    expect(R.isPreviewExpired({ expiresAt: 1000 }, 999)).toBe(false);
    expect(R.isPreviewExpired({ expiresAt: 1000 }, 1001)).toBe(true);
    expect(R.isPreviewExpired({}, 1001)).toBe(false);
  });

  test("seul un acheteur listé dans unlocked_for a accès", () => {
    const data = { unlocked_for: ["insurer9"] };
    expect(R.hasPaidAccess(data, "insurer9")).toBe(true);
    expect(R.hasPaidAccess(data, "curious7")).toBe(false);
    expect(R.hasPaidAccess(data, undefined)).toBe(false);
    expect(R.hasPaidAccess({}, "insurer9")).toBe(false);
  });
});

describe("Rapport scellé", () => {
  const data = {
    caseCode: "LITIGE-AB2C-D3EF-GH4J-K5LM",
    dateLabel: "07/11/2026 18:42",
    paid_tier: "SIMPLE",
    paid_tiers: { insurer9: "EXPERT" },
    telemetry: { maxG_force: 4.8, maxSpeed_kmh: 42.5, maxLeanAngle_deg: 31, gpsIncident: { lat: 48.85, lng: 2.35 } },
    ai: { severityScore: 55, reportLabel: "Rapport Impact", reportDescription: "Replay 3D certifié + Cadastre IGN" },
    evidence_sha256: "ab".repeat(32),
    sealed_at: { toDate: () => new Date("2026-11-07T18:00:00Z") },
  };
  const rows = Object.fromEntries(R.sealedReportRows(data, "insurer9"));

  test("données du dossier", () => {
    expect(rows["Dossier"]).toBe(data.caseCode);
    expect(rows["Force maximale"]).toBe("4.8 G");
    expect(rows["Vitesse maximale"]).toBe("42.5 km/h");
    expect(rows["Inclinaison maximale"]).toBe("31 °");
    expect(rows["Position GPS"]).toBe("48.85, 2.35");
    expect(rows["Empreinte SHA-256"]).toBe(data.evidence_sha256);
    expect(rows["Intégrité"]).toBe("Conforme au sceau");
    expect(rows["Horodatage"]).toBe("En cours");
  });

  test("niveau acheté par CET acheteur", () => {
    expect(rows["Niveau acheté"]).toBe("Expertise complète");
    expect(Object.fromEntries(R.sealedReportRows(data, "autre"))["Niveau acheté"]).toBe("Rapport Standard");
  });

  test("le texte de présentation de l'IA n'est pas présenté comme une analyse", () => {
    const all = R.sealedReportRows(data, "insurer9").map(([, v]) => v).join(" ");
    expect(all).not.toMatch(/Replay 3D|Cadastre/);
    expect(rows["Niveau conseillé par l'application"]).toBe("Rapport Impact");
  });

  test("dossier incomplet : tirets, jamais « undefined »", () => {
    const all = R.sealedReportRows({}, "x").map(([, v]) => String(v)).join(" ");
    expect(all).not.toMatch(/undefined|null|NaN/);
  });

  test("alerte d'intégrité affichée", () => {
    const r = Object.fromEntries(R.sealedReportRows({ integrity_alert: true }, "x"));
    expect(r["Intégrité"]).toMatch(/ALERTE/);
  });
});

describe("Page assureur.html : aucun bouton mort, aucune simulation", () => {
  const html = read("assureur.html");
  const js = read("js/assureur.js");

  test("chaque action de la page est enregistrée par assureur.js", () => {
    const actions = [...html.matchAll(/data-(?:enter-)?action="([\w.]+)\(/g)].map((m) => m[1]);
    expect(actions.length).toBeGreaterThan(3);
    for (const name of actions) {
      if (name === "window.print") continue; // fonction du navigateur autorisée
      expect(js).toMatch(new RegExp(`registerAction\\("${name}"`));
    }
    // Boutons créés par le script (choix du niveau de rapport)
    expect(js).toMatch(/registerAction\("selectReport"/);
  });

  test("aucun déblocage simulé ni clé de démonstration", () => {
    const all = html + js;
    expect(all).not.toMatch(/MASTER-KEY|Accès Déverrouillé|ciphertext|Faux ciphertext/i);
    expect(all).not.toMatch(/Math\.random/);
  });

  test("le rapport n'est lu qu'à travers les règles Firestore (accès payé)", () => {
    expect(js).toMatch(/collection\("litigation_proposals"\)/);
    expect(js).toMatch(/hasPaidAccess\(/);
    expect(js).toMatch(/authFetch\("createRevolutOrder"/);
  });

  test("aucun prix écrit en dur dans la page (ils viennent du catalogue partagé)", () => {
    expect(html).not.toMatch(/\d+,\d{2}\s*€/);
  });

  test("le rapport est affiché en texte brut (pas d'innerHTML)", () => {
    expect(js).not.toMatch(/innerHTML/);
  });
});
