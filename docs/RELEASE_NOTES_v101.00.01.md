# Notes de version — Mon50ccetMoi v101.00.01 🚀

Cette mise à jour apporte des améliorations majeures en termes de **sécurité**, de **fiabilité des données météo** et de **structuration** du projet pour la production.

---

## 🇫🇷 Français

### 🛡️ Sécurité & Confidentialité (Harding Production)
* **Durcissement des règles Firestore** : 
  * Accès restreint aux données sensibles : les collections `hazards` (dangers), `balades` et `battery_certificates` ne sont plus accessibles en lecture publique anonyme.
  * Partage temporaire sécurisé pour la fonction **Ange Gardien** (`guardian_sessions`) avec vérification automatique de la date d'expiration.
* **Sécurisation du dépôt de code** : 
  * Retrait définitif des fichiers locaux (`local.properties`) et des certificats de signature `.pem` du suivi Git public.
  * Stockage cryptographique ultra-sécurisé des clés API tierces (Météo-France, Revolut) via Google Cloud Secret Manager.

### 🌤️ Intégration Météo-France Officielle
* **Migration API** : Remplacement de l'ancien flux communautaire instable (OpenDataSoft) par l'**API Vigilance Météo-France officielle** pour des alertes météo en temps réel (vigilance rouge) précises et certifiées.
* **Proxy Cloud sécurisé** : Appels API masqués derrière une Cloud Function Firebase pour protéger la clé d'accès et économiser la batterie du smartphone.

### 📂 Organisation & Structure
* Nettoyage de la racine du projet avec classification des scripts de build/signature dans `/tools` et de la documentation dans `/docs`.
* Alignement global des indicateurs de versioning vers la **v101.00.01**.

---

## 🇬🇧 English

### 🛡️ Security & Privacy (Production Hardening)
* **Firestore Rules Hardening**:
  * Public read permissions removed on sensitive collections (`hazards`, `balades`, and `battery_certificates`).
  * Implemented strict verification on **Guardian Angel** (`guardian_sessions`) links with auto-expiration checks.
* **Git Repository Protection**:
  * Removed `local.properties` and `.pem` certificates from Git tracking.
  * Migrated external API credentials to Google Cloud Secret Manager.

### 🌤️ Official Météo-France Weather Integration
* **API Migration**: Switched to the official **Météo-France Vigilance API** for reliable real-time severe weather alerts.
* **Secure Cloud Proxy**: Wrapped calls inside a Cloud Function to protect credentials and optimize device network payload.
