import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import * as geofire from 'geofire-common';
import { registerAction } from './actionRegistry.js';

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

  // 1. TIER 1 : Google Maps DirectionsService (Standard, toujours actif sur clé JS)
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
      console.warn("[app-map] DirectionsService indisponible ou échoué, essai Routes API / OSRM:", dirErr.message);
    }
  }

  // 2. TIER 2 : Google Maps Routes API moderne (si importé et activé)
  if (!routeResult && window.googleLibraries?.routes?.Route) {
    try {
      const { Route } = window.googleLibraries.routes;
      const request = {
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: isBikeOrTrottinette ? "BICYCLE" : "DRIVE",
        routeModifiers: { avoidHighways: true, avoidTolls: true },
        computeAlternativeRoutes: !!(window.isRodageActive || window.avoidCityCenters),
        fields: [
          "routes.distanceMeters",
          "routes.duration",
          "routes.polyline.encodedPolyline",
          "routes.legs.distanceMeters",
          "routes.legs.duration",
          "routes.legs.steps"
        ],
      };
      const { routes } = await Route.computeRoutes(request);
      if (routes && routes.length > 0) {
        let routeIndex = 0;
        if (window.avoidCityCenters && routes.length > 1) {
          let maxDist = -1;
          for (let i = 0; i < routes.length; i++) {
            if (routes[i].legs[0].distanceMeters > maxDist) {
              maxDist = routes[i].legs[0].distanceMeters;
              routeIndex = i;
            }
          }
        }
        const selectedRoute = routes[routeIndex];
        const rawLeg = selectedRoute.legs[0];
        const path = google.maps.geometry.encoding.decodePath(selectedRoute.polyline.encodedPolyline);
        const durSec = parseInt(rawLeg.duration.replace("s", ""), 10) || 0;
        const distMet = rawLeg.distanceMeters || 0;
        const distKmText = distMet >= 1000 ? (distMet / 1000).toFixed(1) + " km" : distMet + " m";
        const durMinText = Math.round(durSec / 60) + " min";

        routeResult = {
          path: path,
          distanceMeters: distMet,
          durationSec: durSec,
          leg: {
            distance: { text: distKmText, value: distMet },
            duration: { text: durMinText, value: durSec },
            distanceMeters: distMet,
            durationSec: durSec,
            steps: (rawLeg.steps || []).map(s => {
              const instr = s.navigationInstruction?.instructions || s.instructions || "";
              const stepDist = s.distanceMeters || 0;
              const stepDistText = stepDist >= 1000 ? (stepDist / 1000).toFixed(1) + " km" : stepDist + " m";
              return {
                instructions: instr,
                navigationInstruction: { instructions: instr },
                distance: { text: stepDistText, value: stepDist },
                distanceMeters: stepDist,
                duration: { text: "", value: 0 }
              };
            })
          }
        };
      }
    } catch (routeErr) {
      console.warn("[app-map] Routes API computeRoutes échoué:", routeErr.message);
    }
  }

  // 3. TIER 3 : Fallback OSRM (100% autonome, profil bicycle pour vélo/trottinette ou driving sans péage)
  if (!routeResult) {
    try {
      const osrmProfile = isBikeOrTrottinette ? "bicycle" : "driving";
      console.info(`[app-map] Activation du fallback OSRM (Profil : ${osrmProfile})...`);
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
      const osrmResp = await fetch(osrmUrl);
      if (osrmResp.ok) {
        const osrmData = await osrmResp.json();
        if (osrmData.code === "Ok" && osrmData.routes?.length > 0) {
          const selectedRoute = osrmData.routes[0];
          const rawLeg = selectedRoute.legs[0];
          const coordinates = selectedRoute.geometry.coordinates;
          const path = coordinates.map(c => new google.maps.LatLng(c[1], c[0]));
          const distMet = Math.round(rawLeg.distance);
          const durSec = Math.round(rawLeg.duration);
          const distKmText = distMet >= 1000 ? (distMet / 1000).toFixed(1) + " km" : distMet + " m";
          const durMinText = Math.round(durSec / 60) + " min";

          routeResult = {
            path: path,
            distanceMeters: distMet,
            durationSec: durSec,
            leg: {
              distance: { text: distKmText, value: distMet },
              duration: { text: durMinText, value: durSec },
              distanceMeters: distMet,
              durationSec: durSec,
              steps: (rawLeg.steps || []).map(s => {
                const modifier = s.maneuver?.modifier ? ` (${s.maneuver.modifier})` : "";
                const instr = s.maneuver?.type ? `${s.name || 'Continuer'} ${modifier}` : (s.name || "Continuer tout droit");
                const stepDist = Math.round(s.distance || 0);
                const stepDistText = stepDist >= 1000 ? (stepDist / 1000).toFixed(1) + " km" : stepDist + " m";
                return {
                  instructions: instr,
                  navigationInstruction: { instructions: instr },
                  distance: { text: stepDistText, value: stepDist },
                  distanceMeters: stepDist,
                  duration: { text: Math.round((s.duration || 0) / 60) + " min", value: Math.round(s.duration || 0) }
                };
              })
            }
          };
        }
      }
    } catch (osrmErr) {
      console.error("[app-map] Erreur Fallback OSRM:", osrmErr);
    }
  }

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
  const isWazeInstalled = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Default to Google Maps which supports avoidHighways via dirflg=h (partially)
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dirflg=h`;
  window.open(url, "_blank");
};

// --- 4. SERVICES COMMUNAUTAIRES (SIGNALEMENTS) ---
window.toggleHazardMenu = function () {
  const opts = document.getElementById("hazard-options");
  const mainBtn =
    document.getElementById("btn-hazard-quick") ||
    document.getElementById("btn-hazard-main");
  if (!opts) return;
  if (opts.classList.contains("hidden")) {
    opts.classList.remove("hidden");
    if (mainBtn) mainBtn.style.transform = "rotate(45deg)";
  } else {
    opts.classList.add("hidden");
    if (mainBtn) mainBtn.style.transform = "rotate(0deg)";
  }
};

window.saveHazard = function (type, description = "") {
  if (!currentPosition) return;

  // VERIFICATION DU BAN
  if (typeof isUserBanned === "function" && isUserBanned()) {
    const remaining = Math.ceil(
      (window.session.bannedUntil - Date.now()) / 60000,
    );
    alert(
      `🚨 Action Interdite : Votre compte est suspendu pour faux signalements répétés. Fin de la sanction dans ${remaining} minutes.`,
    );
    return;
  }

  const hash = geofire.geohashForLocation([currentPosition.lat, currentPosition.lng]);

  const h = {
    lat: currentPosition.lat,
    lon: currentPosition.lng,
    type: type,
    description: description,
    author: window.session ? window.session.username : "Anonyme",
    date: new Date().toISOString(),
    geohash: hash,
  };

  // 1. Sauvegarde Locale (Fallback)
  let dbLocal = JSON.parse(secureGetItem("hazards") || "[]");
  dbLocal.push(h);
  secureSetItem("hazards", JSON.stringify(dbLocal));

  // 2. Publication Cloud (Temps réel pour la communauté)
  if (typeof publishHazardCloud === "function") {
    publishHazardCloud(h).then((success) => {});
  }

  alert(`Signalement: ${escapeHTML(type)} enregistré ! Merci à vous.`);

  // GAMIFICATION: +50 XP pour le signalement communautaire
  if (typeof window.updateXP === "function") {
    window.updateXP(5); // +50 XP (updateXP multiplie par 10)
    if (typeof speak === "function")
      speak("Signalement validé. Vous gagnez de l'expérience.");
  }

  toggleHazardMenu();
  loadHazards();
};

async function loadHazards() {
  if (typeof google === "undefined" || !google.maps || !window.googleLibraries?.AdvancedMarkerElement || !map)
    return;

  const center = map.getCenter();
  if (!center) return;

  // Filtrage par rayon de proximité (25 km autour du centre de la vue)
  const radiusInM = 25000;
  const bounds = geofire.geohashQueryBounds(
    [center.lat(), center.lng()],
    radiusInM
  );

  const promises = [];
  for (const b of bounds) {
    const q = db.collection('hazards')
      .orderBy('geohash')
      .startAt(b[0])
      .endAt(b[1]);
    promises.push(q.get());
  }

  let hazards = [];
  try {
    const snapshots = await Promise.all(promises);
    
    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const data = doc.data();
        let hazard = data;
        
        // Skip legacy encrypted documents
        if (data.payload) {
          continue;
        }

        const hLat = hazard.pos?.lat || hazard.lat;
        const hLng = hazard.pos?.lng || hazard.lon || hazard.lng;

        if (hLat && hLng) {
          const distanceInKm = geofire.distanceBetween([hLat, hLng], [center.lat(), center.lng()]);
          if (distanceInKm <= (radiusInM / 1000)) {
            // Éviter les doublons potentiels liés au tuilage Firestore
            if (!hazards.some(existing => existing.date === hazard.date && existing.author === hazard.author)) {
              hazards.push(hazard);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[app-map] Erreur lors des requêtes spatiales hazards:", err);
    return; // Fallback ou arrêt
  }

  // Filtrage éphémère Animaux (> 30 mins = expiré)
  hazards = hazards.filter((h) => {
    if ((h.type === "animal" || h.type === "chien") && h.date) {
      const ageMins = (Date.now() - new Date(h.date).getTime()) / 60000;
      return ageMins <= 30;
    }
    return true;
  });

  hazardMarkers.forEach((m) => m.setMap(null));
  hazardMarkers = [];

  const listContainer = document.getElementById("live-hazards-list");
  if (listContainer) {
    if (hazards.length === 0) {
      // eslint-disable-next-line no-restricted-syntax
listContainer.innerHTML = '<p style="font-size:0.8rem; color:#666; text-align:center; padding:10px;">Aucun danger signalé.</p>';
    } else {
      // eslint-disable-next-line no-restricted-syntax
listContainer.innerHTML = "";
      hazards.reverse(); // Voir les plus récents en premier dans la liste
    }
  }

  hazards.forEach((h, index) => {
    const isAnimal = h.type === "animal" || h.type === "chien";
    const hColor =
      h.type === "Police"
        ? "#00d2ff"
        : h.type === "Route Dégradée"
          ? "#f1c40f"
          : isAnimal
            ? "#e67e22"
            : "#ff4d4d";
    const hazardIcon = document.createElement("div");
    hazardIcon.style.width = "18px";
    hazardIcon.style.height = "18px";
    hazardIcon.style.backgroundColor = hColor;
    hazardIcon.style.border = "2px solid white";
    hazardIcon.style.borderRadius = "50%";

    const marker = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: h.lat, lng: h.lon },
      map: map,
      content: hazardIcon,
    });
    const info = new google.maps.InfoWindow({
      content: `<b>${isAnimal ? "ðŸ¾ " : ""}${escapeHTML(h.type)}</b><br><small>${escapeHTML(h.author)}</small>`,
    });
    marker.addListener("click", () => info.open(map, marker));
    hazardMarkers.push(marker);

    // Ajout à la liste sidebar
    if (listContainer && index < 5) {
      // On affiche les 5 derniers max
      const div = document.createElement("div");
      div.className = "hazard-alert";
      div.style.cursor = "pointer";
      // eslint-disable-next-line no-restricted-syntax
      div.innerHTML = `<div><i class="fa-solid fa-${isAnimal ? "paw" : "triangle-exclamation"}"></i> <strong>${escapeHTML(h.type)}</strong><br><span>Par ${escapeHTML(h.author)}</span></div><i class="fa-solid fa-chevron-right" style="font-size:0.6rem; color:#444;"></i>`;
      div.onclick = () => {
        map.setCenter({ lat: h.lat, lng: h.lon });
        map.setZoom(17);
        info.open(map, marker);
        toggleMenu();
      };
      listContainer.appendChild(div);
    }
  });
}

// --- 5. SONAR RADAR (POI SCAN) ---
const poiConfig = {
  fuel: {
    icon: "fa-gas-pump",
    label: "Essence",
    color: "#cca000",
    radius: 5000,
  },
  doctors: {
    icon: "fa-briefcase-medical",
    label: "Santé & Pharmacie",
    color: "#e74c3c",
    radius: 3000,
  },
  atm: {
    icon: "fa-money-bill-1",
    label: "DAB",
    color: "#2ecc71",
    radius: 3000,
  },
  mechanic: {
    icon: "fa-wrench",
    label: "Garages",
    color: "#ffa500",
    radius: 8000,
  },
  tourist_attraction: {
    icon: "fa-landmark",
    label: "Lieux Historiques",
    color: "#e67e22",
    radius: 10000,
  },
};

window.toggleRadarMenu = function () {
  const r = document.getElementById("radar-options");
  if (r) r.classList.toggle("hidden");
};

window.currentActiveRadarType = null;
window.lastRadarSearchCenter = null;

window.scanRadar = function (type, searchCenter = null) {
  const targetCenter = searchCenter || currentPosition;
  if (!targetCenter) return;
  
  toggleRadarMenu();
  window.currentActiveRadarType = type;
  window.lastRadarSearchCenter = targetCenter;
  
  const config = poiConfig[type];
  const radarBtn =
    document.getElementById("btn-radar-quick") ||
    document.getElementById("btn-radar-main");
  const oldHtml = radarBtn ? radarBtn.innerHTML : "";
  if (radarBtn)
    // eslint-disable-next-line no-restricted-syntax
    radarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  if (type === "fuel") {
    // --- NEW: Government Data Integration ---
    fetchFuelPricesUsingGovAPI(
      targetCenter.lat,
      targetCenter.lng || targetCenter.lon,
      config,
      radarBtn,
      oldHtml,
    );
  } else if (type === "mechanic") {
    // --- NEW: Google Places Garage Integration ---
    fetchGaragesUsingPlacesAPI(
      targetCenter.lat,
      targetCenter.lng || targetCenter.lon,
      config,
      radarBtn,
      oldHtml,
    );
  } else {
    // Standard Overpass Search for other POIs
    const lat = targetCenter.lat;
    const lon = targetCenter.lng || targetCenter.lon;
    // MEDICAL includes doctors, clinics, hospitals AND pharmacy
    const medicalTags = "clinic|hospital|doctors|pharmacy";
    const query = `[out:json][timeout:15];(nwr["amenity"~"${type === "doctors" ? medicalTags : type}"](around:${config.radius},${lat},${lon}););out center;`;
    const url = `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        renderPoiMarkers(data.elements, config);
      })
      .finally(() => {
        if (radarBtn) // eslint-disable-next-line no-restricted-syntax
radarBtn.innerHTML = oldHtml;
      });
  }
};

async function fetchFuelPricesUsingGovAPI(lat, lng, config, btn, oldHtml) {
  // API OpenData Gouv: Prix des carburants
  const url = `https://data.economie.gouv.fr/api/records/1.0/search/?dataset=prix-des-carburants-en-france-flux-instantane-v2&q=&geofilter.distance=${lat},${lng},5000&rows=20`;

  try {
    const blacklist =
      typeof getBlacklist === "function" ? await getBlacklist() : [];
    const today = new Date().toISOString().split("T")[0];
    const reportsSnap = await db
      .collection("reports_abuse")
      .where("lastUpdate", ">=", new Date(today))
      .get();
    const reportCounts = {};
    reportsSnap.forEach((doc) => {
      reportCounts[doc.data().stationId] = doc.data().count;
    });

    const res = await fetch(url);
    const data = await res.json();
    officialPoiMarkers.forEach((m) => m.setMap(null));
    officialPoiMarkers = [];

    if (data.records) {
      data.records.forEach((record) => {
        const fields = record.fields;
        const coords = record.geometry.coordinates;
        const stationId = record.recordid;

        // Masquer si blacklistée
        if (blacklist.includes(stationId)) {
          return;
        }

        // Extraction des prix
        let pricesHtml = "";
        try {
          const priceList = JSON.parse(fields.prix || "[]");
          priceList.forEach((p) => {
            // Ignorer le gazole (pas pour les 50cc)
            if (p["@nom"] === "Gazole") return;

            pricesHtml += `<div style="display:flex; justify-content:space-between; gap:10px;">
                            <strong>${p["@nom"]}</strong> <span>${parseFloat(p["@valeur"]).toFixed(3)}€</span>
                        </div>`;
          });
        } catch (e) {
          pricesHtml = "Prix non disponibles";
        }

        const fuelIcon = document.createElement("div");
        // eslint-disable-next-line no-restricted-syntax
fuelIcon.innerHTML = `<i class="fa-solid fa-gas-pump"></i>`;
        fuelIcon.style.color = "#cca000";
        fuelIcon.style.fontSize = "20px";
        fuelIcon.style.backgroundColor = "white";
        fuelIcon.style.padding = "4px";
        fuelIcon.style.borderRadius = "50%";
        fuelIcon.style.border = "2px solid #cca000";

        const marker = new window.googleLibraries.AdvancedMarkerElement({
          position: { lat: coords[1], lng: coords[0] },
          map: map,
          content: fuelIcon,
        });

        // Compteur de signalements
        const currentReports = reportCounts[stationId] || 0;
        const reportBadge =
          currentReports > 0
            ? `<div style="color:#ff4d4d; font-size:0.7rem; font-weight:bold; margin-top:5px;"><i class="fa-solid fa-triangle-exclamation"></i> ${currentReports}/10 signalements</div>`
            : "";

        // Bouton de signalement pour les membres
        const isGuest = !window.session;
        const reportBtn = isGuest
          ? ""
          : `
                    <button data-action="triggerPhotoReport('${stationId}', '${fields.vile || fields.adresse}')" 
                        style="width:100%; margin-top:5px; background:#ff4d4d; color:white; border:none; padding:5px; border-radius:5px; font-size:0.7rem; cursor:pointer;">
                        🚨 Signaler Abus Prix (+Photo)
                    </button>`;

        const info = new google.maps.InfoWindow({
          content: `<div style="color:black; min-width:150px;">
                        <b style="font-size:1rem;">${escapeHTML(fields.vile || "Station")}</b><br>
                        <small>${escapeHTML(fields.adresse)}</small>
                        <hr style="border:0; border-top:1px solid #eee; margin:5px 0;">
                        ${pricesHtml}
                        ${reportBadge}
                        ${reportBtn}
                    </div>`,
        });
        marker.addListener("click", () => info.open(map, marker));
        officialPoiMarkers.push(marker);
      });
    }
  } catch (e) {
    console.error("Gov API fail", e);
    alert("Erreur lors de la récupération des prix.");
  } finally {
    // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = oldHtml;
  }
}
async function fetchGaragesUsingPlacesAPI(lat, lng, config, btn, oldHtml) {
  if (!google.maps.places) {
    alert("Services de lieux non disponibles.");
    // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = oldHtml;
    return;
  }

  const service = new google.maps.places.PlacesService(map);
  const request = {
    location: new google.maps.LatLng(lat, lng),
    radius: config.radius,
    keyword: "garage scooter 50cc moto",
  };

  service.nearbySearch(request, (results, status) => {
    // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = oldHtml;
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      officialPoiMarkers.forEach((m) => m.setMap(null));
      officialPoiMarkers = [];

      // FILTRAGE : Uniquement ceux avec note >= 3.3
      const filtered = results.filter((r) => (r.rating || 0) >= 3.3);

      filtered.forEach(async (place) => {
        // DONNEES COMMUNAUTAIRES
        const internalInfo =
          typeof getGarageInternalInfo === "function"
            ? await getGarageInternalInfo(place.place_id)
            : null;
        const isPro = (internalInfo?.count || 0) >= 1000;
        const proBadge = isPro
          ? `<div style="background:#ffd700; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-trophy"></i> BADGE PRO CERTIFIÉ</div>`
          : "";
        const qualityBadge =
          place.rating > 3.9
            ? `<div style="background:#f1c40f; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-certificate"></i> QUALITÉ CERTIFIÉE (>3.9)</div>`
            : "";
        const communityRating = internalInfo
          ? `<div style="font-size:0.7rem; color:#00d2ff; margin-top:3px;">Label Scooter : â­ ${internalInfo.avgRating}/5 (${internalInfo.count} avis)</div>`
          : "";

        const garageIcon = document.createElement("div");
        garageIcon.style.width = place.rating > 3.9 ? "24px" : "20px";
        garageIcon.style.height = place.rating > 3.9 ? "24px" : "20px";
        garageIcon.style.backgroundColor = place.rating > 3.9 ? "#f1c40f" : isPro ? "#ffd700" : config.color;
        garageIcon.style.border = (place.rating > 3.9 ? "3px" : "1px") + " solid white";
        garageIcon.style.borderRadius = "50%";

        const marker = new window.googleLibraries.AdvancedMarkerElement({
          position: place.geometry.location,
          map: map,
          content: garageIcon,
        });

        // Étoiles de notation
        const isGuest = !window.session;
        const safePlaceName = (place.name || "")
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const starBtns = isGuest
          ? ""
          : `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px;">
                    <small>Évaluer ce garage :</small><br>
                    <span style="font-size:1.2rem; cursor:pointer;" data-action="evaluateGarage('${place.place_id}', '${safePlaceName}', 1)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" data-action="evaluateGarage('${place.place_id}', '${safePlaceName}', 2)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" data-action="evaluateGarage('${place.place_id}', '${safePlaceName}', 3)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" data-action="evaluateGarage('${place.place_id}', '${safePlaceName}', 4)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" data-action="evaluateGarage('${place.place_id}', '${safePlaceName}', 5)">â­</span>
                </div>`;

        const info = new google.maps.InfoWindow({
          content: `<div style="color:black; min-width:180px;">
                        <b style="font-size:1rem;">${escapeHTML(place.name)}</b><br>
                        â­ Google: ${place.rating || "N/A"}/5 (${place.user_ratings_total || 0})<br>
                        ${qualityBadge}
                        ${communityRating}
                        ${proBadge}
                        ${starBtns}
                    </div>`,
        });

        marker.addListener("click", () => info.open(map, marker));
        officialPoiMarkers.push(marker);
      });
      alert(`${filtered.length} garages certifiés (Note > 3.3) trouvés.`);
    } else {
      alert("Aucun garage trouvé dans cette zone.");
    }
  });
}
window.triggerPhotoReport = function (id, name) {
  const input = document.getElementById("abuse-photo-input");
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Notification
    alert("Traitement de la preuve photo en cours...");

    // Lecture en base64 pour le stockage Firestore (ou upload Storage si configuré)
    const reader = new FileReader();
    reader.onload = async (event) => {
      const photoData = event.target.result;
      if (typeof reportStationAbuse === "function") {
        reportStationAbuse(id, name, photoData);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click(); // Ouvrir l'appareil photo
};

function renderPoiMarkers(elements, config) {
  officialPoiMarkers.forEach((m) => m.setMap(null));
  officialPoiMarkers = [];
  if (elements?.length > 0) {
    elements.forEach((item) => {
      const poiIcon = document.createElement("div");
      poiIcon.style.width = "10px";
      poiIcon.style.height = "10px";
      poiIcon.style.backgroundColor = config.color;
      poiIcon.style.border = "1px solid white";
      poiIcon.style.borderRadius = "50%";

      const marker = new window.googleLibraries.AdvancedMarkerElement({
        position: {
          lat: item.lat || item.center.lat,
          lng: item.lon || item.center.lon,
        },
        map: map,
        content: poiIcon,
      });
      const info = new google.maps.InfoWindow({
        content: `<div style="color:black"><b>${escapeHTML(item.tags?.name || config.label)}</b></div>`,
      });
      marker.addListener("click", () => info.open(map, marker));
      officialPoiMarkers.push(marker);
    });
  }
  alert(`${elements?.length || 0} résultat(s) trouvés.`);
}

// --- 6. SIMULATIONS ET CHRONO ---
let tripSeconds = 0;
setInterval(() => {
  if (window.isRiding) tripSeconds++;
  const tEl = document.getElementById("trip-timer");
  if (tEl) {
    const str = new Date(tripSeconds * 1000).toISOString().substring(11, 19);
    tEl.textContent = str.startsWith("00:") ? str.substring(3) : str;
  }
}, 1000);

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
  if (!currentPosition || !map) return;
  const ghostNames = [
    "Rider_Z",
    "Nitro50",
    "BoostPowa",
    "StuntMan",
    "RoadRunner",
  ];
  const ghostBrands = [
    "Yamaha Bw's",
    "MBK Booster",
    "Piaggio Zip",
    "Peugeot Speedfight",
    "Derbi Senda",
  ];

  ghostNames.forEach((name, i) => {
    const offsetLat = (Math.random() - 0.5) * 0.01;
    const offsetLng = (Math.random() - 0.5) * 0.01;
    const ghostPos = {
      lat: currentPosition.lat + offsetLat,
      lng: currentPosition.lng + offsetLng,
    };

    const ghostIcon = document.createElement("div");
    ghostIcon.style.width = "10px";
    ghostIcon.style.height = "10px";
    ghostIcon.style.backgroundColor = "#666";
    ghostIcon.style.opacity = "0.5";
    ghostIcon.style.border = "1px solid white";
    ghostIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: ghostPos,
      map: map,
      title: name,
      content: ghostIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black"><b>${name} [IA]</b><br><small>${ghostBrands[i]}</small></div>`,
    });
    m.addListener("click", () => info.open(map, m));
    communityMarkers.push(m);
  });
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
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * (Math.sin(deltaLambda / 2) ** 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
registerAction('loadHazards', loadHazards);
registerAction('fetchFuelPricesUsingGovAPI', fetchFuelPricesUsingGovAPI);
registerAction('fetchGaragesUsingPlacesAPI', fetchGaragesUsingPlacesAPI);
registerAction('renderPoiMarkers', renderPoiMarkers);

window.checkMapPanForRadar = function () {
  if (!window.map || !window.currentActiveRadarType || !window.lastRadarSearchCenter) return;
  
  const center = window.map.getCenter();
  const currentPos = { lat: center.lat(), lng: center.lng() };
  
  const dist = getHaversineDist(window.lastRadarSearchCenter, currentPos);
  
  // Si déplacement > 4km (4000m), on affiche le bouton "Rechercher dans cette zone"
  if (dist > 4000) {
    let searchBtn = document.getElementById("btn-search-this-area");
    if (!searchBtn) {
      searchBtn = document.createElement("button");
      searchBtn.id = "btn-search-this-area";
      const searchIcon = document.createElement("i");
      searchIcon.className = "fa-solid fa-magnifying-glass";
      searchBtn.replaceChildren(searchIcon, document.createTextNode(" Rechercher ici"));
      searchBtn.style.cssText = `
        position: absolute;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: #1a1a1a;
        color: white;
        border: 2px solid #ffb703;
        padding: 10px 20px;
        border-radius: 30px;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.7);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
      `;
      
      // Animation au hover
      searchBtn.onmouseover = () => searchBtn.style.background = "#ffb703";
      searchBtn.onmouseout = () => searchBtn.style.background = "#1a1a1a";

      searchBtn.onclick = () => {
        searchBtn.style.display = "none"; // Cacher immédiatement après clic
        const newCenter = window.map.getCenter();
        window.scanRadar(window.currentActiveRadarType, { lat: newCenter.lat(), lng: newCenter.lng() });
      };
      
      const mapContainer = document.getElementById("map");
      if (mapContainer && mapContainer.parentElement) {
        mapContainer.parentElement.appendChild(searchBtn);
      } else {
        document.body.appendChild(searchBtn);
      }
    }
    searchBtn.style.display = "flex"; // S'assurer qu'il est visible
  } else {
    const searchBtn = document.getElementById("btn-search-this-area");
    if (searchBtn) searchBtn.style.display = "none";
  }
};
registerAction('checkMapPanForRadar', window.checkMapPanForRadar);

