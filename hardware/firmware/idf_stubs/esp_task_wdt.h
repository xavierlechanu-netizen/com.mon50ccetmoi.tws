#ifndef _ESP_TASK_WDT_H_STUB
#define _ESP_TASK_WDT_H_STUB

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t esp_task_wdt_init(uint32_t timeout, bool panic);
esp_err_t esp_task_wdt_add(void *handle);
esp_err_t esp_task_wdt_reset(void);

#ifdef __cplusplus
}
#endif

#endif

