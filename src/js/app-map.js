import { registerAction } from './actionRegistry.js';
import { distanceMeters } from './geo-math.js';
import './hazard-reports.js'; // signalements de dangers : window.saveHazard, toggleHazardMenu, loadHazards

// --- 3. ROUTAGE ---
let directionsRenderer = null;
let destinationMarker = null;
let currentRoutePolylines = [];
let currentRouteMarkers = [];

async function calculateRouteSansAutoroute(start, end) {
  if (!start || !end) {
    console.error("mon50cc Maps : Points de départ ou d'arrivée invalides.", {
      start,
      end,
    });
    if (!start) speak("Signal GPS insuffisant pour démarrer l'itinéraire.");
    return;
  }

  window.currentRouteDestination = end; // Store for GO button

  // Nettoyage des tracés précédents
  currentRoutePolylines.forEach((p) => p.setMap(null));
  currentRoutePolylines = [];
  currentRouteMarkers.forEach((m) => m.setMap(null));
  currentRouteMarkers = [];

  const originLat = typeof start.lat === "function" ? start.lat() : start.lat;
  const originLng = typeof start.lng === "function" ? start.lng() : start.lng;
  const destLat = typeof end.lat === "function" ? end.lat() : end.lat;
  const destLng = typeof end.lng === "function" ? end.lng() : end.lng;

  const motorType = window.session?.motor || "2t";
  const isBikeOrTrottinette = motorType === "trottinette" || motorType === "velo";

  let routeResult = null;

  // 1. Itinéraire IGN sans autoroute (DirectionsService souverain, voir gmaps-compat.js)
  if (typeof google !== "undefined" && google.maps && google.maps.DirectionsService) {
    try {
      const directionsService = new google.maps.DirectionsService();
      const travelMode = isBikeOrTrottinette && google.maps.TravelMode.BICYCLING
        ? google.maps.TravelMode.BICYCLING
        : google.maps.TravelMode.DRIVING;

      const dirRequest = {
        origin: new google.maps.LatLng(originLat, originLng),
        destination: new google.maps.LatLng(destLat, destLng),
        travelMode: travelMode,
        avoidHighways: true,
        avoidTolls: true,
        provideRouteAlternatives: !!(window.isRodageActive || window.avoidCityCenters)
      };

      const gResult = await new Promise((resolve, reject) => {
        directionsService.route(dirRequest, (res, status) => {
          if (status === google.maps.DirectionsStatus.OK && res?.routes?.length > 0) {
            resolve(res);
          } else {
            reject(new Error(`DirectionsService status: ${status}`));
          }
        });
      });

      if (gResult && gResult.routes.length > 0) {
        let routeIndex = 0;
        if (window.avoidCityCenters && gResult.routes.length > 1) {
          let maxDist = -1;
          for (let i = 0; i < gResult.routes.length; i++) {
            if (gResult.routes[i].legs[0].distance.value > maxDist) {
              maxDist = gResult.routes[i].legs[0].distance.value;
              routeIndex = i;
            }
          }
        }
        const selectedRoute = gResult.routes[routeIndex];
        const rawLeg = selectedRoute.legs[0];
        const path = selectedRoute.overview_path;

        routeResult = {
          path: path,
          distanceMeters: rawLeg.distance.value,
          durationSec: rawLeg.duration.value,
          leg: {
            distance: rawLeg.distance,
            duration: rawLeg.duration,
            distanceMeters: rawLeg.distance.value,
            durationSec: rawLeg.duration.value,
            steps: rawLeg.steps.map(s => ({
              instructions: s.instructions || "",
              navigationInstruction: { instructions: s.instructions || "" },
              distance: s.distance,
              distanceMeters: s.distance?.value || 0,
              duration: s.duration,
              durationSec: s.duration?.value || 0,
              start_location: s.start_location,
              end_location: s.end_location
            }))
          }
        };
      }
    } catch (dirErr) {
      console.warn("[app-map] DirectionsService indisponible ou échoué, aucun itinéraire:", dirErr.message);
    }
  }

  // Pas de repli OSRM : le serveur public ne sait pas exclure les autoroutes, interdites aux 50 cc.

  if (!routeResult) {
    speak("Impossible de calculer l'itinéraire pour le moment. Vérifiez votre connexion.");
    return;
  }

  try {
    const path = routeResult.path;
    const leg = routeResult.leg;

    // Tracé de la polyline sur la carte
    const polyline = new google.maps.Polyline({
      path: path,
      map: map,
      strokeColor: "#00d2ff",
      strokeOpacity: 0.8,
      strokeWeight: 6,
    });
    currentRoutePolylines.push(polyline);

    // --- AJUSTEMENT DE LA VUE DE LA CARTE ---
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds);

    const infoBar = document.getElementById("nav-info-bar");
    if (infoBar) {
      infoBar.style.setProperty("display", "flex", "important");
    }

    const btnStop = document.getElementById("btn-stop-nav");
    if (btnStop) btnStop.classList.remove("hidden");

    const distEl = document.getElementById("nav-dist");
    const timeEl = document.getElementById("nav-time");
    const etaEl = document.getElementById("nav-eta");
    if (typeof window.startPremiumNavigation === "function") {
      try {
        window.startPremiumNavigation(leg);
      } catch (navErr) {
        console.warn("[app-map] Erreur startPremiumNavigation:", navErr);
      }
    }

    const routeDistText = leg.distanceMeters >= 1000 ? (leg.distanceMeters / 1000).toFixed(1) + " km" : leg.distanceMeters + " m";
    if (distEl) distEl.textContent = routeDistText;

    let durationSec = typeof leg.duration === 'string' ? (parseInt(leg.duration.replace('s', ''), 10) || 0) : (leg.duration?.value || leg.durationSec || 0);
    const distanceMeters = leg.distanceMeters;

      // --- AJUSTEMENT 50cc ---
      durationSec = Math.round(durationSec * 1.2); // +20% pour scooter 50cc en ville
      const maxSpeedMs = 32 / 3.6; // Vitesse moyenne réaliste pour un 50cc (32 km/h) avec les arrêts
      const googleSpeedMs = distanceMeters / durationSec;
      if (googleSpeedMs > maxSpeedMs) {
        durationSec = Math.round(distanceMeters / maxSpeedMs);
        if (window.Telemetry)
          window.Telemetry.addLog("INFO", `ETA ajusté pour 50cc.`);
      }

      const destNameLegacy =
        document.getElementById("route-search")?.value || "ITINÉRAIRE 50CC";
      const titleElLegacy = document.querySelector(".route-title");
      if (titleElLegacy)
        titleElLegacy.textContent = destNameLegacy.toUpperCase();

      // Activer le panneau de guidage interne (Waze-killer)
      const navInstruction = document.getElementById("nav-instruction");
      const nextStepName = document.getElementById("next-step-name");
      const nextStepDist = document.getElementById("next-step-dist");
      const navIcon = document.querySelector(".nav-icon i");

      if (navInstruction) navInstruction.classList.remove("hidden");

      const nextStep = leg.steps[0];
      if (nextStep) {
        const tempDiv = document.createElement("div");
        // eslint-disable-next-line no-restricted-syntax
tempDiv.innerHTML = nextStep.navigationInstruction ? nextStep.navigationInstruction.instructions : "";
        let instructionText = tempDiv.textContent || tempDiv.innerText || "";
        if (nextStepName) nextStepName.textContent = instructionText;
        const nextDistText = nextStep.distanceMeters >= 1000 ? (nextStep.distanceMeters / 1000).toFixed(1) + " km" : nextStep.distanceMeters + " m";
        if (nextStepDist) nextStepDist.textContent = nextDistText;

        if (navIcon) {
          const lowerInst = instructionText.toLowerCase();
          if (lowerInst.includes("gauche")) {
            navIcon.className = "fa-solid fa-arrow-turn-up";
            navIcon.style.transform = "scaleX(-1) rotate(90deg)";
          } else if (lowerInst.includes("droite")) {
            navIcon.className = "fa-solid fa-arrow-turn-up";
            navIcon.style.transform = "rotate(90deg)";
          } else if (lowerInst.includes("rond-point")) {
            navIcon.className = "fa-solid fa-arrows-spin";
            navIcon.style.transform = "rotate(0deg)";
          } else {
            navIcon.className = "fa-solid fa-arrow-up";
            navIcon.style.transform = "rotate(0deg)";
          }
        }

        // NEXUS ATLAS : Annonce vocale de l'instruction de guidage
        setTimeout(() => {
          if (typeof speak === "function") {
            speak(
              "Guidage interne démarré. Dans " +
                nextDistText +
                ", " +
                instructionText,
            );
          }
        }, 6000); // Décalé de 6 secondes pour laisser Nexus Atlas annoncer l'ETA en premier
      }

      let durationTextStr;
      const totalMins = Math.floor(durationSec / 60);
      if (totalMins >= 60) {
        durationTextStr = `${Math.floor(totalMins / 60)} h ${totalMins % 60} min`;
      } else {
        durationTextStr = `${totalMins} min`;
      }

      if (timeEl) timeEl.textContent = durationTextStr;
      if (etaEl) {
        const arrivalTime = new Date(
          Date.now() + durationSec * 1000,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        etaEl.textContent = arrivalTime;
      }

      // Détection ferry (Legacy API translation)
      window.routeFerries = leg.steps.filter(
        (s) => {
          const instr = s.navigationInstruction ? s.navigationInstruction.instructions : "";
          return instr.toLowerCase().includes("ferry");
        }
      );
      lastSpokenFerryIndex = -1;

      if (window.routeFerries.length > 0) {
        setTimeout(() => speak("ferry_detected"), 4000);
        if (
          window.NeuralHUD &&
          typeof window.NeuralHUD.logToConsole === "function"
        ) {
          window.NeuralHUD.logToConsole(
            `NAV_INTEL: FERRY_CROSSING_AHEAD (${window.routeFerries.length})`,
          );
        }
      }

      const etaText = etaEl ? etaEl.textContent : "";
      speak(
        window.getLocalizedRouteMsg(
          routeDistText,
          etaText,
          window.isRodageActive,
        ),
      );

      // SAFE RIDE : Vérification Météo
      if (window.SafeRide) {
        window.SafeRide.checkWeatherForRoute(destLat, destLng).then(
          (weather) => {
            if (weather.isDangerous) {
              const issuesStr = weather.issues.join(" et ");
              setTimeout(() => {
                if (typeof speak === "function") {
                  speak(
                    `Alerte Safe Ride : ${issuesStr} sur votre itinéraire. Équipez-vous et soyez très prudent avant de prendre la route.`,
                  );
                }
              }, 9000);

              // Modifier l'ETA visuellement (+20% temps pour danger)
              if (etaEl && timeEl) {
                const newDurationSec = durationSec * 1.2;
                const newTotalMins = Math.floor(newDurationSec / 60);
                timeEl.textContent =
                  newTotalMins >= 60
                    ? `${Math.floor(newTotalMins / 60)} h ${newTotalMins % 60} min (Météo)`
                    : `${newTotalMins} min (Météo)`;
                timeEl.style.color = "#ff4d4d"; // Rouge danger

                const newArrivalTime = new Date(
                  Date.now() + newDurationSec * 1000,
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                etaEl.textContent = newArrivalTime;
                etaEl.style.color = "#ff4d4d";
              }
            }
          },
        );
      }

      if (destinationMarker) destinationMarker.map = null;
      
      // Guard: Only create marker if AdvancedMarkerElement is available (B-02)
      if (window.googleLibraries?.AdvancedMarkerElement) {
        const destIcon = document.createElement("div");
        // eslint-disable-next-line no-restricted-syntax
destIcon.innerHTML = `<i class="fa-solid fa-flag-checkered"></i>`;
        destIcon.style.color = "white";
        destIcon.style.fontSize = "24px";
        destIcon.style.textShadow = "0 0 5px black";

        destinationMarker = new window.googleLibraries.AdvancedMarkerElement({
          position: { lat: destLat, lng: destLng },
          map: map,
          content: destIcon,
        });
        currentRouteMarkers.push(destinationMarker);
      }
  } catch (error) {
    console.error("Routage impossible: ", error);
    speak("Erreur de calcul d'itinéraire.");
  }
}

window.cancelRoute = function () {
  if (directionsRenderer) {
    try { directionsRenderer.setDirections({ routes: [] }); } catch (e) {}
  }
  if (destinationMarker) {
    destinationMarker.map = null; // AdvancedMarkerElement uses .map property, not .setMap()
    destinationMarker = null;
  }

  // Clean up route polylines and markers
  currentRoutePolylines.forEach((p) => { try { p.setMap(null); } catch(e) {} });
  currentRoutePolylines = [];
  currentRouteMarkers.forEach((m) => { try { m.map = null; } catch(e) {} });
  currentRouteMarkers = [];

  const navInstr = document.getElementById("nav-instruction");
  if (navInstr) navInstr.classList.add("hidden");
  const navBar = document.getElementById("nav-info-bar");
  if (navBar) navBar.style.display = "none";
  const btnStop = document.getElementById("btn-stop-nav");
  if (btnStop) btnStop.classList.add("hidden");
  const btnReroute = document.getElementById("btn-reroute");
  if (btnReroute) btnReroute.classList.add("hidden");

  const searchEl = document.getElementById("route-search");
  if (searchEl) searchEl.value = "";
};

window.pendingDestination = null;

window.toggleManualStart = function () {
  const box = document.getElementById("manual-start-box");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) {
    const startEl =
      document.getElementById("route-start-gmp") ||
      document.getElementById("route-start");
    startEl.focus();
  }
};

window.searchDestination = function () {
  const searchEl =
    document.getElementById("route-search-gmp") ||
    document.getElementById("route-search");
  const startEl =
    document.getElementById("route-start-gmp") ||
    document.getElementById("route-start");

  const query = searchEl
    ? searchEl.inputValue !== undefined
      ? searchEl.inputValue
      : searchEl.value
    : "";
  const startQuery = startEl
    ? startEl.inputValue !== undefined
      ? startEl.inputValue
      : startEl.value
    : "";

  if (!query) return;

  if (!geocoder || !map) {
    speak("Carte en cours de chargement, veuillez patienter.");
    return;
  }

  // SI DEPART MANUEL
  if (startQuery.trim() !== "") {
    geocoder.geocode({ address: startQuery }, (resStart, statusStart) => {
      if (statusStart === "OK") {
        const startPos = resStart[0].geometry.location;
        geocoder.geocode({ address: query }, (resEnd, statusEnd) => {
          if (statusEnd === "OK") {
            const dest = resEnd[0].geometry.location;
            window.currentRouteDestination = dest;
            calculateRouteSansAutoroute(startPos, dest);
          } else {
            speak("Destination introuvable.");
          }
        });
      } else {
        speak("Lieu de départ introuvable.");
      }
    });
    return;
  }

  // SINON GPS CLASSIQUE
  if (!currentPosition) {
    speak(
      "Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.",
    );
    window.pendingDestinationName = query;
    return;
  }

  geocoder.geocode({ address: query }, (res, status) => {
    if (status === "OK") {
      const dest = res[0].geometry.location;
      window.currentRouteDestination = dest;
      calculateRouteSansAutoroute(currentPosition, dest);
      map.panTo(dest);
      const btnCancel = document.getElementById("btn-cancel-route");
      if (btnCancel) btnCancel.classList.remove("hidden");
    } else {
      speak("Destination introuvable.");
    }
  });
};

window.launchNativeGPS = function () {
  if (!window.currentRouteDestination) return;
  const lat =
    typeof window.currentRouteDestination.lat === "function"
      ? window.currentRouteDestination.lat()
      : window.currentRouteDestination.lat;
  const lng =
    typeof window.currentRouteDestination.lng === "function"
      ? window.currentRouteDestination.lng()
      : window.currentRouteDestination.lng;
  // Ouvre l'application GPS choisie par l'utilisateur (Waze, Plans, OsmAnd…), jamais Google imposé.
  // Attention : l'itinéraire sans autoroute est celui calculé dans l'application ; une appli externe peut en proposer un autre.
  const ua = navigator.userAgent;
  let url;
  if (/Android/i.test(ua)) url = `geo:${lat},${lng}?q=${lat},${lng}`;
  else if (/iPhone|iPad|iPod/i.test(ua)) url = `maps://?daddr=${lat},${lng}&dirflg=d`;
  else url = `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=15/${lat}/${lng}`;
  if (url.startsWith("http")) { window.open(url, "_blank", "noopener"); return; }
  window.location.href = url;

};

// Signalements de dangers (menu, enregistrement, affichage) : hazard-reports.js
// Ancien « radar » de points d'intérêt (carburant, garages, santé, DAB) et chrono retirés le 8/11/2026 :
// aucun bouton n'y menait. Le radar carburant actif est community-gas.js.

// --- COMMUNITY LIVE RENDERING (MOBILE HUD ENGINE) ---
let communityMarkers = [];
window.renderCommunityMarkers = function () {
  if (!map || !window.communityMembers) return;

  // Clear old markers
  communityMarkers.forEach((m) => m.setMap(null));
  communityMarkers = [];

  window.communityMembers.forEach((member) => {
    const memberIcon = document.createElement("div");
    memberIcon.style.width = "12px";
    memberIcon.style.height = "12px";
    memberIcon.style.backgroundColor = "#00d2ff";
    memberIcon.style.border = "2px solid white";
    memberIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: member.lat, lng: member.lng },
      map: map,
      title: member.username,
      content: memberIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black"><b>${escapeHTML(member.username)}</b><br><small>${escapeHTML(member.brand)} - ${escapeHTML(member.status)}</small></div>`,
    });
    m.addListener("click", () => info.open(map, m));
    communityMarkers.push(m);
  });
};

window.simulateLiveFleet = function () {
  // Retiré le 7/11/2026 : affichait 5 pilotes fictifs (noms et scooters inventés) autour de vous.
  // Les vrais membres en ligne sont affichés par renderCommunityMarkers (présence).
};

// --- 7. TERRITORY WARS (CREWS) ---
window.MapSystem = window.MapSystem || {};
window.MapSystem.territoryShapes = {}; // zipCode -> google.maps.Circle

window.MapSystem.updateTerritoryLayer = function (zipCode, data) {
  if (!map) return;

  const color = data.color || "#ffffff";

  // Si on l'a déjà dessiné, on met juste à jour la couleur
  if (this.territoryShapes[zipCode]) {
    this.territoryShapes[zipCode].setOptions({
      fillColor: color,
      strokeColor: color,
    });
    return;
  }

  // Sinon on tente de géocoder le code postal pour trouver le centre de la zone (en France)
  if (typeof geocoder !== "undefined" && geocoder) {
    geocoder.geocode({ address: zipCode + " France" }, (res, status) => {
      if (status === "OK" && res[0]) {
        const center = res[0].geometry.location;
        // Dessiner un grand cercle pour représenter le territoire
        const circle = new google.maps.Circle({
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.35,
          map: map,
          center: center,
          radius: 2000, // 2km radius approximation
        });

        // Ajouter une InfoWindow
        const info = new google.maps.InfoWindow({
          content: `<div style="color:black; font-family:'Outfit', sans-serif;">
                                <h3 style="margin:0; color:${color};"><i class="fa-solid fa-flag"></i> Secteur ${zipCode}</h3>
                                <p style="margin:5px 0;">Dominé par: <b>${data.dominantCrewName || "Inconnu"}</b></p>
                              </div>`,
        });

        circle.addListener("click", (ev) => {
          info.setPosition(ev.latLng);
          info.open(map);
        });

        this.territoryShapes[zipCode] = circle;
      }
    });
  }
};

let cachedTerritoryZip = null;
let lastTerritoryGeocodeTime = 0;
let lastTerritoryPos = null;

function getHaversineDist(pos1, pos2) {
  if (!pos1 || !pos2) return 999999;
  const lat1 = typeof pos1.lat === "function" ? pos1.lat() : pos1.lat;
  const lon1 = typeof pos1.lng === "function" ? pos1.lng() : pos1.lng;
  const lat2 = typeof pos2.lat === "function" ? pos2.lat() : pos2.lat;
  const lon2 = typeof pos2.lng === "function" ? pos2.lng() : pos2.lng;
  return distanceMeters(lat1, lon1, lat2, lon2);
}

// Tracking optimisé de km sur le code postal actuel si en mouvement (D-03)
setInterval(() => {
  if (!window.isRiding || !window.currentPosition || typeof geocoder === "undefined") return;

  const now = Date.now();
  const distFromLast = getHaversineDist(window.currentPosition, lastTerritoryPos);

  // N'appeler l'API Geocoding que si déplacé de > 1km ou si le cache a plus de 10 min
  if (!cachedTerritoryZip || distFromLast > 1000 || (now - lastTerritoryGeocodeTime > 600000)) {
    lastTerritoryGeocodeTime = now;
    lastTerritoryPos = window.currentPosition;
    geocoder.geocode({ location: window.currentPosition }, (res, status) => {
      if (status === "OK" && res[0]) {
        const zipComp = res[0].address_components.find((c) =>
          c.types.includes("postal_code"),
        );
        if (zipComp) {
          cachedTerritoryZip = zipComp.short_name;
        }
      }
    });
  }

  // Créditer les points avec le code postal en cache (0 requête API superflue)
  if (cachedTerritoryZip && window.CrewSystem && window.CrewSystem.currentCrew) {
    window.CrewSystem.addKmToTerritory(cachedTerritoryZip, 0.5);
  }
}, 60000);

// --- Action Registry (ESM) ---
registerAction('calculateRouteSansAutoroute', calculateRouteSansAutoroute);
