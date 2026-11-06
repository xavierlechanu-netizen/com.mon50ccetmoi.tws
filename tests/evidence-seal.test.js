/**
 * @jest-environment node
 *
 * Sceau d'intégrité des rapports de sinistre (functions/api/evidence-seal.js)
 */
const { evidenceHash, evidencePayload, stableStringify } = require("../functions/api/evidence-seal");

const caseData = {
  caseCode: "LITIGE-ABCD-EFGH-JKLM-NPQR",
  userId: "pilot1",
  dateLabel: "06/11/2026 14:32",
  telemetry: { maxG_force: 4.8, gpsIncident: { lat: 48.85, lng: 2.35 } },
  ai: { severityScore: 72, recommendedReport: "EXPERT_COMPLET" },
};

describe("Sceau d'intégrité des rapports", () => {
  test("empreinte SHA-256 stable, quel que soit l'ordre des champs", () => {
    const reordered = { ai: { recommendedReport: "EXPERT_COMPLET", severityScore: 72 }, telemetry: { gpsIncident: { lng: 2.35, lat: 48.85 }, maxG_force: 4.8 }, dateLabel: caseData.dateLabel, userId: "pilot1", caseCode: caseData.caseCode };
    expect(evidenceHash(caseData)).toMatch(/^[0-9a-f]{64}$/);
    expect(evidenceHash(reordered)).toBe(evidenceHash(caseData));
  });

  test("la moindre modification d'une donnée de preuve change l'empreinte", () => {
    const altered = JSON.parse(JSON.stringify(caseData));
    altered.telemetry.maxG_force = 4.7;
    expect(evidenceHash(altered)).not.toBe(evidenceHash(caseData));
  });

  test("les champs de paiement et de déblocage ne changent pas l'empreinte", () => {
    const paid = { ...caseData, report_unlocked: true, unlocked_for: ["insurer9", "insurer2"], payment_status: "PAID",
      paid_tier: "EXPERT", paid_tiers: { insurer9: "EXPERT", insurer2: "SIMPLE" }, integrity_alert: false, evidence_sha256: "x", status: "RESOLVED" };
    expect(evidenceHash(paid)).toBe(evidenceHash(caseData));
    expect(Object.keys(evidencePayload(paid)).sort()).toEqual(Object.keys(caseData).sort());
  });

  test("les dates Firestore sont prises en compte par leur valeur", () => {
    const a = stableStringify({ t: { toMillis: () => 1000 } });
    const b = stableStringify({ t: { toMillis: () => 2000 } });
    expect(a).not.toBe(b);
  });
});
