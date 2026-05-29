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
        if(confirm(`Confirmez-vous l'achat du rapport [${type}] pour ${price}€ HT ?\n\n⚠️ CONDITIONS : Les données numériques fournies dans ces rapports sont définitives. Conformément à nos CGV B2B, ces rapports ne sont ni échangeables, ni remboursables.\n\nLe paiement sera prélevé sur le compte de votre agence.`)) {
            
            // Simulation du déverrouillage
            alert(`Paiement de ${price}€ validé.\n\nAccès accordé au rapport complet pour le dossier ${this.currentCode}. Les données vous sont envoyées par email sécurisé.`);
            
            // Déclenchement du Smart Contract Web4 : Rétribution du pilote
            if(window.Web4Economy && rewardBvc > 0) {
                // On notifie le pilote qu'il a reçu sa prime car l'assureur a acheté le rapport
                window.Web4Economy.mineToken(rewardBvc, `Smart Contract: L'assureur a déverrouillé votre rapport (${type})`);
                
                // Petit feedback visuel ou vocal
                if(typeof speak === 'function') {
                    speak('Votre assureur a accédé au dossier. La prime a été créditée sur votre portefeuille.');
                }
            }
            
            this.close();
        }
    }
};
