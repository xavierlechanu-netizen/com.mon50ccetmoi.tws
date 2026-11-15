#ifndef _FREERTOS_TASK_H_STUB
#define _FREERTOS_TASK_H_STUB

#include "FreeRTOS.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*TaskFunction_t)(void *);

void vTaskDelay(const TickType_t xTicksToDelay);
BaseType_t xTaskCreate(
    TaskFunction_t pxTaskCode,
    const char * const pcName,
    const uint32_t usStackDepth,
    void * const pvParameters,
    UBaseType_t uxPriority,
    TaskHandle_t * const pxCreatedTask
);

#ifdef __cplusplus
}
#endif


/* Notifications de tâche (FreeRTOS) */
static inline BaseType_t xTaskNotifyGive(TaskHandle_t xTaskToNotify) { (void)xTaskToNotify; return pdTRUE; }
static inline uint32_t ulTaskNotifyTake(BaseType_t xClearCountOnExit, TickType_t xTicksToWait) { (void)xClearCountOnExit; (void)xTicksToWait; return 1; }
#endif

