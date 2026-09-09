# Cahier des Charges Matériel - Blackbox "mon50ccetmoi" v1.0

Ce document définit les spécifications techniques et mécaniques pour la fabrication de la **Blackbox v1.0** (Télémétrie sécurisée pour 50cc & VSP).

## 1. Caractéristiques Principales & PCB
- **Dimensions du PCB :** 60 mm x 40 mm.
- **Épaisseur du PCB :** 1.6 mm.
- **Couches et Finition :** 4 couches, finition **ENIG** (Or chimique).
- **Hauteur maximale (hors batterie) :** 8.5 mm.
- **Température de fonctionnement :** -20°C à +85°C.
- **Points de test (Usine) :** Présence de *Test Points* (TP1, TP2, TP3, TP4, GND) sur la face inférieure du PCB pour faciliter le flashage et les tests automatisés avant encapsulation résine.

## 2. Alimentation & Autonomie
- **Batterie :** Batterie amovible **LiPo 1S (3.7 V)**, typiquement 1000 mAh (50 x 34 x 6 mm).
- **Connecteur Batterie :** JST-PH 2.0.
- **Charge :** Port **USB-C** (5 V) avec gestion par circuit BQ24075.
- **Régulation :** Buck-boost TPS63070 pour fournir un 3.3V stable.
- **Autonomie cible :** Plusieurs jours (selon l'usage et les cycles de deep-sleep).

## 3. Boîtier & Ingénierie Mécanique
> [!IMPORTANT]
> Le boîtier final doit garantir une étanchéité IP68 tout en permettant le remplacement de la batterie par l'utilisateur (via un outil spécifique fourni).

- **Dimensions du produit final :** 75 mm x 45 mm x 22 mm.
- **Matériau :** Polycarbonate renforcé.
- **Étanchéité (IP68) :** L'étanchéité totale face à la pluie, à l'immersion et au lavage est assurée par :
  1. Un joint silicone IP68 entre le couvercle supérieur et la coque centrale.
  2. Un second joint silicone IP68 pour refermer le logement de la batterie avec le couvercle inférieur.
- **Visserie de sécurité :** Utilisation de **vis inox A2 de type Torx T6 avec téton central** (réf. type McMaster 91290A148) pour empêcher l'ouverture avec des outils standards. L'embout sécurisé est fourni uniquement aux partenaires agréés.

## 4. Sécurité Matérielle (Inviolabilité)
> [!CAUTION]
> L'intégrité de la Blackbox est la garantie de la confiance des assureurs. Les mesures anti-fraude suivantes sont obligatoires.

- **Encapsulation Résine :** Le PCB est encapsulé dans la résine pour protéger les composants critiques (notamment l'ESP32 et le module GNSS) et empêcher toute altération des sondes logiques, tout en laissant le connecteur JST accessible pour la batterie.
- **Détection d'ouverture :** Le système intègre un mécanisme de détection d'ouverture entraînant l'effacement immédiat des clés cryptographiques (Zeroization).
- **Sérialisation & Traçabilité :** 
  - Chaque boîtier possède un numéro de série unique (ex: `SN : M5M-24-000123`).
  - Le numéro est gravé au laser sous la résine sur une étiquette inviolable.
  - Un QR code unique est imprimé sur le boîtier externe pour faciliter l'activation et la traçabilité par les garages partenaires.
- **Firmware :** Chiffrement matériel et signature du firmware gérés par l'ESP32-C3 (Secure Boot).

## 5. Certification SRA (Sécurité et Réparation Automobiles)
> [!IMPORTANT]
> Le boîtier est conçu en vue d'une homologation SRA (catégorie traceur/antivol électronique). Les partenaires de fabrication doivent respecter des normes strictes de robustesse.

Pour garantir l'agrément SRA, le produit final respecte les exigences suivantes :
- **Autonomie de secours :** L'alimentation autonome (batterie LiPo) permet de continuer le traçage et l'enregistrement même si la batterie principale du véhicule est arrachée.
- **Résistance à la neutralisation :** Les vis Torx à téton central (inviolables) et l'encapsulation en résine du circuit rendent la désactivation ou la compromission matérielle du traceur quasiment impossible sur le terrain.
- **Détection d'effraction :** L'IMU (MPU6050) agit comme détecteur de soulèvement et de remorquage, enregistrant l'incident même contact coupé.
- **Marquage inaltérable :** Le numéro de série (gravure laser sous résine) répond aux exigences d'identification indélébile de la norme.

## 6. Livrables et Assemblage (Vue Éclatée)
L'assemblage en usine doit respecter la structure suivante :
1. Couvercle inférieur (accès batterie).
2. Joint silicone IP68 inférieur.
3. Logement batterie avec batterie LiPo remplaçable branchée au PCB.
4. **PCB encapsulé dans la résine.**
5. Joint silicone IP68 supérieur.
6. Couvercle supérieur vissé avec les vis Torx sécurisées.
