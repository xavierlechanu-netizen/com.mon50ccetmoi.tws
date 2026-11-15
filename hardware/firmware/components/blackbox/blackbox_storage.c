/**
 * ============================================================================
 * blackbox_storage.c — Stockage Forensique AES-256-GCM + Merkle SHA-256 + ECDSA P-256
 * ============================================================================
 * Cible : ESP32-C3-MINI-1 (ESP-IDF v5.x)
 * Référentiel : Rapport d'Expertise Systèmes Critiques EXP-BB50-2026-REV3
 *
 * Architecture mémoire :
 *   Partition "blackbox_data" (768 Ko) : en-tête, anneau de trames (42 par
 *   secteur de 4 Ko), puis 2 emplacements d'événement d'accident figés et
 *   signés (voir la disposition détaillée plus bas).
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
#include <stddef.h>
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
#define FLASH_SECTOR_SIZE   4096    /* Secteur physique SPI NOR Flash (4 Ko) */
#define HEADER_SECTOR_SIZE  4096    /* Secteur 0 réservé exclusivement à l'en-tête */
#define HEADER_SYNC_PERIOD  50      /* Synchronisation en-tête toutes les 50 trames (anti-usure) */
#define PARTITION_MAGIC_GCM 0x424F5833UL /* "BOX3" — anneau aligné secteurs + événements signés */

/*
 * Disposition de la partition (768 Ko = 192 secteurs) :
 *   secteur 0                 : en-tête
 *   secteurs 1 .. N-33        : anneau de trames (42 trames de 96 o par secteur,
 *                               aucune trame à cheval sur deux secteurs)
 *   32 derniers secteurs      : 2 emplacements d'événement de 16 secteurs
 *                               (1 secteur d'enregistrement + 15 secteurs de trames)
 *
 * Correctif : l'ancien anneau mettait 42,67 trames par secteur et réécrivait
 * le 1er emplacement à chaque trame une fois plein (13 min de roulage), en
 * effaçant le même secteur 10 fois par seconde.
 */
#define SLOTS_PER_SECTOR    (FLASH_SECTOR_SIZE / FRAME_STORED_SIZE)   /* 42 */
#define EVENT_SECTORS       16
#define EVENT_FRAME_SECTORS (EVENT_SECTORS - 1)
#define EVENT_MAX_FRAMES    (EVENT_FRAME_SECTORS * SLOTS_PER_SECTOR)  /* 630 */
#define SNAP_PERIOD         10      /* Une graine de chaîne mémorisée toutes les 10 trames (1 s) */
#define SNAP_COUNT          ((BLACKBOX_EVENT_PRE_FRAMES / SNAP_PERIOD) + 2) /* 32 → 1,1 Ko de RAM */

_Static_assert(BLACKBOX_EVENT_PRE_FRAMES + SNAP_PERIOD + BLACKBOX_EVENT_POST_FRAMES <= EVENT_MAX_FRAMES,
    "Un emplacement d'événement doit contenir toute la fenêtre");

/* ---- En-tête de la partition (persisté en Flash sur le Secteur 0) ---- */
typedef struct __attribute__((packed)) {
    uint32_t magic;                         /* 0x424F5833 = "BOX3" */
    uint32_t version;                       /* Version du format = 3 */
    uint32_t frame_count;                   /* Nombre total de trames écrites = prochain seq_id */
    uint32_t ring_frames;                   /* Capacité de l'anneau */
    uint8_t  rolling_sha256[SHA256_DIGEST_SIZE]; /* Condensat Merkle courant (32 octets) */
    /* Événement ouvert par un choc et pas encore scellé (survit à un redémarrage) */
    uint8_t  pend_active;
    uint8_t  pad[3];
    uint32_t pend_start_seq;
    uint32_t pend_impact_seq;
    uint32_t pend_end_seq;
    uint8_t  pend_seed[SHA256_DIGEST_SIZE];
} partition_header_t;

_Static_assert(sizeof(partition_header_t) == 96, "partition_header_t : 96 octets");

typedef struct {
    uint32_t seq;                            /* seq_id de la trame qui suit cette graine */
    uint8_t  hash[SHA256_DIGEST_SIZE];       /* Hash de chaîne avant cette trame */
} chain_snapshot_t;

/* ---- Variables statiques ---- */
static const esp_partition_t *s_partition = NULL;
static partition_header_t s_header;
static uint32_t s_ring_sectors = 0;
static uint32_t s_event_base = 0;           /* Offset du 1er emplacement d'événement */
static chain_snapshot_t s_snap[SNAP_COUNT];
static uint32_t s_snap_next = 0;             /* Prochaine case à écrire */
static uint32_t s_snap_used = 0;
#define HEADER_RECORDS (HEADER_SECTOR_SIZE / sizeof(partition_header_t))  /* 42 */
static uint32_t s_header_next = 0;           /* prochain enregistrement libre du journal d'en-tête */

/**
 * Clés cryptographiques en RAM volatile (chargées depuis la partition NVS chiffrée).
 * Effacées immédiatement en cas d'alerte Tamper.
 */
static uint8_t s_aes_key[AES_KEY_SIZE] __attribute__((aligned(4)));
static uint8_t s_ecdsa_priv[ECDSA_PRIV_SIZE] __attribute__((aligned(4)));
static uint8_t s_ecdsa_pub[ECDSA_PUB_SIZE] __attribute__((aligned(4)));
static bool    s_ecdsa_ready = false;   /* clé privée présente : signature possible */
static bool    s_pub_ready = false;     /* clé publique connue */

/* ---- Prototypes internes ---- */
static esp_err_t _load_or_generate_keys(void);
static esp_err_t _write_header(void);
static esp_err_t _read_header(void);
static void      _compute_merkle_step(const blackbox_frame_t *frame);
static int       _esp_rng_cb(void *ctx, unsigned char *buf, size_t len);
static esp_err_t _decrypt_stored(const uint8_t stored[FRAME_STORED_SIZE], blackbox_frame_t *frame);
static void      _recover_tail(void);
static esp_err_t _seal_event(uint32_t end_seq);

/* Callback TRNG matériel pour mbedTLS ECDSA */
static int _esp_rng_cb(void *ctx, unsigned char *buf, size_t len)
{
    (void)ctx;
    esp_fill_random(buf, len);
    return 0;
}

/* Offset Flash d'un emplacement de l'anneau, et d'une trame d'événement */
static inline uint32_t _ring_offset(uint32_t seq)
{
    uint32_t slot = seq % s_header.ring_frames;
    return HEADER_SECTOR_SIZE + (slot / SLOTS_PER_SECTOR) * FLASH_SECTOR_SIZE
         + (slot % SLOTS_PER_SECTOR) * FRAME_STORED_SIZE;
}

static inline uint32_t _event_slot_offset(uint8_t slot)
{
    return s_event_base + (uint32_t)slot * EVENT_SECTORS * FLASH_SECTOR_SIZE;
}

static inline uint32_t _event_frame_offset(uint8_t slot, uint32_t i)
{
    return _event_slot_offset(slot) + FLASH_SECTOR_SIZE
         + (i / SLOTS_PER_SECTOR) * FLASH_SECTOR_SIZE
         + (i % SLOTS_PER_SECTOR) * FRAME_STORED_SIZE;
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

    uint32_t total_sectors = s_partition->size / FLASH_SECTOR_SIZE;
    if (total_sectors < 1 + BLACKBOX_EVENT_SLOTS * EVENT_SECTORS + 16) {
        ESP_LOGE(TAG, "Partition 'blackbox_data' trop petite (%lu secteurs).", (unsigned long)total_sectors);
        return ESP_FAIL;
    }
    s_ring_sectors = total_sectors - 1 - BLACKBOX_EVENT_SLOTS * EVENT_SECTORS;
    s_event_base = (1 + s_ring_sectors) * FLASH_SECTOR_SIZE;
    s_snap_next = 0;
    s_snap_used = 0;

    ESP_LOGI(TAG, "Partition trouvée : taille = %lu Ko",
             (unsigned long)(s_partition->size / 1024));

    /* Charger ou générer la clé AES-256-GCM et la paire de clés ECDSA P-256 */
    esp_err_t err = _load_or_generate_keys();
    if (err != ESP_OK) {
        return err;
    }

    /* Lire l'en-tête existant ou initialiser au format BOX3 */
    err = _read_header();
    if (err != ESP_OK || s_header.magic != PARTITION_MAGIC_GCM ||
        s_header.ring_frames != s_ring_sectors * SLOTS_PER_SECTOR) {
        ESP_LOGW(TAG, "Initialisation de la partition au format BOX3 (anneau + événements signés)...");
        memset(&s_header, 0, sizeof(s_header));
        s_header.magic = PARTITION_MAGIC_GCM;
        s_header.version = 3;
        s_header.frame_count = 0;
        s_header.ring_frames = s_ring_sectors * SLOTS_PER_SECTOR;

        /* Graine initiale de la chaîne de hachage Merkle (SHA-256 de la clé publique du boîtier) */
        mbedtls_sha256(s_ecdsa_pub, sizeof(s_ecdsa_pub), s_header.rolling_sha256, 0);

        esp_partition_erase_range(s_partition, 0, s_partition->size);
        s_header_next = 0;
        _write_header();
    } else {
        /* Redémarrage : reprendre les trames écrites après la dernière synchro de l'en-tête */
        _recover_tail();
        if (s_header.pend_active) {
            ESP_LOGW(TAG, "Événement de choc #%lu resté ouvert : scellement à la reprise.",
                     (unsigned long)s_header.pend_impact_seq);
            blackbox_event_seal_now();
        }
    }

    ESP_LOGI(TAG, "Stockage forensique prêt : %lu trames écrites, anneau de %lu trames (slot=%d octets).",
             (unsigned long)s_header.frame_count,
             (unsigned long)s_header.ring_frames,
             FRAME_STORED_SIZE);

    return ESP_OK;
}

/* ============================================================================
 * _recover_tail() — L'en-tête n'est écrit que toutes les 50 trames : après un
 * redémarrage brutal, jusqu'à 49 trames existent en Flash au-delà de frame_count.
 * Sans reprise, elles seraient écrasées et leurs numéros réutilisés (chaîne fourchue).
 * Une trame n'est reprise que si son tag GCM est valide, que son seq_id est le
 * suivant attendu et qu'elle pointe sur le hash courant.
 * ============================================================================
 */
static void _recover_tail(void)
{
    uint32_t recovered = 0;
    uint8_t stored[FRAME_STORED_SIZE];
    blackbox_frame_t frame;

    for (uint32_t guard = 0; guard < s_header.ring_frames; guard++) {
        uint32_t seq = s_header.frame_count;
        if (esp_partition_read(s_partition, _ring_offset(seq), stored, FRAME_STORED_SIZE) != ESP_OK) {
            break;
        }
        if (_decrypt_stored(stored, &frame) != ESP_OK ||
            frame.seq_id != seq ||
            memcmp(frame.prev_hash_trunc, s_header.rolling_sha256, sizeof(frame.prev_hash_trunc)) != 0) {
            break;
        }
        _compute_merkle_step(&frame);
        s_header.frame_count++;
        recovered++;
    }
    mbedtls_platform_zeroize(&frame, sizeof(frame));

    if (recovered > 0) {
        ESP_LOGW(TAG, "Reprise après redémarrage : %lu trame(s) récupérée(s).", (unsigned long)recovered);
        _write_header();
    }
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

    const uint32_t seq = s_header.frame_count;
    const uint32_t offset = _ring_offset(seq);

    /* Début d'un secteur de l'anneau : l'effacer (une fois par secteur, pas par trame) */
    if (((seq % s_header.ring_frames) % SLOTS_PER_SECTOR) == 0) {
        esp_err_t erase_err = esp_partition_erase_range(s_partition, offset, FLASH_SECTOR_SIZE);
        if (erase_err != ESP_OK) {
            ESP_LOGE(TAG, "Erreur effacement secteur flash offset %lu: %s",
                     (unsigned long)offset, esp_err_to_name(erase_err));
            return erase_err;
        }
    }

    /* Graine de chaîne mémorisée toutes les SNAP_PERIOD trames : point de départ
     * possible d'une fenêtre d'accident (la chaîne ne se recalcule pas à l'envers). */
    if ((seq % SNAP_PERIOD) == 0) {
        s_snap[s_snap_next].seq = seq;
        memcpy(s_snap[s_snap_next].hash, s_header.rolling_sha256, SHA256_DIGEST_SIZE);
        s_snap_next = (s_snap_next + 1) % SNAP_COUNT;
        if (s_snap_used < SNAP_COUNT) s_snap_used++;
    }

    /* ---- 1. Chaînage Forensique Merkle (ISO/IEC 27037) ---- */
    frame->seq_id = seq;
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

    esp_err_t err = esp_partition_write(s_partition, offset, stored_frame, FRAME_STORED_SIZE);

    /* Nettoyage immédiat des données sensibles en pile */
    mbedtls_platform_zeroize(ciphertext, sizeof(ciphertext));
    mbedtls_platform_zeroize(stored_frame, sizeof(stored_frame));

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Erreur d'écriture Flash : %s", esp_err_to_name(err));
        return err;
    }

    /* ---- 5. Mise à jour du compteur ---- */
    s_header.frame_count++;
    bool sync_now = (s_header.frame_count % HEADER_SYNC_PERIOD) == 0;

    /* ---- 6. Événement d'accident ---- */
    if ((frame->flags & 0x04) && !s_header.pend_active) {
        /* Premier choc : la fenêtre part de la plus ancienne graine >= choc - 30 s */
        uint32_t want = (seq >= BLACKBOX_EVENT_PRE_FRAMES) ? seq - BLACKBOX_EVENT_PRE_FRAMES : 0;
        int best = -1;
        for (uint32_t k = 0; k < s_snap_used; k++) {
            const chain_snapshot_t *sn = &s_snap[k];
            if (sn->seq > seq || sn->seq < want) continue;
            if (best < 0 || sn->seq < s_snap[best].seq) best = (int)k;
        }
        if (best < 0) {
            /* Démarrage il y a moins de 30 s : la plus ancienne graine disponible */
            for (uint32_t k = 0; k < s_snap_used; k++) {
                if (s_snap[k].seq <= seq && (best < 0 || s_snap[k].seq < s_snap[best].seq)) best = (int)k;
            }
        }
        if (best >= 0) {
            s_header.pend_active = 1;
            s_header.pend_impact_seq = seq;
            s_header.pend_start_seq = s_snap[best].seq;
            s_header.pend_end_seq = seq + BLACKBOX_EVENT_POST_FRAMES;
            memcpy(s_header.pend_seed, s_snap[best].hash, SHA256_DIGEST_SIZE);
            ESP_LOGW(TAG, "Choc trame #%lu : fenêtre #%lu..#%lu ouverte.",
                     (unsigned long)seq, (unsigned long)s_header.pend_start_seq,
                     (unsigned long)s_header.pend_end_seq);
        }
        sync_now = true;
    } else if (frame->flags & 0x04) {
        sync_now = true;
    }

    if (s_header.pend_active && seq >= s_header.pend_end_seq) {
        _seal_event(seq);   /* écrit l'en-tête */
    } else if (sync_now) {
        _write_header();
    }

    return ESP_OK;
}

/* ============================================================================
 * Déchiffrement d'une trame stockée (tag GMAC vérifié, seq_id authentifié)
 * ============================================================================
 */
static esp_err_t _decrypt_stored(const uint8_t stored[FRAME_STORED_SIZE], blackbox_frame_t *frame)
{
    const uint8_t *nonce      = stored;
    const uint8_t *aad        = stored + GCM_NONCE_SIZE;
    const uint8_t *tag        = stored + GCM_NONCE_SIZE + GCM_AAD_SIZE;
    const uint8_t *ciphertext = stored + GCM_NONCE_SIZE + GCM_AAD_SIZE + GCM_TAG_SIZE;

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

    if (ret != 0) {
        memset(frame, 0, sizeof(*frame));
        return (ret == MBEDTLS_ERR_GCM_AUTH_FAILED) ? ESP_ERR_INVALID_CRC : ESP_FAIL;
    }
    return ESP_OK;
}

/* ============================================================================
 * blackbox_storage_read() — Lecture d'une trame encore présente dans l'anneau
 * ============================================================================
 */
esp_err_t blackbox_storage_read(uint32_t index, blackbox_frame_t *frame)
{
    if (frame == NULL || s_partition == NULL || index >= s_header.frame_count) {
        return ESP_ERR_INVALID_ARG;
    }
    /* Trame déjà écrasée par l'anneau. Le secteur en cours d'écriture a été effacé
     * d'avance : seules ring_frames - 42 trames sont garanties lisibles. */
    if (s_header.frame_count - index > s_header.ring_frames - SLOTS_PER_SECTOR) {
        return ESP_ERR_NOT_FOUND;
    }

    uint8_t stored_frame[FRAME_STORED_SIZE];
    esp_err_t err = esp_partition_read(s_partition, _ring_offset(index), stored_frame, FRAME_STORED_SIZE);
    if (err != ESP_OK) {
        return err;
    }
    err = _decrypt_stored(stored_frame, frame);
    mbedtls_platform_zeroize(stored_frame, sizeof(stored_frame));

    if (err == ESP_ERR_INVALID_CRC) {
        ESP_LOGE(TAG, "ALERTE FORENSIQUE : Tag GMAC invalide sur trame #%lu (altération détectée) !",
                 (unsigned long)index);
    }
    return err;
}

/* ============================================================================
 * Événements d'accident : scellement, lecture, acquittement
 * ============================================================================
 */
bool blackbox_event_pending(void)
{
    return s_header.pend_active != 0;
}

esp_err_t blackbox_event_get(uint8_t slot, blackbox_event_t *out)
{
    if (out == NULL || slot >= BLACKBOX_EVENT_SLOTS || s_partition == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    esp_err_t err = esp_partition_read(s_partition, _event_slot_offset(slot), out, sizeof(*out));
    if (err != ESP_OK) return err;
    return (out->magic == BLACKBOX_EVENT_MAGIC) ? ESP_OK : ESP_ERR_NOT_FOUND;
}

esp_err_t blackbox_event_read_frame(uint8_t slot, uint32_t i, blackbox_frame_t *frame)
{
    blackbox_event_t ev;
    esp_err_t err = blackbox_event_get(slot, &ev);
    if (err != ESP_OK) return err;
    if (frame == NULL || i > ev.end_seq - ev.start_seq) return ESP_ERR_INVALID_ARG;

    uint8_t stored[FRAME_STORED_SIZE];
    err = esp_partition_read(s_partition, _event_frame_offset(slot, i), stored, FRAME_STORED_SIZE);
    if (err != ESP_OK) return err;
    err = _decrypt_stored(stored, frame);
    mbedtls_platform_zeroize(stored, sizeof(stored));
    if (err == ESP_OK && frame->seq_id != ev.start_seq + i) {
        memset(frame, 0, sizeof(*frame));
        return ESP_ERR_INVALID_CRC;
    }
    return err;
}

int blackbox_event_oldest_unacked(void)
{
    int best = -1;
    uint32_t best_impact = 0;
    for (uint8_t k = 0; k < BLACKBOX_EVENT_SLOTS; k++) {
        blackbox_event_t ev;
        if (blackbox_event_get(k, &ev) == ESP_OK && ev.ack == 0xFF &&
            (best < 0 || ev.impact_seq < best_impact)) {
            best = k;
            best_impact = ev.impact_seq;
        }
    }
    return best;
}

esp_err_t blackbox_event_ack(uint32_t end_seq)
{
    for (uint8_t k = 0; k < BLACKBOX_EVENT_SLOTS; k++) {
        blackbox_event_t ev;
        if (blackbox_event_get(k, &ev) == ESP_OK && ev.end_seq == end_seq && ev.ack == 0xFF) {
            /* 0xFF → 0x00 : un octet passé à zéro, sans effacement de secteur */
            const uint8_t zero = 0x00;
            return esp_partition_write(s_partition,
                _event_slot_offset(k) + offsetof(blackbox_event_t, ack), &zero, 1);
        }
    }
    return ESP_ERR_NOT_FOUND;
}

esp_err_t blackbox_event_seal_now(void)
{
    if (!s_header.pend_active) return ESP_ERR_NOT_FOUND;
    if (s_header.frame_count == 0 || s_header.frame_count - 1 < s_header.pend_start_seq) {
        s_header.pend_active = 0;
        return _write_header();
    }
    return _seal_event(s_header.frame_count - 1);
}

/*
 * Scelle l'événement en cours, la fenêtre s'arrêtant à end_seq (= dernière trame écrite,
 * donc s_header.rolling_sha256 est la racine). Ordre d'écriture : trames, puis
 * enregistrement signé en dernier → un enregistrement présent est toujours complet.
 */
static esp_err_t _seal_event(uint32_t end_seq)
{
    const uint32_t start = s_header.pend_start_seq;
    uint32_t count = end_seq - start + 1;
    if (count > EVENT_MAX_FRAMES) count = EVENT_MAX_FRAMES;
    end_seq = start + count - 1;
    if (end_seq != s_header.frame_count - 1) {
        /* Ne doit pas arriver : la racine ne correspondrait pas à la fenêtre */
        ESP_LOGE(TAG, "Fenêtre incohérente, événement abandonné.");
        s_header.pend_active = 0;
        _write_header();
        return ESP_ERR_INVALID_STATE;
    }

    /* Emplacement : vide, sinon le plus ancien déjà acquitté ; jamais un non acquitté */
    int slot = -1;
    uint32_t oldest = UINT32_MAX;
    for (uint8_t k = 0; k < BLACKBOX_EVENT_SLOTS; k++) {
        blackbox_event_t ev;
        esp_err_t e = blackbox_event_get(k, &ev);
        if (e == ESP_ERR_NOT_FOUND) { slot = k; break; }
        if (e == ESP_OK && ev.ack == 0x00 && ev.impact_seq < oldest) { slot = k; oldest = ev.impact_seq; }
    }
    if (slot < 0) {
        ESP_LOGE(TAG, "Deux accidents en attente d'envoi : le nouvel événement #%lu n'est pas figé.",
                 (unsigned long)s_header.pend_impact_seq);
        s_header.pend_active = 0;
        _write_header();
        return ESP_ERR_NO_MEM;
    }

    esp_err_t err = esp_partition_erase_range(s_partition, _event_slot_offset((uint8_t)slot),
                                              EVENT_SECTORS * FLASH_SECTOR_SIZE);
    if (err != ESP_OK) return err;

    /* Copie des trames chiffrées telles quelles (pas de déchiffrement nécessaire) */
    uint8_t stored[FRAME_STORED_SIZE];
    for (uint32_t i = 0; i < count; i++) {
        err = esp_partition_read(s_partition, _ring_offset(start + i), stored, FRAME_STORED_SIZE);
        if (err == ESP_OK) {
            err = esp_partition_write(s_partition, _event_frame_offset((uint8_t)slot, i), stored, FRAME_STORED_SIZE);
        }
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Copie de la trame #%lu impossible.", (unsigned long)(start + i));
            return err;
        }
    }

    blackbox_event_t ev;
    memset(&ev, 0, sizeof(ev));
    ev.magic = BLACKBOX_EVENT_MAGIC;
    ev.start_seq = start;
    ev.end_seq = end_seq;
    ev.impact_seq = s_header.pend_impact_seq;
    memcpy(ev.seed, s_header.pend_seed, SHA256_DIGEST_SIZE);
    memcpy(ev.root, s_header.rolling_sha256, SHA256_DIGEST_SIZE);
    ev.ack = 0xFF;
    ev.reserved[0] = 0xFF;
    ev.reserved[1] = 0xFF;

    /* Signature de SHA-256(racine) : le serveur vérifie crypto.verify("sha256", racine, ...) */
    uint8_t digest[SHA256_DIGEST_SIZE];
    mbedtls_sha256(ev.root, SHA256_DIGEST_SIZE, digest, 0);
    size_t sig_len = 0;
    if (blackbox_storage_sign_digest(digest, ev.sig, &sig_len) == ESP_OK && sig_len <= BLACKBOX_SIG_MAX) {
        ev.sig_len = (uint8_t)sig_len;
    } else {
        ESP_LOGE(TAG, "Signature de l'événement impossible (clé ECDSA absente) : trames conservées, preuve non signée.");
        ev.sig_len = 0;
        memset(ev.sig, 0, sizeof(ev.sig));
    }

    err = esp_partition_write(s_partition, _event_slot_offset((uint8_t)slot), &ev, sizeof(ev));
    s_header.pend_active = 0;
    _write_header();
    if (err == ESP_OK) {
        ESP_LOGW(TAG, "Événement scellé (emplacement %d) : trames #%lu..#%lu, choc #%lu, signature %s.",
                 slot, (unsigned long)ev.start_seq, (unsigned long)ev.end_seq,
                 (unsigned long)ev.impact_seq, ev.sig_len ? "OK" : "ABSENTE");
    }
    return err;
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
    if (!s_pub_ready || pubkey_out == NULL) {
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
    /* Clés propres à chaque boîtier, fabriquées dans la puce en mode usine (tools/mise_en_service.py)
     * (partition NVS chiffrée, espace « storage » : aes_key, ble_pin, ecdsa_priv, ecdsa_pub).
     * La clé publique est enregistrée au même moment côté serveur : c'est la seule
     * qui fera foi pour vérifier les accidents signés par ce boîtier. */
    nvs_handle_t nvs;
    esp_err_t err = nvs_open("storage", NVS_READWRITE, &nvs);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Impossible d'ouvrir NVS storage : %s", esp_err_to_name(err));
        return err;
    }

    /* 1. Clé symétrique AES-256-GCM (chiffrement des trames dans la Flash) */
    size_t key_len = AES_KEY_SIZE;
    err = nvs_get_blob(nvs, "aes_key", s_aes_key, &key_len);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGW(TAG, "Boîtier non provisionné : clé AES-256-GCM générée sur place (TRNG).");
        esp_fill_random(s_aes_key, AES_KEY_SIZE);
        err = nvs_set_blob(nvs, "aes_key", s_aes_key, AES_KEY_SIZE);
        if (err != ESP_OK) {
            nvs_close(nvs);
            return err;
        }
        nvs_commit(nvs);
    } else if (err != ESP_OK || key_len != AES_KEY_SIZE) {
        nvs_close(nvs);
        return (err != ESP_OK) ? err : ESP_ERR_INVALID_STATE;
    }

    /* 2. Biclé ECDSA P-256 (signature des accidents) */
    size_t priv_len = ECDSA_PRIV_SIZE;
    size_t pub_len  = ECDSA_PUB_SIZE;
    esp_err_t err_priv = nvs_get_blob(nvs, "ecdsa_priv", s_ecdsa_priv, &priv_len);
    esp_err_t err_pub  = nvs_get_blob(nvs, "ecdsa_pub", s_ecdsa_pub, &pub_len);
    size_t serial_len = 0;
    const bool has_serial = nvs_get_str(nvs, "serial", NULL, &serial_len) == ESP_OK && serial_len > 1;

    s_pub_ready = (err_pub == ESP_OK && pub_len == ECDSA_PUB_SIZE && s_ecdsa_pub[0] == 0x04);
    if (err_priv == ESP_OK && s_pub_ready && priv_len == ECDSA_PRIV_SIZE) {
        s_ecdsa_ready = true;
        ESP_LOGI(TAG, "Clé de signature ECDSA P-256 du boîtier chargée.");
    } else if (!s_pub_ready && !has_serial) {
        /* MODE USINE (boîtier neuf : ni clé ni numéro de série) : la paire de clés et le
         * code d'appairage sont fabriqués ICI, dans la puce. La clé privée ne sort jamais ;
         * l'usine ne relève que la clé publique, que le serveur lie à un numéro de série. */
        ESP_LOGW(TAG, "Mode usine : génération de la paire ECDSA P-256 et du code d'appairage dans la puce.");
        mbedtls_ecdsa_context ecdsa;
        mbedtls_ecdsa_init(&ecdsa);
        int rc = mbedtls_ecdsa_genkey(&ecdsa, MBEDTLS_ECP_DP_SECP256R1, _esp_rng_cb, NULL);
        if (rc == 0) {
            rc = mbedtls_mpi_write_binary(&ecdsa.MBEDTLS_PRIVATE(d), s_ecdsa_priv, ECDSA_PRIV_SIZE);
        }
        if (rc == 0) {
            size_t olen = 0;
            rc = mbedtls_ecp_point_write_binary(&ecdsa.MBEDTLS_PRIVATE(grp), &ecdsa.MBEDTLS_PRIVATE(Q),
                                                MBEDTLS_ECP_PF_UNCOMPRESSED, &olen, s_ecdsa_pub, ECDSA_PUB_SIZE);
        }
        mbedtls_ecdsa_free(&ecdsa);
        uint32_t rnd = 0;
        esp_fill_random(&rnd, sizeof(rnd));
        const uint32_t pin = 100000 + (rnd % 900000);
        if (rc == 0 &&
            nvs_set_blob(nvs, "ecdsa_priv", s_ecdsa_priv, ECDSA_PRIV_SIZE) == ESP_OK &&
            nvs_set_blob(nvs, "ecdsa_pub", s_ecdsa_pub, ECDSA_PUB_SIZE) == ESP_OK &&
            nvs_set_u32(nvs, "ble_pin", pin) == ESP_OK &&
            nvs_commit(nvs) == ESP_OK) {
            s_ecdsa_ready = true;
            s_pub_ready = true;
        } else {
            mbedtls_platform_zeroize(s_ecdsa_priv, sizeof(s_ecdsa_priv));
            ESP_LOGE(TAG, "Mode usine : génération des clés impossible.");
        }
    } else {
        /* Clé privée absente alors que le boîtier a déjà une identité (clé publique ou
         * numéro) : boîtier ouvert, ou NVS endommagée. Jamais de nouvelle clé : une clé
         * refaite ne correspondrait plus au numéro enregistré sur le serveur. */
        mbedtls_platform_zeroize(s_ecdsa_priv, sizeof(s_ecdsa_priv));
        s_ecdsa_ready = false;
        if (!s_pub_ready) memset(s_ecdsa_pub, 0, sizeof(s_ecdsa_pub));
        ESP_LOGE(TAG, "Plus de clé de signature (boîtier ouvert ou NVS endommagée) : accidents existants lisibles, plus aucune signature.");
    }

    nvs_close(nvs);
    return ESP_OK;
}

/* ============================================================================
 * Helpers Flash (lecture/écriture de l'en-tête)
 * ============================================================================
 */
/*
 * L'en-tête est journalisé dans le secteur 0 : chaque synchronisation ajoute un
 * enregistrement de 96 o à la suite du précédent, et le secteur n'est effacé
 * que lorsqu'il est plein (42 enregistrements). Avant : un effacement toutes les
 * 50 trames (5 s), soit l'endurance de la Flash (~100 000 cycles) atteinte en
 * ~140 h de roulage. Maintenant : ~5 800 h.
 * Le « magic » est écrit en dernier : un enregistrement interrompu par une
 * coupure n'est jamais pris pour valide.
 */

static esp_err_t _write_header(void)
{
    if (s_partition == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (s_header_next >= HEADER_RECORDS) {
        esp_err_t err = esp_partition_erase_range(s_partition, 0, HEADER_SECTOR_SIZE);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Erreur effacement secteur en-tête Flash : %s", esp_err_to_name(err));
            return err;
        }
        s_header_next = 0;
    }

    const uint32_t off = s_header_next * sizeof(partition_header_t);
    const uint8_t *raw = (const uint8_t *)&s_header;
    esp_err_t err = esp_partition_write(s_partition, off + 4, raw + 4, sizeof(s_header) - 4);
    if (err == ESP_OK) {
        err = esp_partition_write(s_partition, off, raw, 4);   /* magic en dernier */
    }
    s_header_next++;
    return err;
}

static esp_err_t _read_header(void)
{
    partition_header_t rec;
    bool found = false;
    s_header_next = 0;
    for (uint32_t i = 0; i < HEADER_RECORDS; i++) {
        esp_err_t err = esp_partition_read(s_partition, i * sizeof(rec), &rec, sizeof(rec));
        if (err != ESP_OK) return err;
        if (rec.magic == PARTITION_MAGIC_GCM) {
            s_header = rec;
            found = true;
            s_header_next = i + 1;
        } else if (rec.magic == 0xFFFFFFFFUL) {
            /* Emplacement jamais terminé : la suite du journal repart après lui */
            if (found) break;
        }
    }
    if (!found) {
        memset(&s_header, 0, sizeof(s_header));
        s_header_next = HEADER_RECORDS;   /* force l'effacement à la 1re écriture */
    }
    return ESP_OK;
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
    mbedtls_platform_zeroize(s_ecdsa_priv, sizeof(s_ecdsa_priv));
    s_ecdsa_ready = false;
}

/* ============================================================================
 * Identité du boîtier : numéro de série (écrit une seule fois), code d'appairage,
 * preuve de possession de la clé pour la mise en service en usine
 * ============================================================================
 */
static bool _serial_format_ok(const char *s)
{
    /* BB50V<1-9>-P01..P10 (prototypes) ou BB50V<1-9>-A01..ZZ99 sans P ni 00 */
    size_t n = s ? strlen(s) : 0;
    if (n < 10 || n > 11 || strncmp(s, "BB50V", 5) != 0 || s[5] < '1' || s[5] > '9' || s[6] != '-') return false;
    const char *c = s + 7;
    size_t letters = (n == 11) ? 2 : 1;
    for (size_t i = 0; i < letters; i++) if (c[i] < 'A' || c[i] > 'Z') return false;
    const char d1 = c[letters], d2 = c[letters + 1];
    if (d1 < '0' || d1 > '9' || d2 < '0' || d2 > '9') return false;
    const int num = (d1 - '0') * 10 + (d2 - '0');
    if (num == 0) return false;
    if (letters == 1 && c[0] == 'P') return num <= 10;          /* prototypes P01..P10 */
    for (size_t i = 0; i < letters; i++) if (c[i] == 'P') return false;
    return true;
}

esp_err_t blackbox_identity_get_serial(char *out, size_t cap)
{
    nvs_handle_t nvs;
    if (out == NULL || cap == 0) return ESP_ERR_INVALID_ARG;
    out[0] = '\0';
    esp_err_t err = nvs_open("storage", NVS_READWRITE, &nvs);
    if (err != ESP_OK) return err;
    size_t len = cap;
    err = nvs_get_str(nvs, "serial", out, &len);
    nvs_close(nvs);
    if (err != ESP_OK || out[0] == '\0') { out[0] = '\0'; return ESP_ERR_NOT_FOUND; }
    return ESP_OK;
}

esp_err_t blackbox_identity_set_serial(const char *serial)
{
    char current[BLACKBOX_SERIAL_MAX];
    if (!_serial_format_ok(serial)) return ESP_ERR_INVALID_ARG;
    if (!s_pub_ready) return ESP_ERR_INVALID_STATE;   /* jamais de numéro sans clé */
    if (blackbox_identity_get_serial(current, sizeof(current)) == ESP_OK) {
        return ESP_ERR_INVALID_STATE;                 /* écrit une seule fois */
    }
    nvs_handle_t nvs;
    esp_err_t err = nvs_open("storage", NVS_READWRITE, &nvs);
    if (err != ESP_OK) return err;
    err = nvs_set_str(nvs, "serial", serial);
    if (err == ESP_OK) err = nvs_commit(nvs);
    nvs_close(nvs);
    return err;
}

esp_err_t blackbox_identity_get_pin(uint32_t *pin)
{
    nvs_handle_t nvs;
    if (pin == NULL) return ESP_ERR_INVALID_ARG;
    esp_err_t err = nvs_open("storage", NVS_READWRITE, &nvs);
    if (err != ESP_OK) return err;
    err = nvs_get_u32(nvs, "ble_pin", pin);
    nvs_close(nvs);
    return err;
}

esp_err_t blackbox_factory_pop(const uint8_t challenge[32], uint8_t *sig_der_out, size_t *sig_len_out)
{
    char serial[BLACKBOX_SERIAL_MAX];
    if (challenge == NULL || sig_der_out == NULL || sig_len_out == NULL) return ESP_ERR_INVALID_ARG;
    /* Uniquement avant l'attribution du numéro : après, plus rien n'est signé sur demande */
    if (blackbox_identity_get_serial(serial, sizeof(serial)) == ESP_OK || !s_ecdsa_ready) {
        return ESP_ERR_INVALID_STATE;
    }
    /* Message fixe et préfixé : ce n'est jamais un condensat quelconque fourni de l'extérieur,
     * donc impossible de faire signer une fausse racine d'accident par ce chemin.
     * Le serveur vérifie crypto.verify("sha256", message, cléPublique, signature). */
    static const char hexd[] = "0123456789abcdef";
    char msg[20 + 64 + 1 + 130 + 1];
    size_t k = 0;
    memcpy(msg, "mon50cc-factory-pop:", 20); k = 20;
    for (int i = 0; i < 32; i++) { msg[k++] = hexd[challenge[i] >> 4]; msg[k++] = hexd[challenge[i] & 15]; }
    msg[k++] = ':';
    for (int i = 0; i < ECDSA_PUB_SIZE; i++) { msg[k++] = hexd[s_ecdsa_pub[i] >> 4]; msg[k++] = hexd[s_ecdsa_pub[i] & 15]; }
    uint8_t digest[SHA256_DIGEST_SIZE];
    mbedtls_sha256((const uint8_t *)msg, k, digest, 0);
    return blackbox_storage_sign_digest(digest, sig_der_out, sig_len_out);
}

/*
 * Ouverture du boîtier (maillage de cuivre coupé) — comme un enregistreur d'avion,
 * la preuve n'est jamais détruite :
 *   1. l'accident en cours est signé tant que la clé existe encore ;
 *   2. la clé de SIGNATURE est détruite (RAM + NVS) : plus aucune nouvelle preuve ;
 *   3. l'anneau des trajets ordinaires est effacé (vie privée) ;
 *   4. les accidents figés et signés sont conservés, ainsi que la clé AES qui
 *      permet de les relire et de les exporter (sans elle ils seraient perdus).
 */
esp_err_t blackbox_storage_tamper_wipe(void)
{
    if (s_partition == NULL) return ESP_ERR_INVALID_STATE;

    if (s_header.pend_active) {
        blackbox_event_seal_now();
    }

    blackbox_storage_zeroize_keys();
    nvs_handle_t nvs;
    if (nvs_open("storage", NVS_READWRITE, &nvs) == ESP_OK) {
        nvs_erase_key(nvs, "ecdsa_priv");
        nvs_commit(nvs);
        nvs_close(nvs);
    }

    esp_err_t err = esp_partition_erase_range(s_partition, HEADER_SECTOR_SIZE,
                                              s_ring_sectors * FLASH_SECTOR_SIZE);
    mbedtls_platform_zeroize(s_snap, sizeof(s_snap));
    s_snap_used = 0;
    _write_header();
    ESP_LOGE(TAG, "Boîtier ouvert : clé de signature détruite, trajets effacés, accidents signés conservés.");
    return err;
}
