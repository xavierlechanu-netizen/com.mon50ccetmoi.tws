# Assembly & Manufacturing Guidelines
## Project: mon50ccetmoi Blackbox V1
## Form Factor: 85 x 54 x 6.5 mm (Ultra-flat Aluminum Casing)

This document contains critical assembly instructions for the PCBA manufacturer and casing assembler.

### 1. Enclosure (Casing)
- **Material:** Matte Black Anodized Aluminum.
- **Engraving:** White laser engraving on the top face: 
  `NEXUS INTEGRATED MODULE / 68/54mm | WIRELESS & SEALED`
- The enclosure MUST be perfectly sealed. No screws should be visible.

### 2. PCBA & Tamper Loop
- Solder the internal backup LiPo battery (BAT1) to the designated pads.
- **CRITICAL - Tamper Loop (Anti-Effraction):**
  - A thin copper wire must be soldered to the `CONN_TAMPER` pads.
  - This wire must be glued/routed along the internal seam of the aluminum casing.
  - If the casing is forced open, the wire will break, triggering the ESP32 zeroization sequence.

### 3. Potting (Epoxy Resin)
- Once the PCBA is inserted and the tamper loop is secured, the interior must be completely filled with UL 94-V0 fire-retardant epoxy resin.
- Ensure the resin does not block the BLE antenna trace on the ESP32-C3 module. Leave an air gap or use an RF-transparent compound above the antenna section.
- **Waterproofing:** IP68 standard must be met. The device will be installed on 50cc scooters exposed to heavy rain and mud.

### 4. Quality Control
- **RF Testing:** Ensure BLE signal strength is > -70dBm at 2 meters.
- **GPS Fix:** Verify cold start time-to-first-fix (TTFF) is < 45 seconds outdoors.
