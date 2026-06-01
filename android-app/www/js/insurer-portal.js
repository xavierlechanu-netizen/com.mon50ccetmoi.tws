/* --- B2B INSURER PORTAL (WEB4) --- */

window.InsurerPortal = {
    currentCode: null,
    
    open: function() {
        document.getElementById('insurer-portal-screen').classList.remove('hidden');
    },
    
    close: function() {
        document.getElementById('insurer-portal-screen').classList.add('hidden');
    },
    
    verifyCode: function() {
        const input = document.getElementById('insurer-code-input').value.trim().toUpperCase();
        if(!input.startsWith('LIT-')) {
            alert("Code Invalide. Le format attendu est LIT-XXXX");
            return;
        }
        
        // Simuler la recherche dans le coffre-fort Firebase
        document.getElementById('insurer-login-box').classList.add('hidden');
        document.getElementById('insurer-pricing-box').classList.remove('hidden');
        this.currentCode = input;
    },
    
    buyReport: function(type, price, rewardBvc) {
        if(confirm(`[SÉCURITÉ ZERO-TRUST]\nConfirmez-vous l'achat du rapport [${type}] pour ${price}€ HT ?\n\n⚠️ CONDITIONS B2B : Les données chiffrées sont définitives.\nLe paiement sera instantanément prélevé via le Smart Contract.`)) {
            
            // Premium WOW Effect for success
            const pricingBox = document.getElementById('insurer-pricing-box');
            pricingBox.innerHTML = `
                <div style="text-align:center; padding: 40px;">
                    <i class="fa-solid fa-circle-check" style="font-size: 5rem; color: #00ffcc; text-shadow: 0 0 30px #00ffcc; margin-bottom:20px; animation: pulse 1s infinite;"></i>
                    <h2 style="color:#fff; font-size:2rem; font-weight:900;">TRANSACTION VALIDÉE</h2>
                    <p style="color:#00d2ff; font-family:'JetBrains Mono', monospace;">Clé de déchiffrement générée pour le dossier ${this.currentCode}</p>
                    <div style="margin-top:30px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; border-radius:12px; padding:15px; color:#fff;">
                        <i class="fa-solid fa-envelope"></i> Le rapport a été envoyé de manière sécurisée à votre adresse pro.
                    </div>
                </div>
            `;
            
            setTimeout(() => {
                // Déclenchement du Smart Contract Web4 : Rétribution du pilote
                if(window.Web4Economy && rewardBvc > 0) {
                    window.Web4Economy.mineToken(rewardBvc, `Smart Contract: L'assureur a acheté le rapport (${type})`);
                    if(typeof speak === 'function') {
                        speak('Transaction confirmée. Votre assureur a consulté le rapport. Les tokens ont été crédités.');
                    }
                }
                setTimeout(() => this.close(), 3000);
            }, 2000);
        }
    }
};
