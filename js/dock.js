/**
 * dock.js — Générateur data-driven du Smart Dock
 * Remplace les 30+ boutons HTML copiés-collés dans app.html
 * par une configuration JSON + génération dynamique.
 * Sécurisé (Phase 3.5) : Isolation IIFE, sanitisation callbacks (XSS prevent).
 */

(function () {
  'use strict';

  const DOCK_BUTTONS = [
    // --- Icon Buttons (petits, ronds) ---
    { id: 'sos', icon: 'fa-truck-medical', color: '#ff0055', label: 'SOS', action: () => { if(window.ScreenManager) window.ScreenManager.open('tim-cook-sos-screen'); else if (typeof window.triggerFallAlert === 'function') window.triggerFallAlert(true); } },
    { id: 'academy', icon: 'fa-graduation-cap', color: '#00d2ff', label: 'Académie du Code', action: () => { window.location.href = 'code-de-la-route.html'; } },
    { id: 'lawyer', icon: 'fa-scale-balanced', color: '#cca300', label: 'Avocat de Poche', action: () => { if(window.PocketLawyer) window.PocketLawyer.toggleLawyer(); } },
    { id: 'ar', icon: 'fa-vr-cardboard', color: '#00ffcc', label: 'Vision AR', action: () => { if(window.arNavigationManager) window.arNavigationManager.toggleAR(); } },
    { id: 'garage', icon: 'fa-motorcycle', color: '#00d2ff', label: 'Garage Virtuel', action: () => { if(window.VirtualGarage) window.VirtualGarage.openUI(); } },
    { id: 'convoy', icon: 'fa-people-group', color: '#00e676', label: 'Mode Convoi', action: () => { if(window.ConvoyManager) window.ConvoyManager.openUI(); } },
    { id: 'social', icon: 'fa-ghost', color: '#99aab5', label: 'Radar Social', action: () => { if(window.socialRadarManager) window.socialRadarManager.toggleRadar(); } },
    { id: 'obd', icon: 'fa-bluetooth', iconPrefix: 'fa-brands', color: '#ffaa00', label: 'OBD-II Scanner', action: () => { if(window.ScreenManager) window.ScreenManager.open('obd-hud-screen'); else if(window.obdManager) window.obdManager.connect(); } },
    { id: 'blackbox', icon: 'fa-microchip', color: '#ff3333', label: 'Boîte Noire', action: () => { if(window.ScreenManager) window.ScreenManager.open('blackbox-ui-panel'); } },
    { id: 'wallet', icon: 'fa-store', color: '#b700ff', label: 'Marketplace BVC', action: () => { if(typeof window.openMarketplaceCheck === 'function') window.openMarketplaceCheck(); } },
    { id: 'profile', icon: 'fa-user-circle', color: '#00ff88', label: 'Mon Profil', action: () => { window.location.href = 'profile.html'; } },
    { id: 'radar', icon: 'fa-users-viewfinder', color: '#fff', label: 'Radar Social', action: () => { if(typeof window.toggleSocialRadar === 'function') window.toggleSocialRadar(); } },
    { id: 'sensation', icon: 'fa-route', color: '#b700ff', label: 'Mode Sensation', action: () => { if(typeof window.toggleSensationMode === 'function') window.toggleSensationMode(); } },
    { id: 'brain', icon: 'fa-brain', color: '#0f0', label: 'Nexus Atlas Chat', action: () => { if(window.ScreenManager) window.ScreenManager.open('nexus-atlas-chat-modal'); else if(window.NexusAtlasChat) window.NexusAtlasChat.open(); }, size: '1.8rem' },
    { id: 'moto', icon: 'fa-motorcycle', color: '#aaa', label: 'Mon Véhicule', action: () => { if(window.ScreenManager) { window.ScreenManager.open('vehicle-config-screen'); if(window.GarageClient) window.GarageClient.loadMaintenanceLogs(); } } },
    { id: 'meca', icon: 'fa-stethoscope', color: '#ff0055', label: 'Meca Wizard', action: () => { if(window.MecaWizard) window.MecaWizard.startAcousticAnalysis(); } },
    { id: 'db', icon: 'fa-volume-high', color: '#00e676', label: 'Décibelmètre', action: () => { if(window.MecaWizard) window.MecaWizard.startDecibelMeter(); } },
    { id: 'pilot', icon: 'fa-flag-checkered', color: '#ffeb3b', label: 'Score de Pilotage', action: () => { if(window.PredictiveMeca) window.PredictiveMeca.analyzeRidingStyle(); } },
    { id: 'referral', icon: 'fa-user-plus', color: '#00d2ff', label: 'Parrainer un ami', action: () => { if(window.ReferralManager) window.ReferralManager.shareReferralLink(); } },
    { id: 'insurance', icon: 'fa-shield-cat', color: '#ff0055', label: 'Assurance Connectée', action: () => { window.location.href = 'insurance.html'; } },
    { id: 'battery', icon: 'fa-car-battery', color: '#00ffcc', label: 'Santé Batterie', action: () => { if(window.ScreenManager) window.ScreenManager.open('battery-health-screen'); } },
    { id: 'trophy', icon: 'fa-trophy', color: '#ffb703', label: 'Classement', action: () => { if(window.ScreenManager) window.ScreenManager.open('leaderboard-modal'); else if(typeof window.showLeaderboard === 'function') window.showLeaderboard(); } },
    { id: 'insurer', icon: 'fa-building-shield', color: '#ff0055', label: 'Portail Assureur B2B', action: () => { if(window.ScreenManager) window.ScreenManager.open('insurer-portal-screen'); else if(window.InsurerPortal) window.InsurerPortal.open(); } },
    { id: 'stethoscope', icon: 'fa-microphone-lines', color: '#00d2ff', label: 'Diagnostic Acoustique', action: () => { if(window.MecaWizard) window.MecaWizard.startAcousticAnalysis(); } },
    { id: 'security', icon: 'fa-shield-halved', color: '#10a37f', label: 'Sécurité & RGPD', action: () => { if(window.ScreenManager) window.ScreenManager.open('security-settings-screen'); } },
    { id: 'sentry', icon: 'fa-lock', color: '#ff3333', label: 'Mode Sentinelle', action: () => { if(window.AntiTheft) window.AntiTheft.toggleSentryMode(); } },
  ];

  const DOCK_FEATURE_BUTTONS = [
    { id: 'crew-hud-btn', icon: 'fa-flag', color: '#00d2ff', text: 'Crew', action: () => { if(window.CrewSystem) window.CrewSystem.showModal(); } },
    { id: 'ar-hud-btn', icon: 'fa-vr-cardboard', color: '#00f2ff', text: 'AR', action: () => { if(window.arNavigationManager) window.arNavigationManager.toggleAR(); } },
    { id: 'cortege-hud-btn', icon: 'fa-motorcycle', color: '#00ffcc', text: 'Cortège', action: () => { if(window.CortegeSystem) window.CortegeSystem.showModal(); } },
    { id: 'market-hud-btn', icon: 'fa-wrench', color: '#ffaa00', text: 'Troc', action: () => { if(window.GarageMarket) window.GarageMarket.showModal(); } },
    { id: 'sos-hud-btn', icon: 'fa-triangle-exclamation', color: '#ff0000', text: 'S.O.S', action: () => { if(window.SosSystem) window.SosSystem.showModal(); }, isSOS: true },
    { id: 'leaderboard-hud-btn', icon: 'fa-trophy', color: '#ffd700', text: '', action: () => { if(window.Leaderboard) window.Leaderboard.showModal(); } },
    { id: 'roadbook-rec-btn', icon: 'fa-route', color: '#b700ff', text: 'REC Trace', action: () => { if(window.RoadbookSystem) window.RoadbookSystem.toggleRecording(); } },
    { id: 'pitstop-hud-btn', icon: 'fa-gas-pump', color: '#ff0055', text: 'Pit Stop', action: () => { if(window.PitStopSystem) window.PitStopSystem.showModal(); } },
    { id: 'ghost-mode-btn', icon: 'fa-eye', color: '#00ffcc', text: 'Visible', action: () => { if(window.PrivacyManager) window.PrivacyManager.toggleGhostMode(); } },
    { id: 'privacy-settings-btn', icon: 'fa-shield-halved', color: '#aaa', text: '', action: () => { if(window.PrivacyManager) window.PrivacyManager.showSettingsModal(); }, isSmall: true },
  ];

  /**
   * Génère et insère les boutons du dock dans le <nav> existant.
   */
  function renderDock() {
    const dock = document.getElementById('apple-smart-dock');
    if (!dock) return;

    // Vider le dock
    dock.innerHTML = '';

    // Icon buttons
    DOCK_BUTTONS.forEach(btn => {
      const el = document.createElement('button');
      el.id = `dock-btn-${btn.id}`;
      el.className = 'dock-btn';
      el.setAttribute('aria-label', btn.label);
      el.setAttribute('role', 'button');
      el.style.color = btn.color;
      if (btn.size) el.style.fontSize = btn.size;
      
      el.addEventListener('click', btn.action);

      const iconPrefix = btn.iconPrefix || 'fa-solid';
      el.innerHTML = `<i class="${iconPrefix} ${btn.icon}" aria-hidden="true" style="filter: drop-shadow(0 0 5px ${btn.color})"></i>`;
      dock.appendChild(el);
    });

    // Feature buttons (bordered, with text)
    DOCK_FEATURE_BUTTONS.forEach(btn => {
      const el = document.createElement('button');
      el.id = btn.id;
      el.className = 'dock-feature-btn';
      el.addEventListener('click', btn.action);
      
      el.style.borderColor = btn.color;
      el.style.color = btn.color;
      el.style.border = `1px solid ${btn.color}`;
      if (btn.isSOS) {
        el.style.background = 'rgba(255, 0, 0, 0.2)';
        el.style.borderWidth = '2px';
        el.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
      }
      if (btn.isSmall) {
        el.style.border = 'none';
        el.style.fontSize = '1.2rem';
        el.style.padding = '5px';
      }

      const text = btn.text ? ` ${btn.text}` : '';
      el.innerHTML = `<i class="fa-solid ${btn.icon}"></i>${text}`;
      dock.appendChild(el);
    });
  }

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', renderDock);

  // Expose minimal API
  window.DockManager = { render: renderDock };

})();
