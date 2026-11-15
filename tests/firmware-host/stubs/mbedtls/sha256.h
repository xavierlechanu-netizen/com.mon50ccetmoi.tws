/* Couche mbedTLS → OpenSSL pour le banc de test hôte (mêmes signatures que mbedTLS 3.x) */
#pragma once
#include <stddef.h>
#include <openssl/sha.h>
typedef struct { SHA256_CTX c; } mbedtls_sha256_context;
static inline void mbedtls_sha256_init(mbedtls_sha256_context *x) { (void)x; }
static inline int mbedtls_sha256_starts(mbedtls_sha256_context *x, int is224) { (void)is224; return SHA256_Init(&x->c) == 1 ? 0 : -1; }
static inline int mbedtls_sha256_update(mbedtls_sha256_context *x, const unsigned char *in, size_t n) { return SHA256_Update(&x->c, in, n) == 1 ? 0 : -1; }
static inline int mbedtls_sha256_finish(mbedtls_sha256_context *x, unsigned char out[32]) { return SHA256_Final(out, &x->c) == 1 ? 0 : -1; }
static inline void mbedtls_sha256_free(mbedtls_sha256_context *x) { (void)x; }
static inline int mbedtls_sha256(const unsigned char *in, size_t n, unsigned char out[32], int is224) { (void)is224; SHA256(in, n, out); return 0; }
