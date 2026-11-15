/*
 * Banc de test hôte du firmware Boîte Noire : implémentations minimales
 *   - Flash SPI NOR simulée : effacement par secteur de 4 Ko (0xFF), l'écriture
 *     ne peut que passer des bits à 0 (comme la vraie Flash) ; compteur d'usure.
 *   - NVS en mémoire, TRNG = /dev/urandom.
 *   - mbedTLS (SHA-256, AES-256-GCM, ECDSA P-256) sur OpenSSL.
 * Le code testé (components/blackbox/blackbox_storage.c) est compilé tel quel.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <openssl/evp.h>
#include <openssl/ec.h>
#include <openssl/ecdsa.h>
#include <openssl/obj_mac.h>
#include <openssl/bn.h>

#include "esp_err.h"
#include "esp_partition.h"
#include "esp_random.h"
#include "nvs.h"
#include "mbedtls/gcm.h"
#include "mbedtls/ecdsa.h"
#include "host_flash.h"

/* ---- Flash ---- */
uint8_t  g_flash[HOST_FLASH_SIZE];
uint32_t g_erase_count[HOST_FLASH_SIZE / 4096];
int      g_flash_violations = 0;   /* écriture sur des bits non effacés */
static esp_partition_t s_part = { HOST_FLASH_SIZE };

const esp_partition_t *esp_partition_find_first(int type, int subtype, const char *label)
{
    (void)type; (void)subtype;
    return strcmp(label, "blackbox_data") == 0 ? &s_part : NULL;
}

esp_err_t esp_partition_read(const esp_partition_t *p, size_t off, void *dst, size_t len)
{
    (void)p;
    if (off + len > HOST_FLASH_SIZE) return ESP_ERR_INVALID_ARG;
    memcpy(dst, g_flash + off, len);
    return ESP_OK;
}

esp_err_t esp_partition_write(const esp_partition_t *p, size_t off, const void *src, size_t len)
{
    (void)p;
    if (off + len > HOST_FLASH_SIZE) return ESP_ERR_INVALID_ARG;
    const uint8_t *s = src;
    for (size_t i = 0; i < len; i++) {
        if ((g_flash[off + i] & s[i]) != s[i]) g_flash_violations++;
        g_flash[off + i] &= s[i];   /* NOR : 1 → 0 seulement */
    }
    return ESP_OK;
}

esp_err_t esp_partition_erase_range(const esp_partition_t *p, size_t off, size_t len)
{
    (void)p;
    if (off % 4096 || len % 4096 || off + len > HOST_FLASH_SIZE) return ESP_ERR_INVALID_ARG;
    memset(g_flash + off, 0xFF, len);
    for (size_t s = off / 4096; s < (off + len) / 4096; s++) g_erase_count[s]++;
    return ESP_OK;
}

/* ---- TRNG ---- */
void esp_fill_random(void *buf, size_t len)
{
    FILE *f = fopen("/dev/urandom", "rb");
    if (!f || fread(buf, 1, len, f) != len) abort();
    fclose(f);
}

/* ---- NVS (en mémoire, survit au « redémarrage » simulé) ; clé = espace/nom ---- */
static struct { char key[40]; uint8_t v[80]; size_t len; } s_nvs[12];
static int s_nvs_n = 0;
static char s_ns[16] = "";

esp_err_t nvs_open(const char *ns, int mode, nvs_handle_t *h) { (void)mode; snprintf(s_ns, sizeof(s_ns), "%s", ns); *h = 1; return ESP_OK; }
esp_err_t nvs_commit(nvs_handle_t h) { (void)h; return ESP_OK; }
void nvs_close(nvs_handle_t h) { (void)h; }

static void full_key(char out[40], const char *key) { snprintf(out, 40, "%s/%s", s_ns, key); }

esp_err_t nvs_get_blob(nvs_handle_t h, const char *key, void *out, size_t *len)
{
    (void)h;
    char k[40];
    full_key(k, key);
    for (int i = 0; i < s_nvs_n; i++) {
        if (strcmp(s_nvs[i].key, k) == 0) {
            if (*len < s_nvs[i].len) return ESP_FAIL;
            memcpy(out, s_nvs[i].v, s_nvs[i].len);
            *len = s_nvs[i].len;
            return ESP_OK;
        }
    }
    return ESP_ERR_NVS_NOT_FOUND;
}

esp_err_t nvs_set_blob(nvs_handle_t h, const char *key, const void *v, size_t len)
{
    (void)h;
    char k[40];
    full_key(k, key);
    int i;
    for (i = 0; i < s_nvs_n && strcmp(s_nvs[i].key, k) != 0; i++) {}
    if (i == s_nvs_n) { if (s_nvs_n == 12 || len > 80) return ESP_FAIL; s_nvs_n++; }
    memcpy(s_nvs[i].key, k, sizeof(k));
    memcpy(s_nvs[i].v, v, len);
    s_nvs[i].len = len;
    return ESP_OK;
}

esp_err_t nvs_erase_key(nvs_handle_t h, const char *key)
{
    (void)h;
    char k[40];
    full_key(k, key);
    for (int i = 0; i < s_nvs_n; i++) {
        if (strcmp(s_nvs[i].key, k) == 0) {
            s_nvs[i] = s_nvs[--s_nvs_n];
            return ESP_OK;
        }
    }
    return ESP_ERR_NVS_NOT_FOUND;
}

esp_err_t nvs_get_u32(nvs_handle_t h, const char *key, uint32_t *out)
{
    size_t len = sizeof(*out);
    return nvs_get_blob(h, key, out, &len);
}

esp_err_t nvs_set_u32(nvs_handle_t h, const char *key, uint32_t v) { return nvs_set_blob(h, key, &v, sizeof(v)); }

/* Comme ESP-IDF : out == NULL → renvoie la longueur (zéro final compris) */
esp_err_t nvs_get_str(nvs_handle_t h, const char *key, char *out, size_t *len)
{
    char tmp[80];
    size_t n = sizeof(tmp);
    esp_err_t e = nvs_get_blob(h, key, tmp, &n);
    if (e != ESP_OK) return e;
    if (out == NULL) { *len = n; return ESP_OK; }
    if (*len < n) return ESP_FAIL;
    memcpy(out, tmp, n);
    *len = n;
    return ESP_OK;
}

esp_err_t nvs_set_str(nvs_handle_t h, const char *key, const char *v) { return nvs_set_blob(h, key, v, strlen(v) + 1); }

/* Clés injectées d'avance en NVS (ancien procédé, conservé pour tester ce chemin de chargement) */
void host_provision(const uint8_t aes[32], const uint8_t priv[32], const uint8_t pub[65])
{
    nvs_handle_t h;
    nvs_open("storage", 1, &h);
    nvs_set_blob(h, "aes_key", aes, 32);
    nvs_set_blob(h, "ecdsa_priv", priv, 32);
    nvs_set_blob(h, "ecdsa_pub", pub, 65);
}

/* ---- AES-256-GCM ---- */
void mbedtls_gcm_init(mbedtls_gcm_context *c) { memset(c, 0, sizeof(*c)); }
void mbedtls_gcm_free(mbedtls_gcm_context *c) { memset(c, 0, sizeof(*c)); }
int mbedtls_gcm_setkey(mbedtls_gcm_context *c, int cipher, const unsigned char *key, unsigned int bits)
{
    if (cipher != MBEDTLS_CIPHER_ID_AES || bits != 256) return -1;
    memcpy(c->key, key, 32);
    return 0;
}

int mbedtls_gcm_crypt_and_tag(mbedtls_gcm_context *c, int mode, size_t len, const unsigned char *iv, size_t iv_len,
                              const unsigned char *add, size_t add_len, const unsigned char *in, unsigned char *out,
                              size_t tag_len, unsigned char *tag)
{
    if (mode != MBEDTLS_GCM_ENCRYPT) return -1;
    EVP_CIPHER_CTX *x = EVP_CIPHER_CTX_new();
    int ol = 0, ok = EVP_EncryptInit_ex(x, EVP_aes_256_gcm(), NULL, NULL, NULL)
        && EVP_CIPHER_CTX_ctrl(x, EVP_CTRL_GCM_SET_IVLEN, (int)iv_len, NULL)
        && EVP_EncryptInit_ex(x, NULL, NULL, c->key, iv)
        && EVP_EncryptUpdate(x, NULL, &ol, add, (int)add_len)
        && EVP_EncryptUpdate(x, out, &ol, in, (int)len)
        && EVP_EncryptFinal_ex(x, out + ol, &ol)
        && EVP_CIPHER_CTX_ctrl(x, EVP_CTRL_GCM_GET_TAG, (int)tag_len, tag);
    EVP_CIPHER_CTX_free(x);
    return ok ? 0 : -1;
}

int mbedtls_gcm_auth_decrypt(mbedtls_gcm_context *c, size_t len, const unsigned char *iv, size_t iv_len,
                             const unsigned char *add, size_t add_len, const unsigned char *tag, size_t tag_len,
                             const unsigned char *in, unsigned char *out)
{
    EVP_CIPHER_CTX *x = EVP_CIPHER_CTX_new();
    int ol = 0, ok = EVP_DecryptInit_ex(x, EVP_aes_256_gcm(), NULL, NULL, NULL)
        && EVP_CIPHER_CTX_ctrl(x, EVP_CTRL_GCM_SET_IVLEN, (int)iv_len, NULL)
        && EVP_DecryptInit_ex(x, NULL, NULL, c->key, iv)
        && EVP_DecryptUpdate(x, NULL, &ol, add, (int)add_len)
        && EVP_DecryptUpdate(x, out, &ol, in, (int)len)
        && EVP_CIPHER_CTX_ctrl(x, EVP_CTRL_GCM_SET_TAG, (int)tag_len, (void *)tag);
    int fin = ok && EVP_DecryptFinal_ex(x, out + ol, &ol) > 0;
    EVP_CIPHER_CTX_free(x);
    return fin ? 0 : MBEDTLS_ERR_GCM_AUTH_FAILED;
}

/* ---- ECDSA P-256 ---- */
void mbedtls_ecdsa_init(mbedtls_ecdsa_context *c) { memset(c, 0, sizeof(*c)); }
void mbedtls_ecdsa_free(mbedtls_ecdsa_context *c) { memset(c, 0, sizeof(*c)); }
int mbedtls_ecp_group_load(mbedtls_ecp_group *g, int id) { g->id = id; return id == MBEDTLS_ECP_DP_SECP256R1 ? 0 : -1; }
int mbedtls_mpi_read_binary(mbedtls_mpi *x, const unsigned char *b, size_t n) { if (n != 32) return -1; memcpy(x->b, b, 32); return 0; }
int mbedtls_mpi_write_binary(const mbedtls_mpi *x, unsigned char *b, size_t n) { if (n != 32) return -1; memcpy(b, x->b, 32); return 0; }
int mbedtls_ecp_point_write_binary(const mbedtls_ecp_group *g, const mbedtls_ecp_point *p, int fmt,
                                   size_t *olen, unsigned char *b, size_t n)
{
    (void)g; (void)fmt;
    if (n < 65) return -1;
    memcpy(b, p->b, 65);
    *olen = 65;
    return 0;
}

int mbedtls_ecdsa_genkey(mbedtls_ecdsa_context *c, int gid, int (*f_rng)(void *, unsigned char *, size_t), void *p_rng)
{
    (void)f_rng; (void)p_rng;
    if (gid != MBEDTLS_ECP_DP_SECP256R1) return -1;
    EC_KEY *k = EC_KEY_new_by_curve_name(NID_X9_62_prime256v1);
    int ok = k && EC_KEY_generate_key(k)
        && BN_bn2binpad(EC_KEY_get0_private_key(k), c->d.b, 32) == 32
        && EC_POINT_point2oct(EC_KEY_get0_group(k), EC_KEY_get0_public_key(k),
                              POINT_CONVERSION_UNCOMPRESSED, c->Q.b, 65, NULL) == 65;
    EC_KEY_free(k);
    c->grp.id = gid;
    return ok ? 0 : -1;
}

int mbedtls_ecdsa_write_signature(mbedtls_ecdsa_context *c, int md, const unsigned char *hash, size_t hlen,
                                  unsigned char *sig, size_t sig_size, size_t *slen,
                                  int (*f_rng)(void *, unsigned char *, size_t), void *p_rng)
{
    (void)md; (void)f_rng; (void)p_rng;
    EC_KEY *k = EC_KEY_new_by_curve_name(NID_X9_62_prime256v1);
    BIGNUM *d = BN_bin2bn(c->d.b, 32, NULL);
    EC_POINT *q = EC_POINT_new(EC_KEY_get0_group(k));
    int ok = EC_POINT_mul(EC_KEY_get0_group(k), q, d, NULL, NULL, NULL)
        && EC_KEY_set_private_key(k, d) && EC_KEY_set_public_key(k, q);
    ECDSA_SIG *s = ok ? ECDSA_do_sign(hash, (int)hlen, k) : NULL;  /* signe le condensat tel quel */
    int n = s ? i2d_ECDSA_SIG(s, NULL) : -1;
    if (s && n > 0 && (size_t)n <= sig_size) {
        unsigned char *pp = sig;
        i2d_ECDSA_SIG(s, &pp);
        *slen = (size_t)n;
    } else {
        ok = 0;
    }
    ECDSA_SIG_free(s); EC_POINT_free(q); BN_free(d); EC_KEY_free(k);
    return ok ? 0 : -1;
}
