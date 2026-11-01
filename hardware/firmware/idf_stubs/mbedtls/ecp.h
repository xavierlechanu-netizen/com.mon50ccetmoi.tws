#ifndef _MBEDTLS_ECP_H_STUB
#define _MBEDTLS_ECP_H_STUB

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    MBEDTLS_ECP_DP_NONE = 0,
    MBEDTLS_ECP_DP_SECP256R1,
} mbedtls_ecp_group_id;

#define MBEDTLS_ECP_POINT_CONVERSION_UNCOMPRESSED 0
#define MBEDTLS_ECP_PF_UNCOMPRESSED 0

#ifndef MBEDTLS_PRIVATE
#define MBEDTLS_PRIVATE(member) member
#endif

typedef struct {
    uint32_t dummy;
} mbedtls_mpi;

typedef struct {
    uint32_t dummy;
} mbedtls_ecp_point;

typedef struct {
    uint32_t dummy;
} mbedtls_ecp_group;

typedef struct {
    mbedtls_ecp_group grp;
    mbedtls_mpi d;
    mbedtls_ecp_point Q;
} mbedtls_ecp_keypair;

int mbedtls_ecp_group_load(mbedtls_ecp_group *grp, mbedtls_ecp_group_id id);
int mbedtls_ecp_mul(mbedtls_ecp_group *grp, mbedtls_ecp_point *R, const mbedtls_mpi *m, const mbedtls_ecp_point *P, int (*f_rng)(void *, unsigned char *, size_t), void *p_rng);
int mbedtls_ecp_point_write_binary(const mbedtls_ecp_group *grp, const mbedtls_ecp_point *P, int format, size_t *olen, unsigned char *buf, size_t buflen);
int mbedtls_ecp_point_read_binary(const mbedtls_ecp_group *grp, mbedtls_ecp_point *P, const unsigned char *buf, size_t ilen);
int mbedtls_mpi_read_binary(mbedtls_mpi *X, const unsigned char *buf, size_t buflen);
int mbedtls_mpi_write_binary(const mbedtls_mpi *X, unsigned char *buf, size_t buflen);

#ifdef __cplusplus
}
#endif

#endif
