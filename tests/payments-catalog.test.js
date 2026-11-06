/**
 * Tests Unitaires — Catalogue des Paiements & Sécurité Catégorielle
 * ─────────────────────────────────────────────────────────────────────────────
 * Vérifie l'isolation des catégories (fermeture de la faille C4),
 * la validation de format case_id et la cohérence de la tarification.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { CATALOG, CATEGORIES, getCatalogItem, isValidCaseId } = require("../functions/api/payments-catalog");

describe("Payments Catalog — Durcissement & Anti-Bypass", () => {
    test("Doit reconnaître les 4 packs de points mon50cc avec catégorie POINTS", () => {
        ['POINTS_100', 'POINTS_250', 'POINTS_600', 'POINTS_1500'].forEach(packKey => {
            const item = getCatalogItem(packKey);
            expect(item).not.toBeNull();
            expect(item.category).toBe(CATEGORIES.POINTS);
            expect(item.points).toBeGreaterThan(0);
        });
    });

    test("Prix des 3 paliers de rapport assureur (doivent correspondre aux prix affichés)", () => {
        expect(getCatalogItem("SIMPLE").price_cents).toBe(4999);         // Standard 49,99 € HT
        expect(getCatalogItem("INTERMEDIAIRE").price_cents).toBe(8999);  // Approfondi 89,99 € HT
        expect(getCatalogItem("EXPERT").price_cents).toBe(19999);        // Expertise complète 199,99 € HT
    });

    test("Doit isoler strictement la catégorie LITIGATION des autres catégories", () => {
        const litigationTypes = ['SIMPLE', 'INTERMEDIAIRE', 'EXPERT'];
        litigationTypes.forEach(type => {
            const item = getCatalogItem(type);
            expect(item.category).toBe(CATEGORIES.LITIGATION);
            expect(item.price_cents).toBeGreaterThanOrEqual(4999);
        });

        // Les diagnostics IA ponctuels (4,99 €) NE DOIVENT PAS être classés LITIGATION
        const diag = getCatalogItem('DIAGNOSTIC_IA');
        expect(diag.category).toBe(CATEGORIES.DIAGNOSTIC);
        expect(diag.category).not.toBe(CATEGORIES.LITIGATION);
    });

    test("Doit rejeter un report_type inconnu ou null sans repli silencieux", () => {
        expect(getCatalogItem("HACK_FREE_REPORT")).toBeNull();
        expect(getCatalogItem("")).toBeNull();
        expect(getCatalogItem(null)).toBeNull();
        expect(getCatalogItem(undefined)).toBeNull();
    });

    test("isValidCaseId doit valider les identifiants sûrs et bloquer les injections", () => {
        expect(isValidCaseId("BATT-A1B2C3")).toBe(true);
        expect(isValidCaseId("BB-SALE-1729000000")).toBe(true);
        expect(isValidCaseId("CASE_2026_XYZ")).toBe(true);
        
        // Injections et caractères dangereux
        expect(isValidCaseId("../etc/passwd")).toBe(false);
        expect(isValidCaseId("case<script>")).toBe(false);
        expect(isValidCaseId("a")).toBe(false); // Trop court (< 4)
        expect(isValidCaseId("a".repeat(100))).toBe(false); // Trop long (> 64)
    });
});
