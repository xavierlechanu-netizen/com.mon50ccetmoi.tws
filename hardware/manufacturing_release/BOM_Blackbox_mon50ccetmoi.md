# Nomenclature (BOM) - Blackbox "mon50ccetmoi" Rev 2.0 (Homologation `EXP-BB50-2026-REV3`)

Cette Bill of Materials (BOM) définit les composants certifiés nécessaires à la fabrication industrielle du circuit imprimé (**PCBA 4 couches, finition ENIG, assemblage Francelog S.A. — Linselles, 59**) de la **Blackbox Rev 2.0**, conforme aux normes **ISO 7637-2** (transitoires électriques automobiles), **ISO 16750-3 / DO-160G** (tenue vibratoire 20G), **IP67/IP69K** et **ISO/IEC 27037** (intégrité forensique).

| N° | Réf. Schéma | Réf. Composant | Catégorie | Spécification Technique & Normative | Qté |
| :---: | :---: | :--- | :--- | :--- | :---: |
| 1 | `U1` | **ESP32-C3-MINI-1** | **Microcontrôleur (SoC)** | RISC-V 32 bits, BLE 5.0 LE Secure Connections, accélérateurs matériels `AES-256-GCM`, `SHA-256`, `ECDSA P-256` & TRNG, Flash Encryption + Secure Boot V2. | 1 |
| 2 | `U2` | **Quectel L76-LB** | **Module GNSS (10 Hz)** | Récepteur GNSS multi-constellation (GPS/GLONASS/Galileo) cadencé à **115 200 bauds / 10 Hz réel** (`$PMTK251,115200` + `$PMTK220,100`). | 1 |
| 3 | `ANT1` | **Antenne GNSS Céramique** | **Antenne** | Antenne patch céramique 25×25×4 mm soudée sur plan de masse PCB. | 1 |
| 4 | `U3` | **MPU6050** | **Centrale Inertielle** | IMU 6 axes QFN-24 calibrée pleine échelle **$\pm$16G** (`ACCEL_CONFIG = 0x18`), filtrage anti-repliement DLPF. | 1 |
| 5 | `F1` | **Bourns MF-RX050/60** | **Protection Entrée** | Fusible réarmable **PPTC 500 mA / 60 V DC** en tête du faisceau 12V véhicule. | 1 |
| 6 | `D_TVS` | **SMBJ33CA (600W)** | **Protection Surtension** | Diode TVS bidirectionnelle Automotive **600 W** pour l'écrêtage des transitoires de *Load Dump* **ISO 7637-2 Pulse 5a** (stators d'allumage 50cc 2T/4T). | 1 |
| 7 | `Q_REV` | **DMP6023LE (-60V)** | **Inversion Polarité** | MOSFET Canal-P **-60 V** monté en diode idéale (protection contre le branchement inversé sans chute de tension). | 1 |
| 8 | `U5` | **TI LMR16006YDDCR** | **Régulateur Buck 60V** | Convertisseur DC-DC abaisseur **4 V à 60 V** d'entrée (remplace le régulateur 5V USB initial). | 1 |
| 9 | `C_HOLD` | **Eaton KR-5R5C224-R** | **Hold-up Last-Gasp** | Supercondensateur **EDLC 0,22 F / 5,5 V** garantissant $\ge 50\text{ ms}$ de réserve d'énergie pour le *Last-Gasp Write* lors de l'arrachement du faisceau 12V à l'impact. | 1 |
| 10 | `BAT1` | **Cellule LiFePO4 14500** | **Accumulateur Sécurisé** | Batterie **Lithium-Fer-Phosphate ($\text{LiFePO}_4$) 3,2 V / 600 mAh** à pattes nickel soudées (plage **-20 °C à +85 °C**, ininflammable, élimine le risque d'emballement thermique LiPo). | 1 |
| 11 | `U6` | **TI BQ25070DQCR** | **Chargeur LiFePO4** | Contrôleur de charge dédié $\text{LiFePO}_4$ (tension de fin de charge 3,6 V) avec sonde thermique NTC. | 1 |
| 12 | `U4` | **Winbond W25Q32JVSSIQ** | **Mémoire Flash NOR** | Puce mémoire Flash SPI NOR 32 M-bit (buffer circulaire binaire de trames chiffrées `AES-256-GCM` de 96 octets). | 1 |
| 13 | `ENC1` | **Electrolube UR5041** | **Enrobage (Potting)** | Résine polyuréthane bi-composant **Shore 65A** (certification **IP67/IP69K**, suppression des résonances mécaniques 50–500 Hz et protection anti-arrachement). | 1 |

## Remarques d'industrialisation (Francelog S.A. — Linselles)
> [!IMPORTANT]
> - **Suppression des connecteurs batterie enfichables** : Conformément au §1.2 du rapport `EXP-BB50-2026-REV3`, le connecteur `JST-PH 2.0` est banni en production de série au profit de **pattes de soudure en nickel par points** immobilisées dans la résine d'enrobage `UR5041` pour prévenir toute micro-coupure vibratoire.
> - **Mise en service usine** : chaque boîtier fabrique sa clé `ECDSA P-256` et son `PIN BLE` à 6 chiffres **dans la puce** (mode usine) ; l'usine relève la clé publique avec `tools/mise_en_service.py`, le serveur lui attribue le numéro de série lié définitivement à cette clé. Aucune clé privée ne passe par le PC de l'usine (voir `hardware/firmware/README.md`).
