# End-of-Line (EOL) Flashing & Provisioning Guide
## Target: ESP32-C3-MINI-1

This guide provides the mandatory commands for flashing the firmware and burning the eFuse security keys at the factory. 
**DO NOT SHARE THIS DOCUMENT WITH UNAUTHORIZED PERSONNEL.**

### Prerequisites
- Python 3.8+
- `esptool.py` and `espefuse.py` installed (`pip install esptool`)
- USB to UART TTL adapter connected to ESP32-C3 (TX, RX, GND, 3V3)

### Step 1: Burn the Serial Number (NVS)
Each device must have a unique Serial Number (e.g., `BB50-00048`).
Generate a custom NVS partition for each device using `nvs_partition_gen.py` (provided separately) and flash it to the NVS offset:
```bash
esptool.py --port /dev/ttyUSB0 --baud 460800 write_flash 0x9000 nvs_bb50_00048.bin
```

### Step 2: Flash the Firmware
Write the Bootloader, Partition Table, and the Application Firmware:
```bash
esptool.py --port /dev/ttyUSB0 --baud 460800 write_flash \
  0x0 bootloader.bin \
  0x8000 partition-table.bin \
  0x10000 blackbox_fw.bin
```

### Step 3: Burn AES-256 Keys & Enable Secure Boot (CRITICAL)
To ensure the tamper-evident mechanism works and the firmware cannot be extracted or modified, you must blow the hardware eFuses.

> **WARNING:** Blowing eFuses is IRREVERSIBLE. A mistake will permanently brick the ESP32-C3.

1. **Burn the Flash Encryption Key (AES-256):**
```bash
espefuse.py --port /dev/ttyUSB0 burn_key flash_encryption my_secret_key.bin
```
2. **Enable Flash Encryption:**
```bash
espefuse.py --port /dev/ttyUSB0 burn_efuse SPI_BOOT_CRYPT_CNT
```
3. **Disable JTAG / ROM BASIC (Anti-Glitch & Debug Prevention):**
```bash
espefuse.py --port /dev/ttyUSB0 burn_efuse DISABLE_JTAG
espefuse.py --port /dev/ttyUSB0 burn_efuse DISABLE_ROM_DL_MODE
```

### Step 4: Verification
Reboot the device. You should see the bootloader decrypting the application and starting the BLE advertising as `BB50-XXXX`.
