import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { describeWeather } from './weather-advice.js';

/**
 * Assistant Trajet Nexus Atlas (Météo & IA)
 * Analyse contextuelle de la météo pour avertir le conducteur.
 */

window.WeatherAssistant = {
    cardId: "weather-assistant-card",
    iconId: "weather-icon",
    textId: "weather-text",
    
    lastShownType: null,

    init: function() {
        console.log("[Nexus Atlas] Initialisation de l'Assistant Trajet Météo...");
        // Le conseil s'affiche quand la VRAIE météo est connue (fetchWeather, au premier fix GPS).
        // Avant : un message tiré au hasard 3,5 s après le chargement (« pour la démo »).
        document.addEventListener("mon50cc:weather", (e) => this.analyzeAndDisplay(e.detail));
        if (window.currentWeather) this.analyzeAndDisplay(window.currentWeather);
    },

    analyzeAndDisplay: function(weather) {
        const card = document.getElementById(this.cardId);
        if (!card || !weather) return;

        const advice = describeWeather(weather, new Date().getHours());
        // Pas de nouvelle carte toutes les 15 min si la situation n'a pas changé
        if (advice.type === this.lastShownType) return;
        this.lastShownType = advice.type;

        // Update UI
        const iconEl = document.getElementById(this.iconId);
        const textEl = document.getElementById(this.textId);

        if (iconEl) {
            iconEl.replaceChildren();
            const i = document.createElement("i");
            i.className = `fa-solid ${advice.icon}`;
            iconEl.appendChild(i);
            iconEl.style.color = advice.color;
        }
        if (textEl) {
            textEl.textContent = `${advice.message} (${weather.temp} °C, vent ${weather.wind} km/h)`;
        }

        card.style.borderLeftColor = advice.color;

        // La bulle météo est au même endroit : on la masque tant que la carte est affichée
        const bubble = document.getElementById("weather-hud");
        if (bubble) bubble.style.visibility = "hidden";

        // Show card with a small animation
        card.style.display = "flex";
        card.animate([
            { opacity: 0, transform: "translate(-50%, -20px)" },
            { opacity: 1, transform: "translate(-50%, 0)" }
        ], { duration: 500, easing: "ease-out" });

        // Text-to-speech optionnel avec Nexus Atlas
        if (window.OracleVoice && window.OracleVoice.isVoiceActive) {
            // On ne parle pas de force pour ne pas spammer, sauf si mode vocal actif
            // Mais pour l'effet Wow, on pourrait ajouter un petit son
        }
    },

    hide: function() {
        const card = document.getElementById(this.cardId);
        if (card) {
            const finish = () => {
                card.style.display = "none";
                const bubble = document.getElementById("weather-hud");
                if (bubble) bubble.style.visibility = "visible";
            };
            card.animate([
                { opacity: 1, transform: "translate(-50%, 0)" },
                { opacity: 0, transform: "translate(-50%, -20px)" }
            ], { duration: 300, easing: "ease-in" }).onfinish = finish;
            // Si l'animation ne tourne pas (app en arrière-plan), la carte se ferme quand même
            setTimeout(finish, 400);
        }
    }
};

// Auto-start
document.addEventListener("DOMContentLoaded", () => {
    window.WeatherAssistant.init();
});
