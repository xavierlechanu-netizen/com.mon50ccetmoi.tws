/**
 * ORACLE VOICE ENGINE - Voice Recognition & Commands (PHASE SINGULARITY)
 * Permet au pilote de contrôler l'app sans lâcher le guidon.
 */
class OracleVoice {
    constructor() {
        this.recognition = null;
        this.active = false;
        this.setupRecognition();
    }

    setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Oracle Voice : Reconnaissance vocale non supportée par ce navigateur.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'fr-FR';

        this.recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            console.log("Oracle Heard:", transcript);
            this.processCommand(transcript);
        };

        this.recognition.onerror = (e) => {
            if (e.error !== 'no-speech') console.warn("Oracle Voice Error:", e.error);
        };

        this.recognition.onend = () => {
            if (this.active) {
                try { this.recognition.start(); } catch(e) {}
            }
        };
    }

    start() {
        if (!this.recognition || this.active) return;
        this.active = true;
        try { this.recognition.start(); } catch(e) { console.error("Start fail:", e); }
        console.log("Oracle Voice Engine : [ ONLINE ]");
    }

    stop() {
        this.active = false;
        if (this.recognition) this.recognition.stop();
    }

    processCommand(text) {
        // Trigger principal : "Oracle"
        if (text.includes("oracle") || text.includes("mon 50") || text.includes("mon50")) {
            vibrate(100);
            
            if (text.includes("danger") || text.includes("radar") || text.includes("police")) {
                if (typeof window.reportHazard === "function") {
                    window.reportHazard('radar', "Signalement Vocal");
                    speak("Danger signalé à la communauté.");
                }
            } 
            else if (text.includes("vitesse")) {
                const speed = document.getElementById('speed').textContent;
                speak(`Vitesse actuelle : ${speed} km/h.`);
            }
            else if (text.includes("menu")) {
                window.toggleMenu();
                speak("Ouverture du menu.");
            }
            else if (text.includes("kilométrage") || text.includes("distance")) {
                const km = window.session?.totalDistance || 0;
                speak(`Vous avez parcouru ${km.toFixed(1)} kilomètres au total.`);
            }
            else if (text.includes("aide")) {
                speak("Commandes disponibles : Danger, Vitesse, Menu, Kilométrage.");
            }
        }
    }
}

window.OracleVoice = new OracleVoice();
