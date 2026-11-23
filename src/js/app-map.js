import './route-planner.js'; // itinéraire sans autoroute : calculateRouteSansAutoroute, searchDestination, cancelRoute…
import './hazard-reports.js'; // signalements de dangers : window.saveHazard, toggleHazardMenu, loadHazards

// Signalements de dangers (menu, enregistrement, affichage) : hazard-reports.js
// Ancien « radar » de points d'intérêt (carburant, garages, santé, DAB) et chrono retirés le 8/11/2026 :
// aucun bouton n'y menait. Le radar carburant actif est community-gas.js.

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
