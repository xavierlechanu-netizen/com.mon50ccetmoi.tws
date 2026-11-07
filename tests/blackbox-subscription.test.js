const { planBlackboxPurchase, addMonths, isSubscriptionActive } = require("../functions/api/blackbox-subscription");

const NOW = Date.UTC(2026, 10, 7, 12, 0, 0); // 7 novembre 2026
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

describe("Abonnement Boîte Noire+ accordé au paiement", () => {
  test("un boîtier acheté = 1 an offert (promesse des CGV)", () => {
    const p = planBlackboxPurchase("BLACKBOX_UNIT", null, NOW);
    expect(p.hardwareUnits).toBe(1);
    expect(p.subscription.plan).toBe("INCLUDED_FIRST_YEAR");
    expect(iso(p.subscription.endsAtMs)).toBe("2027-11-07");
  });

  test("pack duo = 2 boîtiers, 1 an offert", () => {
    const p = planBlackboxPurchase("BLACKBOX_DUO", null, NOW);
    expect(p.hardwareUnits).toBe(2);
    expect(iso(p.subscription.endsAtMs)).toBe("2027-11-07");
  });

  test("un abonnement payé n'est plus compté comme un boîtier vendu (bug corrigé)", () => {
    for (const type of ["BLACKBOX_CARE_MONTHLY", "BLACKBOX_CARE_ANNUAL"]) {
      const p = planBlackboxPurchase(type, null, NOW);
      expect(p.hardwareUnits).toBe(0);
      expect(p.saleType).toBe("SUBSCRIPTION");
    }
    expect(iso(planBlackboxPurchase("BLACKBOX_CARE_MONTHLY", null, NOW).subscription.endsAtMs)).toBe("2026-12-07");
    expect(iso(planBlackboxPurchase("BLACKBOX_CARE_ANNUAL", null, NOW).subscription.endsAtMs)).toBe("2027-11-07");
  });

  test("un nouvel achat prolonge l'abonnement en cours au lieu de l'écraser", () => {
    const yearOffered = planBlackboxPurchase("BLACKBOX_UNIT", null, NOW).subscription.endsAtMs;
    const renewed = planBlackboxPurchase("BLACKBOX_CARE_ANNUAL", yearOffered, NOW);
    expect(iso(renewed.subscription.startsAtMs)).toBe("2027-11-07");
    expect(iso(renewed.subscription.endsAtMs)).toBe("2028-11-07");
  });

  test("un abonnement expiré repart d'aujourd'hui", () => {
    const expired = Date.UTC(2025, 0, 1);
    expect(iso(planBlackboxPurchase("BLACKBOX_CARE_MONTHLY", expired, NOW).subscription.startsAtMs)).toBe("2026-11-07");
  });

  test("fin de mois et articles inconnus", () => {
    expect(iso(addMonths(Date.UTC(2027, 0, 31), 1))).toBe("2027-02-28");
    expect(planBlackboxPurchase("POINTS_100", null, NOW)).toBeNull();
    expect(isSubscriptionActive(NOW + 1, NOW)).toBe(true);
    expect(isSubscriptionActive(null, NOW)).toBe(false);
  });
});
