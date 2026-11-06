Accompagne la migration d'un module de `src/js/` ou d'une Cloud Function de `functions/api/` vers l'architecture souveraine `sovereign-core/` (hébergement OVHcloud sans dépendance Google/Firebase) :

1. Analyse les appels Firebase (`auth`, `db.collection(...)`, `httpsCallable(...)`) dans le module cible.
2. Vérifie les tables correspondantes dans `sovereign-core/db/schema.sql` (PostgreSQL 16 + PostGIS + triggers forensiques).
3. Implémente ou complète la route REST / WebSocket correspondante dans `sovereign-core/server/index.js` en respectant :
   - L'authentification par jeton Bearer `ES256` (`sovereign-core/server/crypto-auth.js`).
   - Les transactions SQL ACID (`BEGIN` / `COMMIT` / `ROLLBACK`) pour les opérations sensibles (points, quotas, SOS).
   - Le stockage WORM (`sovereign-core/server/storage-worm.js`) pour les preuves de sinistre.
4. Ajoute la méthode cliente dans `sovereign-core/client/sovereign-sdk.js` et son test unitaire dans `tests/sovereign-core.test.js`.
5. Exécute `npm test` pour valider le non-régression.

