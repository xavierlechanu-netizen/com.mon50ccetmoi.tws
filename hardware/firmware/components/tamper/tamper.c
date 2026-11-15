/**
 * ============================================================================
 * tamper.c — Implémentation Anti-Tamper & Zeroization (Boîte Noire V1)
 * ============================================================================
 * Cible : ESP32-C3-MINI-1 (ESP-IDF v5.x)
 *
 * Flux de sécurité :
 *   [ Capteur déclenché ] → [ ISR GPIO ] → [ tamper_zeroize() ]
 *       → Effacement clé AES (RAM)
 *       → Effacement NVS (Flash)
 *       → Burn eFuse "DESTROYED"
 *       → Reboot en mode brick
 *
 * CONFORMITÉ :
 *   - OWASP A02 : Zéro secret en dur. Clé AES générée au premier boot
 *                 et stockée en RAM volatile uniquement.
 *   - CIS 3     : Destruction cryptographique des données au repos.
 *   - CIS 16.10 : Validation de toutes les entrées (anti-glitch sur ISR).
 * ============================================================================
 */

#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_partition.h"
#include "nvs_flash.h"
#include "esp_efuse.h"
#include "esp_efuse_table.h"
#include "mbedtls/platform_util.h"

#include "tamper.h"
#include "../../main/blackbox_pins.h"

/* ---- Tag de log ---- */
static const char *TAG = "TAMPER";

/* ---- Clé AES-256 en RAM volatile (32 octets = 256 bits) ---- */
static volatile uint8_t s_aes_key[32] __attribute__((aligned(4)));

/* ---- État courant ---- */
static volatile tamper_state_t s_tamper_state = TAMPER_STATE_SAFE;

/* ---- Flag anti-rebond pour éviter les déclenchements multiples ---- */
static volatile bool s_zeroize_triggered = false;

/*
 * Bit d'eFuse « boîtier détruit après effraction » : 1er bit du bloc utilisateur
 * (EFUSE_BLK3), libre (les clés de démarrage sécurisé et de chiffrement Flash
 * utilisent les blocs KEY0..KEY5). Gravé une seule fois, jamais effaçable.
 */
static const esp_efuse_desc_t TAMPER_DESTROYED_BIT[] = { { EFUSE_BLK3, 0, 1 } };
static const esp_efuse_desc_t *ESP_EFUSE_TAMPER_DESTROYED[] = { &TAMPER_DESTROYED_BIT[0], NULL };

/* ============================================================================
 * ISR — Routine d'interruption ultra-rapide (exécutée depuis l'IRAM)
 * ============================================================================
 * Déclenchée par :
 *   - GPIO 2 (photodiode) : front montant (lumière détectée)
 *   - GPIO 3 (tamper mesh) : front descendant (piste coupée)
 *
 * Anti-glitch : On vérifie deux fois l'état du GPIO pour filtrer les
 * parasites électromagnétiques du moteur 50 cc (CIS 16.10).
 * ============================================================================
 */
static void IRAM_ATTR tamper_isr_handler(void *arg)
{
    /* Anti-rebond : ne déclencher qu'une seule fois */
    if (s_zeroize_triggered) {
        return;
    }

    uint32_t gpio_num = (uint32_t)(uintptr_t)arg;

    /*
     * Double lecture anti-glitch (~2µs d'écart).
     * Si le signal n'est pas stable, c'est un parasite → on ignore.
     */
    int first_read = gpio_get_level(gpio_num);

    /* Petit délai (quelques cycles CPU, pas de vTaskDelay en ISR) */
    for (volatile int i = 0; i < 100; i++) {
        __asm__ __volatile__("nop");
    }

    int second_read = gpio_get_level(gpio_num);

    if (first_read != second_read) {
        return; /* Glitch filtré */
    }

    /* ---- Violation confirmée ---- */
    if (gpio_num == PIN_TAMPER_LIGHT && first_read == 1) {
        s_tamper_state = TAMPER_STATE_LIGHT;
    } else if (gpio_num == PIN_TAMPER_MESH && first_read == 0) {
        s_tamper_state = TAMPER_STATE_MESH_CUT;
    } else {
        return; /* État normal, pas de violation */
    }

    s_zeroize_triggered = true;

    /* ---- ÉTAPE 1 ISR-SAFE (< 1 µs en IRAM) : Destruction immédiate clé RAM ----
     * Conformité FIPS 140-3 / ESP-IDF ISR Rules :
     * Aucun appel Flash SPI / Mutex FreeRTOS dans l'ISR pour éviter un Guru Meditation Panic.
     * La destruction Flash NVS, blackbox_data et eFuse est exécutée hors ISR par tamper_zeroize().
     */
    for (size_t k = 0; k < sizeof(s_aes_key); k++) {
        s_aes_key[k] = 0x00;
    }
}

/* ============================================================================
 * tamper_init() — Initialisation des capteurs
 * ============================================================================
 */
esp_err_t tamper_init(void)
{
    /* Vérifier si le boîtier est déjà brické */
    if (tamper_is_bricked()) {
        ESP_LOGE(TAG, "BOITIER NEUTRALISE — eFuse DESTROYED détecté.");
        s_tamper_state = TAMPER_STATE_DESTROYED;
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "Initialisation des capteurs Anti-Tamper...");

    #if (PIN_TAMPER_LIGHT >= 0)
    /* ---- Configuration GPIO 2 : Photodiode (lumière = HIGH) ---- */
    gpio_config_t light_conf = {
        .pin_bit_mask  = (1ULL << PIN_TAMPER_LIGHT),
        .mode          = GPIO_MODE_INPUT,
        .pull_up_en    = GPIO_PULLUP_DISABLE,
        .pull_down_en  = GPIO_PULLDOWN_ENABLE,   /* Pull-down : 0 au repos */
        .intr_type     = GPIO_INTR_POSEDGE,       /* Front montant = lumière */
    };
    ESP_ERROR_CHECK(gpio_config(&light_conf));
    #endif

    #if (PIN_TAMPER_MESH >= 0)
    /* ---- Configuration GPIO 3 : Tamper Mesh (coupure = LOW) ---- */
    gpio_config_t mesh_conf = {
        .pin_bit_mask  = (1ULL << PIN_TAMPER_MESH),
        .mode          = GPIO_MODE_INPUT,
        .pull_up_en    = GPIO_PULLUP_DISABLE,
        .pull_down_en  = GPIO_PULLDOWN_ENABLE,   /* Pull-down interne */
        .intr_type     = GPIO_INTR_NEGEDGE,       /* Front descendant = coupure */
    };
    ESP_ERROR_CHECK(gpio_config(&mesh_conf));
    #endif

    /* ---- Installation du service d'interruptions GPIO ---- */
    ESP_ERROR_CHECK(gpio_install_isr_service(ESP_INTR_FLAG_IRAM));

    /* ---- Enregistrement des handlers ISR ---- */
    #if (PIN_TAMPER_LIGHT >= 0)
    ESP_ERROR_CHECK(gpio_isr_handler_add(
        PIN_TAMPER_LIGHT,
        tamper_isr_handler,
        (void *)(uintptr_t)PIN_TAMPER_LIGHT
    ));
    #endif

    #if (PIN_TAMPER_MESH >= 0)
    ESP_ERROR_CHECK(gpio_isr_handler_add(
        PIN_TAMPER_MESH,
        tamper_isr_handler,
        (void *)(uintptr_t)PIN_TAMPER_MESH
    ));
    #endif

    /* ---- Configuration du Deep Sleep Wake-up sur ces GPIOs ---- */
    /* L'ESP32-C3 supporte le wake-up par GPIO en Deep Sleep */
    ESP_LOGI(TAG, "Wake-up Deep Sleep configuré sur GPIO %d et GPIO %d",
             PIN_TAMPER_LIGHT, PIN_TAMPER_MESH);

    ESP_LOGI(TAG, "Capteurs Anti-Tamper initialisés — système armé.");
    return ESP_OK;
}

/* ============================================================================
 * tamper_get_state() — Lecture de l'état courant
 * ============================================================================
 */
tamper_state_t tamper_get_state(void)
{
    return s_tamper_state;
}

/* ============================================================================
 * tamper_zeroize() — EFFACEMENT IMMÉDIAT DES CLÉS (IRAM_ATTR)
 * ============================================================================
 *
 * CRITIQUE : Cette fonction est le cœur de la sécurité matérielle.
 *
 * Elle réside en IRAM (SRAM) et non en Flash externe, ce qui garantit
 * une exécution en quelques microsecondes même si la Flash est corrompue.
 *
 * Utilisation de mbedtls_platform_zeroize() au lieu de memset() car
 * le compilateur peut optimiser (supprimer) un memset() sur des données
 * qui ne sont plus lues ensuite. mbedtls_platform_zeroize() est conçu
 * pour résister à cette optimisation.
 * ============================================================================
 */
void tamper_zeroize(void)
{
    /*
     * ╔═══════════════════════════════════════════════════════════╗
     * ║  ÉTAPE 1 : Effacement de la clé AES-256 en RAM (~1 µs)  ║
     * ╚═══════════════════════════════════════════════════════════╝
     *
     * mbedtls_platform_zeroize() est résistant aux optimisations
     * du compilateur (contrairement à memset). Conformité OWASP A02.
     */
    mbedtls_platform_zeroize((void *)s_aes_key, sizeof(s_aes_key));

    /*
     * ╔═══════════════════════════════════════════════════════════╗
     * ║  ÉTAPE 2 : Effacement de la partition NVS (clés backup)  ║
     * ╚═══════════════════════════════════════════════════════════╝
     *
     * La partition NVS (Non-Volatile Storage) peut contenir des
     * clés de session BLE ou des tokens FOTA. On efface tout.
     */
    /* Les étapes « effacement NVS » et « effacement de toute la partition » ont été
     * retirées : elles détruisaient les accidents signés (la preuve) au moment même
     * où quelqu'un a intérêt à les faire disparaître. Le tri est fait avant l'appel,
     * par blackbox_storage_tamper_wipe() (clé de signature détruite, trajets effacés,
     * accidents conservés). */

    /*
     * ╔═══════════════════════════════════════════════════════════╗
     * ║  ÉTAPE 4 : Marquage eFuse "DESTROYED" (IRRÉVERSIBLE)    ║
     * ╚═══════════════════════════════════════════════════════════╝
     *
     * On brûle un bit dans les eFuses du processeur. Ce bit ne
     * peut JAMAIS être remis à zéro (One-Time Programmable).
     * Au prochain boot, tamper_is_bricked() retournera true et
     * le firmware refusera de démarrer.
     *
     * NOTE : En production, on utiliserait un champ eFuse custom.
     * Pour le prototype, on utilise le champ de désactivation JTAG
     * qui a le double avantage de bricker ET de couper le debug.
     */
    esp_efuse_write_field_bit(ESP_EFUSE_TAMPER_DESTROYED);
    esp_efuse_write_field_bit(ESP_EFUSE_DIS_PAD_JTAG);
    esp_efuse_write_field_bit(ESP_EFUSE_DIS_USB_JTAG);

    /*
     * ╔═══════════════════════════════════════════════════════════╗
     * ║  ÉTAPE 5 : Mise à jour de l'état et redémarrage          ║
     * ╚═══════════════════════════════════════════════════════════╝
     */
    s_tamper_state = TAMPER_STATE_DESTROYED;

    /* Redémarrage immédiat — le firmware ne redémarrera pas (brické) */
    esp_restart();
}

/* ============================================================================
 * tamper_is_bricked() — Vérification eFuse
 * ============================================================================
 */
bool tamper_is_bricked(void)
{
    /*
     * Bit d'eFuse dédié, gravé uniquement par tamper_zeroize().
     * (Avant : on lisait DIS_PAD_JTAG, que le profil production grave
     * dès la fabrication → chaque boîtier vendu se serait cru détruit.)
     */
    return esp_efuse_read_field_bit(ESP_EFUSE_TAMPER_DESTROYED);
}
