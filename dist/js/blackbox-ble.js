/**
 * ============================================================================
 * blackbox-ble.js — Client Web Bluetooth API pour la Boîte Noire 50cc
 * ============================================================================
 * Connecte l'application web (PWA) au hardware ESP32-C3 via BLE.
 * 
 * UUIDs (Doivent correspondre à ble_comm.h du firmware) :
 *   - Service Télémétrie : 0x0001
 *   - Service Diagnostic : 0x0002
 * 
 * @note L'API Web Bluetooth nécessite HTTPS et un geste utilisateur (clic).
 * ============================================================================
 */

class BlackBoxBLE {
  constructor() {
    this.device = null;
    this.server = null;
    this.telemetryService = null;
    this.diagnosticService = null;

    // UUIDs de base (GATT 16-bit convertis par WebBLE en UUIDs standard si ce ne sont pas des standards SIG)
    // Ici on utilise le base UUID complet défini dans le firmware
    this.baseUuidPrefix = "50cc0000-";
    this.baseUuidSuffix = "-4d6f-6e35-306363657431";

    this.SVC_TELEMETRY = this.buildUuid("0001");
    this.SVC_DIAGNOSTIC = this.buildUuid("0002");
    
    // Télémétrie CHRs
    this.CHR_FRAME_COUNT = this.buildUuid("0101");
    this.CHR_FRAME_DATA  = this.buildUuid("0102");
    this.CHR_EXPORT_CMD  = this.buildUuid("0103");

    // Diagnostic CHRs
    this.CHR_BATTERY      = this.buildUuid("0201");
    this.CHR_TAMPER_STATE = this.buildUuid("0202");
    
    this.isConnected = false;
    this.onConnectionChange = null; // Callback UI
    this.onTelemetryData = null;    // Callback Data
    this.onDiagnosticUpdate = null; // Callback UI
    
    // Batching logic : 3000 trames (~5 minutes à 10Hz) pour économiser Firestore
    this.telemetryBuffer = [];
    this.MAX_BATCH_SIZE = 3000;
    this.HARD_LIMIT_BUFFER = 10000; // Limite stricte pour éviter l'OOM
    this.batchTimeout = null;
    this.BATCH_TIMEOUT_MS = 300000;
    
    this.autoReconnectEnabled = false;
    this.reconnectTimer = null;
  }

  buildUuid(shortHex) {
    return `${this.baseUuidPrefix}${shortHex}${this.baseUuidSuffix}`;
  }

  /**
   * Ouvre la popup native du navigateur pour scanner et connecter l'appareil.
   */
  async connect() {
    if (!navigator.bluetooth) {
      alert("Erreur : L'API Web Bluetooth n'est pas supportée par votre navigateur (essayez Chrome ou Edge sur PC/Android).");
      return false;
    }

    try {
      console.log("[BLE] Demande d'appareil Bluetooth...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'BB50-' }],
        optionalServices: [this.SVC_TELEMETRY, this.SVC_DIAGNOSTIC]
      });

      console.log(`[BLE] Appareil sélectionné : ${this.device.name}`);
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

      console.log("[BLE] Connexion au serveur GATT...");
      this.server = await this.device.gatt.connect();
      this.isConnected = true;
      this.autoReconnectEnabled = true; // Activer reconnexion auto
      if (this.onConnectionChange) this.onConnectionChange(true);

      await this.initializeServices();
      return true;

    } catch (error) {
      console.error("[BLE] Erreur de connexion :", error);
      alert("Échec de la connexion Bluetooth : " + error.message);
      this.disconnect();
      return false;
    }
  }

  /**
   * Initialise les services et caractéristiques après la connexion.
   */
  async initializeServices() {
    if (!this.server) return;

    try {
      console.log("[BLE] Récupération du service Diagnostic...");
      this.diagnosticService = await this.server.getPrimaryService(this.SVC_DIAGNOSTIC);
      
      console.log("[BLE] Récupération du service Télémétrie...");
      this.telemetryService = await this.server.getPrimaryService(this.SVC_TELEMETRY);

      // S'abonner aux notifications de trames
      const frameChar = await this.telemetryService.getCharacteristic(this.CHR_FRAME_DATA);
      await frameChar.startNotifications();
      frameChar.addEventListener('characteristicvaluechanged', this.handleFrameNotification.bind(this));

      console.log("[BLE] Services initialisés et abonnements actifs.");
      
      // Première lecture des diagnostics
      await this.readDiagnostics();

    } catch (error) {
      console.error("[BLE] Erreur d'initialisation des services :", error);
    }
  }

  /**
   * Lecture de la batterie et de l'état anti-effraction
   */
  async readDiagnostics() {
    if (!this.diagnosticService) return;

    try {
      const batChar = await this.diagnosticService.getCharacteristic(this.CHR_BATTERY);
      const batVal = await batChar.readValue();
      const battery_mv = batVal.getUint16(0, true);

      const tamperChar = await this.diagnosticService.getCharacteristic(this.CHR_TAMPER_STATE);
      const tamperVal = await tamperChar.readValue();
      const tamper_state = tamperVal.getUint8(0);

      console.log(`[BLE] Diagnostic -> Batterie: ${battery_mv}mV, Tamper: ${tamper_state}`);
      
      if (this.onDiagnosticUpdate) {
        this.onDiagnosticUpdate({ battery_mv, tamper_state });
      }
    } catch (error) {
      console.error("[BLE] Erreur de lecture diagnostic :", error);
    }
  }

  /**
   * Envoie la commande pour télécharger les trames.
   */
  async exportTelemetry(startIndex = 0, count = 0) {
    if (!this.telemetryService) {
      alert("Boîte Noire non connectée.");
      return;
    }

    try {
      const cmdChar = await this.telemetryService.getCharacteristic(this.CHR_EXPORT_CMD);
      
      // Structure: [start_index (4B)] [count (4B)] (Little Endian)
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setUint32(0, startIndex, true);
      view.setUint32(4, count, true);

      console.log(`[BLE] Envoi commande export: start=${startIndex}, count=${count}`);
      await cmdChar.writeValue(buffer);
      
    } catch (error) {
      console.error("[BLE] Erreur commande export :", error);
    }
  }

  /**
   * Réception des trames en direct.
   */
  async handleFrameNotification(event) {
    const value = event.target.value;
    
    // Si la trame fait au moins 32 octets (16 d'en-tête + 16 d'IV aléatoire + payload)
    if (value.byteLength >= 32) {
        const timestamp = value.getUint32(0, true);
        const lat = value.getInt32(4, true) / 1e7;
        const lon = value.getInt32(8, true) / 1e7;
        const speed = value.getUint16(12, true) / 10;
        
        console.log(`[BLE] Trame hybride reçue: TS=${timestamp}, Lat=${lat}, Lon=${lon}, Vitesse=${speed} km/h`);
        
        // 1. Extraire l'IV aléatoire ET la preuve chiffrée (à partir de l'octet 16)
        // Les octets 16 à 31 contiennent l'IV, le reste contient le payload AES-CBC.
        const encryptedLength = value.byteLength - 16;
        if (encryptedLength <= 16) return; // Ignore les trames sans payload

        const encryptedBytes = new Uint8Array(value.buffer, value.byteOffset + 16, encryptedLength);
        let binary = '';
        encryptedBytes.forEach(b => binary += String.fromCharCode(b));
        const b64Payload = window.btoa(binary);

        // 2. Batching des trames (au lieu d'un appel réseau par trame)
        this.telemetryBuffer.push({
            encryptedPayload: b64Payload,
            timestamp: timestamp
        });

        if (this.telemetryBuffer.length >= this.MAX_BATCH_SIZE) {
            this.flushTelemetryBuffer();
        } else if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => this.flushTelemetryBuffer(), this.BATCH_TIMEOUT_MS);
        }

        if (this.onTelemetryData) {
            this.onTelemetryData({ timestamp, lat, lon, speed, raw: value });
        }
    }
  }

  /**
   * Envoie le buffer de trames au Cloud (Batch) et le vide.
   */
  async flushTelemetryBuffer() {
      if (this.batchTimeout) {
          clearTimeout(this.batchTimeout);
          this.batchTimeout = null;
      }

      if (this.telemetryBuffer.length === 0) return;

      const payloadsToUpload = [...this.telemetryBuffer];
      this.telemetryBuffer = []; // Clear buffer immediately to catch new frames

      if (typeof firebase !== 'undefined' && firebase.functions) {
          try {
              const uploadTelemetry = firebase.functions("europe-west1").httpsCallable('uploadBlackboxTelemetry');
              await uploadTelemetry({
                  hardwareId: this.device ? this.device.name : 'UNKNOWN_HW',
                  payloads: payloadsToUpload
              });
              console.log(`[BLE] Batch de ${payloadsToUpload.length} trames stocké en Zero-Knowledge sur Firebase.`);
          } catch (error) {
              console.error(`[BLE] Erreur Firebase upload batch:`, error);
              // Ré-insérer les trames échouées en début de buffer si la limite n'est pas atteinte
              if (this.telemetryBuffer.length + payloadsToUpload.length <= this.HARD_LIMIT_BUFFER) {
                  this.telemetryBuffer = payloadsToUpload.concat(this.telemetryBuffer);
              } else {
                  console.warn("[BLE] Hard limit mémoire atteinte. Perte de trames hors ligne.");
              }
          }
      }
  }

  /**
   * Déconnexion propre (désactive auto-reconnect).
   */
  disconnect() {
    this.autoReconnectEnabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.flushTelemetryBuffer();
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
  }

  handleDisconnection() {
    console.log("[BLE] Appareil déconnecté.");
    this.isConnected = false;
    this.server = null;
    if (this.onConnectionChange) this.onConnectionChange(false);
    
    // Auto-reconnect
    if (this.device && this.autoReconnectEnabled) {
      console.log("[BLE] Tentative de reconnexion automatique dans 5s...");
      this.reconnectTimer = setTimeout(() => this.reconnect(), 5000);
    } else {
      this.device = null;
    }
  }

  async reconnect() {
    if (!this.device) return;
    try {
      console.log("[BLE] Reconnexion au serveur GATT...");
      this.server = await this.device.gatt.connect();
      this.isConnected = true;
      if (this.onConnectionChange) this.onConnectionChange(true);
      await this.initializeServices();
    } catch (e) {
      console.error("[BLE] Échec de la reconnexion automatique :", e);
      if (this.autoReconnectEnabled) {
         this.reconnectTimer = setTimeout(() => this.reconnect(), 5000);
      }
    }
  }
}

// Instance globale
window.BlackBox = new BlackBoxBLE();
