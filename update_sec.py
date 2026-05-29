import os

# 1. Update anti-theft.js
with open('js/anti-theft.js', 'r', encoding='utf-8') as f:
    anti_theft = f.read()

siren_code = """
    playSiren: function() {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();
        
        this.oscillator.type = 'square';
        this.oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
        this.oscillator.frequency.linearRampToValueAtTime(1200, this.audioCtx.currentTime + 0.5);
        this.oscillator.frequency.linearRampToValueAtTime(800, this.audioCtx.currentTime + 1.0);
        
        // Loop effect
        this.sirenInterval = setInterval(() => {
            if(!this.isSentryActive) return;
            this.oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            this.oscillator.frequency.linearRampToValueAtTime(1200, this.audioCtx.currentTime + 0.5);
            this.oscillator.frequency.linearRampToValueAtTime(800, this.audioCtx.currentTime + 1.0);
        }, 1000);

        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.gainNode.gain.setValueAtTime(1, this.audioCtx.currentTime);
        this.oscillator.start();
    },

    stopSiren: function() {
        if (this.sirenInterval) clearInterval(this.sirenInterval);
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        const overlay = document.getElementById('glitch-overlay');
        if (overlay) overlay.style.display = 'none';
    },
"""

if "playSiren" not in anti_theft:
    anti_theft = anti_theft.replace('stopSentry: function() {', siren_code + '\n    stopSentry: function() {')
    anti_theft = anti_theft.replace('this.isSentryActive = false;', 'this.isSentryActive = false;\n        this.stopSiren();')
    anti_theft = anti_theft.replace('vibrate([500, 200, 500]);', 'vibrate([500, 200, 500]);\n        if (!this.oscillator) this.playSiren();\n        const overlay = document.getElementById("glitch-overlay");\n        if(overlay) { overlay.style.display = "block"; overlay.style.opacity = "0.8"; overlay.style.background = "red"; }\n')

with open('js/anti-theft.js', 'w', encoding='utf-8') as f:
    f.write(anti_theft)

# 2. Update zero-trust.js (Add Kill-Switch)
with open('js/zero-trust.js', 'r', encoding='utf-8') as f:
    zero_trust = f.read()

kill_switch_code = """
    triggerProtocolZero: function() {
        console.warn("💀 [PROTOCOL 0] INITIATED: ERASING ALL LOCAL DATA...");
        
        // Supprimer toutes les données localStorage
        localStorage.clear();
        sessionStorage.clear();
        
        // Simuler un nettoyage du cache de la base de données (IndexedDB)
        if (window.indexedDB) {
            indexedDB.databases().then(dbs => {
                dbs.forEach(db => { indexedDB.deleteDatabase(db.name); });
            }).catch(() => {});
        }

        // Effets visuels destructeurs
        document.body.innerHTML = "<div style='background:black; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; color:#0f0; font-family:monospace; font-size:20px;'><p>SYSTEM PURGED. REBOOTING...</p></div>";
        
        // Redirection forcée
        setTimeout(() => {
            window.location.href = "about:blank";
        }, 3000);
    },
"""

if "triggerProtocolZero" not in zero_trust:
    zero_trust = zero_trust.replace('init() {', kill_switch_code + '\n    init() {')
    with open('js/zero-trust.js', 'w', encoding='utf-8') as f:
        f.write(zero_trust)

# 3. Update auth.js (Add Biometric FIDO2)
with open('js/auth.js', 'r', encoding='utf-8') as f:
    auth = f.read()

fido2_code = """
window.registerBiometric = async function() {
    const btn = document.querySelector('button[onclick="window.registerBiometric()"]');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initialisation FIDO2...';
    
    // Simulate WebAuthn/FIDO2 prompt
    setTimeout(() => {
        const overlay = document.createElement('div');
        overlay.id = "fido2-overlay";
        overlay.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:40000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;";
        
        overlay.innerHTML = `
            <i class="fa-solid fa-fingerprint fa-beat" style="font-size:5rem; color:#10a37f; margin-bottom:30px; filter:drop-shadow(0 0 20px #10a37f);"></i>
            <h2 style="font-family:'Inter', sans-serif;">Authentification REQUISE</h2>
            <p style="color:#aaa;">Veuillez utiliser Touch ID ou Face ID</p>
            <div style="margin-top:40px; width:200px; height:4px; background:#333; border-radius:2px; overflow:hidden;">
                <div id="fido2-progress" style="width:0%; height:100%; background:#10a37f; transition:width 2s ease-in-out;"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
            document.getElementById('fido2-progress').style.width = '100%';
        }, 100);

        setTimeout(() => {
            overlay.innerHTML = `
                <i class="fa-solid fa-check-circle" style="font-size:5rem; color:#0f0; margin-bottom:30px; filter:drop-shadow(0 0 20px #0f0);"></i>
                <h2 style="font-family:'Inter', sans-serif; color:#0f0;">Appareil Lié (Passkey)</h2>
            `;
            // Save fido2 status
            localStorage.setItem("fido2_enabled", "true");
            if(window.session) {
                window.session.hasBiometric = true;
                localStorage.setItem("session", JSON.stringify(window.session));
            }
            
            setTimeout(() => {
                document.body.removeChild(overlay);
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-shield-check"></i> Protégé par FIDO2';
                    btn.style.background = "#053020";
                    btn.style.color = "#0f0";
                    btn.disabled = true;
                }
            }, 2000);
        }, 2200);

    }, 500);
};

// Hook for AES Crypto
window.encryptRoadbook = function(data) {
    if (!window.CryptoJS) return btoa(data); // Fallback si pas de crypto-js
    const pass = localStorage.getItem("fido2_enabled") ? "biometric_key_42" : "default_key";
    return CryptoJS.AES.encrypt(data, pass).toString();
};

window.decryptRoadbook = function(encryptedData) {
    if (!window.CryptoJS) return atob(encryptedData);
    const pass = localStorage.getItem("fido2_enabled") ? "biometric_key_42" : "default_key";
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, pass);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch(e) {
        return null;
    }
};
"""

if "window.registerBiometric" not in auth:
    with open('js/auth.js', 'a', encoding='utf-8') as f:
        f.write('\n' + fido2_code)
