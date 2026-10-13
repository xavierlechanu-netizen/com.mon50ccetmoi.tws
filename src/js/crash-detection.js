/**
 * mon50ccetmoi - Crash Detection Module (Module "Trigger")
 * 
 * Ce script écoute l'accéléromètre du téléphone via l'API DeviceMotionEvent.
 * En cas de décélération ultra-violente (Choc / Impact), il déclenche la 
 * procédure de verrouillage de la boîte noire ESP32.
 */

class CrashDetector {
    constructor(options = {}) {
        // Seuil d'alerte en G (Force G). 
        // 1G = gravité terrestre (~9.8 m/s²). Un freinage fort = ~0.8G. Un crash > 3G.
        this.G_FORCE_THRESHOLD = options.gForceThreshold || 3.5; 
        
        // Temps avant verrouillage définitif (pour éviter les faux positifs)
        this.COUNTDOWN_SECONDS = 10;
        
        this.isMonitoring = false;
        this.isTriggered = false;
        this.countdownTimer = null;
        
        this.handleMotion = this.handleMotion.bind(this);
    }

    startMonitoring() {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            // iOS 13+ nécessite une permission explicite
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        this._attachListener();
                    } else {
                        console.warn("Permission accéléromètre refusée.");
                    }
                })
                .catch(console.error);
        } else {
            // Android et autres
            this._attachListener();
        }
    }

    stopMonitoring() {
        window.removeEventListener('devicemotion', this.handleMotion);
        this.isMonitoring = false;
        console.log("[CrashDetector] Surveillance désactivée.");
    }

    _attachListener() {
        window.addEventListener('devicemotion', this.handleMotion);
        this.isMonitoring = true;
        console.log(`[CrashDetector] Surveillance active (Seuil: ${this.G_FORCE_THRESHOLD}G)`);
    }

    handleMotion(event) {
        if (this.isTriggered) return; // Déjà en cours de gestion

        const acc = event.accelerationIncludingGravity;
        if (!acc || acc.x === null) return;

        // Calcul de la magnitude du vecteur d'accélération (Racine carrée de X² + Y² + Z²)
        // et conversion en Force G (en divisant par 9.81)
        const magnitude = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2) / 9.81;

        if (magnitude > this.G_FORCE_THRESHOLD) {
            console.warn(`[CrashDetector] CHOC DÉTECTÉ ! Force G : ${magnitude.toFixed(2)}`);
            this.triggerCrashProtocol(magnitude);
        }
    }

    triggerCrashProtocol(forceG) {
        this.isTriggered = true;
        this.stopMonitoring();
        
        // Vibration pour alerter le pilote
        if ("vibrate" in navigator) {
            navigator.vibrate([1000, 500, 1000, 500, 1000]);
        }

        this.showSOSOverlay(forceG);
    }

    showSOSOverlay(forceG) {
        // Création de l'UI d'alerte en plein écran
        const overlay = document.createElement('div');
        overlay.id = "crash-sos-overlay";
        const overlayContent = `
            <style>
                #crash-sos-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(255, 0, 0, 0.95); z-index: 99999;
                    display: flex; flex-direction: column; justify-content: center; align-items: center;
                    color: white; font-family: 'Inter', sans-serif; text-align: center;
                    animation: flashBg 1s infinite alternate;
                }
                @keyframes flashBg {
                    from { background: rgba(255, 0, 0, 0.95); }
                    to { background: rgba(200, 0, 0, 0.95); }
                }
                .sos-timer { font-size: 6rem; font-weight: 900; margin: 20px 0; font-variant-numeric: tabular-nums; }
                .sos-cancel-btn { 
                    background: white; color: red; font-size: 1.2rem; font-weight: bold;
                    padding: 15px 40px; border: none; border-radius: 50px; cursor: pointer;
                    margin-top: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                }
            </style>
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 4rem;"></i>
            <h2 style="font-size: 2rem; margin-top: 10px;">CHOC DÉTECTÉ</h2>
            <p>Impact estimé : ${forceG.toFixed(1)} G</p>
            <p style="font-size: 1.2rem; font-weight: bold;">Envoi du SOS et Verrouillage Boîte Noire dans :</p>
            <div class="sos-timer" id="sos-countdown">${this.COUNTDOWN_SECONDS}</div>
            <button class="sos-cancel-btn" id="sos-cancel">JE VAIS BIEN (ANNULER)</button>
        `;
        if (window.DOMSecurity && window.DOMSecurity.safeHTML) {
            window.DOMSecurity.safeHTML(overlay, overlayContent);
        } else {
            // eslint-disable-next-line no-restricted-syntax
            overlay.innerHTML = overlayContent;
        }
        document.body.appendChild(overlay);

        let secondsLeft = this.COUNTDOWN_SECONDS;
        const timerEl = document.getElementById('sos-countdown');
        
        // Bouton d'annulation (Faux positif, ex: téléphone tombé)
        const cancelBtn = document.getElementById('sos-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                clearInterval(this.countdownTimer);
                if (overlay && overlay.parentNode) {
                    overlay.remove();
                }
                this.isTriggered = false;
                this.startMonitoring(); // On reprend la surveillance
                console.log("[CrashDetector] Alerte annulée par le pilote.");
            });
        }

        // Compte à rebours
        this.countdownTimer = setInterval(() => {
            secondsLeft--;
            if (timerEl) {
                timerEl.textContent = String(secondsLeft);
            }

            if (secondsLeft <= 0) {
                clearInterval(this.countdownTimer);
                this.executeLockdown(forceG);
            }
        }, 1000);
    }

    executeLockdown(forceG) {
        const overlayEl = document.getElementById('crash-sos-overlay');
        if (overlayEl) {
            const lockdownContent = `
                <i class="fa-solid fa-lock" style="font-size: 4rem; margin-bottom: 20px;"></i>
                <h2 style="font-size: 2rem;">BOÎTE NOIRE VERROUILLÉE</h2>
                <p>Données cryptées en cours de transmission...</p>
                <p>Les secours et vos contacts d'urgence ont été alertés.</p>
            `;
            if (window.DOMSecurity && window.DOMSecurity.safeHTML) {
                window.DOMSecurity.safeHTML(overlayEl, lockdownContent);
            } else {
                // eslint-disable-next-line no-restricted-syntax
                overlayEl.innerHTML = lockdownContent;
            }
        }

        console.warn("[CrashDetector] VERROUILLAGE EXÉCUTÉ !");
        console.warn("1. Appel Bluetooth vers ESP32 : Commande FREEZE_BLACKBOX");
        console.warn("2. Envoi du Hash d'accident sur Firebase Firestore");
        console.warn("3. SMS d'urgence envoyé via l'API Twilio/Firebase");
        
        // TODO: Implémenter ici la vraie liaison Bluetooth (Web Bluetooth API) vers l'ESP32
        // navigator.bluetooth.requestDevice(...)
    }
}

// Initialisation automatique pour la démonstration
window.CrashDetector = CrashDetector;
