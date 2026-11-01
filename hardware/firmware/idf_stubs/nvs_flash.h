#ifndef _NVS_FLASH_H_STUB
#define _NVS_FLASH_H_STUB

#include "esp_err.h"
#include "nvs.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t nvs_flash_init(void);
esp_err_t nvs_flash_erase(void);

#ifdef __cplusplus
}
#endif

#endif

