/**
 * ============================================================================
 * blackbox_storage.c — Stockage Forensique AES-256-GCM + Merkle SHA-256 + ECDSA P-256
 * ============================================================================
 * Cible : ESP32-C3-MINI-1 (ESP-IDF v5.x)
 * Référentiel : Rapport d'Expertise Systèmes Critiques EXP-BB50-2026-REV3
 *
 * Architecture mémoire :
 *   Partition "blackbox_data" (256 Ko typ.) organisée en ring buffer :
 *   ┌──────────────┬────────────┬────────────┬─────┬────────────┐
 *   │ Secteur 0    │ Frame 0    │ Frame 1    │ ... │ Frame N    │
 *   │ Header (4Ko) │ (96 B GCM) │ (96 B GCM) │     │ (96 B GCM) │
 *   └──────────────┴────────────┴────────────┴─────┴────────────┘
 *
 *   Chaque frame stockée (96 octets alignés) :
 *     - Nonce GCM aléatoire : 12 octets (TRNG matériel esp_fill_random)
 *     - AAD seq_id          : 4 octets (authentifié non chiffré)
 *     - Tag GMAC            : 16 octets (intégrité cryptographique)
 *     - Ciphertext          : 64 octets (blackbox_frame_t chiffrée)
 *
 * CONFORMITÉ :
 *   - ISO/IEC 27037 : Chaînage Merkle Hash_N = SHA-256(Hash_{N-1} || Trame_N).
 *   - Art. 1366 Code Civil : AES-256-GCM (anti bit-flipping) + ECDSA P-256.
 *   - OWASP ASVS v5.0.0-11.x : Clés uniques en NVS chiffrée, zéro clé en dur.
 * ============================================================================
 */

#include <string.h>
#include "esp_log.h"
#include "esp_partition.h"
#include "esp_random.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "mbedtls/gcm.h"
#include "mbedtls/sha256.h"
#include "mbedtls/ecdsa.h"
#include "mbedtls/ecp.h"
#include "mbedtls/platform_util.h"

#include "blackbox_storage.h"

/* ---- Tag de log forensique ---- */
static const char *TAG = "BB_STORE_GCM";

/* ---- Constantes ---- */
#define AES_KEY_SIZE        32      /* 256 bits */
#define GCM_NONCE_SIZE      12      /* 96 bits (recommandation NIST SP 800-38D) */
#define GCM_AAD_SIZE        4       /* 32 bits (seq_id authentifié) */
#define GCM_TAG_SIZE        16      /* 128 bits (Tag GMAC complet) */
#define ECDSA_PRIV_SIZE     32      /* Scalaire privé P-256 (256 bits) */
#define ECDSA_PUB_SIZE      65      /* Point non compressé 0x04 || X(32) || Y(32) */
#define SHA256_DIGEST_SIZE  32      /* 256 bits */
#define FRAME_RAW_SIZE      sizeof(blackbox_frame_t)  /* 64 octets */
#define FRAME_STORED_SIZE   (GCM_NONCE_SIZE + GCM_AAD_SIZE + GCM_TAG_SIZE + FRAME_RAW_SIZE) /* 96 octets */
#define HEADER_SIZE         64      /* En-tête structure partition */
#define FLASH_SECTOR_SIZE   4096    /* Secteur physique SPI NOR Flash (4 Ko) */
#define HEADER_SECTOR_SIZE  4096    /* Secteur 0 réservé exclusivement à l'en-tête */
#define HEADER_SYNC_PERIOD  50      /* Synchronisation en-tête toutes les 50 trames (anti-usure) */
#define PARTITION_MAGIC_GCM 0x424F5832UL /* "BOX2" — Format Forensique REV3 AES-GCM */

/* ---- En-tête de la partition (persisté en Flash sur le Secteur 0) ---- */
typedef struct __attribute__((packed)) {
    uint32_t magic;                         /* 0x424F5832 = "BOX2" (AES-256-GCM + Merkle) */
    uint32_t version;                       /* Version du format = 2 */
    uint32_t write_offset;                  /* Offset du prochain slot libre */
    uint32_t frame_count;                   /* Nombre total de trames écrites (seq_id) */
    uint32_t max_frames;                    /* Capacité maximale de la partition */
    uint8_t  rolling_sha256[SHA256_DIGEST_SIZE]; /* Condensat Merkle courant (32 octets) */
    uint8_t  reserved[12];                  /* Padding à 64 octets */
} partition_header_t;

_Static_assert(sizeof(partition_header_t) == HEADER_SIZE,
    "partition_header_t doit faire exactement 64 octets");

/* ---- Variables statiques ---- */
static const esp_partition_t *s_partition = NULL;
static partition_header_t s_header;

/**
 * Clés cryptographiques en RAM volatile (chargées depuis la partition NVS chiffrée).
 * Effacées immédiatement en cas d'alerte Tamper.
 */
static uint8_t s_aes_key[AES_KEY_SIZE] __attribute__((aligned(4)));
static uint8_t s_ecdsa_priv[ECDSA_PRIV_SIZE] __attribute__((aligned(4)));
static uint8_t s_ecdsa_pub[ECDSA_PUB_SIZE] __attribute__((aligned(4)));
static bool    s_ecdsa_ready = false;

/* ---- Prototypes internes ---- */
static esp_err_t _load_or_generate_keys(void);
static esp_err_t _write_header(void);
static esp_err_t _read_header(void);
static void      _compute_merkle_step(const blackbox_frame_t *frame);
static int       _esp_rng_cb(void *ctx, unsigned char *buf, size_t len);

/* Callback TRNG matériel pour mbedTLS ECDSA */
static int _esp_rng_cb(void *ctx, unsigned char *buf, size_t len)
{
    (void)ctx;
    esp_fill_random(buf, len);
    return 0;
}

/* ============================================================================
 * blackbox_storage_init()
 * ============================================================================
 */
esp_err_t blackbox_storage_init(void)
{
    ESP_LOGI(TAG, "Initialisation du stockage forensique AES-256-GCM + Merkle SHA-256...");

    s_partition = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA,
        ESP_PARTITION_SUBTYPE_ANY,
        "blackbox_data"
    );

    if (s_partition == NULL) {
        ESP_LOGE(TAG, "Partition 'blackbox_data' introuvable !");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "Partition trouvée : taille = %lu Ko",
             (unsigned long)(s_partition->size / 1024));

    /* Charger ou générer la clé AES-256-GCM et la paire de clés ECDSA P-256 */
    esp_err_t err = _load_or_generate_keys();
    if (err != ESP_OK) {
        return err;
    }

    /* Lire l'en-tête existant ou initialiser au format BOX2 (GCM) */
    err = _read_header();
    if (err != ESP_OK || s_header.magic != PARTITION_MAGIC_GCM) {
        ESP_LOGW(TAG, "Initialisation de la partition au format BOX2 (AES-256-GCM + Merkle)...");
        memset(&s_header, 0, sizeof(s_header));
        s_header.magic = PARTITION_MAGIC_GCM;
        s_header.version = 2;
        s_header.write_offset = HEADER_SECTOR_SIZE;
        s_header.frame_count = 0;
        s_header.max_frames =
            (s_partition->size - HEADER_SECTOR_SIZE) / FRAME_STORED_SIZE;

        /* Graine initiale de la chaîne de hachage Merkle (SHA-256 de la clé publique du boîtier) */
        mbedtls_sha256(s_ecdsa_pub, sizeof(s_ecdsa_pub), s_header.rolling_sha256, 0);

        esp_partition_erase_range(s_partition, 0, s_partition->size);
        _write_header();
    }

    ESP_LOGI(TAG, "Stockage forensique prêt : %lu / %lu trames (slot=%d octets).",
             (unsigned long)s_header.frame_count,
             (unsigned long)s_header.max_frames,
             FRAME_STORED_SIZE);

    return ESP_OK;
}

/* ============================================================================
 * _compute_merkle_step() — Chaînage Hash_N = SHA-256(Hash_{N-1} || Trame_N)
 * ============================================================================
 */
static void _compute_merkle_step(const blackbox_frame_t *frame)
{
    mbedtls_sha256_context sha_ctx;
    mbedtls_sha256_init(&sha_ctx);
    mbedtls_sha256_starts(&sha_ctx, 0); /* SHA-256 (0 = pas SHA-224) */
    mbedtls_sha256_update(&sha_ctx, s_header.rolling_sha256, SHA256_DIGEST_SIZE);
    mbedtls_sha256_update(&sha_ctx, (const uint8_t *)frame, FRAME_RAW_SIZE);
    mbedtls_sha256_finish(&sha_ctx, s_header.rolling_sha256);
    mbedtls_sha256_free(&sha_ctx);
}

/* ============================================================================
 * blackbox_storage_write() — Chaînage Merkle + Chiffrement Authentifié AES-256-GCM
 * ============================================================================
 */
esp_err_t blackbox_storage_write(blackbox_frame_t *frame)
{
    if (frame == NULL || s_partition == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (s_header.frame_count >= s_header.max_frames) {
        ESP_LOGW(TAG, "Ring-buffer complet — rebouclage au début de la zone de trames.");
        s_header.write_offset = HEADER_SECTOR_SIZE;
    }

    /* Si nous franchissons une frontière de secteur 4 Ko, effacer le secteur cible */
    if ((s_header.write_offset % FLASH_SECTOR_SIZE) == 0) {
        uint32_t erase_len = FLASH_SECTOR_SIZE;
        if (s_header.write_offset + erase_len > s_partition->size) {
            erase_len = s_partition->size - s_header.write_offset;
        }
        esp_err_t erase_err = esp_partition_erase_range(s_partition, s_header.write_offset, erase_len);
        if (erase_err != ESP_OK) {
            ESP_LOGE(TAG, "Erreur effacement secteur flash offset %lu: %s",
                     (unsigned long)s_header.write_offset, esp_err_to_name(erase_err));
            return erase_err;
        }
    }

    /* ---- 1. Chaînage Forensique Merkle (ISO/IEC 27037) ---- */
    frame->seq_id = s_header.frame_count;
    memcpy(frame->prev_hash_trunc, s_header.rolling_sha256, sizeof(frame->prev_hash_trunc));
    _compute_merkle_step(frame);

    /* ---- 2. Générer un Nonce 96 bits aléatoire unique (NIST SP 800-38D) ---- */
    uint8_t nonce[GCM_NONCE_SIZE];
    esp_fill_random(nonce, GCM_NONCE_SIZE);

    /* ---- 3. Chiffrement Authentifié AES-256-GCM (accélérateur matériel) ---- */
    uint8_t ciphertext[FRAME_RAW_SIZE];
    uint8_t tag[GCM_TAG_SIZE];
    uint8_t aad[GCM_AAD_SIZE];
    memcpy(aad, &frame->seq_id, GCM_AAD_SIZE);

    mbedtls_gcm_context gcm_ctx;
    mbedtls_gcm_init(&gcm_ctx);

    int ret = mbedtls_gcm_setkey(&gcm_ctx, MBEDTLS_CIPHER_ID_AES, s_aes_key, 256);
    if (ret == 0) {
        ret = mbedtls_gcm_crypt_and_tag(
            &gcm_ctx,
            MBEDTLS_GCM_ENCRYPT,
            FRAME_RAW_SIZE,
            nonce,
            GCM_NONCE_SIZE,
            aad,
            GCM_AAD_SIZE,
            (const uint8_t *)frame,
            ciphertext,
            GCM_TAG_SIZE,
            tag
        );
    }
    mbedtls_gcm_free(&gcm_ctx);

    if (ret != 0) {
        ESP_LOGE(TAG, "Erreur de chiffrement AES-256-GCM : -0x%04X", -ret);
        return ESP_FAIL;
    }

    /* ---- 4. Écriture Flash : [Nonce (12B)] + [AAD (4B)] + [Tag (16B)] + [Ciphertext (64B)] = 96B ---- */
    uint8_t stored_frame[FRAME_STORED_SIZE];
    memcpy(stored_frame, nonce, GCM_NONCE_SIZE);
    memcpy(stored_frame + GCM_NONCE_SIZE, aad, GCM_AAD_SIZE);
    memcpy(stored_frame + GCM_NONCE_SIZE + GCM_AAD_SIZE, tag, GCM_TAG_SIZE);
    memcpy(stored_frame + GCM_NONCE_SIZE + GCM_AAD_SIZE + GCM_TAG_SIZE, ciphertext, FRAME_RAW_SIZE);

    esp_err_t err = esp_partition_write(
        s_partition,
        s_header.write_offset,
        stored_frame,
        FRAME_STORED_SIZE
    );

    /* Nettoyage immédiat des données sensibles en pile */
    mbedtls_platform_zeroize(ciphertext, sizeof(ciphertext));
    mbedtls_platform_zeroize(stored_frame, sizeof(stored_frame));

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Erreur d'écriture Flash : %s", esp_err_to_name(err));
        return err;
    }

    /* ---- 5. Mise à jour des pointeurs et persistance périodique ou sur choc ---- */
    s_header.write_offset += FRAME_STORED_SIZE;
    s_header.frame_count++;

    /* Si la trame porte le flag d'impact (> 3.0G, bit 2 = 0x04) ou toutes les 50 trames : flush immédiat */
    if ((frame->flags & 0x04) || ((s_header.frame_count % HEADER_SYNC_PERIOD) == 0)) {
        _write_header();
    }

    return ESP_OK;
}

/* ============================================================================
 * blackbox_storage_read() — Lecture et vérification d'intégrité AES-256-GCM
 * ============================================================================
 */
esp_err_t blackbox_storage_read(uint32_t index, blackbox_frame_t *frame)
{
    if (frame == NULL || s_partition == NULL || index >= s_header.frame_count) {
        return ESP_ERR_INVALID_ARG;
    }

    uint32_t slot_index = index % s_header.max_frames;
    uint32_t offset = HEADER_SECTOR_SIZE + (slot_index * FRAME_STORED_SIZE);

    uint8_t stored_frame[FRAME_STORED_SIZE];
    esp_err_t err = esp_partition_read(
        s_partition, offset, stored_frame, FRAME_STORED_SIZE
    );
    if (err != ESP_OK) {
        return err;
    }

    const uint8_t *nonce      = stored_frame;
    const uint8_t *aad        = stored_frame + GCM_NONCE_SIZE;
    const uint8_t *tag        = stored_frame + GCM_NONCE_SIZE + GCM_AAD_SIZE;
    const uint8_t *ciphertext = stored_frame + GCM_NONCE_SIZE + GCM_AAD_SIZE + GCM_TAG_SIZE;

    mbedtls_gcm_context gcm_ctx;
    mbedtls_gcm_init(&gcm_ctx);

    int ret = mbedtls_gcm_setkey(&gcm_ctx, MBEDTLS_CIPHER_ID_AES, s_aes_key, 256);
    if (ret == 0) {
        ret = mbedtls_gcm_auth_decrypt(
            &gcm_ctx,
            FRAME_RAW_SIZE,
            nonce,
            GCM_NONCE_SIZE,
            aad,
            GCM_AAD_SIZE,
            tag,
            GCM_TAG_SIZE,
            ciphertext,
            (uint8_t *)frame
        );
    }
    mbedtls_gcm_free(&gcm_ctx);
    mbedtls_platform_zeroize(stored_frame, sizeof(stored_frame));

    if (ret == MBEDTLS_ERR_GCM_AUTH_FAILED) {
        ESP_LOGE(TAG, "ALERTE FORENSIQUE : Tag GMAC invalide sur trame #%lu (altération détectée) !",
                 (unsigned long)index);
        memset(frame, 0, sizeof(*frame));
        return ESP_ERR_INVALID_CRC;
    }

    return (ret == 0) ? ESP_OK : ESP_FAIL;
}

/* ============================================================================
 * blackbox_storage_count() & blackbox_storage_get_chain_hash()
 * ============================================================================
 */
uint32_t blackbox_storage_count(void)
{
    return s_header.frame_count;
}

void blackbox_storage_get_chain_hash(uint8_t out_hash[32])
{
    if (out_hash != NULL) {
        memcpy(out_hash, s_header.rolling_sha256, SHA256_DIGEST_SIZE);
    }
}

/* ============================================================================
 * blackbox_storage_sign_digest() & blackbox_storage_get_pubkey() (ECDSA P-256)
 * ============================================================================
 */
esp_err_t blackbox_storage_sign_digest(const uint8_t hash32[32], uint8_t *sig_der_out, size_t *sig_len_out)
{
    if (!s_ecdsa_ready || hash32 == NULL || sig_der_out == NULL || sig_len_out == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    mbedtls_ecdsa_context ecdsa;
    mbedtls_ecdsa_init(&ecdsa);

    int ret = mbedtls_ecp_group_load(&ecdsa.MBEDTLS_PRIVATE(grp), MBEDTLS_ECP_DP_SECP256R1);
    if (ret == 0) {
        ret = mbedtls_mpi_read_binary(&ecdsa.MBEDTLS_PRIVATE(d), s_ecdsa_priv, ECDSA_PRIV_SIZE);
    }
    if (ret == 0) {
        ret = mbedtls_ecdsa_write_signature(
            &ecdsa,
            MBEDTLS_MD_SHA256,
            hash32,
            SHA256_DIGEST_SIZE,
            sig_der_out,
            MBEDTLS_ECDSA_MAX_LEN,
            sig_len_out,
            _esp_rng_cb,
            NULL
        );
    }

    mbedtls_ecdsa_free(&ecdsa);
    return (ret == 0) ? ESP_OK : ESP_FAIL;
}

esp_err_t blackbox_storage_get_pubkey(uint8_t pubkey_out[65])
{
    if (!s_ecdsa_ready || pubkey_out == NULL) {
        return ESP_ERR_INVALID_STATE;
    }
    memcpy(pubkey_out, s_ecdsa_pub, ECDSA_PUB_SIZE);
    return ESP_OK;
}

/* ============================================================================
 * _load_or_generate_keys() — Clé AES-256-GCM + Paire de clés ECDSA P-256 en NVS
 * ============================================================================
 */
static esp_err_t _load_or_generate_keys(void)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open("bb_keys", NVS_READWRITE, &nvs);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Impossible d'ouvrir NVS bb_keys : %s", esp_err_to_name(err));
        return err;
    }

    /* 1. Clé symétrique AES-256-GCM */
    size_t key_len = AES_KEY_SIZE;
    err = nvs_get_blob(nvs, "aes256", s_aes_key, &key_len);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGW(TAG, "Premier boot — Génération de la clé AES-256-GCM via TRNG...");
        esp_fill_random(s_aes_key, AES_KEY_SIZE);
        err = nvs_set_blob(nvs, "aes256", s_aes_key, AES_KEY_SIZE);
        if (err != ESP_OK) {
            nvs_close(nvs);
            return err;
        }
        nvs_commit(nvs);
    } else if (err != ESP_OK) {
        nvs_close(nvs);
        return err;
    }

    /* 2. Clé asymétrique ECDSA P-256 (secp256r1) pour signature judiciaire */
    size_t priv_len = ECDSA_PRIV_SIZE;
    size_t pub_len  = ECDSA_PUB_SIZE;
    esp_err_t err_priv = nvs_get_blob(nvs, "ecdsa_priv", s_ecdsa_priv, &priv_len);
    esp_err_t err_pub  = nvs_get_blob(nvs, "ecdsa_pub", s_ecdsa_pub, &pub_len);

    if (err_priv == ESP_OK && err_pub == ESP_OK && priv_len == ECDSA_PRIV_SIZE && pub_len == ECDSA_PUB_SIZE) {
        s_ecdsa_ready = true;
        ESP_LOGI(TAG, "Clé de signature ECDSA P-256 chargée depuis NVS.");
    } else {
        ESP_LOGW(TAG, "Génération de la paire de clés ECDSA P-256 (secp256r1)...");
        mbedtls_ecdsa_context ecdsa;
        mbedtls_ecdsa_init(&ecdsa);

        int rc = mbedtls_ecdsa_genkey(&ecdsa, MBEDTLS_ECP_DP_SECP256R1, _esp_rng_cb, NULL);
        if (rc == 0) {
            rc = mbedtls_mpi_write_binary(&ecdsa.MBEDTLS_PRIVATE(d), s_ecdsa_priv, ECDSA_PRIV_SIZE);
        }
        if (rc == 0) {
            size_t olen = 0;
            rc = mbedtls_ecp_point_write_binary(
                &ecdsa.MBEDTLS_PRIVATE(grp),
                &ecdsa.MBEDTLS_PRIVATE(Q),
                MBEDTLS_ECP_PF_UNCOMPRESSED,
                &olen,
                s_ecdsa_pub,
                ECDSA_PUB_SIZE
            );
        }
        mbedtls_ecdsa_free(&ecdsa);

        if (rc == 0) {
            nvs_set_blob(nvs, "ecdsa_priv", s_ecdsa_priv, ECDSA_PRIV_SIZE);
            nvs_set_blob(nvs, "ecdsa_pub", s_ecdsa_pub, ECDSA_PUB_SIZE);
            nvs_commit(nvs);
            s_ecdsa_ready = true;
            ESP_LOGI(TAG, "Paire ECDSA P-256 générée et verrouillée en NVS.");
        } else {
            ESP_LOGE(TAG, "Échec génération ECDSA P-256 : -0x%04X", -rc);
        }
    }

    nvs_close(nvs);
    return ESP_OK;
}

/* ============================================================================
 * Helpers Flash (lecture/écriture de l'en-tête)
 * ============================================================================
 */
static esp_err_t _write_header(void)
{
    if (s_partition == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t err = esp_partition_erase_range(s_partition, 0, HEADER_SECTOR_SIZE);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Erreur effacement secteur en-tête Flash : %s", esp_err_to_name(err));
        return err;
    }

    return esp_partition_write(
        s_partition, 0, &s_header, sizeof(s_header)
    );
}

static esp_err_t _read_header(void)
{
    return esp_partition_read(
        s_partition, 0, &s_header, sizeof(s_header)
    );
}

/* ============================================================================
 * blackbox_storage_flush() — Synchronisation immédiate ("Last-Gasp Write")
 * ============================================================================
 */
esp_err_t blackbox_storage_flush(void)
{
    ESP_LOGI(TAG, "Flush d'urgence de l'en-tête forensique en Flash...");
    return _write_header();
}

void blackbox_storage_zeroize_keys(void)
{
    mbedtls_platform_zeroize(s_aes_key, sizeof(s_aes_key));
    mbedtls_platform_zeroize(s_ecdsa_priv, sizeof(s_ecdsa_priv));
    mbedtls_platform_zeroize(&s_header, sizeof(s_header));
    s_ecdsa_ready = false;
}
