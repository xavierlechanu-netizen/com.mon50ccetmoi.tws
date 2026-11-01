#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include "esp_log.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c.h"
#include "imu.h"
#include "../../main/blackbox_pins.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static const char *TAG = "IMU";

#define I2C_MASTER_SCL_IO           PIN_IMU_SCL
#define I2C_MASTER_SDA_IO           PIN_IMU_SDA
#define I2C_MASTER_NUM              I2C_NUM_0
#define I2C_MASTER_FREQ_HZ          400000
#define MPU6050_ADDR                0x68
#define MPU6050_REG_PWR_MGMT_1      0x6B
#define MPU6050_REG_CONFIG          0x1A
#define MPU6050_REG_ACCEL_CONFIG    0x1C
#define MPU6050_REG_ACCEL_XOUT_H    0x3B

/* Pleine échelle +-16g (AFS_SEL = 3 -> 0x18) = 2048.0 LSB/g (EXP-BB50-2026-REV3) */
#define ACCEL_SCALE_16G             2048.0f

static bool imu_ready = false;

static esp_err_t mpu6050_write_reg(uint8_t reg_addr, uint8_t val)
{
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (MPU6050_ADDR << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(cmd, reg_addr, true);
    i2c_master_write_byte(cmd, val, true);
    i2c_master_stop(cmd);
    esp_err_t ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(100));
    i2c_cmd_link_delete(cmd);
    return ret;
}

/**
 * Lit les registres de l'accéléromètre via I2C
 */
static esp_err_t mpu6050_read_accel(int16_t *accel_x, int16_t *accel_y, int16_t *accel_z)
{
    uint8_t data[6] = {0};

    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (MPU6050_ADDR << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(cmd, MPU6050_REG_ACCEL_XOUT_H, true);

    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (MPU6050_ADDR << 1) | I2C_MASTER_READ, true);
    i2c_master_read(cmd, data, 5, I2C_MASTER_ACK);
    i2c_master_read_byte(cmd, data + 5, I2C_MASTER_NACK);
    i2c_master_stop(cmd);

    esp_err_t ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(100));
    i2c_cmd_link_delete(cmd);

    if (ret == ESP_OK) {
        *accel_x = (int16_t)((data[0] << 8) | data[1]);
        *accel_y = (int16_t)((data[2] << 8) | data[3]);
        *accel_z = (int16_t)((data[4] << 8) | data[5]);
    }
    return ret;
}

void imu_init(void)
{
    if (I2C_MASTER_SDA_IO < 0 || I2C_MASTER_SCL_IO < 0) {
        ESP_LOGW(TAG, "Broches I2C IMU non assignées (mode simulation 1G actif).");
        imu_ready = false;
        return;
    }

    ESP_LOGI(TAG, "Initialisation du bus I2C pour l'IMU MPU6050...");

    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master = {
            .clk_speed = I2C_MASTER_FREQ_HZ,
        },
        .clk_flags = 0,
    };

    esp_err_t ret = i2c_param_config(I2C_MASTER_NUM, &conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Erreur i2c_param_config");
        return;
    }

    ret = i2c_driver_install(I2C_MASTER_NUM, conf.mode, 0, 0, 0);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Erreur i2c_driver_install");
        return;
    }

    /* 1. Sortir le MPU6050 du mode veille (PWR_MGMT_1 = 0x00) */
    ret = mpu6050_write_reg(MPU6050_REG_PWR_MGMT_1, 0x00);
    /* 2. Configurer le filtre passe-bas numérique DLPF à 94 Hz (CONFIG = 0x02) */
    if (ret == ESP_OK) {
        ret = mpu6050_write_reg(MPU6050_REG_CONFIG, 0x02);
    }
    /* 3. Configurer la pleine échelle à +-16G (ACCEL_CONFIG = 0x18) */
    if (ret == ESP_OK) {
        ret = mpu6050_write_reg(MPU6050_REG_ACCEL_CONFIG, 0x18);
    }

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "IMU MPU6050 initialisé (+-16G, DLPF 94 Hz).");
        imu_ready = true;
    } else {
        ESP_LOGW(TAG, "IMU MPU6050 non détecté sur le bus I2C (mode simulation activé).");
    }
}

void imu_read_data(imu_data_t *out_data)
{
    if (!out_data) {
        return;
    }

    if (!imu_ready) {
        out_data->accel_g = 1.0f;
        out_data->lean_angle = 0.0f;
        out_data->accel_x_mg = 0;
        out_data->accel_y_mg = 0;
        out_data->accel_z_mg = 1000;
        return;
    }

    int16_t raw_x = 0, raw_y = 0, raw_z = 0;
    if (mpu6050_read_accel(&raw_x, &raw_y, &raw_z) == ESP_OK) {
        float x_g = (float)raw_x / ACCEL_SCALE_16G;
        float y_g = (float)raw_y / ACCEL_SCALE_16G;
        float z_g = (float)raw_z / ACCEL_SCALE_16G;

        out_data->accel_x_mg = (int16_t)(x_g * 1000.0f);
        out_data->accel_y_mg = (int16_t)(y_g * 1000.0f);
        out_data->accel_z_mg = (int16_t)(z_g * 1000.0f);

        out_data->accel_g = sqrtf(x_g * x_g + y_g * y_g + z_g * z_g);

        float angle_rad = atan2f(y_g, sqrtf(x_g * x_g + z_g * z_g));
        out_data->lean_angle = fabsf(angle_rad * (float)(180.0 / M_PI));
    } else {
        out_data->accel_g = 1.0f;
        out_data->lean_angle = 0.0f;
        out_data->accel_x_mg = 0;
        out_data->accel_y_mg = 0;
        out_data->accel_z_mg = 1000;
    }
}
