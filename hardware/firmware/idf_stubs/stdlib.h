#ifndef _STDLIB_H_STUB
#define _STDLIB_H_STUB

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

int atoi(const char *nptr);
long atol(const char *nptr);
double atof(const char *nptr);
long strtol(const char *nptr, char **endptr, int base);
unsigned long strtoul(const char *nptr, char **endptr, int base);
double strtod(const char *nptr, char **endptr);
void *malloc(size_t size);
void *calloc(size_t nmemb, size_t size);
void free(void *ptr);
int abs(int j);

#ifdef __cplusplus
}
#endif

#endif

