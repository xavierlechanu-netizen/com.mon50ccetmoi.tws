/**
 * ============================================================================
 * main.c — Point d'entrée du Firmware "Boîte Noire" REV3
 * ============================================================================
 * Cible : ESP32-C3-MINI-1 (ESP-IDF v5.x — Homologation EXP-BB50-2026-REV3)
 *
 * Boucle principale :
 *   1. Vérification eFuse (boîtier brické ?)
 *   2. Initialisation Anti-Tamper (ISR sur GPIO 2 & 3)
 *   3. Initialisation stockage chiffré (AES-256-GCM + Merkle SHA-256 + ECDSA P-256)
 *   4. Initialisation GNSS Quectel L76-LB (UART1 @ 115200 bps / 10 Hz réel)
 *   5. Initialisation BLE Dual-Mode (GATT Server Notify + Indicate + ACK_SEQ_ID)
 *   6. Initialisation Centrale Inertielle MPU6050 (+-16G)
 *   7. Boucle d'acquisition télémétrique 10 Hz + "Last-Gasp Write" sur coupure 12V
 *   8. Deep Sleep si alimentation externe coupée > 5 minutes
 * ============================================================================
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_sleep.h"
#include "esp_timer.h"
#include "nvs_flash.h"

/* ---- Modules internes ---- */
#include "blackbox_pins.h"
#include "tamper.h"
#include "blackbox_storage.h"
#include "ble_comm.h"
#include "gps_parser.h"
#include "imu.h"
#include "factory_console.h"

/* ---- Tag de log ---- */
static const char *TAG = "MAIN";

/* ---- Constantes (Rapport EXP-BB50-2026-REV3) ---- */
#define GPS_UART_NUM        UART_NUM_1
#define GPS_BAUD_INITIAL    9600
#define GPS_BAUD_FAST       115200      /* 115200 bps pour cadence 10 Hz sans latence UART */
#define GPS_BUF_SIZE        1024
#define TELEMETRY_PERIOD_MS 100         /* 10 Hz (1 point / 1,25 m à 45 km/h) */
#define SHOCK_THRESHOLD_X10 30          /* 3.0G = Bascule en GATT Indicate + Flush Flash */
#define DEEP_SLEEP_TIMEOUT  (5 * 60 * 1000000ULL)  /* 5 min en µs */
#define BATTERY_LOW_MV      3000        /* LiFePO4 : en dessous, signer l'accident en cours sans attendre */

/* Commandes PMTK Quectel L76-LB (avec checksum XOR NMEA) */
#define PMTK_SET_BAUD_115200 "$PMTK251,115200*1F\r\n"
#define PMTK_SET_NMEA_10HZ   "$PMTK220,100*2F\r\n"

static volatile bool s_power_fail_triggered = false;
static TaskHandle_t s_event_export_task = NULL;
static volatile uint8_t s_event_export_slot = 0;

/* ---- Prototypes ---- */
static void init_nvs(void);
static void init_gps_uart(void);
static void gps_power_on(void);
static void gps_power_off(void);
static bool is_external_power_present(void);
static void telemetry_task(void *pvParameters);
static void enter_deep_sleep(void);
static void on_export_request(uint32_t start_index, uint32_t count);
static uint16_t on_event_info(uint8_t *buf, uint16_t cap);
static void on_event_export(uint8_t slot);
static void on_ack(uint32_t seq);
static void event_export_task(void *arg);
static uint16_t read_battery_mv(void);

/* ============================================================================
 * app_main() — Point d'entrée (remplace main() sur ESP-IDF)
 * ============================================================================
 */
void app_main(void)
{
    ESP_LOGI(TAG, "╔═══════════════════════════════════════════════╗");
    ESP_LOGI(TAG, "║   BOÎTE NOIRE REV3 — mon 50cc et moi         ║");
    ESP_LOGI(TAG, "║   ESP32-C3 (AES-256-GCM / Merkle / 10 Hz)    ║");
    ESP_LOGI(TAG, "╚═══════════════════════════════════════════════╝");

    /* ================================================================
     * ÉTAPE 0 : Initialisation NVS (Non-Volatile Storage)
     * ================================================================ */
    init_nvs();

    /* ================================================================
     * ÉTAPE 1 : Vérification Anti-Tamper (avant toute autre chose !)
     * ================================================================ */
    if (tamper_is_bricked()) {
        ESP_LOGE(TAG, "████████████████████████████████████████████");
        ESP_LOGE(TAG, "█  BOÎTIER OUVERT — plus d'enregistrement █");
        ESP_LOGE(TAG, "█  Accidents signés récupérables par BLE   █");
        ESP_LOGE(TAG, "████████████████████████████████████████████");

        /* Comme l'enregistreur d'un avion après l'accident : on n'enregistre plus,
         * mais on laisse l'appli récupérer les accidents déjà signés. */
        if (blackbox_storage_init() == ESP_OK && ble_comm_init() == ESP_OK) {
            ble_comm_set_event_callbacks(on_event_info, on_event_export, on_ack);
            ble_comm_update_tamper_state(TAMPER_STATE_DESTROYED);
            xTaskCreate(event_export_task, "evt_export", 3072, NULL, 4, &s_event_export_task);
        }
        while (1) {
            vTaskDelay(pdMS_TO_TICKS(10000));
        }
    }

    /* ================================================================
     * ÉTAPE 2 : Armement du système Anti-Tamper (si broches câblées)
     * ================================================================ */
    if (PIN_TAMPER_LIGHT >= 0 && PIN_TAMPER_MESH >= 0) {
        ESP_LOGI(TAG, "[2/6] Armement du système Anti-Tamper...");
        esp_err_t tamper_err = tamper_init();
        if (tamper_err != ESP_OK) {
            ESP_LOGE(TAG, "ERREUR CRITIQUE : Anti-Tamper non initialisé !");
            esp_restart();
        }
    } else {
        ESP_LOGI(TAG, "[2/6] Anti-Tamper matériel en attente de câblage GPIO.");
    }

    /* ================================================================
     * ÉTAPE 3 : Initialisation du stockage chiffré (AES-256-GCM + ECDSA P-256)
     * ================================================================ */
    ESP_LOGI(TAG, "[3/6] Initialisation du stockage forensique AES-256-GCM...");
    esp_err_t err = blackbox_storage_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "ERREUR : Stockage chiffré non disponible.");
    } else {
        ESP_LOGI(TAG, "  ✓ AES-256-GCM + Merkle SHA-256 + ECDSA P-256 actifs (%lu trames).",
                 (unsigned long)blackbox_storage_count());
        /* Boîtier neuf, sans numéro de série : port série d'usine pour la mise en service */
        factory_console_start();
    }

    /* ================================================================
     * ÉTAPE 4 : Initialisation du GNSS Quectel L76-LB (115200 bps / 10 Hz)
     * ================================================================ */
    ESP_LOGI(TAG, "[4/6] Initialisation du module GNSS 10 Hz...");
    init_gps_uart();
    gps_power_on();
    gps_parser_init();

    /* ================================================================
     * ÉTAPE 5 : Initialisation BLE Dual-Mode (GATT Server)
     * ================================================================ */
    ESP_LOGI(TAG, "[5/6] Initialisation BLE Dual-Mode...");
    err = ble_comm_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "ERREUR : BLE non initialisé.");
    } else {
        ble_comm_set_export_callback(on_export_request);
        ble_comm_set_event_callbacks(on_event_info, on_event_export, on_ack);
        xTaskCreate(event_export_task, "evt_export", 3072, NULL, 4, &s_event_export_task);
        ESP_LOGI(TAG, "  ✓ BLE GATT Server actif (Notify + Indicate + ACK_SEQ_ID).");
    }

    /* ================================================================
     * ÉTAPE 6 : Centrale Inertielle MPU6050 (+-16G)
     * ================================================================ */
    ESP_LOGI(TAG, "[6/6] Initialisation Centrale Inertielle MPU6050 (+-16G)...");
    imu_init();
    ESP_LOGI(TAG, "  ✓ Boîte Noire opérationnelle. Acquisition 10 Hz.");
    ESP_LOGI(TAG, "═══════════════════════════════════════════════");

    xTaskCreate(
        telemetry_task,
        "telemetry",
        4096,
        NULL,
        5,
        NULL
    );
}

/* ============================================================================
 * telemetry_task() — Boucle d'acquisition principale (10 Hz / 100 ms)
 * ============================================================================
 */
static void telemetry_task(void *pvParameters)
{
    (void)pvParameters;
    uint8_t gps_buf[GPS_BUF_SIZE];
    int64_t last_ext_power_time = esp_timer_get_time();
    bool was_ext_powered = true;

    while (1) {
        /* ---- Priorité 0 : Vérifier l'état d'intrusion physique (Two-Stage Zeroization) ---- */
        if (tamper_get_state() != TAMPER_STATE_SAFE) {
            ESP_LOGE(TAG, "🚨 INTRUSION PHYSIQUE DÉTECTÉE — Exécution Zeroization matérielle !");
            blackbox_storage_tamper_wipe();   /* signe l'accident en cours, garde les accidents */
            tamper_zeroize();                 /* marque eFuse « ouvert », redémarre */
        }

        /* ---- Vérifier la présence du 12V véhicule ("Last-Gasp Write" sur coupure) ---- */
        bool ext_power = is_external_power_present();
        if (was_ext_powered && !ext_power) {
            s_power_fail_triggered = true;
        }
        was_ext_powered = ext_power;

        if (s_power_fail_triggered) {
            /* Le boîtier a sa propre batterie : la coupure du 12 V (faisceau arraché dans
             * l'accident, contact coupé) ne l'arrête pas. Il continue d'enregistrer, le GPS
             * reste allumé jusqu'à la fin de la fenêtre (+30 s) et l'appli peut toujours se
             * connecter pour récupérer l'accident. Avant : GPS et Bluetooth coupés et
             * accident signé immédiatement, donc les 30 s après le choc perdues. */
            ESP_LOGW(TAG, "⚡ Coupure du 12 V : fonctionnement sur batterie interne.");
            blackbox_storage_flush();
            s_power_fail_triggered = false;
        }

        /* Batterie qui faiblit : figer et signer tout de suite plutôt que tout perdre */
        if (blackbox_event_pending() && read_battery_mv() < BATTERY_LOW_MV) {
            ESP_LOGW(TAG, "Batterie faible : accident en cours signé sans attendre la fin de la fenêtre.");
            blackbox_event_seal_now();
        }

        /* ---- Lire les trames NMEA du GPS (10 Hz @ 115200 bps) ---- */
        int len = uart_read_bytes(
            GPS_UART_NUM, gps_buf, GPS_BUF_SIZE - 1,
            pdMS_TO_TICKS(20)
        );

        if (len > 0) {
            gps_parser_feed(gps_buf, (uint16_t)len);
        }

        /* ---- Construire la trame depuis les données GPS ---- */
        const gps_data_t *gps = gps_parser_get_data();
        blackbox_frame_t frame;
        memset(&frame, 0, sizeof(frame));

        if (gps->valid) {
            gps_parser_to_frame(gps, &frame);
        }

        /* ---- Compléter la trame avec les données système ---- */
        if (frame.timestamp_utc == 0) {
            frame.timestamp_utc = (uint32_t)(esp_timer_get_time() / 1000000);
            frame.timestamp_ms  = (uint16_t)((esp_timer_get_time() / 1000) % 1000);
        }
        frame.tamper_state = (uint8_t)tamper_get_state();
        if (ext_power) {
            frame.flags |= 0x01; /* Bit 0 : Alimentation 12V présente */
        }

        frame.battery_mv = read_battery_mv();

        /* ---- Lire le capteur inertiel (IMU MPU6050 +-16G) ---- */
        imu_data_t imu_data;
        imu_read_data(&imu_data);
        frame.g_force_x10    = (uint16_t)(imu_data.accel_g * 10.0f);
        frame.lean_angle_deg = (uint8_t)imu_data.lean_angle;
        frame.accel_x_mg     = imu_data.accel_x_mg;
        frame.accel_y_mg     = imu_data.accel_y_mg;
        frame.accel_z_mg     = imu_data.accel_z_mg;

        /* Mettre à jour les valeurs BLE */
        ble_comm_update_battery(frame.battery_mv);
        ble_comm_update_tamper_state(frame.tamper_state);

        /* ---- Enregistrer la trame chiffrée (AES-256-GCM + Chaînage Merkle SHA-256) ---- */
        if (frame.g_force_x10 >= SHOCK_THRESHOLD_X10) {
            frame.flags |= 0x04; /* Bit 2 : Événement Choc >= 3.0G */
        }

        esp_err_t err = blackbox_storage_write(&frame);
        if (err == ESP_OK) {
            ESP_LOGD(TAG, "Trame #%lu enregistrée (seq=%lu).",
                     (unsigned long)blackbox_storage_count(),
                     (unsigned long)frame.seq_id);

            /* Mode Dual BLE (Prescription 1.1 REV3) :
             * - Choc >= 3.0G : GATT Indication avec acquittement obligatoire
             * - Roulage normal : Notification temps réel */
            if (frame.g_force_x10 >= SHOCK_THRESHOLD_X10) {
                ble_comm_indicate_shock_frame((const uint8_t *)&frame, sizeof(frame), frame.seq_id);
            } else {
                ble_comm_notify_frame((const uint8_t *)&frame, sizeof(frame));
            }
        }

        /* ---- Gestion Deep Sleep si alimentation externe absente > 5 min ---- */
        if (ext_power) {
            last_ext_power_time = esp_timer_get_time();
        } else {
            int64_t elapsed = esp_timer_get_time() - last_ext_power_time;
            /* Pas de sommeil profond tant qu'un accident attend d'être récupéré par l'appli
             * (le Bluetooth s'éteindrait) : le téléphone a souvent cassé dans l'accident,
             * le propriétaire peut revenir des heures plus tard avec un autre. */
            if (elapsed > (int64_t)DEEP_SLEEP_TIMEOUT &&
                !blackbox_event_pending() && blackbox_event_oldest_unacked() < 0) {
                ESP_LOGW(TAG, "Alimentation ext. absente > 5 min → Deep Sleep.");
                gps_power_off();
                enter_deep_sleep();
            }
        }

        vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PERIOD_MS));
    }
}

/* ============================================================================
 * read_battery_mv() — Lecture ADC tension batterie LiFePO4 (3.2V nominal)
 * ============================================================================
 */
static uint16_t read_battery_mv(void)
{
    /* À FAIRE avec le plan de l'usine (CONFIG_BB_PIN_VBAT_ADC) : lecture ADC réelle.
     * En attendant, valeur nominale : la signature anticipée sur batterie faible ne
     * se déclenche jamais, celle à +30 s et au redémarrage restent actives. */
    return 3300;
}

/* ============================================================================
 * Initialisation NVS
 * ============================================================================
 */
static void init_nvs(void)
{
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
        ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
}

/* ============================================================================
 * Initialisation UART1 pour le GPS (Quectel L76-LB : 9600 -> 115200 bps @ 10 Hz)
 * ============================================================================
 */
static void init_gps_uart(void)
{
    uart_config_t uart_cfg = {
        .baud_rate  = GPS_BAUD_INITIAL,
        .data_bits  = UART_DATA_8_BITS,
        .parity     = UART_PARITY_DISABLE,
        .stop_bits  = UART_STOP_BITS_1,
        .flow_ctrl  = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };

    ESP_ERROR_CHECK(uart_param_config(GPS_UART_NUM, &uart_cfg));
    ESP_ERROR_CHECK(uart_set_pin(
        GPS_UART_NUM,
        PIN_GPS_TX,     /* ESP TX → GPS RX */
        PIN_GPS_RX,     /* ESP RX ← GPS TX */
        UART_PIN_NO_CHANGE,
        UART_PIN_NO_CHANGE
    ));
    ESP_ERROR_CHECK(uart_driver_install(
        GPS_UART_NUM,
        GPS_BUF_SIZE * 2,
        0, 0, NULL, 0
    ));

    /* Prescription 1.3 (EXP-BB50-2026-REV3) :
     * Reconfigurer le module Quectel L76-LB à 115200 bauds et cadence 10 Hz (100 ms) */
    uart_write_bytes(GPS_UART_NUM, PMTK_SET_BAUD_115200, strlen(PMTK_SET_BAUD_115200));
    uart_wait_tx_done(GPS_UART_NUM, pdMS_TO_TICKS(100));
    vTaskDelay(pdMS_TO_TICKS(50));

    ESP_ERROR_CHECK(uart_set_baudrate(GPS_UART_NUM, GPS_BAUD_FAST));
    vTaskDelay(pdMS_TO_TICKS(50));

    uart_write_bytes(GPS_UART_NUM, PMTK_SET_NMEA_10HZ, strlen(PMTK_SET_NMEA_10HZ));
    uart_wait_tx_done(GPS_UART_NUM, pdMS_TO_TICKS(100));
    ESP_LOGI(TAG, "  ✓ GNSS Quectel L76-LB configuré à 115200 bauds / 10 Hz.");
}

/* ============================================================================
 * Contrôle alimentation GPS (via MOSFET sur PIN_GPS_POWER)
 * ============================================================================
 */
static void gps_power_on(void)
{
    if (PIN_GPS_POWER >= 0) {
        gpio_set_direction(PIN_GPS_POWER, GPIO_MODE_OUTPUT);
        gpio_set_level(PIN_GPS_POWER, 1);
    }
}

static void gps_power_off(void)
{
    if (PIN_GPS_POWER >= 0) {
        gpio_set_level(PIN_GPS_POWER, 0);
    }
}

/* ============================================================================
 * Détection alimentation externe (pont diviseur 12V → GPIO)
 * ============================================================================
 */
static bool is_external_power_present(void)
{
    if (PIN_VEXT_SENSE < 0) {
        return true; /* Alimentation considérée présente si le pont diviseur n'est pas câblé */
    }
    return gpio_get_level(PIN_VEXT_SENSE) == 1;
}

/* ============================================================================
 * Deep Sleep — Réveil par capteur Anti-Tamper ou timer
 * ============================================================================
 */
static void enter_deep_sleep(void)
{
    ESP_LOGI(TAG, "Entrée en Deep Sleep...");

    #if (PIN_TAMPER_LIGHT >= 0) && (PIN_TAMPER_MESH >= 0)
    esp_deep_sleep_enable_gpio_wakeup(
        (1ULL << PIN_TAMPER_LIGHT) | (1ULL << PIN_TAMPER_MESH),
        ESP_GPIO_WAKEUP_GPIO_HIGH
    );
    #endif

    /* Réveil périodique toutes les 30 minutes pour envoyer un "heartbeat" */
    esp_sleep_enable_timer_wakeup(30 * 60 * 1000000ULL);
    esp_deep_sleep_start();
}

/* ============================================================================
 * on_export_request() — Callback BLE d'export des trames
 * ============================================================================
 */
/* ============================================================================
 * Événements d'accident signés : lecture, export (tâche dédiée), acquittement
 * ============================================================================
 */
static uint16_t on_event_info(uint8_t *buf, uint16_t cap)
{
    if (cap < 65) {
        return 0;
    }
    if (blackbox_storage_get_pubkey(buf) != ESP_OK) {
        memset(buf, 0, 65);
    }
    uint16_t n = 65;
    int slot = blackbox_event_oldest_unacked();
    blackbox_event_t ev;
    if (slot >= 0 && cap >= n + sizeof(ev) && blackbox_event_get((uint8_t)slot, &ev) == ESP_OK) {
        memcpy(buf + n, &ev, sizeof(ev));
        n += sizeof(ev);
    }
    return n;
}

/* Appelé depuis la tâche BLE : on ne fait que réveiller la tâche d'export */
static void on_event_export(uint8_t slot)
{
    if (slot < BLACKBOX_EVENT_SLOTS && s_event_export_task != NULL) {
        s_event_export_slot = slot;
        xTaskNotifyGive(s_event_export_task);
    }
}

static void on_ack(uint32_t seq)
{
    if (blackbox_event_ack(seq) == ESP_OK) {
        ESP_LOGI(TAG, "Événement terminé en #%lu acquitté : emplacement libéré.", (unsigned long)seq);
    }
}

static void event_export_task(void *arg)
{
    (void)arg;
    for (;;) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        const uint8_t slot = s_event_export_slot;
        blackbox_event_t ev;
        if (blackbox_event_get(slot, &ev) != ESP_OK) {
            continue;
        }
        uint32_t count = ev.end_seq - ev.start_seq + 1;
        ESP_LOGI(TAG, "Export de l'événement %u : %lu trames.", slot, (unsigned long)count);
        for (uint32_t i = 0; i < count; i++) {
            blackbox_frame_t frame;
            if (blackbox_event_read_frame(slot, i, &frame) == ESP_OK) {
                ble_comm_notify_frame((const uint8_t *)&frame, sizeof(frame));
            }
            memset(&frame, 0, sizeof(frame));
            vTaskDelay(pdMS_TO_TICKS(20));
        }
    }
}

static void on_export_request(uint32_t start_index, uint32_t count)
{
    uint32_t total = blackbox_storage_count();

    if (start_index >= total) {
        ESP_LOGW(TAG, "Export : index de départ invalide (%lu >= %lu)",
                 (unsigned long)start_index, (unsigned long)total);
        return;
    }

    if (count == 0 || start_index + count > total) {
        count = total - start_index;
    }

    ESP_LOGI(TAG, "Export BLE : trames %lu à %lu (%lu trames)...",
             (unsigned long)start_index,
             (unsigned long)(start_index + count - 1),
             (unsigned long)count);

    for (uint32_t i = start_index; i < start_index + count; i++) {
        blackbox_frame_t frame;
        esp_err_t err = blackbox_storage_read(i, &frame);

        if (err == ESP_OK) {
            ble_comm_notify_frame((const uint8_t *)&frame, sizeof(frame));
            vTaskDelay(pdMS_TO_TICKS(50));
        } else {
            ESP_LOGW(TAG, "Export : erreur lecture trame #%lu", (unsigned long)i);
        }

        memset(&frame, 0, sizeof(frame));
    }

    ESP_LOGI(TAG, "Export BLE terminé.");
}
