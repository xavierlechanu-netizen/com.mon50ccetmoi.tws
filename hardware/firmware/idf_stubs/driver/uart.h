#ifndef _DRIVER_UART_H_STUB
#define _DRIVER_UART_H_STUB

#include <stdint.h>
#include <stddef.h>
#include "../esp_err.h"
#include "../freertos/FreeRTOS.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef int uart_port_t;
#define UART_NUM_0 0
#define UART_NUM_1 1
#define UART_PIN_NO_CHANGE (-1)

typedef enum {
    UART_DATA_8_BITS = 3,
} uart_word_length_t;

typedef enum {
    UART_PARITY_DISABLE = 0x0,
} uart_parity_t;

typedef enum {
    UART_STOP_BITS_1 = 0x1,
} uart_stop_bits_t;

typedef enum {
    UART_HW_FLOWCTRL_DISABLE = 0x0,
} uart_hw_flowcontrol_t;

typedef enum {
    UART_SCLK_DEFAULT = 0,
} uart_sclk_t;

typedef struct {
    int baud_rate;
    uart_word_length_t data_bits;
    uart_parity_t parity;
    uart_stop_bits_t stop_bits;
    uart_hw_flowcontrol_t flow_ctrl;
    uint8_t rx_flow_ctrl_thresh;
    uart_sclk_t source_clk;
} uart_config_t;

esp_err_t uart_param_config(uart_port_t uart_num, const uart_config_t *uart_config);
esp_err_t uart_set_pin(uart_port_t uart_num, int tx_io_num, int rx_io_num, int rts_io_num, int cts_io_num);
esp_err_t uart_driver_install(uart_port_t uart_num, int rx_buffer_size, int tx_buffer_size, int queue_size, void *uart_queue, int intr_alloc_flags);
esp_err_t uart_set_baudrate(uart_port_t uart_num, uint32_t baud_rate);
int uart_read_bytes(uart_port_t uart_num, void *buf, uint32_t length, TickType_t ticks_to_wait);
int uart_write_bytes(uart_port_t uart_num, const void *src, size_t size);
esp_err_t uart_wait_tx_done(uart_port_t uart_num, TickType_t ticks_to_wait);

#ifdef __cplusplus
}
#endif

#endif

