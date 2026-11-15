/**
 * ============================================================================
 * ble_comm.h — Serveur GATT BLE (Boîte Noire V1)
 * ============================================================================
 * Gère la communication Bluetooth Low Energy 5.0 avec l'application
 * mobile "mon 50cc et moi". Basé sur la stack NimBLE (léger et efficace).
 *
 * Services GATT exposés :
 *   1. Service Télémétrie   — Lecture des trames chiffrées
 *   2. Service Diagnostic   — État batterie, mémoire, version firmware
 *   3. Service FOTA         — Mise à jour firmware Over-The-Air
 *
 * SÉCURITÉ :
 *   - CIS 3     : Chiffrement BLE (AES-CCM natif BLE 5.0).
 *   - CIS 6     : Authentification obligatoire (bonding + passkey).
 *   - OWASP A01 : Un seul appareil connecté à la fois.
 *   - FIDO FDO  : Authentification mutuelle appareil ↔ cloud.
 * ============================================================================
 */

#ifndef BLE_COMM_H
#define BLE_COMM_H

#include <stdint.h>
#include <stdbool.h>
#include <esp_err.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ---- UUIDs des services (128-bit custom) ---- */
/**
 * Base UUID : 50cc0000-XXXX-4d6f-6e35-306363657431
 * Dérivé de "Mon50ccet1" encodé en hex.
 */
#define BLE_UUID_SVC_TELEMETRY     0x0001  /**< Service Télémétrie */
#define BLE_UUID_SVC_DIAGNOSTIC    0x0002  /**< Service Diagnostic */
#define BLE_UUID_SVC_FOTA          0x0003  /**< Service FOTA (OTA) */

/* ---- UUIDs des caractéristiques ---- */
/* Télémétrie */
#define BLE_UUID_CHR_FRAME_COUNT   0x0101  /**< Nombre de trames (read) */
#define BLE_UUID_CHR_FRAME_DATA    0x0102  /**< Données trame (notify + indicate sur choc >3G) */
#define BLE_UUID_CHR_EXPORT_CMD    0x0103  /**< Commande d'export (write) */
#define BLE_UUID_CHR_ACK_SEQ       0x0104  /**< Acquittement applicatif ACK_SEQ_ID (write) */
#define BLE_UUID_CHR_ECDSA_SIG     0x0105  /**< Clé publique + événement d'accident signé (read) */

/* Diagnostic */
#define BLE_UUID_CHR_BATTERY       0x0201  /**< Tension batterie mV (read) */
#define BLE_UUID_CHR_TAMPER_STATE  0x0202  /**< État anti-tamper (read) */
#define BLE_UUID_CHR_FW_VERSION    0x0203  /**< Version firmware (read) */
#define BLE_UUID_CHR_MEMORY_USAGE  0x0204  /**< Utilisation mémoire (read) */
#define BLE_UUID_CHR_UPTIME        0x0205  /**< Temps de fonctionnement (read) */

/* FOTA */
#define BLE_UUID_CHR_OTA_CTRL      0x0301  /**< Contrôle OTA (write) */
#define BLE_UUID_CHR_OTA_DATA      0x0302  /**< Données OTA (write no resp) */
#define BLE_UUID_CHR_OTA_STATUS    0x0303  /**< Statut OTA (notify) */

/**
 * @brief État de la connexion BLE.
 */
typedef enum {
    BLE_STATE_IDLE          = 0,  /**< Pas de connexion */
    BLE_STATE_ADVERTISING   = 1,  /**< En attente de connexion */
    BLE_STATE_CONNECTED     = 2,  /**< Appareil connecté et authentifié */
    BLE_STATE_OTA_IN_PROG   = 3,  /**< Mise à jour FOTA en cours */
} ble_conn_state_t;

/**
 * @brief Callback appelé lorsque l'app mobile demande un export.
 *
 * @param start_index Index de la première trame demandée.
 * @param count       Nombre de trames demandées (0 = toutes).
 */
typedef void (*ble_export_request_cb_t)(uint32_t start_index, uint32_t count);

/**
 * @brief Remplit `buf` avec la clé publique (65 o) suivie de l'événement d'accident
 *        non acquitté le plus ancien (blackbox_event_t, 156 o) s'il y en a un.
 *        Lu par l'appli sur la caractéristique ECDSA_SIG. Retourne la longueur écrite.
 */
typedef uint16_t (*ble_event_info_cb_t)(uint8_t *buf, uint16_t cap);

/**
 * @brief Demande d'export des trames d'un événement (commande EXPORT_CMD de 2 octets :
 *        [0xEE][emplacement]). Les trames partent en notification sur FRAME_DATA.
 */
typedef void (*ble_event_export_cb_t)(uint8_t slot);

/**
 * @brief Acquittement applicatif reçu (ACK_SEQ). Pour un événement, la valeur est son
 *        end_seq : l'appli ne l'envoie qu'après réception de la preuve par le serveur.
 */
typedef void (*ble_ack_cb_t)(uint32_t seq);

/**
 * @brief Initialise la stack BLE NimBLE et enregistre les services GATT.
 *        Configure le bonding (appairage sécurisé avec passkey).
 *
 * @return ESP_OK en cas de succès.
 */
esp_err_t ble_comm_init(void);

/**
 * @brief Démarre l'advertising BLE (rend le boîtier détectable).
 *        Nom annoncé : "BB50-XXXX" (XXXX = 4 derniers hex du MAC).
 *
 * @return ESP_OK en cas de succès.
 */
esp_err_t ble_comm_start_advertising(void);

/**
 * @brief Arrête l'advertising BLE (économie d'énergie).
 */
void ble_comm_stop_advertising(void);

/**
 * @brief Retourne l'état courant de la connexion BLE.
 */
ble_conn_state_t ble_comm_get_state(void);

/**
 * @brief Envoie une trame télémétrique déchiffrée via notification BLE.
 *        La trame est déchiffrée en RAM, envoyée, puis effacée de la RAM.
 *        Elle n'est JAMAIS écrite en clair sur la Flash.
 *
 * @param data Pointeur vers les données à envoyer.
 * @param len  Longueur en octets.
 * @return ESP_OK ou ESP_ERR_INVALID_STATE si pas de connexion.
 */
esp_err_t ble_comm_notify_frame(const uint8_t *data, uint16_t len);

/**
 * @brief Envoie une trame de choc critique (>3.0G) via GATT Indication (avec ACK couche BLE)
 *        et enregistre le numéro de séquence en attente d'acquittement applicatif (ACK_SEQ_ID).
 *
 * @param data   Pointeur vers les données de la trame.
 * @param len    Longueur en octets.
 * @param seq_id Numéro de séquence monotone de la trame de choc.
 * @return ESP_OK si l'indication a été transmise et acquittée.
 */
esp_err_t ble_comm_indicate_shock_frame(const uint8_t *data, uint16_t len, uint32_t seq_id);

/**
 * @brief Retourne le dernier numéro de séquence acquitté par l'application mobile (ACK_SEQ_ID).
 */
uint32_t ble_comm_get_last_acked_seq(void);

/**
 * @brief Enregistre le callback d'export de trames.
 */
void ble_comm_set_export_callback(ble_export_request_cb_t cb);

/** @brief Callbacks des événements d'accident signés (lecture, export, acquittement). */
void ble_comm_set_event_callbacks(ble_event_info_cb_t info_cb,
                                  ble_event_export_cb_t export_cb,
                                  ble_ack_cb_t ack_cb);

/**
 * @brief Met à jour la valeur de la caractéristique batterie.
 *
 * @param battery_mv Tension en millivolts.
 */
void ble_comm_update_battery(uint16_t battery_mv);

/**
 * @brief Met à jour l'état anti-tamper visible par l'app mobile.
 *
 * @param state État tamper (0 = OK).
 */
void ble_comm_update_tamper_state(uint8_t state);

#ifdef __cplusplus
}
#endif

#endif /* BLE_COMM_H */
