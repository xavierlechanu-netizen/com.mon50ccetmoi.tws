# Nomenclature (BOM) - Blackbox "mon50ccetmoi" v1.0

Cette Bill of Materials (BOM) liste les composants critiques nécessaires à la fabrication du circuit imprimé (PCBA - 4 couches, finition ENIG) de la Blackbox v1.0, d'après les spécifications de conception.

| N° | Réf. Composant | Catégorie | Description Technique | Qté |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **ESP32-C3-MINI-1** | **Microcontrôleur (SoC)** | Module Espressif RISC-V 32 bits, Wi-Fi & BLE 5.0 intégrés, 4MB Flash SPI. | 1 |
| 2 | **Quectel L76-LB** | **Module GNSS (GPS)** | Récepteur GNSS multi-constellation. | 1 |
| 3 | **Antenne GPS** | **Antenne** | Antenne patch céramique (soudée sur PCB). | 1 |
| 4 | **MPU6050** | **Centrale Inertielle** | IMU 6 axes (Accéléromètre 3 axes + Gyroscope 3 axes). | 1 |
| 5 | **BQ24075** | **Chargeur LiPo** | Circuit de gestion de charge pour batterie LiPo 1S via USB. | 1 |
| 6 | **TPS63070** | **Régulateur (Buck-Boost)** | Convertisseur DC-DC 3.3V haute efficacité. | 1 |
| 7 | **W25Q32JV** | **Mémoire Flash** | Puce mémoire Flash SPI supplémentaire de 32M-bit (Optionnel). | 1 |
| 8 | **RV-3028** | **Horloge (RTC)** | Real-Time Clock très basse consommation (Optionnel). | 1 |
| 9 | **JST-PH 2.0** | **Connecteur** | Connecteur pour batterie amovible LiPo 1S (3.7V). | 1 |
| 10 | **Port USB-C** | **Connectique** | Port pour la charge (5V) et le debug en usine. | 1 |
| 11 | **LEDs CMS** | **Indicateurs** | LEDs de statut (PWR / CHG / STAT). | 3 |
| 12 | **Batterie LiPo 1S** | **Alimentation** | Batterie 3.7V 1000 mAh (Dimensions approx. 50x34x6 mm). | 1 |

## Remarques pour l'assemblage
> [!TIP]
> - Le PCB final a des dimensions de **60 mm x 40 mm** avec une épaisseur de **1.6 mm**.
> - La hauteur maximale des composants (hors batterie) est de **8.5 mm**.
> - Les condensateurs de découplage, résistances et l'antenne BLE intégrée ne sont pas listés ici mais font partie du routage de la carte.
