# 🔒 Firmware Boîte Noire — mon 50cc et moi

Firmware embarqué pour le boîtier IoT inviolable "Boîte Noire", destiné à être monté sous le bac à batterie d'un véhicule 50 cc.

## 🎯 Cible Matérielle

| Composant | Référence |
|---|---|
| MCU | ESP32-C3-MINI-1 (RISC-V 32-bit, BLE 5.0) |
| GPS | Quectel L76-LB (UART, 9600 baud) |
| Capteur Tamper | Vishay TEMD6200FX01 (Photodiode) + Tamper Mesh |
| Flash | 4 Mo intégrée |

## 📁 Structure du Projet

```
hardware/firmware/
├── CMakeLists.txt              # Build system ESP-IDF
├── partitions.csv              # Table de partitions (OTA + blackbox_data)
├── sdkconfig.defaults          # Config matérielle par défaut
├── main/
│   ├── CMakeLists.txt
│   ├── main.c                  # Point d'entrée (boot + boucle 1 Hz)
│   └── blackbox_pins.h         # Assignation des GPIOs
└── components/
    ├── tamper/
    │   ├── tamper.h             # API Anti-Tamper & Zeroization
    │   └── tamper.c             # ISR + effacement clés + eFuse brick
    ├── blackbox/
    │   ├── blackbox_storage.h   # API stockage chiffré AES-256
    │   └── blackbox_storage.c   # Ring buffer Flash + AES-256-CBC
    ├── ble_comm/                # (À implémenter) Serveur GATT BLE
    └── gps/                     # (À implémenter) Parseur NMEA complet
```

## 🔐 Architecture de Sécurité

```
[ Capteur déclenché ] → [ ISR GPIO (IRAM) ] → [ tamper_zeroize() ]
    │                                               │
    │                                    ┌──────────┴──────────┐
    │                                    │ 1. Efface clé AES   │
    │                                    │ 2. Efface NVS       │
    │                                    │ 3. Efface Flash data │
    │                                    │ 4. Burn eFuse BRICK  │
    │                                    │ 5. Reboot mort       │
    │                                    └─────────────────────┘
    ▼
 [ Double lecture anti-glitch (parasites moteur 50cc filtré) ]
```

## 🛠️ Prérequis

1. **ESP-IDF v5.x** : [Installation officielle](https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/get-started/)
2. **Python 3.8+** (pour les outils ESP-IDF)

## 🚀 Build & Flash

```bash
# Configurer l'environnement ESP-IDF
. $IDF_PATH/export.sh

# Build
cd hardware/firmware
idf.py set-target esp32c3
idf.py build

# Flash (via test pads UART0 — avant résinage !)
idf.py -p /dev/ttyUSB0 flash monitor
```

## ⚠️ Notes de Production

- **Avant résinage** : Flasher le firmware, vérifier le fonctionnement, puis couler la résine PU.
- **Après résinage** : Seules les mises à jour FOTA (BLE) sont possibles.
- **eFuse JTAG** : Brûler les eFuses de désactivation JTAG **après** validation du prototype.


## Accident figé et signé (comme l'enregistreur d'un avion)

1. **Choc ≥ 3,0 G** : le boîtier ouvre une fenêtre qui part de 30 s avant le choc (graine de chaîne mémorisée en RAM toutes les secondes) et s'arrête 30 s après.
2. **30 s après le choc**, ou **immédiatement à la coupure du 12 V**, ou **au redémarrage** si une coupure brutale a empêché de finir : les trames chiffrées de la fenêtre sont copiées dans un des **2 emplacements protégés** (hors de l'anneau, jamais écrasés par la suite du trajet), puis l'enregistrement est signé : ECDSA P-256 sur **SHA-256(racine)**.
3. L'emplacement n'est **libéré qu'après acquittement** par l'appli. Si deux accidents attendent déjà, un troisième n'est pas figé : les premiers font foi.

### Protocole Bluetooth (service Télémétrie)

| Étape | Caractéristique | Contenu |
| :--- | :--- | :--- |
| Lire l'accident | `ECDSA_SIG` (0x0105), lecture | clé publique (65 o) puis, s'il y en a un, `blackbox_event_t` (156 o, little-endian) : `magic`, `start_seq`, `end_seq`, `impact_seq`, `seed[32]`, `root[32]`, `sig_len`, `sig[72]`, `ack`. Emplacement non indiqué : c'est le plus ancien non acquitté. |
| Exporter ses trames | `EXPORT_CMD` (0x0103), écriture de 2 o `[0xEE][emplacement]` | `end_seq - start_seq + 1` notifications de 64 o sur `FRAME_DATA` (trames déchiffrées, dans l'ordre). L'emplacement se déduit de l'ordre : 0 puis 1 ; l'appli vérifie de toute façon la chaîne et redemande en cas de perte. |
| Envoyer au serveur | — | `POST /api/v1/telemetry/upload` : `payloads: [{ raw: "<128 hex>" }]`, `merkleSeedHex: seed`, `ecdsaSignature: sig` (hex DER), `isCrashReport: true`, `impactTimestamp` (trame `impact_seq`). |
| Acquitter | `ACK_SEQ` (0x0104), écriture de 4 o | `end_seq` de l'accident, **seulement après la réponse 201 du serveur**. |

### Format de la Flash (BOX3)

Le premier démarrage d'un boîtier au format précédent (BOX2) **efface** la partition `blackbox_data` (aucun boîtier n'est encore livré). En-tête journalisé dans le secteur 0 (un effacement tous les 42 enregistrements), anneau de 6 678 trames (~11 min), 2 × 16 secteurs d'accidents.

### Ouverture du boîtier (résine + maillage de cuivre)

Couper le maillage déclenche, dans l'ordre : signature de l'accident en cours, destruction de la **clé de signature** (RAM + NVS), effacement des trajets ordinaires, gravure du bit d'eFuse « ouvert » (bloc utilisateur `EFUSE_BLK3`, bit 0) et coupure du JTAG. Les **accidents signés sont conservés** avec la clé AES qui permet de les relire : au redémarrage, le boîtier n'enregistre plus rien mais laisse l'appli les récupérer par Bluetooth (état anti-effraction `0xFF`).

### UUID Bluetooth

`50ccXXXX-0000-4d6f-6e35-306363657431`, où `XXXX` est l'identifiant court de `ble_comm.h` (ex. service télémétrie `0001`, `ECDSA_SIG` `0105`). Contrat vérifié par `tests/ble-uuid-contract.test.js`.


## Mise en service en usine : une clé faite dans la puce, liée à un numéro de série

Un boîtier neuf (ni clé ni numéro) démarre en **mode usine** : il fabrique dans la puce sa paire de clés ECDSA P-256 et son code d'appairage à 6 chiffres. La clé privée ne sort jamais ; ni l'usine ni mon50ccetmoi ne la connaissent.

`tools/mise_en_service.py` (lancé par l'usine, jeton de poste « factory ») :

1. `BB50 INFO` sur le port série → clé publique et code d'appairage.
2. `POST /api/v1/factory/challenge` → défi du serveur (valable 5 min, lié au poste).
3. `BB50 POP <défi>` → le boîtier signe `SHA-256("mon50cc-factory-pop:<défi>:<clé publique>")` : **preuve que la clé est celle de cette puce**.
4. `POST /api/v1/factory/units` → le serveur vérifie la preuve et attribue le **numéro suivant** (A01, A02… ou P01 à P10), **lié définitivement à la clé** : une clé = un numéro, et la base refuse toute modification du lien.
5. `BB50 SERIAL <numéro>` → écrit une seule fois ; le boîtier redémarre sous ce nom Bluetooth et **le port d'usine ne s'ouvre plus jamais**.

Une clé n'est jamais refaite : un boîtier qui a déjà une clé publique ou un numéro, mais plus de clé privée (ouverture, NVS endommagée), n'a plus de signature. Un retrait de batterie (remplacement en garage agréé) n'efface rien : un accident en cours est scellé et signé au redémarrage.

Les boîtiers restent la propriété de mon50ccetmoi : le lien numéro ↔ clé est définitif, l'utilisateur rattaché au boîtier peut changer.
