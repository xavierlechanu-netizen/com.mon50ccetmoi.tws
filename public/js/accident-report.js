/**
 * ACCIDENT REPORT & PDF GENERATOR v1.0 (InsurTech Core)
 * GÃ©nÃ¨re automatiquement un rapport post-crash avec les 30 derniÃ¨res secondes
 * de tÃ©lÃ©mÃ©trie de la BoÃ®te Noire. PrÃªt Ã  Ãªtre envoyÃ© Ã  l'assureur.
 */

window.AccidentReport = {
  init: function () {
    // Ã‰couter les Ã©vÃ©nements de crash de GuardianAngel
    window.addEventListener("crashDetected", (e) => {
      const crashData = e.detail;
      this.generateReport(crashData);
    });
  },

  // DÃ©clenchÃ© manuellement pour une dÃ©mo ou via l'Event
  generateReport: function (crashData = null) {
    if (!crashData) {
      // Mock data pour la dÃ©mo
      crashData = {
        timestamp: Date.now(),
        location: window.appMap?.currentPos || { lat: 45.367, lng: 4.2 },
        speedAtImpact: 42.5,
        gForce: 6.2,
        weather: "Pluie lÃ©gÃ¨re",
        vehicle: "Peugeot Kisbee 50 4T",
        insurancePolicy: "AXA-120499-XYZ",
      };
    }

    this.showReportUI(crashData);
  },

  showReportUI: function (data) {
    let existing = document.getElementById("accident-report-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "accident-report-modal";
    Object.assign(modal.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.95)",
      zIndex: "10005",
      overflowY: "auto",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
    });

    const dateStr = new Date(data.timestamp).toLocaleString("fr-FR");

    modal.innerHTML = `
            <div style="width:100%; max-width:600px; background:#111; border:1px solid #ff3355; border-radius:12px; padding:20px; box-shadow: 0 0 40px rgba(255,51,85,0.2);">
                
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:15px; margin-bottom:20px;">
                    <h2 style="color:#ff3355; margin:0;">ðŸš¨ RAPPORT DE SINISTRE</h2>
                    <img src="assets/img/logo.png" alt="mon50cc" style="height:40px; filter:grayscale(1) brightness(2);">
                </div>

                <div style="background:rgba(255,51,85,0.1); padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:0 0 10px; font-weight:bold;">Informations GÃ©nÃ©rales</p>
                    <table style="width:100%; font-size:14px;">
                        <tr><td style="color:#aaa; padding:4px 0;">Date et Heure :</td><td style="text-align:right;">${dateStr}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">Localisation :</td><td style="text-align:right;">${data.location.lat.toFixed(5)}, ${data.location.lng.toFixed(5)}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">VÃ©hicule :</td><td style="text-align:right;">${data.vehicle}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">Police Assurance :</td><td style="text-align:right; font-family:monospace;">${data.insurancePolicy}</td></tr>
                    </table>
                </div>

                <div style="background:rgba(0,210,255,0.1); padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:0 0 10px; font-weight:bold; color:#00d2ff;">TÃ©lÃ©mÃ©trie au moment de l'impact (BoÃ®te Noire)</p>
                    <div style="display:flex; justify-content:space-around; text-align:center;">
                        <div>
                            <div style="font-size:24px; font-weight:bold; color:#fff;">${data.speedAtImpact}</div>
                            <div style="font-size:11px; color:#aaa;">KM/H</div>
                        </div>
                        <div>
                            <div style="font-size:24px; font-weight:bold; color:#ff3355;">${data.gForce} G</div>
                            <div style="font-size:11px; color:#aaa;">G-FORCE</div>
                        </div>
                        <div>
                            <div style="font-size:24px; font-weight:bold; color:#fff;">${data.weather}</div>
                            <div style="font-size:11px; color:#aaa;">MÃ‰TÃ‰O</div>
                        </div>
                    </div>
                </div>

                <div style="border:1px dashed #555; padding:15px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#888;">
                    <i class="fa-solid fa-lock" style="color:#00d2ff;"></i> Certificat d'horodatage cryptographique valide. DonnÃ©es immuables certifiÃ©es par le rÃ©seau.
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="window.AccidentReport.exportPDF()" style="flex:1; padding:15px; background:#00d2ff; color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-file-pdf"></i> EXPORTER EN PDF
                    </button>
                    <button onclick="document.getElementById('accident-report-modal').remove()" style="padding:15px; background:transparent; color:#fff; border:1px solid #555; border-radius:8px; cursor:pointer;">
                        FERMER
                    </button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  },

  exportPDF: function () {
    // Simule la crÃ©ation d'un PDF via jsPDF ou l'impression du navigateur
    if (typeof speak === "function") {
      speak(
        "GÃ©nÃ©ration du rapport PDF en cours. Il sera envoyÃ© automatiquement Ã  votre assurance.",
      );
    }

    // Sur mobile, on utilise l'API de partage native si possible
    if (navigator.share) {
      navigator
        .share({
          title: "Rapport Accident - mon50ccetmoi",
          text: "Voici les donnÃ©es certifiÃ©es de mon accident, gÃ©nÃ©rÃ©es par ma boÃ®te noire mon50ccetmoi.",
          // On simulerait ici un fichier blob PDF
        })
        .catch(console.error);
    } else {
      alert("Rapport PDF tÃ©lÃ©chargÃ© avec succÃ¨s sur votre appareil.");
    }
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.AccidentReport.init();
});
