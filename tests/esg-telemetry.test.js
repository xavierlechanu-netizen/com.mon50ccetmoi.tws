const fs = require('fs');
const path = require('path');

// Charger le contenu du script esg-telemetry.js
const scriptContent = fs.readFileSync(path.resolve(__dirname, '../public/js/esg-telemetry.js'), 'utf8');

describe('ESGTelemetryManager (Fruggr & ESG IT)', () => {
  beforeEach(() => {
    // Réinitialiser le DOM et l'état global avant chaque test
    document.body.innerHTML = '';
    window.ESGManager = undefined;
    window.isLiteMode = undefined;
    localStorage.clear();
    
    // Injecter le script dans le JSDOM
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.body.appendChild(script);
  });

  test('Doit initialiser window.ESGManager avec des métriques à zéro', () => {
    expect(window.ESGManager).toBeDefined();
    const metrics = window.ESGManager.getMetrics();
    expect(metrics.networkRequests).toBe(0);
    expect(metrics.cacheHits).toBe(0);
    expect(metrics.edgeComputations).toBe(0);
    expect(metrics.aiRequestsSaved).toBe(0);
    expect(metrics.co2SavedGrams).toBe(0);
  });

  test('Doit calculer correctement le CO2 économisé lors de hits en cache', () => {
    const manager = window.ESGManager;
    
    // Simuler 10 hits en cache
    for (let i = 0; i < 10; i++) {
      manager.logCacheHit(15000);
    }
    
    // 10 hits * 0.06g CO2e = 0.6g CO2e
    expect(manager.metrics.cacheHits).toBe(10);
    expect(manager.metrics.bytesSavedEstimate).toBe(150000); // 10 * 15000
    expect(manager.metrics.co2SavedGrams).toBeCloseTo(0.6, 3);
  });

  test('Doit calculer correctement le CO2 économisé par l\'IA Green (Edge Computing)', () => {
    const manager = window.ESGManager;
    
    // Simuler 5 appels IA évités
    for (let i = 0; i < 5; i++) {
      manager.logAISaved(150);
    }
    
    // 5 appels * 0.45g CO2e = 2.25g CO2e
    expect(manager.metrics.aiRequestsSaved).toBe(5);
    expect(manager.metrics.bytesSavedEstimate).toBe(25000); // 5 * 5000
    expect(manager.metrics.co2SavedGrams).toBeCloseTo(2.25, 3);
  });

  test('Doit basculer en Mode Éco manuellement et mettre à jour localStorage', () => {
    const manager = window.ESGManager;
    
    expect(window.isLiteMode).toBeFalsy();
    
    manager.setEcoMode(true);
    
    expect(window.isLiteMode).toBe(true);
    expect(localStorage.getItem('liteMode')).toBe('true');
    expect(document.body.classList.contains('lite-mode')).toBe(true);
  });

  test('Doit inclure les normes de la famille ISO/IEC 27000 dans le rapport', () => {
    const metrics = window.ESGManager.getMetrics();
    
    expect(metrics.isoIecFamily).toBeDefined();
    expect(metrics.isoIecFamily['27001'].status).toBe('ALIGNED');
    expect(metrics.isoIecFamily['27017'].standard).toContain('Cloud Security');
    expect(metrics.isoIecFamily['27018'].controls).toContain('A.9.1_data_location_eu');
    expect(metrics.isoIecFamily['27701'].controls).toContain('7.4.5_privacy_by_design');
  });

  test('Doit inclure la conformité AI Act et RGAA dans le rapport', () => {
    const metrics = window.ESGManager.getMetrics();
    
    expect(metrics.aiActCompliance.article50Transparency).toBe(true);
    expect(metrics.aiActCompliance.article14HumanOversight).toBe(true);
    expect(metrics.rgaaCompliance.status).toBe('ALIGNED');
  });
});
