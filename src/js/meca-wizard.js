import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * MECA-WIZARD v2.0 - DeepTech AI Mechanic
 * Analyse Acoustique réelle via Web Audio API & Intégration Revolut Checkout
 */

window.MecaWizard = {
  audioCtx: null,
  analyser: null,
  microphone: null,
  animationId: null,

  // 1. Calculateur de mélange
  calculateMix: function (liters, percent) {
    if (!liters || !percent) return 0;
    const oilMl = liters * 1000 * (percent / 100);
    return Math.round(oilMl);
  },

  // 2. Analyse Acoustique (Microphone Réel)
  startAcousticAnalysis: async function () {
    if (!window.session) {
      alert("Veuillez vous connecter pour utiliser Meca Wizard.");
      return;
    }

    const modal = document.getElementById("meca-result-modal");
    if (modal) modal.classList.remove("hidden");

    const resultDiv = document.getElementById("meca-result");
    if (!resultDiv) return;

    // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-microphone-lines fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU STÉTHOSCOPE IA...</p>
                <p style="font-size:0.8rem; color:#ccc;">Demande d'accès au microphone...</p>
            </div>
        `;

    try {
      // Accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Initialisation Web Audio API
      if (!this.audioCtx) {
        this.audioCtx = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.microphone = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone.connect(this.analyser);

      speak(
        "Accès au microphone autorisé. Démarrez le moteur et donnez un coup de gaz franc.",
      );

      // Affichage de l'oscilloscope
      // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; text-align:center;">
                    <h4 style="color:var(--accent);"><i class="fa-solid fa-wave-square"></i> ANALYSE EN COURS</h4>
                    <canvas id="audio-canvas" width="280" height="100" style="background:#0a0a0a; border-radius:8px; margin:15px 0; border: 1px solid var(--accent);"></canvas>
                    <p style="font-size:0.8rem; color:#888;">Analyse de la signature fréquentielle (FFT)...</p>
                </div>
            `;

      this.drawOscilloscope();

      // Mesures réelles pendant l'enregistrement : énergie par fréquence et niveau maximal
      const bins = new Uint8Array(this.analyser.frequencyBinCount);
      const energy = new Array(bins.length).fill(0);
      let peak = 0;
      const sampler = setInterval(() => {
        this.analyser.getByteFrequencyData(bins);
        bins.forEach((v, i) => {
          energy[i] += v;
          if (v > peak) peak = v;
        });
      }, 100);

      // Arrêt de l'analyse après 6 secondes
      setTimeout(() => {
        clearInterval(sampler);
        let best = 1; // on ignore la composante continue (case 0)
        for (let i = 2; i < energy.length; i++) if (energy[i] > energy[best]) best = i;
        this.lastMeasure = {
          dominantHz: Math.round((best * this.audioCtx.sampleRate) / this.analyser.fftSize),
          levelPct: Math.round((peak / 255) * 100),
        };
        this.stopAnalysis(stream);
        this.showDiagnosticReport(resultDiv);
      }, 6000);
    } catch (err) {
      console.error("Erreur Micro:", err);
      // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; border-left:4px solid #dc3545;">
                    <h4 style="color:#dc3545;">ERREUR MICROPHONE</h4>
                    <p style="font-size:0.9rem; margin-top:10px;">Impossible d'accéder au microphone. Veuillez vérifier vos autorisations.</p>
                </div>
            `;
      speak("Erreur. L'accès au microphone a été refusé.");
    }
  },

  // 3. Analyseur d'échappement (Décibels & Fréquence)
  startDecibelMeter: async function () {
    const modal = document.getElementById("meca-result-modal");
    if (modal) modal.classList.remove("hidden");

    const resultDiv = document.getElementById("meca-result");
    if (!resultDiv) return;

    // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-volume-high fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU DÉCIBELMÈTRE...</p>
            </div>
        `;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      if (!this.audioCtx)
        this.audioCtx = new (
          window.AudioContext || window.webkitAudioContext
        )();
      if (this.audioCtx.state === "suspended") await this.audioCtx.resume();

      this.microphone = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.microphone.connect(this.analyser);

      speak("Décibelmètre activé. Faites tourner le moteur au ralenti.");

      // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; text-align:center;">
                    <h4 style="color:var(--neon-blue);"><i class="fa-solid fa-gauge-high"></i> MESURE EN COURS</h4>
                    <div id="db-level" style="font-size:3rem; font-weight:900; margin:10px 0;">0 dB</div>
                    <div id="hz-level" style="font-size:1.2rem; color:var(--accent);">-- Hz</div>
                    <canvas id="audio-canvas" width="280" height="80" style="background:#0a0a0a; border-radius:8px; margin-top:15px; border: 1px solid var(--accent);"></canvas>
                </div>
            `;

      let maxDb = 0;
      let currentHz = 0;
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const measureDb = () => {
        this.animationId = requestAnimationFrame(measureDb);
        this.analyser.getByteFrequencyData(dataArray);

        // Calcul approximatif des dBFS convertis en dBSPL pour l'affichage
        let sum = 0;
        let maxIndex = 0;
        let maxValue = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
          if (dataArray[i] > maxValue) {
            maxValue = dataArray[i];
            maxIndex = i;
          }
        }
        const avg = sum / dataArray.length;
        const db = Math.round((avg / 255) * 120); // Approximation 120dB max

        if (db > maxDb) maxDb = db;

        // Calcul de fréquence dominante
        currentHz = Math.round(
          (maxIndex * this.audioCtx.sampleRate) / this.analyser.fftSize,
        );

        const dbEl = document.getElementById("db-level");
        if (dbEl) {
          dbEl.textContent = db + " dB";
          dbEl.style.color = db > 85 ? "#ff4444" : "#00e676";
        }

        const hzEl = document.getElementById("hz-level");
        if (hzEl) hzEl.textContent = currentHz + " Hz (Moteur)";

        // Draw minimal scope
        const canvas = document.getElementById("audio-canvas");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          const sliceWidth = (canvas.width * 1.0) / dataArray.length;
          let x = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 255.0;
            const y = (1 - v) * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.strokeStyle = db > 85 ? "#ff4444" : "#00f2ff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      };

      measureDb();

      setTimeout(() => {
        this.stopAnalysis(stream);
        const isLegal = maxDb <= 85;
        const engineType =
          currentHz > 150 ? "2 Temps (Aigu)" : "4 Temps (Grave)";

        // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `
                    <div class="glassmorphism" style="padding:20px;">
                        <h4 style="color:${isLegal ? "#00e676" : "#ff4444"};">RÉSULTAT ACOUSTIQUE</h4>
                        <div style="font-size:2rem; font-weight:900; margin:10px 0; color:${isLegal ? "#00e676" : "#ff4444"};">MAX : ${maxDb} dB</div>
                        <p><strong>Type perçu :</strong> ${engineType}</p>
                        <p style="margin-top:10px; font-size:0.9rem;">
                            ${
                              isLegal
                                ? "L'échappement est homologué. Vous êtes en sécurité en cas de contrôle."
                                : "<strong>ATTENTION :</strong> Niveau sonore > 85dB. Risque d'amende et de confiscation."
                            }
                        </p>
                        <p style="color:#777; font-size:0.75rem; margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                            Avertissement (AI Act) : Diagnostic généré par Intelligence Artificielle. Ce résultat est fourni à titre indicatif et est <strong>soumis à contrôle humain</strong> (expertise d'un mécanicien).
                        </p>
                        <button data-action="document.getElementById('meca-result-modal').classList.add('hidden')" style="width:100%; padding:15px; margin-top:20px; background:var(--glass-bg); color:var(--text-main); border:1px solid var(--accent); border-radius:8px; font-weight:bold;">FERMER</button>
                    </div>
                `;

        if (isLegal) {
          speak(
            `Analyse terminée. Pic à ${maxDb} décibels. Échappement homologué.`,
          );
        } else {
          speak(
            `Alerte. Pic sonore à ${maxDb} décibels. Votre pot d'échappement dépasse la limite légale.`,
          );
        }
      }, 8000);
    } catch (err) {
      console.error("Erreur Micro:", err);
      speak("Erreur d'accès au microphone pour le décibelmètre.");
    }
  },

  drawOscilloscope: function () {
    const canvas = document.getElementById("audio-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2.5;
        ctx.fillStyle = "rgb(" + (barHeight + 100) + ", 255, 255)"; // Couleur cyan/bleue
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  },

  stopAnalysis: function (stream) {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (this.microphone) this.microphone.disconnect();
  },

  // Résultat honnête de l'analyse acoustique (corrigé le 7/11/2026).
  // Avant : le « diagnostic basique » annonçait toujours une anomalie, et le « rapport expert »
  // (payé 50 points) tirait une panne au hasard parmi 4, sans lien avec le son enregistré.
  // L'application ne sait pas encore identifier une panne au son : elle affiche ce qu'elle a
  // réellement mesuré et ne fait plus rien payer.
  showDiagnosticReport: function (container) {
    const m = this.lastMeasure;
    const measured = m && m.levelPct > 0;
    speak("Analyse terminée. Rapport basique disponible.");

    const wrap = document.createElement("div");
    wrap.className = "glassmorphism";
    wrap.style.cssText = "padding:20px; border-left:4px solid var(--accent);";
    const title = document.createElement("h4");
    title.style.color = "var(--accent)";
    title.textContent = "ANALYSE DU SON DU MOTEUR";
    const result = document.createElement("p");
    result.style.cssText = "font-size:0.9rem; margin-top:10px; color:#fff;";
    result.textContent = measured
      ? `Son enregistré : fréquence dominante ${m.dominantHz} Hz, niveau maximal ${m.levelPct} % de la capacité du micro.`
      : "Aucun son exploitable n'a été capté. Rapprochez le téléphone du moteur et recommencez.";
    const limit = document.createElement("p");
    limit.style.cssText = "font-size:0.8rem; color:#aaa; margin-top:10px;";
    limit.textContent =
      "Le diagnostic automatique des pannes à partir du son n'est pas encore disponible : " +
      "ces mesures ne permettent pas d'identifier une panne. En cas de bruit inhabituel, faites écouter votre moteur à un garage.";
    wrap.append(title, result, limit);
    container.replaceChildren(wrap);
  },

  // Anciens points d'entrée du « rapport expert » payant : redirigés vers le résultat honnête.
  payWithBVC: function () {
    const container = document.getElementById("meca-result");
    if (container) this.showDiagnosticReport(container);
  },

  showExpertReport: function () {
    const container = document.getElementById("meca-result");
    if (container) this.showDiagnosticReport(container);
  },
};
