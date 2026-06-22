/* --- CONFORMITÉ RGPD & CNIL --- */

window.checkRGPD = function() {
    const hasConsented = localStorage.getItem('cnil_consent');
    const rgpdBanner = document.getElementById('rgpd-banner');
    
    if (!hasConsented) {
        // Bloquer l'exécution des systèmes intrusifs
        window.preventAppLaunch = true;
        if(rgpdBanner) rgpdBanner.classList.remove('hidden');
    } else {
        window.preventAppLaunch = false;
        if(rgpdBanner) rgpdBanner.classList.add('hidden');
        // Autoriser le démarrage des services différés
        if(typeof window.initVoiceAI === 'function') setTimeout(window.initVoiceAI, 1000);
        if(typeof window.initZeroClickDestiny === 'function') setTimeout(window.initZeroClickDestiny, 2000);
    }
};

window.acceptRGPD = function() {
    const gpsChecked = document.getElementById('rgpd-gps').checked;
    const micChecked = document.getElementById('rgpd-mic').checked;
    const camChecked = document.getElementById('rgpd-cam').checked;

    if(!gpsChecked) {
        alert("Attention : L'application nécessite obligatoirement l'accès au GPS pour fonctionner (Article 6 du RGPD - Nécessité contractuelle).");
        return;
    }

    localStorage.setItem('cnil_consent', 'true');
    localStorage.setItem('cnil_mic', micChecked ? 'true' : 'false');
    localStorage.setItem('cnil_cam', camChecked ? 'true' : 'false');

    document.getElementById('rgpd-banner').classList.add('hidden');
    window.preventAppLaunch = false;
    
    // On lance les services si cochés
    if(micChecked && typeof window.initVoiceAI === 'function') setTimeout(window.initVoiceAI, 1000);
    
    // Lancement du reste
    if(typeof window.initZeroClickDestiny === 'function') setTimeout(window.initZeroClickDestiny, 2000);
    
    if(typeof speak === 'function') speak("Paramètres de confidentialité enregistrés. Données stockées localement en accord avec la CNIL.");
};

window.openPrivacyPolicy = function() {
    const modal = document.getElementById('privacy-policy-modal');
    if(modal) modal.classList.remove('hidden');
};

window.closePrivacyPolicy = function() {
    const modal = document.getElementById('privacy-policy-modal');
    if(modal) modal.classList.add('hidden');
};

window.revokeAndEraseData = function() {
    if(confirm("ATTENTION : Conformément à l'Article 17 du RGPD (Droit à l'oubli), cela effacera DÉFINITIVEMENT vos certificats CEE, votre portefeuille Crypto et vos préférences. Confirmer ?")) {
        localStorage.clear();
        alert("Toutes vos données locales ont été détruites. L'application va redémarrer.");
        window.location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Override l'appel par défaut de initVoiceAI et ZeroClick dans les autres scripts
    // En remplaçant les setTimeout existants par ce check RGPD centralisé
    setTimeout(window.checkRGPD, 500);
});
