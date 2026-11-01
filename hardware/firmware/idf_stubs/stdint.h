#ifndef _STDINT_H_STUB
#define _STDINT_H_STUB

typedef signed char        int8_t;
typedef short              int16_t;
typedef int                int32_t;
typedef long long          int64_t;
typedef unsigned char      uint8_t;
typedef unsigned short     uint16_t;
typedef unsigned int       uint32_t;
typedef unsigned long long uint64_t;

typedef signed char        int_least8_t;
typedef short              int_least16_t;
typedef int                int_least32_t;
typedef long long          int_least64_t;
typedef unsigned char      uint_least8_t;
typedef unsigned short     uint_least16_t;
typedef unsigned int       uint_least32_t;
typedef unsigned long long uint_least64_t;

typedef signed char        int_fast8_t;
typedef int                int_fast16_t;
typedef int                int_fast32_t;
typedef long long          int_fast64_t;
typedef unsigned char      uint_fast8_t;
typedef unsigned int       uint_fast16_t;
typedef unsigned int       uint_fast32_t;
typedef unsigned long long uint_fast64_t;

#if defined(_WIN64) || defined(__x86_64__) || defined(__aarch64__)
typedef long long          intptr_t;
typedef unsigned long long uintptr_t;
#else
typedef long               intptr_t;
typedef unsigned long      uintptr_t;
#endif
typedef long long          intmax_t;
typedef unsigned long long uintmax_t;

#define INT8_MIN   (-128)
#define INT16_MIN  (-32768)
#define INT32_MIN  (-2147483647 - 1)
#define INT8_MAX   127
#define INT16_MAX  32767
#define INT32_MAX  2147483647
#define UINT8_MAX  0xffU
#define UINT16_MAX 0xffffU
#define UINT32_MAX 0xffffffffUL
#define SIZE_MAX   0xffffffffUL

#endif

