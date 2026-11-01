#ifndef _ESP_SLEEP_H_REAL_STUB
#define _ESP_SLEEP_H_REAL_STUB

#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    ESP_GPIO_WAKEUP_GPIO_LOW = 0,
    ESP_GPIO_WAKEUP_GPIO_HIGH = 1,
} esp_deepsleep_gpio_wake_up_mode_t;

esp_err_t esp_deep_sleep_enable_gpio_wakeup(uint64_t gpio_pin_mask, esp_deepsleep_gpio_wake_up_mode_t mode);
esp_err_t esp_sleep_enable_timer_wakeup(uint64_t time_in_us);
void esp_deep_sleep_start(void);

#ifdef __cplusplus
}
#endif

#endif

