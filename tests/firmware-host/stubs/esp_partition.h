#pragma once
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"
typedef struct { uint32_t size; } esp_partition_t;
#define ESP_PARTITION_TYPE_DATA    1
#define ESP_PARTITION_SUBTYPE_ANY  0xff
const esp_partition_t *esp_partition_find_first(int type, int subtype, const char *label);
esp_err_t esp_partition_read(const esp_partition_t *p, size_t off, void *dst, size_t len);
esp_err_t esp_partition_write(const esp_partition_t *p, size_t off, const void *src, size_t len);
esp_err_t esp_partition_erase_range(const esp_partition_t *p, size_t off, size_t len);
