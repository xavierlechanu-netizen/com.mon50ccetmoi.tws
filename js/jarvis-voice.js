/* --- J.A.R.V.I.S. VOICE COMMAND AI --- */

window.initVoiceAI = function() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn("Reconnaissance vocale non supportée sur ce navigateur.");
        return;
    }

    window.voiceAI = new SpeechRecognition();
    window.voiceAI.continuous = true;
    window.voiceAI.interimResults = false;
    window.voiceAI.lang = 'fr-FR';

    window.voiceAI.onstart = function() {
        console.log("[J.A.R.V.I.S v3.0] Mode écoute activé.");
        const micIcon = document.getElementById('jarvis-mic-icon');
        if (micIcon) {
            micIcon.style.color = '#0f0';
            micIcon.classList.add('fa-fade');
        }
    };

    window.voiceAI.onresult = function(event) {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.toLowerCase();
        console.log("[J.A.R.V.I.S] A entendu : ", transcript);

        // Analyse des mots clés (Trigger Words)
        if (transcript.includes('oracle') || transcript.includes('système') || transcript.includes('jarvis')) {
            
            // Commande : Trouver de l'essence
            if (transcript.includes('essence') || transcript.includes('station')) {
                if(typeof speak === 'function') speak('Recherche de la station essence la plus proche en cours. Nouvel itinéraire en calcul.');
                const searchInput = document.getElementById('route-search');
                if(searchInput) {
                    searchInput.value = "Station essence";
                    if (typeof window.searchDestination === 'function') window.searchDestination();
                }
            }
            // Commande : Rentrer à la maison
            else if (transcript.includes('maison') || transcript.includes('domicile') || transcript.includes('rentrer')) {
                if(typeof speak === 'function') speak('Calcul de l\'itinéraire de retour. Soyez prudent pilote.');
                const searchInput = document.getElementById('route-search');
                if(searchInput) {
                    searchInput.value = "Centre-ville"; // Adresse par défaut simulée
                    if (typeof window.searchDestination === 'function') window.searchDestination();
                }
            }
            // Commande : Signaler un accident/danger
            else if (transcript.includes('accident') || transcript.includes('danger') || transcript.includes('radar')) {
                if(typeof speak === 'function') speak('Information signalée à la meute. Merci pilote.');
                if(typeof window.reportHazard === 'function') {
                    window.reportHazard();
                }
            }
            // Commande : Signaler un animal
            else if (transcript.includes('animal') || transcript.includes('animaux') || transcript.includes('chien') || transcript.includes('sanglier') || transcript.includes('biche') || transcript.includes('chevreuil') || transcript.includes('vache') || transcript.includes('cheval')) {
                if(typeof speak === 'function') speak("Présence d'un animal signalée. Soyez prudents.");
                if(typeof window.reportHazard === 'function') {
                    window.reportHazard('animal', 'Signalement Vocal Jarvis');
                }
            }
            // Commande : Activer le Radar Social
            else if (transcript.includes('meute') || transcript.includes('amis') || transcript.includes('social')) {
                if(typeof speak === 'function') speak('Activation du Radar Social. Recherche des pilotes à proximité.');
                if(typeof window.toggleSocialRadar === 'function') window.toggleSocialRadar();
            }
            // Commande : Activer le Mode Sensation
            else if (transcript.includes('sensation') || transcript.includes('virage')) {
                if(typeof speak === 'function') speak('Mode Sensation engagé. Recherche de routes sinueuses.');
                if(typeof window.toggleSensationMode === 'function') window.toggleSensationMode();
            }
            // Commande Générique incomprise
            else {
                if(typeof speak === 'function') speak('En attente d\'instructions, Pilote.');
            }
        }
    };

    window.voiceAI.onerror = function(event) {
        console.warn("[J.A.R.V.I.S] Erreur micro : ", event.error);
        const micIcon = document.getElementById('jarvis-mic-icon');
        if (micIcon) {
            micIcon.style.color = '#ff0055';
            micIcon.classList.remove('fa-fade');
        }
    };

    window.voiceAI.onend = function() {
        // Redémarrer automatiquement pour une écoute continue
        setTimeout(() => {
            try { window.voiceAI.start(); } catch(e) {}
        }, 1000);
    };

    // Lancement initial
    try {
        window.voiceAI.start();
    } catch(e) {
        console.error("Impossible de démarrer l'IA vocale : ", e);
    }
};

// Démarrer l'IA Vocale après un délai pour laisser le reste charger
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(localStorage.getItem('cnil_consent') === 'true' && localStorage.getItem('cnil_mic') !== 'false') {
            window.initVoiceAI();
        }
    }, 5000);
});
