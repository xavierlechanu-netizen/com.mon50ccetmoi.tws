// --- GUARDIAN 50CC BOT v1.0 ---
// Le bot autonome qui surveille la communautÃ© mon50ccetmoi

window.GuardianBot = {
  name: "Guardian 50cc",
  status: "Active",

  // Surveillance en temps rÃ©el (Logique de filtrage)
  analyzeContent: function (type, data, author) {
    const isProfane = Moderation.isProfane(JSON.stringify(data));

    if (isProfane) {
      this.takeAction(type, author, "Langage inappropriÃ© dÃ©tectÃ©");
      return false;
    }

    return true;
  },

  takeAction: function (type, author, reason) {
    console.warn(
      `[${this.name}] ðŸš¨ LOGIQUE DE BAN : Action punitive contre ${author} pour ${reason} sur ${type}.`,
    );

    // Notification Admin
    if (typeof db !== "undefined") {
      db.collection("mod_logs").add({
        bot: this.name,
        target: author,
        action: "CENSURE_AUTO",
        reason: reason,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    alert(
      `[Guardian Bot] ðŸ¤– DÃ©solÃ© @${author}, ton contenu sur ${type} a Ã©tÃ© censurÃ© car il ne respecte pas les rÃ¨gles de la communautÃ©.`,
    );
  },

  // MÃ©thode pour scanner le Ticker Social (Moods) en temps rÃ©el
  monitorSocialTicker: function () {
    if (typeof db === "undefined") return;

    // Listener sur les derniers messages
    db.collection("moods")
      .orderBy("timestamp", "desc")
      .limit(1)
      .onSnapshot((snap) => {
        snap.forEach((doc) => {
          const m = doc.data();
          if (!this.analyzeContent("Humeur", m.text, m.username)) {
            // Si pas safe, on masque immÃ©diatement l'Ã©lÃ©ment DOM si possible
            const ticker = document.getElementById("ticker-text");
            if (ticker)
              ticker.textContent = "[Message censurÃ© par Guardian Bot ðŸ¤–]";
          }
        });
      });
  },
};

// Auto-start du bot
setTimeout(() => {
  GuardianBot.monitorSocialTicker();
}, 5000);
