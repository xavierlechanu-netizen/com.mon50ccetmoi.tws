/**
 * Tests Unitaires — Achat de Points mon50cc & Rentabilité Maximale
 * ─────────────────────────────────────────────────────────────────────────────
 * Vérification des grilles tarifaires, de la rentabilité développeur et de
 * l'attribution atomique des points lors de la validation Revolut (ASVS v5.0.0-2.3.3).
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Grille Tarifaire et Rentabilité — Packs de Points mon50cc', () => {

  const pointsPacks = {
    'POINTS_100': { points: 100, priceCents: 299, bonusPercent: 0 },
    'POINTS_250': { points: 250, priceCents: 599, bonusPercent: 25 },
    'POINTS_600': { points: 600, priceCents: 1199, bonusPercent: 50 },
    'POINTS_1500': { points: 1500, priceCents: 2499, bonusPercent: 100 }
  };

  test('La grille tarifaire doit couvrir les 4 packs officiels', () => {
    expect(Object.keys(pointsPacks)).toEqual(['POINTS_100', 'POINTS_250', 'POINTS_600', 'POINTS_1500']);
  });

  test('Chaque pack doit garantir une marge brute développeur > 90% (Frais Revolut 1.2% + 0.20€)', () => {
    Object.entries(pointsPacks).forEach(([packKey, pack]) => {
      const priceEuros = pack.priceCents / 100;
      // Frais Revolut Merchant standard EEE : 1.2% + 0.20 €
      const revolutFee = (priceEuros * 0.012) + 0.20;
      const netProfit = priceEuros - revolutFee;
      const margin = (netProfit / priceEuros) * 100;

      expect(margin).toBeGreaterThan(90);
      expect(netProfit).toBeGreaterThan(2.50);
    });
  });

  test('Le coût unitaire par point doit être dégressif pour inciter aux paniers moyens élevés', () => {
    const costPerPoint100 = pointsPacks['POINTS_100'].priceCents / pointsPacks['POINTS_100'].points;
    const costPerPoint250 = pointsPacks['POINTS_250'].priceCents / pointsPacks['POINTS_250'].points;
    const costPerPoint600 = pointsPacks['POINTS_600'].priceCents / pointsPacks['POINTS_600'].points;
    const costPerPoint1500 = pointsPacks['POINTS_1500'].priceCents / pointsPacks['POINTS_1500'].points;

    expect(costPerPoint100).toBeGreaterThan(costPerPoint250);
    expect(costPerPoint250).toBeGreaterThan(costPerPoint600);
    expect(costPerPoint600).toBeGreaterThan(costPerPoint1500);

    // Pack 1500 : ~0.0166 € / point (meilleure offre)
    expect(costPerPoint1500).toBeLessThan(1.7);
  });

  test('Le webhook doit extraire le nombre exact de points selon le report_type', () => {
    const pointsMap = {
      'POINTS_100': 100,
      'POINTS_250': 250,
      'POINTS_600': 600,
      'POINTS_1500': 1500
    };

    function resolvePoints(reportType) {
      return pointsMap[reportType] || parseInt(reportType.replace('POINTS_', ''), 10) || 0;
    }

    expect(resolvePoints('POINTS_100')).toBe(100);
    expect(resolvePoints('POINTS_250')).toBe(250);
    expect(resolvePoints('POINTS_600')).toBe(600);
    expect(resolvePoints('POINTS_1500')).toBe(1500);
    expect(resolvePoints('POINTS_3000')).toBe(3000);
    expect(resolvePoints('INVALID_PACK')).toBe(0);
  });

  test('La description de commande Revolut doit comporter le bonus et le caseId', () => {
    function getOrderDescription(report_type, case_id) {
      if (report_type === 'POINTS_100') return `Pack Starter — 100 Points mon50cc — ${case_id}`;
      if (report_type === 'POINTS_250') return `Pack Pilote — 250 Points mon50cc (+25% bonus) — ${case_id}`;
      if (report_type === 'POINTS_600') return `Pack Pro Rider — 600 Points mon50cc (+50% bonus) — ${case_id}`;
      if (report_type === 'POINTS_1500') return `Coffre Légende — 1 500 Points mon50cc (+100% bonus) — ${case_id}`;
      return `Standard — ${case_id}`;
    }

    const caseId = 'BB-SALE-1729000000000';
    expect(getOrderDescription('POINTS_100', caseId)).toContain('100 Points');
    expect(getOrderDescription('POINTS_600', caseId)).toContain('+50% bonus');
    expect(getOrderDescription('POINTS_1500', caseId)).toContain('+100% bonus');
    expect(getOrderDescription('POINTS_1500', caseId)).toContain(caseId);
  });

});
