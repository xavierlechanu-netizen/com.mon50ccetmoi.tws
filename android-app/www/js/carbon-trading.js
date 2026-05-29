/* --- CARBON TRADING & CEE MARKET --- */

window.ecoScore = 100;
window.ceeCertificates = parseInt(localStorage.getItem('ceeCertificates') || '0');

// 1. ECO-DRIVING TELEMETRY
window.initEcoTelemetry = function() {
    let lastSpeed = 0;
    setInterval(() => {
        const currentSpeed = window.lastKnownSpeedKmh || 0;
        const delta = Math.abs(currentSpeed - lastSpeed);
        
        // Si freinage brutal ou accélération violente (> 15 km/h en 1s)
        if (delta > 15) {
            window.ecoScore -= 2;
            if(window.ecoScore < 0) window.ecoScore = 0;
        }
        
        lastSpeed = currentSpeed;
    }, 1000);
};

// 2. GENERATE CEE CERTIFICATE
window.generateEcoReport = function() {
    const certScreen = document.getElementById('cee-certificate-screen');
    const scoreVal = document.getElementById('cee-score');
    const serialVal = document.getElementById('cee-serial');
    
    if(!certScreen) return;

    // Simulation de calcul
    if(window.ecoScore > 75) {
        window.ceeCertificates++;
        localStorage.setItem('ceeCertificates', window.ceeCertificates.toString());
        
        scoreVal.innerText = window.ecoScore + '/100';
        serialVal.innerText = "CEE-" + Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + new Date().getFullYear();
        
        certScreen.classList.remove('hidden');
        if(typeof speak === 'function') speak('Trajet terminé. Score écologique excellent. Certificat d\\'économie d\\'énergie généré avec succès.');
        
        // Update Wallet Badge if exists
        const walletBtn = document.getElementById('dock-btn-wallet');
        if(walletBtn) walletBtn.style.filter = 'drop-shadow(0 0 15px #00ff00)';
    } else {
        if(typeof speak === 'function') speak('Trajet terminé. Conduite trop agressive, aucun certificat carbone délivré.');
    }
};

window.closeCEE = function() {
    document.getElementById('cee-certificate-screen').classList.add('hidden');
};

// 3. CARBON TRADING FLOOR
window.openTradingFloor = function() {
    const floorScreen = document.getElementById('carbon-trading-floor');
    const stockPrice = document.getElementById('carbon-stock-price');
    const inventory = document.getElementById('cee-inventory');
    if(!floorScreen) return;
    
    inventory.innerText = window.ceeCertificates + " CEE Disponibles";
    floorScreen.classList.remove('hidden');
    
    if(typeof speak === 'function') speak('Accès à la salle de marché du carbone. Des mégacorporations attendent d\\'acheter vos certificats.');

    // Simulation du cours de la bourse
    window.tradingInterval = setInterval(() => {
        const price = (14.50 + (Math.random() * 5 - 2.5)).toFixed(2);
        stockPrice.innerText = price + " €";
        if(price > 16) stockPrice.style.color = "#00ff00";
        else stockPrice.style.color = "#ff0055";
    }, 2000);
};

window.closeTradingFloor = function() {
    document.getElementById('carbon-trading-floor').classList.add('hidden');
    clearInterval(window.tradingInterval);
};

window.sellCEE = function() {
    if(window.ceeCertificates > 0) {
        window.ceeCertificates = 0;
        localStorage.setItem('ceeCertificates', '0');
        
        const price = parseFloat(document.getElementById('carbon-stock-price').innerText);
        // Simulation d'injection dans le Wallet
        window.braveCoins += price * 1.5; // conversion fictive
        
        document.getElementById('cee-inventory').innerText = "0 CEE Disponibles";
        
        if(typeof speak === 'function') speak('Transaction validée. Certificats vendus aux industries polluantes. Fonds transférés sur votre portefeuille.');
        
        const button = document.getElementById('sell-cee-btn');
        button.innerText = "VENDU";
        button.style.background = "#00ff00";
        setTimeout(() => {
            button.innerText = "VENDRE AUX POLLUEURS";
            button.style.background = "linear-gradient(90deg, #ff0055, #b700ff)";
        }, 3000);
    } else {
        if(typeof speak === 'function') speak('Vous ne possédez aucun certificat à vendre.');
    }
};

// Start telemetry
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initEcoTelemetry, 3000);
});
