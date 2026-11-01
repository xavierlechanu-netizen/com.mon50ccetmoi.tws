#ifndef _ESP_RANDOM_H_STUB
#define _ESP_RANDOM_H_STUB

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

uint32_t esp_random(void);
void esp_fill_random(void *buf, size_t len);

#ifdef __cplusplus
}
#endif

#endif

