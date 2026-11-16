import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { critAirDetails, critAirBadge, NON_CONCERNE } from './crit-air.js';

window.setCrewMode = function (mode) {
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
  // Type de véhicule changé : la vignette mémorisée pour les ZFE est recalculée
  const critAirDate = document.getElementById("critair-date");
  if (critAirDate && (critAirDate.value || window.session.critAir)) computeCritAir();

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

// --- Vignette Crit'Air (section de vehicle-config-screen.html) ---
// Calcul local (src/js/crit-air.js) : rien n'est envoyé. La commande se fait uniquement sur le
// site officiel certificat-air.gouv.fr, par le pilote : l'appli ne vend rien et ne paie rien.

const byId = (id) => document.getElementById(id);

/** Affiche le résultat (textContent seulement : aucune donnée saisie n'est lue comme du HTML) */
function renderCritAir(details) {
  const box = byId("critair-result");
  if (!box) return;
  const badge = critAirBadge(details.classe);
  const pastille = byId("critair-badge");
  pastille.textContent = badge.short;
  pastille.style.background = badge.bg;
  pastille.style.color = badge.fg;
  byId("critair-label").textContent = badge.label;
  byId("critair-reason").textContent = details.raison;
  byId("critair-check").classList.toggle("hidden", !details.aVerifier);
  // Rappel « Pensez à coller votre vignette » : seulement si une vignette existe pour ce véhicule
  byId("critair-reminder").classList.toggle("hidden", !Number.isInteger(details.classe));
  box.classList.remove("hidden");
}

function computeCritAir() {
  const motor = byId("scooter-motor");
  const input = {
    vehicleType: motor ? motor.value : (window.session && window.session.motor) || "2t",
    firstRegistrationDate: byId("critair-date") ? byId("critair-date").value : "",
    energy: byId("critair-energy") ? byId("critair-energy").value : "thermique",
    euroNorm: byId("critair-euro") ? byId("critair-euro").value : "",
  };
  const details = critAirDetails(input);
  renderCritAir(details);

  // Mémorisé pour l'alerte à l'entrée des ZFE (zfe-zones.js)
  window.session = window.session || {};
  const known = Number.isInteger(details.classe) || details.classe === "non classé";
  window.session.critAir = known
    ? { classe: details.classe, date: input.firstRegistrationDate, energie: input.energy, euro: input.euroNorm }
    : details.classe === NON_CONCERNE ? { classe: NON_CONCERNE } : null;
  secureSetItem("session", window.session);
  return details;
}

/** Remet les valeurs enregistrées dans le formulaire à l'ouverture de « Mon Véhicule » */
function restoreCritAir() {
  const saved = window.session && window.session.critAir;
  if (!saved || !byId("critair-date")) return;
  if (saved.date) byId("critair-date").value = saved.date;
  if (saved.energie) byId("critair-energy").value = saved.energie;
  if (saved.euro !== undefined) byId("critair-euro").value = saved.euro;
  if (saved.date || saved.energie === "electrique") computeCritAir();
}

window.computeCritAir = computeCritAir;
window.restoreCritAir = restoreCritAir;
registerAction('computeCritAir', computeCritAir);

registerAction('saveVehicleProfile', () => window.saveVehicleProfile());
registerAction('setCrewMode', (mode) => window.setCrewMode(mode));


