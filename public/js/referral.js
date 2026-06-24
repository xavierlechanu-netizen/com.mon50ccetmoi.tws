/**
 * REFERRAL SYSTEM (Parrainage - Proof of Ride)
 * Récompense le parrainage si le filleul fait ses preuves (20 km).
 */

window.ReferralManager = {
    init: function() {
        this.captureReferralCode();
    },

    // 1. Capture du code parrain dans l'URL (ex: ?ref=user_xyz)
    captureReferralCode: function() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        if (refCode) {
            const existingRef = localStorage.getItem('referredBy');
            if (!existingRef) {
                console.log("mon50cc Referral : Parrainé par", refCode);
                localStorage.setItem('referredBy', refCode);
                localStorage.setItem('referralRewardClaimed', 'false'); // Pas encore payé
                
                if (typeof speak === 'function') {
                    speak("Lien de parrainage détecté. Roulez 20 kilomètres pour débloquer les récompenses !");
                }
            }
        }
    },

    // 2. Bouton "Inviter un ami"
    shareReferralLink: async function() {
        if (!window.session || !window.session.uid) {
            alert("Veuillez vous connecter pour obtenir votre lien de parrainage.");
            return;
        }

        const myRefCode = window.session.uid;
        const shareUrl = `https://mon50ccetmoi.app/?ref=${myRefCode}`;
        const shareText = "Rejoins-moi sur l'app ultime pour pilotes de 50cc ! Roule 20km et on gagne des cryptos BVC ! 🏍️🚀";

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Mon 50cc et Moi - Parrainage',
                    text: shareText,
                    url: shareUrl
                });
                console.log('Lien de parrainage partagé avec succès');
            } catch (err) {
                console.warn('Partage annulé ou erreur', err);
            }
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
                alert("Lien de parrainage copié dans le presse-papiers !");
            });
        }
    },

    // 3. Vérification de la distance pour débloquer la prime (Appelé par la télémétrie)
    checkReferralReward: async function(totalKm) {
        if (totalKm >= 20) {
            const referredBy = localStorage.getItem('referredBy');
            const isClaimed = localStorage.getItem('referralRewardClaimed');

            // Si j'ai un parrain ET que la prime n'a pas encore été payée
            if (referredBy && isClaimed === 'false') {
                console.log("mon50cc Referral : Les 20km sont atteints ! Paiement au parrain...");
                
                // Marquer localement comme payé pour éviter la boucle
                localStorage.setItem('referralRewardClaimed', 'true');
                
                // Si on a accès à Firebase
                if (typeof db !== 'undefined' && window.session) {
                    try {
                        // 1. Enregistrer la transaction pour le parrain (Cloud Function ou Update direct)
                        await db.collection("referral_rewards").add({
                            referrerId: referredBy,
                            referredUser: window.session.uid,
                            amount: 50,
                            reason: "Proof of Ride - 20km",
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        // 2. Bonus pour le filleul (20 BVC) en récompense de bienvenue
                        window.braveCoins = (window.braveCoins || 0) + 20;
                        localStorage.setItem('braveCoins', window.braveCoins.toString());
                        
                        if (typeof speak === 'function') {
                            speak("Félicitations, vous avez dépassé les 20 kilomètres. Votre parrain reçoit 50 BVC, et vous gagnez un bonus de bienvenue de 20 BVC !");
                        }
                    } catch (err) {
                        console.error("mon50cc Referral Error:", err);
                        // Annuler le claim local si erreur réseau pour réessayer plus tard
                        localStorage.setItem('referralRewardClaimed', 'false');
                    }
                }
            }
        }
    }
};

// Auto-init at load
window.addEventListener('DOMContentLoaded', () => {
    window.ReferralManager.init();
});
