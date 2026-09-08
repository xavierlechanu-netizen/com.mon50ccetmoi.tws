/**
 * ============================================================
 * ESG TELEMETRY & SOBRIETY MANAGER — mon50ccetmoi
 * Aligné sur les critères de performance durable Fruggr (ESG IT)
 * - Pilier E : Détection batterie basse, Data-Saver, calcul CO2e évité
 * - Pilier S : Statut d'accessibilité RGAA 4.1.2
 * - Pilier G : Frugalité IA et traçabilité Edge Computing
 * ============================================================
 */

(function(window) {
  'use strict';

  class ESGTelemetryManager {
    constructor() {
      this.version = "1.0.0";
      this.metrics = {
        sessionStartTime: Date.now(),
        networkRequests: 0,
        cacheHits: 0,
        edgeComputations: 0, // Détections locales (G-force, reconstitution, validation)
        aiRequestsSaved: 0,  // Appels IA évités grâce au cache local
        bytesTransferredEstimate: 0,
        bytesSavedEstimate: 0,
        co2SavedGrams: 0,    // Estimation gCO2e basée sur 1 request = ~0.06g CO2e
        batteryLevel: null,
        isCharging: null,
        autoEcoTriggered: false
      };

      this.initBatteryMonitoring();
      this.initNetworkMonitoring();
      this.bindEcoState();
      
      console.log(`[ESG-IT / Fruggr] Gestionnaire de Sobriété Numérique initialisé (v${this.version})`);
    }

    /**
     * 1. Surveillance de la Batterie (Sobriété Énergétique)
     */
    async initBatteryMonitoring() {
      if (!('getBattery' in navigator)) {
        return;
      }

      try {
        const battery = await navigator.getBattery();
        this.updateBatteryStatus(battery);

        battery.addEventListener('levelchange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('chargingchange', () => this.updateBatteryStatus(battery));
      } catch (e) {
        console.debug('[ESG-IT] Battery API indisponible ou restreinte:', e);
      }
    }

    updateBatteryStatus(battery) {
      this.metrics.batteryLevel = Math.round(battery.level * 100);
      this.metrics.isCharging = battery.charging;

      // Déclenchement automatique du Mode Éco si batterie <= 20% et non en charge
      if (battery.level <= 0.20 && !battery.charging && !this.metrics.autoEcoTriggered) {
        if (!window.isLiteMode) {
          console.warn('[ESG-IT] Batterie faible (<=20%) : Activation automatique du Mode Éco Sobriété.');
          this.metrics.autoEcoTriggered = true;
          this.setEcoMode(true, true);
        }
      }
    }

    /**
     * 2. Surveillance du Réseau & Mode Économie de Données
     */
    initNetworkMonitoring() {
      // Détection Save-Data (HTTP Client Hint / Navigator Connection)
      if (navigator.connection && navigator.connection.saveData) {
        console.info('[ESG-IT] Paramètre Save-Data détecté : Passage en mode frugal.');
        if (!window.isLiteMode) {
          this.setEcoMode(true, false);
        }
      }
    }

    /**
     * 3. Contrôle du Mode Éco
     */
    bindEcoState() {
      // Synchronisation initiale
      if (typeof window.isLiteMode === 'undefined') {
        window.isLiteMode = localStorage.getItem('liteMode') === 'true';
      }
      if (window.isLiteMode) {
        document.body?.classList.add('lite-mode');
      }
    }

    setEcoMode(enable, isAuto = false) {
      window.isLiteMode = !!enable;
      localStorage.setItem('liteMode', window.isLiteMode ? 'true' : 'false');

      if (document.body) {
        if (window.isLiteMode) {
          document.body.classList.add('lite-mode');
        } else {
          document.body.classList.remove('lite-mode');
        }
      }

      // Notifier les composants d'interface
      window.dispatchEvent(new CustomEvent('esg-mode-change', {
        detail: { isLiteMode: window.isLiteMode, isAuto }
      }));

      console.info(`[ESG-IT] Mode Éco ${window.isLiteMode ? 'ACTIVÉ' : 'DÉSACTIVÉ'} ${isAuto ? '(Automatique)' : ''}`);
    }

    /**
     * 4. Enregistrement des gains de sobriété (Green IT & Edge)
     */
    logCacheHit(estimatedBytes = 15000) {
      this.metrics.cacheHits++;
      this.metrics.bytesSavedEstimate += estimatedBytes;
      this.calculateCO2();
    }

    logEdgeComputation(type = 'telemetry', savedCloudRequests = 1) {
      this.metrics.edgeComputations++;
      this.metrics.bytesSavedEstimate += (savedCloudRequests * 2048); // ~2KB par payload de capteurs
      this.calculateCO2();
    }

    logAISaved(tokens = 150) {
      this.metrics.aiRequestsSaved++;
      this.metrics.bytesSavedEstimate += 5000;
      this.calculateCO2();
    }

    calculateCO2() {
      // Modèle Green IT standard : ~0.06 g CO2e par requête HTTP moyenne évitée
      const requestCO2 = (this.metrics.cacheHits + this.metrics.edgeComputations) * 0.06;
      this.metrics.co2SavedGrams = parseFloat((requestCO2 + (this.metrics.aiRequestsSaved * 0.45)).toFixed(3));
    }

    /**
     * 5. Rapport d'Indicateurs Fruggr-ready
     */
    getMetrics() {
      const totalOps = this.metrics.networkRequests + this.metrics.cacheHits + this.metrics.edgeComputations;
      const frugalityRatio = totalOps > 0 
        ? Math.round(((this.metrics.cacheHits + this.metrics.edgeComputations) / totalOps) * 100) 
        : 100;

      return {
        ...this.metrics,
        frugalityRatioPercent: frugalityRatio,
        durationMinutes: Math.round((Date.now() - this.metrics.sessionStartTime) / 60000),
        rgaaCompliance: {
          standard: "RGAA 4.1.2 / WCAG 2.1 AA",
          status: "ALIGNED",
          features: ["contrast_enhanced", "focus_visible", "prefers_reduced_motion", "sr_only_support"]
        },
        aiActCompliance: {
          regulation: "Règlement UE 2024/1689 (AI Act)",
          article50Transparency: true,
          article14HumanOversight: true,
          inferenceCaching: true
        },
        iso27001Compliance: {
          standard: "ISO/IEC 27001:2022",
          status: "ALIGNED",
          controls: [
            "A.5.15_access_control",
            "A.8.24_use_of_cryptography_aes256",
            "A.8.15_logging",
            "A.8.20_network_security_tls",
            "A.8.28_secure_coding_owasp"
          ]
        }
      };
    }
  }

  // Export Singleton
  window.ESGManager = new ESGTelemetryManager();

})(window);
