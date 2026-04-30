/**
 * INSURANCE EXPERT PORTAL v1.0
 * Monetization module for Blackbox telemetry reports.
 */

window.InsurancePortal = {
    reportPrice: 49.90,

    init: function() {
        console.log("Portail Assureur : Opérationnel.");
    },

    // Vérifier l'existence d'un rapport et afficher l'aperçu
    searchReport: async function(reportId) {
        if (!reportId) return;
        
        speak("Recherche du dossier d'expertise en cours.");
        
        try {
            const doc = await db.collection("blackbox_reports").doc(reportId).get();
            if (!doc.exists) {
                alert("Dossier introuvable. Vérifiez l'ID fourni par votre assuré.");
                return;
            }

            const data = doc.data();
            this.showPreview(reportId, data);
        } catch (e) { console.error("Search Fail:", e); }
    },

    showPreview: function(id, data) {
        const portal = document.getElementById('insurance-content');
        portal.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border:1px solid #ffb703;">
                <h4 style="color:#ffb703;"><i class="fa-solid fa-file-contract"></i> Expertise de Responsabilité (Dossier ${id})</h4>
                <p><strong>Assuré :</strong> ${data.username}</p>
                <p><strong>Date du Litige :</strong> ${new Date(data.timestamp.toDate()).toLocaleString()}</p>
                <div style="background:rgba(255,183,3,0.1); padding:10px; border-radius:5px; font-size:0.8rem; border:1px solid #ffb703; margin:10px 0;">
                    <i class="fa-solid fa-circle-info"></i> Ce rapport contient les données télémétriques certifiées permettant de déterminer les responsabilités en cas d'accident (Vitesse, G-Force, Angle au moment du choc).
                </div>
                <hr style="border:0.5px solid #333;">
                <div style="background:rgba(0,0,0,0.5); padding:15px; border-radius:10px; filter:blur(4px); user-select:none;">
                    <p>Vitesse au moment du choc : XX km/h</p>
                    <p>Inclinaison : XX.X°</p>
                    <p>Force G détectée : X.XX G</p>
                </div>
                <div style="text-align:center; margin-top:20px;">
                    <p style="font-size:1.2rem; font-weight:bold;">Accès au dossier de litige : ${this.reportPrice}€</p>
                    <button class="btn-insurance" onclick="InsurancePortal.processPayment('${id}')" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-credit-card"></i> DÉBLOQUER LES PREUVES
                    </button>
                    <p style="font-size:0.7rem; color:#888; margin-top:10px;">Le déblocage permet l'accès définitif au rapport d'expertise pour ce dossier de sinistre.</p>
                </div>
            </div>
        `;
    },

    processPayment: function(id) {
        speak("Initialisation de la transaction sécurisée.");
        // Simulation de paiement
        const btn = event.target;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Traitement...`;
        
        setTimeout(async () => {
            speak("Paiement validé. Dossier débloqué.");
            this.unlockReport(id);
        }, 2000);
    },

    unlockReport: async function(id) {
        const doc = await db.collection("blackbox_reports").doc(id).get();
        const data = doc.data();
        const portal = document.getElementById('insurance-content');
        
        portal.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border:1px solid #2ecc71;">
                <h4 style="color:#2ecc71;"><i class="fa-solid fa-check-double"></i> RAPPORT DÉBLOQUÉ</h4>
                <div style="background:#111; padding:15px; border-radius:10px; margin-top:10px; font-family:monospace; font-size:0.8rem; overflow-y:auto; max-height:300px;">
                    <p style="color:#2ecc71;">--- CERTIFICAT D'EXPERTISE mon50ccetmoi ---</p>
                    <p>ID Dossier: ${id}</p>
                    <p>Horodatage: ${new Date(data.timestamp.toDate()).toISOString()}</p>
                    <hr>
                    ${data.data.map(e => `[${new Date(e.ts).toLocaleTimeString()}] Vitesse: ${e.speed} km/h | Incl: ${e.lean}° | Statut: ${e.status}`).join('<br>')}
                </div>
                <button class="btn-insurance" onclick="window.print()" style="margin-top:15px; width:100%; background:#333; color:white; border:none; padding:10px; border-radius:5px;">
                    <i class="fa-solid fa-download"></i> TÉLÉCHARGER LE RAPPORT (PDF)
                </button>
            </div>
        `;
    }
};
