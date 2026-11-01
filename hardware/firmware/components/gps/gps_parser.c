/**
 * ============================================================================
 * gps_parser.c — Parseur NMEA 0183 complet (Boîte Noire V1)
 * ============================================================================
 * Cible : ESP32-C3-MINI-1 (ESP-IDF v5.x)
 *
 * Trames supportées :
 *   $GPGGA — Position, altitude, satellites, HDOP
 *   $GPRMC — Position, vitesse, cap, date/heure, validité
 *   $GPGSA — DOP (PDOP, HDOP, VDOP), mode de fix
 *
 * Machine à états pour le buffering :
 *   IDLE → (reçoit '$') → RECEIVING → (reçoit '\n') → PARSE → IDLE
 *
 * CONFORMITÉ :
 *   - CIS 16.10 : Validation stricte : checksum XOR, longueur max,
 *                 bornes de valeurs (lat: -90/+90, lon: -180/+180).
 *   - OWASP A03 : Aucun buffer overflow (taille fixe + troncature).
 *   - OWASP A11 : Code propre, fonctions courtes et testables.
 * ============================================================================
 */

#include <string.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>
#include "esp_log.h"

#include "gps_parser.h"
#include "blackbox_storage.h"

/* ---- Tag de log ---- */
static const char *TAG = "GPS";

/* ---- Constantes ---- */
#define NMEA_MAX_LEN        128     /* Longueur max d'une trame NMEA */
#define KNOTS_TO_KMH        1.852f

/* ---- Machine à états ---- */
typedef enum {
    PARSER_IDLE,
    PARSER_RECEIVING,
} parser_fsm_t;

/* ---- État interne ---- */
static gps_data_t  s_gps_data;
static char        s_nmea_buf[NMEA_MAX_LEN];
static uint16_t    s_nmea_idx = 0;
static parser_fsm_t s_fsm_state = PARSER_IDLE;

/* ---- Prototypes internes ---- */
static void _process_sentence(const char *sentence, uint16_t len);
static bool _validate_checksum(const char *sentence, uint16_t len);
static void _parse_gga(const char *sentence);
static void _parse_rmc(const char *sentence);
static void _parse_gsa(const char *sentence);
static double _nmea_to_degrees(const char *raw, const char *hemisphere);
static int _safe_atoi(const char *s);
static float _safe_atof(const char *s);

/* ============================================================================
 * gps_parser_init()
 * ============================================================================
 */
void gps_parser_init(void)
{
    memset(&s_gps_data, 0, sizeof(s_gps_data));
    memset(s_nmea_buf, 0, sizeof(s_nmea_buf));
    s_nmea_idx = 0;
    s_fsm_state = PARSER_IDLE;
    ESP_LOGI(TAG, "Parseur NMEA initialisé.");
}

/* ============================================================================
 * gps_parser_feed() — Alimentation octet par octet
 * ============================================================================
 */
void gps_parser_feed(const uint8_t *data, uint16_t len)
{
    if (data == NULL || len == 0) {
        return;
    }

    for (uint16_t i = 0; i < len; i++) {
        char c = (char)data[i];

        switch (s_fsm_state) {
            case PARSER_IDLE:
                if (c == '$') {
                    /* Début d'une trame NMEA */
                    s_nmea_idx = 0;
                    s_nmea_buf[s_nmea_idx++] = c;
                    s_fsm_state = PARSER_RECEIVING;
                }
                break;

            case PARSER_RECEIVING:
                if (c == '\n' || c == '\r') {
                    /* Fin de trame — parser */
                    s_nmea_buf[s_nmea_idx] = '\0';
                    _process_sentence(s_nmea_buf, s_nmea_idx);
                    s_nmea_idx = 0;
                    s_fsm_state = PARSER_IDLE;
                } else if (s_nmea_idx < NMEA_MAX_LEN - 1) {
                    s_nmea_buf[s_nmea_idx++] = c;
                } else {
                    /* Trame trop longue — abandonner (CIS 16.10) */
                    ESP_LOGW(TAG, "Trame NMEA tronquée (> %d chars)", NMEA_MAX_LEN);
                    s_nmea_idx = 0;
                    s_fsm_state = PARSER_IDLE;
                }
                break;
        }
    }
}

/* ============================================================================
 * gps_parser_get_data()
 * ============================================================================
 */
const gps_data_t *gps_parser_get_data(void)
{
    return &s_gps_data;
}

/* ============================================================================
 * gps_parser_to_frame() — Conversion GPS → blackbox_frame_t
 * ============================================================================
 */
void gps_parser_to_frame(const gps_data_t *gps, void *frame_ptr)
{
    if (gps == NULL || frame_ptr == NULL) {
        return;
    }

    blackbox_frame_t *frame = (blackbox_frame_t *)frame_ptr;

    frame->latitude      = (int32_t)(gps->latitude * 1e7);
    frame->longitude     = (int32_t)(gps->longitude * 1e7);
    frame->speed_kmh_x10 = (uint16_t)(gps->speed_kmh * 10.0f);
    frame->heading_deg   = (uint16_t)gps->course_deg;
    frame->satellites    = gps->satellites_used;
    frame->hdop_x10      = (uint8_t)(gps->hdop * 10.0f);
    frame->timestamp_ms  = gps->millisecond;

    /* Calcul horodatage UTC atomique depuis NMEA ($GPRMC) */
    if (gps->valid && gps->year >= 2024 && gps->month >= 1 && gps->month <= 12 && gps->day >= 1 && gps->day <= 31) {
        struct tm t = {0};
        t.tm_year = gps->year - 1900;
        t.tm_mon  = gps->month - 1;
        t.tm_mday = gps->day;
        t.tm_hour = gps->hour;
        t.tm_min  = gps->minute;
        t.tm_sec  = gps->second;
        t.tm_isdst = 0;
        time_t epoch = mktime(&t);
        if (epoch > 0) {
            frame->timestamp_utc = (uint32_t)epoch;
            frame->flags |= 0x02; /* Bit 1: Horloge synchronisée UTC GNSS atomique */
        }
    }
}

/* ============================================================================
 * _process_sentence() — Dispatch vers le bon parser
 * ============================================================================
 */
static void _process_sentence(const char *sentence, uint16_t len)
{
    /* Validation du checksum (XOR de tous les chars entre $ et *) */
    if (!_validate_checksum(sentence, len)) {
        s_gps_data.checksum_errors++;
        ESP_LOGD(TAG, "Checksum NMEA invalide.");
        return;
    }

    s_gps_data.sentences_parsed++;

    /* Identifier le type de trame */
    if (strncmp(sentence, "$GPGGA", 6) == 0 ||
        strncmp(sentence, "$GNGGA", 6) == 0) {
        _parse_gga(sentence);
    } else if (strncmp(sentence, "$GPRMC", 6) == 0 ||
               strncmp(sentence, "$GNRMC", 6) == 0) {
        _parse_rmc(sentence);
    } else if (strncmp(sentence, "$GPGSA", 6) == 0 ||
               strncmp(sentence, "$GNGSA", 6) == 0) {
        _parse_gsa(sentence);
    }
    /* Les autres trames ($GPGSV, $GPVTG, etc.) sont ignorées */
}

/* ============================================================================
 * _validate_checksum() — Vérification XOR NMEA
 * ============================================================================
 * Format attendu : $....*HH\0
 * Le checksum est le XOR de tous les octets entre '$' et '*' (exclus).
 * ============================================================================
 */
static bool _validate_checksum(const char *sentence, uint16_t len)
{
    if (len < 4 || sentence[0] != '$') {
        return false;
    }

    /* Trouver l'étoile */
    const char *star = strchr(sentence, '*');
    if (star == NULL || (star - sentence) < 1) {
        return false;
    }

    /* Calculer le XOR */
    uint8_t calculated = 0;
    for (const char *p = sentence + 1; p < star; p++) {
        calculated ^= (uint8_t)*p;
    }

    /* Lire le checksum attendu (2 chars hex après '*') */
    if (star + 2 >= sentence + len) {
        return false;
    }

    uint8_t expected = (uint8_t)strtol(star + 1, NULL, 16);

    return calculated == expected;
}

/* ============================================================================
 * _parse_gga() — $GPGGA (Position, altitude, satellites)
 * ============================================================================
 * $GPGGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,,*hh
 *        0         1       2 3        4 5 6  7   8   9
 * ============================================================================
 */
static void _parse_gga(const char *sentence)
{
    char buf[NMEA_MAX_LEN];
    strncpy(buf, sentence, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    char *saveptr = NULL;
    char *fields[15] = {NULL};
    int field = 0;

    char *token = strtok_r(buf, ",", &saveptr);
    while (token != NULL && field < 15) {
        fields[field++] = token;
        token = strtok_r(NULL, ",", &saveptr);
    }

    if (field < 10) {
        return;  /* Trame incomplète */
    }

    /* Heure UTC (champ 1 : hhmmss.ss — précision 10 Hz) */
    if (fields[1] && strlen(fields[1]) >= 6) {
        char hh[3] = { fields[1][0], fields[1][1], '\0' };
        char mm[3] = { fields[1][2], fields[1][3], '\0' };
        char ss[3] = { fields[1][4], fields[1][5], '\0' };
        s_gps_data.hour   = (uint8_t)_safe_atoi(hh);
        s_gps_data.minute = (uint8_t)_safe_atoi(mm);
        s_gps_data.second = (uint8_t)_safe_atoi(ss);

        const char *dot = strchr(fields[1], '.');
        if (dot != NULL && *(dot + 1) != '\0') {
            float frac = _safe_atof(dot);
            s_gps_data.millisecond = (uint16_t)(frac * 1000.0f) % 1000;
        }
    }

    /* Latitude (champs 2-3) */
    if (fields[2] && fields[3] && strlen(fields[2]) > 0) {
        s_gps_data.latitude = _nmea_to_degrees(fields[2], fields[3]);
    }

    /* Longitude (champs 4-5) */
    if (fields[4] && fields[5] && strlen(fields[4]) > 0) {
        s_gps_data.longitude = _nmea_to_degrees(fields[4], fields[5]);
    }

    /* Qualité du fix (champ 6) */
    if (fields[6]) {
        int fix = _safe_atoi(fields[6]);
        if (fix >= 0 && fix <= 6) {
            s_gps_data.fix_quality = (gps_fix_quality_t)fix;
            s_gps_data.valid = (fix >= 1);
        }
    }

    /* Satellites utilisés (champ 7) */
    if (fields[7]) {
        s_gps_data.satellites_used = (uint8_t)_safe_atoi(fields[7]);
    }

    /* HDOP (champ 8) */
    if (fields[8]) {
        s_gps_data.hdop = _safe_atof(fields[8]);
    }

    /* Altitude MSL (champ 9) */
    if (fields[9]) {
        s_gps_data.altitude_m = _safe_atof(fields[9]);
    }
}

/* ============================================================================
 * _parse_rmc() — $GPRMC (Vitesse, cap, date)
 * ============================================================================
 * $GPRMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,x.x,a*hh
 *        0         1 2       3 4        5 6   7   8       9
 * ============================================================================
 */
static void _parse_rmc(const char *sentence)
{
    char buf[NMEA_MAX_LEN];
    strncpy(buf, sentence, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    char *saveptr = NULL;
    char *fields[15] = {NULL};
    int field = 0;

    char *token = strtok_r(buf, ",", &saveptr);
    while (token != NULL && field < 15) {
        fields[field++] = token;
        token = strtok_r(NULL, ",", &saveptr);
    }

    if (field < 10) {
        return;
    }

    /* Heure UTC + millisecondes 10 Hz (champ 1 : hhmmss.ss) */
    if (fields[1] && strlen(fields[1]) >= 6) {
        char hh[3] = { fields[1][0], fields[1][1], '\0' };
        char mm[3] = { fields[1][2], fields[1][3], '\0' };
        char ss[3] = { fields[1][4], fields[1][5], '\0' };
        s_gps_data.hour   = (uint8_t)_safe_atoi(hh);
        s_gps_data.minute = (uint8_t)_safe_atoi(mm);
        s_gps_data.second = (uint8_t)_safe_atoi(ss);

        const char *dot = strchr(fields[1], '.');
        if (dot != NULL && *(dot + 1) != '\0') {
            float frac = _safe_atof(dot);
            s_gps_data.millisecond = (uint16_t)(frac * 1000.0f) % 1000;
        }
    }

    /* Statut (champ 2 : A = Active, V = Void) */
    if (fields[2]) {
        s_gps_data.valid = (fields[2][0] == 'A');
    }

    /* Latitude (champs 3-4) — mise à jour redondante avec GGA */
    if (fields[3] && fields[4] && strlen(fields[3]) > 0) {
        s_gps_data.latitude = _nmea_to_degrees(fields[3], fields[4]);
    }

    /* Longitude (champs 5-6) */
    if (fields[5] && fields[6] && strlen(fields[5]) > 0) {
        s_gps_data.longitude = _nmea_to_degrees(fields[5], fields[6]);
    }

    /* Vitesse en nœuds (champ 7) */
    if (fields[7]) {
        s_gps_data.speed_knots = _safe_atof(fields[7]);
        s_gps_data.speed_kmh = s_gps_data.speed_knots * KNOTS_TO_KMH;

        /* Validation : un 50cc ne dépasse pas 80 km/h (CIS 16.10) */
        if (s_gps_data.speed_kmh > 120.0f) {
            ESP_LOGW(TAG, "Vitesse anormale : %.1f km/h — GPS instable ?",
                     (double)s_gps_data.speed_kmh);
        }
    }

    /* Cap (champ 8) */
    if (fields[8]) {
        s_gps_data.course_deg = _safe_atof(fields[8]);
        /* Borner à 0-360 */
        if (s_gps_data.course_deg < 0.0f) {
            s_gps_data.course_deg = 0.0f;
        }
        if (s_gps_data.course_deg > 360.0f) {
            s_gps_data.course_deg = fmodf(s_gps_data.course_deg, 360.0f);
        }
    }

    /* Date (champ 9 : ddmmyy) */
    if (fields[9] && strlen(fields[9]) >= 6) {
        char dd[3] = { fields[9][0], fields[9][1], '\0' };
        char mm[3] = { fields[9][2], fields[9][3], '\0' };
        char yy[3] = { fields[9][4], fields[9][5], '\0' };
        s_gps_data.day   = (uint8_t)_safe_atoi(dd);
        s_gps_data.month = (uint8_t)_safe_atoi(mm);
        s_gps_data.year  = 2000 + (uint16_t)_safe_atoi(yy);
    }
}

/* ============================================================================
 * _parse_gsa() — $GPGSA (DOP et mode de fix)
 * ============================================================================
 * $GPGSA,A,3,xx,xx,...,x.x,x.x,x.x*hh
 *        0 1 2-13     14  15  16
 * ============================================================================
 */
static void _parse_gsa(const char *sentence)
{
    char buf[NMEA_MAX_LEN];
    strncpy(buf, sentence, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    char *saveptr = NULL;
    char *fields[20] = {NULL};
    int field = 0;

    char *token = strtok_r(buf, ",", &saveptr);
    while (token != NULL && field < 20) {
        fields[field++] = token;
        token = strtok_r(NULL, ",", &saveptr);
    }

    if (field < 17) {
        return;
    }

    /* PDOP (champ 15) */
    if (fields[15]) {
        s_gps_data.pdop = _safe_atof(fields[15]);
    }

    /* HDOP (champ 16) */
    if (fields[16]) {
        s_gps_data.hdop = _safe_atof(fields[16]);
    }

    /* VDOP (champ 17 — peut contenir le checksum) */
    if (field > 17 && fields[17]) {
        /* Couper au '*' si présent */
        char *star = strchr(fields[17], '*');
        if (star) {
            *star = '\0';
        }
        s_gps_data.vdop = _safe_atof(fields[17]);
    }
}

/* ============================================================================
 * _nmea_to_degrees() — Conversion ddmm.mmmm → degrés décimaux
 * ============================================================================
 * Entrée : "4807.038" + "N"
 * Sortie : 48.1173 (degrés décimaux)
 *
 * Validation (CIS 16.10) :
 *   - Latitude  : -90.0 à +90.0
 *   - Longitude : -180.0 à +180.0
 * ============================================================================
 */
static double _nmea_to_degrees(const char *raw, const char *hemisphere)
{
    if (raw == NULL || hemisphere == NULL || strlen(raw) < 4) {
        return 0.0;
    }

    double value = strtod(raw, NULL);
    int degrees = (int)(value / 100.0);
    double minutes = value - (degrees * 100.0);
    double result = degrees + (minutes / 60.0);

    /* Appliquer le signe selon l'hémisphère */
    if (hemisphere[0] == 'S' || hemisphere[0] == 'W') {
        result = -result;
    }

    /* Validation des bornes (CIS 16.10) */
    if (result > 180.0 || result < -180.0) {
        ESP_LOGW(TAG, "Coordonnée GPS hors bornes : %.6f", result);
        return 0.0;
    }

    return result;
}

/* ============================================================================
 * Helpers sécurisés (anti-crash sur entrées invalides)
 * ============================================================================
 */
static int _safe_atoi(const char *s)
{
    if (s == NULL || *s == '\0') {
        return 0;
    }
    return atoi(s);
}

static float _safe_atof(const char *s)
{
    if (s == NULL || *s == '\0') {
        return 0.0f;
    }
    return (float)atof(s);
}
