# Cahier des Charges Infrastructure — Migration Souveraine vers OVHcloud
**Projet :** `mon50ccetmoi.com` (Application Mobilité & Sécurité Routière 50cc/VSP + Boîtier Télémétrique IoT + Portail Assureurs B2B)  
**Architecture cible :** `mon50cc Sovereign Core v1.0` (100 % autonome, zéro dépendance Google / Firebase / AWS)  
**Localisation exigée :** France exclusivement (`Gravelines - GRA`, `Roubaix - RBX`, `Strasbourg - SBG`)

---

## 1. Présentation du Projet pour l'Équipe OVHcloud

**`mon50ccetmoi.com`** est une plateforme française de sécurité routière et de télémétrie certifiée dédiée aux conducteurs de cyclomoteurs (50cc) et de voitures sans permis (VSP), articulée autour de trois piliers :
1. **Une application Web/Mobile (PWA) temps réel** : Navigation GPS spécifique sans autoroute, radar communautaire de dangers routiers, mode cortège en temps réel, détection de chute (*Guardian Angel*) avec déclenchement automatique de SMS d'urgence, et copilote vocal IA (*Nexus Atlas*).
2. **Un boîtier matériel embarqué (« Boîte Noire Aragon REV3 » sur microcontrôleur ESP32-C3)** : Enregistrement forensique à 10 Hz des données d'accélération (IMU), GPS et tension véhicule, chiffrées en `AES-256-CBC` et signées matériellement en `ECDSA P-256` avec chaînage cryptographique de Merkle (`SHA-256`).
3. **Un Portail B2B Assureurs & Garages Partenaires** : Consultation et vérification cryptographique de l'intégrité des rapports de sinistre (preuves immuables à valeur probante).

**Objectif stratégique de la migration chez OVHcloud :**  
Remplacer intégralement notre ancienne infrastructure Google Firebase (Auth, Firestore, Cloud Functions, Hosting, Gemini) par notre nouvelle pile logicielle propriétaire **`sovereign-core`** hébergée à 100 % chez OVHcloud en France, afin de garantir une **souveraineté juridique totale (immunité Cloud Act US)**, la conformité **RGPD / CNIL**, et l'immuabilité légale des preuves d'assurance.

---

## 2. Liste Détaillée des Besoins par Brique Produit OVHcloud

### 2.1. Compute (Serveurs d'Application Backend & Temps Réel)
Notre cœur logiciel (`sovereign-core/server/index.js`) tourne sous **Node.js 22 LTS** (conteneurisé Docker) et gère simultanément les requêtes REST, l'authentification cryptographique (`scrypt` + JWT `ES256` + WebAuthn/FIDO2), la validation forensique des boîtiers (`ECDSA P-256` / `SHA-256`) et le serveur **WebSocket (`ws`)** pour la diffusion temps réel des dangers routiers.

* **Produit OVHcloud recherché** : **Public Cloud Instances** (gamme *General Purpose* `B3-8` ou *Compute Optimized* `C3-8` sous Debian 12 / Ubuntu 24.04 LTS) **ou** **Managed Kubernetes Service (MKS)**.
* **Exigences techniques** :
  * Support natif des connexions **WebSockets longue durée** (`wss://`) avec maintien de session sur le Load Balancer.
  * IP Failover (Floating IP) et intégration au réseau privé **vRack**.
  * Accélération matérielle processeur AES-NI / SHA pour la vérification rapide des chaînes de Merkle et signatures ECDSA des boîtiers.

### 2.2. Base de Données Relationnelle & Géospatiale (Remplacement de Firestore)
Notre schéma de données (`sovereign-core/db/schema.sql`) repose sur **PostgreSQL 16** avec des contraintes ACID strictes (grand livre de points `points_ledger`, quotas atomiques) et des requêtes géospatiales en temps réel (recherche de dangers routiers dans un rayon de 1 à 50 km via index `GIST`).

* **Produit OVHcloud recherché** : **OVHcloud Managed Databases for PostgreSQL**.
* **Exigences techniques impératives** :
  * Version **PostgreSQL 16+**.
  * Activation obligatoire des extensions **`postgis`** (géométrie `GEOGRAPHY(POINT, 4326)`, `ST_DWithin`, `ST_Distance`), **`pgcrypto`** et **`uuid-ossp`**.
  * Autorisation de créer des **Triggers PL/pgSQL personnalisés** (utilisés pour bloquer toute modification/suppression sur les tables forensiques `blackbox_reports` et `points_ledger`).
  * Connexion exclusivement via le réseau privé **vRack** (aucune exposition sur Internet public).
  * Sauvegardes automatisées avec **PITR (Point-In-Time Recovery)** sur 14 à 30 jours.

### 2.3. Stockage Objet Immuable WORM (Preuves Boîte Noire pour Assureurs)
Les rapports d'accidents issus des boîtiers ESP32-C3 (`sovereign-core/server/storage-worm.js`) doivent être conservés avec une garantie d'inaltérabilité opposable devant les compagnies d'assurance et les tribunaux.

* **Produit OVHcloud recherché** : **OVHcloud Object Storage (compatible API S3)** — Classe *High Performance* ou *Standard* (3-AZ sur Gravelines/Roubaix).
* **Exigences techniques impératives** :
  * Support de la fonctionnalité **S3 Object Lock en mode `COMPLIANCE` (WORM — Write Once, Read Many)** : une fois l'archive JSON/binaire du sinistre déposée, même un administrateur root ne peut ni la modifier ni la supprimer avant l'expiration de la période de rétention légale (ex. 5 ans).
  * Chiffrement côté serveur (**SSE-S3** ou **SSE-KMS**).
  * Politique de cycle de vie (*Lifecycle Policy*) vers **OVHcloud Cold Archive** au-delà de 12 mois pour optimiser les coûts d'archivage décennal.

### 2.4. Intelligence Artificielle Souveraine (Remplacement de Google Gemini)
L'application intègre un assistant vocal de conduite (*Nexus Atlas*), un diagnostic mécanique et un assistant juridique Code de la Route (*L'Arbitre de la Route*).

* **Produit OVHcloud recherché** : **OVHcloud AI Endpoints** (API serverless compatible OpenAI SDK).
* **Exigences techniques** :
  * Accès aux modèles européens **Mistral AI** (`Mistral-Small` / `Mistral-Large` / `Mistral-7B-Instruct`) hébergés dans les datacenters français d'OVHcloud.
  * Garantie contractuelle de **non-réutilisation des prompts/données** pour l'entraînement des modèles et absence totale de transit hors Union Européenne.

### 2.5. Sécurité, Gestion des Secrets (KMS) & Télécom (SMS SOS)
Conformément à nos exigences **OWASP ASVS v5.0.0** et **NIST CSF 2.0 (Tier 3)** :

| Besoin Métier | Produit OVHcloud Cible | Spécification Technique |
| :--- | :--- | :--- |
| **Coffre-fort de clés cryptographiques** | **OVHcloud KMS (OKMS)** | Stockage sécurisé de la clé privée JWT `ES256`, des clés secrètes Webhooks Revolut (HMAC), des clés API Météo-France / PISTE Légifrance, et des clés publiques matérielles des boîtiers ESP32-C3. |
| **Alertes SMS d'urgence Chute (SOS)** | **OVHcloud Telecom Pack SMS** | API HTTP d'envoi immédiat de SMS transactionnels prioritaires (24/7, faible latence, expéditeur alphanumérique personnalisé `MON50CC`) vers jusqu'à 5 proches en cas de chute détectée. |
| **Protection Périmétrique & CDN** | **OVHcloud Anti-DDoS VAC + Load Balancer** | Terminaison TLS 1.3, HSTS, protection L3/L4/L7, rate-limiting en amont de l'API. |
| **Journaux d'Audit & Conformité** | **OVHcloud Logs Data Platform** | Collecte centralisée des journaux d'accès et alertes de sécurité (`mod_logs`, tentatives d'effraction boîtier `tamper_detected`) avec rétention de 90 jours. |

---

## 3. Paliers de Dimensionnement Demandés pour le Devis OVHcloud

### Palier 1 : Lancement Souverain (1 000 à 10 000 utilisateurs actifs)
*Objectif : Maîtrise budgétaire maximale tout en validant toute la chaîne de souveraineté en production.*
* **Compute** : 2 × Instances Public Cloud `B3-8` (2 vCPU, 8 Go RAM, 50 Go NVMe) en Docker/Compose.
* **Load Balancer** : 1 × OVHcloud Load Balancer Small (support TLS 1.3 + WebSockets).
* **Base de données** : 1 × Managed PostgreSQL 16 + PostGIS (Plan *Essential*, 2 vCPU, 4 à 8 Go RAM, 80 Go SSD, backups quotidiens).
* **Stockage WORM** : 100 Go Object Storage S3 Standard avec *Object Lock (Compliance)* activé.
* **Réseau** : 1 × vRack gratuit + 1 IP Failover.
* **Services à l'usage** : AI Endpoints (Mistral) au token + Pack de 1 000 SMS OVH Telecom.

### Palier 2 : Montée en Charge Nationale & B2B Assureurs (10 000 à 100 000+ utilisateurs & flotte IoT)
*Objectif : Haute Disponibilité (SLA 99,95 %+), redondance Multi-AZ / Multi-Datacenter (`GRA` + `RBX`).*
* **Compute** : Cluster **OVHcloud Managed Kubernetes (MKS)** avec 3 à 6 nœuds `C3-16` en auto-scaling horizontal.
* **Base de données** : Managed PostgreSQL 16 + PostGIS en plan **Business / Production** (Haute Disponibilité 2 nœuds Maitre/Réplica avec bascule automatique + Read Replica pour le portail analytique B2B Assureurs).
* **Stockage WORM** : 1 To+ Object Storage S3 3-AZ avec réplication inter-régions (`GRA` ↔ `RBX`) + archivage automatique vers *Cold Archive*.
* **Sécurité & Observabilité** : **OKMS** (Key Management Service) + **Logs Data Platform** dédié.

---

## 4. Questions Précises à Valider avec l'Ingénieur Avant-Vente OVHcloud

1. **PostgreSQL Managé & PostGIS / Triggers** : Confirmer que l'offre *Managed Database for PostgreSQL v16* autorise bien l'activation de `CREATE EXTENSION postgis;` et `CREATE EXTENSION pgcrypto;`, ainsi que la création de `TRIGGER ... BEFORE UPDATE OR DELETE` par l'utilisateur applicatif.
2. **S3 Object Lock (Mode Compliance WORM)** : Confirmer la disponibilité de *S3 Object Lock* en mode `COMPLIANCE` sur la région choisie (`GRA` ou `RBX`) pour l'archivage probant des rapports de boîte noire.
3. **Load Balancer & WebSockets** : Confirmer la configuration du timeout d'inactivité WebSocket (`timeout tunnel`) sur l'OVHcloud Load Balancer pour nos flux temps réel (mode cortège et alertes dangers).
4. **AI Endpoints (Mistral AI)** : Confirmer les quotas par défaut (requêtes/minute) et la localisation physique en France des GPU opérant les modèles Mistral via *OVHcloud AI Endpoints*.
5. **Accompagnement Startup / Crédits Cloud** : Vérifier l'éligibilité du projet `mon50ccetmoi` au **Programme Startup OVHcloud** (crédits Public Cloud et accompagnement d'architecte solution).

