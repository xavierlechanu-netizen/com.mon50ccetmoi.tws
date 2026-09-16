#include <Arduino.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include "mbedtls/aes.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_random.h"
#include <esp_task_wdt.h>

#define WDT_TIMEOUT 5 // 5 seconds Watchdog

// Clé AES-256 stockée en mémoire (chargée depuis la NVS au démarrage)
uint8_t aes_key[32] = {0};
bool nvsKeyLoaded = false;

// ─────────────────────────────────────────────────────────────
// CONFIGURATION GPS (NEO-6M)
// ─────────────────────────────────────────────────────────────
TinyGPSPlus gps;
HardwareSerial GPS_Serial(1); // Utilisation de l'UART 1
const int RXPin = 16;
const int TXPin = 17;
const uint32_t GPSBaud = 9600;


// ─────────────────────────────────────────────────────────────
// CONFIGURATION MPU6050 (Accéléromètre / Gyroscope)
// ─────────────────────────────────────────────────────────────
const int MPU_ADDR = 0x68;
int16_t AcX, AcY, AcZ;

// ─────────────────────────────────────────────────────────────
// CONFIGURATION BLE
// ─────────────────────────────────────────────────────────────
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
BLECharacteristic* pBatteryCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// UUIDs définis pour correspondre au Frontend PWA (blackbox-ble.js)
#define DEVICE_NAME             "BB50-V1"
#define SERVICE_UUID            "50cc0001-4d6f-6e35-306363657431" // Télémétrie
#define CHARACTERISTIC_UUID     "50cc0102-4d6f-6e35-306363657431" // Frame Data
#define DIAGNOSTIC_SERVICE_UUID "50cc0002-4d6f-6e35-306363657431" // Diagnostic
#define BATTERY_CHAR_UUID       "50cc0201-4d6f-6e35-306363657431" // Batterie

const int BATTERY_PIN = 34; // Pin ADC Batterie
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 100; // 10Hz
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

void setupMPU() {
  Wire.begin();
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1 register
  Wire.write(0);     // Set to zero (wakes up the MPU-6050)
  Wire.endTransmission(true);
  Serial.println("✅ Capteur MPU6050 initialisé.");
}

String deviceMAC = "";

void setupBLE() {
  // Initialisation du BLE
  BLEDevice::init(DEVICE_NAME); // Nom visible lors du scan Web Bluetooth
  
  // Récupération de l'adresse MAC (utilisé comme Identifiant Unique / IMEI / FIDO)
  deviceMAC = BLEDevice::getAddress().toString().c_str();
  
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // --- Création du Service Télémétrie ---
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();

  // --- Création du Service Diagnostic ---
  BLEService *pDiagService = pServer->createService(DIAGNOSTIC_SERVICE_UUID);
  pBatteryCharacteristic = pDiagService->createCharacteristic(
                      BATTERY_CHAR_UUID,
                      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
                    );
  pBatteryCharacteristic->addDescriptor(new BLE2902());
  pDiagService->start();

  // Démarrage du Broadcast (Advertising)
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->addServiceUUID(DIAGNOSTIC_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
  Serial.println("✅ Boîte Noire BLE Prête ! En attente du smartphone...");
}

void setupGPS() {
  GPS_Serial.begin(GPSBaud, SERIAL_8N1, RXPin, TXPin);
  Serial.println("✅ Module GPS initialisé (RX: 16, TX: 17).");
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
      Serial.println("🔐 Clé AES-256 chargée avec succès depuis la NVS.");
    } else {
      Serial.println("❌ Erreur : Clé AES introuvable ou taille invalide dans la NVS.");
    }
    nvs_close(my_handle);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("🚀 Démarrage de la Boîte Noire mon50ccetmoi...");
  
  // Init Hardware Watchdog
  esp_task_wdt_init(WDT_TIMEOUT, true);
  esp_task_wdt_add(NULL);

  setupNVS();
  setupMPU();
  setupGPS();
  setupBLE();
}

void loop() {
  esp_task_wdt_reset(); // Reset watchdog timer

  // Lecture continue des trames NMEA du GPS
  while (GPS_Serial.available() > 0) {
    gps.encode(GPS_Serial.read());
  }

  unsigned long currentMillis = millis();

  if (deviceConnected) {
    // ---- BOUCLE DIAGNOSTIC BATTERIE ----
    if (currentMillis - lastDiagnosticTime >= DIAGNOSTIC_INTERVAL) {
      lastDiagnosticTime = currentMillis;
      int rawAdc = analogRead(BATTERY_PIN);
      float voltage = (rawAdc / 4095.0) * 3.3 * 2; // Exemple de diviseur de tension
      int batteryPct = map((int)(voltage * 100), 320, 420, 0, 100);
      batteryPct = constrain(batteryPct, 0, 100);
      
      uint8_t battData[1] = { (uint8_t)batteryPct };
      pBatteryCharacteristic->setValue(battData, 1);
      pBatteryCharacteristic->notify();
    }

    // ---- BOUCLE TÉLÉMÉTRIE NON-BLOQUANTE ----
    if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL) {
      lastTelemetryTime = currentMillis;
    // 1. Lire le capteur I2C
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);  // Starting with register 0x3B (ACCEL_XOUT_H)
    Wire.endTransmission(false);
    Wire.requestFrom(MPU_ADDR, 6, true);  // Request a total of 6 registers
    
    // Si on obtient bien 6 bytes
    if(Wire.available() == 6) {
      AcX = Wire.read()<<8|Wire.read();
      AcY = Wire.read()<<8|Wire.read();
      AcZ = Wire.read()<<8|Wire.read();

      // Convertir en Force G (MPU6050 défaut +-2g = 16384 LSB/g)
      float gX = AcX / 16384.0;
      float gY = AcY / 16384.0;
      float gZ = AcZ / 16384.0;

      // Calcul de la Force G Totale (Vecteur 3D)
      float gTotal = sqrt((gX * gX) + (gY * gY) + (gZ * gZ));

      // Calcul de l'angle d'inclinaison grossier (Roll)
      float leanAngle = atan2(gY, gZ) * 180 / PI;

      // 2. Extraire les données GPS
      float speedKmh = 0;
      float latitude = 0;
      float longitude = 0;

      if (gps.location.isValid()) {
        latitude = gps.location.lat();
        longitude = gps.location.lng();
      }
      if (gps.speed.isValid()) {
        speedKmh = gps.speed.kmph();
      }

      // 3. Préparer le payload JSON
      StaticJsonDocument<256> doc;
      doc["id"] = deviceMAC; // Identifiant unique du boîtier (IMEI/MAC)
      doc["g"] = gTotal;
      doc["lean"] = leanAngle;
      doc["spd"] = speedKmh;
      doc["lat"] = latitude;
      doc["lng"] = longitude;

      char jsonBuffer[256];
      size_t jsonLen = serializeJson(doc, jsonBuffer);

      // 4. Chiffrement AES-256-CBC du JSON (Zero-Knowledge / E2EE)
      // Génération d'un IV (Vecteur d'Initialisation) aléatoire et unique pour cette opération
      uint8_t iv[16];
      esp_fill_random(iv, 16);
      
      // On garde une copie de l'IV car mbedtls_aes_crypt_cbc modifie le buffer iv en interne
      uint8_t iv_copy[16];
      memcpy(iv_copy, iv, 16);
      
      // Padding PKCS#7
      uint8_t pad_val = 16 - (jsonLen % 16);
      size_t paddedLen = jsonLen + pad_val;
      for (size_t i = jsonLen; i < paddedLen; i++) {
          jsonBuffer[i] = pad_val;
      }
      
      uint8_t encryptedPayload[256];
      mbedtls_aes_context aes;
      mbedtls_aes_init(&aes);
      // Utilisation de la clé chargée depuis la NVS
      mbedtls_aes_setkey_enc(&aes, aes_key, 256);
      mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_ENCRYPT, paddedLen, iv, (uint8_t*)jsonBuffer, encryptedPayload);
      mbedtls_aes_free(&aes);

      // 5. Création de la Trame Hybride (16 octets Clair + 16 octets IV + Payload Chiffré)
      uint8_t blePacket[256 + 32];
      
      uint32_t timestamp = millis(); 
      int32_t latE7 = latitude * 1e7;
      int32_t lonE7 = longitude * 1e7;
      uint16_t speed10 = speedKmh * 10;
      
      // En-tête en clair pour le Smartphone (Dashboard)
      memcpy(blePacket + 0, &timestamp, 4);
      memcpy(blePacket + 4, &latE7, 4);
      memcpy(blePacket + 8, &lonE7, 4);
      memcpy(blePacket + 12, &speed10, 2);
      blePacket[14] = 0; // padding
      blePacket[15] = 0; // padding
      
      // Concaténation de l'IV puis de la preuve chiffrée
      memcpy(blePacket + 16, iv_copy, 16);
      memcpy(blePacket + 32, encryptedPayload, paddedLen);
      size_t totalLen = 32 + paddedLen;

      // 6. Envoyer la télémétrie en BLE
      pCharacteristic->setValue(blePacket, totalLen);
      pCharacteristic->notify();
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
