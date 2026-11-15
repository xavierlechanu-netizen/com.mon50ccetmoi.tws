idf_component_register(
    SRCS "tamper.c"
    INCLUDE_DIRS "."
    REQUIRES driver esp_system nvs_flash efuse mbedtls blackbox
    PRIV_REQUIRES esp_partition
)
