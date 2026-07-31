/**
 * Insurance Scanner (Document AI)
 * Simule l'upload d'un contrat PDF et l'analyse par Jarvis Gemini
 */

window.InsuranceScanner = {
    isScanning: false,

    startScan: async function() {
        if (this.isScanning) return;
        this.isScanning = true;

        const zone = document.getElementById("contract-upload-zone");
        const resultZone = document.getElementById("contract-scan-result");
        const content = document.getElementById("contract-scan-content");

        if (!zone || !resultZone || !content) return;

        // UI: Scanning State
        zone.innerHTML = `
            <i class="fa-solid fa-radar fa-spin" style="font-size: 2.5rem; color: #00f2ff; margin-bottom: 10px;"></i>
            <div style="font-weight: bold; color: #fff;">Analyse du contrat en cours...</div>
            <div style="font-size: 0.8rem; color: #00f2ff; margin-top: 5px;">Extraction des clauses juridiques</div>
        `;
        zone.style.borderColor = "#00f2ff";
        resultZone.style.display = "none";

        try {
            // Mock d'un contrat d'assurance brut
            const mockContractText = `
                CONTRAT D'ASSURANCE AUTO/MOTO - N° 45892-A
                Conditions Particulières.
                Véhicule: Scooter 50cc Peugeot.
                Formule: Tiers Étendu.
                - Responsabilité Civile: Couverte.
                - Vol et Incendie: Couvert (Franchise 150€).
                - Bris de Glace: Non couvert.
                - Dommages tous accidents: Non couvert.
                - Assistance Panne: 0 km (sans franchise kilométrique).
                - Prêt de véhicule: Oui, 7 jours max.
            `;

            // Prompt précis pour forcer Gemini à sortir un bon résumé
            const prompt = `Voici un texte extrait d'un PDF de contrat d'assurance. Résume ce qui est couvert, ce qui ne l'est pas, la franchise principale et l'assistance. Fais-le sous forme de liste avec des emojis (✅ pour couvert, ❌ pour non couvert, 💰 pour franchise, 🆘 pour assistance). Formate la réponse proprement.
            Texte : "${mockContractText}"`;

            // Appel à l'IA
            if (!window.JarvisGemini) throw new Error("JarvisGemini non chargé");
            const response = await window.JarvisGemini.ask(prompt);

            // Formatage de la réponse (remplacer les sauts de ligne par des <br>)
            const formattedReply = response.reply.replace(/\n/g, "<br>");

            // UI: Success State
            zone.innerHTML = `
                <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: #0f0; margin-bottom: 10px;"></i>
                <div style="font-weight: bold; color: #fff;">Analyse Terminée</div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">Cliquez pour scanner un autre document</div>
            `;
            zone.style.borderColor = "rgba(0, 242, 255, 0.5)";
            
            content.innerHTML = formattedReply;
            resultZone.style.display = "block";
            
        } catch (error) {
            console.error("Scanner Error:", error);
            zone.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: #ff4444; margin-bottom: 10px;"></i>
                <div style="font-weight: bold; color: #ff4444;">Erreur d'analyse</div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">Impossible de joindre le cloud AI. Réessayez.</div>
            `;
            zone.style.borderColor = "#ff4444";
        } finally {
            this.isScanning = false;
        }
    }
};
