import { registerAction } from './actionRegistry.js';

// --- I18N DICTIONARY & SYSTEM ---
const I18N = {
  fr: {
    welcome: "Bienvenue sur mon50ccetmoi",
    loading: "Démarrage des systèmes de bord...",
    riding_mode: "Mode Route",
    garage: "Mon Garage",
    community: "Communauté",
    safety: "Sécurité",
    settings: "Options",
    report_danger: "Signaler un Danger",
    police: "Police / Contrôle",
    accident: "Accident",
    hazard: "Danger / Travaux",
    speed: "VITESSE",
    distance: "DISTANCE",
    altitude: "ALTITUDE",
    weather: "MÉTÉO",
    fall_detected: "CHUTE DÉTECTÉE !",
    emergency_alert: "Une alerte va être envoyée à vos contacts.",
    cancel: "Annuler",
    save: "Enregistrer",
    logout: "Déconnexion",
    language: "Langue",
    status_riding: "Sur la route",
    status_paused: "En pause",
    members_online: "Pilotes en ligne",
    auth_required: "Connexion requise",
    gas: "Essence",
    emergency: "Urgences",
    bank: "DAB",
    maintenance: "Maintenance",
    insurance: "Assurance",
    share: "Partager",
    legal: "Mentions Légales",
    garage_title: "Mon Garage & Carnet",
    pro_space_title: "Espace Garage Pro",
    maint_history_title: "Carnet d'entretien numérique",
    expert_meca_title: "Assistant Méca V3",
    challenges_title: "Défis de la Quinzaine",
    donate_title: "Soutenir le Projet",
    security_title: "Sécurité & Guardian",
    stop: "STOP",
    reroute: "RE-CALCUL",
    arbitre: "L'Arbitre de la Route",
    arbitre_title: "L'Arbitre de la Route ⚖️",
    voturette: "Voiturette / VSP",
    scooter: "Scooter 50cc",
  },
  en: {
    welcome: "Welcome to mon50ccetmoi",
    loading: "Starting onboard systems...",
    riding_mode: "Riding Mode",
    garage: "My Garage",
    community: "Community",
    safety: "Safety",
    settings: "Settings",
    report_danger: "Report a Hazard",
    police: "Police / Checkpoint",
    accident: "Accident",
    hazard: "Hazard / Works",
    speed: "SPEED",
    distance: "DISTANCE",
    altitude: "ALTITUDE",
    weather: "WEATHER",
    fall_detected: "FALL DETECTED!",
    emergency_alert: "An alert will be sent to your contacts.",
    cancel: "Cancel",
    save: "Save",
    logout: "Logout",
    language: "Language",
    status_riding: "Riding",
    status_paused: "Paused",
    members_online: "Riders online",
    auth_required: "Login required",
    gas: "Gas",
    emergency: "Emergency",
    bank: "ATM",
    maintenance: "Maintenance",
    insurance: "Insurance",
    share: "Share",
    legal: "Legal",
    garage_title: "My Garage & Logbook",
    pro_space_title: "Pro Garage Space",
    maint_history_title: "Digital Maintenance Log",
    expert_meca_title: "Meca Assistant V3",
    challenges_title: "Fortnightly Challenges",
    donate_title: "Support the Project",
    security_title: "Security & Guardian",
    stop: "STOP",
    reroute: "RE-ROUTE",
    arbitre: "Road Referee",
    arbitre_title: "Road Referee ⚖️",
    voturette: "Microcar / VSP",
    scooter: "50cc Scooter",
  },
  es: {
    welcome: "Bienvenido a mon50ccetmoi",
    loading: "Iniciando sistemas...",
    riding_mode: "Modo Ruta",
    garage: "Mi Garaje",
    community: "Comunidad",
    safety: "Seguridad",
    settings: "Ajustes",
    report_danger: "Reportar Peligro",
    police: "Policía / Control",
    accident: "Accidente",
    hazard: "Peligro / Obras",
    speed: "VELOCIDAD",
    distance: "DISTANCIA",
    altitude: "ALTITUD",
    weather: "CLIMA",
    fall_detected: "¡CAÍDA DETECTADA!",
    emergency_alert: "Se enviará una alerta a sus contactos.",
    cancel: "Cancelar",
    save: "Guardar",
    logout: "Cerrar sesión",
    language: "Idioma",
    status_riding: "En ruta",
    status_paused: "En pausa",
    members_online: "Pilotos en línea",
    auth_required: "Conexión requerida",
    gas: "Gasolina",
    emergency: "Emergencias",
    bank: "Cajero",
    maintenance: "Mantenimiento",
    insurance: "Seguro",
    share: "Compartir",
    legal: "Legal",
    stop: "STOP",
    reroute: "RECALCULAR",
    arbitre: "Árbitro Vial",
  },
};

function detectUserLanguage() {
  const saved = localStorage.getItem("app_lang");
  if (saved && I18N[saved]) return saved;

  const browserLang = (navigator.language || "fr").split("-")[0];
  const supported = Object.keys(I18N);

  const finalLang = supported.includes(browserLang) ? browserLang : "fr";
  localStorage.setItem("app_lang", finalLang);
  return finalLang;
}

window.currentLang = detectUserLanguage();

window.t = function (key) {
  const lang = window.currentLang || "fr";
  const dict = I18N[lang] || I18N["fr"];
  return dict[key] || I18N["fr"][key] || key;
};

window.setLanguage = function (lang) {
  if (!I18N[lang]) return;
  window.currentLang = lang;
  localStorage.setItem("app_lang", lang);
  if (typeof window.updateI18N === "function") window.updateI18N();
  if (
    window.OracleVoice &&
    typeof window.OracleVoice.updateLanguage === "function"
  ) {
    window.OracleVoice.updateLanguage();
  }
};

window.updateI18N = function () {
  const t = window.t || ((k) => k);
  const setHtml = (el, str) => {
    if (window.DOMSecurity && window.DOMSecurity.safeHTML) {
      window.DOMSecurity.safeHTML(el, str);
    } else {
      // eslint-disable-next-line no-restricted-syntax
      el.innerHTML = str;
    }
  };
  const mGarage = document.getElementById("menu-garage");
  if (mGarage)
    setHtml(mGarage, `<i class="fa-solid fa-warehouse"></i> ${t("garage")}`);
  const mRoadbooks = document.getElementById("menu-roadbooks");
  if (mRoadbooks)
    setHtml(mRoadbooks, `<i class="fa-solid fa-map-location-dot"></i> Roadbooks`);
  const mSafety = document.getElementById("menu-rodage");
  if (mSafety)
    setHtml(mSafety, `<i class="fa-solid fa-gauge-high"></i> ${t("safety")}`);
  const mInsurance = document.getElementById("menu-insurance");
  if (mInsurance)
    setHtml(mInsurance, `<i class="fa-solid fa-shield-halved"></i> ${t("insurance")}`);
  const mMechanic = document.getElementById("menu-mechanic");
  if (mMechanic)
    setHtml(mMechanic, `<i class="fa-solid fa-robot"></i> ${t("maintenance")}`);
  const mArbitre = document.getElementById("menu-arbitre");
  if (mArbitre)
    setHtml(mArbitre, `<i class="fa-solid fa-scale-balanced"></i> ${t("arbitre")}`);
  const lStop = document.getElementById("label-stop-nav");
  if (lStop) lStop.textContent = t("stop");
  const lReroute = document.getElementById("label-reroute");
  if (lReroute) lReroute.textContent = t("reroute");
};

window.updateUILabels = function () {
  if (typeof window.updateI18N === "function") {
    window.updateI18N();
  }
  const displayUser = document.getElementById("display-username");
  if (displayUser && window.session && window.session.username) {
    displayUser.textContent = window.session.username;
  }
};

registerAction('detectUserLanguage', detectUserLanguage);
registerAction('t', window.t);
registerAction('setLanguage', window.setLanguage);
registerAction('updateI18N', window.updateI18N);
registerAction('updateUILabels', window.updateUILabels);
