Effectue un audit de sécurité complet selon les standards OWASP Top 10 (2021), OWASP ASVS v5.0.0 et NIST CSF 2.0 définis dans `.agents/AGENTS.md` :

1. **Sécurité Frontend (ASVS V1 & V3)** : Vérifie l'absence d'injections XSS (`.innerHTML` non protégé par `DOMPurify`), l'absence de `eval()`, et le bon enregistrement des actions dans `src/js/actionRegistry.js`.
2. **Contrôle d'Accès & Anti-Automatisation (ASVS V2, V4 & V8)** : Vérifie que chaque route API (`sovereign-core/server/index.js` et `functions/api/`) valide le token d'authentification, applique un rate-limiting transactionnel côté serveur et valide strictement les entrées (allowlists, regex, bornes numériques).
3. **Cryptographie & Preuves Forensiques (ASVS V11)** : Vérifie que les clés ne sont jamais codées en dur, que les IV AES sont aléatoires (`crypto.randomBytes` / `esp_fill_random`), et que la chaîne de Merkle `SHA-256` + signature `ECDSA P-256` est vérifiée.
4. Lance `npm test` pour valider les tests de sécurité (`dom-security.test.js`, `blackbox-core.test.js`, `sovereign-core.test.js`, `revolut-signature.test.js`).

