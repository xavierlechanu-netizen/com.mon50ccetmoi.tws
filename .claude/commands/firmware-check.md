Inspecte et valide le firmware embarqué C ESP-IDF v5.x de la Boîte Noire ESP32-C3 (`hardware/firmware/`) :

1. Vérifie les fichiers `hardware/firmware/main/main.c`, `hardware/firmware/components/blackbox/blackbox_storage.c` et `hardware/firmware/components/tamper/tamper.c`.
2. Contrôle le respect strict des règles temps réel FreeRTOS / ESP32-C3 :
   - Aucune opération Flash SPI / NVS ni appel bloquant dans l'ISR `tamper_isr_handler` (`IRAM_ATTR`).
   - Zeroization en 2 étapes : effacement immédiat de la RAM volatile en ISR (< 1 µs), suivi de `blackbox_storage_zeroize_keys()` et `tamper_zeroize()` en tête de `telemetry_task`.
   - Génération d'IV aléatoire matériel (`esp_fill_random`) à chaque trame `AES-256-CBC` et chaînage de Merkle `SHA-256` signé en `ECDSA P-256`.
3. Vérifie la compatibilité des stubs d'analyse statique dans `hardware/firmware/idf_stubs/` pour maintenir **0 erreur et 0 avertissement `clangd`**.

