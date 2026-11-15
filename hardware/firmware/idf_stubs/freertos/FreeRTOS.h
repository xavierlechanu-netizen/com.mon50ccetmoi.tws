#ifndef _FREERTOS_H_STUB
#define _FREERTOS_H_STUB

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef uint32_t TickType_t;
typedef int BaseType_t;
typedef unsigned int UBaseType_t;
typedef void *TaskHandle_t;

#define pdTRUE  1
#define pdFALSE 0
#define pdPASS  1
#define pdFAIL  0

#define pdMS_TO_TICKS(xTimeInMs) ((TickType_t)(xTimeInMs))
#define portMAX_DELAY ((TickType_t)0xffffffffUL)

#ifdef __cplusplus
}
#endif

#endif

