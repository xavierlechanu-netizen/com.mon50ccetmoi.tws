const { planBlackboxPurchase, addMonths, isSubscriptionActive, planRegularization } = require("../functions/api/blackbox-subscription");

describe("Régularisation des achats payés avant la correction", () => {
  const T = (y, m, d) => Date.UTC(y, m - 1, d);
  const orders = [
    { orderId: "o1", userId: "alice", reportType: "BLACKBOX_UNIT", paidAtMs: T(2026, 5, 1) },
    { orderId: "o2", userId: "alice", reportType: "BLACKBOX_CARE_ANNUAL", paidAtMs: T(2026, 9, 1) },
    { orderId: "o3", userId: "bob", reportType: "BLACKBOX_CARE_MONTHLY", paidAtMs: T(2026, 10, 15) },
    { orderId: "o4", userId: "carl", reportType: "BLACKBOX_DUO", paidAtMs: T(2026, 7, 1) },
    { orderId: "o5", userId: "dan", reportType: "POINTS_100", paidAtMs: T(2026, 7, 1) },
    { orderId: "o6", userId: "erin", reportType: "BLACKBOX_UNIT", paidAtMs: T(2026, 11, 7) },
  ];
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

  test("chacun reçoit ce qu'il a payé, depuis la date d'achat", () => {
    const r = planRegularization(orders, new Set(["o6"]));
    // Boîtier en mai (1 an → mai 2027) puis abonnement annuel : prolongé jusqu'en mai 2028
    expect(iso(r.users.alice.endsAtMs)).toBe("2028-05-01");
    expect(iso(r.users.alice.startsAtMs)).toBe("2026-05-01");
    expect(iso(r.users.bob.endsAtMs)).toBe("2026-11-15");
    expect(iso(r.users.carl.endsAtMs)).toBe("2027-07-01");
    expect(r.users.dan).toBeUndefined(); // pas un achat Boîte Noire
    expect(r.users.erin).toBeUndefined(); // déjà traité par la nouvelle version
  });

  test("les abonnements comptés à tort comme boîtiers sont retirés du compteur", () => {
    const r = planRegularization(orders, new Set(["o6"]));
    expect(r.boxesWronglyCounted).toBe(2); // o2 et o3
    expect(r.orders.find((o) => o.orderId === "o3")).toEqual(expect.objectContaining({ saleType: "SUBSCRIPTION", hardwareUnits: 0 }));
  });

  test("tient compte d'un abonnement déjà en cours", () => {
    const r = planRegularization([orders[2]], new Set(), { bob: T(2027, 1, 1) });
    expect(iso(r.users.bob.endsAtMs)).toBe("2027-02-01");
  });
});

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
