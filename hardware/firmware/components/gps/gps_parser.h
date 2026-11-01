/**
 * ============================================================================
 * gps_parser.h — Parseur NMEA complet (Boîte Noire V1)
 * ============================================================================
 * Parse les trames NMEA 0183 du module GPS Quectel L76-LB :
 *   - $GPGGA : Position, altitude, qualité du fix
 *   - $GPRMC : Position, vitesse, cap, date/heure
 *   - $GPGSA : DOP et satellites actifs
 *
 * SÉCURITÉ :
 *   - CIS 16.10 : Validation stricte de toutes les entrées.
 *   - OWASP A03 : Pas de buffer overflow (taille max contrôlée).
 * ============================================================================
 */

#ifndef GPS_PARSER_H
#define GPS_PARSER_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Qualité du fix GPS.
 */
typedef enum {
    GPS_FIX_INVALID    = 0,
    GPS_FIX_GPS        = 1,   /**< Fix GPS standard */
    GPS_FIX_DGPS       = 2,   /**< Fix GPS différentiel */
    GPS_FIX_PPS        = 3,
    GPS_FIX_RTK        = 4,
    GPS_FIX_FLOAT_RTK  = 5,
    GPS_FIX_ESTIMATED  = 6,
} gps_fix_quality_t;

/**
 * @brief Données GPS consolidées depuis les trames NMEA.
 */
typedef struct {
    /* ---- Position ---- */
    bool     valid;               /**< Fix valide (true si fix ≥ 1) */
    double   latitude;            /**< Latitude en degrés décimaux */
    double   longitude;           /**< Longitude en degrés décimaux */
    float    altitude_m;          /**< Altitude en mètres (MSL) */

    /* ---- Mouvement ---- */
    float    speed_knots;         /**< Vitesse en nœuds (de $GPRMC) */
    float    speed_kmh;           /**< Vitesse en km/h (calculée) */
    float    course_deg;          /**< Cap en degrés (0-359.99) */

    /* ---- Qualité ---- */
    gps_fix_quality_t fix_quality;
    uint8_t  satellites_used;     /**< Satellites utilisés pour le fix */
    float    hdop;                /**< Horizontal Dilution of Precision */
    float    pdop;                /**< Position DOP (de $GPGSA) */
    float    vdop;                /**< Vertical DOP (de $GPGSA) */

    /* ---- Date & Heure (UTC + Millisecondes 10 Hz) ---- */
    uint8_t  hour;
    uint8_t  minute;
    uint8_t  second;
    uint16_t millisecond;         /**< Millisecondes UTC (0..999) pour échantillonnage 10 Hz */
    uint8_t  day;
    uint8_t  month;
    uint16_t year;                /**< Année complète (ex: 2026) */

    /* ---- Compteurs ---- */
    uint32_t sentences_parsed;    /**< Nombre total de trames parsées */
    uint32_t checksum_errors;     /**< Nombre d'erreurs de checksum */
} gps_data_t;

/**
 * @brief Initialise le parseur GPS (remet les compteurs à zéro).
 */
void gps_parser_init(void);

/**
 * @brief Alimente le parseur avec un flux d'octets bruts.
 *
 * Peut être appelé avec des morceaux incomplets (buffering interne).
 * Les trames NMEA sont détectées et parsées automatiquement.
 *
 * @param data  Pointeur vers les octets reçus de l'UART.
 * @param len   Nombre d'octets.
 */
void gps_parser_feed(const uint8_t *data, uint16_t len);

/**
 * @brief Retourne un pointeur vers les données GPS consolidées.
 *
 * @return Pointeur constant vers la structure gps_data_t.
 *         Les données sont mises à jour en place à chaque trame parsée.
 */
const gps_data_t *gps_parser_get_data(void);

/**
 * @brief Convertit les données GPS en une blackbox_frame_t prête à stocker.
 *
 * @param gps   Données GPS source.
 * @param frame Trame de destination (sera remplie).
 */
void gps_parser_to_frame(const gps_data_t *gps, void *frame);

#ifdef __cplusplus
}
#endif

#endif /* GPS_PARSER_H */
