# Architecture Souveraine `sovereign-core` — mon50ccetmoi.com

Ce répertoire tiers isole le socle logiciel **100 % autonome et indépendant de Google / Firebase** conçu pour être déployé sur votre futur serveur **OVHcloud**.

## Structure du Répertoire

- [`package.json`](./package.json) : Manifeste isolé sans aucune dépendance `firebase`, `firebase-admin` ni `googleapis`.
- [`db/schema.sql`](./db/schema.sql) : Schéma relationnel et géospatial **PostgreSQL 16 + PostGIS** remplaçant Firestore et `firestore.rules` (inclut des triggers SQL d'immuabilité stricte `prevent_modification_or_deletion()` sur le Grand Livre de points et les preuves de la Boîte Noire).
- [`server/crypto-auth.js`](./server/crypto-auth.js) : Moteur d'authentification souverain en pur `node:crypto` (hachage `scrypt` mémoire-dur + jetons **JWT asymétriques `ES256` / ECDSA P-256**), remplaçant Firebase Auth.
- [`server/storage-worm.js`](./server/storage-worm.js) : Coffre d'archivage forensique **WORM** (*Write-Once-Read-Many*) scellé par empreinte `SHA-256` (ISO/IEC 27037), remplaçant Google Cloud Storage.
- [`server/index.js`](./server/index.js) : Serveur HTTP/REST Node.js 22 autonome appliquant les en-têtes de sécurité **OWASP ASVS v5.0.0** (CSP purgé de tout domaine Google) et exposant les routes d'authentification, de télémétrie Boîte Noire REV3, de webhooks Revolut et de purge RGPD Art. 17.
- [`client/sovereign-sdk.js`](./client/sovereign-sdk.js) : Client JavaScript léger (< 3 Ko) remplaçant le SDK client Firebase dans la PWA et l'application mobile Capacitor.
- [`docker-compose.yml`](./docker-compose.yml) : Orchestration prête pour Debian 12 / Ubuntu 24.04 sur OVHcloud (PostgreSQL 16 + PostGIS + Redis 7 + API Node.js 22).

