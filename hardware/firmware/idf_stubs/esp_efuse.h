#ifndef _ESP_EFUSE_H_STUB
#define _ESP_EFUSE_H_STUB

#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef const void *esp_efuse_desc_t;

esp_err_t esp_efuse_write_field_bit(const esp_efuse_desc_t *field);
esp_err_t esp_efuse_read_field_bit(const esp_efuse_desc_t *field, bool *out_bit);

#ifdef __cplusplus
}
#endif

#endif

