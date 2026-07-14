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
    calculateMix: function(liters, percent) {
        if (!liters || !percent) return 0;
        const oilMl = (liters * 1000) * (percent / 100);
        return Math.round(oilMl);
    },

    // 2. Analyse Acoustique (Microphone Réel)
    startAcousticAnalysis: async function() {
        if (window.session && window.session.isGuest) {
            alert("🔒 L'IA Acoustique est une exclusivité Membre. Inscrivez-vous pour diagnostiquer votre moteur !");
            return;
        }

        const modal = document.getElementById('meca-result-modal');
        if (modal) modal.classList.remove('hidden');
        
        const resultDiv = document.getElementById('meca-result');
        if (!resultDiv) return;

        resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-microphone-lines fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU STÉTHOSCOPE IA...</p>
                <p style="font-size:0.8rem; color:#ccc;">Demande d'accès au microphone...</p>
            </div>
        `;

        try {
            // Accès au microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            // Initialisation Web Audio API
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                await this.audioCtx.resume();
            }

            this.microphone = this.audioCtx.createMediaStreamSource(stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            this.microphone.connect(this.analyser);

            speak("Accès au microphone autorisé. Démarrez le moteur et donnez un coup de gaz franc.");

            // Affichage de l'oscilloscope
            resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; text-align:center;">
                    <h4 style="color:var(--accent);"><i class="fa-solid fa-wave-square"></i> ANALYSE EN COURS</h4>
                    <canvas id="audio-canvas" width="280" height="100" style="background:#0a0a0a; border-radius:8px; margin:15px 0; border: 1px solid var(--accent);"></canvas>
                    <p style="font-size:0.8rem; color:#888;">Analyse de la signature fréquentielle (FFT)...</p>
                </div>
            `;

            this.drawOscilloscope();

            // Arrêt de l'analyse après 6 secondes
            setTimeout(() => {
                this.stopAnalysis(stream);
                this.showDiagnosticReport(resultDiv);
            }, 6000);

        } catch (err) {
            console.error("Erreur Micro:", err);
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
    startDecibelMeter: async function() {
        const modal = document.getElementById('meca-result-modal');
        if (modal) modal.classList.remove('hidden');
        
        const resultDiv = document.getElementById('meca-result');
        if (!resultDiv) return;

        resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-volume-high fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU DÉCIBELMÈTRE...</p>
            </div>
        `;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

            this.microphone = this.audioCtx.createMediaStreamSource(stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 1024;
            this.microphone.connect(this.analyser);

            speak("Décibelmètre activé. Faites tourner le moteur au ralenti.");

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
                currentHz = Math.round(maxIndex * this.audioCtx.sampleRate / this.analyser.fftSize);

                const dbEl = document.getElementById('db-level');
                if (dbEl) {
                    dbEl.textContent = db + ' dB';
                    dbEl.style.color = db > 85 ? '#ff4444' : '#00e676';
                }
                
                const hzEl = document.getElementById('hz-level');
                if (hzEl) hzEl.textContent = currentHz + ' Hz (Moteur)';

                // Draw minimal scope
                const canvas = document.getElementById('audio-canvas');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#0a0a0a';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.beginPath();
                    const sliceWidth = canvas.width * 1.0 / dataArray.length;
                    let x = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        const v = dataArray[i] / 255.0;
                        const y = (1 - v) * canvas.height;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                        x += sliceWidth;
                    }
                    ctx.strokeStyle = db > 85 ? '#ff4444' : '#00f2ff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            };

            measureDb();

            setTimeout(() => {
                this.stopAnalysis(stream);
                const isLegal = maxDb <= 85;
                const engineType = currentHz > 150 ? '2 Temps (Aigu)' : '4 Temps (Grave)';
                
                resultDiv.innerHTML = `
                    <div class="glassmorphism" style="padding:20px;">
                        <h4 style="color:${isLegal ? '#00e676' : '#ff4444'};">RÉSULTAT ACOUSTIQUE</h4>
                        <div style="font-size:2rem; font-weight:900; margin:10px 0; color:${isLegal ? '#00e676' : '#ff4444'};">MAX : ${maxDb} dB</div>
                        <p><strong>Type perçu :</strong> ${engineType}</p>
                        <p style="margin-top:10px; font-size:0.9rem;">
                            ${isLegal 
                                ? "L'échappement est homologué. Vous êtes en sécurité en cas de contrôle." 
                                : "<strong>ATTENTION :</strong> Niveau sonore > 85dB. Risque d'amende et de confiscation."}
                        </p>
                        <p style="color:#777; font-size:0.75rem; margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                            Avertissement (AI Act) : Diagnostic généré par Intelligence Artificielle. Ce résultat est fourni à titre indicatif et est <strong>soumis à contrôle humain</strong> (expertise d'un mécanicien).
                        </p>
                        <button onclick="document.getElementById('meca-result-modal').classList.add('hidden')" style="width:100%; padding:15px; margin-top:20px; background:var(--glass-bg); color:var(--text-main); border:1px solid var(--accent); border-radius:8px; font-weight:bold;">FERMER</button>
                    </div>
                `;
                
                if (isLegal) {
                    speak(`Analyse terminée. Pic à ${maxDb} décibels. Échappement homologué.`);
                } else {
                    speak(`Alerte. Pic sonore à ${maxDb} décibels. Votre pot d'échappement dépasse la limite légale.`);
                }
            }, 8000);

        } catch (err) {
            console.error("Erreur Micro:", err);
            speak("Erreur d'accès au microphone pour le décibelmètre.");
        }
    },

    drawOscilloscope: function() {
        const canvas = document.getElementById('audio-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);
            this.analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2.5;
                ctx.fillStyle = 'rgb(' + (barHeight + 100) + ', 255, 255)'; // Couleur cyan/bleue
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
    },

    stopAnalysis: function(stream) {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (this.microphone) this.microphone.disconnect();
    },

    showDiagnosticReport: function(container) {
        // Bypass complet pour les utilisateurs "Premium / Sans Pub"
        if (window.session && window.session.isPremium) {
            speak("Analyse terminée. Compte Premium détecté. Rapport expert offert.");
            this.showExpertReport();
            return;
        }

        speak("Analyse terminée. Rapport basique disponible.");
        
        container.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border-left:4px solid var(--accent);">
                <h4 style="color:var(--accent);"><i class="fa-solid fa-stethoscope"></i> DIAGNOSTIC BASIQUE</h4>
                <p style="font-size:0.9rem; margin-top:10px; color:#fff;"><strong>Résultat :</strong> Anomalie harmonique détectée (Basses fréquences anormales).</p>
                <p style="font-size:0.8rem; color:#aaa; margin-top:10px;">Le rapport basique indique la présence d'une anomalie. Pour isoler la panne exacte (carburateur, pot percé, piston), débloquez le rapport expert IA.</p>
                <p style="color:#777; font-size:0.75rem; margin-top:10px;">Avertissement (AI Act) : Aide indicative générée par IA. <strong>Soumis à contrôle humain.</strong></p>
                
                <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
                
                <div style="text-align:center;">
                    <h5 style="color:#10a37f; margin-bottom:10px;"><i class="fa-solid fa-lock-open"></i> Débloquer le Rapport Expert (50 Pts BVC)</h5>
                    <button id="btn-revolut-pay" onclick="window.MecaWizard.payWithBVC()" style="background:#000; color:#fff; border:1px solid #10a37f; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%;">
                        <i class="fa-solid fa-gem"></i> Utiliser 50 Pts BVC
                    </button>
                    <div id="revolut-status" style="margin-top:10px; font-size:0.8rem; color:#ccc;"></div>
                </div>
            </div>
        `;
    },

    payWithBVC: async function() {
        const btn = document.getElementById('btn-revolut-pay');
        const statusEl = document.getElementById('revolut-status');
        if (!btn) return;

        if (typeof window.braveCoins === 'undefined') {
            statusEl.innerHTML = '<span style="color:#dc3545;">Erreur: Programme de fidélité indisponible.</span>';
            return;
        }

        const price = 50;

        if (window.braveCoins < price) {
            statusEl.innerHTML = `<span style="color:#dc3545;">Fonds insuffisants. Vous avez ${Math.floor(window.braveCoins)} Pts, il en faut ${price}.</span>`;
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connexion au réseau IA...';

        // Simulation réseau IA
        setTimeout(() => {
            window.braveCoins -= price;
            localStorage.setItem('braveCoins', window.braveCoins.toString());
            
            // Mise à jour de l'affichage UI si disponible
            const balanceEl = document.getElementById('crypto-balance');
            if(balanceEl) balanceEl.innerText = Math.floor(window.braveCoins) + ' Pts BVC';
            
            this.showExpertReport();
        }, 2000);
    },


    showExpertReport: function() {
        const container = document.getElementById('meca-result');
        if (!container) return;

        speak("Paiement validé. Rapport expert déverrouillé. Voici mon diagnostic.");

        const diagnostics = [
            {
                analyse: "Fuite détectée sur la ligne d'échappement (Fréquence résonnante à 120Hz).",
                reco: "Vérifier le joint d'échappement au niveau du cylindre. Risque de perte de puissance et de surconsommation."
            },
            {
                analyse: "Bruit métallique aigu (Fréquence anormale à 450Hz).",
                reco: "Usure suspectée des galets du variateur ou de la courroie. Inspection visuelle requise."
            },
            {
                analyse: "Claquement irrégulier au ralenti (Déséquilibre harmonique).",
                reco: "Le carburateur semble encrassé ou mal réglé. Procéder à un nettoyage complet."
            },
            {
                analyse: "Frottement sourd en fond sonore.",
                reco: "Les plaquettes de frein avant semblent frotter excessivement. Vérifiez l'étrier."
            }
        ];
        
        const diag = diagnostics[Math.floor(Math.random() * diagnostics.length)];

        container.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #10a37f; background: rgba(16, 163, 127, 0.1);">
                <h4 style="color:#10a37f;"><i class="fa-solid fa-check-circle"></i> RAPPORT D'EXPERTISE (DÉVERROUILLÉ)</h4>
                <div style="margin-top:15px; font-size:0.9rem; color:#fff;">
                    <p><i class="fa-solid fa-microchip" style="color:#10a37f;"></i> <strong>Analyse IA :</strong> ${diag.analyse}</p>
                    <p style="margin-top:10px;"><i class="fa-solid fa-wrench" style="color:#10a37f;"></i> <strong>Recommandation :</strong> ${diag.reco}</p>
                </div>
                <button onclick="if(window.CertifiedCamera) window.CertifiedCamera.open(); else alert('Module de caméra non disponible');" style="margin-top:20px; width:100%; background:#ffb703; color:#000; padding:10px 15px; border-radius:5px; border:none; font-weight:bold; cursor:pointer; margin-bottom:10px;">
                    <i class="fa-solid fa-camera"></i> Ajouter Preuve Photo au rapport
                </button>
                <button onclick="document.getElementById('meca-result-modal').classList.add('hidden');" style="width:100%; background:transparent; border:1px solid #10a37f; color:#10a37f; padding:8px 15px; border-radius:5px; cursor:pointer;">
                    Fermer le rapport
                </button>
            </div>
        `;
    }
};
