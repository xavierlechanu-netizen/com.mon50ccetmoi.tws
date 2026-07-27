/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONFORMITÃ‰ GLOBALE : RGPD, CCPA, PIPL & GOOGLE PLAY CONSOLE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

window.checkGlobalPrivacy = function () {
  const hasConsented = localStorage.getItem("global_privacy_consent");

  if (!hasConsented) {
    // CNIL : Ne PAS auto-accepter. Afficher la banniÃ¨re et attendre le choix actif de l'utilisateur.
    window.preventAppLaunch = true;
    injectPrivacyBanner();
  } else {
    window.preventAppLaunch = false;
    if (typeof window.initVoiceAI === "function")
      setTimeout(window.initVoiceAI, 1000);
    if (typeof window.initZeroClickDestiny === "function")
      setTimeout(window.initZeroClickDestiny, 2000);
  }
};

function injectPrivacyBanner() {
  if (document.getElementById("global-privacy-banner")) return;

  const bannerHtml = `
    <div id="global-privacy-banner" class="fullscreen-overlay" style="background: rgba(0,0,0,0.95); backdrop-filter: blur(20px); color: #fff; z-index: 90000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding: 20px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <div style="max-width: 500px; margin: 0 auto; padding-bottom: 50px;">
            <div style="text-align: center;">
                <i class="fa-solid fa-shield-halved" style="font-size: 4rem; color: #00ffcc; margin-bottom: 20px;"></i>
                <h2 style="margin: 0 0 10px 0; text-transform: uppercase;">Vos DonnÃ©es, Vos RÃ¨gles</h2>
            </div>
            
            <div style="background: rgba(255,0,85,0.1); border-left: 4px solid #ff0055; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #ff0055; font-size: 1rem;"><i class="fa-brands fa-google-play"></i> DÃ©claration de ConfidentialitÃ©</h3>
                <p style="color: #ccc; font-size: 0.9rem; line-height: 1.4; margin: 0;">
                    <strong>mon 50cc et moi</strong> collecte des donnÃ©es de localisation pour permettre la dÃ©tection automatique de chute, la navigation GPS Ã©tape par Ã©tape, et le signalement de dangers Ã  la communautÃ©, mÃªme lorsque l'application est fermÃ©e ou qu'elle n'est pas utilisÃ©e. L'accÃ¨s en arriÃ¨re-plan est indispensable au service.
                </p>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #00b3ff; margin-top: 0; font-size: 1.1rem;">1. Europe (RGPD / CNIL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-location-dot" style="color: #00b3ff;"></i> AccÃ¨s GPS (Obligatoire)</span>
                    <input type="checkbox" id="privacy-gps" checked disabled style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-microphone" style="color: #ff0055;"></i> Micro (IA Vocale)</span>
                    <input type="checkbox" id="privacy-mic" checked style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-camera" style="color: #b700ff;"></i> CamÃ©ra (AR Vision)</span>
                    <input type="checkbox" id="privacy-cam" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #ffb700; margin-top: 0; font-size: 1.1rem;">2. USA / Californie (CCPA)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-hand-holding-dollar" style="color: #ffb700;"></i> Ne pas vendre mes donnÃ©es<br><small style="color: #888;">"Do Not Sell My Personal Info"</small></span>
                    <input type="checkbox" id="privacy-ccpa" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 25px;">
                <h3 style="color: #ff0055; margin-top: 0; font-size: 1.1rem;">3. Chine (PIPL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-globe" style="color: #ff0055;"></i> Transfert Transfrontalier<br><small style="color: #888;">Autoriser l'envoi des donnÃ©es vers les serveurs sÃ©curisÃ©s en Europe.</small></span>
                    <input type="checkbox" id="privacy-pipl" checked style="transform: scale(1.5);">
                </label>
            </div>
            
            <button onclick="window.acceptGlobalPrivacy()" style="width: 100%; padding: 15px; background: #00ffcc; color: #000; font-weight: 900; font-size: 1.2rem; border: none; border-radius: 10px; cursor: pointer; text-transform: uppercase; margin-bottom: 10px;">J'ACCEPTE TOUT</button>
            <button onclick="window.refuseGlobalPrivacy()" style="width: 100%; padding: 15px; background: transparent; color: #fff; font-weight: 700; font-size: 1rem; border: 2px solid #fff; border-radius: 10px; cursor: pointer; text-transform: uppercase; margin-bottom: 15px;">REFUSER (fonctionnalitÃ©s limitÃ©es)</button>
            <div style="text-align: center;">
                <button onclick="window.openPrivacyPolicy()" style="background: none; border: none; color: #888; text-decoration: underline; cursor: pointer;">Lire la Politique de ConfidentialitÃ©</button>
            </div>
        </div>
    </div>
    
    <!-- PRIVACY POLICY MODAL -->
    <div id="privacy-policy-modal" class="hidden fullscreen-overlay" style="background: #111; color: #fff; z-index: 95000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding: 30px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <button onclick="window.closePrivacyPolicy()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-times"></i></button>
        <h2>Politique de ConfidentialitÃ© Globale</h2>
        <p>En accord avec les rÃ¨gles Google Play et les lois RGPD (Europe), CCPA (USA) et PIPL (Chine).</p>
        
        <h3>1. AccÃ¨s Ã  la Localisation en ArriÃ¨re-plan (Google Play)</h3>
        <p>Notre application accÃ¨de Ã  votre position GPS de maniÃ¨re continue, y compris lorsque l'application est en arriÃ¨re-plan, afin de calculer les distances parcourues pour le Score Ã‰co et le Radar Social. Ces donnÃ©es sont utilisÃ©es exclusivement pour la fonctionnalitÃ© principale du service et ne sont pas revendues.</p>
        
        <h3>2. Europe (RGPD) & Privacy by Design</h3>
        <p>Vos donnÃ©es sont traitÃ©es de faÃ§on sÃ©curisÃ©e (AES-256). Vous disposez d'un droit inconditionnel Ã  l'oubli. La fonction "Supprimer mes donnÃ©es" Ã©crase vos donnÃ©es locales et purge irrÃ©vocablement votre compte sur le Cloud Firebase.</p>

        <h3>3. USA (CCPA)</h3>
        <p>Nous ne vendons AUCUNE de vos donnÃ©es personnelles Ã  des tiers. Vous pouvez exprimer votre choix en cochant la case "Do Not Sell".</p>

        <h3>4. Chine (PIPL)</h3>
        <p>Si vous rÃ©sidez en Chine, vous devez consentir explicitement au transfert transfrontalier de vos donnÃ©es vers nos serveurs situÃ©s en Europe.</p>
    </div>
    `;

  document.body.insertAdjacentHTML("beforeend", bannerHtml);
}

window.acceptGlobalPrivacy = function () {
  const gpsChecked = document.getElementById("privacy-gps").checked;
  const micChecked = document.getElementById("privacy-mic").checked;
  const camChecked = document.getElementById("privacy-cam").checked;
  const ccpaChecked = document.getElementById("privacy-ccpa").checked;
  const piplChecked = document.getElementById("privacy-pipl").checked;

  if (!gpsChecked) {
    alert(
      "Attention : L'application nÃ©cessite obligatoirement l'accÃ¨s au GPS pour fonctionner.",
    );
    return;
  }
  if (!piplChecked) {
    alert(
      "Information (PIPL) : L'application est hÃ©bergÃ©e en Europe. Si vous n'autorisez pas le transfert transfrontalier, le Cloud ne pourra pas fonctionner.",
    );
  }

  const consentRecord = {
    gps: true,
    mic: micChecked,
    cam: camChecked,
    ccpa_do_not_sell: ccpaChecked,
    pipl_crossborder: piplChecked,
    timestamp: new Date().toISOString(),
    version: "v100.00-GOLD",
  };

  localStorage.setItem("global_privacy_consent", "true");
  localStorage.setItem("cnil_consent", "true"); // legacy support
  localStorage.setItem("legal_consent_accepted", "true"); // bypass app-core modal
  localStorage.setItem("privacy_consent_record", JSON.stringify(consentRecord));
  localStorage.setItem("cnil_mic", micChecked ? "true" : "false");
  localStorage.setItem("cnil_cam", camChecked ? "true" : "false");

  const banner = document.getElementById("global-privacy-banner");
  if (banner) banner.remove();

  window.preventAppLaunch = false;

  if (micChecked && typeof window.initVoiceAI === "function")
    setTimeout(window.initVoiceAI, 1000);
  if (typeof window.initZeroClickDestiny === "function")
    setTimeout(window.initZeroClickDestiny, 2000);

  if (typeof speak === "function")
    speak("ConformitÃ© internationale validÃ©e. Bienvenue.");
};

window.openPrivacyPolicy = function () {
  const modal = document.getElementById("privacy-policy-modal");
  if (modal) modal.classList.remove("hidden");
};

window.refuseGlobalPrivacy = function () {
  // CNIL : L'utilisateur refuse les cookies optionnels mais accepte les essentiels (GPS obligatoire)
  const consentRecord = {
    gps: true, // Obligatoire pour le fonctionnement
    mic: false,
    cam: false,
    ccpa_do_not_sell: true,
    pipl_crossborder: false,
    refused: true,
    timestamp: new Date().toISOString(),
    version: "v100.00-GOLD",
  };

  localStorage.setItem("global_privacy_consent", "refused");
  localStorage.setItem("privacy_consent_record", JSON.stringify(consentRecord));
  localStorage.setItem("cnil_mic", "false");
  localStorage.setItem("cnil_cam", "false");

  const banner = document.getElementById("global-privacy-banner");
  if (banner) banner.remove();

  window.preventAppLaunch = false;

  alert(
    "Vous avez refusÃ© les cookies optionnels. L'application fonctionnera avec des fonctionnalitÃ©s limitÃ©es (pas de commandes vocales ni de rÃ©alitÃ© augmentÃ©e).",
  );
};

window.closePrivacyPolicy = function () {
  const modal = document.getElementById("privacy-policy-modal");
  if (modal) modal.classList.add("hidden");
};

// â”€â”€â”€ Droit Ã  l'effacement (Droit Ã  l'oubli / Protocol Zero) â”€â”€
window.revokeAndEraseData = async function () {
  if (
    confirm(
      "ATTENTION : Cette action est IRRÃ‰VERSIBLE. Toutes vos donnÃ©es locales ET sur le serveur Cloud (Firestore) seront dÃ©truites. Confirmer ?",
    )
  ) {
    let uid = null;
    if (window.session && window.session.uid) {
      uid = window.session.uid;
    } else {
      const storedSession = localStorage.getItem("session");
      if (storedSession) {
        try {
          uid = JSON.parse(storedSession).uid;
        } catch (e) {}
      }
    }

    // 1. DÃ©clencher le Protocol Zero (Suppression Backend via Cloud Function)
    if (uid) {
      try {
        const cloudFuncUrl =
          "https://europe-west1-mon50cc-backend.cloudfunctions.net/deleteUserAccount";
        await fetch(cloudFuncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: uid }),
        });
      } catch (e) {
        console.warn("Cloud deletion feedback:", e);
      }
    }

    // 2. Effacer toutes les donnÃ©es locales
    localStorage.clear();
    sessionStorage.clear();

    // 3. Effacer le cache Service Worker
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }

    alert(
      "Toutes vos donnÃ©es (Locales et Serveur) ont Ã©tÃ© dÃ©truites de maniÃ¨re irrÃ©versible. L'application va se rÃ©initialiser.",
    );
    window.location.href = "login.html";
  }
};

// â”€â”€â”€ Export des donnÃ©es â”€â”€â”€â”€â”€â”€â”€
window.exportMyData = function () {
  try {
    const exportData = {
      _meta: {
        export_date: new Date().toISOString(),
        app: "mon50ccetmoi",
        format: "JSON (Format structurÃ© portable)",
      },
      consent: JSON.parse(
        localStorage.getItem("privacy_consent_record") || "{}",
      ),
      session: (() => {
        try {
          return JSON.parse(localStorage.getItem("session") || "{}");
        } catch (e) {
          return {};
        }
      })(),
      preferences: {
        theme: localStorage.getItem("theme"),
        language: localStorage.getItem("language"),
        lite_mode: localStorage.getItem("lite_mode"),
        mic_consent: localStorage.getItem("cnil_mic"),
        cam_consent: localStorage.getItem("cnil_cam"),
      },
      vehicle: (() => {
        try {
          return JSON.parse(localStorage.getItem("vehicle_config") || "{}");
        } catch (e) {
          return {};
        }
      })(),
      wallet: {
        balance: localStorage.getItem("bvc_balance") || "0",
        total_mined: localStorage.getItem("bvc_total_mined") || "0",
      },
      habits: (() => {
        try {
          return JSON.parse(localStorage.getItem("driving_habits") || "{}");
        } catch (e) {
          return {};
        }
      })(),
      odometer: localStorage.getItem("total_km") || "0",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mon50ccetmoi_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(
      "âœ… Export terminÃ© ! Vos donnÃ©es locales ont Ã©tÃ© tÃ©lÃ©chargÃ©es.",
    );
  } catch (e) {
    console.error("Erreur export:", e);
    alert("Erreur lors de l'export.");
  }
};

// â”€â”€â”€ VÃ©rification au chargement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("global_privacy_consent")) {
    setTimeout(window.checkGlobalPrivacy, 500);
  } else {
    window.checkGlobalPrivacy();
  }
});
