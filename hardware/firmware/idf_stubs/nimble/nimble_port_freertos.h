#ifndef _NIMBLE_PORT_FREERTOS_H_STUB
#define _NIMBLE_PORT_FREERTOS_H_STUB

#ifdef __cplusplus
extern "C" {
#endif

void nimble_port_freertos_init(void (*host_task_fn)(void *));
void nimble_port_freertos_deinit(void);

#ifdef __cplusplus
}
#endif

#endif

