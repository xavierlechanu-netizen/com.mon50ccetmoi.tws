#ifndef _BLE_UUID_H_STUB
#define _BLE_UUID_H_STUB

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint8_t type;
} ble_uuid_t;

typedef struct {
    ble_uuid_t u;
    uint16_t value;
} ble_uuid16_t;

typedef struct {
    ble_uuid_t u;
    uint8_t value[16];
} ble_uuid128_t;

#define BLE_UUID_TYPE_16  16
#define BLE_UUID_TYPE_128 128

#define BLE_UUID16_INIT(uuid16) { .u = { .type = BLE_UUID_TYPE_16 }, .value = (uuid16) }
#define BLE_UUID16_DECLARE(uuid16) ((const ble_uuid_t *)(&(ble_uuid16_t)BLE_UUID16_INIT(uuid16)))
#define BLE_UUID128_INIT(...) { .u = { .type = BLE_UUID_TYPE_128 }, .value = { __VA_ARGS__ } }
#define BLE_UUID128_DECLARE(...) ((const ble_uuid_t *) (&(ble_uuid128_t) BLE_UUID128_INIT(__VA_ARGS__)))

uint16_t ble_uuid_u16(const ble_uuid_t *uuid);

#ifdef __cplusplus
}
#endif

#endif

