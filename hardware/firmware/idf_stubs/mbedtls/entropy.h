#ifndef _MBEDTLS_ENTROPY_H_STUB
#define _MBEDTLS_ENTROPY_H_STUB

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int dummy;
} mbedtls_entropy_context;

void mbedtls_entropy_init(mbedtls_entropy_context *ctx);
void mbedtls_entropy_free(mbedtls_entropy_context *ctx);
int mbedtls_entropy_func(void *data, unsigned char *output, size_t len);

#ifdef __cplusplus
}
#endif

#endif

