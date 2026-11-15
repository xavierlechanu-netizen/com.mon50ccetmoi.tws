/**
 * ============================================================================
 * blackbox_pins.h — Assignation des broches GPIO (Boîte Noire V1)
 * ============================================================================
 * Cible : ESP32-C3-MINI-1
 *
 * SÉCURITÉ : Conformité OWASP A02 (pas de secrets codés en dur).
 *            Conformité CIS Control 4 (configuration sécurisée par défaut).
 * ============================================================================
 */

#ifndef BLACKBOX_PINS_H
#define BLACKBOX_PINS_H

/*
 * Les broches viennent du plan de l'usine qui fabrique le circuit : elles se règlent
 * dans `idf.py menuconfig` → « Boîte noire — câblage », ou dans le fichier
 * sdkconfig.prod.defaults livré avec le firmware. -1 = non câblé.
 *
 * Correctif : l'ancien plan (GPS sur IO16/IO17, UART0 sur IO1/IO3) était celui de
 * l'ESP32 classique ; sur l'ESP32-C3-MINI-1 les GPIO 11 à 17 n'existent pas
 * (Flash interne) et l'UART0 est sur IO20/IO21.
 */
#ifndef CONFIG_BB_PIN_IMU_SDA   /* Analyse statique hors ESP-IDF (idf_stubs) */
#define CONFIG_BB_PIN_IMU_SDA      -1
#define CONFIG_BB_PIN_IMU_SCL      -1
#define CONFIG_BB_PIN_GPS_RX       -1
#define CONFIG_BB_PIN_GPS_TX       -1
#define CONFIG_BB_PIN_GPS_POWER    -1
#define CONFIG_BB_PIN_TAMPER_MESH  -1
#define CONFIG_BB_PIN_TAMPER_LIGHT -1
#define CONFIG_BB_PIN_VEXT_SENSE   -1
#define CONFIG_BB_PIN_VBAT_ADC     -1
#define CONFIG_BB_PIN_LED_STATUS   -1
#endif

#define PIN_TAMPER_LIGHT   CONFIG_BB_PIN_TAMPER_LIGHT
#define PIN_TAMPER_MESH    CONFIG_BB_PIN_TAMPER_MESH
#define PIN_GPS_RX         CONFIG_BB_PIN_GPS_RX
#define PIN_GPS_TX         CONFIG_BB_PIN_GPS_TX
#define PIN_GPS_POWER      CONFIG_BB_PIN_GPS_POWER
#define PIN_LED_STATUS     CONFIG_BB_PIN_LED_STATUS
#define PIN_VEXT_SENSE     CONFIG_BB_PIN_VEXT_SENSE
#define PIN_VBAT_ADC       CONFIG_BB_PIN_VBAT_ADC
#define PIN_IMU_SDA        CONFIG_BB_PIN_IMU_SDA
#define PIN_IMU_SCL        CONFIG_BB_PIN_IMU_SCL

/* Un firmware de PRODUCTION (démarrage sécurisé) ne peut pas sortir sans le câblage
 * essentiel : sans accéléromètre aucun choc n'est détecté, sans maillage l'ouverture
 * passe inaperçue, sans 12 V pas de signature d'urgence à la coupure. */
#if defined(CONFIG_SECURE_BOOT) && (PIN_IMU_SDA < 0 || PIN_IMU_SCL < 0 || PIN_GPS_RX < 0 || \
                                    PIN_GPS_TX < 0 || PIN_TAMPER_MESH < 0 || PIN_VEXT_SENSE < 0)
#error "Firmware de production : renseigner le plan des broches de l'usine (menuconfig → Boîte noire — câblage)."
#endif

#endif /* BLACKBOX_PINS_H */
