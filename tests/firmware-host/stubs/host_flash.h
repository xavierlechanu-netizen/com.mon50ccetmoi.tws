#pragma once
#include <stdint.h>
#define HOST_FLASH_SIZE 0xC0000   /* partition blackbox_data : 768 Ko (partitions.csv) */
extern uint8_t  g_flash[HOST_FLASH_SIZE];
extern uint32_t g_erase_count[HOST_FLASH_SIZE / 4096];
extern int      g_flash_violations;
