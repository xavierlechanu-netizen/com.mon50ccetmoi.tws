import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * ============================================================================
 * blackbox-ble.js — Client BLE Hybride (Capacitor Natif + Web Bluetooth API)
 * ============================================================================
 * Connecte l'application (App Native Capacitor iOS/Android ou PWA Desktop/Android)
 * au boîtier physique ESP32-C3 de la Boîte Noire 50cc (Réf. EXP-BB50-2026-REV3).
 *
 * Fonctionnalités clés REV3 :
 *   - Support Dual-Transport :
 *       1. Bridge natif Capacitor (`@capacitor-community/bluetooth-le`) pour le
 *          maintien en tâche de fond (iOS CoreBluetooth State Restoration +
 *          Android Foreground Service écran verrouillé).
 *       2. Fallback Web Bluetooth API (`navigator.bluetooth`) sur Chrome/Edge.
 *   - Protocole BLE Hybride :
 *       * Flux continu (< 3.0G) : GATT Notification (faible latence 10 Hz)
 *       * Événement de choc (>= 3.0G) : GATT Indication + acquittement applicatif
 *         explicite `ACK_SEQ_ID` sur la caractéristique `0x0104` avant purge NVS.
 *   - Support cryptographique `AES-256-GCM` (Nonce 96 bits + Tag GMAC 128 bits)
 *     et chaînage de Merkle (`seq_id` monotone).
 *   - Fenêtre probante RGPD : En cas d'impact (>= 3.0G), isolation et envoi
 *     prioritaire de la fenêtre d'incident (±30 secondes autour du choc).
 * ============================================================================
 */

class BlackBoxBLE {
  constructor() {
    this.device = null;
    this.nativeDeviceId = null;
    this.usingNativeBridge = false;
    this.server = null;
    this.telemetryService = null;
    this.diagnosticService = null;

    // UUID 128 bits du firmware (ble_comm.c) : 50ccXXXX-0000-4d6f-6e35-306363657431.
    // Correctif : il manquait le groupe « -0000 » (UUID de 28 chiffres, refusé par Web Bluetooth).
    this.baseUuidPrefix = "50cc0000-";
    this.baseUuidSuffix = "-0000-4d6f-6e35-306363657431";

    this.SVC_TELEMETRY  = this.buildUuid("0001");
    this.SVC_DIAGNOSTIC = this.buildUuid("0002");

    // Caractéristiques Télémétrie
    this.CHR_FRAME_COUNT = this.buildUuid("0101");
    this.CHR_FRAME_DATA  = this.buildUuid("0102");
    this.CHR_EXPORT_CMD  = this.buildUuid("0103");
    this.CHR_ACK_SEQ     = this.buildUuid("0104"); // Acquittement applicatif ACK_SEQ_ID (REV3)
    this.CHR_ECDSA_SIG   = this.buildUuid("0105"); // Signature matérielle ECDSA P-256

    // Caractéristiques Diagnostic
    this.CHR_BATTERY      = this.buildUuid("0201");
    this.CHR_TAMPER_STATE = this.buildUuid("0202");

    this.isConnected = false;
    this.onConnectionChange = null;
    this.onTelemetryData = null;
    this.onDiagnosticUpdate = null;
    this.onShockDetected = null;

    // Buffer circulaire et batching (3000 trames = 5 min à 10 Hz)
    this.telemetryBuffer = [];
    this.MAX_BATCH_SIZE = 3000;
    this.HARD_LIMIT_BUFFER = 10000;
    this.CRASH_WINDOW_SEC = 30; // RGPD Art. 5 : ±30 secondes autour de l'impact
    this.SHOCK_THRESHOLD_G = 3.0;
    this.batchTimeout = null;
    this.BATCH_TIMEOUT_MS = 300000;

    this.lastSeqId = 0;
    this.lastAckedSeqId = 0;
    this.pendingCrashFlushTimer = null;

    this.autoReconnectEnabled = false;
    this.reconnectTimer = null;
  }

  buildUuid(shortHex) {
    // Remplace les 4 derniers chiffres du premier bloc 50ccXXXX
    return `50cc${shortHex}${this.baseUuidSuffix}`;
  }

  /**
   * Détecte si le plugin natif Capacitor Bluetooth LE est disponible (iOS / Android App).
   */
  getNativeBlePlugin() {
    if (typeof window !== "undefined" &&
        window.Capacitor &&
        window.Capacitor.isNativePlatform &&
        window.Capacitor.isNativePlatform() &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.BluetoothLe) {
      return window.Capacitor.Plugins.BluetoothLe;
    }
    return null;
  }

  /**
   * Connecte l'application au boîtier Black Box (Bridge Natif Capacitor prioritaire, sinon WebBLE).
   */
  async connect() {
    const nativeBle = this.getNativeBlePlugin();
    if (nativeBle) {
      return await this.connectNative(nativeBle);
    }

    if (!navigator.bluetooth) {
      alert("Erreur : L'API Web Bluetooth n'est pas supportée par ce navigateur. Sur iOS ou en tâche de fond, utilisez l'application mobile mon50ccetmoi (Bridge Natif CoreBluetooth / Foreground Service).");
      return false;
    }

    try {
      console.log("[BLE] Demande d'appareil Web Bluetooth...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'BB50' }], // « BB50V1-A01 » (numéroté) ou « BB50-XXXX » (mode usine)
        optionalServices: [this.SVC_TELEMETRY, this.SVC_DIAGNOSTIC]
      });

      this.usingNativeBridge = false;
      console.log(`[BLE] Appareil sélectionné : ${this.device.name}`);
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

      console.log("[BLE] Connexion au serveur GATT...");
      this.server = await this.device.gatt.connect();
      this.isConnected = true;
      this.autoReconnectEnabled = true;
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
   * Connexion via le Bridge Natif Capacitor (iOS CoreBluetooth background / Android Foreground Service).
   */
  async connectNative(nativeBle) {
    try {
      console.log("[BLE] Initialisation du Bridge Natif Capacitor BluetoothLe...");
      await nativeBle.initialize({ androidNeverForLocation: true });

      const device = await nativeBle.requestDevice({
        prefix: "BB50",
        optionalServices: [this.SVC_TELEMETRY, this.SVC_DIAGNOSTIC]
      });

      this.usingNativeBridge = true;
      this.nativeDeviceId = device.deviceId;
      this.device = { name: device.name || `BB50-${device.deviceId.slice(-4)}`, id: device.deviceId };

      await nativeBle.connect({
        deviceId: this.nativeDeviceId,
        onDisconnected: () => this.handleDisconnection()
      });

      this.isConnected = true;
      this.autoReconnectEnabled = true;
      if (this.onConnectionChange) this.onConnectionChange(true);

      await nativeBle.startNotifications({
        deviceId: this.nativeDeviceId,
        service: this.SVC_TELEMETRY,
        characteristic: this.CHR_FRAME_DATA
      }, (result) => {
        if (result && result.value) {
          const bytes = this.hexOrBase64ToDataView(result.value);
          if (bytes) {
            this.handleFrameNotification({ target: { value: bytes } });
          }
        }
      });

      console.log(`[BLE] Bridge Natif actif (Background State Restoration prêt) sur ${this.device.name}`);
      return true;
    } catch (error) {
      console.error("[BLE] Erreur Bridge Natif Capacitor :", error);
      this.disconnect();
      return false;
    }
  }

  hexOrBase64ToDataView(rawString) {
    if (typeof rawString !== "string") return null;
    const clean = rawString.trim();
    if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
      const arr = new Uint8Array(clean.length / 2);
      for (let i = 0; i < clean.length; i += 2) {
        arr[i / 2] = parseInt(clean.substring(i, i + 2), 16);
      }
      return new DataView(arr.buffer);
    }
    try {
      const bin = window.atob(clean);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
      }
      return new DataView(arr.buffer);
    } catch (e) {
      return null;
    }
  }

  /**
   * Initialise les services et caractéristiques après la connexion Web Bluetooth.
   */
  async initializeServices() {
    if (!this.server) return;

    try {
      console.log("[BLE] Récupération du service Diagnostic...");
      this.diagnosticService = await this.server.getPrimaryService(this.SVC_DIAGNOSTIC);

      console.log("[BLE] Récupération du service Télémétrie...");
      this.telemetryService = await this.server.getPrimaryService(this.SVC_TELEMETRY);

      // S'abonner aux notifications ET indications GATT (Dual-Mode BLE)
      const frameChar = await this.telemetryService.getCharacteristic(this.CHR_FRAME_DATA);
      await frameChar.startNotifications();
      frameChar.addEventListener('characteristicvaluechanged', this.handleFrameNotification.bind(this));

      console.log("[BLE] Services initialisés (Notifications 10Hz + Indications Choc >= 3G actives).");

      await this.readDiagnostics();

    } catch (error) {
      console.error("[BLE] Erreur d'initialisation des services :", error);
    }
  }

  /**
   * Envoie l'acquittement applicatif `ACK_SEQ_ID` (caractéristique 0x0104) au boîtier ESP32.
   * Garantit au firmware que la trame de choc a bien été reçue et mise en sécurité par le smartphone.
   * @param {number} seqId Numéro de séquence monotone (uint32)
   */
  async acknowledgeShockFrame(seqId) {
    if (!Number.isInteger(seqId) || seqId <= 0) return false;

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, seqId, true); // Little Endian

    try {
      const nativeBle = this.getNativeBlePlugin();
      if (this.usingNativeBridge && nativeBle && this.nativeDeviceId) {
        const bytes = new Uint8Array(buffer);
        const hexVal = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        await nativeBle.write({
          deviceId: this.nativeDeviceId,
          service: this.SVC_TELEMETRY,
          characteristic: this.CHR_ACK_SEQ,
          value: hexVal
        });
        this.lastAckedSeqId = seqId;
        console.log(`[BLE] ACK_SEQ_ID natif envoyé pour seq_id=${seqId}`);
        return true;
      }

      if (!this.telemetryService) return false;
      const ackChar = await this.telemetryService.getCharacteristic(this.CHR_ACK_SEQ);
      await ackChar.writeValue(buffer);
      this.lastAckedSeqId = seqId;
      console.log(`[BLE] ACK_SEQ_ID envoyé avec succès pour seq_id=${seqId}`);
      return true;
    } catch (error) {
      console.warn(`[BLE] Impossible d'envoyer ACK_SEQ_ID pour seq_id=${seqId} :`, error);
      return false;
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
      const battery_mv = batVal.byteLength >= 2 ? batVal.getUint16(0, true) : batVal.getUint8(0);

      let tamper_state = 0;
      try {
        const tamperChar = await this.diagnosticService.getCharacteristic(this.CHR_TAMPER_STATE);
        const tamperVal = await tamperChar.readValue();
        tamper_state = tamperVal.getUint8(0);
      } catch (_) {
        // Optionnel sur certains firmwares Arduino
      }

      console.log(`[BLE] Diagnostic -> Batterie: ${battery_mv}, Tamper: ${tamper_state}`);

      if (this.onDiagnosticUpdate) {
        this.onDiagnosticUpdate({ battery_mv, tamper_state });
      }
    } catch (error) {
      console.error("[BLE] Erreur de lecture diagnostic :", error);
    }
  }

  /**
   * Envoie la commande pour télécharger les trames stockées en Flash.
   */
  async exportTelemetry(startIndex = 0, count = 0) {
    if (!this.telemetryService) {
      alert("Boîte Noire non connectée.");
      return;
    }

    try {
      const cmdChar = await this.telemetryService.getCharacteristic(this.CHR_EXPORT_CMD);
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
   * Réception des trames en direct (10 Hz) ou par Indication GATT (choc >= 3.0G).
   * Supporte :
   *  - Format REV3 Hybride AES-256-GCM (`flags === 0xA3`, en-tête 48 octets : 16B clair + 4B seq_id + 12B Nonce + 16B GMAC Tag + Ciphertext)
   *  - Format ESP-IDF natif 96 octets (`stored_frame_t` : 12B Nonce + 4B seq_id + 16B GMAC Tag + 64B Ciphertext)
   *  - Format Legacy 32 octets ( rétrocompatibilité V1 )
   */
  async handleFrameNotification(event) {
    const value = event.target.value;
    if (!value || value.byteLength < 32) return;

    const timestamp = value.getUint32(0, true);
    const lat = value.getInt32(4, true) / 1e7;
    const lon = value.getInt32(8, true) / 1e7;
    const speed = value.getUint16(12, true) / 10;
    const gForce = value.getUint8(14) / 10.0;
    const frameFlags = value.getUint8(15);

    let seqId = this.lastSeqId + 1;
    let cipherMode = "AES-256-GCM";
    let nonceHex = null;
    let gmacTagHex = null;
    let encryptedOffset = 16;

    if (frameFlags === 0xA3 && value.byteLength > 48) {
      // Trame REV3 AES-256-GCM + Merkle
      seqId = value.getUint32(16, true);
      const nonceBytes = new Uint8Array(value.buffer, value.byteOffset + 20, 12);
      const tagBytes = new Uint8Array(value.buffer, value.byteOffset + 32, 16);
      nonceHex = Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      gmacTagHex = Array.from(tagBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      encryptedOffset = 16; // On conserve [seq_id(4B) + nonce(12B) + tag(16B) + ciphertext] dans la preuve binaire
    } else {
      cipherMode = "AES-256-CBC-LEGACY";
    }

    this.lastSeqId = seqId;

    const encryptedLength = value.byteLength - encryptedOffset;
    if (encryptedLength <= 16) return;

    const encryptedBytes = new Uint8Array(value.buffer, value.byteOffset + encryptedOffset, encryptedLength);
    let binary = '';
    for (let i = 0; i < encryptedBytes.length; i++) {
      binary += String.fromCharCode(encryptedBytes[i]);
    }
    const b64Payload = window.btoa(binary);

    const isShockFrame = gForce >= this.SHOCK_THRESHOLD_G;

    const frameRecord = {
      seqId,
      timestamp,
      gForce,
      cipherMode,
      nonceHex,
      gmacTagHex,
      isShockFrame,
      encryptedPayload: b64Payload
    };

    this.telemetryBuffer.push(frameRecord);

    // Protocole d'urgence sur événement de choc (>= 3.0G) :
    // 1. Acquittement applicatif immédiat ACK_SEQ_ID sur 0x0104
    // 2. Planification du flush de la fenêtre RGPD (±30s autour du choc)
    if (isShockFrame) {
      console.warn(`[BLE] 🚨 CHOC CRITIQUE DÉTECTÉ (${gForce.toFixed(1)}G, seq_id=${seqId}) ! Envoi ACK_SEQ_ID & sauvegarde prioritaire...`);
      await this.acknowledgeShockFrame(seqId);

      if (this.onShockDetected) {
        this.onShockDetected({ timestamp, lat, lon, speed, gForce, seqId });
      }

      this.scheduleCrashWindowFlush(timestamp);
    } else if (this.telemetryBuffer.length >= this.MAX_BATCH_SIZE) {
      this.flushTelemetryBuffer(false);
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flushTelemetryBuffer(false), this.BATCH_TIMEOUT_MS);
    }

    if (this.onTelemetryData) {
      this.onTelemetryData({ timestamp, lat, lon, speed, gForce, seqId, cipherMode, raw: value });
    }
  }

  /**
   * Planifie l'extraction et l'envoi de la fenêtre probante RGPD (±30s autour de l'impact).
   * Minimisation des données (RGPD Art. 5 / Protection contre l'auto-incrimination).
   */
  scheduleCrashWindowFlush(impactTimestamp) {
    if (this.pendingCrashFlushTimer) return;
    // Attendre 5 secondes post-impact pour capturer la phase d'immobilisation post-choc, puis téléverser immédiatement
    this.pendingCrashFlushTimer = setTimeout(() => {
      this.pendingCrashFlushTimer = null;
      this.flushTelemetryBuffer(true, impactTimestamp);
    }, 5000);
  }

  /**
   * Filtre les trames sur la fenêtre réglementaire [t_impact - 30s, t_impact + 30s].
   */
  extractCrashWindow(frames, impactTimestamp) {
    if (!Array.isArray(frames) || !impactTimestamp) return frames;
    const minTs = impactTimestamp - this.CRASH_WINDOW_SEC;
    const maxTs = impactTimestamp + this.CRASH_WINDOW_SEC;
    return frames.filter(f => typeof f.timestamp === "number" && f.timestamp >= minTs && f.timestamp <= maxTs);
  }

  /**
   * Envoie le buffer de trames au Cloud (Batch) et le vide.
   * @param {boolean} isCrashReport Si true, applique le filtrage RGPD ±30s autour du choc
   * @param {number|null} impactTimestamp Horodatage UTC de l'impact
   */
  async flushTelemetryBuffer(isCrashReport = false, impactTimestamp = null) {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.telemetryBuffer.length === 0) return;

    let payloadsToUpload = [...this.telemetryBuffer];
    this.telemetryBuffer = [];

    if (isCrashReport && impactTimestamp) {
      payloadsToUpload = this.extractCrashWindow(payloadsToUpload, impactTimestamp);
      console.log(`[BLE] Filtrage probant RGPD (±${this.CRASH_WINDOW_SEC}s) : ${payloadsToUpload.length} trames retenues autour de t=${impactTimestamp}.`);
    }

    if (payloadsToUpload.length === 0) return;

    if (typeof firebase !== 'undefined' && firebase.functions) {
      try {
        const uploadTelemetry = firebase.app().functions("europe-west1").httpsCallable('uploadBlackboxTelemetry');
        await uploadTelemetry({
          hardwareId: this.device ? this.device.name : 'UNKNOWN_HW',
          isCrashReport: Boolean(isCrashReport),
          impactTimestamp: impactTimestamp || null,
          payloads: payloadsToUpload
        });
        console.log(`[BLE] Batch de ${payloadsToUpload.length} trames (${isCrashReport ? 'RAPPORT DE CHOC ±30s' : 'télémétrie'}) stocké en Zero-Knowledge sur Firebase.`);
      } catch (error) {
        console.error(`[BLE] Erreur Firebase upload batch:`, error);
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
    if (this.pendingCrashFlushTimer) {
      clearTimeout(this.pendingCrashFlushTimer);
      this.pendingCrashFlushTimer = null;
    }
    this.flushTelemetryBuffer();

    const nativeBle = this.getNativeBlePlugin();
    if (this.usingNativeBridge && nativeBle && this.nativeDeviceId) {
      nativeBle.disconnect({ deviceId: this.nativeDeviceId }).catch(() => {});
      return;
    }

    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
  }

  handleDisconnection() {
    console.log("[BLE] Appareil déconnecté.");
    this.isConnected = false;
    this.server = null;
    if (this.onConnectionChange) this.onConnectionChange(false);

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
      const nativeBle = this.getNativeBlePlugin();
      if (this.usingNativeBridge && nativeBle && this.nativeDeviceId) {
        await nativeBle.connect({
          deviceId: this.nativeDeviceId,
          onDisconnected: () => this.handleDisconnection()
        });
        this.isConnected = true;
        if (this.onConnectionChange) this.onConnectionChange(true);
        return;
      }

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
