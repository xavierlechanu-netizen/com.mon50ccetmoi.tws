/* --- INFALLIBLE ARCHITECTURE: WATCHDOG & DEAD RECKONING --- */

// 1. WATCHDOG (Auto-Healing)
window.onerror = function (message, source, lineno, colno, error) {
  console.warn(
    "[WATCHDOG] Erreur fatale interceptÃ©e : ",
    message,
    " | Source:",
    source,
    " | Ligne:",
    lineno,
    " | Col:",
    colno,
  );
  // Au lieu de crasher, on tente un "Soft Reset" du module concernÃ©
  const body = document.body;
  if (body && body.style.display === "none") {
    body.style.display = "block"; // EmpÃªche l'Ã©cran blanc mortel
  }

  // Si l'erreur vient du chargement Maps, on force le mode dÃ©gradÃ©
  if (message.includes("google") || message.includes("maps")) {
    console.warn("[WATCHDOG] Bascule en mode Hors-Ligne forcÃ©.");
    if (typeof window.initOfflineMap === "function") {
      window.initOfflineMap();
    }
  }
  // L'erreur est interceptÃ©e, l'app ne s'arrÃªte pas
  return true;
};

window.onunhandledrejection = function (event) {
  console.warn("[WATCHDOG] Promesse rejetÃ©e silencieusement : ", event.reason);
  event.preventDefault(); // EmpÃªche l'application de s'effondrer
};

// 2. DEAD RECKONING (Mode Tunnel / Perte GPS)
window.lastKnownSpeedKmh = 0;
window.lastKnownHeading = 0;
window.gpsLastUpdate = Date.now();
window.isDeadReckoning = false;
window.deadReckoningInterval = null;

window.updateWatchdogTelemetry = function (speed, heading) {
  window.lastKnownSpeedKmh = speed;
  window.lastKnownHeading = heading;
  window.gpsLastUpdate = Date.now();

  // Si on a rÃ©cupÃ©rÃ© le signal
  if (window.isDeadReckoning) {
    window.isDeadReckoning = false;
    clearInterval(window.deadReckoningInterval);
    const tunnelAlert = document.getElementById("tunnel-warning");
    if (tunnelAlert) tunnelAlert.classList.add("hidden");
    if (typeof speak === "function") speak("Signal GPS rÃ©cupÃ©rÃ©.");
  }
};

window.checkGPSSignal = function () {
  const timeSinceLastGPS = Date.now() - window.gpsLastUpdate;

  // Si plus de 6 secondes sans GPS et qu'on roulait, on est dans un tunnel
  if (
    timeSinceLastGPS > 6000 &&
    window.lastKnownSpeedKmh > 10 &&
    !window.isDeadReckoning
  ) {
    window.isDeadReckoning = true;

    // Afficher l'alerte
    const tunnelAlert = document.getElementById("tunnel-warning");
    if (tunnelAlert) tunnelAlert.classList.remove("hidden");

    if (typeof speak === "function")
      speak(
        "Signal perdu. Mode tunnel activÃ©, navigation mathÃ©matique en cours.",
      );
    console.warn("[DEAD RECKONING] Mode tunnel activÃ© !");

    // Commencer Ã  avancer le marqueur artificiellement
    window.deadReckoningInterval = setInterval(() => {
      if (!window.userLocation || !window.userMarker) return;

      // Calculer la distance parcourue en 1 seconde
      // km/h -> m/s = / 3.6
      const distanceMeters = window.lastKnownSpeedKmh / 3.6;

      // Calcul mathÃ©matique trÃ¨s simplifiÃ© pour trouver les nouvelles coordonnÃ©es
      // 1 degrÃ© de latitude = ~111km
      const latOffset =
        (distanceMeters / 111000) *
        Math.cos((window.lastKnownHeading * Math.PI) / 180);
      const lngOffset =
        (distanceMeters /
          (111000 * Math.cos((window.userLocation.lat * Math.PI) / 180))) *
        Math.sin((window.lastKnownHeading * Math.PI) / 180);

      window.userLocation.lat += latOffset;
      window.userLocation.lng += lngOffset;

      // Mettre Ã  jour visuellement
      window.userMarker.setPosition(window.userLocation);
      if (window.map) window.map.panTo(window.userLocation);
    }, 1000);
  }
};

// Lancer le vÃ©rificateur de signal
setInterval(window.checkGPSSignal, 2000);
