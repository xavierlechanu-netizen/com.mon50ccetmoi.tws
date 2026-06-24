/**
 * mon 50cc et moi - Module OBD-II Bluetooth
 * v100.00-GOLD
 * Utilise l'API Web Bluetooth pour se connecter aux boîtiers ELM327
 */

class OBDManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        this.isConnected = false;
        
        // Services et caractéristiques standards pour les modules série Bluetooth (SPP over BLE / ELM327 BLE)
        // Note : Ces UUIDs peuvent varier selon le dongle (JDY-33, Vgate, etc.). On utilise les plus courants (ex: JDY-08 / HM-10).
        this.serviceUuid = '0000ffe0-0000-1000-8000-00805f9b34fb';
        this.characteristicUuid = '0000ffe1-0000-1000-8000-00805f9b34fb';

        this.pollingInterval = null;
        this.buffer = '';

        // PIDs de base à interroger en boucle
        this.queries = [
            '01 0C', // RPM (Engine Speed)
            '01 0D', // Vehicle Speed
            '01 05'  // Engine Coolant Temp
        ];
        this.currentQueryIndex = 0;
    }

    async connect() {
        try {
            console.log("Demande d'accès au périphérique Bluetooth OBD...");
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'OBD' },
                    { namePrefix: 'V-LINK' },
                    { namePrefix: 'ELM327' },
                    { services: [this.serviceUuid] }
                ],
                optionalServices: [this.serviceUuid]
            });

            console.log('Appareil sélectionné :', this.device.name);
            
            this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());

            this.server = await this.device.gatt.connect();
            console.log('Connecté au serveur GATT');

            const service = await this.server.getPrimaryService(this.serviceUuid);
            
            // Pour beaucoup de modules ELM327 BLE, RX et TX partagent la même caractéristique
            this.txCharacteristic = await service.getCharacteristic(this.characteristicUuid);
            this.rxCharacteristic = this.txCharacteristic;

            await this.rxCharacteristic.startNotifications();
            this.rxCharacteristic.addEventListener('characteristicvaluechanged', (e) => this.handleData(e));

            this.isConnected = true;
            this.dispatchStateChange(true);

            // Initialisation de l'ELM327 (Reset, Echo off, Formatting off)
            await this.sendCommand('ATZ');
            setTimeout(() => this.sendCommand('ATE0'), 1000);
            setTimeout(() => this.sendCommand('ATL0'), 1500);
            setTimeout(() => this.startPolling(), 2000);

            return true;
        } catch (error) {
            console.error('Erreur de connexion Bluetooth:', error);
            this.isConnected = false;
            this.dispatchStateChange(false);
            return false;
        }
    }

    disconnect() {
        if (!this.device) return;
        console.log('Déconnexion...');
        this.stopPolling();
        if (this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
    }

    onDisconnected() {
        console.log('Périphérique OBD déconnecté.');
        this.isConnected = false;
        this.stopPolling();
        this.dispatchStateChange(false);
    }

    async sendCommand(cmd) {
        if (!this.txCharacteristic) return;
        const encoder = new TextEncoder();
        const data = encoder.encode(cmd + '\r');
        await this.txCharacteristic.writeValue(data);
    }

    handleData(event) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const str = decoder.decode(value);
        
        this.buffer += str;

        if (this.buffer.includes('>')) { // Prompt de fin de réponse ELM327
            let response = this.buffer.replace('>', '').trim();
            this.buffer = ''; // Reset buffer
            this.parseObdResponse(response);
        }
    }

    parseObdResponse(response) {
        // Enlève les espaces
        const hexData = response.replace(/\s/g, '');
        
        // 41 = Réponse au Mode 01
        if (hexData.startsWith('41')) {
            const pid = hexData.substring(2, 4);
            const dataBytes = hexData.substring(4);

            let value = null;
            let type = '';

            switch (pid) {
                case '0C': // RPM (2 bytes)
                    if (dataBytes.length >= 4) {
                        const A = parseInt(dataBytes.substring(0, 2), 16);
                        const B = parseInt(dataBytes.substring(2, 4), 16);
                        value = ((A * 256) + B) / 4;
                        type = 'rpm';
                    }
                    break;
                case '0D': // Vitesse (1 byte)
                    if (dataBytes.length >= 2) {
                        value = parseInt(dataBytes.substring(0, 2), 16);
                        type = 'speed';
                    }
                    break;
                case '05': // Température (1 byte)
                    if (dataBytes.length >= 2) {
                        value = parseInt(dataBytes.substring(0, 2), 16) - 40;
                        type = 'temp';
                    }
                    break;
            }

            if (value !== null) {
                // Dispatch event to UI
                window.dispatchEvent(new CustomEvent('obd_data', {
                    detail: { type: type, value: value }
                }));
            }
        }
    }

    startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendCommand(this.queries[this.currentQueryIndex]);
                this.currentQueryIndex = (this.currentQueryIndex + 1) % this.queries.length;
            }
        }, 500); // Interroge toutes les 500ms
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    dispatchStateChange(connected) {
        window.dispatchEvent(new CustomEvent('obd_status', {
            detail: { connected: connected }
        }));
    }
}

// Initialisation globale
window.obdManager = new OBDManager();

// --- HUD UI BINDINGS ---
window.addEventListener('obd_status', (e) => {
    const statusEl = document.getElementById('obd-status-indicator');
    const hudEl = document.getElementById('obd-hud-screen');
    if (!statusEl || !hudEl) return;

    if (e.detail.connected) {
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = '<i class="fa-brands fa-bluetooth" style="margin-right:5px;"></i> OBD Connecté (Cliquez pour déconnecter)';
        statusEl.style.color = '#2ecc71';
        statusEl.style.borderColor = '#2ecc71';
        statusEl.style.background = 'rgba(46, 204, 113, 0.2)';
        hudEl.classList.remove('hidden');
        // Vibrate to confirm connection
        if (navigator.vibrate) navigator.vibrate(100);
    } else {
        statusEl.classList.add('hidden');
        hudEl.classList.add('hidden');
        
        // Reset values
        const rpmEl = document.getElementById('obd-val-rpm');
        const speedEl = document.getElementById('obd-val-speed');
        const tempEl = document.getElementById('obd-val-temp');
        if(rpmEl) rpmEl.innerText = '--';
        if(speedEl) speedEl.innerText = '--';
        if(tempEl) tempEl.innerText = '--';
    }
});

window.addEventListener('obd_data', (e) => {
    const { type, value } = e.detail;
    if (type === 'rpm') {
        const el = document.getElementById('obd-val-rpm');
        if (el) {
            el.innerText = Math.round(value);
            // Dynamic color feedback for RPM
            if (value > 7000) {
                el.style.color = '#ff0055';
                el.style.textShadow = '0 0 20px #ff0055';
            } else if (value > 4500) {
                el.style.color = '#ffb700';
                el.style.textShadow = '0 0 15px #ffb700';
            } else {
                el.style.color = '#00f2ff';
                el.style.textShadow = '0 0 10px #00f2ff';
            }
        }
    } else if (type === 'speed') {
        const el = document.getElementById('obd-val-speed');
        if (el) {
            el.innerText = Math.round(value);
            // Dynamic color feedback for Speed
            if (value > 50) {
                el.style.color = '#ff0055';
                el.style.textShadow = '0 0 20px #ff0055';
            } else {
                el.style.color = '#00d2ff';
                el.style.textShadow = '0 0 15px #00d2ff';
            }
        }
    } else if (type === 'temp') {
        const el = document.getElementById('obd-val-temp');
        if (el) {
            el.innerText = Math.round(value);
            if (value > 95) {
                el.style.color = '#ff0055';
                el.style.textShadow = '0 0 20px #ff0055';
            } else {
                el.style.color = '#ff4d4d';
                el.style.textShadow = '0 0 10px #ff4d4d';
            }
        }
    }
});


