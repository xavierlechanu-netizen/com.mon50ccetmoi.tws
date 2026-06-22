/* ═══════════════════════════════════════════════════════════════
   CONFORMITÉ RGPD & CNIL — mon50ccetmoi
   Règlement (UE) 2016/679 + Loi Informatique & Libertés
   ═══════════════════════════════════════════════════════════════ */

// ─── Vérification du consentement RGPD au lancement ─────────────
window.checkRGPD = function() {
    const hasConsented = localStorage.getItem('cnil_consent');
    const rgpdBanner = document.getElementById('rgpd-banner');
    
    if (!hasConsented) {
        window.preventAppLaunch = true;
        if(rgpdBanner) rgpdBanner.classList.remove('hidden');
    } else {
        window.preventAppLaunch = false;
        if(rgpdBanner) rgpdBanner.classList.add('hidden');
        if(typeof window.initVoiceAI === 'function') setTimeout(window.initVoiceAI, 1000);
        if(typeof window.initZeroClickDestiny === 'function') setTimeout(window.initZeroClickDestiny, 2000);
    }
};

// ─── Acceptation du bandeau RGPD (consentement granulaire) ──────
window.acceptRGPD = function() {
    const gpsChecked = document.getElementById('rgpd-gps').checked;
    const micChecked = document.getElementById('rgpd-mic').checked;
    const camChecked = document.getElementById('rgpd-cam').checked;

    if(!gpsChecked) {
        alert("Attention : L'application nécessite obligatoirement l'accès au GPS pour fonctionner (Article 6.1.b du RGPD — Nécessité contractuelle).");
        return;
    }

    // Enregistrer le consentement avec horodatage (preuve de consentement Art. 7.1)
    const consentRecord = {
        gps: true,
        mic: micChecked,
        cam: camChecked,
        timestamp: new Date().toISOString(),
        version: 'v70.0.0'
    };

    localStorage.setItem('cnil_consent', 'true');
    localStorage.setItem('cnil_consent_record', JSON.stringify(consentRecord));
    localStorage.setItem('cnil_mic', micChecked ? 'true' : 'false');
    localStorage.setItem('cnil_cam', camChecked ? 'true' : 'false');

    document.getElementById('rgpd-banner').classList.add('hidden');
    window.preventAppLaunch = false;
    
    if(micChecked && typeof window.initVoiceAI === 'function') setTimeout(window.initVoiceAI, 1000);
    if(typeof window.initZeroClickDestiny === 'function') setTimeout(window.initZeroClickDestiny, 2000);
    
    // Track consent dans Analytics (anonymisé)
    if(window.mon50Analytics) {
        window.mon50Analytics.logEvent('rgpd_consent', { gps: true, mic: micChecked, cam: camChecked });
    }

    if(typeof speak === 'function') speak("Paramètres de confidentialité enregistrés. Données stockées localement en accord avec la CNIL.");
};

// ─── Ouvrir/Fermer la politique de confidentialité ──────────────
window.openPrivacyPolicy = function() {
    const modal = document.getElementById('privacy-policy-modal');
    if(modal) modal.classList.remove('hidden');
};

window.closePrivacyPolicy = function() {
    const modal = document.getElementById('privacy-policy-modal');
    if(modal) modal.classList.add('hidden');
};

// ─── Article 17 RGPD : Droit à l'effacement (Droit à l'oubli) ──
window.revokeAndEraseData = function() {
    if(confirm("ATTENTION : Conformément à l'Article 17 du RGPD (Droit à l'oubli), cela effacera DÉFINITIVEMENT toutes vos données locales : certificats, portefeuille, préférences, et historique. \n\nVos données Firestore devront faire l'objet d'une demande séparée à contact@mon50ccetmoi.com.\n\nConfirmer ?")) {
        // Effacer toutes les données locales
        localStorage.clear();
        sessionStorage.clear();
        
        // Effacer le cache Service Worker
        if('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        
        // Désinscription Service Worker
        if('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(reg => reg.unregister());
            });
        }

        // Track l'événement (anonymisé, sans données personnelles)
        if(window.mon50Analytics) {
            window.mon50Analytics.logEvent('rgpd_erasure_local');
        }

        alert("Toutes vos données locales ont été détruites conformément à l'Article 17 du RGPD.\n\nPour supprimer vos données serveur (Firestore), envoyez un email à contact@mon50ccetmoi.com avec votre identifiant.\n\nL'application va redémarrer.");
        window.location.href = 'login.html';
    }
};

// ─── Article 20 RGPD : Droit à la portabilité des données ───────
window.exportMyData = function() {
    try {
        const exportData = {
            _meta: {
                export_date: new Date().toISOString(),
                app: 'mon50ccetmoi',
                version: '70.0.0',
                format: 'JSON (Article 20 RGPD — format structuré, lisible par machine)',
                contact: 'contact@mon50ccetmoi.com'
            },
            consent: JSON.parse(localStorage.getItem('cnil_consent_record') || '{}'),
            session: (() => { try { return JSON.parse(localStorage.getItem('session') || '{}'); } catch(e) { return {}; } })(),
            preferences: {
                theme: localStorage.getItem('theme'),
                language: localStorage.getItem('language'),
                lite_mode: localStorage.getItem('lite_mode'),
                mic_consent: localStorage.getItem('cnil_mic'),
                cam_consent: localStorage.getItem('cnil_cam')
            },
            vehicle: (() => { try { return JSON.parse(localStorage.getItem('vehicle_config') || '{}'); } catch(e) { return {}; } })(),
            guardian_contacts: {
                contact_1: localStorage.getItem('guardian_contact_1') || null,
                contact_2: localStorage.getItem('guardian_contact_2') || null
            },
            wallet: {
                balance: localStorage.getItem('bvc_balance') || '0',
                total_mined: localStorage.getItem('bvc_total_mined') || '0'
            },
            habits: (() => { try { return JSON.parse(localStorage.getItem('driving_habits') || '{}'); } catch(e) { return {}; } })(),
            odometer: localStorage.getItem('total_km') || '0',
            _note: "Pour obtenir vos données serveur (Firestore : historique de trajets, rapports, signalements), envoyez une demande à contact@mon50ccetmoi.com en mentionnant votre identifiant utilisateur."
        };

        // Générer et télécharger le fichier JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mon50ccetmoi_export_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Track l'événement
        if(window.mon50Analytics) {
            window.mon50Analytics.logEvent('rgpd_data_export');
        }

        alert("✅ Export terminé !\n\nVos données locales ont été téléchargées au format JSON conformément à l'Article 20 du RGPD (Droit à la portabilité).\n\nPour vos données serveur, contactez contact@mon50ccetmoi.com.");
    } catch(e) {
        console.error('Erreur export RGPD:', e);
        alert("Erreur lors de l'export. Contactez contact@mon50ccetmoi.com pour exercer votre droit à la portabilité.");
    }
};

// ─── Vérification du consentement au chargement ─────────────────
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.checkRGPD, 500);
});
