import os

with open('js/neural-hud.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Interceptor functions at the end of NeuralHUD object
interceptor_code = """
    // --- PHASE 2 : INTERCEPTOR MODE ---
    initInterceptorMode: function() {
        this.logToConsole("INTERCEPTOR_MODE: ENGAGED");
        this.updateWeatherRadar();
        setInterval(() => this.updateWeatherRadar(), 15000); // Update every 15s
        
        // Random glitch events for high speed
        setInterval(() => {
            if (window.session && window.session.vMax > 80 && Math.random() > 0.8) {
                this.triggerGlitchAlert("OVER_SPEED_WARNING");
            }
        }, 10000);
    },

    updateWeatherRadar: function() {
        const tempEl = document.getElementById('weather-temp');
        const windEl = document.getElementById('weather-wind');
        const radarEl = document.getElementById('radar-users');
        
        if (tempEl) {
            // Fake realistic temp between 12 and 22
            const temp = Math.floor(Math.random() * 10) + 12;
            tempEl.textContent = temp + "°C";
            // Wind speed between 5 and 35 km/h
            const wind = Math.floor(Math.random() * 30) + 5;
            windEl.textContent = wind + " km/h";
            
            if (wind > 25) {
                windEl.style.color = "#ffb703"; // Warning high wind
            } else {
                windEl.style.color = "#00d2ff"; // Normal
            }
        }
        
        if (radarEl) {
            // Fake nearby users
            const users = Math.floor(Math.random() * 8);
            if (users > 0) {
                radarEl.innerHTML = `<span><strong style="color:#fff;">${users}</strong> Pilotes dans le secteur</span>`;
            } else {
                radarEl.innerHTML = `<span style="color:#aaa;">Zone dégagée</span>`;
            }
        }
    },

    triggerGlitchAlert: function(reason) {
        this.logToConsole("ALERT: " + reason);
        const overlay = document.getElementById('glitch-overlay');
        if (!overlay) return;
        
        overlay.style.display = 'block';
        
        // Flashing effect
        let flashes = 0;
        const flashInterval = setInterval(() => {
            overlay.style.opacity = flashes % 2 === 0 ? '1' : '0.2';
            flashes++;
            if (flashes > 5) {
                clearInterval(flashInterval);
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.style.display = 'none'; }, 200);
            }
        }, 80);
        
        // Glitch the whole body slightly
        document.body.style.filter = 'contrast(150%) hue-rotate(90deg) saturate(200%)';
        setTimeout(() => {
            document.body.style.filter = 'none';
        }, 500);
        
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
    },
"""

# Insert it before the last comma or end of NeuralHUD
# I will find the last closing brace of the NeuralHUD object.

import re
# We'll just replace "init: function() {" with "init: function() { this.initInterceptorMode();"
content = content.replace("init: function() {", "init: function() {\n        this.initInterceptorMode();")

# And append the functions at the end. I will inject it before the last `}` in the file if it's part of NeuralHUD.
# But neural-hud.js might have event listeners at the bottom.
# Let's use regex to find where NeuralHUD ends or just append to window.NeuralHUD.

append_script = """
if (window.NeuralHUD) {
    window.NeuralHUD.initInterceptorMode = function() {
        this.logToConsole("INTERCEPTOR_MODE: ENGAGED");
        this.updateWeatherRadar();
        setInterval(() => this.updateWeatherRadar(), 15000); // Update every 15s
        
        // Random glitch events for high speed
        setInterval(() => {
            if (window.session && window.session.vMax > 80 && Math.random() > 0.8) {
                this.triggerGlitchAlert("OVER_SPEED_WARNING");
            }
        }, 10000);
    };

    window.NeuralHUD.updateWeatherRadar = function() {
        const tempEl = document.getElementById('weather-temp');
        const windEl = document.getElementById('weather-wind');
        const radarEl = document.getElementById('radar-users');
        
        if (tempEl) {
            // Fake realistic temp between 12 and 22
            const temp = Math.floor(Math.random() * 10) + 12;
            tempEl.textContent = temp + "°C";
            // Wind speed between 5 and 35 km/h
            const wind = Math.floor(Math.random() * 30) + 5;
            windEl.textContent = wind + " km/h";
            
            if (wind > 25) {
                windEl.style.color = "#ffb703"; // Warning high wind
            } else {
                windEl.style.color = "#00d2ff"; // Normal
            }
        }
        
        if (radarEl) {
            // Fake nearby users
            const users = Math.floor(Math.random() * 8);
            if (users > 0) {
                radarEl.innerHTML = `<span><strong style="color:#fff;">\${users}</strong> Pilotes dans le secteur</span>`;
            } else {
                radarEl.innerHTML = `<span style="color:#aaa;">Zone dégagée</span>`;
            }
        }
    };

    window.NeuralHUD.triggerGlitchAlert = function(reason) {
        this.logToConsole("ALERT: " + reason);
        const overlay = document.getElementById('glitch-overlay');
        if (!overlay) return;
        
        overlay.style.display = 'block';
        
        // Flashing effect
        let flashes = 0;
        const flashInterval = setInterval(() => {
            overlay.style.opacity = flashes % 2 === 0 ? '1' : '0.2';
            flashes++;
            if (flashes > 5) {
                clearInterval(flashInterval);
                overlay.style.opacity = '0';
                setTimeout(() => { overlay.style.display = 'none'; }, 200);
            }
        }, 80);
        
        // Glitch the whole body slightly
        document.body.style.filter = 'contrast(150%) hue-rotate(90deg) saturate(200%)';
        setTimeout(() => {
            document.body.style.filter = 'none';
        }, 500);
        
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
    };
}
"""

with open('js/neural-hud.js', 'a', encoding='utf-8') as f:
    f.write(append_script)

with open('js/neural-hud.js', 'w', encoding='utf-8') as f:
    f.write(content + append_script)

