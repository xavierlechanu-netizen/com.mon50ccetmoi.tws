#include <Arduino.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include "mbedtls/gcm.h"
#include "mbedtls/sha256.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_random.h"
#include <esp_task_wdt.h>

#define WDT_TIMEOUT 5 // 5 seconds Watchdog

// Clé AES-256 stockée en mémoire (chargée depuis la NVS au démarrage)
uint8_t aes_key[32] = {0};
bool nvsKeyLoaded = false;
uint32_t ble_passkey = 0; // Chargé depuis la NVS (ou PIN aléatoire TRNG)
bool nvsPinLoaded = false;

// Chaînage de hachage de Merkle (Anti-troncature ISO/IEC 27037)
uint32_t g_seq_id = 0;
uint8_t g_prev_hash[32] = {0};
volatile uint32_t g_last_acked_seq_id = 0;

// ─────────────────────────────────────────────────────────────
// CONFIGURATION GPS (Quectel L76-LB — 115200 bauds @ 10 Hz)
// ─────────────────────────────────────────────────────────────
TinyGPSPlus gps;
HardwareSerial GPS_Serial(1); // Utilisation de l'UART 1
const int RXPin = 16;
const int TXPin = 17;
const uint32_t GPSBaudInit = 9600;
const uint32_t GPSBaudFast = 115200;

// ─────────────────────────────────────────────────────────────
// CONFIGURATION MPU6050 (Accéléromètre / Gyroscope +-16G)
// ─────────────────────────────────────────────────────────────
const int MPU_ADDR = 0x68;
int16_t AcX, AcY, AcZ;

// ─────────────────────────────────────────────────────────────
// CONFIGURATION BLE (Dual-Mode Notify + Indicate / ACK_SEQ_ID)
// ─────────────────────────────────────────────────────────────
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
BLECharacteristic* pAckCharacteristic = NULL;
BLECharacteristic* pBatteryCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// UUIDs définis pour correspondre au Frontend PWA (blackbox-ble.js)
#define DEVICE_NAME             "BB50-V2"
#define SERVICE_UUID            "50cc0001-4d6f-6e35-306363657431" // Télémétrie
#define CHARACTERISTIC_UUID     "50cc0102-4d6f-6e35-306363657431" // Frame Data (Notify + Indicate)
#define ACK_SEQ_CHAR_UUID       "50cc0104-4d6f-6e35-306363657431" // ACK_SEQ_ID (Write)
#define DIAGNOSTIC_SERVICE_UUID "50cc0002-4d6f-6e35-306363657431" // Diagnostic
#define BATTERY_CHAR_UUID       "50cc0201-4d6f-6e35-306363657431" // Batterie

const int BATTERY_PIN = 34; // Pin ADC Batterie
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 100; // 10Hz réel (100ms)
unsigned long lastDiagnosticTime = 0;
const unsigned long DIAGNOSTIC_INTERVAL = 5000; // 5s

// ─────────────────────────────────────────────────────────────
// CALLBACKS BLE
// ─────────────────────────────────────────────────────────────
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("📱 PWA (Smartphone) Connecté !");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("📱 PWA Déconnecté !");
    }
};

class AckSeqCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pChar) {
      std::string val = pChar->getValue();
      if (val.length() == 4) {
        uint32_t acked_seq = 0;
        memcpy(&acked_seq, val.data(), 4);
        g_last_acked_seq_id = acked_seq;
        Serial.printf("✅ [BLE] ACK_SEQ_ID applicatif reçu pour seq_id=%u\n", acked_seq);
      }
    }
};

void computeMerkleStep(const uint8_t prevHash[32], const uint8_t* payload, size_t payloadLen, uint8_t outHash[32]) {
  mbedtls_sha256_context sha;
  mbedtls_sha256_init(&sha);
  mbedtls_sha256_starts(&sha, 0); // SHA-256
  mbedtls_sha256_update(&sha, prevHash, 32);
  mbedtls_sha256_update(&sha, payload, payloadLen);
  mbedtls_sha256_finish(&sha, outHash);
  mbedtls_sha256_free(&sha);
}

void bytesToHexTrunc(const uint8_t* bytes, size_t len, char* outHex) {
  static const char hexChars[] = "0123456789abcdef";
  for (size_t i = 0; i < len; i++) {
    outHex[i * 2]     = hexChars[(bytes[i] >> 4) & 0x0F];
    outHex[i * 2 + 1] = hexChars[bytes[i] & 0x0F];
  }
  outHex[len * 2] = '\0';
}

void setupMPU() {
  Wire.begin();
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1 register
  Wire.write(0);     // Set to zero (wakes up the MPU-6050)
  Wire.endTransmission(true);

  // Configuration de l'accéléromètre à +-16g (ACCEL_CONFIG 0x1C = 0x18)
  // Indispensable pour la détection de chocs/accidents 50cc (jusqu'à 16G sans saturation)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);
  Wire.write(0x18);  // AFS_SEL = 3 (+-16g)
  Wire.endTransmission(true);

  Serial.println("✅ Capteur MPU6050 initialisé (Pleine échelle +-16G calibrée).");
}

String deviceMAC = "";

void setupBLE() {
  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setMTU(256);

  // BLE Secure Connections (OWASP ASVS v5.0.0-12.x)
  BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT_MITM);
  BLEDevice::setSecurityAuth(true, true, true); // bonding, MITM, Secure Connections

  esp_ble_gap_set_security_param(ESP_BLE_SM_SET_STATIC_PASSKEY, &ble_passkey, sizeof(uint32_t));
  esp_ble_gap_set_security_param(ESP_BLE_SM_AUTHEN_REQ_MODE,
    (uint8_t[]){ESP_LE_AUTH_REQ_SC_MITM_BOND}, sizeof(uint8_t));

  deviceMAC = BLEDevice::getAddress().toString().c_str();

  // Initialisation de la graine de hachage de Merkle : SHA-256("BB50-GENESIS:" + MAC)
  String genesis = "BB50-GENESIS:" + deviceMAC;
  mbedtls_sha256((const uint8_t*)genesis.c_str(), genesis.length(), g_prev_hash, 0);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // --- Création du Service Télémétrie ---
  BLEService *pService = pServer->createService(SERVICE_UUID);
  // Dual-Mode BLE : PROPERTY_NOTIFY (flux normal < 3G) + PROPERTY_INDICATE (choc critique >= 3G)
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_INDICATE
                    );
  pCharacteristic->addDescriptor(new BLE2902());
  pCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENC_MITM);

  // Caractéristique ACK_SEQ_ID (0x0104) pour acquittement applicatif post-crash
  pAckCharacteristic = pService->createCharacteristic(
                      ACK_SEQ_CHAR_UUID,
                      BLECharacteristic::PROPERTY_WRITE
                    );
  pAckCharacteristic->setAccessPermissions(ESP_GATT_PERM_WRITE_ENC_MITM);
  pAckCharacteristic->setCallbacks(new AckSeqCallbacks());

  pService->start();

  // --- Création du Service Diagnostic ---
  BLEService *pDiagService = pServer->createService(DIAGNOSTIC_SERVICE_UUID);
  pBatteryCharacteristic = pDiagService->createCharacteristic(
                      BATTERY_CHAR_UUID,
                      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
                    );
  pBatteryCharacteristic->addDescriptor(new BLE2902());
  pBatteryCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENC_MITM);
  pDiagService->start();

  // Démarrage du Broadcast (Advertising)
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->addServiceUUID(DIAGNOSTIC_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
  Serial.println("✅ Boîte Noire BLE Prête (Secure Connections + Dual-Mode Indicate activés) !");
}

void setupGPS() {
  // 1. Démarrage initial à 9600 bauds pour reconfigurer le Quectel L76-LB
  GPS_Serial.begin(GPSBaudInit, SERIAL_8N1, RXPin, TXPin);
  delay(100);
  // Bascule du baudrate NMEA à 115200 bauds (EXP-BB50-2026-REV3 §2.2)
  GPS_Serial.print("$PMTK251,115200*1F\r\n");
  GPS_Serial.flush();
  delay(100);
  GPS_Serial.updateBaudRate(GPSBaudFast);
  // Cadence de rafraîchissement GNSS à 10 Hz réel (100 ms)
  GPS_Serial.print("$PMTK220,100*2F\r\n");
  GPS_Serial.flush();
  Serial.println("✅ Module GNSS Quectel L76-LB initialisé à 115200 bauds / 10 Hz réel.");
}

void setupNVS() {
  esp_err_t err = nvs_flash_init();
  if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    err = nvs_flash_init();
  }
  ESP_ERROR_CHECK(err);

  Serial.println("✅ NVS initialisée.");

  nvs_handle_t my_handle;
  err = nvs_open("storage", NVS_READONLY, &my_handle);
  if (err != ESP_OK) {
    Serial.println("❌ Erreur : Impossible d'ouvrir la NVS. Clé AES absente !");
  } else {
    size_t required_size = 32;
    err = nvs_get_blob(my_handle, "aes_key", aes_key, &required_size);
    if (err == ESP_OK && required_size == 32) {
      nvsKeyLoaded = true;
      Serial.println("🔐 Clé AES-256-GCM chargée avec succès depuis la NVS.");
    } else {
      memset(aes_key, 0, 32);
      nvsKeyLoaded = false;
      Serial.println("❌ Erreur : Clé AES introuvable ou invalide dans la NVS. Chiffrement désactivé !");
    }

    uint32_t stored_pin = 0;
    err = nvs_get_u32(my_handle, "ble_pin", &stored_pin);
    if (err == ESP_OK && stored_pin >= 100000 && stored_pin <= 999999) {
      ble_passkey = stored_pin;
      nvsPinLoaded = true;
      Serial.println("🔐 PIN BLE unique chargé avec succès depuis la NVS.");
    } else {
      ble_passkey = 100000 + (esp_random() % 900000);
      nvsPinLoaded = false;
      Serial.printf("⚠️ Aucun PIN configuré en NVS : PIN aléatoire éphémère généré (%06u).\n", ble_passkey);
    }
    nvs_close(my_handle);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("🚀 Démarrage de la Boîte Noire mon50ccetmoi (REV3 — AES-256-GCM + Merkle + 10Hz)...");

  // Init Hardware Watchdog
  esp_task_wdt_init(WDT_TIMEOUT, true);
  esp_task_wdt_add(NULL);

  setupNVS();
  setupMPU();
  setupGPS();
  setupBLE();
}

void loop() {
  esp_task_wdt_reset();

  // Lecture continue des trames NMEA 10 Hz du GPS
  while (GPS_Serial.available() > 0) {
    gps.encode(GPS_Serial.read());
  }

  unsigned long currentMillis = millis();

  if (deviceConnected) {
    // ---- BOUCLE DIAGNOSTIC BATTERIE (LiFePO4 3.2V nominal) ----
    if (currentMillis - lastDiagnosticTime >= DIAGNOSTIC_INTERVAL) {
      lastDiagnosticTime = currentMillis;
      int rawAdc = analogRead(BATTERY_PIN);
      float voltage = (rawAdc / 4095.0) * 3.3 * 2;
      int batteryPct = map((int)(voltage * 100), 280, 365, 0, 100);
      batteryPct = constrain(batteryPct, 0, 100);

      uint8_t battData[1] = { (uint8_t)batteryPct };
      pBatteryCharacteristic->setValue(battData, 1);
      pBatteryCharacteristic->notify();
    }

    // ---- BOUCLE TÉLÉMÉTRIE NON-BLOQUANTE 10 Hz ----
    if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL) {
      lastTelemetryTime = currentMillis;

      // 1. Lire le capteur I2C
      Wire.beginTransmission(MPU_ADDR);
      Wire.write(0x3B);
      Wire.endTransmission(false);
      Wire.requestFrom(MPU_ADDR, 6, true);

      if (Wire.available() == 6) {
        AcX = Wire.read() << 8 | Wire.read();
        AcY = Wire.read() << 8 | Wire.read();
        AcZ = Wire.read() << 8 | Wire.read();

        // Convertir en Force G (MPU6050 configuré en +-16g = 2048.0 LSB/g)
        float gX = AcX / 2048.0;
        float gY = AcY / 2048.0;
        float gZ = AcZ / 2048.0;

        float gTotal = sqrt((gX * gX) + (gY * gY) + (gZ * gZ));
        float leanAngle = atan2(gY, gZ) * 180 / PI;

        // 2. Extraire les données GPS et horodatage UTC à la milliseconde (10 Hz)
        float speedKmh = 0;
        float latitude = 0;
        float longitude = 0;
        uint32_t epoch_utc = 0;
        uint16_t subsec_ms = (uint16_t)(currentMillis % 1000);
        bool time_synced = false;

        if (gps.location.isValid()) {
          latitude = gps.location.lat();
          longitude = gps.location.lng();
        }
        if (gps.speed.isValid()) {
          speedKmh = gps.speed.kmph();
        }

        if (gps.date.isValid() && gps.time.isValid() && gps.date.year() >= 2024) {
          struct tm t = {0};
          t.tm_year = gps.date.year() - 1900;
          t.tm_mon  = gps.date.month() - 1;
          t.tm_mday = gps.date.day();
          t.tm_hour = gps.time.hour();
          t.tm_min  = gps.time.minute();
          t.tm_sec  = gps.time.second();
          t.tm_isdst = 0;
          time_t epoch = mktime(&t);
          if (epoch > 0) {
            epoch_utc = (uint32_t)epoch;
            subsec_ms = (uint16_t)(gps.time.centisecond() * 10);
            time_synced = true;
          }
        }
        if (epoch_utc == 0) {
          epoch_utc = currentMillis / 1000;
        }

        if (!nvsKeyLoaded) {
          Serial.println("⛔ ERREUR SÉCURITÉ : Clé AES non provisionnée. Transmission télémétrique annulée.");
          return;
        }

        // 3. Incrémenter le numéro de séquence monotone & formater l'empreinte Merkle précédente
        uint32_t seq_id = ++g_seq_id;
        char prevHashHex[33];
        bytesToHexTrunc(g_prev_hash, 16, prevHashHex);

        // 4. Préparer le payload JSON probant
        StaticJsonDocument<320> doc;
        doc["id"] = deviceMAC;
        doc["seq"] = seq_id;
        doc["ts"] = epoch_utc;
        doc["ms"] = subsec_ms;
        doc["utc"] = time_synced;
        doc["g"] = gTotal;
        doc["gx"] = (int)(gX * 1000);
        doc["gy"] = (int)(gY * 1000);
        doc["gz"] = (int)(gZ * 1000);
        doc["lean"] = leanAngle;
        doc["spd"] = speedKmh;
        doc["lat"] = latitude;
        doc["lng"] = longitude;
        doc["ph"] = prevHashHex; // Chaînage de Merkle (128 bits tronqués en hex)

        char jsonBuffer[320];
        size_t jsonLen = serializeJson(doc, jsonBuffer);

        // Calcul du nouveau maillon de la chaîne de Merkle : Hash_N = SHA-256(Hash_{N-1} || Payload_N)
        uint8_t next_hash[32];
        computeMerkleStep(g_prev_hash, (const uint8_t*)jsonBuffer, jsonLen, next_hash);
        memcpy(g_prev_hash, next_hash, 32);

        // 5. Chiffrement Authentifié AES-256-GCM (NIST SP 800-38D /FIPS 140-3)
        // Nonce 96 bits (12 octets) généré par TRNG matériel + Tag GMAC 128 bits (16 octets)
        uint8_t nonce[12];
        esp_fill_random(nonce, 12);

        uint8_t aad[4];
        memcpy(aad, &seq_id, 4);

        uint8_t gmacTag[16];
        uint8_t encryptedPayload[320];

        mbedtls_gcm_context gcm;
        mbedtls_gcm_init(&gcm);
        int rc = mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES, aes_key, 256);
        if (rc == 0) {
          rc = mbedtls_gcm_crypt_and_tag(
            &gcm,
            MBEDTLS_GCM_ENCRYPT,
            jsonLen,
            nonce, sizeof(nonce),
            aad, sizeof(aad),
            (const uint8_t*)jsonBuffer,
            encryptedPayload,
            sizeof(gmacTag), gmacTag
          );
        }
        mbedtls_gcm_free(&gcm);
        if (rc != 0) {
          Serial.println("❌ Erreur chiffrement AES-256-GCM !");
          return;
        }

        // 6. Création de la Trame Hybride REV3 :
        // [0..15]  En-tête clair 16 octets : timestamp(4B) | latE7(4B) | lonE7(4B) | speed10(2B) | gForceX10(1B) | flags(1B: 0xA3 = GCM+Merkle)
        // [16..19] seq_id (4 octets, AAD)
        // [20..31] Nonce GCM 96-bit (12 octets)
        // [32..47] Tag GMAC 128-bit (16 octets)
        // [48..N]  Ciphertext AES-256-GCM
        uint8_t blePacket[48 + 320];
        uint32_t timestamp = epoch_utc;
        int32_t latE7 = (int32_t)(latitude * 1e7);
        int32_t lonE7 = (int32_t)(longitude * 1e7);
        uint16_t speed10 = (uint16_t)(speedKmh * 10);
        uint8_t gForceX10 = (gTotal * 10.0f > 255.0f) ? 255 : (uint8_t)(gTotal * 10.0f);
        uint8_t frameFlags = 0xA3; // 0xA3 = Format REV3 AES-256-GCM + Merkle

        memcpy(blePacket + 0, &timestamp, 4);
        memcpy(blePacket + 4, &latE7, 4);
        memcpy(blePacket + 8, &lonE7, 4);
        memcpy(blePacket + 12, &speed10, 2);
        blePacket[14] = gForceX10;
        blePacket[15] = frameFlags;

        memcpy(blePacket + 16, &seq_id, 4);
        memcpy(blePacket + 20, nonce, 12);
        memcpy(blePacket + 32, gmacTag, 16);
        memcpy(blePacket + 48, encryptedPayload, jsonLen);
        size_t totalLen = 48 + jsonLen;

        // 7. Transmission BLE Dual-Mode :
        // - Choc critique >= 3.0G : GATT Indication (avec acquittement matériel + ACK_SEQ_ID applicatif)
        // - Flux normal < 3.0G    : GATT Notification (faible latence)
        pCharacteristic->setValue(blePacket, totalLen);
        if (gTotal >= 3.0f) {
          pCharacteristic->indicate();
        } else {
          pCharacteristic->notify();
        }
      }
    }
  }

  // Gestion des déconnexions (Restart Advertising)
  if (!deviceConnected && oldDeviceConnected) {
      delay(500);
      pServer->startAdvertising();
      Serial.println("🔄 Redémarrage du broadcast BLE...");
      oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = deviceConnected;
  }
}
