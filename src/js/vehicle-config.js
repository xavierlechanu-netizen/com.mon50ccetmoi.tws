import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

﻿window.setCrewMode = function (mode) {
  window.session = window.session || {};

  // Interdiction formelle du passager sur trottinette électrique (Art. R412-43-1)
  if (window.session.motor === "trottinette" && mode === "duo") {
    alert("Interdiction légale (Art. R412-43-1 du Code de la Route) : Le transport d'un passager sur une trottinette électrique est interdit sous peine d'une amende de 135 €.");
    mode = "solo";
  }

  window.session.crewMode = mode;

  const btnSolo = document.getElementById("btn-solo");
  const btnDuo = document.getElementById("btn-duo");
  if (btnSolo) btnSolo.style.borderColor = mode === "solo" ? "#00d2ff" : "#444";
  if (btnDuo) btnDuo.style.borderColor = mode === "duo" ? "#00d2ff" : "#444";
};

window.saveVehicleProfile = function () {
  const motor = document.getElementById("scooter-motor");
  window.session = window.session || {};
  window.session.motor = motor ? motor.value : "2t";
  if (!window.session.crewMode || window.session.motor === "trottinette") {
    window.session.crewMode = "solo";
  }

  secureSetItem("session", window.session);

  const screen = document.getElementById("vehicle-config-screen");
  if (screen) screen.classList.add("hidden");
  if (window.ScreenManager) window.ScreenManager.close();

  if (typeof speak === "function") {
    if (window.session.motor === "trottinette") {
      speak("Profil Trottinette Électrique configuré. Vitesse légale 25 km/h. Pistes cyclables prioritaires.");
    } else if (window.session.motor === "velo") {
      speak("Profil Vélo et VAE configuré. Pistes cyclables prioritaires. Bonne route !");
    } else if (window.session.motor === "vsp") {
      speak("Profil Voiture Sans Permis configuré. Voies rapides interdites.");
    } else {
      speak("Profil véhicule sauvegardé. Prêt pour le départ.");
    }
  }
};

// Durées ajustées par véhicule (Duo +15 %, VSP +25 %, trottinette/vélo +35 %) : retirées le 14/11/2026,
// elles se greffaient sur startPremiumNavigation, définie nulle part, et ne s’exécutaient jamais.

registerAction('saveVehicleProfile', () => window.saveVehicleProfile());
registerAction('setCrewMode', (mode) => window.setCrewMode(mode));


