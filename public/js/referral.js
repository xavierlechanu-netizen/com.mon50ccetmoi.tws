/**
 * REFERRAL SYSTEM (Parrainage GamifiÃ© & InsurTech)
 * Paliers de kilomÃ©trage et revenus passifs sur conduite sÃ©curisÃ©e.
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
        localStorage.setItem("referralMilestone", "0"); // Nouveau systÃ¨me de suivi (0 = aucun palier)

        if (typeof speak === "function") {
          speak(
            "Lien de parrainage dÃ©tectÃ©. Roulez pour dÃ©bloquer vos premiÃ¨res rÃ©compenses !",
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

    // Si l'utilisateur a un pseudo dÃ©fini, on l'utilise, sinon on prend l'UID
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
        console.warn("Partage annulÃ© ou erreur", err);
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        alert("Lien de parrainage copiÃ© dans le presse-papiers !");
      });
    }
  },

  // 3. VÃ©rification des Paliers (Milestones)
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
        "FÃ©licitations, vous avez dÃ©passÃ© les 20 kilomÃ¨tres. Votre parrain reÃ§oit 50 BVC, et vous gagnez 20 BVC !",
      );
    }
    // Palier 2 : 100 km (Motard FidÃ¨le)
    else if (totalKm >= 100 && currentMilestone < 2) {
      await this.processMilestoneReward(
        2,
        100,
        100,
        50,
        "Incroyable, 100 kilomÃ¨tres atteints ! Vous Ãªtes maintenant un Motard FidÃ¨le. 50 BVC dÃ©bloquÃ©s.",
      );
    }
    // Palier 3 : 500 km (Pilote ConfirmÃ©)
    else if (totalKm >= 500 && currentMilestone < 3) {
      await this.processMilestoneReward(
        3,
        500,
        300,
        200,
        "Palier ultime des 500 kilomÃ¨tres atteint ! FÃ©licitations Pilote ConfirmÃ©, un bonus massif vous a Ã©tÃ© versÃ©.",
      );
    }
  },

  // MÃ©thode gÃ©nÃ©rique pour payer les paliers
  processMilestoneReward: async function (
    milestoneId,
    kmLimit,
    referrerReward,
    refereeReward,
    voiceMessage,
  ) {
    // Verrou local pour Ã©viter la boucle
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
        // Rollback pour rÃ©essayer plus tard en cas de perte de rÃ©seau
        localStorage.setItem("referralMilestone", (milestoneId - 1).toString());
      }
    }
  },

  // 4. Bonus InsurTech (Revenus passifs sur Conduite SÃ©curisÃ©e)
  checkSafeDrivingBonus: async function (isSafeRide) {
    const referredBy = localStorage.getItem("referredBy");
    if (!referredBy || !isSafeRide) return; // Pas de parrain ou trajet dangereux

    if (typeof db !== "undefined" && window.session) {
      try {
        await db.collection("referral_rewards").add({
          referrerId: referredBy,
          referredUser: window.session.uid,
          amount: 5, // Petit bonus rÃ©current
          reason: "Safe Driving Passive Bonus",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Petit retour vocal optionnel pour le filleul
        if (typeof speak === "function") {
          speak(
            "Trajet parfait. Votre conduite prudente a rapportÃ© un bonus Ã  votre parrain !",
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
