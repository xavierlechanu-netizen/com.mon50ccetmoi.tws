/**
 * @jest-environment node
 *
 * Grand livre des points mon50cc — règles réelles du serveur (functions/api/points-rules.js).
 * Audit 2026-11 : le serveur fixe les montants et exige une preuve quand l'action est vérifiable.
 */
const {
  REASON_RULES,
  SAFE_RIDER_MILESTONES,
  UNVERIFIED_DAILY_CAP,
  RuleError,
  planTransaction,
  checkHazardProof,
  checkDailyCaps,
} = require("../functions/api/points-rules");

const plan = (data, opts) => planTransaction(data, opts);
const codeOf = (fn) => { try { fn(); } catch (e) { return e instanceof RuleError ? e.code : e.message; } return "OK"; };

describe("Points mon50cc — validation", () => {
  test("rejette une action inconnue, un motif inconnu ou incohérent", () => {
    expect(codeOf(() => plan({ action: "STEAL", reason: "RIDE_COMPLETED" }))).toBe("invalid-argument");
    expect(codeOf(() => plan({ action: "AWARD", reason: "FREE_MONEY" }))).toBe("invalid-argument");
    expect(codeOf(() => plan({ action: "DEDUCT", reason: "RIDE_COMPLETED", amount: 5 }))).toBe("invalid-argument");
  });

  test("le serveur fixe le montant : demander 1 000 points pour un trajet en donne 12", () => {
    expect(plan({ action: "AWARD", reason: "RIDE_COMPLETED", amount: 1000 }).amount).toBe(12);
    expect(plan({ action: "AWARD", reason: "CODE_QUIZ_COMPLETED", amount: 50 }).amount).toBe(20);
  });

  test("parrainage, carbone, compensation et dons admin : jamais à la demande de l'application", () => {
    for (const reason of ["REFERRAL_BONUS", "CARBON_OFFSET", "MODERATION_COMPENSATION", "ADMIN_GRANT"]) {
      expect(REASON_RULES[reason].serverOnly).toBe(true);
      expect(codeOf(() => plan({ action: "AWARD", reason, amount: 10 }))).toBe("permission-denied");
      expect(plan({ action: "AWARD", reason, amount: 10 }, { isAdmin: true }).amount).toBe(10);
    }
    expect(codeOf(() => plan({ action: "AWARD", reason: "ADMIN_GRANT", amount: 999999 }, { isAdmin: true }))).toBe("out-of-range");
  });

  test("dépenses : montant entier positif et plafond par opération", () => {
    expect(plan({ action: "DEDUCT", reason: "POCKET_LAWYER_QUERY", amount: 5 }).amount).toBe(5);
    expect(codeOf(() => plan({ action: "DEDUCT", reason: "POCKET_LAWYER_QUERY", amount: 0 }))).toBe("invalid-argument");
    expect(codeOf(() => plan({ action: "DEDUCT", reason: "POCKET_LAWYER_QUERY", amount: -50 }))).toBe("invalid-argument");
    expect(codeOf(() => plan({ action: "DEDUCT", reason: "POCKET_LAWYER_QUERY", amount: 101 }))).toBe("out-of-range");
  });
});

describe("Points mon50cc — preuves", () => {
  test("danger : identifiant obligatoire, un seul gain par danger", () => {
    expect(codeOf(() => plan({ action: "AWARD", reason: "RADAR_HAZARD_REPORTED" }))).toBe("invalid-argument");
    expect(codeOf(() => plan({ action: "AWARD", reason: "RADAR_HAZARD_REPORTED", metadata: { hazardId: "../users/x" } }))).toBe("invalid-argument");
    const p = plan({ action: "AWARD", reason: "RADAR_HAZARD_REPORTED", amount: 999, metadata: { hazardId: "abc123" } });
    expect(p.amount).toBe(25);
    expect(p.needsHazardCheck).toBe(true);
    expect(p.forcedIdempotencyKey).toBe("hazard:abc123");
  });

  test("danger : doit appartenir à l'utilisateur et dater de moins de 48 h", () => {
    const now = Date.parse("2026-11-06T12:00:00Z");
    const ts = (h) => ({ toMillis: () => now - h * 3600 * 1000 });
    expect(checkHazardProof({ authorUid: "u1", createdAt: ts(1) }, "u1", now).ok).toBe(true);
    expect(checkHazardProof({ uid: "u1", timestamp: ts(47) }, "u1", now).ok).toBe(true);
    expect(checkHazardProof(null, "u1", now).ok).toBe(false);
    expect(checkHazardProof({ authorUid: "someone-else", createdAt: ts(1) }, "u1", now).ok).toBe(false);
    expect(checkHazardProof({ authorUid: "u1", createdAt: ts(49) }, "u1", now).ok).toBe(false);
    expect(checkHazardProof({ authorUid: "u1" }, "u1", now).ok).toBe(false);
  });

  test("paliers de conduite : barème serveur, un seul gain par palier", () => {
    const p = plan({ action: "AWARD", reason: "SAFE_RIDER_MILESTONE", amount: 5000, metadata: { milestoneKm: 1000 } });
    expect(p.amount).toBe(SAFE_RIDER_MILESTONES[1000]);
    expect(p.forcedIdempotencyKey).toBe("milestone:1000");
    expect(codeOf(() => plan({ action: "AWARD", reason: "SAFE_RIDER_MILESTONE", metadata: { milestoneKm: 999999 } }))).toBe("invalid-argument");
  });

  test("contrat de bonne conduite : un seul gain à vie", () => {
    expect(plan({ action: "AWARD", reason: "ROUTER_CONTRAT_SIGNED" }).forcedIdempotencyKey).toBe("once:ROUTER_CONTRAT_SIGNED");
  });
});

describe("Points mon50cc — plafonds", () => {
  test("plafond par motif : 3 trajets récompensés par jour au maximum", () => {
    const p = plan({ action: "AWARD", reason: "RIDE_COMPLETED" });
    expect(checkDailyCaps(p, "RIDE_COMPLETED", { RIDE_COMPLETED: 24, __unverified: 24 }).ok).toBe(true);
    expect(checkDailyCaps(p, "RIDE_COMPLETED", { RIDE_COMPLETED: 36, __unverified: 36 }).ok).toBe(false);
  });

  test("plafond global des gains non vérifiables, tous motifs confondus", () => {
    const p = plan({ action: "AWARD", reason: "CODE_QUIZ_COMPLETED" });
    expect(checkDailyCaps(p, "CODE_QUIZ_COMPLETED", { __unverified: UNVERIFIED_DAILY_CAP - 20 }).ok).toBe(true);
    expect(checkDailyCaps(p, "CODE_QUIZ_COMPLETED", { __unverified: UNVERIFIED_DAILY_CAP - 19 }).ok).toBe(false);
  });

  test("les gains automatiques sont bornés : au plus 100 points par jour sans preuve", () => {
    const unverified = Object.values(REASON_RULES).filter((r) => r.action === "AWARD" && r.proof === "none");
    expect(unverified.length).toBeGreaterThan(0);
    expect(UNVERIFIED_DAILY_CAP).toBeLessThanOrEqual(100);
    unverified.forEach((r) => expect(typeof r.fixedAmount).toBe("number"));
  });

  test("les dépenses ne consomment aucun plafond de gain", () => {
    const p = plan({ action: "DEDUCT", reason: "GENERIC_SPEND", amount: 10 });
    expect(checkDailyCaps(p, "GENERIC_SPEND", { __unverified: 9999 }).ok).toBe(true);
  });
});
