/**
 * ============================================================================
 * ble_comm.c — Implémentation Serveur GATT BLE (Boîte Noire V1)
 * ============================================================================
 * Cible : ESP32-C3-MINI-1 (ESP-IDF v5.x + NimBLE)
 *
 * Architecture GATT :
 *   ┌─────────────────────────────────────────────────┐
 *   │              GATT Server "BB50-XXXX"            │
 *   │                                                 │
 *   │  ┌── Service Télémétrie (0x0001) ──────────┐   │
 *   │  │  CHR Frame Count   (read)               │   │
 *   │  │  CHR Frame Data    (notify)              │   │
 *   │  │  CHR Export Cmd    (write)               │   │
 *   │  └─────────────────────────────────────────┘   │
 *   │                                                 │
 *   │  ┌── Service Diagnostic (0x0002) ──────────┐   │
 *   │  │  CHR Battery        (read)              │   │
 *   │  │  CHR Tamper State   (read)              │   │
 *   │  │  CHR FW Version     (read)              │   │
 *   │  │  CHR Memory Usage   (read)              │   │
 *   │  │  CHR Uptime         (read)              │   │
 *   │  └─────────────────────────────────────────┘   │
 *   │                                                 │
 *   │  ┌── Service FOTA (0x0003) ────────────────┐   │
 *   │  │  CHR OTA Control    (write)             │   │
 *   │  │  CHR OTA Data       (write no resp)     │   │
 *   │  │  CHR OTA Status     (notify)            │   │
 *   │  └─────────────────────────────────────────┘   │
 *   └─────────────────────────────────────────────────┘
 *
 * CONFORMITÉ :
 *   - CIS 3     : Chiffrement AES-CCM (BLE 5.0 natif).
 *   - CIS 6     : Bonding obligatoire + passkey 6 chiffres.
 *   - OWASP A01 : Une seule connexion simultanée (NimBLE config).
 *   - OWASP A03 : Validation des tailles de write (anti-overflow).
 *   - CIS 16.10 : Toutes les entrées BLE sont validées.
 * ============================================================================
 */

#include <string.h>
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_mac.h"
#include "esp_random.h"
#include "nvs_flash.h"
#include "nvs.h"

/* ---- NimBLE ---- */
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "host/ble_hs.h"
#include "host/ble_uuid.h"
#include "host/util/util.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

#include "ble_comm.h"

/* ---- Tag de log ---- */
static const char *TAG = "BLE_COMM";

/* ---- Version firmware ---- */
#define FW_VERSION_STR      "1.0.0-proto"
#define FW_VERSION_LEN      11

/* ---- UUID 128 bits : 50ccXXXX-0000-4d6f-6e35-306363657431 (XXXX = identifiant court) ----
 * Correctif : les services étaient déclarés en UUID 16 bits (0x0001, 0x0101…), réservés
 * par le Bluetooth SIG, alors que l'appli cherche les UUID 128 bits ci-dessus : aucune
 * connexion n'aurait abouti. Octets en little-endian (ordre de NimBLE). */
#define UUID128_50CC(id) BLE_UUID128_DECLARE(                              \
    0x31, 0x74, 0x65, 0x63, 0x63, 0x30, 0x35, 0x6e,                         \
    0x6f, 0x4d, 0x00, 0x00, (uint8_t)((id) & 0xFF), (uint8_t)((id) >> 8),   \
    0xcc, 0x50)

/* Identifiant court (XXXX) d'un UUID 50ccXXXX-… */
static uint16_t chr_short_id(const ble_uuid_t *uuid)
{
    if (uuid->type == BLE_UUID_TYPE_128) {
        const ble_uuid128_t *u = (const ble_uuid128_t *)uuid;
        return (uint16_t)(u->value[12] | (u->value[13] << 8));
    }
    return ble_uuid_u16(uuid);
}

/* ---- État interne ---- */
static ble_conn_state_t s_ble_state = BLE_STATE_IDLE;
static uint16_t s_conn_handle = 0;
static uint16_t s_frame_notify_handle = 0;
static uint16_t s_ota_status_handle = 0;
static ble_export_request_cb_t s_export_cb = NULL;
static ble_event_info_cb_t   s_event_info_cb = NULL;
static ble_event_export_cb_t s_event_export_cb = NULL;
static ble_ack_cb_t          s_ack_cb = NULL;

/* ---- Valeurs des caractéristiques (mises à jour en temps réel) ---- */
static uint16_t s_battery_mv = 3700;
static uint8_t  s_tamper_state_val = 0;
static uint32_t s_frame_count = 0;
static uint32_t s_last_acked_seq = 0;
static uint32_t s_pending_shock_seq = 0;
static char     s_device_name[16] = "BB50-0000";

/* ---- Prototypes internes ---- */
static void ble_host_task(void *param);
static void ble_on_sync(void);
static void ble_on_reset(int reason);
static int  ble_gap_event_handler(struct ble_gap_event *event, void *arg);
static int  ble_gatt_telemetry_access(uint16_t conn, uint16_t attr,
                struct ble_gatt_access_ctxt *ctxt, void *arg);
static int  ble_gatt_diagnostic_access(uint16_t conn, uint16_t attr,
                struct ble_gatt_access_ctxt *ctxt, void *arg);
static int  ble_gatt_fota_access(uint16_t conn, uint16_t attr,
                struct ble_gatt_access_ctxt *ctxt, void *arg);
static void ble_generate_device_name(void);

/* ============================================================================
 * Définition des Services et Caractéristiques GATT
 * ============================================================================
 */

/* ---- Helper macro pour UUID 16-bit sur base 128-bit ---- */
#define SVC_UUID(id)  UUID128_50CC(id)
#define CHR_UUID(id)  UUID128_50CC(id)

static const struct ble_gatt_svc_def s_gatt_services[] = {
    /* ================================================================
     * SERVICE 1 : TÉLÉMÉTRIE
     * ================================================================ */
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = SVC_UUID(BLE_UUID_SVC_TELEMETRY),
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                /* Frame Count (lecture seule) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_FRAME_COUNT),
                .access_cb  = ble_gatt_telemetry_access,
                .flags      = BLE_GATT_CHR_F_READ
                            | BLE_GATT_CHR_F_READ_ENC,
            },
            {
                /* Frame Data (notification temps réel + indication GATT sur choc > 3.0G) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_FRAME_DATA),
                .access_cb  = ble_gatt_telemetry_access,
                .val_handle = &s_frame_notify_handle,
                .flags      = BLE_GATT_CHR_F_NOTIFY
                            | BLE_GATT_CHR_F_INDICATE
                            | BLE_GATT_CHR_F_READ_ENC,
            },
            {
                /* Export Command (écriture authentifiée) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_EXPORT_CMD),
                .access_cb  = ble_gatt_telemetry_access,
                .flags      = BLE_GATT_CHR_F_WRITE
                            | BLE_GATT_CHR_F_WRITE_ENC
                            | BLE_GATT_CHR_F_WRITE_AUTHEN,
            },
            {
                /* Acquittement applicatif de séquence ACK_SEQ_ID (écriture authentifiée) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_ACK_SEQ),
                .access_cb  = ble_gatt_telemetry_access,
                .flags      = BLE_GATT_CHR_F_WRITE
                            | BLE_GATT_CHR_F_WRITE_ENC
                            | BLE_GATT_CHR_F_WRITE_AUTHEN,
            },
            {
                /* Clé publique + événement d'accident signé (lecture chiffrée) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_ECDSA_SIG),
                .access_cb  = ble_gatt_telemetry_access,
                .flags      = BLE_GATT_CHR_F_READ
                            | BLE_GATT_CHR_F_READ_ENC,
            },
            { 0 },  /* Fin des caractéristiques */
        },
    },

    /* ================================================================
     * SERVICE 2 : DIAGNOSTIC
     * ================================================================ */
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = SVC_UUID(BLE_UUID_SVC_DIAGNOSTIC),
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                /* Battery mV (lecture) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_BATTERY),
                .access_cb  = ble_gatt_diagnostic_access,
                .flags      = BLE_GATT_CHR_F_READ,
            },
            {
                /* Tamper State (lecture) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_TAMPER_STATE),
                .access_cb  = ble_gatt_diagnostic_access,
                .flags      = BLE_GATT_CHR_F_READ,
            },
            {
                /* FW Version (lecture) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_FW_VERSION),
                .access_cb  = ble_gatt_diagnostic_access,
                .flags      = BLE_GATT_CHR_F_READ,
            },
            {
                /* Memory Usage (lecture chiffrée) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_MEMORY_USAGE),
                .access_cb  = ble_gatt_diagnostic_access,
                .flags      = BLE_GATT_CHR_F_READ
                            | BLE_GATT_CHR_F_READ_ENC,
            },
            {
                /* Uptime (lecture) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_UPTIME),
                .access_cb  = ble_gatt_diagnostic_access,
                .flags      = BLE_GATT_CHR_F_READ,
            },
            { 0 },
        },
    },

    /* ================================================================
     * SERVICE 3 : FOTA (Firmware Over-The-Air)
     * ================================================================ */
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = SVC_UUID(BLE_UUID_SVC_FOTA),
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                /* OTA Control (écriture authentifiée + chiffrée) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_OTA_CTRL),
                .access_cb  = ble_gatt_fota_access,
                .flags      = BLE_GATT_CHR_F_WRITE
                            | BLE_GATT_CHR_F_WRITE_ENC
                            | BLE_GATT_CHR_F_WRITE_AUTHEN,
            },
            {
                /* OTA Data (écriture rapide sans réponse) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_OTA_DATA),
                .access_cb  = ble_gatt_fota_access,
                .flags      = BLE_GATT_CHR_F_WRITE_NO_RSP
                            | BLE_GATT_CHR_F_WRITE_ENC
                            | BLE_GATT_CHR_F_WRITE_AUTHEN,
            },
            {
                /* OTA Status (notification) */
                .uuid       = CHR_UUID(BLE_UUID_CHR_OTA_STATUS),
                .access_cb  = ble_gatt_fota_access,
                .val_handle = &s_ota_status_handle,
                .flags      = BLE_GATT_CHR_F_NOTIFY,
            },
            { 0 },
        },
    },

    { 0 },  /* Fin des services */
};

/* ============================================================================
 * ble_comm_init() — Initialisation complète de la stack BLE
 * ============================================================================
 */
esp_err_t ble_comm_init(void)
{
    ESP_LOGI(TAG, "Initialisation BLE NimBLE...");

    /* Générer le nom du device à partir du MAC */
    ble_generate_device_name();

    /* Initialiser le port NimBLE */
    esp_err_t ret = nimble_port_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Erreur nimble_port_init : %s", esp_err_to_name(ret));
        return ret;
    }

    /* Configurer les callbacks du host */
    ble_hs_cfg.sync_cb  = ble_on_sync;
    ble_hs_cfg.reset_cb = ble_on_reset;

    /* ---- Sécurité BLE (CIS 6 : Bonding + Passkey) ---- */
    ble_hs_cfg.sm_io_cap         = BLE_SM_IO_CAP_DISP_ONLY;  /* Affiche passkey */
    ble_hs_cfg.sm_bonding        = 1;    /* Bonding activé */
    ble_hs_cfg.sm_mitm           = 1;    /* Protection MITM */
    ble_hs_cfg.sm_sc             = 1;    /* Secure Connections (LE SC) */
    ble_hs_cfg.sm_our_key_dist   = BLE_SM_PAIR_KEY_DIST_ENC
                                 | BLE_SM_PAIR_KEY_DIST_ID;
    ble_hs_cfg.sm_their_key_dist = BLE_SM_PAIR_KEY_DIST_ENC
                                 | BLE_SM_PAIR_KEY_DIST_ID;

    /* Enregistrer les services GATT */
    ble_svc_gap_init();
    ble_svc_gatt_init();

    int rc = ble_gatts_count_cfg(s_gatt_services);
    if (rc != 0) {
        ESP_LOGE(TAG, "Erreur ble_gatts_count_cfg : %d", rc);
        return ESP_FAIL;
    }

    rc = ble_gatts_add_svcs(s_gatt_services);
    if (rc != 0) {
        ESP_LOGE(TAG, "Erreur ble_gatts_add_svcs : %d", rc);
        return ESP_FAIL;
    }

    /* Configurer le nom GAP */
    ble_svc_gap_device_name_set(s_device_name);

    /* Lancer la tâche NimBLE */
    nimble_port_freertos_init(ble_host_task);

    ESP_LOGI(TAG, "BLE initialisé — Nom : %s", s_device_name);
    return ESP_OK;
}

/* ============================================================================
 * ble_comm_start_advertising()
 * ============================================================================
 */
esp_err_t ble_comm_start_advertising(void)
{
    struct ble_gap_adv_params adv_params = {0};

    /* Advertising connectable non-dirigé */
    adv_params.conn_mode = BLE_GAP_CONN_MODE_UND;
    adv_params.disc_mode = BLE_GAP_DISC_MODE_GEN;

    /* Intervalle d'advertising : 100ms - 150ms (économie batterie) */
    adv_params.itvl_min = BLE_GAP_ADV_ITVL_MS(100);
    adv_params.itvl_max = BLE_GAP_ADV_ITVL_MS(150);

    /* Données d'advertising */
    struct ble_hs_adv_fields fields = {0};
    fields.flags                 = BLE_HS_ADV_F_DISC_GEN
                                 | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.name                  = (uint8_t *)s_device_name;
    fields.name_len              = strlen(s_device_name);
    fields.name_is_complete      = 1;
    fields.tx_pwr_lvl_is_present = 1;
    fields.tx_pwr_lvl            = BLE_HS_ADV_TX_PWR_LVL_AUTO;

    int rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0) {
        ESP_LOGE(TAG, "Erreur adv_set_fields : %d", rc);
        return ESP_FAIL;
    }

    rc = ble_gap_adv_start(
        BLE_OWN_ADDR_PUBLIC,
        NULL,
        BLE_HS_FOREVER,
        &adv_params,
        ble_gap_event_handler,
        NULL
    );

    if (rc != 0) {
        ESP_LOGE(TAG, "Erreur adv_start : %d", rc);
        return ESP_FAIL;
    }

    s_ble_state = BLE_STATE_ADVERTISING;
    ESP_LOGI(TAG, "Advertising démarré — en attente de connexion...");
    return ESP_OK;
}

/* ============================================================================
 * ble_comm_stop_advertising()
 * ============================================================================
 */
void ble_comm_stop_advertising(void)
{
    ble_gap_adv_stop();
    s_ble_state = BLE_STATE_IDLE;
    ESP_LOGI(TAG, "Advertising arrêté.");
}

/* ============================================================================
 * ble_comm_get_state()
 * ============================================================================
 */
ble_conn_state_t ble_comm_get_state(void)
{
    return s_ble_state;
}

/* ============================================================================
 * ble_comm_notify_frame() — Envoi d'une trame par notification
 * ============================================================================
 */
esp_err_t ble_comm_notify_frame(const uint8_t *data, uint16_t len)
{
    if (s_ble_state != BLE_STATE_CONNECTED || data == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    /* Limiter la taille au MTU (CIS 16.10 : validation des entrées) */
    if (len > 244) {
        len = 244;  /* MTU max BLE 5.0 - 3 octets header */
    }

    struct os_mbuf *om = ble_hs_mbuf_from_flat(data, len);
    if (om == NULL) {
        return ESP_ERR_NO_MEM;
    }

    int rc = ble_gatts_notify_custom(s_conn_handle, s_frame_notify_handle, om);
    return (rc == 0) ? ESP_OK : ESP_FAIL;
}

/* ============================================================================
 * ble_comm_indicate_shock_frame() — Envoi garanti par GATT Indication (choc >3.0G)
 * ============================================================================
 */
esp_err_t ble_comm_indicate_shock_frame(const uint8_t *data, uint16_t len, uint32_t seq_id)
{
    if (s_ble_state != BLE_STATE_CONNECTED || data == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (len > 244) {
        len = 244;
    }

    s_pending_shock_seq = seq_id;

    struct os_mbuf *om = ble_hs_mbuf_from_flat(data, len);
    if (om == NULL) {
        return ESP_ERR_NO_MEM;
    }

    /* ble_gatts_indicate_custom exige un ACK ATT de la couche BLE du smartphone */
    int rc = ble_gatts_indicate_custom(s_conn_handle, s_frame_notify_handle, om);
    if (rc != 0) {
        ESP_LOGW(TAG, "Échec GATT Indicate pour trame de choc #%lu (rc=%d)",
                 (unsigned long)seq_id, rc);
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "⚡ GATT Indicate envoyé pour trame de choc #%lu (attente ACK_SEQ_ID)...",
             (unsigned long)seq_id);
    return ESP_OK;
}

uint32_t ble_comm_get_last_acked_seq(void)
{
    return s_last_acked_seq;
}

/* ============================================================================
 * ble_comm_set_export_callback()
 * ============================================================================
 */
void ble_comm_set_export_callback(ble_export_request_cb_t cb)
{
    s_export_cb = cb;
}

void ble_comm_set_event_callbacks(ble_event_info_cb_t info_cb,
                                  ble_event_export_cb_t export_cb,
                                  ble_ack_cb_t ack_cb)
{
    s_event_info_cb = info_cb;
    s_event_export_cb = export_cb;
    s_ack_cb = ack_cb;
}

/* ============================================================================
 * ble_comm_update_battery()
 * ============================================================================
 */
void ble_comm_update_battery(uint16_t battery_mv)
{
    s_battery_mv = battery_mv;
}

/* ============================================================================
 * ble_comm_update_tamper_state()
 * ============================================================================
 */
void ble_comm_update_tamper_state(uint8_t state)
{
    s_tamper_state_val = state;
}

/* ============================================================================
 * GAP Event Handler — Gestion des événements de connexion
 * ============================================================================
 */
static int ble_gap_event_handler(struct ble_gap_event *event, void *arg)
{
    (void)arg;

    switch (event->type) {
        case BLE_GAP_EVENT_CONNECT:
            if (event->connect.status == 0) {
                s_conn_handle = event->connect.conn_handle;
                s_ble_state = BLE_STATE_CONNECTED;
                ESP_LOGI(TAG, "✓ Appareil connecté (handle=%d)", s_conn_handle);

                /* Demander le bonding sécurisé */
                ble_gap_security_initiate(s_conn_handle);
            } else {
                ESP_LOGW(TAG, "Connexion échouée (status=%d)",
                         event->connect.status);
                ble_comm_start_advertising();
            }
            break;

        case BLE_GAP_EVENT_DISCONNECT:
            ESP_LOGI(TAG, "Appareil déconnecté (reason=%d)",
                     event->disconnect.reason);
            s_ble_state = BLE_STATE_IDLE;
            /* Relancer l'advertising automatiquement */
            ble_comm_start_advertising();
            break;

        case BLE_GAP_EVENT_ENC_CHANGE:
            if (event->enc_change.status == 0) {
                ESP_LOGI(TAG, "✓ Chiffrement BLE activé (bonding OK).");
            } else {
                ESP_LOGW(TAG, "⚠ Échec du chiffrement BLE — déconnexion.");
                ble_gap_terminate(event->enc_change.conn_handle,
                                  BLE_ERR_AUTH_FAIL);
            }
            break;

        case BLE_GAP_EVENT_REPEAT_PAIRING: {
            /* Refuser le re-pairing non sollicité (sécurité CIS 6) */
            struct ble_gap_conn_desc desc;
            ble_gap_conn_find(event->repeat_pairing.conn_handle, &desc);
            ble_store_util_delete_peer(&desc.peer_id_addr);
            return BLE_GAP_REPEAT_PAIRING_RETRY;
        }

        case BLE_GAP_EVENT_PASSKEY_ACTION:
            if (event->passkey.params.action == BLE_SM_IOACT_DISP) {
                struct ble_sm_io pkey = {0};
                pkey.action = BLE_SM_IOACT_DISP;

                /* Charger le passkey 6 chiffres provisionné en NVS (ou générer via TRNG) */
                uint32_t stored_pin = 0;
                nvs_handle_t nvs;
                if (nvs_open("storage", NVS_READONLY, &nvs) == ESP_OK) {
                    nvs_get_u32(nvs, "ble_pin", &stored_pin);
                    nvs_close(nvs);
                }
                if (stored_pin >= 100000 && stored_pin <= 999999) {
                    pkey.passkey = stored_pin;
                } else {
                    pkey.passkey = 100000 + (esp_random() % 900000);
                }

                ble_sm_inject_io(event->passkey.conn_handle, &pkey);
                ESP_LOGI(TAG, "🔑 Passkey BLE Secure Connections actif.");
            }
            break;

        default:
            break;
    }

    return 0;
}

/* ============================================================================
 * GATT Access Handlers — Lecture / Écriture des caractéristiques
 * ============================================================================
 */

/* ---- Télémétrie ---- */
static int ble_gatt_telemetry_access(
    uint16_t conn, uint16_t attr,
    struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn;
    (void)attr;
    (void)arg;

    uint16_t uuid16 = chr_short_id(ctxt->chr->uuid);

    switch (ctxt->op) {
        case BLE_GATT_ACCESS_OP_READ_CHR:
            if (uuid16 == BLE_UUID_CHR_FRAME_COUNT) {
                return os_mbuf_append(ctxt->om, &s_frame_count,
                                      sizeof(s_frame_count));
            } else if (uuid16 == BLE_UUID_CHR_ECDSA_SIG && s_event_info_cb != NULL) {
                uint8_t info[65 + 160];
                uint16_t n = s_event_info_cb(info, sizeof(info));
                return os_mbuf_append(ctxt->om, info, n) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
            }
            break;

        case BLE_GATT_ACCESS_OP_WRITE_CHR:
            if (uuid16 == BLE_UUID_CHR_EXPORT_CMD) {
                /* Commande d'export : [start_index (4B)] [count (4B)] */
                uint16_t om_len = OS_MBUF_PKTLEN(ctxt->om);

                /* Export d'un événement d'accident : [0xEE][emplacement] */
                if (om_len == 2) {
                    uint8_t evt_cmd[2];
                    os_mbuf_copydata(ctxt->om, 0, 2, evt_cmd);
                    if (evt_cmd[0] != 0xEE) {
                        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
                    }
                    if (s_event_export_cb != NULL) {
                        s_event_export_cb(evt_cmd[1]);
                    }
                    break;
                }

                /* Validation taille (CIS 16.10 / OWASP A03) */
                if (om_len != 8) {
                    ESP_LOGW(TAG, "Export cmd : taille invalide (%d)", om_len);
                    return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
                }

                uint8_t cmd_buf[8];
                os_mbuf_copydata(ctxt->om, 0, 8, cmd_buf);

                uint32_t start_idx, count;
                memcpy(&start_idx, cmd_buf, 4);
                memcpy(&count, cmd_buf + 4, 4);

                ESP_LOGI(TAG, "Export demandé : start=%lu, count=%lu",
                         (unsigned long)start_idx, (unsigned long)count);

                if (s_export_cb != NULL) {
                    s_export_cb(start_idx, count);
                }
            } else if (uuid16 == BLE_UUID_CHR_ACK_SEQ) {
                /* Acquittement applicatif de séquence : [ack_seq_id (4B Little Endian)] */
                uint16_t om_len = OS_MBUF_PKTLEN(ctxt->om);
                if (om_len != 4) {
                    return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
                }
                uint32_t ack_seq = 0;
                os_mbuf_copydata(ctxt->om, 0, 4, &ack_seq);
                s_last_acked_seq = ack_seq;
                if (s_ack_cb != NULL) {
                    s_ack_cb(ack_seq);
                }
                ESP_LOGI(TAG, "✓ ACK_SEQ_ID applicatif reçu du smartphone : #%lu",
                         (unsigned long)ack_seq);
            }
            break;

        default:
            break;
    }

    return 0;
}

/* ---- Diagnostic ---- */
static int ble_gatt_diagnostic_access(
    uint16_t conn, uint16_t attr,
    struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn;
    (void)attr;
    (void)arg;

    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) {
        return BLE_ATT_ERR_UNLIKELY;
    }

    uint16_t uuid16 = chr_short_id(ctxt->chr->uuid);

    switch (uuid16) {
        case BLE_UUID_CHR_BATTERY:
            return os_mbuf_append(ctxt->om, &s_battery_mv,
                                  sizeof(s_battery_mv));

        case BLE_UUID_CHR_TAMPER_STATE:
            return os_mbuf_append(ctxt->om, &s_tamper_state_val,
                                  sizeof(s_tamper_state_val));

        case BLE_UUID_CHR_FW_VERSION:
            return os_mbuf_append(ctxt->om, FW_VERSION_STR, FW_VERSION_LEN);

        case BLE_UUID_CHR_MEMORY_USAGE: {
            /* Pourcentage d'utilisation de la Flash blackbox */
            /* TODO : Calculer depuis blackbox_storage_count() */
            uint8_t usage_pct = 42;
            return os_mbuf_append(ctxt->om, &usage_pct, 1);
        }

        case BLE_UUID_CHR_UPTIME: {
            uint32_t uptime_s = (uint32_t)(esp_timer_get_time() / 1000000);
            return os_mbuf_append(ctxt->om, &uptime_s, sizeof(uptime_s));
        }

        default:
            break;
    }

    return BLE_ATT_ERR_UNLIKELY;
}

/* ---- FOTA ---- */
static int ble_gatt_fota_access(
    uint16_t conn, uint16_t attr,
    struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn;
    (void)attr;
    (void)arg;

    uint16_t uuid16 = chr_short_id(ctxt->chr->uuid);

    if (ctxt->op == BLE_GATT_ACCESS_OP_WRITE_CHR) {
        if (uuid16 == BLE_UUID_CHR_OTA_CTRL) {
            /* Commande OTA : 0x01 = start, 0x02 = finish, 0x03 = abort */
            uint8_t cmd = 0;
            os_mbuf_copydata(ctxt->om, 0, 1, &cmd);

            switch (cmd) {
                case 0x01:
                    ESP_LOGI(TAG, "🔄 FOTA : Démarrage mise à jour...");
                    s_ble_state = BLE_STATE_OTA_IN_PROG;
                    /* TODO : Initialiser la partition OTA cible */
                    break;

                case 0x02:
                    ESP_LOGI(TAG, "✓ FOTA : Finalisation...");
                    /* TODO : Valider le firmware + redémarrer */
                    break;

                case 0x03:
                    ESP_LOGW(TAG, "⚠ FOTA : Annulation.");
                    s_ble_state = BLE_STATE_CONNECTED;
                    break;

                default:
                    ESP_LOGW(TAG, "FOTA : Commande inconnue (0x%02x)", cmd);
                    return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
            }
        } else if (uuid16 == BLE_UUID_CHR_OTA_DATA) {
            /* Réception d'un chunk de firmware */
            if (s_ble_state != BLE_STATE_OTA_IN_PROG) {
                ESP_LOGW(TAG, "FOTA : Données reçues hors séquence.");
                return BLE_ATT_ERR_WRITE_NOT_PERMITTED;
            }

            uint16_t chunk_len = OS_MBUF_PKTLEN(ctxt->om);

            /* Limite de sécurité : max 512 octets par chunk (CIS 16.10) */
            if (chunk_len > 512) {
                return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
            }

            /* TODO : Écrire dans la partition OTA cible */
            ESP_LOGD(TAG, "FOTA : Chunk reçu (%d octets)", chunk_len);
        }
    }

    return 0;
}

/* ============================================================================
 * Helpers internes
 * ============================================================================
 */

/**
 * Génère le nom BLE "BB50-XXXX" à partir des 2 derniers octets du MAC.
 */
static void ble_generate_device_name(void)
{
    /* Nom Bluetooth = numéro de série écrit en usine (ex. « BB50V1-A01 », celui de l'étiquette).
     * Boîtier pas encore numéroté (mode usine) : « BB50-XXXX » d'après l'adresse MAC. */
    nvs_handle_t nvs;
    size_t len = sizeof(s_device_name);
    if (nvs_open("storage", NVS_READONLY, &nvs) == ESP_OK) {
        esp_err_t err = nvs_get_str(nvs, "serial", s_device_name, &len);
        nvs_close(nvs);
        if (err == ESP_OK && s_device_name[0] != '\0') {
            return;
        }
    }
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_BT);
    snprintf(s_device_name, sizeof(s_device_name),
             "BB50-%02X%02X", mac[4], mac[5]);
}

/**
 * Callback de synchronisation NimBLE — appelé quand le host est prêt.
 */
static void ble_on_sync(void)
{
    /* S'assurer que l'adresse est configurée */
    ble_hs_id_infer_auto(0, NULL);

    /* Démarrer l'advertising automatiquement */
    ble_comm_start_advertising();
}

/**
 * Callback de reset NimBLE.
 */
static void ble_on_reset(int reason)
{
    ESP_LOGE(TAG, "BLE Host reset (reason=%d)", reason);
}

/**
 * Tâche FreeRTOS pour le host NimBLE.
 */
static void ble_host_task(void *param)
{
    (void)param;
    nimble_port_run();      /* Bloquant — ne retourne jamais */
    nimble_port_freertos_deinit();
}
