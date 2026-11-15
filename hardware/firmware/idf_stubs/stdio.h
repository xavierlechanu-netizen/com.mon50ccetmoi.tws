#ifndef _STDIO_H_STUB
#define _STDIO_H_STUB

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

int printf(const char *format, ...);
int sprintf(char *str, const char *format, ...);
int snprintf(char *str, size_t size, const char *format, ...);
int puts(const char *s);

#ifdef __cplusplus
}
#endif

typedef struct __stub_FILE FILE;
extern FILE *stdout;
int fflush(FILE *stream);

#endif

