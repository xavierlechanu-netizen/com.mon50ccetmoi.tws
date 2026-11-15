#pragma once
#include <stddef.h>
#define MBEDTLS_PRIVATE(m) m
#define MBEDTLS_ECP_DP_SECP256R1 3
#define MBEDTLS_ECP_PF_UNCOMPRESSED 0
typedef struct { int id; } mbedtls_ecp_group;
typedef struct { unsigned char b[32]; } mbedtls_mpi;
typedef struct { unsigned char b[65]; } mbedtls_ecp_point;
int mbedtls_ecp_group_load(mbedtls_ecp_group *g, int id);
int mbedtls_mpi_read_binary(mbedtls_mpi *x, const unsigned char *buf, size_t len);
int mbedtls_mpi_write_binary(const mbedtls_mpi *x, unsigned char *buf, size_t len);
int mbedtls_ecp_point_write_binary(const mbedtls_ecp_group *g, const mbedtls_ecp_point *p, int fmt,
                                   size_t *olen, unsigned char *buf, size_t len);
