#ifndef _ESP_EFUSE_H_STUB
#define _ESP_EFUSE_H_STUB

#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

/* API eFuse d'ESP-IDF 5.x */
typedef enum { EFUSE_BLK0 = 0, EFUSE_BLK1, EFUSE_BLK2, EFUSE_BLK3 } esp_efuse_block_t;
typedef struct {
    esp_efuse_block_t efuse_block: 8;
    uint8_t bit_start;
    uint16_t bit_count;
} esp_efuse_desc_t;

esp_err_t esp_efuse_write_field_bit(const esp_efuse_desc_t *field[]);
bool esp_efuse_read_field_bit(const esp_efuse_desc_t *field[]);

#ifdef __cplusplus
}
#endif

#endif

