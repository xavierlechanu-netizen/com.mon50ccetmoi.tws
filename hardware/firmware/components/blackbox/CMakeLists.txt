idf_component_register(
    SRCS "blackbox_storage.c"
    INCLUDE_DIRS "."
    REQUIRES esp_partition nvs_flash mbedtls
    PRIV_REQUIRES esp_system esp_hw_support
)
