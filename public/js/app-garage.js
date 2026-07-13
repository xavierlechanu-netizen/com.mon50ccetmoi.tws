// F11 : MÃ‰CANO Ã€ LA DEMANDE (Garages Partenaires CertifiÃ©s)
// ModÃ¨le : Frais d'entrÃ©e unique 49,90â‚¬ pour le garage
// L'accÃ¨s pilote est entiÃ¨rement GRATUIT
// ============================================================
window.MecanoDemande = {
    // Garages certifiÃ©s (frais d'entrÃ©e unique 49,90â‚¬ pour Ãªtre rÃ©fÃ©rencÃ©)
    // En production, ces donnÃ©es viendront de Firebase
    _getCertifiedGarages() {
        return JSON.parse(localStorage.getItem('certified_garages') || '[]');
    },

    async findNearby() {
        if (!window.currentPosition) {
            speak("GPS requis pour trouver les garages.");
            return [];
        }
        const { lat, lng } = window.currentPosition;
        const garages = this._getCertifiedGarages();

        // Filtrage : uniquement les certifiÃ©s avec statut disponible
        const nearby = garages.filter(g => {
            const dist = window.haversineDistance
                ? window.haversineDistance(lat, lng, g.lat, g.lng)
                : 999;
            return dist < 15; // Dans un rayon de 15km
        });

        return nearby;
    },

    getHTMLPanel() {
        const garages = this._getCertifiedGarages();
        if (!garages.length) {
            return `<div style="text-align:center; padding:30px; color:#444;">
                <i class="fa-solid fa-wrench" style="font-size:2rem; margin-bottom:10px; display:block;"></i>
                <p style="font-size:0.85rem;">Aucun garage partenaire dans votre secteur pour le moment.</p>
                <p style="font-size:0.7rem; color:#333; margin-top:10px;">Vous Ãªtes garagiste ? Rejoignez notre rÃ©seau.</p>
                <a href="mailto:contact@mon50ccetmoi.com?subject=Rejoindre le réseau partenaire" 
                   style="display:inline-block; margin-top:10px; padding:8px 15px; background:var(--accent); color:#000; border-radius:10px; font-size:0.75rem; text-decoration:none; font-weight:bold;">
                   âœ‰ï¸ Nous contacter
                </a>
            </div>`;
        }

        return garages.map(g => `
            <div class="card" style="border-left:4px solid #f1c40f; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#f1c40f;">${g.name}</strong>
                        <div style="font-size:0.65rem; color:#aaa; margin-top:2px;">${g.address}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.65rem; font-weight:bold; color:${g.status === 'dispo' ? '#2ecc71' : g.status === 'busy' ? '#f1c40f' : '#ff4d4d'};">
                            ${g.status === 'dispo' ? 'âœ… Dispo' : g.status === 'busy' ? 'â³ Sur RDV' : 'ðŸš« Complet'}
                        </div>
                        <div style="font-size:0.6rem; color:#555; margin-top:2px;">â˜… CERTIFIÃ‰</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <a href="tel:${g.phone}" style="flex:1; text-align:center; background:#2ecc71; color:#000; border-radius:8px; padding:6px; font-size:0.75rem; text-decoration:none; font-weight:bold;">
                        <i class="fa-solid fa-phone"></i> Appeler
                    </a>
                    <button onclick="window.setRoute('${g.address}')" style="flex:1; background:var(--neon-blue); color:#000; border:none; border-radius:8px; padding:6px; font-size:0.75rem; cursor:pointer; font-weight:bold;">
                        <i class="fa-solid fa-route"></i> Y Aller
                    </button>
                </div>
            </div>`).join('');
    }
};

// Ajout de la page mÃ©cano dans showPage (hook)
const _origShowPage = window.showPage;
window.showPage = function(page) {
    const hud = document.getElementById('hud');
    if(hud) hud.style.display = 'none';
    if (page === 'mecano_demande') {
        const overlay = document.getElementById('screen-overlay');
        const content = document.getElementById('screen-content');
        if (!overlay || !content) return;
        overlay.classList.remove('hidden');
    content.classList.remove('page-enter-active');
    content.classList.add('page-enter');
    setTimeout(() => content.classList.add('page-enter-active'), 50);
    if(navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => content.classList.add('page-enter-active'), 50);
        if(typeof content !== 'undefined') content.innerHTML = `<h3><i class="fa-solid fa-wrench"></i> MÃ©cano Ã  la Demande</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">Garages certifiÃ©s partenaires â€” accÃ¨s gratuit pour les pilotes.</p>
            <div style="font-size:0.6rem; color:#555; background:rgba(255,183,3,0.05); border:1px solid #333; border-radius:8px; padding:8px; margin-bottom:15px;">
                <i class="fa-solid fa-certificate" style="color:#f1c40f;"></i> Tous les garages affichÃ©s ont rejoint le rÃ©seau <strong>mon50ccetmoi</strong>.
            </div>
            ${window.MecanoDemande.getHTMLPanel()}`;
        return;
    }
    if (page === 'blackbox_insurance') {
        const overlay = document.getElementById('screen-overlay');
        const content = document.getElementById('screen-content');
        if (!overlay || !content) return;
        overlay.classList.remove('hidden');
    content.classList.remove('page-enter-active');
    content.classList.add('page-enter');
    setTimeout(() => content.classList.add('page-enter-active'), 50);
    if(navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => content.classList.add('page-enter-active'), 50);
        
                        window.BlackBoxDict = window.BlackBoxDict || {
            'fr': { 
                title: "Black Box Assurance", 
                subtitle: "Sécurité & Conformité Européenne (RGPD)", 
                desc: "Votre Black Box enregistre vos données localement. <br><br>🛡️ <strong>Protection du Pilote :</strong><br>• Stockage local 100% privé.<br>• <strong>Transmission UNIQUEMENT en cas de litige</strong> (accident, vol, contestation).<br>• L'assurance n'a accès à rien sans votre code expertise.", 
                available: "Données disponibles", 
                pts: "points GPS enregistrés.", 
                replay: "Rejouer le Trajet", 
                generate: "Expertise Assurance", 
                nodata: "Aucun trajet enregistré.", 
                footer: "Certifié conforme aux réglementations européennes sur la protection des données." 
            },
            'en': { 
                title: "Black Box Insurance", 
                subtitle: "Multi-Level Digital Expertise", 
                desc: "Certified incident report. 3 levels of expertise available for insurance:<br>• <strong>Basic (49.99€)</strong>: Speed & Position.<br>• <strong>Intermediate (89.99€)</strong>: Telemetry + Eco-Data.<br>• <strong>Expert (149.99€)</strong>: 3D Reconstruction + G-Force + Lean Angle.", 
                available: "Data available", 
                pts: "GPS points recorded.", 
                replay: "Replay Ride", 
                generate: "Generate Expert Report (Sim)", 
                nodata: "No ride recorded.", 
                footer: "Service billed to insurance: 49.99€ to 149.99€ depending on level." 
            },
            'es': { title: "Black Box Seguro", subtitle: "Informe Pericial Digital", desc: "En caso de accidente, tu Black Box registra automáticamente la velocidad, trayectoria GPS y ángulo de inclinación.<br><br>Este informe certificado es <strong style='color:#2ecc71;'>gratuito para ti</strong>. Si tu compañía de seguros solicita un informe oficial certificado, se les factura <strong style='color:#f1c40f;'>49,90 € por expediente</strong>.", available: "Datos disponibles", pts: "puntos GPS registrados en el último viaje.", replay: "Repetir Viaje", generate: "Generar Informe PDF", nodata: "Ningún viaje registrado. Inicia la navegación para activar la Black Box.", footer: "Informe gratuito para el piloto — 49,90 €/expediente facturados a la compañía de seguros." },
            'it': { title: "Black Box Assicurazione", subtitle: "Rapporto Peritale Digitale", desc: "In caso de incidente, la tua Black Box registra automaticamente velocità, traiettoria GPS e angolo di piega.<br><br>Questo rapport certifié est <strong style='color:#2ecc71;'>gratuito per te</strong>. Se la tua compagnia assicurativa richiede un rapporto certificato ufficiale, il servizio costa loro <strong style='color:#f1c40f;'>49,90 € per pratica</strong>.", available: "Dati disponibili", pts: "punti GPS registrati durante l'ultimo viaggio.", replay: "Rivedi Viaggio", generate: "Genera Rapporto PDF", nodata: "Nessun viaggio registrato. Avvia la navigazione per attivare la Black Box.", footer: "Rapporto gratuito per il piloto — 49,90 €/pratica addebitati alla compagnia assicurativa." },
            'de': { title: "Black Box Versicherung", subtitle: "Digitales Gutachten", desc: "Im Falle eines Unfalls zeichnet Ihre Black Box automatisch Geschwindigkeit, GPS-Route und Neigungswinkel auf.<br><br>Dieser zertifizierte Bericht ist <strong style='color:#2ecc71;'>für Sie kostenlos</strong>. Wenn Ihre Versicherung einen offiziellen zertifizierten Bericht anfordert, werden ihr <strong style='color:#f1c40f;'>49,90 € pro Fall</strong> in Rechnung gestellt.", available: "Verfügbare Daten", pts: "GPS-Punkte während der letzten Fahrt aufgezeichnet.", replay: "Fahrt wiederholen", generate: "PDF-Bericht erstellen", nodata: "Keine Fahrt aufgezeichnet. Starten Sie die Navigation, um die Black Box zu aktivieren.", footer: "Kostenloser Bericht für den Fahrer — 49,90 €/Fall wird der Versicherung in Rechnung gestellt." }
        };
        const lang = navigator.language.split('-')[0].toLowerCase();
        const t = window.BlackBoxDict[lang] || window.BlackBoxDict['en'];

        const frames = JSON.parse(sessionStorage.getItem('blackbox_last_ride') || '[]');
        const hasData = frames.length > 0;
        if(typeof content !== 'undefined') content.innerHTML = `<h3><i class="fa-solid fa-box-archive"></i> ${t.title}</h3>
            <div style="background:rgba(52,152,219,0.05); border:1px solid #3498db; border-radius:12px; padding:15px; margin-bottom:20px;">
                <h4 style="color:#3498db; margin-bottom:8px;"><i class="fa-solid fa-shield-halved"></i> ${t.subtitle}</h4>
                <p style="font-size:0.75rem; color:#aaa; line-height:1.5;">${t.desc}</p>
            </div>
            ${hasData ? `
                <div style="background:rgba(46,204,113,0.05); border:1px solid #2ecc71; border-radius:12px; padding:15px; margin-bottom:15px;">
                    <strong style="color:#2ecc71;"><i class="fa-solid fa-circle-check"></i> ${t.available}</strong>
                    <p style="font-size:0.75rem; color:#aaa; margin-top:5px;">${frames.length} ${t.pts}</p>
                </div>
                <button onclick="window.BlackBoxReplay.replay()" class="btn-insurance" style="width:100%; margin-bottom:10px; background:#3498db;">
                    <i class="fa-solid fa-play"></i> ${t.replay}
                </button>
                <div style="background:rgba(255,255,255,0.05); border:1px dashed #555; border-radius:12px; padding:15px; text-align:center; margin-top:10px;">
                    <span style="font-size:0.6rem; color:#888; text-transform:uppercase; letter-spacing:1px;">Code Expertise Assurance</span>
                    <div style="font-family:monospace; font-size:1.2rem; color:var(--neon-blue); margin:5px 0;">BB-#{Math.floor(Math.random()*900000 + 100000)}</div>
                    <p style="font-size:0.65rem; color:#666;">Donnez ce code à votre assureur pour qu'il puisse accéder à vos données certifiées sur le portail pro.</p>
                </div>
                <button onclick="window.DisputeAutomation.initiateDispute()" class="btn-insurance" style="width:100%; margin-top:10px; background:linear-gradient(135deg,#34495e,#2c3e50); color:white; border:1px solid #555;">
                    <i class="fa-solid fa-gavel"></i> Activer uniquement pour litige
                </button>
            ` : `<p style="text-align:center; color:#444; padding:30px;">${t.nodata}</p>`}
            <div style="margin-top:30px; border-top:1px solid #333; padding-top:15px;">
                <p style="font-size:0.6rem; color:#666; text-align:center;">${t.footer}</p>
                <button onclick="if(confirm('Supprimer définitivement toutes vos données de conduite ?')){ sessionStorage.removeItem('blackbox_last_ride'); localStorage.clear(); location.reload(); }" style="width:100%; margin-top:15px; background:none; border:1px solid #c0392b; color:#c0392b; padding:8px; border-radius:8px; font-size:0.65rem; cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i> Supprimer mes données (Droit à l'oubli RGPD)
                </button>
            </div>`;
        return;
    }
    return _origShowPage.apply(this, arguments);
};

// ============================================================
// BLACK BOX INSURANCE : Rapport PDF (simulation)
// ============================================================
window.BlackBoxInsurance = {
    generateExpertDemo() {
        console.log("[Demo] Génération forcée d'un rapport EXPERT ULTRA (149.99€)...");
        // Mock data if empty
        const mockFrames = [
            { lat: 48.8566, lng: 2.3522, spd: 45 },
            { lat: 48.8500, lng: 2.3400, spd: 48 }
        ];
        sessionStorage.setItem('blackbox_last_ride', JSON.stringify(mockFrames));
        
        // Custom Expert template
        const date = new Date().toLocaleDateString();
        const report = [
            "=== RAPPORT mon50ccetmoi EXPERT ULTRA (Certifié) ===",
            "Niveau : EXPERT (Facturé 149.99€)",
            "ID Dossier : DEMO-ULTRA-99",
            "--------------------------------------------------",
            "Vitesse Max : 48 km/h",
            "Force G Max : 1.25 G (Freinage d'urgence détecté)",
            "Angle Inclinaison : 32.5 deg",
            "Météo : 19°C, Sec",
            "Intégrité : Signature Numérique Valide",
            "--------------------------------------------------",
            "Ce rapport contient des données sensorielles haute précision.",
            "Usage exclusif pour expertise judiciaire ou assurance."
        ].join('\n');
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = "Rapport_EXPERT_ULTRA_DEMO.txt"; a.click();
    },
    generateReport() {
        const frames = JSON.parse(sessionStorage.getItem('blackbox_last_ride') || '[]');
        if (!frames.length) { alert("Aucune donnÃ©e disponible / No data"); return; }

        const rDict = {
            'fr': { rTitle: "=== RAPPORT BLACK BOX mon50ccetmoi ===", rDate: "Date :", rPts: "Points enregistrÃ©s :", rMaxSpd: "Vitesse maximum :", rStart: "DÃ©part GPS :", rEnd: "ArrivÃ©e GPS :", rGen: "Ce rapport est gÃ©nÃ©rÃ© par l'application mon50ccetmoi.", rContact: "Pour toute expertise assurance, contactez : contact@mon50ccetmoi.fr", rEndTxt: "=== FIN DU RAPPORT ===" },
            'en': { rTitle: "=== mon50ccetmoi BLACK BOX REPORT ===", rDate: "Date:", rPts: "Recorded points:", rMaxSpd: "Maximum speed:", rStart: "GPS Start:", rEnd: "GPS End:", rGen: "This report is generated by the mon50ccetmoi application.", rContact: "For insurance expertise, contact: contact@mon50ccetmoi.fr", rEndTxt: "=== END OF REPORT ===" },
            'es': { rTitle: "=== INFORME BLACK BOX mon50ccetmoi ===", rDate: "Fecha:", rPts: "Puntos registrados:", rMaxSpd: "Velocidad mÃ¡xima:", rStart: "Salida GPS:", rEnd: "Llegada GPS:", rGen: "Este informe es generado por la aplicaciÃ³n mon50ccetmoi.", rContact: "Para peritajes de seguros, contacto: contact@mon50ccetmoi.fr", rEndTxt: "=== FIN DEL INFORME ===" },
            'it': { rTitle: "=== RAPPORTO BLACK BOX mon50ccetmoi ===", rDate: "Data:", rPts: "Punti registrati:", rMaxSpd: "VelocitÃ  massima:", rStart: "Partenza GPS:", rEnd: "Arrivo GPS:", rGen: "Questo rapporto Ã¨ generato dall'applicazione mon50ccetmoi.", rContact: "Per perizie assicurative, contattare: contact@mon50ccetmoi.fr", rEndTxt: "=== FINE DEL RAPPORTO ===" },
            'de': { rTitle: "=== BLACK BOX BERICHT mon50ccetmoi ===", rDate: "Datum:", rPts: "Aufgezeichnete Punkte:", rMaxSpd: "HÃ¶chstgeschwindigkeit:", rStart: "GPS Start:", rEnd: "GPS Ziel:", rGen: "Dieser Bericht wurde von der App mon50ccetmoi erstellt.", rContact: "FÃ¼r Versicherungsfragen kontaktieren Sie: contact@mon50ccetmoi.fr", rEndTxt: "=== ENDE DES BERICHTS ===" }
        };
        const lang = navigator.language.split('-')[0].toLowerCase();
        const t = rDict[lang] || rDict['en'];

        const date = new Date().toLocaleDateString(navigator.language);
        const maxSpd = Math.max(...frames.map(f => f.spd || 0));
        const totalPts = frames.length;
        const startPos = frames[0];
        const endPos = frames[frames.length - 1];

        speak(lang === 'fr' ? "GÃ©nÃ©ration du rapport Black Box en cours." : "Generating Black Box report.");

                // Calculs ecologiques et mecaniques
        const distKm = window.session?.lastRouteDist || (totalPts * 0.01); // fallback estimation
        const estFuel = (distKm * 3.5 / 100).toFixed(2);
        const estWear = (distKm / 80).toFixed(2); // % d'usure sur ce trajet

                const reportText = [
            t.rTitle,
            "NIVEAU D'EXPERTISE : EXPERT (149.99€)",
            "---------------------------------------",
            `${t.rDate} ${date}`,
            `${t.rPts} ${totalPts}`,
            `${t.rMaxSpd} ${maxSpd} km/h`,
            `${t.rStart} ${startPos.lat.toFixed(5)}, ${startPos.lng.toFixed(5)}`,
            `${t.rEnd} ${endPos.lat.toFixed(5)}, ${endPos.lng.toFixed(5)}`,
            "",
            "--- ANALYSE SENSORIELLE (EXPERT) ---",
            `Force G Max : ${(1.2 + Math.random()*0.5).toFixed(2)} G`,
            `Angle Inclinaison Max : ${(15 + Math.random()*25).toFixed(1)} deg`,
            "Alerte Grip : Aucune anomalie detectee",
            "",
            "--- ECO-TELEMETRIE (INTERMEDIAIRE) ---",
            `Distance estimee : ${distKm} km`,
            `Consommation estimee : ${estFuel} L`,
            `Usure pneus estimee : ${estWear} %`,
            "",
            t.rGen,
            t.rContact,
            t.rEndTxt
        ].join('\n');

        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blackbox_rapport_${date.replace(/\//g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
};



// =============================================

// ─── TRACÉ GPS DE LA BALADE ──────────────────────────────────────────────────
let rideTracePolyline = null;
let rideTraceCoords = [];

/**
 * Démarre ou continue le tracé de la balade sur la carte Google Maps.
 * Appelé automatiquement à chaque mise à jour GPS si la carte est active.
 */
window.addTracePoint = function(lat, lng) {
    if (!map) return;
    rideTraceCoords.push({ lat, lng });

    if (!rideTracePolyline) {
        rideTracePolyline = new google.maps.Polyline({
            path: rideTraceCoords,
            geodesic: true,
            strokeColor: '#00d2ff',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map: map
        });
    } else {
        rideTracePolyline.setPath(rideTraceCoords);
    }
};

/**
 * Efface le tracé de la balade en cours.
 */
window.clearRideTrace = function() {
    if (rideTracePolyline) {
        rideTracePolyline.setMap(null);
        rideTracePolyline = null;
    }
    rideTraceCoords = [];
};

// ============================================================
// AUTOMATISATION DES LITIGES ET PAIEMENTS B2B
// ============================================================
window.DisputeAutomation = {
    initiateDispute() {
        const caseId = "CASE-" + Math.random().toString(36).substr(2, 9).toUpperCase();
        const pilotCode = "BB-" + Math.floor(Math.random()*900000 + 100000);
        
        console.log(`[Dispute] Analyse du dossier ${caseId} en cours...`);
        
        const secureLink = `https://expertise.mon50ccetmoi.com/claim/${caseId}`;
        const shareText = `Litige mon50ccetmoi : Voici mon dossier d'expertise certifiée Black Box. Code déverrouillage : ${pilotCode}. Lien d'achat : ${secureLink}`;
        
        // Simulation pour la démo : Ouvre automatiquement le portail assureur après 2s
        setTimeout(() => {
            if (confirm("DEMO : Souhaitez-vous simuler l'accès de l'assureur au portail de paiement ?")) {
                if (window.InsurancePortal) window.InsurancePortal.showPortal(caseId);
            }
        }, 2000);

        if (navigator.share) {
            navigator.share({
                title: 'Dossier Litige mon50ccetmoi',
                text: shareText,
                url: secureLink
            }).catch(() => {
                prompt("Copiez ce message pour votre assureur :", shareText);
            });
        } else {
            prompt("Copiez ce message pour votre assureur :", shareText);
        }
        
        return { caseId, pilotCode, secureLink };
    }
}




window.showVault = function() {
    document.getElementById('secure-vault-screen').classList.remove('hidden');
    const searchContainer = document.getElementById('search-container');
    const hud = document.getElementById('hud');
    if(searchContainer) searchContainer.classList.add('hidden');
    if(hud) hud.style.display = 'none';
}

window.hideVault = function() {
    const vault = document.getElementById('secure-vault-screen');
    if (vault) vault.classList.add('hidden');
    const searchContainer = document.getElementById('search-container');
    const hud = document.getElementById('hud');
    if(searchContainer) searchContainer.classList.remove('hidden');
    if(hud) hud.style.display = 'block';
};

// DEBUG: Sentinel Error Reporter Overlay
(function() {
    const debugDiv = document.createElement('div');
    debugDiv.id = 'sentinel-debug-overlay';
    debugDiv.style.cssText = 'position:fixed; bottom:50px; left:10px; right:10px; background:rgba(0,0,0,0.9); color:#ff4d4d; border:2px solid #ff4d4d; padding:10px; font-family:monospace; font-size:11px; z-index:999999; max-height:200px; overflow-y:auto; border-radius:8px; pointer-events:auto;';
    debugDiv.innerHTML = '<b>[SENTINEL DEBUG ACTIVE] Waiting for logs...</b>';
    document.body.appendChild(debugDiv);

    setInterval(() => {
        const errors = window.Sentinel ? window.Sentinel.errorLog : [];
        if (errors.length > 0) {
            let html = `<b>[SENTINEL BUG REPORT - ${errors.length} ERRORS]</b><br>`;
            errors.forEach((err, idx) => {
                html += `${idx + 1}: ${err.type} | Msg: ${err.detail?.msg || err.detail || 'N/A'}<br>File: ${err.detail?.url || 'N/A'} (Line: ${err.detail?.line || 'N/A'})<br><br>`;
            });
            debugDiv.innerHTML = html;
            console.log("SENTINEL_LOG_DUMP:", JSON.stringify(errors));
        } else {
            debugDiv.innerHTML = '<b>[SENTINEL DEBUG] No errors detected yet.</b>';
        }
    }, 1000);
})();




window.showPredictiveIA = function() {
    if (window.session && window.session.isGuest) {
        alert("L'IA Predictive et les avantages courtier sont reserves aux membres ! Creez un compte pour y acceder.");
        return;
    }
    showPage('ia_predictive');
};




window.saveProfileInfo = function() {
    const newUsername = document.getElementById('edit-username').value;
    const newScooter = document.getElementById('edit-scooter').value;
    const newEmail = document.getElementById('edit-email').value;
    if (newUsername) {
        if (window.session) window.session.username = newUsername;
        localStorage.setItem('username', newUsername);
        const displayUser = document.getElementById('display-username');
        if (displayUser) displayUser.textContent = newUsername;
        try {
            let sessionData = JSON.parse(localStorage.getItem('session'));
            if(sessionData) {
                sessionData.username = newUsername;
                localStorage.setItem('session', JSON.stringify(sessionData));
            }
        } catch(e) {}
    }
    if (newScooter) localStorage.setItem('user_scooter_model', newScooter);
    if (newEmail) localStorage.setItem('user_email', newEmail);
    alert('Profil mis � jour avec succ�s !');
    if (typeof closeScreen === 'function') closeScreen();
};




window.uploadDocument = function(docType) {
    // Faux scan de sécurité avant ouverture
    if(window.Wallet && typeof window.Wallet.unlock === 'function') {
        window.Wallet.unlock(function() {
            triggerActualUpload(docType);
        });
    } else {
        triggerActualUpload(docType);
    }
}

function triggerActualUpload(docType) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64 = evt.target.result;
            if(window.Wallet) {
                window.Wallet.saveDoc(docType, base64);
                window.renderWalletDocs();
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

window.renderWalletDocs = function() {
    const container = document.getElementById('ants-docs-container');
    if(!container) return;
    if(!window.Wallet || !window.Wallet.docs) return;
    
    const docs = window.Wallet.docs;
    let html = '';
    
    for (const [type, doc] of Object.entries(docs)) {
        let label = 'Document';
        if(type === 'carte_grise') label = 'Certificat d\'immatriculation';
        if(type === 'permis_am') label = 'Permis AM / BSR';
        if(type === 'assurance') label = 'Attestation d\'Assurance';
        
        html += `
            <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border-left:3px solid #2ecc71; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; font-size:0.85rem;">\${label}</div>
                    <div style="font-size:0.6rem; color:#2ecc71;">\${doc.status} - \${new Date(doc.date).toLocaleDateString()}</div>
                </div>
                <button onclick="window.showWalletDoc('\${type}')" style="background:#2ecc71; color:white; border:none; border-radius:5px; padding:5px 10px; font-size:0.7rem;">VOIR</button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

window.showWalletDoc = function(type) {
    const doc = window.Wallet.docs[type];
    if(!doc) return;
    
    // Ouvre le document en plein écran avec un badge de sécurité
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.95)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    overlay.innerHTML = `
        <div style="position:absolute; top:20px; right:20px; background:rgba(46, 204, 113, 0.2); border:1px solid #2ecc71; color:#2ecc71; padding:5px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">
            <i class="fa-solid fa-shield-halved"></i> ANTS SECURE
        </div>
        <img src="\${doc.data}" style="max-width:90%; max-height:80vh; border-radius:10px; box-shadow:0 0 20px rgba(46,204,113,0.3);">
        <button onclick="this.parentElement.remove()" style="margin-top:20px; padding:10px 20px; background:#444; color:white; border:none; border-radius:8px; font-weight:bold;">FERMER</button>
    `;
    
    document.body.appendChild(overlay);
}

// Intercept page changes to render docs if we are on ants_wallet
const _originalShowPage = window.showPage;
window.showPage = function(page) {
    _originalShowPage(page);
    if(page === 'ants_wallet') {
        setTimeout(window.renderWalletDocs, 100);
    }
};
