import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/* --- CARBON TRADING & CEE MARKET --- */

window.ecoScore = 100;
window.ceeCertificates = parseInt(
  localStorage.getItem("ceeCertificates")
    ? atob(localStorage.getItem("ceeCertificates"))
    : "0",
);

// 1. ECO-DRIVING TELEMETRY
window.initEcoTelemetry = function () {
  let lastSpeed = 0;
  setInterval(() => {
    const currentSpeed = window.lastKnownSpeedKmh || 0;
    const delta = Math.abs(currentSpeed - lastSpeed);

    // Si freinage brutal ou accélération violente (> 15 km/h en 1s)
    if (delta > 15) {
      window.ecoScore -= 2;
      if (window.ecoScore < 0) window.ecoScore = 0;
    }

    lastSpeed = currentSpeed;
  }, 1000);
};

// 2. GENERATE CEE CERTIFICATE
window.generateEcoReport = function () {
  const certScreen = document.getElementById("cee-certificate-screen");
  const scoreVal = document.getElementById("cee-score");
  const serialVal = document.getElementById("cee-serial");

  if (!certScreen) return;

  // Simulation de calcul
  if (window.ecoScore > 75) {
    window.ceeCertificates++;
    localStorage.setItem(
      "ceeCertificates",
      btoa(window.ceeCertificates.toString()),
    );

    scoreVal.innerText = window.ecoScore + "/100";
    serialVal.innerText =
      "CEE-" +
      Math.random().toString(36).substring(2, 10).toUpperCase() +
      "-" +
      new Date().getFullYear();

    certScreen.classList.remove("hidden");
    if (typeof speak === "function")
      speak(
        "Trajet terminé. Score écologique excellent. Certificat d'économie d'énergie généré avec succès.",
      );

    // Update Wallet Badge if exists
    const walletBtn = document.getElementById("dock-btn-wallet");
    if (walletBtn) walletBtn.style.filter = "drop-shadow(0 0 15px #00ff00)";
  } else {
    if (typeof speak === "function")
      speak(
        "Trajet terminé. Conduite trop agressive, aucun certificat carbone délivré.",
      );
  }
};

window.closeCEE = function () {
  document.getElementById("cee-certificate-screen").classList.add("hidden");
};

// 3. CARBON TRADING FLOOR
window.openTradingFloor = function () {
  // Avant (corrigé le 7/11/2026) : faux cours de bourse tiré au hasard toutes les 2 s.
  const floorScreen = document.getElementById("carbon-trading-floor");
  const stockPrice = document.getElementById("carbon-stock-price");
  const inventory = document.getElementById("cee-inventory");
  if (!floorScreen) return;
  if (inventory) inventory.innerText = window.ceeCertificates + " CEE Disponibles";
  if (stockPrice) {
    stockPrice.innerText = "Marché non ouvert";
    stockPrice.style.color = "#aaaaaa";
  }
  floorScreen.classList.remove("hidden");
  if (typeof speak === "function") speak("Le marché des certificats carbone n'est pas encore ouvert.");
};

window.closeTradingFloor = function () {
  document.getElementById("carbon-trading-floor").classList.add("hidden");
  clearInterval(window.tradingInterval);
};

window.sellCEE = function () {
  // Avant (corrigé le 7/11/2026) : « vendre » effaçait vos certificats et annonçait des fonds
  // transférés, alors que rien n'était versé. Les certificats sont conservés.
  if (typeof speak === "function") speak("La revente de certificats n'est pas encore disponible. Vos certificats sont conservés.");
  const button = document.getElementById("sell-cee-btn");
  if (button) button.innerText = "BIENTÔT DISPONIBLE";
};

// Start telemetry
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initEcoTelemetry, 3000);
});
