/* --- COMMUNITY GAS RADAR (OpenData Gouv + Firebase) --- */

window.CommunityGas = {
  stations: [],

  compareAndShow: function () {
    if (typeof speak === "function")
      speak(
        "Connexion au flux Open Data du gouvernement et rÃ©cupÃ©ration des prix en temps rÃ©el.",
      );

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          this.fetchGovData(
            position.coords.latitude,
            position.coords.longitude,
          ),
        (error) => {
          console.warn("Erreur GPS:", error);
          // Mock coordinates (Paris) for testing if GPS fails
          this.fetchGovData(48.8566, 2.3522);
        },
      );
    } else {
      this.fetchGovData(48.8566, 2.3522);
    }
  },

  fetchGovData: async function (lat, lon) {
    try {
      // RequÃªte vers l'API OpenDataSoft du Gouvernement FranÃ§ais (Rayon de 3km)
      const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?where=within_distance(geom, geom'POINT(${lon} ${lat})', 3km)&limit=20`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erreur API Gouvernementale");

      const data = await response.json();
      this.processGovData(data.results, lat, lon);
    } catch (e) {
      console.error(e);
      if (typeof speak === "function")
        speak(
          "Impossible de contacter le serveur gouvernemental. Veuillez rÃ©essayer plus tard.",
        );
    }
  },

  // Formule de Haversine pour calculer la distance exacte
  calculateDistance: function (lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la terre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  processGovData: function (records, myLat, myLon) {
    this.stations = [];

    if (!records || records.length === 0) {
      if (typeof speak === "function")
        speak(
          "Je ne trouve aucune station service rÃ©pertoriÃ©e dans un rayon de 3 kilomÃ¨tres.",
        );
      return;
    }

    records.forEach((record) => {
      if (!record.geom || !record.geom.lat || !record.geom.lon) return;

      const dist = this.calculateDistance(
        myLat,
        myLon,
        record.geom.lat,
        record.geom.lon,
      );

      // Le flux officiel liste les prix sous format JSON array ou chaÃ®ne XML parsÃ©e.
      // On extrait SP98 et E10 (s'ils existent)
      let sp98 = null;
      let e10 = null;

      // Parsing des prix (Le format dÃ©pend du flux, gÃ©nÃ©ralement record.prix est un array d'objets)
      try {
        let rawPrix = record.prix;
        if (typeof rawPrix === "string") rawPrix = JSON.parse(rawPrix);
        if (Array.isArray(rawPrix)) {
          rawPrix.forEach((p) => {
            if (p["@nom"] === "SP98") sp98 = parseFloat(p["@valeur"]);
            if (p["@nom"] === "E10") e10 = parseFloat(p["@valeur"]);
          });
        }
      } catch (e) {
        console.warn("Erreur parsing prix pour station", record.id);
      }

      // Si le flux v2 extrait directement les prix en colonnes
      if (record.sp98_prix) sp98 = parseFloat(record.sp98_prix);
      if (record.e10_prix) e10 = parseFloat(record.e10_prix);

      if (sp98 || e10) {
        this.stations.push({
          id: record.id,
          name: record.adresse
            ? record.adresse
            : record.ville || "Station Inconnue",
          distance: dist,
          brand: record.ville || "Local",
          prices: {
            SP98: sp98
              ? {
                  price: sp98,
                  updatedAt: record.maj || new Date().toISOString(),
                  updatedBy: "Data Gouv",
                }
              : null,
            E10: e10
              ? {
                  price: e10,
                  updatedAt: record.maj || new Date().toISOString(),
                  updatedBy: "Data Gouv",
                }
              : null,
          },
        });
      }
    });

    this.stations.sort((a, b) => a.distance - b.distance);

    let bestStation = null;
    let warningStation = null;
    let bestPrice = 999;

    this.stations.forEach((station) => {
      if (station.prices["SP98"]) {
        if (station.prices["SP98"].price < bestPrice) {
          bestPrice = station.prices["SP98"].price;
          bestStation = station;
        }
      } else if (station.prices["E10"] && !warningStation) {
        // PremiÃ¨re station qui n'a que du E10
        warningStation = station;
      }
    });

    // PrÃ©paration du message vocal
    let voiceMessage = "";
    if (bestStation) {
      voiceMessage += `La station Ã  ${bestStation.distance.toFixed(1)} kilomÃ¨tres est la moins chÃ¨re avec le Sans Plomb 98 Ã  ${bestStation.prices["SP98"].price.toFixed(2)} euros. `;
    }

    if (warningStation) {
      voiceMessage += `Je dÃ©conseille la station Ã  ${warningStation.distance.toFixed(1)} kilomÃ¨tres qui ne propose que du E 10, ce qui est trÃ¨s nocif pour les moteurs de 50 cc. `;
    }

    if (typeof speak === "function" && voiceMessage !== "") speak(voiceMessage);

    this.renderHUD(this.stations.slice(0, 3)); // Afficher le top 3
  },

  renderHUD: function (nearbyStations) {
    let hud = document.getElementById("community-gas-hud");
    if (!hud) return;

    const listContainer = document.getElementById("gas-stations-list");
    listContainer.innerHTML = "";

    nearbyStations.forEach((station) => {
      const hasSP98 = !!station.prices["SP98"];
      const price = hasSP98
        ? station.prices["SP98"].price.toFixed(3)
        : station.prices["E10"]
          ? station.prices["E10"].price.toFixed(3)
          : "--";
      const fuelName = hasSP98 ? "SP98" : "E10";
      const statusClass = hasSP98 ? "gas-safe" : "gas-danger";
      const statusIcon = hasSP98 ? "fa-check-circle" : "fa-skull-crossbones";
      const statusText = hasSP98 ? "RecommandÃ© 50cc" : "DANGER E10";

      const card = document.createElement("div");
      card.className = `gas-station-card ${statusClass}`;
      card.innerHTML = `
                <div class="gas-header">
                    <h4><i class="fa-solid fa-gas-pump"></i> ${station.name}</h4>
                    <span class="gas-distance">${station.distance.toFixed(1)} km</span>
                </div>
                <div class="gas-body">
                    <div class="gas-price-block">
                        <span class="gas-type">${fuelName}</span>
                        <span class="gas-price">${price} â‚¬</span>
                    </div>
                    <div class="gas-status">
                        <i class="fa-solid ${statusIcon}"></i> ${statusText}
                    </div>
                </div>
                <div class="gas-footer">
                    <button class="btn-update-price" onclick="window.CommunityGas.openUpdateModal('${station.id}')">
                        <i class="fa-solid fa-pen"></i> Mettre Ã  jour (+5 Pts)
                    </button>
                </div>
            `;
      listContainer.appendChild(card);
    });

    hud.classList.remove("hidden");
  },

  openUpdateModal: function (stationId) {
    const station = this.stations.find((s) => s.id === stationId);
    if (!station) return;

    const hasSP98 = !!station.prices["SP98"];
    const fuelName = hasSP98 ? "SP98" : "E10";
    const currentPrice = hasSP98
      ? station.prices["SP98"].price
      : station.prices["E10"]
        ? station.prices["E10"].price
        : "1.800";

    const newPrice = prompt(
      `Prix officiel Gouv.fr : ${currentPrice}â‚¬.\nEntrez le nouveau prix constatÃ© sur place pour le ${fuelName} :`,
      currentPrice,
    );

    if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
      this.updateStationPrice(stationId, parseFloat(newPrice), fuelName);
    }
  },

  updateStationPrice: function (stationId, price, fuelType) {
    const station = this.stations.find((s) => s.id === stationId);
    if (station) {
      if (!station.prices[fuelType]) station.prices[fuelType] = {};
      station.prices[fuelType].price = price;
      station.prices[fuelType].updatedBy = "CommunautÃ©";

      alert(
        `Merci ! Le prix a Ã©tÃ© mis Ã  jour Ã  ${price}â‚¬ et synchronisÃ© avec la communautÃ©.\nVous gagnez +5 Points BVC.`,
      );
      if (typeof window.testAddPoints === "function") window.testAddPoints(5);

      this.renderHUD(this.stations.slice(0, 3));
    }
  },
};
