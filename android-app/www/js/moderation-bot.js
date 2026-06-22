// --- GUARDIAN 50CC BOT v1.0 ---
// Le bot autonome qui surveille la communauté mon50ccetmoi

window.GuardianBot = {
    name: "Guardian 50cc",
    status: "Active",

    // Surveillance en temps réel (Logique de filtrage)
    analyzeContent: function(type, data, author) {
        console.log(`[${this.name}] 🤖 Analyse de ${type} par ${author}...`);

        const isProfane = Moderation.isProfane(JSON.stringify(data));
        
        if (isProfane) {
            this.takeAction(type, author, "Langage inapproprié détecté");
            return false;
        }
        
        console.log(`[${this.name}] ✅ Contenu validé.`);
        return true;
    },

    takeAction: function(type, author, reason) {
        console.warn(`[${this.name}] 🚨 LOGIQUE DE BAN : Action punitive contre ${author} pour ${reason} sur ${type}.`);
        
        // Notification Admin
        if (typeof db !== "undefined") {
            db.collection("mod_logs").add({
                bot: this.name,
                target: author,
                action: "CENSURE_AUTO",
                reason: reason,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        alert(`[Guardian Bot] 🤖 Désolé @${author}, ton contenu sur ${type} a été censuré car il ne respecte pas les règles de la communauté.`);
    },

    // Méthode pour scanner le Ticker Social (Moods) en temps réel
    monitorSocialTicker: function() {
        if (typeof db === "undefined") return;
        
        // Listener sur les derniers messages
        db.collection("moods").orderBy("timestamp", "desc").limit(1).onSnapshot(snap => {
            snap.forEach(doc => {
                const m = doc.data();
                if (!this.analyzeContent("Humeur", m.text, m.username)) {
                    // Si pas safe, on masque immédiatement l'élément DOM si possible
                    const ticker = document.getElementById('ticker-text');
                    if(ticker) ticker.textContent = "[Message censuré par Guardian Bot 🤖]";
                }
            });
        });
    }
};

// Auto-start du bot
setTimeout(() => {
    GuardianBot.monitorSocialTicker();
}, 5000);
