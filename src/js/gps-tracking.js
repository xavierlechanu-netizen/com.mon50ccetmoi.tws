/**
 * gps-tracking.js — Suivi GPS du pilote : accord de localisation, démarrage du GPS,
 * relances, mode basse précision et bannière « GPS indisponible ».
 *
 * Sorti de app-core.js (étape 5 du plan de dette technique, 7/11/2026). Les positions reçues
 * sont transmises à app-core.js (updatePosition), branché par configureGps().
 */
import { speak } from './voice-engine.js';

const handlers = {
  onPosition: () => {},
  onWakeLock: () => {},
};

/** Branche le traitement des positions et le maintien de l'écran allumé */
export function configureGps({ onPosition, onWakeLock } = {}) {
  if (typeof onPosition === "function") handlers.onPosition = onPosition;
  if (typeof onWakeLock === "function") handlers.onWakeLock = onWakeLock;
}

// Avant (corrigé le 7/11/2026) : le cookie Axeptio passait en premier et, faute de case
// « google_maps » (la carte n'utilise plus Google), valait refus. Toute personne ayant
// répondu à la bannière était renvoyée à l'accueil, même après « J'accepte ».
export function hasLocationConsent() {
  return localStorage.getItem("location_consent_accepted") === "true";
}

export async function checkLegalConsent() {
  if (hasLocationConsent()) {
    // Déclenchement du message de bienvenue pour les utilisateurs récurrents
    const name =
      window.session ? window.session.username : "";
    const welcomeMsg = name
      ? `Content de vous revoir, ${name}. Systèmes opérationnels.`
      : "Systèmes opérationnels. Bonne route sur mon 50cc et moi.";
    setTimeout(() => {
      if (typeof speak === "function") speak(welcomeMsg);
    }, 1000);

    startGeolocation();
    return;
  }

  // ══════════════════════════════════════════════════════════════════
  // DIVULGATION BIEN VISIBLE (Prominent Disclosure) — Google Play
  // Conforme à la politique relative aux données de l'utilisateur.
  // Affiché AVANT toute collecte de données de localisation.
  // ══════════════════════════════════════════════════════════════════
  if (document.getElementById("location-disclosure-modal")) return; // écran déjà affiché
  const modal = document.createElement("div");
  modal.id = "location-disclosure-modal";
  modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:#0a0a0a; z-index:20000;
        display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
        color:white; padding:24px; text-align:left; overflow-y:auto;
        -webkit-overflow-scrolling:touch;
    `;
  // eslint-disable-next-line no-restricted-syntax
modal.innerHTML = `
        <div style="max-width:480px; width:100%; margin:auto;">
            <div style="text-align:center; margin-bottom:20px;">
                <i class="fa-solid fa-location-dot" style="font-size:3rem; color:#ffb703;"></i>
            </div>
            <h2 style="text-align:center; margin-bottom:20px; font-size:1.3rem; color:#ffffff;">
                Utilisation de vos données de localisation
            </h2>

            <div style="background:#1a1a1a; padding:16px; border-radius:8px; border-left:4px solid #ffb703; margin-bottom:20px;">
                <p style="font-size:1rem; line-height:1.5; color:#ffffff; margin:0;">
                    <strong>L'application mon 50cc et moi utilise votre position lorsqu'elle est ouverte</strong> pour la détection automatique de chute (Guardian Angel), la navigation GPS étape par étape et le signalement de dangers routiers. Votre position n'est pas collectée lorsque l'application est fermée. Elle n'est jamais utilisée pour de la publicité.
                </p>
            </div>

            <p style="font-size:0.9rem; line-height:1.4; color:#aaa; margin-bottom:24px; text-align:center;">
                Ces données sont utilisées uniquement pour assurer votre sécurité et vous guider. Elles ne sont jamais vendues à des tiers.<br><br>
                <a href="privacy.html" target="_blank" rel="noopener" style="color:#ffb703; text-decoration:underline; font-weight:bold;">
                    Consulter notre Politique de Confidentialité
                </a>
            </p>

            <button id="btn-accept-location" style="
                width:100%; padding:16px; background:#ffb703; color:#000;
                border:none; border-radius:30px; font-weight:bold; font-size:1rem;
                margin-bottom:12px; cursor:pointer;
            ">J'accepte</button>

            <button id="btn-refuse-location" style="
                width:100%; padding:14px; background:transparent;
                border:1px solid #444; border-radius:30px;
                color:#aaa; font-size:0.9rem; cursor:pointer;
            ">Refuser</button>
        </div>
    `;
  document.body.appendChild(modal);

  // Bouton REFUSER : empêche le démarrage du GPS, affiche un message
  document.getElementById("btn-refuse-location").onclick = () => {
    modal.remove();
    // Afficher un bandeau persistant expliquant que l'app ne peut pas fonctionner
    const banner = document.createElement("div");
    banner.id = "location-refused-banner";
    banner.style.cssText = `
            position:fixed; bottom:0; left:0; width:100%; padding:16px;
            background:#1a0000; border-top:2px solid #ff4444; color:#ff8888;
            text-align:center; font-size:0.85rem; z-index:19999; line-height:1.4;
        `;
    // eslint-disable-next-line no-restricted-syntax
banner.innerHTML = `
            <strong>⚠️ Localisation requise</strong><br>
            L'application ne peut pas fonctionner sans accès à votre position.
            <br><button data-action="checkLegalConsent()" style="margin-top:8px; padding:8px 24px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; cursor:pointer;">Réessayer</button>
        `;
    document.body.appendChild(banner);
    if (typeof speak === "function")
      speak(
        "L'application nécessite l'accès à votre position pour fonctionner.",
      );
  };

  // Bouton ACCEPTER : sauvegarde le consentement et démarre le GPS
  document.getElementById("btn-accept-location").onclick = () => {
    localStorage.setItem("location_consent_accepted", "true");
    modal.remove();
    // Retirer le bandeau de refus s'il existait
    const oldBanner = document.getElementById("location-refused-banner");
    if (oldBanner) oldBanner.remove();

    // Déclenchement du message de bienvenue (Audio débloqué par le clic)
    const name =
      window.session ? window.session.username : "";
    const welcomeMsg = name
      ? `Content de vous revoir, ${name}. Systèmes opérationnels.`
      : "Systèmes opérationnels. Bonne route sur mon 50cc et moi.";
    if (typeof speak === "function") speak(welcomeMsg);

    startGeolocation();
  };
}

export function showGpsBanner(msg, code) {
  // Ne pas afficher si on a déjà une position valide (évite la bannière rouge permanente)
  if (currentPosition && code !== 1) {
    console.warn(
      "mon50cc GPS : Erreur ignorée (position déjà disponible) :",
      msg,
    );
    return;
  }

  if (code === 1) {
    let hardLock = document.getElementById("gps-hard-lock");
    if (!hardLock) {
      hardLock = document.createElement("div");
      hardLock.id = "gps-hard-lock";
      hardLock.style =
        "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10, 10, 10, 0.98); backdrop-filter:blur(10px); color:white; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px; text-align:center;";
      document.body.appendChild(hardLock);
    }

    // eslint-disable-next-line no-restricted-syntax
hardLock.innerHTML = `
            <i class="fa-solid fa-location-crosshairs" style="font-size:4rem; color:#ef4444; margin-bottom:20px;"></i>
            <h2 style="margin-bottom:15px; color:#ffb703;">GPS OBLIGATOIRE</h2>
            <p style="font-size:0.9rem; line-height:1.5; margin-bottom:25px; text-align:left; background:rgba(0,0,0,0.5); padding:15px; border-radius:10px; border:1px solid #333;">
                Cette application collecte des données de localisation pour activer la détection automatique de chute, la navigation GPS, le calcul de votre vitesse, et, si vous l'activez, le partage de votre position arrondie avec la communauté, <b>uniquement lorsque l'application est ouverte.</b><br><br>
                Sans accès à votre position, l'application ne peut pas fonctionner.
            </p>
            <button data-action="window.repairGps()" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:30px; font-weight:bold; font-size:1.1rem; margin-bottom:15px; box-shadow:0 0 15px rgba(255, 183, 3, 0.5);">
                AUTORISER LE GPS
            </button>
            <p style="font-size:0.8rem; color:#888;">
                Veuillez accorder la permission dans les paramètres de votre appareil.
            </p>
        `;
    hardLock.style.display = "flex";
    return; // On affiche le hard lock, pas la bannière
  }

  let banner = document.getElementById("gps-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "gps-error-banner";
    banner.style =
      "position:fixed; top:120px; left:50%; transform:translateX(-50%); width:90%; background:rgba(180, 20, 20, 0.97); color:white; padding:15px; border-radius:12px; z-index:99999; font-size:0.85rem; text-align:center; border:2px solid #ef4444; box-shadow:0 0 25px rgba(220,38,38,0.9); transition: all 0.3s ease;";
    document.body.appendChild(banner);
  }

  const repairBtn = `<button data-action="window.retryGps()" style="margin-top:10px; padding:8px 20px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; font-size:0.85rem; cursor:pointer;">🔄 Réessayer</button>`;

  // eslint-disable-next-line no-restricted-syntax
banner.innerHTML = `<div style="font-weight:bold; margin-bottom:4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>GPS : ${msg}</div><div style="font-size:0.72rem; color:#fca5a5;">(Code erreur: ${code})</div>${repairBtn}`;
  banner.style.display = "block";

  // Auto-dismiss après 20s pour les erreurs non-critiques (code 2 = signal faible, code 3 = timeout)
  clearTimeout(window._gpsBannerTimer);
  window._gpsBannerTimer = setTimeout(hideGpsBanner, 20000);
}

export function hideGpsBanner() {
  const banner = document.getElementById("gps-error-banner");
  if (banner) banner.style.display = "none";
  const hardLock = document.getElementById("gps-hard-lock");
  if (hardLock) hardLock.style.display = "none";
  clearTimeout(window._gpsBannerTimer);
}

window.repairGps = function () {
  const appUrl = "mon50ccetmoi.com";
  const instructions = `
        <div style="text-align:left; font-size:0.9rem; line-height:1.5;">
            <b style="color:#ffb703;">📱 Sur Android Chrome :</b><br>
            1. Appuie sur les 3 points ⋮ en haut à droite<br>
            2. Paramètres → Paramètres du site<br>
            3. Localisation → Cherche '${appUrl}'<br>
            4. Passe de 'Bloquer' à 'Autoriser'<br>
            5. Recharge l'application<br><br>
            <b style="color:#ffb703;">📱 Dans l'app Android :</b><br>
            1. Appui long sur l'icône de l'app<br>
            2. Infos sur l'appli → Autorisations<br>
            3. Position → Autoriser (ou Toujours autoriser)
        </div>
    `;

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Comment réactiver le GPS",
      html: instructions,
      icon: "info",
      confirmButtonText: "J'AI COMPRIS",
      background: "#1a1a1a",
      color: "#fff",
      confirmButtonColor: "#ffb703",
    });
  } else {
    const modal = document.createElement("div");
    modal.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;";
    // eslint-disable-next-line no-restricted-syntax
modal.innerHTML = `
            <div style="background:#1a1a1a; padding:25px; border-radius:15px; border:2px solid #ffb703; max-width:400px; width:100%; color:white;">
                <h3 style="color:#ffb703; margin-top:0; margin-bottom:15px;">Comment réactiver le GPS</h3>
                ${instructions}
                <button data-action="this.parentElement.parentElement.remove()" style="width:100%; margin-top:20px; padding:12px; background:#ffb703; color:black; border:none; border-radius:30px; font-weight:bold; font-size:1rem;">J'AI COMPRIS</button>
            </div>
        `;
    document.body.appendChild(modal);
  }
};

window.retryGps = function () {
  hideGpsBanner();
  // Reset complet pour repartir de zéro
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (fallbackWatchId !== null) {
    navigator.geolocation.clearWatch(fallbackWatchId);
    fallbackWatchId = null;
  }
  gpsRetryCount = 0;
  startGeolocation();
  speak("Nouvelle tentative de localisation GPS.");
};

let gpsWatchId = null;
let fallbackWatchId = null;
let gpsRetryCount = 0;
const GPS_MAX_RETRIES = 3;

export async function startGeolocation() {
  // GARDE DE SÉCURITÉ : ne JAMAIS démarrer le GPS sans consentement explicite
  if (!hasLocationConsent()) {
    console.warn(
      "mon50cc GPS : Consentement de localisation non accordé. GPS bloqué.",
    );
    // On redemande l'accord (écran de divulgation) au lieu de renvoyer à l'accueil
    checkLegalConsent();
    return;
  }

  if (!("geolocation" in navigator)) {
    console.error(
      "mon50cc GPS : Géolocalisation non supportée sur cet appareil.",
    );
    showGpsBanner("Géolocalisation non supportée par ce navigateur.", 0);
    return;
  }

  // Acquérir le Wake Lock pour maintenir le GPS actif
  handlers.onWakeLock();

  // ÉTAPE 1 : Vérifier les permissions (non-bloquant)
  if (navigator.permissions) {
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" });

      if (perm.state === "denied") {
        speak(
          "Le GPS est bloqué. Vérifiez les permissions de l'application.",
        );
        showGpsBanner("Permission refusée. Appuyez sur 'Réparer'.", 1);
        return; // Inutile de continuer si explicitement refusé
      }

      perm.onchange = () => {
        if (perm.state === "granted") {
          hideGpsBanner();
          window.retryGps();
        } else if (perm.state === "denied") {
          showGpsBanner("Permission GPS révoquée.", 1);
        }
      };
    } catch (e) {
      console.warn("mon50cc GPS : API Permissions indisponible.", e);
    }
  }

  // ÉTAPE 2 : Surveillance CONTINUE (satellites GPS / réseau)
  // On utilise uniquement watchPosition car iOS gère très mal les appels concurrents (getCurrentPosition + watchPosition)
  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 30000, // 30s — laisse le temps aux satellites en intérieur
    maximumAge: 3000, // 3s de cache max pour les updates fréquents
  };

  const onError = (err) => {
    let msg = "Erreur GPS inconnue";
    if (err.code === 1)
      msg = "Permission GPS refusée. Appuyez sur 'Réparer'.";
    if (err.code === 2) msg = "Signal GPS faible. Sortez à l'extérieur.";
    if (err.code === 3) msg = "Recherche GPS en cours... Patience.";
    console.error("mon50cc GPS :", msg, "code:", err.code);

    // Permission refusée → bannière immédiate
    if (err.code === 1) {
      speak("Le GPS est bloqué. Vérifiez les permissions.");
      showGpsBanner(msg, err.code);
      return;
    }

    // Si on n'a aucune position → tenter le fallback basse précision
    if (!currentPosition) {
      showGpsBanner(msg, err.code);
      activateLowAccuracyFallback();
    }
    // Si on a déjà une position → on garde celle-ci, pas de bannière
  };

  // Nettoyer les anciens watchers avant d'en créer de nouveaux
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      // Filtrage qualité : accepter les positions même > 500m si c'est tout ce qu'on a,
      // pour éviter que l'utilisateur reste bloqué sur la carte.
      const acc = pos.coords.accuracy || 0;
      if (currentPosition && window.lastAccuracy && acc > 2000 && acc > window.lastAccuracy * 2) {
        console.warn(`mon50cc GPS : Position ignorée (précision très dégradée: ${acc.toFixed(0)}m)`);
        return;
      }
      window.lastAccuracy = acc;
      handlers.onPosition(pos);
      hideGpsBanner();
      gpsRetryCount = 0; // Reset du compteur de retry
    },
    onError,
    geoOptions,
  );

  // ÉTAPE 4 : Timer de sécurité — si aucune position après 15s, forcer le fallback
  setTimeout(() => {
    if (!currentPosition && fallbackWatchId === null) {
      console.warn(
        "mon50cc GPS : Aucune position après 15s → activation fallback.",
      );
      activateLowAccuracyFallback();
    }
  }, 15000);
}

// Fallback basse précision (WiFi/Cellulaire) — déclenché automatiquement
export function activateLowAccuracyFallback() {
  if (fallbackWatchId !== null) return; // Déjà actif
  if (gpsRetryCount >= GPS_MAX_RETRIES) {
    console.error("mon50cc GPS : Nombre max de retries atteint.");
    showGpsBanner(
      "GPS indisponible. Vérifiez que la localisation est activée dans les paramètres.",
      2,
    );
    return;
  }
  gpsRetryCount++;

  fallbackWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const acc = pos.coords.accuracy || 0;
      if (!currentPosition || acc <= 3000) {
        handlers.onPosition(pos);
        hideGpsBanner();
      }
    },
    (e) => console.warn("mon50cc GPS : Fallback échoué :", e.code, e.message),
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
  );
}

// Remplacement du démarrage automatique par la vérification légale
// Retrait de l'appel direct pour éviter les conflits avant l'init de l'UI
// checkLegalConsent();

/** Arrête le mode basse précision dès qu'un signal GPS correct (< 100 m) revient */
export function stopLowAccuracyFallback(accuracy) {
  if (accuracy !== null && accuracy < 100 && fallbackWatchId !== null) {
    navigator.geolocation.clearWatch(fallbackWatchId);
    fallbackWatchId = null;
  }
}
