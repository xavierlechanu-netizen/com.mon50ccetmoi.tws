/*
 * factory_console.c — Mise en service en fin de chaîne (voir factory_console.h et
 * tools/mise_en_service.py). Ouvert seulement en mode usine : dès que le numéro de série
 * est écrit, le boîtier redémarre et ce port n'est plus jamais ouvert.
 */
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/uart.h"
#include "esp_system.h"
#include "blackbox_storage.h"
#include "factory_console.h"

#define FW_VERSION      "1.1.0"
#define LINE_MAX_LEN    160

static int hexval(char c)
{
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

static void print_hex(const uint8_t *b, size_t n)
{
    for (size_t i = 0; i < n; i++) printf("%02x", b[i]);
}

static void handle_line(const char *line)
{
    if (strcmp(line, "BB50 INFO") == 0) {
        uint8_t pub[65];
        uint32_t pin = 0;
        if (blackbox_storage_get_pubkey(pub) != ESP_OK || blackbox_identity_get_pin(&pin) != ESP_OK) {
            printf("BB50 ERR cles absentes\n");
            return;
        }
        printf("BB50 INFO {\"fw\":\"%s\",\"pub\":\"", FW_VERSION);
        print_hex(pub, sizeof(pub));
        printf("\",\"pin\":\"%06lu\"}\n", (unsigned long)pin);
        return;
    }

    if (strncmp(line, "BB50 POP ", 9) == 0 && strlen(line) == 9 + 64) {
        uint8_t challenge[32], sig[72];
        size_t sig_len = 0;
        for (int i = 0; i < 32; i++) {
            int hi = hexval(line[9 + 2 * i]), lo = hexval(line[10 + 2 * i]);
            if (hi < 0 || lo < 0) { printf("BB50 ERR defi invalide\n"); return; }
            challenge[i] = (uint8_t)((hi << 4) | lo);
        }
        if (blackbox_factory_pop(challenge, sig, &sig_len) != ESP_OK) {
            printf("BB50 ERR signature refusee\n");
            return;
        }
        printf("BB50 POP ");
        print_hex(sig, sig_len);
        printf("\n");
        return;
    }

    if (strncmp(line, "BB50 SERIAL ", 12) == 0) {
        const char *serial = line + 12;
        esp_err_t err = blackbox_identity_set_serial(serial);
        if (err != ESP_OK) {
            printf("BB50 ERR numero refuse (%s)\n", err == ESP_ERR_INVALID_STATE ? "deja ecrit" : "format");
            return;
        }
        printf("BB50 OK %s\n", serial);
        fflush(stdout);
        vTaskDelay(pdMS_TO_TICKS(300));
        esp_restart();   /* redémarre sous son numéro (nom Bluetooth), port d'usine fermé */
    }

    printf("BB50 ERR commande inconnue\n");
}

static void factory_console_task(void *arg)
{
    (void)arg;
    char line[LINE_MAX_LEN];
    size_t n = 0;
    printf("BB50 FACTORY READY\n");
    for (;;) {
        uint8_t c;
        if (uart_read_bytes(UART_NUM_0, &c, 1, portMAX_DELAY) <= 0) continue;
        if (c == '\n' || c == '\r') {
            line[n] = '\0';
            if (n > 0) handle_line(line);
            n = 0;
        } else if (n < sizeof(line) - 1) {
            line[n++] = (char)c;
        } else {
            n = 0;   /* ligne trop longue : ignorée */
        }
        fflush(stdout);
    }
}

void factory_console_start(void)
{
    char serial[BLACKBOX_SERIAL_MAX];
    if (blackbox_identity_get_serial(serial, sizeof(serial)) == ESP_OK) {
        return;   /* boîtier déjà numéroté : jamais de port d'usine */
    }
    uart_driver_install(UART_NUM_0, 256, 0, 0, NULL, 0);
    xTaskCreate(factory_console_task, "factory", 4096, NULL, 3, NULL);
}
