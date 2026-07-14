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
        
        // Mapping des langues principales, mais on fallback sur n'importe quel dialecte du téléphone (les 7000+ supportés par l'OS)
        const langMap = {
            'fr': 'fr-FR', 'en': 'en-US', 'es': 'es-ES', 'it': 'it-IT',
            'nl': 'nl-NL', 'pl': 'pl-PL', 'pt': 'pt-PT', 'de': 'de-DE',
            'zh': 'zh-CN', 'ja': 'ja-JP', 'ro': 'ro-RO', 'hk': 'zh-HK'
        };
        // Utilise la langue choisie dans l'app, SINON utilise le dialecte exact du téléphone (ex: fr-CA, ar-DZ, sw-KE)
        this.recognition.lang = langMap[window.currentLang] || navigator.language || 'fr-FR';

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
        
        const overlay = document.getElementById('oracle-listening-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    stop() {
        this.active = false;
        if (this.recognition) this.recognition.stop();
        console.log("Oracle Voice Engine : [ OFFLINE ]");
        
        const overlay = document.getElementById('oracle-listening-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    toggle() {
        if (this.active) {
            this.stop();
            speak("Reconnaissance vocale désactivée.");
        } else {
            this.start();
            speak("Reconnaissance vocale activée.");
        }
    }

    updateLanguage() {
        const wasActive = this.active;
        this.stop();
        
        const langMap = {
            'fr': 'fr-FR', 'en': 'en-US', 'es': 'es-ES', 'it': 'it-IT',
            'nl': 'nl-NL', 'pl': 'pl-PL', 'pt': 'pt-PT', 'de': 'de-DE',
            'zh': 'zh-CN', 'ja': 'ja-JP', 'ro': 'ro-RO', 'hu': 'hu-HU',
            'cs': 'cs-CZ', 'el': 'el-GR', 'no': 'no-NO', 'fi': 'fi-FI',
            'da': 'da-DK', 'sv': 'sv-SE', 'hk': 'zh-HK'
        };
        
        if (this.recognition) {
            // Débridage total : si la langue n'est pas dans la liste, on capte le dialecte natif de l'utilisateur (Android/iOS)
            this.recognition.lang = langMap[window.currentLang] || navigator.language || 'fr-FR';
            console.log("Oracle Voice : Langue de reconnaissance (Mondiale) ->", this.recognition.lang);
        }

        if (wasActive) this.start();
    }

    processCommand(text) {
        // Trigger principal : "Oracle", "mon 50", "ma voturette", "mon vsp", "ami"
        const triggered = text.includes("oracle") || text.includes("mon 50") ||
            text.includes("mon50") || text.includes("voturette") ||
            text.includes("vsp") || text.includes("ami") || text.includes("allô");

        if (!triggered) return;

        vibrate(100);

        // ── Dangers & Alertes ──────────────────────────────────────
        if (text.includes("alerte rouge") || text.includes("danger immédiat") || text.includes("chauffard")) {
            let description = "";
            const triggers = ["alerte rouge", "danger immédiat", "chauffard"];
            for (let t of triggers) {
                if (text.includes(t)) {
                    description = text.substring(text.indexOf(t) + t.length).trim();
                    break;
                }
            }
            if (typeof window.saveHazard === "function") {
                window.saveHazard('danger_immediat', description);
                speak(`Alerte rouge envoyée${description ? ' pour ' + description : ''}. Prudence.`);
            } else {
                speak("Je n'ai pas pu signaler le danger.");
            }
        } else if (text.includes("danger") || text.includes("radar") || text.includes("police") || text.includes("contrôle")) {
            if (typeof window.saveHazard === "function") {
                window.saveHazard('radar');
                speak("Danger signalé à la communauté. Restez prudent.");
            } else {
                speak("Je n'ai pas pu signaler le danger. La carte n'est pas encore chargée.");
            }
        }
        // ── Vitesse ────────────────────────────────────────────────
        else if (text.includes("vitesse") || text.includes("vite") || text.includes("rapide")) {
            const speed = document.getElementById('speed')?.textContent || '0';
            speak(`Vitesse actuelle : ${speed} km/h.`);
        }
        // ── Navigation / Aller ────────────────────────────────────
        else if (text.includes("emmène") || text.includes("amène") || text.includes("aller à") || text.includes("navigue")) {
            const dest = text.replace(/.*(?:emmène|amène|aller à|navigue(?:r)? vers?)\s+/i, '').trim();
            if (dest) {
                const input = document.getElementById('route-search');
                if (input) {
                    input.value = dest;
                    if (typeof window.searchDestination === 'function') window.searchDestination();
                    speak(`Calcul de l'itinéraire vers ${dest}.`);
                }
            }
        }
        // ── Menu ───────────────────────────────────────────────────
        else if (text.includes("menu") || text.includes("ouvre") || text.includes("panneau")) {
            window.toggleMenu();
            speak("Ouverture du menu.");
        }
        // ── Kilométrage ────────────────────────────────────────────
        else if (text.includes("kilométrage") || text.includes("distance") || text.includes("combien") || text.includes("parcouru")) {
            const km = window.session?.totalDistance || 0;
            speak(`Vous avez parcouru ${km.toFixed(1)} kilomètres au total.`);
        }
        // ── Localisation / Position ────────────────────────────────
        else if (text.includes("où") || text.includes("position") || text.includes("localisation") || text.includes("suis-je")) {
            const pos = window.currentPosition;
            if (pos) {
                speak(`Vous êtes à latitude ${pos.lat.toFixed(4)}, longitude ${pos.lng.toFixed(4)}.`);
            } else {
                speak("Je n'ai pas encore de signal GPS.");
            }
        }
        // ── Météo ──────────────────────────────────────────────────
        else if (text.includes("météo") || text.includes("temps") || text.includes("pluie")) {
            const temp = document.getElementById('weather-hud')?.textContent || '--';
            speak(`La température affichée est de ${temp}.`);
        }
        // ── Mode Constat / Défense Juridique ─────────────────────────
        else if (text.includes("mode constat") || text.includes("j'ai un accident") || text.includes("urgence extrême") || text.includes("accrochage")) {
            speak("Mode urgence activé. Ne paniquez pas.");
            if (window.SOSEmergency) {
                window.SOSEmergency.trigger();
            } else {
                 const timCook = document.getElementById('tim-cook-sos-screen');
                 if(timCook) timCook.classList.remove('hidden');
            }
            if (window.PocketLawyer && window.PocketLawyer.startAudioDefense) {
                setTimeout(() => {
                    window.PocketLawyer.startAudioDefense();
                }, 4000); // Attendre la fin du premier message audio
            }
        }
        // ── SOS / Urgence ──────────────────────────────────────────
        else if (text.includes("sos") || text.includes("secours") || text.includes("urgence")) {
            speak("Activation du protocole SOS. Restez immobile.");
            if (window.SOSEmergency) window.SOSEmergency.trigger();
            else {
                 const timCook = document.getElementById('tim-cook-sos-screen');
                 if(timCook) timCook.classList.remove('hidden');
            }
        }
        // ── Premium / Mode ─────────────────────────────────────────
        else if (text.includes("mode jour") || text.includes("thème clair")) {
            document.body.classList.add('day-mode');
            speak("Mode jour activé. Conduisez prudemment avec ce soleil.");
        }
        else if (text.includes("mode nuit") || text.includes("thème sombre")) {
            document.body.classList.remove('day-mode');
            speak("Mode nuit activé. Interface tactique restaurée.");
        }
        else if (text.includes("mon xp") || text.includes("mon niveau")) {
            const xp = window.session?.xp || 0;
            speak("Vous avez  points d'expérience. Continuez à rouler pour passer au niveau supérieur !");
        }
        else if (text.includes("il pleut") || text.includes("météo détaillée")) {
            if(typeof window.updateWeatherUI === 'function') window.updateWeatherUI(true);
            speak("Pluie détectée. J'adapte l'affichage et je modifie les paramètres d'adhérence virtuels.");
        }
        // ── Diagnostic IA / Mécanique ──────────────────────────────
        else if (text.includes("diagnostic") || text.includes("état") || text.includes("santé") || text.includes("mécanique") || text.includes("panne") || text.includes("révision")) {
            if (window.PredictiveMeca) {
                const score = Math.round(window.PredictiveMeca.getGlobalHealthScore());
                let message = `Votre véhicule est opérationnel à ${score} %.`;
                if (score < 50) message += " Attention, maintenance urgente requise. J'affiche le diagnostic.";
                else if (score < 85) message += " Une révision est conseillée. J'affiche le diagnostic.";
                else message += " Tout semble en parfait état. J'affiche le diagnostic.";
                
                speak(message);
                
                const modal = document.getElementById('ai-diagnostic-modal');
                if (modal) {
                    modal.classList.remove('hidden');
                    window.PredictiveMeca.updateDashboardUI();
                }
            } else {
                speak("L'analyse prédictive est hors ligne.");
            }
        }
        // ── Aide ───────────────────────────────────────────────────
        else if (text.includes("aide") || text.includes("commande") || text.includes("que peux") || text.includes("que sais")) {
            speak("Je peux : Signaler un danger, Donner votre vitesse, Naviguer vers une destination, Ouvrir le menu, Donner votre kilométrage, et activer le SOS. Dites Oracle suivi de votre commande.");
        }
        // ── Salutation / Conversation ──────────────────────────────
        else if (text.includes("bonjour") || text.includes("salut") || text.includes("coucou") || text.includes("comment")) {
            const hour = new Date().getHours();
            const greet = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
            const name = window.session?.username ? `, ${window.session.username}` : "";
            speak(`${greet}${name}. Je suis Oracle, votre copilote intelligent. Dites oracle aide pour connaître mes commandes.`);
        }
        // ── Réponse par défaut ─────────────────────────────────────
        else {
            speak("Je vous écoute. Dites Oracle aide pour connaître mes commandes disponibles.");
        }
    }

}

window.OracleVoice = new OracleVoice();
