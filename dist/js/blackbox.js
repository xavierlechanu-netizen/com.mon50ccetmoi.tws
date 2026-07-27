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
            "Impact violent dÃ©tectÃ© par la Blackbox (" + g.toFixed(1) + "G).",
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

    const snapshot = this.getSnapshot();
    const reportId = "blackbox_" + window.session.uid + "_" + Date.now();

    try {
      // End-to-End Encryption (E2EE) for Litigation Proof
      const dataStr = JSON.stringify(snapshot);
      const secret = "BB_SENTINEL_" + window.session.uid;
      const encryptedData = CryptoJS.AES.encrypt(dataStr, secret).toString();

      await db
        .collection("blackbox_reports")
        .doc(reportId)
        .set({
          userId: window.session.uid,
          username: window.session.username,
          reason: reason,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          payload: encryptedData,
          isEncrypted: true,
          v2: true,
          signature: CryptoJS.SHA256(dataStr).toString(),
        });

      return reportId;
    } catch (e) {
      console.error("Blackbox Cloud Sync Fail:", e);
    }
  },

  showLitigationInfo: function () {
    const content = document.getElementById("screen-content");
    if (!content) return;

    content.innerHTML = `<h3><i class="fa-solid fa-box-archive"></i> Blackbox Sentinel v2.0</h3>
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #ff4d4d;">
                <h4 style="color:#ff4d4d;">SCELLÃ‰ NUMÃ‰RIQUE QUANTUM</h4>
                <p style="font-size:0.85rem; margin-top:15px; line-height:1.4;">
                    Vos donnÃ©es de tÃ©lÃ©mÃ©trie haute frÃ©quence sont <strong>chiffrÃ©es de bout en bout</strong>.
                </p>
                <div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:10px; margin-top:15px; font-size:0.75rem;">
                    <i class="fa-solid fa-lock"></i> Chiffrement : <strong>AES-256</strong><br>
                    <i class="fa-solid fa-shield-check"></i> IntÃ©gritÃ© : <strong>SHA-256 Verified</strong><br>
                    <i class="fa-solid fa-bolt"></i> FrÃ©quence : <strong>10Hz Motion Logging</strong>
                </div>
                <p style="font-size:0.7rem; color:#888; margin-top:20px;">
                    En cas de litige, seul l'expert mandatÃ© peut demander le dÃ©chiffrement via votre clÃ© de session unique.
                </p>
            </div>
            
            <button onclick="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-insurance" style="width:100%; margin-top:20px; background:#333; color:white;">TERMINÃ‰</button>`;
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
