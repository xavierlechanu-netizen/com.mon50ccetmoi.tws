/**
 * @jest-environment node
 *
 * Vérification des assureurs par SIREN, TVA et factures à émettre dans Kolecto.
 */
const { isValidSiren, frVatNumber, verifyInsurer, VerificationError } = require("../functions/api/insurer-verification");
const { computeAmounts, getCatalogItem } = require("../functions/api/payments-catalog");
const { buildInvoice, invoicesToCsv } = require("../functions/api/invoicing");

const directory = (company) => async () => ({ ok: true, json: async () => ({ results: company ? [company] : [] }) });
const AXA = {
  siren: "722057460", nom_complet: "AXA FRANCE IARD", activite_principale: "65.12Z", etat_administratif: "A",
  siege: { adresse: "313 TERRASSE DE L'ARCHE 92000 NANTERRE", code_postal: "92000", libelle_commune: "NANTERRE" },
};

describe("Vérification des professionnels par SIREN", () => {
  test("SIREN : 9 chiffres et clé de contrôle", () => {
    expect(isValidSiren("722057460")).toBe(true);
    expect(isValidSiren("722 057 460")).toBe(true);
    expect(isValidSiren("722057461")).toBe(false);
    expect(isValidSiren("12345")).toBe(false);
  });

  test("numéro de TVA calculé avec la formule officielle", () => {
    expect(frVatNumber("722057460")).toBe("FR14722057460");
  });

  test("un assureur actif est accepté avec ses informations officielles", async () => {
    const p = await verifyInsurer("722057460", directory(AXA));
    expect(p.name).toBe("AXA FRANCE IARD");
    expect(p.naf).toBe("65.12Z");
    expect(p.vatNumber).toBe("FR14722057460");
    expect(p.city).toBe("NANTERRE");
  });

  test("refus : entreprise hors assurance, fermée, inconnue ou annuaire en panne", async () => {
    const code = async (fn) => { try { await fn(); } catch (e) { return e instanceof VerificationError ? e.code : e.message; } return "OK"; };
    expect(await code(() => verifyInsurer("722057460", directory({ ...AXA, activite_principale: "35.11Z" })))).toBe("NOT_INSURANCE");
    expect(await code(() => verifyInsurer("722057460", directory({ ...AXA, etat_administratif: "C" })))).toBe("INACTIVE");
    expect(await code(() => verifyInsurer("722057460", directory(null)))).toBe("NOT_FOUND");
    expect(await code(() => verifyInsurer("722057460", async () => ({ ok: false, status: 503 })))).toBe("DIRECTORY_DOWN");
    expect(await code(() => verifyInsurer("123", directory(AXA)))).toBe("INVALID_SIREN");
  });
});

describe("TVA des rapports assureurs", () => {
  test("prix affichés HT : l'assureur paie HT + 20 %", () => {
    expect(computeAmounts(getCatalogItem("SIMPLE"))).toEqual({ ht_cents: 4999, vat_cents: 1000, ttc_cents: 5999, vat_rate: 20 });
    expect(computeAmounts(getCatalogItem("INTERMEDIAIRE")).ttc_cents).toBe(10799);
    expect(computeAmounts(getCatalogItem("EXPERT")).ttc_cents).toBe(23999);
  });

  test("produits grand public : le prix affiché est TTC, la TVA est incluse", () => {
    const a = computeAmounts({ price_cents: 1200 });
    expect(a.ttc_cents).toBe(1200);
    expect(a.ht_cents + a.vat_cents).toBe(1200);
  });
});

describe("Factures à émettre (Kolecto)", () => {
  const order = { revolut_order_id: "ord_1", case_id: "LITIGE-ABCD", category: "LITIGATION", report_type: "SIMPLE", amount_cents: 5999, currency: "EUR" };
  const buyer = { type: "ENTREPRISE", name: "AXA FRANCE IARD", siren: "722057460", vatNumber: "FR14722057460",
    address: "313 TERRASSE DE L'ARCHE", postalCode: "92000", city: "NANTERRE", email: "factures@axa.example" };

  test("facture B2B : 49,99 HT + 10,00 TVA = 59,99 TTC, acheteur identifié", () => {
    const inv = buildInvoice(order, getCatalogItem("SIMPLE"), buyer);
    expect(inv.totals).toEqual({ ht_cents: 4999, vat_cents: 1000, ttc_cents: 5999 });
    expect(inv.buyer.siren).toBe("722057460");
    expect(inv.status).toBe("A_EMETTRE");
    expect(inv.lines[0].label).toBe("Rapport Assurance Standard");
  });

  test("export CSV : montants à la française, aucune formule de tableur", () => {
    const inv = { ...buildInvoice(order, getCatalogItem("SIMPLE"), { ...buyer, name: "=HYPERLINK(\"x\")" }), paid_at: "07/11/2026" };
    const csv = invoicesToCsv([inv]);
    const line = csv.split("\r\n")[1];
    expect(line).toContain("49,99;20 %;49,99;10,00;59,99");
    expect(line).toContain("'=HYPERLINK"); // formule neutralisée
  });
});
