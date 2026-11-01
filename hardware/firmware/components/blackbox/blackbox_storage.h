/**
 * ============================================================================
 * blackbox_storage.h — Stockage Forensique Chiffré & Authentifié (REV3)
 * ============================================================================
 * Gère l'écriture et la lecture de trames GPS (10 Hz) / IMU (±16G) dans une
 * partition Flash dédiée, chiffrées et authentifiées en AES-256-GCM avec
 * chaînage cryptographique Merkle SHA-256 et signature ECDSA P-256.
 *
 * SÉCURITÉ & NORMES (Rapport EXP-BB50-2026-REV3) :
 *   - ISO/IEC 27037 : Chaîne de garde numérique (Hash-Chaining SHA-256).
 *   - Art. 1366 C.Civ : Chiffrement authentifié AES-256-GCM (anti bit-flipping)
 *                       + Signature asymétrique ECDSA P-256 (secp256r1).
 *   - OWASP ASVS v5.0.0-11.x : Nonce 96 bits unique par trame via TRNG matériel.
 *   - RGPD Art. 32 : Pseudonymisation et intégrité cryptographique au repos.
 * ============================================================================
 */

#ifndef BLACKBOX_STORAGE_H
#define BLACKBOX_STORAGE_H

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Structure d'une trame télémétrique forensique (Boîte Noire REV3).
 *
 * Chaque trame est horodatée (UTC atomique GNSS + millisecondes 10 Hz),
 * contient un numéro de séquence monotone et l'empreinte SHA-256 tronquée
 * (128 bits) de la trame précédente (Merkle Hash-Chaining).
 *
 * Taille fixe : 64 octets (aligné sur 4 blocs AES de 16 octets).
 */
typedef struct __attribute__((packed)) {
    uint32_t timestamp_utc;         /**< [0..3]   Epoch UNIX (secondes UTC GNSS) */
    int32_t  latitude;              /**< [4..7]   Latitude × 1e7 (précision ~1 cm) */
    int32_t  longitude;             /**< [8..11]  Longitude × 1e7 */
    uint16_t speed_kmh_x10;        /**< [12..13] Vitesse en km/h × 10 (ex: 455 = 45.5 km/h) */
    uint16_t heading_deg;           /**< [14..15] Cap en degrés (0-359) */
    uint8_t  satellites;            /**< [16]     Nombre de satellites GNSS */
    uint8_t  hdop_x10;             /**< [17]     HDOP × 10 (qualité du fix) */
    uint16_t battery_mv;           /**< [18..19] Tension batterie LiFePO4 en mV */
    uint8_t  tamper_state;          /**< [20]     État anti-tamper (0 = OK) */
    uint8_t  flags;                 /**< [21]     Drapeaux (bit0=Vext, bit1=UTC sync, bit2=Shock>3G) */
    uint16_t g_force_x10;           /**< [22..23] Force G résultante × 10 (ex: 124 = 12.4G) */
    uint8_t  lean_angle_deg;        /**< [24]     Angle d'inclinaison en degrés (0-180) */
    /* ---- Extensions Forensiques REV3 (ISO/IEC 27037) ---- */
    uint32_t seq_id;                /**< [25..28] Numéro de séquence monotone anti-suppression */
    uint16_t timestamp_ms;          /**< [29..30] Millisecondes UTC (0..999) pour GNSS 10 Hz */
    int16_t  accel_x_mg;            /**< [31..32] Accélération brute X en milli-G (±16000 mg) */
    int16_t  accel_y_mg;            /**< [33..34] Accélération brute Y en milli-G (±16000 mg) */
    int16_t  accel_z_mg;            /**< [35..36] Accélération brute Z en milli-G (±16000 mg) */
    uint8_t  prev_hash_trunc[16];   /**< [37..52] 128 premiers bits de SHA-256(Hash_{N-1} || Trame_{N-1}) */
    uint8_t  reserved[11];          /**< [53..63] Réservé pour extensions futures */
} blackbox_frame_t;

_Static_assert(sizeof(blackbox_frame_t) == 64,
    "blackbox_frame_t doit faire exactement 64 octets (4 blocs AES)");

/**
 * @brief Initialise le module de stockage (partition Flash + clé AES-256-GCM + clé ECDSA P-256).
 *
 * @return ESP_OK ou ESP_FAIL.
 */
esp_err_t blackbox_storage_init(void);

/**
 * @brief Chaîne (SHA-256 Merkle), chiffre et authentifie (AES-256-GCM) une trame dans la Flash.
 *
 * @param frame Pointeur vers la trame à enregistrer (seq_id et prev_hash_trunc sont remplis).
 * @return ESP_OK ou code d'erreur.
 */
esp_err_t blackbox_storage_write(blackbox_frame_t *frame);

/**
 * @brief Lit, vérifie le tag GMAC (AES-256-GCM) et déchiffre une trame depuis la Flash.
 *
 * @param index  Index de la trame (0 = la plus ancienne).
 * @param frame  Pointeur de sortie.
 * @return ESP_OK, ESP_ERR_INVALID_CRC si le tag GCM est invalide (altération détectée).
 */
esp_err_t blackbox_storage_read(uint32_t index, blackbox_frame_t *frame);

/**
 * @brief Retourne le nombre de trames enregistrées.
 */
uint32_t blackbox_storage_count(void);

/**
 * @brief Retourne le condensat SHA-256 courant de la chaîne de hachage Merkle (32 octets).
 *
 * @param out_hash Buffer de 32 octets recevant le condensat courant.
 */
void blackbox_storage_get_chain_hash(uint8_t out_hash[32]);

/**
 * @brief Signe un condensat SHA-256 (32 octets) avec la clé privée ECDSA P-256 du boîtier.
 *
 * @param hash32       Condensat SHA-256 de 32 octets à signer.
 * @param sig_der_out  Buffer de sortie pour la signature DER (min 72 octets).
 * @param sig_len_out  Longueur effective de la signature écrite.
 * @return ESP_OK en cas de succès.
 */
esp_err_t blackbox_storage_sign_digest(const uint8_t hash32[32], uint8_t *sig_der_out, size_t *sig_len_out);

/**
 * @brief Exporte la clé publique ECDSA P-256 non compressée (65 octets : 0x04 || X || Y).
 *
 * @param pubkey_out Buffer de 65 octets.
 * @return ESP_OK en cas de succès.
 */
esp_err_t blackbox_storage_get_pubkey(uint8_t pubkey_out[65]);

/**
 * @brief Force la synchronisation immédiate de l'en-tête de partition en Flash.
 *        Appelé lors d'un impact (>3.0G) ou par l'ISR "Last-Gasp Write" (coupure 12V).
 * @return ESP_OK ou code d'erreur esp_err_t.
 */
esp_err_t blackbox_storage_flush(void);

/**
 * @brief Détruit immédiatement en RAM les clés cryptographiques AES-256-GCM,
 *        ECDSA P-256 et le condensat Merkle courant (Zeroization anti-tamper).
 */
void blackbox_storage_zeroize_keys(void);

/**
 * @brief Transfère les trames de la fenêtre de sinistre (±30s) vers l'app mobile via BLE.
 *
 * @param max_frames Nombre maximum de trames à transférer (0 = fenêtre ±30s soit 600 trames à 10Hz).
 * @return ESP_OK.
 */
esp_err_t blackbox_storage_export_ble(uint32_t max_frames);

#ifdef __cplusplus
}
#endif

#endif /* BLACKBOX_STORAGE_H */
