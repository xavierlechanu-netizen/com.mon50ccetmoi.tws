# Mon 50cc et moi 🏍️

> **La Boîte Noire et l'Écosystème Connecté nouvelle génération pour les deux-roues.**

**Mon 50cc et moi** est une solution complète (Hardware + Software) conçue pour révolutionner la sécurité, le suivi et l'assurance des jeunes conducteurs de scooters et motos 50cc. Le projet repose sur une architecture *Deep Tech* garantissant une inviolabilité physique et cryptographique des données.

---

## 🏗 Architecture Globale

Le système repose sur un paradigme **Edge-to-Mobile** à zéro coût télécom :
1. **Boîtier Hardware (Edge)** : Enregistre la télémétrie GPS/IMU et chiffre les trames en AES-256 localement.
2. **Smartphone (Mobile Gateway)** : L'application mobile (PWA/TWA) se connecte au boîtier via Bluetooth (BLE), récupère les preuves chiffrées, et utilise le réseau cellulaire du smartphone pour les transmettre au cloud.
3. **Cloud (Firebase)** : Stocke les preuves chiffrées de manière immuable.
4. **Portail Assureur** : Permet aux assurances partenaires de déchiffrer les preuves (Zero-Knowledge) avec l'autorisation de l'utilisateur pour reconstituer un accident via notre IA spécialisée.

---

## 🔌 Spécifications Matérielles (Hardware V1)

Le boîtier électronique (PCB) a été conçu pour être compact, peu coûteux et indestructible.

- **Microcontrôleur** : ESP32-WROOM-32 (WiFi + Bluetooth BLE).
- **Module GPS** : Quectel L76-LB (Connecté sur UART `IO16` et `IO17`).
- **Alimentation** : Directement connectée au 12V de la batterie de la moto (dissimulation sous la selle).
- **Stockage Local** : Partition LittleFS/NVS sur la Flash interne de l'ESP32. Capacité de stockage hors-ligne d'environ 4h30 de conduite continue avant synchronisation BLE.
- **Encapsulation (Potting)** : Le PCB est coulé dans une **résine époxy noire**. Cela garantit une étanchéité IP68, une résistance extrême aux vibrations des moteurs 2-temps, et agit comme une barrière physique anti-sabotage (*Tamper-Proof*).

*Note : Les fichiers de fabrication industriels (Gerber) sont disponibles dans `hardware/pcb_gerber/`.*

---

## 💻 Spécifications Logicielles (Software)

### 1. Firmware (ESP-IDF 5.3, ESP32-C3)
Un seul firmware : `hardware/firmware/` (le prototype Arduino `firmware_esp32/` a été retiré le 10/11/2026, aucun boîtier ne l'utilisait). Compilé par la CI à chaque modification ; voir `hardware/firmware/README.md` :
- **Accident figé et signé** : au choc ≥ 3 G, fenêtre ±30 s gardée hors de l'anneau et signée ECDSA P-256 ; conservée jusqu'à l'acquittement du serveur.
- **Chiffrement** : trames en AES-256-GCM, chaîne de Merkle SHA-256 ; clés propres à chaque boîtier.
- **Batterie interne** : enregistrement et Bluetooth continuent après la coupure du 12 V.
- **Ouverture** (résine + maillage de cuivre) : clé de signature détruite, accidents signés conservés.
- **Pile BLE** : Secure Connections avec code d'appairage unique par boîtier.

### 2. Application Mobile (PWA & Android TWA)
- Application Web Progressive ultra-rapide (Vite + Vanilla JS).
- Déployée en tant que *Trusted Web Activity* (TWA) sur le Google Play Store pour un poids plume (< 1 Mo).
- **Fonctionnalités** : Carnet d'entretien, Radar Social (GPS Temps Réel), Roadbooks, et "Guardian Angel" (Alerte SMS automatique).

### 3. Backend & Base de données (Firebase)
- Règles de sécurité `firestore.rules` strictes (OWASP A01).
- **Immuabilité** : Les trames télémétriques (`blackbox_telemetry`) sont indélébiles et inaltérables, garantissant leur recevabilité légale.

---

## 🔐 Sécurité & Conformité (Privacy by Design)

Le projet respecte les normes de sécurité de l'industrie :
- **Zero-Knowledge Encryption** : Firebase ne stocke jamais les clés de déchiffrement. Tout s'opère côté client via l'API Web Crypto.
- **RGPD & AI Act** : Les données de mobilité sont pseudonymisées. Les modules d'Intelligence Artificielle d'aide à la reconstitution d'accident agissent uniquement comme des outils d'assistance (aucune décision automatisée aveugle).
- **OWASP Top 10** : Protection contre les XSS et sécurisation des points d'accès API.

---

## 🚀 Modèles Économiques

L'absence de carte SIM dans le boîtier supprime totalement les coûts récurrents télécoms (OPEX = 0). 
Le modèle favorise :
1. **Le B2B SaaS** : Partenariats avec les assurances pour la fourniture du logiciel d'analyse de fraude et la distribution des boîtiers.
2. **Le B2C Freemium** : Vente du boîtier "one-shot" aux parents + Abonnement mensuel pure marge pour l'accès aux fonctions IA et à l'assistance juridique.

---
*Projet propulsé par Antigravity - 2026*
