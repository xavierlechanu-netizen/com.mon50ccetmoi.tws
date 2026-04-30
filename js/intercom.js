/**
 * SQUAD INTERCOM v1.0 (PHASE SINGULARITY)
 * Peer-to-Peer Tactical Audio for mon50ccetmoi Squads.
 */

window.Intercom = {
    isSquadActive: false,
    localStream: null,
    peers: [],

    init: function() {
        console.log("Squad Intercom System Standby.");
    },

    toggleSquad: async function() {
        const btn = document.getElementById('btn-squad-toggle');
        
        if (this.isSquadActive) {
            this.stopSquad();
            if (btn) {
                btn.textContent = "SQUAD_LINK: OFF";
                btn.style.borderColor = "var(--accent)";
            }
        } else {
            const ok = await this.startSquad();
            if (ok && btn) {
                btn.textContent = "SQUAD_LINK: LIVE";
                btn.style.borderColor = "#2ecc71";
                if (window.NeuralHUD) window.NeuralHUD.speakOracle('squad_on');
            }
        }
    },

    startSquad: async function() {
        try {
            // Simulation d'accès audio P2P
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.isSquadActive = true;
            
            // Simulation de connexion de coéquipiers
            setTimeout(() => this.addSquadMember("Pilot_Delta", "TALKING"), 2000);
            setTimeout(() => this.addSquadMember("Interceptor_7", "IDLE"), 5000);
            
            return true;
        } catch (err) {
            console.error("Intercom failed:", err);
            alert("Accès microphone requis pour le Squad Intercom.");
            return false;
        }
    },

    stopSquad: function() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        this.isSquadActive = false;
        const list = document.getElementById('squad-list');
        if (list) list.innerHTML = `<div class="squad-member active"><i class="fa-solid fa-microphone-slash"></i> VOUS (MUTE)</div>`;
    },

    addSquadMember: function(name, status) {
        if (!this.isSquadActive) return;
        const list = document.getElementById('squad-list');
        if (!list) return;

        const div = document.createElement('div');
        div.className = `squad-member ${status === 'TALKING' ? 'talking' : ''}`;
        div.innerHTML = `<i class="fa-solid fa-headset"></i> ${name} (${status})`;
        list.appendChild(div);

        if (status === 'TALKING') {
            if (window.NeuralHUD) window.NeuralHUD.logToConsole(`SQUAD: ${name} is transmitting...`);
        }
    }
};

window.Intercom.init();
