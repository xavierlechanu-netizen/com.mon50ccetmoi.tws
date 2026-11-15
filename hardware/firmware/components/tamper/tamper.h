/**
 * ============================================================================
 * tamper.h — Module Anti-Tamper & Zeroization (Boîte Noire V1)
 * ============================================================================
 * Gère les capteurs d'intrusion (photodiode, tamper mesh) et déclenche
 * l'effacement instantané des clés AES-256 en cas de violation physique.
 *
 * SÉCURITÉ :
 *   - OWASP A01 : Contrôle d'accès matériel (pas de port physique).
 *   - OWASP A02 : Clés AES en RAM volatile uniquement, jamais en Flash.
 *   - CIS 3     : Chiffrement au repos (AES-256) et en transit (BLE).
 *   - FIDO FDO  : Réduction de la surface d'attaque (JTAG/SWD désactivé).
 * ============================================================================
 */

#ifndef TAMPER_H
#define TAMPER_H

#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief État du système anti-tamper.
 */
typedef enum {
    TAMPER_STATE_SAFE       = 0x00,   /**< Aucune violation détectée */
    TAMPER_STATE_LIGHT      = 0x01,   /**< Lumière détectée (coque percée) */
    TAMPER_STATE_MESH_CUT   = 0x02,   /**< Grille de sécurité coupée */
    TAMPER_STATE_DESTROYED  = 0xFF,   /**< Clés effacées — boîtier neutralisé */
} tamper_state_t;

/**
 * @brief Initialise les GPIOs des capteurs anti-tamper en mode interruption.
 *        Configure le wake-up depuis le Deep Sleep.
 *
 * @return ESP_OK en cas de succès, ESP_FAIL sinon.
 */
esp_err_t tamper_init(void);

/**
 * @brief Retourne l'état courant du système anti-tamper.
 */
tamper_state_t tamper_get_state(void);

/**
 * @brief ZEROIZATION — Efface immédiatement toutes les clés et données
 *        sensibles de la mémoire (RAM + NVS + Flash chiffrée).
 *
 * Cette fonction est conçue pour s'exécuter en quelques microsecondes
 * depuis une ISR (Interrupt Service Routine). Elle est déclarée
 * Appelée hors interruption (elle efface la Flash) : voir main.c, telemetry_task.
 *
 * Actions réalisées :
 *   1. Mise à zéro de la clé AES-256 en RAM volatile.
 *   2. Effacement de la partition NVS (clés persistantes).
 *   3. Positionnement d'un flag "DESTROYED" dans eFuse (irréversible).
 *   4. Redémarrage forcé du microcontrôleur en mode brick.
 *
 * @warning Cette opération est IRRÉVERSIBLE. Le boîtier devient
 *          définitivement inutilisable après appel.
 */
void tamper_zeroize(void);

/**
 * @brief Vérifie si le boîtier a déjà été neutralisé (flag eFuse).
 *
 * @return true si le boîtier est en état "brické", false sinon.
 */
bool tamper_is_bricked(void);

#ifdef __cplusplus
}
#endif

#endif /* TAMPER_H */
