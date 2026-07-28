/**
 * REFERRAL SYSTEM (Parrainage Gamifié & InsurTech)
 * Paliers de kilométrage et revenus passifs sur conduite sécurisée.
 */

window.ReferralManager = {
  init: function () {
    this.captureReferralCode();
  },

  // 1. Capture du code parrain dans l'URL (ex: ?ref=XavBike)
  captureReferralCode: function () {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref");

    if (refCode) {
      const existingRef = localStorage.getItem("referredBy");
      if (!existingRef) {
        localStorage.setItem("referredBy", refCode);
        localStorage.setItem("referralMilestone", "0"); // Nouveau système de suivi (0 = aucun palier)

        if (typeof speak === "function") {
          speak(
            "Lien de parrainage détecté. Roulez pour débloquer vos premières récompenses !",
          );
        }
      }
    }
  },

  // 2. Bouton "Inviter un ami" (Vanity URL)
  shareReferralLink: async function () {
    if (!window.session || !window.session.uid) {
      alert("Veuillez vous connecter pour obtenir votre lien de parrainage.");
      return;
    }

    // Si l'utilisateur a un pseudo défini, on l'utilise, sinon on prend l'UID
    const myRefCode = window.session.username || window.session.uid;
    const shareUrl = `https://mon50ccetmoi.app/?ref=${encodeURIComponent(myRefCode)}`;
    const shareText = `Rejoins mon Crew sur l'app ultime pour pilotes de 50cc ! Utilise mon code ${myRefCode} et on gagne des cryptos BVC ! ðŸï¸ðŸš€`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon 50cc et Moi - Crew",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.warn("Partage annulé ou erreur", err);
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        alert("Lien de parrainage copié dans le presse-papiers !");
      });
    }
  },

  // 3. Vérification des Paliers (Milestones)
  checkReferralReward: async function (totalKm) {
    const referredBy = localStorage.getItem("referredBy");
    if (!referredBy) return; // Pas de parrain

    let currentMilestone = parseInt(
      localStorage.getItem("referralMilestone") || "0",
      10,
    );

    // Palier 1 : 20 km (Bienvenue)
    if (totalKm >= 20 && currentMilestone < 1) {
      await this.processMilestoneReward(
        1,
        20,
        50,
        20,
        "Félicitations, vous avez dépassé les 20 kilomètres. Votre parrain reçoit 50 BVC, et vous gagnez 20 BVC !",
      );
    }
    // Palier 2 : 100 km (Motard Fidèle)
    else if (totalKm >= 100 && currentMilestone < 2) {
      await this.processMilestoneReward(
        2,
        100,
        100,
        50,
        "Incroyable, 100 kilomètres atteints ! Vous êtes maintenant un Motard Fidèle. 50 BVC débloqués.",
      );
    }
    // Palier 3 : 500 km (Pilote Confirmé)
    else if (totalKm >= 500 && currentMilestone < 3) {
      await this.processMilestoneReward(
        3,
        500,
        300,
        200,
        "Palier ultime des 500 kilomètres atteint ! Félicitations Pilote Confirmé, un bonus massif vous a été versé.",
      );
    }
  },

  // Méthode générique pour payer les paliers
  processMilestoneReward: async function (
    milestoneId,
    kmLimit,
    referrerReward,
    refereeReward,
    voiceMessage,
  ) {
    // Verrou local pour éviter la boucle
    localStorage.setItem("referralMilestone", milestoneId.toString());

    if (typeof db !== "undefined" && window.session) {
      try {
        // Paiement Parrain
        await db.collection("referral_rewards").add({
          referrerId: localStorage.getItem("referredBy"),
          referredUser: window.session.uid,
          amount: referrerReward,
          reason: `Proof of Ride Milestone ${milestoneId} - ${kmLimit}km`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Paiement Filleul
        window.braveCoins = (window.braveCoins || 0) + refereeReward;
        localStorage.setItem("braveCoins", window.braveCoins.toString());

        if (typeof speak === "function") {
          speak(voiceMessage);
        }
      } catch (err) {
        console.error("mon50cc Referral Error:", err);
        // Rollback pour réessayer plus tard en cas de perte de réseau
        localStorage.setItem("referralMilestone", (milestoneId - 1).toString());
      }
    }
  },

  // 4. Bonus InsurTech (Revenus passifs sur Conduite Sécurisée)
  checkSafeDrivingBonus: async function (isSafeRide) {
    const referredBy = localStorage.getItem("referredBy");
    if (!referredBy || !isSafeRide) return; // Pas de parrain ou trajet dangereux

    if (typeof db !== "undefined" && window.session) {
      try {
        await db.collection("referral_rewards").add({
          referrerId: referredBy,
          referredUser: window.session.uid,
          amount: 5, // Petit bonus récurrent
          reason: "Safe Driving Passive Bonus",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Petit retour vocal optionnel pour le filleul
        if (typeof speak === "function") {
          speak(
            "Trajet parfait. Votre conduite prudente a rapporté un bonus à votre parrain !",
          );
        }
      } catch (err) {
        console.error("mon50cc SafeDriving Error:", err);
      }
    }
  },
};

// Auto-init at load
window.addEventListener("DOMContentLoaded", () => {
  window.ReferralManager.init();
});
