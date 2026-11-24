import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { sovereignProfile } from './sovereign.js';

﻿// --- PRIVACY & RGPD MANAGER ---
window.PrivacyManager = {
  consentGiven: false,
  ghostModeActive: false,

  init: function () {
    // 1. Check for Consent
    const savedConsent = localStorage.getItem("rgpd_gps_consent");
    if (!savedConsent) {
      this.showConsentBanner();
    } else {
      this.consentGiven = savedConsent === "true";
      if (this.consentGiven) {
        // Apply ghost mode if it was previously saved
        this.ghostModeActive = localStorage.getItem("ghost_mode") === "true";
        this.updateGhostUI();
      } else {
        this.ghostModeActive = true; // Force ghost if consent denied
        this.updateGhostUI();
      }
    }
  },

  showConsentBanner: function () {
    let banner = document.getElementById("rgpd-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "rgpd-banner";
      banner.style.cssText =
        "position:fixed; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.95); border-top:2px solid #00ffcc; z-index:999999; padding:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:white; backdrop-filter:blur(10px); box-shadow:0 -5px 20px rgba(0,255,204,0.3);";
      document.body.appendChild(banner);
    }

    // eslint-disable-next-line no-restricted-syntax
banner.innerHTML = `
            <div style="max-width:600px; font-family:'Outfit', sans-serif;">
                <h3 style="color:#00ffcc; margin-top:0;"><i class="fa-solid fa-shield-halved"></i> Vos données, Vos règles (RGPD)</h3>
                <p style="font-size:0.9rem; margin-bottom:15px; line-height:1.4;">
                    Pour vous afficher sur la carte sociale et vous permettre d'interagir avec la communauté (Cortège, S.O.S, Crews), "mon 50cc et moi" a besoin de collecter et partager vos données de localisation GPS en arrière-plan.<br>
                    <strong>Acceptez-vous le partage de votre position ?</strong> Vous pourrez passer en "Mode Fantôme" à tout moment.
                </p>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button data-action="window.PrivacyManager.setConsent(true)" style="background:#00ffcc; color:black; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-check"></i> J'accepte</button>
                    <button data-action="window.PrivacyManager.setConsent(false)" style="background:transparent; color:#aaa; border:1px solid #aaa; padding:10px 20px; border-radius:20px; cursor:pointer;"><i class="fa-solid fa-xmark"></i> Je refuse (GPS Local)</button>
                </div>
                <div style="margin-top:15px; font-size:0.8rem;">
                    <a href="#" data-action="window.PrivacyManager.showPrivacyPolicy(); return false;" style="color:#00ffcc; text-decoration:underline;">Lire la Politique de Confidentialité</a>
                </div>
            </div>
        `;
  },

  setConsent: function (agreed) {
    this.consentGiven = agreed;
    localStorage.setItem("rgpd_gps_consent", agreed ? "true" : "false");

    const banner = document.getElementById("rgpd-banner");
    if (banner) banner.remove();

    if (!agreed) {
      alert(
        "Vous avez refusé. L'application fonctionnera en mode restreint. Vous n'apparaîtrez pas sur la carte des autres pilotes.",
      );
      this.toggleGhostMode(true); // Force invisible
    } else {
      this.toggleGhostMode(false);
      if (typeof speak === "function")
        speak(
          "Paramètres de confidentialité enregistrés. Bienvenue dans la communauté.",
        );
    }
  },

  toggleGhostMode: function (forceState = null) {
    if (!this.consentGiven && forceState === false) {
      alert(
        "Vous devez d'abord accepter le partage GPS pour désactiver le mode fantôme.",
      );
      this.showConsentBanner();
      return;
    }

    this.ghostModeActive =
      forceState !== null ? forceState : !this.ghostModeActive;
    localStorage.setItem("ghost_mode", this.ghostModeActive ? "true" : "false");

    this.updateGhostUI();

    sovereignProfile({ ghostMode: this.ghostModeActive });

    // Notify Firebase
    if (
      window.session &&
      window.session.uid &&
      typeof firebase !== "undefined"
    ) {
      firebase
        .firestore()
        .collection("users")
        .doc(window.session.uid)
        .update({
          ghostMode: this.ghostModeActive,
          updatedAt: Date.now(),
        })
        .catch((e) => console.error("Ghost mode update error", e));
    }

    if (forceState === null && typeof speak === "function") {
      speak(
        this.ghostModeActive
          ? "Mode fantôme activé. Vous êtes invisible."
          : "Mode fantôme désactivé. Vous êtes visible.",
      );
    }
  },

  updateGhostUI: function () {
    const btn = document.getElementById("ghost-mode-btn");
    if (btn) {
      if (this.ghostModeActive) {
        btn.style.color = "#ff0055";
        btn.style.borderColor = "#ff0055";
        // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = `<i class="fa-solid fa-ghost"></i> Fantôme`;
      } else {
        btn.style.color = "#00ffcc";
        btn.style.borderColor = "#00ffcc";
        // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = `<i class="fa-solid fa-eye"></i> Visible`;
      }
    }
  },

  showSettingsModal: function () {
    let modal = document.getElementById("privacy-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "privacy-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    // eslint-disable-next-line no-restricted-syntax
modal.innerHTML = `
            <div style="background:#111; border:1px solid #555; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center; color:white;">
                <h2 style="color:white; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-gear"></i> Paramètres & RGPD</h2>
                
                <div style="margin-bottom:20px; text-align:left; background:#222; padding:15px; border-radius:10px;">
                    <p><b>Statut GPS Communauté :</b> ${this.consentGiven ? '<span style="color:#00ffcc">Accepté</span>' : '<span style="color:#ff0055">Refusé</span>'}</p>
                    <button data-action="window.PrivacyManager.showConsentBanner(); document.getElementById('privacy-modal').style.display='none';" style="margin-top:10px; width:100%; background:transparent; border:1px solid #00ffcc; color:#00ffcc; padding:8px; border-radius:5px; cursor:pointer;">Modifier le consentement</button>
                </div>
                
                <div style="margin-bottom:20px; border-top:1px solid #333; padding-top:20px;">
                    <h3 style="color:#ff0055; margin-top:0;">Zone de Danger (Droit à l'oubli)</h3>
                    <p style="font-size:0.8rem; color:#aaa; margin-bottom:15px;">Conformément aux lois internationales de protection des données (RGPD/Europe, CCPA/USA, APPI/PDPA/Asie, POPIA/Convention de Malabo/Afrique), vous pouvez demander la suppression immédiate et définitive de votre compte et de toutes les données associées.</p>
                    <button data-action="window.PrivacyManager.deleteMyData()" style="width:100%; background:#ff0055; color:white; border:none; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-trash-can"></i> Supprimer mon compte</button>
                </div>
                
                <button data-action="document.getElementById('privacy-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Fermer</button>
            </div>
        `;
    modal.style.display = "flex";
  },

  showPrivacyPolicy: function () {
    alert(
      "Politique Globale de Confidentialité (RGPD, CCPA, APPI, POPIA) :\n\n- Données collectées : Position GPS, Email (si authentifié).\n- Finalité : Affichage sur la carte sociale communautaire, alerte SOS, calcul itinéraires.\n- Partage tiers : AUCUN. Vos données ne sont pas revendues.\n- Durée de conservation : Les données GPS temps-réel sont éphémères. Les traces Roadbooks et SOS sont conservées jusqu'à leur suppression.\n- Vos droits mondiaux : Accès, Rectification, Effacement (bouton dans les paramètres), Mode Fantôme.",
    );
  },

  // Avant le 17/11/2026, ce bouton n'effaçait que la fiche users/{uid} en annonçant « toutes vos
  // données supprimées » (faux : compte de connexion, signalements, radar… restaient). Il passe
  // désormais par le parcours complet d'effacement (rgpd-cnil.js), avec la demande par e-mail en secours.
  deleteMyData: async function () {
    if (typeof window.revokeAndEraseData === "function") {
      return window.revokeAndEraseData();
    }
    if (confirm("Envoyer votre demande d'effacement par e-mail à contact@mon50ccetmoi.com ?")) {
      window.location.href =
        "mailto:contact@mon50ccetmoi.com?subject=" +
        encodeURIComponent("Demande d'effacement de mon compte (RGPD art. 17)");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  // Run privacy checks as soon as possible
  setTimeout(() => {
    window.PrivacyManager.init();
  }, 1500);
});
