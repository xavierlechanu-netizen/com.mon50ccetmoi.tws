#pragma once
#include <stddef.h>
#include "esp_err.h"
typedef int nvs_handle_t;
#define NVS_READWRITE 1
esp_err_t nvs_open(const char *ns, int mode, nvs_handle_t *h);
esp_err_t nvs_get_blob(nvs_handle_t h, const char *key, void *out, size_t *len);
esp_err_t nvs_set_blob(nvs_handle_t h, const char *key, const void *v, size_t len);
esp_err_t nvs_commit(nvs_handle_t h);
void nvs_close(nvs_handle_t h);
esp_err_t nvs_erase_key(nvs_handle_t h, const char *key);
#include <stdint.h>
esp_err_t nvs_get_u32(nvs_handle_t h, const char *key, uint32_t *out);
esp_err_t nvs_set_u32(nvs_handle_t h, const char *key, uint32_t v);
esp_err_t nvs_get_str(nvs_handle_t h, const char *key, char *out, size_t *len);
esp_err_t nvs_set_str(nvs_handle_t h, const char *key, const char *v);
