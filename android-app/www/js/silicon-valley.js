/* --- SILICON VALLEY BILLION DOLLAR FEATURES --- */

// 1. AR VISION (Augmented Reality Camera Background)
window.isARActive = false;
window.arStream = null;

window.toggleARVision = async function() {
    window.isARActive = !window.isARActive;
    const arVideo = document.getElementById('ar-video-bg');
    const mapContainer = document.getElementById('map');
    const btn = document.getElementById('dock-btn-ar');

    if (window.isARActive) {
        try {
            if(btn) btn.style.transform = 'scale(1.2)';
            if(btn) btn.style.filter = 'drop-shadow(0 0 10px #00ffcc)';
            
            // Request Camera
            window.arStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if(arVideo) {
                arVideo.srcObject = window.arStream;
                arVideo.classList.remove('hidden');
            }
            // Make map partially transparent
            if(mapContainer) {
                mapContainer.style.opacity = '0.3';
                mapContainer.style.mixBlendMode = 'screen';
            }
            if(typeof speak === 'function') speak('Vision Réalité Augmentée activée. HUD J.A.R.V.I.S en ligne.');
        } catch(err) {
            console.error("AR Error: ", err);
            window.isARActive = false;
            if(typeof speak === 'function') speak("Erreur d'accès à la caméra pour la réalité augmentée.");
            if(btn) btn.style.transform = 'scale(1)';
        }
    } else {
        if(btn) btn.style.transform = 'scale(1)';
        if(btn) btn.style.filter = 'drop-shadow(0 0 5px #00ffcc)';
        if(arVideo) arVideo.classList.add('hidden');
        if(window.arStream) {
            window.arStream.getTracks().forEach(track => track.stop());
            window.arStream = null;
        }
        if(mapContainer) {
            mapContainer.style.opacity = '1';
            mapContainer.style.mixBlendMode = 'normal';
        }
        if(typeof speak === 'function') speak('Réalité Augmentée désactivée.');
    }
};

// 2. WEB3 RIDE-TO-EARN WALLET
window.braveCoins = parseFloat(localStorage.getItem('braveCoins') || '0.00');

window.showCryptoWallet = function() {
    const screen = document.getElementById('crypto-wallet-screen');
    const balance = document.getElementById('crypto-balance');
    if(screen) screen.classList.remove('hidden');
    if(balance) balance.innerText = window.braveCoins.toFixed(2) + ' BVC';
    
    if(typeof speak === 'function') speak('Accès au portefeuille sécurisé Web 3.');
};

window.hideCryptoWallet = function() {
    const screen = document.getElementById('crypto-wallet-screen');
    if(screen) screen.classList.add('hidden');
};

// Hook into distance tracking to mine crypto
if(typeof window.stopNavigation === 'function') {
    const originalStop = window.stopNavigation;
    window.stopNavigation = function() {
        originalStop();
        // Reward 12.5 Brave Coins per ride
        window.braveCoins += 12.5;
        localStorage.setItem('braveCoins', window.braveCoins.toString());
        if(typeof speak === 'function') setTimeout(() => speak('Vous avez miné 12,5 Brave Coins pour ce trajet sécurisé.'), 8000);
    };
}

// 3. BIOMETRIC SYNC (Apple Watch Simulation)
window.currentBPM = 75;
window.initBiometrics = function() {
    const bpmDisplay = document.getElementById('biometric-bpm');
    if(!bpmDisplay) return;

    setInterval(() => {
        // Random fluctuation
        let fluctuation = Math.floor(Math.random() * 5) - 2;
        window.currentBPM += fluctuation;
        
        // Boundaries
        if(window.currentBPM < 60) window.currentBPM = 60;
        if(window.currentBPM > 140) window.currentBPM = 140;

        bpmDisplay.innerText = window.currentBPM + ' BPM';

        // Heartbeat animation speed
        const heartIcon = document.getElementById('biometric-heart');
        if(heartIcon) {
            let speed = 60 / window.currentBPM;
            heartIcon.style.animationDuration = speed + 's';
        }

        // Stress Detection (Zen Mode Trigger)
        if(window.currentBPM > 115) {
            bpmDisplay.style.color = '#ff0055';
            bpmDisplay.style.textShadow = '0 0 10px #ff0055';
            
            // Randomly trigger voice if super stressed
            if(Math.random() > 0.95 && typeof speak === 'function') {
                speak('Rythme cardiaque élevé détecté. Respirez calmement pour votre sécurité.');
            }
        } else {
            bpmDisplay.style.color = '#00ffcc';
            bpmDisplay.style.textShadow = '0 0 10px #00ffcc';
        }
    }, 2000);
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initBiometrics, 3000);
});
