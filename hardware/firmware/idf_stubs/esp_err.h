#ifndef _ESP_ERR_H_STUB
#define _ESP_ERR_H_STUB

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef int esp_err_t;

#define ESP_OK                  0
#define ESP_FAIL                -1
#define ESP_ERR_NO_MEM          0x101
#define ESP_ERR_INVALID_ARG     0x102
#define ESP_ERR_INVALID_STATE   0x103
#define ESP_ERR_INVALID_SIZE    0x104
#define ESP_ERR_NOT_FOUND       0x105
#define ESP_ERR_NOT_SUPPORTED   0x106
#define ESP_ERR_TIMEOUT         0x107
#define ESP_ERR_INVALID_CRC     0x109

#ifndef IRAM_ATTR
#define IRAM_ATTR
#endif

#define ESP_ERROR_CHECK(x) do { esp_err_t __err_rc = (x); (void)__err_rc; } while(0)

const char *esp_err_to_name(esp_err_t code);

#ifdef __cplusplus
}
#endif

#endif

