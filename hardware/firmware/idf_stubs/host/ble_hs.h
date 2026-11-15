#ifndef _BLE_HS_H_STUB
#define _BLE_HS_H_STUB

#include <stdint.h>
#include <stddef.h>
#include "ble_uuid.h"

#ifdef __cplusplus
extern "C" {
#endif

struct os_mbuf {
    uint8_t *om_data;
    uint16_t om_len;
};

#define OS_MBUF_PKTLEN(om) ((om) ? (om)->om_len : 0)

int os_mbuf_append(struct os_mbuf *om, const void *data, uint16_t len);
int os_mbuf_copydata(const struct os_mbuf *m, int off, int len, void *dst);
struct os_mbuf *ble_hs_mbuf_from_flat(const void *buf, uint16_t len);

#define BLE_GATT_SVC_TYPE_PRIMARY 1

#define BLE_GATT_CHR_F_READ         0x0001
#define BLE_GATT_CHR_F_WRITE_NO_RSP 0x0002
#define BLE_GATT_CHR_F_WRITE        0x0004
#define BLE_GATT_CHR_F_NOTIFY       0x0010
#define BLE_GATT_CHR_F_INDICATE     0x0020
#define BLE_GATT_CHR_F_READ_ENC     0x0100
#define BLE_GATT_CHR_F_WRITE_ENC    0x0400
#define BLE_GATT_CHR_F_WRITE_AUTHEN 0x0800

#define BLE_GATT_ACCESS_OP_READ_CHR  0
#define BLE_GATT_ACCESS_OP_WRITE_CHR 1

#define BLE_ATT_ERR_WRITE_NOT_PERMITTED    0x03
#define BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN 0x0d
#define BLE_ATT_ERR_UNLIKELY               0x0e
#define BLE_ATT_ERR_INSUFFICIENT_RES       0x11

struct ble_gatt_chr_def;
struct ble_gatt_access_ctxt {
    uint8_t op;
    struct os_mbuf *om;
    const struct ble_gatt_chr_def *chr;
};

typedef int ble_gatt_access_fn(uint16_t conn_handle, uint16_t attr_handle, struct ble_gatt_access_ctxt *ctxt, void *arg);

struct ble_gatt_chr_def {
    const ble_uuid_t *uuid;
    ble_gatt_access_fn *access_cb;
    void *arg;
    void *descriptors;
    uint16_t flags;
    uint8_t min_key_size;
    uint16_t *val_handle;
};

struct ble_gatt_svc_def {
    uint8_t type;
    const ble_uuid_t *uuid;
    const struct ble_gatt_svc_def **includes;
    const struct ble_gatt_chr_def *characteristics;
};

int ble_gatts_count_cfg(const struct ble_gatt_svc_def *defs);
int ble_gatts_add_svcs(const struct ble_gatt_svc_def *svcs);
int ble_gatts_notify_custom(uint16_t conn_handle, uint16_t att_val_handle, struct os_mbuf *om);
int ble_gatts_indicate_custom(uint16_t conn_handle, uint16_t att_val_handle, struct os_mbuf *om);

#define BLE_SM_IO_CAP_DISP_ONLY   0
#define BLE_SM_PAIR_KEY_DIST_ENC  0x01
#define BLE_SM_PAIR_KEY_DIST_ID   0x02
#define BLE_SM_IOACT_DISP         3

struct ble_sm_io {
    uint8_t action;
    uint32_t passkey;
};

int ble_sm_inject_io(uint16_t conn_handle, struct ble_sm_io *pkey);

typedef struct {
    void (*reset_cb)(int reason);
    void (*sync_cb)(void);
    uint8_t sm_io_cap;
    unsigned sm_bonding:1;
    unsigned sm_mitm:1;
    unsigned sm_sc:1;
    uint8_t sm_our_key_dist;
    uint8_t sm_their_key_dist;
} ble_hs_cfg_t;

extern ble_hs_cfg_t ble_hs_cfg;

#define BLE_GAP_CONN_MODE_UND 2
#define BLE_GAP_DISC_MODE_GEN 2
#define BLE_GAP_ADV_ITVL_MS(x) ((x) * 1000 / 625)

#define BLE_HS_ADV_F_DISC_GEN      0x02
#define BLE_HS_ADV_F_BREDR_UNSUP   0x04
#define BLE_HS_ADV_TX_PWR_LVL_AUTO (-128)
#define BLE_OWN_ADDR_PUBLIC        0
#define BLE_HS_FOREVER             INT32_MAX

#define BLE_GAP_EVENT_CONNECT        0
#define BLE_GAP_EVENT_DISCONNECT     1
#define BLE_GAP_EVENT_ENC_CHANGE     3
#define BLE_GAP_EVENT_PASSKEY_ACTION 11
#define BLE_GAP_EVENT_REPEAT_PAIRING 17

#define BLE_GAP_REPEAT_PAIRING_RETRY 1
#define BLE_ERR_AUTH_FAIL            0x05

typedef struct {
    uint8_t type;
    uint8_t val[6];
} ble_addr_t;

struct ble_gap_conn_desc {
    ble_addr_t peer_id_addr;
};

struct ble_gap_adv_params {
    uint8_t conn_mode;
    uint8_t disc_mode;
    uint16_t itvl_min;
    uint16_t itvl_max;
};

struct ble_hs_adv_fields {
    uint8_t flags;
    const uint8_t *name;
    uint8_t name_len;
    unsigned name_is_complete:1;
    int8_t tx_pwr_lvl;
    unsigned tx_pwr_lvl_is_present:1;
};

struct ble_gap_event {
    uint8_t type;
    union {
        struct {
            int status;
            uint16_t conn_handle;
        } connect;
        struct {
            int reason;
        } disconnect;
        struct {
            int status;
            uint16_t conn_handle;
        } enc_change;
        struct {
            uint16_t conn_handle;
        } repeat_pairing;
        struct {
            uint16_t conn_handle;
            struct {
                uint8_t action;
            } params;
        } passkey;
    };
};

typedef int ble_gap_event_fn(struct ble_gap_event *event, void *arg);

int ble_gap_adv_set_fields(const struct ble_hs_adv_fields *adv_fields);
int ble_gap_adv_start(uint8_t own_addr_type, const ble_addr_t *direct_addr, int32_t duration_ms, const struct ble_gap_adv_params *adv_params, ble_gap_event_fn *cb, void *cb_arg);
int ble_gap_adv_stop(void);
int ble_gap_security_initiate(uint16_t conn_handle);
int ble_gap_terminate(uint16_t conn_handle, uint8_t hci_reason);
int ble_gap_conn_find(uint16_t handle, struct ble_gap_conn_desc *out_desc);
int ble_store_util_delete_peer(const ble_addr_t *peer_id_addr);
int ble_hs_id_infer_auto(int privacy, uint8_t *out_addr_type);

#ifdef __cplusplus
}
#endif

#endif

