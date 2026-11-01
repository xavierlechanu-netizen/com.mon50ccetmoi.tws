#ifndef _MBEDTLS_SHA256_H_STUB
#define _MBEDTLS_SHA256_H_STUB

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint32_t dummy;
} mbedtls_sha256_context;

void mbedtls_sha256_init(mbedtls_sha256_context *ctx);
void mbedtls_sha256_free(mbedtls_sha256_context *ctx);
int mbedtls_sha256_starts(mbedtls_sha256_context *ctx, int is224);
int mbedtls_sha256_update(mbedtls_sha256_context *ctx, const unsigned char *input, size_t ilen);
int mbedtls_sha256_finish(mbedtls_sha256_context *ctx, unsigned char output[32]);
int mbedtls_sha256(const unsigned char *input, size_t ilen, unsigned char output[32], int is224);

#ifdef __cplusplus
}
#endif

#endif

