# CLAUDE.md — Guide d'Ingénierie & Contexte Maître (`mon50ccetmoi.com`)

Ce fichier est lu automatiquement par **Claude Code** au démarrage de chaque session. Il définit l'architecture, les commandes, les standards de sécurité (OWASP ASVS v5.0.0 / NIST CSF 2.0) et la feuille de route de migration souveraine vers **OVHcloud**.

---

## 1. Vue d'Ensemble du Projet & Modèle Économique

**`mon50ccetmoi.com`** est une plateforme française InsureTech & IoT dédiée à la sécurité routière des conducteurs de cyclomoteurs (50cc) et de Voitures Sans Permis (VSP).
* **Modèle 100 % par abonnement payant (post-essai gratuit)** : Abonnement B2C (4,99 €/mois ou 49,99 €/an), vente/location du boîtier télémétrique matériel **« Boîte Noire Aragon REV3 » (ESP32-C3)**, portail **B2B Assureurs** (déblocage de preuves de sinistre immuables WORM à 29 € HT/dossier) et réseau **Garages Partenaires** (29,90 €/mois).
* **Cap stratégique prioritaire (Souveraineté OVHcloud)** : Sortir intégralement des services américains (Google Cloud / Firebase) au profit de notre pile autonome propriétaire située dans `sovereign-core/` (Node.js 22 LTS + PostgreSQL 16/PostGIS + Stockage S3 Object Lock WORM + OVHcloud AI Endpoints Mistral).

---

## 2. Commandes Essentielles de Développement, Test et Déploiement

```bash
# 1. Développement & Compilation Frontend (Vite 8)
npm run dev                  # Serveur de développement local sur http://localhost:5000
npm run build                # Exécute scripts/sanitize-encoding.js (UTF-8) puis vite build -> dist/

# 2. Tests Unitaires & Qualité du Code
npm test                     # Exécute les 13 suites Jest (93 tests : sovereign-core, blackbox-core, dom-security, payments...)
npm run lint                 # Vérification statique ESLint 9

# 3. Pile Souveraine Autonome (OVHcloud Ready)
cd sovereign-core && docker compose up -d --build   # Lance PostgreSQL 16/PostGIS + API Node.js 22 + WORM storage
node sovereign-core/server/index.js                 # Démarrage direct du serveur souverain (port 8080)

# 4. Firmware Embarqué C ESP32-C3 ("Boîte Noire Aragon REV3")
npm run firmware:build       # Compilation ESP-IDF (idf.py -C hardware/firmware build)
npm run firmware:flash       # Flash série (idf.py -C hardware/firmware flash)
npm run firmware:provision   # Provisionnement clé unique par boîtier (hardware/provision_device.py)

# 5. Déploiement Production Actuel (GitHub Pages + Firebase Hosting transitoire)
git push origin HEAD:main    # Déploie sur GitHub Pages (xavierlechanu-netizen.github.io -> mon50ccetmoi.com)
git push repo2 HEAD:main     # Synchronise le dépôt miroir (com.mon50ccetmoi.tws.git)
npx firebase deploy --only hosting  # Déploie dist/ sur mon50ccetmoi.web.app
```

---

## 3. Architecture des Répertoires

| Répertoire / Fichier | Rôle et Responsabilité |
| :--- | :--- |
| `sovereign-core/` | **Nouvelle architecture 100 % autonome (Zéro Google/Firebase)** destinée à OVHcloud (`GRA`/`RBX`). |
| `├── server/index.js` | Serveur HTTP REST (`node:http`) : auth, upload télémétrie boîte noire, webhook Revolut, RGPD, santé `/api/v1/health`. ⚠️ **Prototype** : données en mémoire (`Map`), PostgreSQL pas encore branché, pas de WebSockets ni de routes hazards (voir `docs/AUDIT_2026-11.md`, Phase 3). |
| `├── server/crypto-auth.js` | Hachage mot de passe `scrypt` (N=16384, sel 32o, timing-safe) et jetons JWT asymétriques `ES256` (ECDSA P-256). |
| `├── server/storage-worm.js` | Stockage forensique immuable WORM (`chmod 0o444`, empreinte `SHA-256`, compatible S3 Object Lock Compliance). |
| `├── db/schema.sql` | Schéma PostgreSQL 16 + PostGIS (`GEOGRAPHY(POINT, 4326)`, index `GIST`) + triggers PL/pgSQL d'immuabilité forensique. |
| `├── client/sovereign-sdk.js` | SDK client léger (`window.SovereignClient`) destiné à remplacer le SDK Firebase dans `src/js/`. |
| `└── CAHIER_DES_CHARGES_OVHCLOUD.md` | Spécifications complètes pour l'équipe avant-vente / Programme Startup OVHcloud. |
| `hardware/firmware/` | **Firmware C ESP-IDF v5.x pour microcontrôleur ESP32-C3 (Boîte Noire REV3)**. |
| `├── main/main.c` | Tâche temps réel 10 Hz (`telemetry_task`), acquisition IMU/GPS/ADC, zeroization en 2 étapes, transmission BLE. |
| `├── components/blackbox/` | Stockage circulaire NVS/Flash, chiffrement `AES-256-GCM` (nonce 12 o aléatoire TRNG), signature `ECDSA P-256`, chaîne de Merkle `SHA-256`. |
| `├── components/tamper/` | Détection d'effraction physique par interruption `IRAM_ATTR` (< 1 µs) avec effacement RAM immédiat puis purge NVS hors ISR. |
| `└── idf_stubs/` | En-têtes de compatibilité ESP-IDF/FreeRTOS pour l'analyse statique `clangd` (0 erreur / 0 warning). |
| `src/` | **Frontend Web & PWA Multi-Pages (Vite)** compilé vers `dist/`. |
| `├── app.html` | Cockpit principal GPS sans autoroute, HUD, radar dangers, mode cortège, *Guardian Angel*, copilote vocal *Nexus Atlas*. |
| `├── b2b-assureur.html` | Portail B2B pour compagnies d'assurance (consultation et vérification cryptographique des rapports de sinistres). |
| `├── admin-blackbox.html` | Console d'administration de la flotte de boîtiers Boîte Noire et audit de la chaîne de Merkle. |
| `├── js/app-core.js` | Initialisation de l'application, état global partagé (`window.map`, `window.currentPosition`, etc.), géolocalisation. |
| `├── js/app-map.js` | Contrôleur cartographique : itinéraires, dangers, garages, radars (via l'API `google.maps` souveraine ci-dessous). |
| `├── js/gmaps-compat.js` | **Carte souveraine, zéro Google** : installe `window.google.maps` (Map, Marker, InfoWindow, Polyline, Geocoder, DirectionsService, Autocomplete…) sur Leaflet + fond Plan IGN. `window.map` est une carte Leaflet. |
| `├── js/map-engine.js` | Services sans clé : itinéraire IGN `bdtopo-pgr` **autoroutes interdites** et durées plafonnées à 45 km/h, géocodage/autocomplétion IGN, garages OpenStreetMap (Overpass, 2 serveurs). |
| `├── public/vendor/leaflet/` | Leaflet 1.9.4 auto-hébergé (plus de CDN unpkg). |
| `├── js/app-features.js` | Fonctionnalités métier (Guardian Angel, roadbooks, météo vigilance, carnet d'entretien, points). |
| `├── js/app-ui.js` | Interface utilisateur, démarrage cinématique (`runCinematicStartup`), mode parking, alerte chute SOS. |
| `├── js/i18n.js` | Système multilingue (`window.t`, `window.updateI18N`, `window.updateUILabels`). |
| `├── js/actionRegistry.js` | Registre d'actions ES Modules (`registerAction`, `getAction`) pour le délégateur d'événements sécurisé. |
| `└── js/dom-security.js` | Bouclier anti-XSS Zero-Trust (surcharge `.innerHTML` via `DOMPurify` et délégation d'événements `data-action`). |
| `functions/` | **Backend Cloud Functions transitoire (Node.js 22)** en cours de remplacement par `sovereign-core/`. |
| `tests/` | **Suites de tests unitaires Jest** (`sovereign-core.test.js`, `blackbox-core.test.js`, `dom-security.test.js`, etc.). |

---

## 4. Règles d'Or Techniques & Sécurité (À respecter impérativement)

L'ensemble des règles de sécurité détaillées dans `.agents/AGENTS.md` et `NEXUS_ATLAS_CONTEXT.md` s'appliquent :

1. **Conformité OWASP ASVS v5.0.0 & Anti-XSS** :
   * Ne jamais injecter de HTML non assaini. `src/js/dom-security.js` surcharge `.innerHTML` avec `DOMPurify`.
   * Interdiction absolue de `eval()` ou `new Function()`.
   * Utiliser les attributs `data-action="nomFonction()"` couplés à `registerAction('nomFonction', nomFonction)` dans `src/js/actionRegistry.js`.
2. **Portée ES Modules (`<script type="module">`) dans `src/js/`** :
   * Les modules `app-core.js`, `app-map.js`, `app-features.js` et `app-ui.js` partagent l'état global sur `window` (`window.map`, `window.geocoder`, `window.currentPosition`, `window.hazardMarkers`, `window.officialPoiMarkers`, `window.isParkingMode`, `window.parkingStartPos`, `window.perfStartTime`, `window.isPerfTracking`, `window.isGuardianPromptActive`, `window.lastMovementTime`).
   * Ne jamais redéclarer ces variables avec un `let` local dans `app-core.js`, sous peine de casser la visibilité inter-modules en mode strict ESM.
3. **Sécurité Embarquée ESP32-C3 (`hardware/firmware/`)** :
   * **Interdiction d'opérations Flash/NVS dans une ISR** : Toute routine d'interruption (`IRAM_ATTR` dans `tamper.c`) ne doit manipuler que de la RAM volatile (`memset` sur pointeurs volatiles + drapeau `s_tamper_tripped`). L'effacement NVS (`blackbox_storage_zeroize_keys()`) est exécuté au réveil de `telemetry_task` dans `main.c`.
   * Aucune clé AES ou ECDSA en dur dans le code source : provisionnement exclusivement en NVS chiffré par appareil.
4. **Cartographie (zéro Google)** :
   * Ne jamais réintroduire le SDK Google Maps ni de clé Google : passer par `gmaps-compat.js` / `map-engine.js`, ou directement Leaflet.
   * Les itinéraires doivent toujours interdire les autoroutes (50 cc / VSP, Code de la route R421-2). Aucun repli vers un service qui ne sait pas les exclure (ex. serveur OSRM public).
5. **Encodage UTF-8 et Cache Service Worker** :
   * Toujours conserver l'encodage **UTF-8 sans BOM** (le script `node scripts/sanitize-encoding.js` est exécuté automatiquement en `prebuild`).
   * À chaque modification des bundles critiques du frontend, incrémenter `CACHE_NAME` dans `src/public/sw.js` avant `npm run build`.

---

## 5. Prochaines Étapes pour Claude Code (Roadmap Migration OVHcloud)

> Audit complet et plan détaillé (priorités sécurité avant la migration) : `docs/AUDIT_2026-11.md`.

1. **Phase A — Branchement progressif du Frontend sur `SovereignClient`** :
   * Connecter `src/js/auth.js`, `src/js/database.js` et `src/js/blackbox-ble.js` au SDK `sovereign-core/client/sovereign-sdk.js` (avec bascule par variable de configuration `CONFIG.BACKEND_MODE = "SOVEREIGN" | "FIREBASE"`).
2. **Phase B — Intégration OVHcloud AI Endpoints (Mistral AI)** :
   * Ajouter la route `/api/v1/ai/copilot` dans `sovereign-core/server/index.js` connectée à l'API Mistral d'OVHcloud pour remplacer `nexus-atlas-gemini.js`.
3. **Phase C — Déploiement sur l'infrastructure OVHcloud (`GRA` / `RBX`)** :
   * Provisionner l'instance Public Cloud + Managed PostgreSQL 16 (PostGIS) + S3 Object Lock WORM dès validation des crédits du Programme Startup OVHcloud.

