#pragma once
#include <stddef.h>
#include <string.h>
static inline void mbedtls_platform_zeroize(void *b, size_t n) { volatile unsigned char *p = b; while (n--) *p++ = 0; }
