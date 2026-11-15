#pragma once
#include <stddef.h>
#define MBEDTLS_GCM_ENCRYPT 1
#define MBEDTLS_CIPHER_ID_AES 2
#define MBEDTLS_ERR_GCM_AUTH_FAILED -0x0012
typedef struct { unsigned char key[32]; } mbedtls_gcm_context;
void mbedtls_gcm_init(mbedtls_gcm_context *c);
int  mbedtls_gcm_setkey(mbedtls_gcm_context *c, int cipher, const unsigned char *key, unsigned int bits);
int  mbedtls_gcm_crypt_and_tag(mbedtls_gcm_context *c, int mode, size_t len, const unsigned char *iv, size_t iv_len,
                               const unsigned char *add, size_t add_len, const unsigned char *in, unsigned char *out,
                               size_t tag_len, unsigned char *tag);
int  mbedtls_gcm_auth_decrypt(mbedtls_gcm_context *c, size_t len, const unsigned char *iv, size_t iv_len,
                              const unsigned char *add, size_t add_len, const unsigned char *tag, size_t tag_len,
                              const unsigned char *in, unsigned char *out);
void mbedtls_gcm_free(mbedtls_gcm_context *c);
