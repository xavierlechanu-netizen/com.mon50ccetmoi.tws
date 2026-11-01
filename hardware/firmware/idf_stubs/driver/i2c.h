#ifndef _DRIVER_I2C_H_STUB
#define _DRIVER_I2C_H_STUB

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include "../esp_err.h"
#include "../freertos/FreeRTOS.h"
#include "gpio.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef int i2c_port_t;
typedef void *i2c_cmd_handle_t;

#define I2C_NUM_0 0

typedef enum {
    I2C_MODE_SLAVE = 0,
    I2C_MODE_MASTER = 1,
} i2c_mode_t;

typedef enum {
    I2C_MASTER_WRITE = 0,
    I2C_MASTER_READ = 1,
} i2c_rw_t;

typedef enum {
    I2C_MASTER_ACK = 0x0,
    I2C_MASTER_NACK = 0x1,
    I2C_MASTER_LAST_NACK = 0x2,
} i2c_ack_type_t;

typedef struct {
    i2c_mode_t mode;
    int sda_io_num;
    int scl_io_num;
    bool sda_pullup_en;
    bool scl_pullup_en;
    struct {
        uint32_t clk_speed;
    } master;
    uint32_t clk_flags;
} i2c_config_t;

esp_err_t i2c_param_config(i2c_port_t i2c_num, const i2c_config_t *i2c_conf);
esp_err_t i2c_driver_install(i2c_port_t i2c_num, i2c_mode_t mode, size_t slv_rx_buf_len, size_t slv_tx_buf_len, int intr_alloc_flags);
i2c_cmd_handle_t i2c_cmd_link_create(void);
void i2c_cmd_link_delete(i2c_cmd_handle_t cmd_handle);
esp_err_t i2c_master_start(i2c_cmd_handle_t cmd_handle);
esp_err_t i2c_master_stop(i2c_cmd_handle_t cmd_handle);
esp_err_t i2c_master_write_byte(i2c_cmd_handle_t cmd_handle, uint8_t data, bool ack_en);
esp_err_t i2c_master_read(i2c_cmd_handle_t cmd_handle, uint8_t *data, size_t data_len, i2c_ack_type_t ack);
esp_err_t i2c_master_read_byte(i2c_cmd_handle_t cmd_handle, uint8_t *data, i2c_ack_type_t ack);
esp_err_t i2c_master_cmd_begin(i2c_port_t i2c_num, i2c_cmd_handle_t cmd_handle, TickType_t ticks_to_wait);

#ifdef __cplusplus
}
#endif

#endif

