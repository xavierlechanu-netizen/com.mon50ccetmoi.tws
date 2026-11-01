#ifndef IMU_H
#define IMU_H

#include <stdint.h>

/**
 * Structure contenant les données calculées de la centrale inertielle MPU6050
 * Calibrée pleine échelle +-16G (2048.0 LSB/g — Rapport EXP-BB50-2026-REV3)
 */
typedef struct {
    float accel_g;          /* Accélération totale 3D en G (ex: 1.0 = repos) */
    float lean_angle;       /* Angle d'inclinaison Roll en degrés (0 = droit, 90 = couché) */
    int16_t accel_x_mg;     /* Accélération longitudinale X en milli-G */
    int16_t accel_y_mg;     /* Accélération latérale Y en milli-G */
    int16_t accel_z_mg;     /* Accélération verticale Z en milli-G */
} imu_data_t;

/**
 * Initialise le bus I2C et le capteur IMU (MPU6050 en +-16G + DLPF)
 */
void imu_init(void);

/**
 * Lit les données brutes, calcule les G 3D et l'inclinaison, puis les stocke dans `out_data`
 * @param out_data Pointeur vers la structure à remplir
 */
void imu_read_data(imu_data_t *out_data);

#endif /* IMU_H */
