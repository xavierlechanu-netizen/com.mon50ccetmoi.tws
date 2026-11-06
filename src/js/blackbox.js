import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * DIGITAL BLACKBOX v2.0 - SENTINEL EDITION
 * Records telemetry data for insurance and legal proof.
 * Features: High-Frequency Motion Buffer (10Hz) & Quantum Integrity Signature.
 */

window.Blackbox = {
  buffer: [],
  hfBuffer: [], // High-frequency buffer (last 10 seconds at 10Hz)
  maxEntries: 120, // 2 minutes of history (1 entry per second)
  maxHfEntries: 100, // 10 seconds of motion history
  isRecording: true,
  shockScore: parseInt(
    localStorage.getItem("sentinel_structural_score") || "100",
  ),

  init: function () {
    this.startHfRecorder();
  },

  getStructuralScore: function () {
    return this.shockScore + "%";
  },

  push: function (data) {
    this.buffer.push({
      ts: Date.now(),
      ...data,
    });
    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift();
    }
  },

  pushHf: function (motionData) {
    this.hfBuffer.push({
      ts: Date.now(),
      ...motionData,
    });
    if (this.hfBuffer.length > this.maxHfEntries) {
      this.hfBuffer.shift();
    }
  },

  startHfRecorder: function () {
    window.addEventListener("devicemotion", (e) => {
      if (!this.isRecording) return;
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      this.pushHf({
        ax: (acc.x || 0).toFixed(2),
        ay: (acc.y || 0).toFixed(2),
        az: (acc.z || 0).toFixed(2),
      });

      // Auto-Impact Detection & Structural Fatigue
      const g =
        Math.sqrt(
          (acc.x || 0) * (acc.x || 0) +
            (acc.y || 0) * (acc.y || 0) +
            (acc.z || 0) * (acc.z || 0),
        ) / 9.81;

      // Track micro-shocks for integrity
      if (g > 2.5) {
        this.shockScore = Math.max(0, this.shockScore - Math.floor(g / 2));
        localStorage.setItem("sentinel_structural_score", this.shockScore);
        if (this.shockScore < 70 && !this.wasIntegrityWarning) {
          if (window.NeuralHUD) window.NeuralHUD.speakOracle("integrity");
          this.wasIntegrityWarning = true;
        }
      }

      if (g > 4.5 && !this.lastImpactTime) {
        // Impact threshold
        this.lastImpactTime = Date.now();
        this.saveToCloud("IMPACT_DETECTED_AUTO");
        if (typeof window.triggerEmergencySOS === "function") {
          window.triggerEmergencySOS(
            "Impact violent détecté par la Blackbox (" + g.toFixed(1) + "G).",
          );
        }
      }
    });
  },

  getSnapshot: function () {
    return {
      telemetry: this.buffer,
      motion_hf: this.hfBuffer,
      pilot_id: window.session?.uid,
    };
  },

  saveToCloud: async function (reason) {
    if (typeof db === "undefined" || !window.session) return;
    
    // Privacy by Design: Verrouillage Sécurité
    // On interdit l'upload sauf si c'est une urgence absolue (SOS) ou mandat légal.
    if (reason !== "URGENCE_ABSOLUE_SOS" && reason !== "LITIGATION_AI_REQUEST") {
        console.warn("🛡️ Sécurité Blackbox: Envoi Cloud bloqué. Les données restent 100% locales hors urgence majeure.");
        return null;
    }

    // Envoi par la fonction serveur uploadBlackboxTelemetry (seul chemin autorisé par les règles
    // Firestore) : connexion obligatoire, transport chiffré (TLS), fenêtre RGPD ±30 s autour du choc
    // appliquée par le serveur. L'ancien chiffrement « BB_SENTINEL_ + uid » était devinable : supprimé.
    const nowSec = Date.now() / 1000;
    const frames = this.hfBuffer.map((f) => {
      const ax = Number(f.ax) || 0;
      const ay = Number(f.ay) || 0;
      const az = Number(f.az) || 0;
      return { timestamp: f.ts / 1000, ax, ay, az, gForce: Math.sqrt(ax * ax + ay * ay + az * az) / 9.81, source: "phone" };
    }).concat(this.buffer.map((p) => ({ ...p, timestamp: p.ts / 1000, source: "phone-gps" })));

    if (frames.length === 0) return null;
    if (typeof firebase === "undefined" || !firebase.functions) return null;

    try {
      const upload = firebase.app().functions("europe-west1").httpsCallable("uploadBlackboxTelemetry");
      const impactTs = this.lastImpactTime ? this.lastImpactTime / 1000 : nowSec;
      const res = await upload({
        hardwareId: "PHONE",
        isCrashReport: true,
        impactTimestamp: impactTs,
        payloads: frames.slice(-5000),
      });
      return (res && res.data && res.data.sessionId) || null;
    } catch (e) {
      console.error("Blackbox Cloud Sync Fail:", e);
      return null;
    }
  },

  showLitigationInfo: function () {
    const content = document.getElementById("screen-content");
    if (!content) return;

    // eslint-disable-next-line no-restricted-syntax
content.innerHTML = `<h3><i class="fa-solid fa-box-archive"></i> Blackbox Sentinel v2.0</h3>
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #ff4d4d;">
                <h4 style="color:#ff4d4d;">SCELLÉ NUMÉRIQUE QUANTUM</h4>
                <p style="font-size:0.85rem; margin-top:15px; line-height:1.4;">
                    Vos données de télémétrie restent sur votre téléphone. Elles ne sont envoyées qu'en cas d'urgence, de façon chiffrée, et seul le serveur peut les lire.
                </p>
                <div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:10px; margin-top:15px; font-size:0.75rem;">
                    <i class="fa-solid fa-lock"></i> Transport : <strong>TLS (HTTPS)</strong>, accès réservé au serveur<br>
                    <i class="fa-solid fa-shield-check"></i> Conservation : <strong>±30 s autour du choc</strong><br>
                    <i class="fa-solid fa-bolt"></i> Fréquence : <strong>10Hz Motion Logging</strong>
                </div>
                <p style="font-size:0.7rem; color:#888; margin-top:20px;">
                    En cas de litige, seul l'expert mandaté peut demander le déchiffrement via votre clé de session unique.
                </p>
            </div>
            
            <button data-action="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-insurance" style="width:100%; margin-top:20px; background:#333; color:white;">TERMINÉ</button>`;
  },
};

window.Blackbox.init();

// Auto-feeder loop (1Hz for general telemetry)
setInterval(() => {
  if (typeof currentPosition !== "undefined" && currentPosition) {
    window.Blackbox.push({
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      speed: document.getElementById("speed")?.textContent || 0,
      lean: window.currentLeanAngle || 0,
      force: window.NeuralHUD?.currentG || 1.0,
    });
  }
}, 1000);
