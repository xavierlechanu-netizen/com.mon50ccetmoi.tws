import { distanceMeters } from './geo-math.js';
import './route-planner.js'; // itinéraire sans autoroute : calculateRouteSansAutoroute, searchDestination, cancelRoute…
import './hazard-reports.js'; // signalements de dangers : window.saveHazard, toggleHazardMenu, loadHazards

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
