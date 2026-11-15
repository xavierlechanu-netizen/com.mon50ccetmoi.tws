idf_component_register(
    SRCS "ble_comm.c"
    INCLUDE_DIRS "."
    REQUIRES bt esp_system nvs_flash
    PRIV_REQUIRES esp_timer esp_hw_support
)
