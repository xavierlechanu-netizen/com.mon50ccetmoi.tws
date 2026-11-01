#ifndef _STDDEF_H_STUB
#define _STDDEF_H_STUB

#ifndef __SIZE_TYPE__
typedef unsigned long size_t;
#else
typedef __SIZE_TYPE__ size_t;
#endif

typedef long ptrdiff_t;

#ifndef NULL
#ifdef __cplusplus
#define NULL 0
#else
#define NULL ((void *)0)
#endif
#endif

#define offsetof(type, member) __builtin_offsetof(type, member)

#endif

