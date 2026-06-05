/**
 * ⚖️ POCKET LAWYER - MODULE DE DÉFENSE JURIDIQUE
 * Analyse du stationnement (Code de la Route FR : R417-10 et R417-11)
 */

window.PocketLawyer = {
    isOpen: false,
    
    // Scénarios simulés pour l'environnement GPS actuel
    scenarios: [
        {
            type: "Trottoir (Large)",
            status: "TOLERANCE",
            icon: "fa-solid fa-scale-balanced",
            color: "#ffb703", // Orange
            law: "R417-10 (Très Gênant / Gênant)",
            verdict: "Stationnement techniquement interdit mais couramment toléré si le passage des piétons n'est pas entravé.",
            defense: "Plaidoirie : L'espace laissé libre (plus de 1m50) permet le passage des poussettes et PMR. Aucune entrave caractérisée. S'il y a amende (135€ ou 35€), vous pouvez invoquer l'absence de signalisation claire ou le manque de places 2RM.",
            letterTemplate: "Monsieur l'Officier du Ministère Public,\nJe conteste le PV n°XXX.\nLe stationnement de mon cyclomoteur ne constituait pas une entrave à la circulation piétonne (largeur libre > 1,50m) et palliait un manque avéré de stationnement 2RM dans ce secteur."
        },
        {
            type: "Place 2-Roues Motorisés",
            status: "AUTORISE",
            icon: "fa-solid fa-check-double",
            color: "#00e676", // Vert
            law: "R417-6 (Régulier)",
            verdict: "Vous êtes parfaitement en règle.",
            defense: "Plaidoirie : Véhicule stationné sur un emplacement dédié et matérialisé. Si la place est devenue payante (ex: Paris), assurez-vous d'avoir pris un ticket numérique ou le Pass 2RM.",
            letterTemplate: ""
        },
        {
            type: "Passage Piéton / Piste Cyclable",
            status: "INTERDIT",
            icon: "fa-solid fa-gavel",
            color: "#ff4d4d", // Rouge
            law: "R417-11 (Très Gênant)",
            verdict: "Stationnement strictement interdit. Risque de mise en fourrière immédiate et 135€ d'amende.",
            defense: "Plaidoirie : Difficilement contestable (mise en danger d'autrui). Seule option : vice de forme sur le PV (erreur de plaque, de rue ou de date).",
            letterTemplate: "Monsieur l'Officier,\nJe conteste ce PV sur la base d'un vice de forme caractérisé (erreur matérielle sur le lieu exact de l'infraction visé)."
        },
        {
            type: "Place Auto (Voiture)",
            status: "TOLERANCE",
            icon: "fa-solid fa-car",
            color: "#ffb703",
            law: "R417-10",
            verdict: "Toléré si vous payez le stationnement (si applicable). Attention à ne pas bloquer une voiture.",
            defense: "Plaidoirie : Le code de la route n'interdit pas aux 2RM de se garer sur les places voitures, mais c'est mal vu. En cas de stationnement payant, le reçu fait foi.",
            letterTemplate: ""
        }
    ],

    toggleLawyer: function() {
        if (this.isOpen) {
            this.closeLawyer();
        } else {
            this.openLawyer();
        }
    },

    openLawyer: function() {
        if (!window.Web4Economy) {
            alert("Erreur: Moteur Web4 introuvable.");
            return;
        }
        
        const price = window.Web4Economy.prices.legal_report || 5;
        if (window.Web4Economy.balance < price) {
            alert(`Fonds insuffisants ! Vous avez besoin de ${price} BVC pour accéder à l'Avocat de Poche. Roulez plus pour en gagner.`);
            return;
        }

        this.isOpen = true;
        let overlay = document.getElementById("lawyer-overlay");
        
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "lawyer-overlay";
            overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 15, 25, 0.95); z-index: 50000;
                display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
                padding-top: 50px; overflow-y: auto; color: #fff; font-family: 'Inter', sans-serif;
                backdrop-filter: blur(15px);
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = "flex";
        }

        overlay.innerHTML = `
            <button onclick="PocketLawyer.closeLawyer()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-scale-balanced fa-beat-fade" style="font-size: 4rem; color: #cca300; filter: drop-shadow(0 0 20px #cca300); margin-bottom: 10px;"></i>
            <h1 style="font-size: 2rem; margin: 0; text-transform: uppercase; color: #cca300;">Avocat de Poche</h1>
            <p style="color: #aaa; margin-bottom: 30px;">Analyse GPS de l'environnement légal...</p>
            
            <div id="lawyer-scanning" style="text-align: center; margin-top: 50px;">
                <div style="width: 60px; height: 60px; border: 4px solid #333; border-top-color: #cca300; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <p style="margin-top: 20px; color: #cca300;">Vérification des arrêtés municipaux en cours...</p>
            </div>
            
            <div id="lawyer-result" style="display: none; width: 90%; max-width: 500px; padding-bottom: 50px;"></div>
            
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .lawyer-card { background: rgba(255,255,255,0.05); border-radius: 20px; padding: 25px; margin-top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .lawyer-btn { padding: 15px 30px; border-radius: 30px; border: none; font-weight: bold; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; margin-top: 20px; }
            </style>
        `;

        // Simuler la recherche GPS (2 secondes)
        setTimeout(() => {
            const scanning = document.getElementById("lawyer-scanning");
            const result = document.getElementById("lawyer-result");
            if (scanning && result) {
                scanning.style.display = "none";
                
                // Sélectionner un scénario aléatoire pour la démo
                const scenario = this.scenarios[Math.floor(Math.random() * this.scenarios.length)];
                
                result.style.display = "block";
                result.innerHTML = `
                    <div class="lawyer-card" style="border: 1px solid ${scenario.color};">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <i class="${scenario.icon}" style="font-size: 2.5rem; color: ${scenario.color};"></i>
                            <div>
                                <h2 style="margin: 0; font-size: 1.5rem; color: ${scenario.color};">${scenario.status}</h2>
                                <p style="margin: 0; color: #ccc;">Environnement : ${scenario.type}</p>
                            </div>
                        </div>
                        <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 10px; border-left: 4px solid ${scenario.color}; margin-bottom: 20px;">
                            <strong style="color: #fff;"><i class="fa-solid fa-book-open"></i> ${scenario.law}</strong>
                            <p style="margin: 5px 0 0 0; color: #bbb; font-size: 0.95rem;">${scenario.verdict}</p>
                        </div>
                        
                        <h3 style="color: #fff; margin-bottom: 10px;"><i class="fa-solid fa-shield-halved"></i> Argumentaire de Défense</h3>
                        <p style="color: #ddd; font-style: italic; line-height: 1.5;">"${scenario.defense}"</p>
                        
                        ${scenario.letterTemplate ? `
                            <button class="lawyer-btn" style="background: linear-gradient(90deg, #cca300, #b38f00); color: #000;" onclick="PocketLawyer.generateLetter()">
                                <i class="fa-solid fa-file-signature"></i> Générer un recours juridique
                            </button>
                        ` : ''}
                    </div>
                `;
            }
        }, 2000);
    },

    closeLawyer: function() {
        this.isOpen = false;
        const overlay = document.getElementById("lawyer-overlay");
        if (overlay) overlay.style.display = "none";
    },

    generateLetter: function() {
        if (!window.Web4Economy) {
            alert("Erreur: Moteur Web4 introuvable.");
            return;
        }
        
        const price = window.Web4Economy.prices.legal_report;
        if (confirm(`Générer un recours juridique coûte ${price} BVC.\nVoulez-vous continuer ?`)) {
            if (window.Web4Economy.spendToken(price, "Avocat de Poche - Rapport Juridique")) {
                alert(`Paiement de ${price} BVC accepté.\n\nModèle de recours juridique copié dans le presse-papiers. Prêt à être envoyé à l'ANTAI.`);
            } else {
                alert(`Fonds insuffisants ! Vous avez besoin de ${price} BVC. Roulez plus pour gagner des BVC.`);
            }
        }
    }
};

console.log("[PocketLawyer] Module Avocat de Poche chargé.");
