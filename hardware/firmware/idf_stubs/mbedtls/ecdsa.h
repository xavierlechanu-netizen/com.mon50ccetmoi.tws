#ifndef _MBEDTLS_ECDSA_H_STUB
#define _MBEDTLS_ECDSA_H_STUB

#include <stdint.h>
#include <stddef.h>
#include "ecp.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef mbedtls_ecp_keypair mbedtls_ecdsa_context;

typedef enum {
    MBEDTLS_MD_NONE = 0,
    MBEDTLS_MD_SHA256 = 6,
} mbedtls_md_type_t;

#define MBEDTLS_ECDSA_MAX_LEN 72

void mbedtls_ecdsa_init(mbedtls_ecdsa_context *ctx);
void mbedtls_ecdsa_free(mbedtls_ecdsa_context *ctx);
int mbedtls_ecdsa_genkey(mbedtls_ecdsa_context *ctx, mbedtls_ecp_group_id gid, int (*f_rng)(void *, unsigned char *, size_t), void *p_rng);
int mbedtls_ecdsa_write_signature(
    mbedtls_ecdsa_context *ctx,
    mbedtls_md_type_t md_alg,
    const unsigned char *hash, size_t hlen,
    unsigned char *sig, size_t sig_size, size_t *slen,
    int (*f_rng)(void *, unsigned char *, size_t),
    void *p_rng
);

#ifdef __cplusplus
}
#endif

#endif

