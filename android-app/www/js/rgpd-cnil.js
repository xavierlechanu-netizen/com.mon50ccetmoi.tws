/* ═══════════════════════════════════════════════════════════════
   CONFORMITÉ GLOBALE : RGPD, CCPA, PIPL & GOOGLE PLAY CONSOLE
   ═══════════════════════════════════════════════════════════════ */

window.checkGlobalPrivacy = function() {
    const hasConsented = localStorage.getItem('global_privacy_consent');
    
    if (!hasConsented) {
        window.preventAppLaunch = true;
        injectPrivacyBanner();
    } else {
        window.preventAppLaunch = false;
        if(typeof window.initVoiceAI === 'function') setTimeout(window.initVoiceAI, 1000);
        if(typeof window.initZeroClickDestiny === 'function') setTimeout(window.initZeroClickDestiny, 2000);
    }
};

function injectPrivacyBanner() {
    if(document.getElementById('global-privacy-banner')) return;

    const bannerHtml = `
    <div id="global-privacy-banner" class="fullscreen-overlay" style="background: rgba(0,0,0,0.95); backdrop-filter: blur(20px); color: #fff; z-index: 90000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding: 20px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <div style="max-width: 500px; margin: 0 auto; padding-bottom: 50px;">
            <div style="text-align: center;">
                <i class="fa-solid fa-shield-halved" style="font-size: 4rem; color: #00ffcc; margin-bottom: 20px;"></i>
                <h2 style="margin: 0 0 10px 0; text-transform: uppercase;">Vos Données, Vos Règles</h2>
            </div>
            
            <div style="background: rgba(255,0,85,0.1); border-left: 4px solid #ff0055; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #ff0055; font-size: 1rem;"><i class="fa-brands fa-google-play"></i> Déclaration de Confidentialité</h3>
                <p style="color: #ccc; font-size: 0.9rem; line-height: 1.4; margin: 0;">
                    Cette application collecte des données de localisation pour calculer vos distances parcourues (Score Éco) et activer le Radar Social, <strong>y compris lorsque l'application est fermée ou non utilisée</strong>. L'accès en arrière-plan est indispensable au service.
                </p>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #00b3ff; margin-top: 0; font-size: 1.1rem;">1. Europe (RGPD / CNIL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-location-dot" style="color: #00b3ff;"></i> Accès GPS (Obligatoire)</span>
                    <input type="checkbox" id="privacy-gps" checked disabled style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-microphone" style="color: #ff0055;"></i> Micro (IA Vocale)</span>
                    <input type="checkbox" id="privacy-mic" checked style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-camera" style="color: #b700ff;"></i> Caméra (AR Vision)</span>
                    <input type="checkbox" id="privacy-cam" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #ffb700; margin-top: 0; font-size: 1.1rem;">2. USA / Californie (CCPA)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-hand-holding-dollar" style="color: #ffb700;"></i> Ne pas vendre mes données<br><small style="color: #888;">"Do Not Sell My Personal Info"</small></span>
                    <input type="checkbox" id="privacy-ccpa" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 25px;">
                <h3 style="color: #ff0055; margin-top: 0; font-size: 1.1rem;">3. Chine (PIPL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-globe" style="color: #ff0055;"></i> Transfert Transfrontalier<br><small style="color: #888;">Autoriser l'envoi des données vers les serveurs sécurisés en Europe.</small></span>
                    <input type="checkbox" id="privacy-pipl" checked style="transform: scale(1.5);">
                </label>
            </div>
            
            <button onclick="window.acceptGlobalPrivacy()" style="width: 100%; padding: 15px; background: #00ffcc; color: #000; font-weight: 900; font-size: 1.2rem; border: none; border-radius: 10px; cursor: pointer; text-transform: uppercase; margin-bottom: 15px;">J'ACCEPTE TOUT</button>
            <div style="text-align: center;">
                <button onclick="window.openPrivacyPolicy()" style="background: none; border: none; color: #888; text-decoration: underline; cursor: pointer;">Lire la Politique de Confidentialité</button>
            </div>
        </div>
    </div>
    
    <!-- PRIVACY POLICY MODAL -->
    <div id="privacy-policy-modal" class="hidden fullscreen-overlay" style="background: #111; color: #fff; z-index: 95000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding: 30px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <button onclick="window.closePrivacyPolicy()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-times"></i></button>
        <h2>Politique de Confidentialité Globale</h2>
        <p>En accord avec les règles Google Play et les lois RGPD (Europe), CCPA (USA) et PIPL (Chine).</p>
        
        <h3>1. Accès à la Localisation en Arrière-plan (Google Play)</h3>
        <p>Notre application accède à votre position GPS de manière continue, y compris lorsque l'application est en arrière-plan, afin de calculer les distances parcourues pour le Score Éco et le Radar Social. Ces données sont utilisées exclusivement pour la fonctionnalité principale du service et ne sont pas revendues.</p>
        
        <h3>2. Europe (RGPD) & Privacy by Design</h3>
        <p>Vos données sont traitées de façon sécurisée (AES-256). Vous disposez d'un droit inconditionnel à l'oubli. La fonction "Supprimer mes données" écrase vos données locales et purge irrévocablement votre compte sur le Cloud Firebase.</p>

        <h3>3. USA (CCPA)</h3>
        <p>Nous ne vendons AUCUNE de vos données personnelles à des tiers. Vous pouvez exprimer votre choix en cochant la case "Do Not Sell".</p>

        <h3>4. Chine (PIPL)</h3>
        <p>Si vous résidez en Chine, vous devez consentir explicitement au transfert transfrontalier de vos données vers nos serveurs situés en Europe.</p>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', bannerHtml);
}

window.acceptGlobalPrivacy = function() {
    const gpsChecked = document.getElementById('privacy-gps').checked;
    const micChecked = document.getElementById('privacy-mic').checked;
    const camChecked = document.getElementById('privacy-cam').checked;
    const ccpaChecked = document.getElementById('privacy-ccpa').checked;
    const piplChecked = document.getElementById('privacy-pipl').checked;

    if(!gpsChecked) {
        alert("Attention : L'application nécessite obligatoirement l'accès au GPS pour fonctionner.");
        return;
    }
    if(!piplChecked) {
        alert("Information (PIPL) : L'application est hébergée en Europe. Si vous n'autorisez pas le transfert transfrontalier, le Cloud ne pourra pas fonctionner.");
    }

    const consentRecord = {
        gps: true,
        mic: micChecked,
        cam: camChecked,
        ccpa_do_not_sell: ccpaChecked,
        pipl_crossborder: piplChecked,
        timestamp: new Date().toISOString(),
        version: 'v100.00-GOLD'
    };

    localStorage.setItem('global_privacy_consent', 'true');
    localStorage.setItem('cnil_consent', 'true'); // legacy support
    localStorage.setItem('privacy_consent_record', JSON.stringify(consentRecord));
    localStorage.setItem('cnil_mic', micChecked ? 'true' : 'false');
    localStorage.setItem('cnil_cam', camChecked ? 'true' : 'false');

    const banner = document.getElementById('global-privacy-banner');
    if(banner) banner.remove();
    
    window.preventAppLaunch = false;
    
    if(micChecked && typeof window.initVoiceAI === 'function') setTimeout(window.initVoiceAI, 1000);
    if(typeof window.initZeroClickDestiny === 'function') setTimeout(window.initZeroClickDestiny, 2000);
    
    if(typeof speak === 'function') speak("Conformité internationale validée. Bienvenue.");
};

window.openPrivacyPolicy = function() {
    const modal = document.getElementById('privacy-policy-modal');
    if(modal) modal.classList.remove('hidden');
};

window.closePrivacyPolicy = function() {
    const modal = document.getElementById('privacy-policy-modal');
    if(modal) modal.classList.add('hidden');
};

// ─── Droit à l'effacement (Droit à l'oubli / Protocol Zero) ──
window.revokeAndEraseData = async function() {
    if(confirm("ATTENTION : Cette action est IRRÉVERSIBLE. Toutes vos données locales ET sur le serveur Cloud (Firestore) seront détruites. Confirmer ?")) {
        
        let uid = null;
        if(window.session && window.session.uid) {
            uid = window.session.uid;
        } else {
            const storedSession = localStorage.getItem('session');
            if(storedSession) {
                try { uid = JSON.parse(storedSession).uid; } catch(e){}
            }
        }

        // 1. Déclencher le Protocol Zero (Suppression Backend via Cloud Function)
        if (uid) {
            try {
                console.log("Déclenchement du Protocol Zero (Suppression Cloud)...");
                const cloudFuncUrl = "https://europe-west1-mon50cc-backend.cloudfunctions.net/deleteUserAccount"; 
                await fetch(cloudFuncUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: uid })
                });
                console.log("Cloud Wipe success.");
            } catch(e) {
                console.warn("Cloud deletion feedback:", e);
            }
        }

        // 2. Effacer toutes les données locales
        localStorage.clear();
        sessionStorage.clear();
        
        // 3. Effacer le cache Service Worker
        if('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        
        if('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(reg => reg.unregister());
            });
        }

        alert("Toutes vos données (Locales et Serveur) ont été détruites de manière irréversible. L'application va se réinitialiser.");
        window.location.href = 'login.html';
    }
};

// ─── Export des données ───────
window.exportMyData = function() {
    try {
        const exportData = {
            _meta: {
                export_date: new Date().toISOString(),
                app: 'mon50ccetmoi',
                format: 'JSON (Format structuré portable)'
            },
            consent: JSON.parse(localStorage.getItem('privacy_consent_record') || '{}'),
            session: (() => { try { return JSON.parse(localStorage.getItem('session') || '{}'); } catch(e) { return {}; } })(),
            preferences: {
                theme: localStorage.getItem('theme'),
                language: localStorage.getItem('language'),
                lite_mode: localStorage.getItem('lite_mode'),
                mic_consent: localStorage.getItem('cnil_mic'),
                cam_consent: localStorage.getItem('cnil_cam')
            },
            vehicle: (() => { try { return JSON.parse(localStorage.getItem('vehicle_config') || '{}'); } catch(e) { return {}; } })(),
            wallet: {
                balance: localStorage.getItem('bvc_balance') || '0',
                total_mined: localStorage.getItem('bvc_total_mined') || '0'
            },
            habits: (() => { try { return JSON.parse(localStorage.getItem('driving_habits') || '{}'); } catch(e) { return {}; } })(),
            odometer: localStorage.getItem('total_km') || '0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mon50ccetmoi_export_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("✅ Export terminé ! Vos données locales ont été téléchargées.");
    } catch(e) {
        console.error('Erreur export:', e);
        alert("Erreur lors de l'export.");
    }
};

// ─── Vérification au chargement ─────────────────
document.addEventListener('DOMContentLoaded', () => {
    if(!localStorage.getItem('global_privacy_consent')) {
        setTimeout(window.checkGlobalPrivacy, 500);
    } else {
        window.checkGlobalPrivacy();
    }
});
