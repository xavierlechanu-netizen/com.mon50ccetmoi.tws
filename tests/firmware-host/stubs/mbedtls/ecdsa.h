#pragma once
#include "ecp.h"
#define MBEDTLS_ECDSA_MAX_LEN 72
#define MBEDTLS_MD_SHA256 6
typedef struct { mbedtls_ecp_group grp; mbedtls_mpi d; mbedtls_ecp_point Q; } mbedtls_ecdsa_context;
void mbedtls_ecdsa_init(mbedtls_ecdsa_context *c);
void mbedtls_ecdsa_free(mbedtls_ecdsa_context *c);
int  mbedtls_ecdsa_genkey(mbedtls_ecdsa_context *c, int gid, int (*f_rng)(void *, unsigned char *, size_t), void *p_rng);
int  mbedtls_ecdsa_write_signature(mbedtls_ecdsa_context *c, int md, const unsigned char *hash, size_t hlen,
                                   unsigned char *sig, size_t sig_size, size_t *slen,
                                   int (*f_rng)(void *, unsigned char *, size_t), void *p_rng);
