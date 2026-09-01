const { analyzeClientMaintenance } = require('../js/garage-dashboard.js');

describe('Algorithme de Maintenance Prédictive (IA Act Compliant)', () => {

  test('Doit déclencher une alerte Courroie Critique si > 10 000 km', () => {
    const currentKm = 15000;
    const logs = [
      {
        category: 'Courroie & Galets',
        km_at_service: 4000, // 11 000 km parcourus depuis
        clientName: 'Alice'
      }
    ];

    const alerts = analyzeClientMaintenance(currentKm, logs);
    
    expect(alerts.length).toBe(1);
    expect(alerts[0].partName).toBe('Courroie de transmission');
    expect(alerts[0].isCritical).toBe(true);
    expect(alerts[0].price).toBe(120);
  });

  test('Ne doit pas déclencher d\'alerte Pneus si récent (< 7500 km)', () => {
    const currentKm = 5000;
    const logs = [
      {
        category: 'Pneus Michelin',
        km_at_service: 1000, // 4000 km parcourus
        clientName: 'Bob'
      }
    ];

    const alerts = analyzeClientMaintenance(currentKm, logs);
    expect(alerts.length).toBe(0);
  });

  test('Doit déclencher des alertes multiples si plusieurs pièces usées', () => {
    const currentKm = 20000;
    const logs = [
      { category: 'Courroie', km_at_service: 10000, clientName: 'Charlie' }, // 10 000 km (Alerte non critique à 9000)
      { category: 'Pneu AR', km_at_service: 12000, clientName: 'Charlie' } // 8 000 km (Alerte Pneu)
    ];

    const alerts = analyzeClientMaintenance(currentKm, logs);
    
    expect(alerts.length).toBe(2);
    expect(alerts.some(a => a.partName === 'Courroie de transmission')).toBe(true);
    expect(alerts.some(a => a.partName === 'Usure des pneus')).toBe(true);
  });
});
