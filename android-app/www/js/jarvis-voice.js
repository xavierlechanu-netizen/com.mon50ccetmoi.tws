/* --- J.A.R.V.I.S. 4.0 PROPRIETARY NEURAL ENGINE --- */

window.JarvisEngine = {
    context: {
        lastIntent: null,
        userMood: 'neutral'
    },
    
    // Réponses dynamiques pour éviter l'effet "robot"
    responses: {
        ack: ["Bien reçu.", "Je m'en occupe.", "Analyse en cours.", "Compris, pilote."],
        search: ["Je lance la recherche.", "Recherche dans la base de données locale.", "Cartographie en cours."],
        error: ["Je n'ai pas compris cette instruction.", "Veuillez reformuler, pilote.", "Instruction non reconnue par mes protocoles."]
    },
    
    getRandomResponse: function(type) {
        const arr = this.responses[type] || this.responses.ack;
        return arr[Math.floor(Math.random() * arr.length)];
    },

    processQuery: function(transcript) {
        console.log("[J.A.R.V.I.S 4.0] Traitement NLP :", transcript);
        
        const words = transcript.toLowerCase().split(' ');
        
        // 1. Détection d'intentions complexes (Intent Parsing)
        // Comparaison Carburant
        if (this.matchAny(transcript, ['essence', 'carburant', 'plein', 'station', 'sec']) && this.matchAny(transcript, ['moins cher', 'prix', 'compare', 'où'])) {
            return { action: 'COMPARE_GAS_PRICES', reply: `Analyse des prix du carburant dans un rayon de 3 kilomètres en cours.` };
        }
        else if (this.matchAny(transcript, ['essence', 'station', 'carburant', 'sec'])) {
            // Remplacé par l'intention complexe ci-dessus si l'utilisateur demande le prix, sinon recherche simple
            return { action: 'COMPARE_GAS_PRICES', reply: `${this.getRandomResponse('search')} J'affiche le radar communautaire des prix du carburant.` };
        }
        else if (this.matchAny(transcript, ['maison', 'domicile', 'rentrer', 'retour'])) {
            return { action: 'GO_HOME', reply: `Calcul du trajet vers votre domicile. ${this.getRandomResponse('ack')}` };
        }
        else if (this.matchAny(transcript, ['accident', 'danger', 'radar', 'flics', 'contrôle'])) {
            return { action: 'REPORT_HAZARD', reply: `Danger signalé à la meute. Merci pour votre vigilance.` };
        }
        else if (this.matchAny(transcript, ['animal', 'animaux', 'biche', 'sanglier', 'chien'])) {
            return { action: 'REPORT_ANIMAL', reply: `Présence animale confirmée. Soyez prudent.` };
        }
        else if (this.matchAny(transcript, ['meute', 'amis', 'social', 'radar social', 'pilotes'])) {
            return { action: 'SOCIAL_RADAR', reply: `Activation du balayage social. Recherche de pilotes alliés dans le secteur.` };
        }
        else if (this.matchAny(transcript, ['sensation', 'virage', 'sport', 'attaque'])) {
            return { action: 'SENSATION_MODE', reply: `Mode sensation engagé. Optimisation de l'itinéraire pour le plaisir de conduite.` };
        }
        else if (this.matchAny(transcript, ['diagnostic', 'état', 'santé', 'mécanique', 'panne'])) {
            return { action: 'AI_DIAGNOSTIC', reply: `J'ouvre le panneau de télémétrie prédictive.` };
        }
        else if (this.matchAny(transcript, ['qui es-tu', 'ton nom', 't\'appelles'])) {
            return { action: 'IDENTITY', reply: `Je suis Jarvis, l'intelligence artificielle propriétaire de Mon 50cc et Moi, conçue pour vous assister.` };
        }
        else {
            return { action: 'UNKNOWN', reply: this.getRandomResponse('error') };
        }
    },

    matchAny: function(text, keywords) {
        return keywords.some(kw => text.includes(kw));
    },
    
    executeAction: function(result) {
        if (typeof speak === 'function' && result.reply) {
            speak(result.reply);
        }

        switch (result.action) {
            case 'COMPARE_GAS_PRICES':
                if (typeof window.CommunityGas === 'object') {
                    window.CommunityGas.compareAndShow();
                } else {
                    if (typeof speak === 'function') speak("Le module de carburant communautaire est actuellement indisponible.");
                }
                break;
            case 'GAS_STATION':
                if (document.getElementById('route-search')) document.getElementById('route-search').value = "Station essence";
                if (typeof window.searchDestination === 'function') window.searchDestination();
                break;
            case 'GO_HOME':
                if (document.getElementById('route-search')) document.getElementById('route-search').value = "Centre-ville";
                if (typeof window.searchDestination === 'function') window.searchDestination();
                break;
            case 'REPORT_HAZARD':
                if (typeof window.reportHazard === 'function') window.reportHazard();
                break;
            case 'REPORT_ANIMAL':
                if (typeof window.reportHazard === 'function') window.reportHazard('animal', 'Signalement Vocal IA');
                break;
            case 'SOCIAL_RADAR':
                if (typeof window.toggleSocialRadar === 'function') window.toggleSocialRadar();
                break;
            case 'SENSATION_MODE':
                if (typeof window.toggleSensationMode === 'function') window.toggleSensationMode();
                break;
            case 'AI_DIAGNOSTIC':
                const modal = document.getElementById('ai-diagnostic-modal');
                if (modal) {
                    modal.classList.remove('hidden');
                    if(window.PredictiveMeca) window.PredictiveMeca.updateDashboardUI();
                }
                break;
        }
    }
};

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
        console.log("[J.A.R.V.I.S 4.0] En écoute...");
        const micIcon = document.getElementById('jarvis-mic-icon');
        if (micIcon) {
            micIcon.style.color = '#00d2ff'; // Couleur UI Gemini/IA
            micIcon.classList.add('fa-fade');
        }
    };

    window.voiceAI.onresult = function(event) {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.toLowerCase();
        console.log("[USER] : ", transcript);

        // Si le mot clé de réveil est utilisé
        if (transcript.includes('oracle') || transcript.includes('système') || transcript.includes('jarvis')) {
            // Traitement via le moteur neuronal local
            const result = window.JarvisEngine.processQuery(transcript);
            window.JarvisEngine.executeAction(result);
        }
    };

    window.voiceAI.onerror = function(event) {
        console.warn("[J.A.R.V.I.S 4.0] Erreur micro : ", event.error);
        const micIcon = document.getElementById('jarvis-mic-icon');
        if (micIcon) {
            micIcon.style.color = '#ff0055';
            micIcon.classList.remove('fa-fade');
        }
    };

    window.voiceAI.onend = function() {
        setTimeout(() => {
            try { window.voiceAI.start(); } catch(e) {}
        }, 1000);
    };

    try {
        window.voiceAI.start();
    } catch(e) {
        console.error("Impossible de démarrer l'IA vocale : ", e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(localStorage.getItem('cnil_consent') === 'true' && localStorage.getItem('cnil_mic') !== 'false') {
            window.initVoiceAI();
        }
    }, 5000);
});
