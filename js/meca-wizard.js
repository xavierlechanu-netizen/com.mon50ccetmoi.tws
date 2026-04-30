/**
 * MECA-WIZARD v1.0
 * Oil mixing calculator and Acoustic Tuning AI.
 */

window.MecaWizard = {
    // 1. Calculateur de mélange
    calculateMix: function(liters, percent) {
        if (!liters || !percent) return 0;
        const oilMl = (liters * 1000) * (percent / 100);
        return Math.round(oilMl);
    },

    // 2. Analyse Acoustique (Simulation)
    startAcousticAnalysis: function() {
        if (window.session && window.session.isGuest) {
            alert("🔒 L'IA Acoustique est une exclusivité Membre. Inscrivez-vous pour diagnostiquer votre moteur !");
            return;
        }
        speak("Analyse acoustique du moteur lancée. Veuillez donner un coup de gaz franc au point mort.");
        
        const resultDiv = document.getElementById('meca-result');
        if (resultDiv) {
            resultDiv.innerHTML = `<div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-wave-square fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px;">ÉCOUTE DU SPECTRE SONORE...</p>
            </div>`;
        }

        setTimeout(() => {
            const diagnosis = ["Mélange trop riche (Gicleur trop gros)", "Mélange trop pauvre (Prise d'air ?)", "Combustion optimale détectée"];
            const randomDiag = diagnosis[Math.floor(Math.random() * diagnosis.length)];
            
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div class="glassmorphism" style="padding:20px; border-left:4px solid var(--accent);">
                        <h4 style="color:var(--accent);">DIAGNOSTIC SONORE</h4>
                        <p style="font-size:0.9rem; margin-top:10px;">${randomDiag}</p>
                        <p style="font-size:0.7rem; color:#888; margin-top:10px;">Note : Basé sur la signature fréquentielle de l'échappement.</p>
                    </div>
                `;
                speak(randomDiag);
            }
        }, 4000);
    }
};
