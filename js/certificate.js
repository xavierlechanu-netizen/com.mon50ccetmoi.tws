/**
 * DIGITAL COMPLIANCE CERTIFICATE v1.0
 * Official report generator for ANTS and Insurers.
 */

window.Certificate = {
    generate: function() {
        if (window.session.isGuest) {
            alert("🔒 Le Certificat Officiel est réservé aux membres inscrits.");
            return;
        }

        speak("Génération de votre Certificat de Conformité Digital. Analyse des données de bord en cours.");
        
        const passport = Wallet.getSafetyPassport();
        const scanResult = localStorage.getItem('last_engine_scan') || 'NON EFFECTUÉ';
        const certId = "CERT-" + Math.random().toString(36).substr(2, 9).toUpperCase();

        const overlay = document.createElement('div');
        overlay.id = "cert-overlay";
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; z-index:30000; background:#fff; color:#000; padding:40px; font-family:'Courier New', Courier, monospace; overflow-y:auto;";
        
        overlay.innerHTML = `
            <div style="border:4px double #000; padding:30px; max-width:800px; margin:auto; position:relative;">
                <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:20px; margin-bottom:30px;">
                    <h1 style="margin:0; font-size:1.5rem;">CERTIFICAT DE CONFORMITÉ DIGITALE</h1>
                    <p style="font-size:0.8rem;">Émis par le système mon50ccetmoi Interceptor V26</p>
                </div>

                <div style="margin-bottom:30px;">
                    <p><strong>N° CERTIFICAT :</strong> ${certId}</p>
                    <p><strong>DÉTENTEUR :</strong> ${window.session.username || 'Utilisateur Anonyme'}</p>
                    <p><strong>DATE D'ÉMISSION :</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <h3 style="border-bottom:1px solid #000;">1. ANALYSE MÉCANIQUE (AI ENGINE PULSE)</h3>
                <p>Statut Vibratoire : <strong>${passport.engine_health}</strong></p>
                <p>Dernier Scan : ${scanResult}</p>

                <h3 style="border-bottom:1px solid #000; margin-top:30px;">2. SÉCURITÉ & TÉLÉMÉTRIE (BLACKBOX)</h3>
                <p>Système Blackbox : <strong>ACTIF & SÉCURISÉ</strong></p>
                <p>ID Dispositif : ${passport.blackbox_id}</p>
                <p>Vitesse Max Enregistrée : ${passport.vMax_History} km/h</p>

                <h3 style="border-bottom:1px solid #000; margin-top:30px;">3. MAINTENANCE & ENTRETIEN</h3>
                <p>Nombre d'interventions tracées : ${passport.maintenance_count}</p>
                <p>Statut : CONFORME</p>

                <div style="margin-top:50px; display:flex; justify-content:space-between; align-items:flex-end;">
                    <div style="text-align:center;">
                        <div style="width:100px; height:100px; background:#000; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:0.6rem;">QR CODE CERTIFIÉ</div>
                        <p style="font-size:0.6rem; margin-top:5px;">VÉRIFICATION ANTS</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:0.8rem; font-style:italic;">Signature Numérique mon50ccetmoi</p>
                        <div style="font-family:'Brush Script MT', cursive; font-size:1.5rem;">Netizen AI OS</div>
                    </div>
                </div>

                <button onclick="window.print()" style="margin-top:40px; width:100%; padding:15px; background:#000; color:#fff; border:none; cursor:pointer; font-weight:bold;">IMPRIMER / EXPORTER (PDF)</button>
                <button onclick="document.getElementById('cert-overlay').remove()" style="margin-top:10px; width:100%; padding:10px; background:transparent; color:#888; border:none; cursor:pointer; font-size:0.8rem;">RETOUR À L'APPLICATION</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }
};
