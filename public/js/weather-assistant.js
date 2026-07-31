/**
 * Assistant Trajet Jarvis (Météo & IA)
 * Analyse contextuelle de la météo pour avertir le conducteur.
 */

window.WeatherAssistant = {
    cardId: "weather-assistant-card",
    iconId: "weather-icon",
    textId: "weather-text",
    
    scenarios: [
        {
            type: "rain",
            icon: "<i class='fa-solid fa-cloud-showers-heavy'></i>",
            color: "#00f2ff",
            border: "#00f2ff",
            messages: [
                "Alerte : Risque de pluie dans 15 min. Équipez-vous.",
                "Chaussée glissante prévue sur votre trajet habituel.",
                "Averses modérées. Réduisez votre vitesse."
            ]
        },
        {
            type: "clear",
            icon: "<i class='fa-solid fa-sun'></i>",
            color: "#ffd700",
            border: "#ffd700",
            messages: [
                "Météo idéale. Route sèche et dégagée.",
                "Plein soleil ! Parfait pour une balade.",
                "Visibilité excellente sur votre secteur."
            ]
        },
        {
            type: "cold",
            icon: "<i class='fa-regular fa-snowflake'></i>",
            color: "#b3e5fc",
            border: "#b3e5fc",
            messages: [
                "Températures basses. Risque de verglas par endroits.",
                "Il fait froid ce matin, laissez chauffer le moteur.",
                "Gants d'hiver recommandés pour votre trajet."
            ]
        },
        {
            type: "night",
            icon: "<i class='fa-solid fa-moon'></i>",
            color: "#e099ff",
            border: "#e099ff",
            messages: [
                "Trajet nocturne : vérifiez vos feux de croisement.",
                "Visibilité réduite. Activez le mode prudent.",
                "La température baisse, route potentiellement humide."
            ]
        }
    ],

    init: function() {
        console.log("[Jarvis] Initialisation de l'Assistant Trajet Météo...");
        // On attend un peu que l'app soit chargée avant d'afficher l'alerte
        setTimeout(() => {
            this.analyzeAndDisplay();
        }, 3500); // 3.5s après chargement
    },

    analyzeAndDisplay: function() {
        const card = document.getElementById(this.cardId);
        if (!card) return;

        // Choix aléatoire d'un scénario pour la démo
        // Dans une V2, on utiliserait navigator.geolocation et une vraie API (OpenWeather)
        
        let scenario;
        const hour = new Date().getHours();
        
        if (hour >= 20 || hour < 6) {
            // Nuit forcée si on est le soir/nuit
            scenario = this.scenarios.find(s => s.type === "night");
        } else {
            // Sinon on prend un scénario au hasard parmi les 3 premiers
            scenario = this.scenarios[Math.floor(Math.random() * 3)];
        }

        const randomMsg = scenario.messages[Math.floor(Math.random() * scenario.messages.length)];

        // Update UI
        const iconEl = document.getElementById(this.iconId);
        const textEl = document.getElementById(this.textId);
        
        if (iconEl) {
            iconEl.innerHTML = scenario.icon;
            iconEl.style.color = scenario.color;
        }
        if (textEl) {
            textEl.innerText = randomMsg;
        }
        
        card.style.borderLeftColor = scenario.border;

        // Show card with a small animation
        card.style.display = "flex";
        card.animate([
            { opacity: 0, transform: "translate(-50%, -20px)" },
            { opacity: 1, transform: "translate(-50%, 0)" }
        ], { duration: 500, easing: "ease-out" });

        // Text-to-speech optionnel avec Jarvis
        if (window.OracleVoice && window.OracleVoice.isVoiceActive) {
            // On ne parle pas de force pour ne pas spammer, sauf si mode vocal actif
            // Mais pour l'effet Wow, on pourrait ajouter un petit son
        }
    },

    hide: function() {
        const card = document.getElementById(this.cardId);
        if (card) {
            card.animate([
                { opacity: 1, transform: "translate(-50%, 0)" },
                { opacity: 0, transform: "translate(-50%, -20px)" }
            ], { duration: 300, easing: "ease-in" }).onfinish = () => {
                card.style.display = "none";
            };
        }
    }
};

// Auto-start
document.addEventListener("DOMContentLoaded", () => {
    window.WeatherAssistant.init();
});
