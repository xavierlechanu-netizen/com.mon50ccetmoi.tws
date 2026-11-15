/* Banc de test hôte : sous-ensemble d'ESP-IDF nécessaire à blackbox_storage.c */
#pragma once
#include <stdint.h>
typedef int esp_err_t;
#define ESP_OK                 0
#define ESP_FAIL              -1
#define ESP_ERR_NO_MEM         0x101
#define ESP_ERR_INVALID_ARG    0x102
#define ESP_ERR_INVALID_STATE  0x103
#define ESP_ERR_NOT_FOUND      0x105
#define ESP_ERR_INVALID_CRC    0x109
#define ESP_ERR_NVS_NOT_FOUND  0x1102
static inline const char *esp_err_to_name(esp_err_t e) { (void)e; return "esp_err"; }
