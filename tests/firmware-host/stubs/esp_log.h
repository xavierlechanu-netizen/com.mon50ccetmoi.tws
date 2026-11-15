#pragma once
#include <stdio.h>
#define ESP_LOG_(lvl, tag, fmt, ...) fprintf(stderr, lvl " (%s) " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGE(tag, fmt, ...) ESP_LOG_("E", tag, fmt, ##__VA_ARGS__)
#define ESP_LOGW(tag, fmt, ...) ESP_LOG_("W", tag, fmt, ##__VA_ARGS__)
#define ESP_LOGI(tag, fmt, ...) ((void)0)
#define ESP_LOGD(tag, fmt, ...) ((void)0)
