# Directives de Sécurité (Nexus Atlas) - Projet mon50ccetmoi

Lors de la rédaction, de la modification ou de l'audit de code pour ce projet, l'agent doit **strictement** appliquer les principes de sécurité de l'OWASP Top 10 (édition 2021) ET de l'OWASP ASVS v5.0.0 (Application Security Verification Standard) que l'utilisateur a définis.

## Principes OWASP Top 10 à appliquer :
- **A01 (Contrôles d'accès défaillants)** : 
  - Ne jamais faire confiance au côté client pour l'accès aux données.
  - Toujours utiliser `firestore.rules` pour verrouiller l'accès aux documents (`request.auth.uid` doit être vérifié).
- **A02 (Défaillances cryptographiques)** : 
  - Ne jamais coder de mots de passe en dur ou les stocker en clair. 
  - Firebase Auth doit gérer les mots de passe.
- **A03 (Injections / XSS / SQL)** : 
  - Firebase empêche naturellement le SQL Injection.
  - Côté front-end, éviter d'utiliser `innerHTML` avec des variables dynamiques non fiables pour prévenir les failles XSS. Préférer `textContent` ou s'assurer que la donnée est assainie.
- **A05 (Mauvaise configuration)** : 
  - Bloquer les accès publics par défaut sur les bases de données.
- **A11 (Qualité du code / DoS)** : 
  - Éviter les requêtes lourdes ou infinies sur Firestore pour éviter le Déni de Service et la facturation excessive.
  - Garder le code Javascript propre, modulaire et factorisé.

## Standard OWASP ASVS v5.0.0 (Vérification Applicative) :
L'ASVS fournit les **exigences granulaires** de vérification de sécurité. Chaque exigence suit le format `v5.0.0-<chapitre>.<section>.<exigence>`. L'agent doit appliquer les chapitres suivants selon le contexte du code modifié :

### V1 — Encodage et Assainissement (Encoding & Sanitization)
- **v5.0.0-1.2.1** : Tout contenu HTML dynamique dans les réponses HTTP doit utiliser un encodage de sortie contextuel (HTML entities pour le contenu, attributs, etc.).
- **v5.0.0-1.2.3** : Lors de la construction dynamique de contenu JavaScript (y compris JSON), utiliser un encodage de sortie adapté pour éviter les injections JS/JSON.
- **v5.0.0-1.2.4** : Les requêtes Firestore doivent utiliser les méthodes SDK paramétrées (`.where()`, `.doc()`) et ne jamais construire de chemins de collection à partir d'entrées non assainies.
- **v5.0.0-1.3.1** : Tout HTML provenant de WYSIWYG ou de l'IA Gemini doit être assaini via DOMPurify ou équivalent avant injection dans le DOM.
- **v5.0.0-1.3.2** : Interdire `eval()` et toute exécution de code dynamique. Aucune exception.

### V2 — Validation et Logique Métier
- **v5.0.0-2.2.1** : Toute entrée utilisateur doit être validée positivement (allowlist de valeurs, patterns, plages). Pour les BVC Points, limites de score et montants : validation côté serveur obligatoire.
- **v5.0.0-2.2.2** : La validation d'entrée côté client (localStorage, formulaires) n'est PAS un contrôle de sécurité. La validation DOIT être répliquée côté serveur (Firestore Rules ou Cloud Functions).
- **v5.0.0-2.3.3** : Les opérations métier critiques (paiement Revolut, attribution BVC Points, déblocage de rapports) doivent utiliser des **transactions Firestore** ou des **batched writes** pour garantir l'atomicité.
- **v5.0.0-2.4.1** : Des contrôles anti-automatisation SERVEUR doivent exister pour toute fonction exposée à l'abus (signalement hazards, appels Gemini, création de commandes Revolut). Le rate limiting `localStorage` seul est insuffisant.

### V3 — Sécurité Frontend Web
- **v5.0.0-3.2.2** : Le contenu textuel doit utiliser `createTextNode()` ou `textContent` au lieu de `innerHTML` pour empêcher l'exécution non intentionnelle de HTML/JS.
- **v5.0.0-3.3.1** : Tous les cookies doivent avoir l'attribut `Secure`.
- **v5.0.0-3.4.1** : Le header `Strict-Transport-Security` (HSTS) doit être présent sur toutes les réponses HTTP, avec un `max-age` d'au moins 1 an.
- **v5.0.0-3.4.2** : Les headers CORS (`Access-Control-Allow-Origin`) doivent être des valeurs fixes (`https://mon50ccetmoi.com`) et jamais `*` pour les endpoints sensibles.
- **v5.0.0-3.4.4** : Le header `X-Content-Type-Options: nosniff` doit être présent (déjà configuré dans `firebase.json`).
- **v5.0.0-3.5.1** : Les requêtes sensibles (paiement, suppression, écriture Firestore) doivent utiliser des anti-forgery tokens ou des headers non-CORS-safelisted pour se protéger contre le CSRF.

### V4 — API et Services Web
- **v5.0.0-4.1.1** : Toute réponse HTTP avec un corps doit contenir un `Content-Type` avec charset (déjà configuré dans `firebase.json` pour HTML/JS).
- Toutes les Cloud Functions doivent vérifier le token Firebase Auth via `verifyAuthToken()` ou `request.auth.uid` (onCall). Aucun endpoint sensible sans authentification.

### V6 — Authentification
- Utiliser exclusivement Firebase Auth (Email/Password, Google Sign-In, FIDO2/WebAuthn).
- Les sessions doivent expirer après inactivité. Le token Firebase ID expire naturellement après 1h — s'assurer que le refresh token est géré.
- Pour les Passkeys FIDO2, le challenge doit être éphémère et supprimé après vérification (`fido_challenges`).

### V7 — Gestion de Session
- Les tokens de session (Firebase ID tokens) ne doivent jamais être stockés dans `localStorage` si le contexte nécessite une protection XSS renforcée. Préférer les cookies `HttpOnly` + `Secure` + `SameSite=Strict` pour les sessions critiques (portail assureur B2B).

### V8 — Autorisation
- **v5.0.0-8.x** : L'autorisation doit être appliquée côté serveur (Firestore Rules + Cloud Functions). Les vérifications client-side sont cosmétiques uniquement.
- Chaque collection Firestore doit avoir une règle explicite. Les règles `allow write: if true` sont strictement interdites en production.
- Le pattern `isOwner(userId)` / `isAdmin()` doit être systématiquement utilisé dans les Firestore Rules.

### V9 — Tokens Auto-contenus
- Les custom tokens Firebase (utilisés pour FIDO2 et IoT FDO) doivent avoir une durée de vie limitée et contenir des claims personnalisés pour le contrôle d'accès (`is_iot_device`, etc.).

### V11 — Cryptographie
- **v5.0.0-11.x** : Toute clé de chiffrement AES-256 doit être unique par appareil/utilisateur et JAMAIS hardcodée dans le code source ou le firmware.
- Les IV (Initialization Vectors) pour AES-CBC doivent être aléatoires et uniques pour chaque opération de chiffrement. Un IV statique `{0}` est strictement interdit.
- Utiliser les TRNG matériels (`esp_random()` sur ESP32, `crypto.getRandomValues()` en JS) pour la génération de valeurs aléatoires cryptographiques.
- Les clés doivent être stockées dans des zones sécurisées : NVS chiffré (ESP32), Firebase Secret Manager (Cloud), Web Crypto API (client).

### V12 — Communications Sécurisées
- Tout le trafic entre le client et Firebase doit transiter en TLS 1.2+ (garanti par Firebase Hosting).
- Le trafic BLE entre le boîtier ESP32 et le smartphone doit utiliser le Secure Connections Pairing (LE Secure Connections) avec bonding.

### V13 — Configuration
- **v5.0.0-13.x** : Les clés API (Gemini, Revolut, Météo-France, PISTE) doivent TOUJOURS être stockées dans Firebase Secret Manager et accédées via `defineSecret()`. Jamais en clair dans le code.
- Les environnements de développement, test et production doivent être strictement séparés (bases Firestore, projets Firebase, clés API distinctes).

### V14 — Protection des Données
- Les données personnelles (nom, email, téléphone, localisation) doivent être pseudonymisées en base.
- Les données de santé (rythme cardiaque, biométrie) doivent rester en 100% local (Edge Computing) et ne JAMAIS être téléversées sur les serveurs.
- La suppression de compte (RGPD Art. 17) doit purger TOUTES les collections Firestore associées à l'utilisateur, pas uniquement `users/{uid}`.

### V15 — Architecture et Code Sécurisé
- **v5.0.0-15.x** : L'architecture doit suivre le principe de moindre privilège. Les Cloud Functions écrivent via Admin SDK dans les collections protégées par `allow write: if false`.
- Le code JavaScript doit être modulaire et factorisé. Chaque module doit avoir une responsabilité unique.

### V16 — Journalisation et Gestion d'Erreurs
- **v5.0.0-16.x** : Les erreurs Firebase, réseau et BLE doivent être tracées avec `console.error` et des tags clairs (`[BLE]`, `[Revolut]`, `[FIDO]`, etc.).
- Les logs ne doivent JAMAIS contenir de données personnelles (UIDs tronqués autorisés, emails/téléphones interdits).
- Les erreurs ne doivent jamais exposer de stack traces ou de détails d'implémentation au client.

## Principes CIS (Center for Internet Security) v8.1 à appliquer :
- **Control 3 (Data Protection)** : Chiffrer les données sensibles au repos et en transit (TLS, Firebase Encryption). Appliquer le principe du moindre privilège.
- **Control 4 (Secure Configuration)** : Utiliser des configurations sécurisées par défaut, modifier ou désactiver tous les comptes/services inutiles.
- **Control 6 (Access Control)** : Implémenter un contrôle d'accès rigoureux basé sur les rôles (RBAC) via Firebase Auth.
- **Control 16 (Application Software Security)** : 
  - **16.8** : Séparation stricte des environnements de développement, test, et production.
  - **16.10** : Architecture "Secure by Design" (validation rigoureuse de toutes les entrées utilisateurs, "never trust user input").
  - **16.11** : Utilisation exclusive de librairies de sécurité approuvées et maintenues.

## NIST Cybersecurity Framework 2.0 (CSWP 29) à appliquer :
Le NIST CSF 2.0 (CSWP 29, publié le 26 février 2024, DOI: 10.6028/NIST.CSWP.29) organise la gestion du risque cyber en **6 fonctions / 22 catégories / 106 sous-catégories**. L'agent doit appliquer les sous-catégories suivantes selon le contexte du code modifié. Chaque sous-catégorie utilise l'identifiant officiel NIST (`<Fonction>.<Catégorie>-<Numéro>`).

### Positionnement Tier du projet :
Le projet `mon50ccetmoi` vise le **Tier 3 (Repeatable)** : Politiques de sécurité formellement approuvées, pratiques régulièrement mises à jour, information de sécurité partagée de manière routinière dans l'équipe. Le Tier 4 (Adaptive) est un objectif à long terme.

### GV — GOUVERNER (Govern)
*La stratégie, les attentes et la politique de gestion des risques cyber sont établies, communiquées et surveillées.*

- **GV.OC — Contexte Organisationnel** :
  - **GV.OC-01** : La mission organisationnelle (`mon50ccetmoi` = sécurité routière des conducteurs de 50cc/VSP + télémétrie assurance) guide toutes les décisions de gestion du risque cyber. La sécurité des données de sinistre est prioritaire.
  - **GV.OC-02** : Les parties prenantes sont : utilisateurs conducteurs, assureurs B2B (portail), garages partenaires, CNIL (régulateur). Leurs attentes respectives en matière de sécurité sont documentées dans `NEXUS_ATLAS_CONTEXT.md`.
  - **GV.OC-03** : Les obligations légales sont : RGPD (UE), CCPA/CPRA (US), PIPL (Chine), AI Act (UE), Code de la Route (France). Gérées dans `conformite_globale_mon50ccetmoi.md`.
  - **GV.OC-04** : Les services critiques dont les parties prenantes dépendent : authentification Firebase, API Revolut (paiement), API Gemini (IA), télémétrie BLE, signalement hazards, SOS d'urgence.
  - **GV.OC-05** : Les dépendances externes du projet : Firebase (Auth, Firestore, Hosting, Functions), Google Maps, Revolut API, Météo-France API, PISTE/Légifrance API.
- **GV.RM — Stratégie de Gestion des Risques** :
  - **GV.RM-01** : Objectifs de risque établis : protéger l'intégrité des preuves de sinistre (Zero-Knowledge), garantir la disponibilité du SOS, prévenir la fraude aux BVC Points.
  - **GV.RM-02** : Tolérance au risque : AUCUNE tolérance sur la compromission crypto (AES-256), faible tolérance sur les interruptions de service, tolérance moyenne sur les fonctionnalités communautaires (hazards, crews).
  - **GV.RM-06** : Méthode de priorisation : matrice risque/impact documentée dans l'audit technique (septembre 2026). Les vulnérabilités sont catégorisées CRITIQUE / ÉLEVÉ / MOYEN / FAIBLE.
- **GV.RR — Rôles, Responsabilités et Autorités** :
  - **GV.RR-01** : Le fondateur est responsable et redevable de la sécurité cyber. L'agent IA (Nexus Atlas) est un outil d'assistance — aucune décision de sécurité automatisée sans supervision humaine.
  - **GV.RR-02** : Le code de sécurité critique (`firestore.rules`, `functions/index.js`, firmware crypto) ne doit être modifié qu'après revue complète des implications. Toute modification de `firestore.rules` requiert une analyse d'impact.
- **GV.PO — Politique** :
  - **GV.PO-01** : La politique de sécurité est ce fichier `AGENTS.md` + `NEXUS_ATLAS_CONTEXT.md`, appliquée automatiquement par l'agent IA et manuellement par les développeurs.
  - **GV.PO-02** : La politique est révisée à chaque audit technique et mise à jour pour refléter les nouveaux standards (ASVS 5.0.0, CSF 2.0).
- **GV.OV — Supervision** :
  - **GV.OV-01** : Les résultats de l'audit (septembre 2026) sont revus pour ajuster la stratégie : priorisation de la refonte télémétrie, fermeture des failles d'accès.
  - **GV.OV-03** : La performance de gestion des risques est évaluée via le suivi du plan d'action en 4 phases (urgences → architecture → hardware → dette technique).
- **GV.SC — Gestion du Risque Supply Chain Cyber** :
  - **GV.SC-01** : Programme C-SCRM établi : audit périodique des dépendances NPM (`npm audit`), vérification des fournisseurs hardware (Espressif, Quectel).
  - **GV.SC-04** : Fournisseurs critiques identifiés et priorisés : Firebase/GCP (infrastructure), Revolut (paiement), Espressif (ESP32), Quectel (GPS).
  - **GV.SC-07** : Les risques des fournisseurs sont suivis : disponibilité Firebase (SLA 99.95%), conformité Revolut PSD2, vulnérabilités ESP-IDF (CVE tracking).
  - **GV.SC-09** : Pratiques de sécurité supply chain intégrées au cycle de vie : `package-lock.json` versionné, firmware signé avant déploiement OTA.

### ID — IDENTIFIER (Identify)
*Les risques cyber actuels de l'organisation sont compris.*

- **ID.AM — Gestion des Actifs** :
  - **ID.AM-01** : Inventaire matériel : Boîtier ESP32-C3, module GPS Quectel L76-LB, IMU MPU6050, PCB custom (Gerber), connecteur OBD-II.
  - **ID.AM-02** : Inventaire logiciel : 26 pages HTML, ~59 modules JS, 12+ Cloud Functions, firmware Arduino (`blackbox_ble.ino`), `firestore.rules` (442 lignes).
  - **ID.AM-05** : Actifs priorisés par criticité : (1) Clés AES-256, (2) `firestore.rules`, (3) Cloud Functions paiement/auth, (4) firmware crypto, (5) données utilisateur.
  - **ID.AM-07** : Inventaire données : 30+ collections Firestore, 18+ types de documents, partitions NVS/LittleFS (ESP32), preuves chiffrées Zero-Knowledge.
  - **ID.AM-08** : Cycle de vie : les données éphémères (`hazards`, `presence`, `moods`, `fido_challenges`) doivent avoir un TTL Firestore configuré. Les données probantes (`blackbox_reports`) sont immutables et archivées indéfiniment.
- **ID.RA — Évaluation des Risques** :
  - **ID.RA-01** : Vulnérabilités identifiées, validées et enregistrées dans l'audit technique (F-1 à F-7, H-1 à H-9, CF-1 à CF-5).
  - **ID.RA-04** : Impacts et probabilités documentés : la clé AES hardcodée (H-1) a un impact CRITIQUE (compromet toute la chaîne de confiance assurance) et une probabilité ÉLEVÉE (extractible par dump Flash).
  - **ID.RA-05** : Risques utilisés pour prioriser le plan d'action en 4 phases : quick wins (semaine 1-2), architecture (semaine 3-6), hardware (semaine 7-12), dette technique (continu).
  - **ID.RA-06** : Réponses aux risques choisies : atténuer (corriger le code), transférer (assurance cyber), accepter (limites physiques du parc 50cc ancien).
  - **ID.RA-09** : L'authenticité du firmware ESP32 doit être vérifiée via Secure Boot avant déploiement. Les bibliothèques NPM doivent être vérifiées via `npm audit` et lockfile.
- **ID.IM — Amélioration Continue** :
  - **ID.IM-01** : Les améliorations issues de l'audit (septembre 2026) sont intégrées dans le backlog et le `CHANGELOG.md`.
  - **ID.IM-04** : Les plans de réponse aux incidents sont documentés (suppression de compte RGPD, révocation FIDO2, kill-switch hardware).

### PR — PROTÉGER (Protect)
*Les mesures de sauvegarde pour gérer les risques cyber sont en place.*

- **PR.AA — Gestion d'Identité, Authentification et Contrôle d'Accès** :
  - **PR.AA-01** : Identités et credentials gérées exclusivement par Firebase Auth (Email/Password, Google Sign-In, FIDO2/WebAuthn). Aucun système d'auth maison.
  - **PR.AA-03** : Authentification multi-facteur : Firebase Auth + Passkeys FIDO2 (biométrie). Les challenges FIDO2 sont éphémères (`fido_challenges`, supprimés après vérification).
  - **PR.AA-05** : Contrôle d'accès basé sur `isOwner(userId)` / `isAdmin()` dans les Firestore Rules. Principe de moindre privilège : `allow write: if false` sur les collections protégées, écriture via Admin SDK uniquement.
  - **PR.AA-06** : Accès physique au boîtier protégé par résine d'enrobage, tamper mesh, et zeroization des clés AES en cas d'intrusion détectée.
- **PR.AT — Sensibilisation et Formation** :
  - **PR.AT-01** : `NEXUS_ATLAS_CONTEXT.md` et `AGENTS.md` servent de guide de sécurité pour tout intervenant (humain ou IA).
  - **PR.AT-02** : Les règles ASVS, CSF, CIS, et OWASP Top 10 constituent la formation spécialisée automatisée de l'agent IA.
- **PR.DS — Sécurité des Données** :
  - **PR.DS-01** : Données au repos chiffrées : AES-256-CBC (boîtier, clé unique par device via NVS), Firebase Server-Side Encryption (cloud), IV aléatoire par opération.
  - **PR.DS-02** : Données en transit protégées : TLS 1.2+ (Firebase Hosting → navigateur), BLE Secure Connections LE (boîtier → smartphone).
  - **PR.DS-10** : Données en utilisation protégées : les données de santé (rythme cardiaque, biométrie) restent en 100% local (Edge Computing), jamais téléversées sur les serveurs.
  - **PR.DS-11** : Backups : exports Firestore quotidiens vers Cloud Storage, firmware ESP32 avec partition OTA de fallback.
- **PR.PS — Sécurité de la Plateforme** :
  - **PR.PS-01** : Configuration management : `firebase.json` (headers sécurité), `firestore.rules` (contrôle d'accès), `package-lock.json` (dépendances verrouillées).
  - **PR.PS-02** : Logiciels maintenus : Node.js 22 pour Cloud Functions, ESP-IDF/Arduino Core à jour, `npm audit` périodique.
  - **PR.PS-04** : Logs générés avec tags explicites (`[BLE]`, `[Revolut]`, `[FIDO]`, `[Rate Limit]`) via `console.log`/`console.error` dans Cloud Functions.
  - **PR.PS-05** : ESP32 : Secure Boot empêche l'exécution de firmware non signé. Flash Encryption empêche la lecture de la Flash.
  - **PR.PS-06** : Développement sécurisé : revue de code via Nexus Atlas (ce fichier), validation OWASP ASVS 5.0.0, tests de sécurité avant déploiement.
- **PR.IR — Résilience de l'Infrastructure Technologique** :
  - **PR.IR-01** : Réseaux protégés : Firebase Hosting avec HSTS, CORS fixe (`https://mon50ccetmoi.com`), CSP headers. BLE avec Secure Connections Pairing.
  - **PR.IR-02** : Protection environnementale du boîtier : boîtier IP54 minimum, TVS SMAJ18A (surtension), régulateur buck LMR16006 (12V→3.3V), protection thermique.
  - **PR.IR-03** : Mécanismes de résilience : Watchdog Timer hardware (ESP32), Deep Sleep en cas d'inactivité, buffer LittleFS pour survie en déconnexion BLE.
  - **PR.IR-04** : Capacité de ressources : `limit()` obligatoire sur toutes les requêtes Firestore (prévention DoS), batching des trames télémétrie (50 max), rate limiting serveur sur les endpoints sensibles.

### DE — DÉTECTER (Detect)
*Les attaques et compromissions cyber possibles sont découvertes et analysées.*

- **DE.CM — Surveillance Continue** :
  - **DE.CM-01** : Réseaux surveillés : les Cloud Functions loggent les événements anormaux (échecs auth, webhooks invalides, rate limit excédé).
  - **DE.CM-02** : Environnement physique surveillé : tamper detection (photodiode/mesh) signale toute tentative d'ouverture du boîtier ESP32.
  - **DE.CM-03** : Activité utilisateur surveillée : le rate limiter Gemini (`rate_limits` collection) détecte les abus d'appels IA. Le rate limiter hazards détecte le spam de signalements.
  - **DE.CM-06** : Services externes surveillés : webhooks Revolut avec vérification HMAC, état API Gemini/Météo-France.
  - **DE.CM-09** : Matériel surveillé : le système anti-vol (`anti-theft.js`) détecte les mouvements anormaux via accéléromètre. Diagnostic batterie et tamper state via BLE.
- **DE.AE — Analyse d'Événements Adverses** :
  - **DE.AE-02** : Les événements adverses sont analysés : échecs d'authentification répétés (`verifyAuthToken()` retourne null), webhooks Revolut avec signature invalide.
  - **DE.AE-03** : Corrélation multi-sources : un signalement massif de hazards combiné à un échec auth indique un bot/attaquant.
  - **DE.AE-04** : Impact estimé : compromission AES = perte totale de la chaîne de confiance assurance (impact maximal). Spam hazards = dégradation UX (impact modéré).
  - **DE.AE-06** : Les informations sur les événements adverses sont partagées avec l'admin via `admin_alerts` collection et `mod_logs`.
  - **DE.AE-08** : Critères de déclaration d'incident : >10 échecs auth/minute, webhook Revolut invalide, tamper detection activé, pattern de signalement abusif.

### RS — RÉPONDRE (Respond)
*Des actions sont prises en réponse à un incident de cybersécurité détecté.*

- **RS.MA — Gestion des Incidents** :
  - **RS.MA-01** : Plan de réponse : compromission AES → zeroization + rotation de clé + notification utilisateurs. Fuite de données → notification RGPD 72h + purge. DDoS Firestore → activation rate limiters + blocage IP.
  - **RS.MA-03** : Incidents catégorisés par sévérité : CRITIQUE (compromission crypto, fuite PII), ÉLEVÉ (fraude paiement, usurpation), MOYEN (spam, abus IA), FAIBLE (bugs UX).
- **RS.AN — Analyse d'Incident** :
  - **RS.AN-03** : Analyse de cause racine : les collections `crash_reports`, `admin_alerts`, `mod_logs` et les logs Cloud Functions (Google Cloud Logging, rétention 90 jours min) servent de journaux d'investigation.
  - **RS.AN-06** : Actions d'investigation enregistrées : chaque action de modération est tracée dans `mod_logs` avec timestamp, UID admin (tronqué), et raison.
  - **RS.AN-07** : Données d'incident collectées avec intégrité préservée : les documents Firestore en `allow update, delete: if false` garantissent l'immutabilité des preuves.
- **RS.CO — Reporting et Communication** :
  - **RS.CO-02** : Notification interne (admin) et externe (utilisateurs) : RGPD 72h max pour les fuites de données, CCPA pour les résidents US.
  - **RS.CO-03** : La page `banned.html` sert de point de communication pour les comptes compromis. Le système email (`sendWelcomeEmail` pattern) permet la notification de masse.
- **RS.MI — Atténuation** :
  - **RS.MI-01** : Confinement : le Protocole 0 (`deleteUserAccount`) permet l'effacement total d'urgence. Révocation de tokens FIDO2 via suppression dans `fido_credentials`.
  - **RS.MI-02** : Éradication : kill-switch hardware (zeroization des clés AES en cas de compromission physique). Rotation de secrets via Firebase Secret Manager.

### RC — RÉCUPÉRER (Recover)
*Les actifs et opérations affectés par un incident sont restaurés.*

- **RC.RP — Exécution du Plan de Récupération** :
  - **RC.RP-01** : Plan de récupération exécuté : restauration Firestore depuis le backup Cloud Storage quotidien.
  - **RC.RP-02** : Actions de récupération priorisées : (1) restaurer l'authentification, (2) restaurer le paiement, (3) restaurer la télémétrie, (4) restaurer les fonctionnalités communautaires.
  - **RC.RP-03** : Intégrité des backups vérifiée avant restauration (checksum des exports Firestore).
  - **RC.RP-05** : Le firmware ESP32 supporte la mise à jour FOTA (Over-The-Air) pour déployer des correctifs de sécurité sans retour physique au fabricant. Partition OTA de fallback en cas d'échec.
  - **RC.RP-06** : Les données immutables (`blackbox_reports`, `blackbox_telemetry`) ne sont jamais purgées — elles constituent des preuves légales.
- **RC.CO — Communication de Récupération** :
  - **RC.CO-03** : Progrès de récupération communiqués aux parties prenantes internes et externes via le système email et les `admin_alerts`.
  - **RC.CO-04** : Post-mortem public ajouté au `CHANGELOG.md` avec les mesures correctives appliquées.

## Principes IoT FIDO Device Onboard (FDO) à appliquer :
- **Intégration Sécurisée (IoT / Edge)** : 
  - **Authentification Mutuelle** : L'appareil (ex: boîtier OBD-II) et le cloud cible (Portail Assureur/BMS) doivent toujours vérifier mutuellement leurs identités cryptographiques avant d'échanger des données de télémétrie.
  - **Certificat de Propriété (Ownership Voucher)** : Chaque boîtier matériel doit être lié cryptographiquement à une identité numérique pour prouver l'appartenance de l'appareil.
  - **Serveur de Rendez-vous (RV)** : Utiliser le concept de serveur de mise en relation sécurisé pour orienter l'appareil vers son Cloud cible, évitant que l'appareil soit pré-configuré avec des adresses en dur vulnérables.
  - **Réduction de la surface d'attaque (UEFI/BMO)** : Maintenir une empreinte minimale du client IoT pour limiter les vecteurs de compromission.

## Exigences de Certification FIDO à appliquer :
- **Authentification Utilisateur (Passkeys / FIDO2)** : Toute implémentation d'authentification biométrique (Face ID, Touch ID) doit respecter les spécifications FIDO2, WebAuthn et UAF pour garantir un chiffrement de bout en bout sans mot de passe.
- **Vérification d'Identité (IDV-Face / DocAuth)** : La validation des documents (ex: permis de conduire) et la reconnaissance faciale lors de l'onboarding doivent s'appuyer sur les protocoles d'authenticité de documents certifiés FIDO pour contrer l'usurpation d'identité et les deepfakes.
- **Écosystème Certifié** : Privilégier les composants (clients, serveurs RV, capteurs biométriques) validés par les laboratoires accrédités FIDO.

## Principes de Conformité Légale Mondiale (Privacy & RGPD) à appliquer :
Lors du développement de fonctionnalités gérant des données utilisateurs, l'agent (Nexus Atlas) doit appliquer la politique de **Conformité Globale** (basée sur les documents `conformite_globale_mon50ccetmoi.md`, `aipd.md`, `registre_traitements.md`) :
- **Privacy by Design (Baseline Européenne)** : Le standard RGPD s'applique mondialement. Les données sensibles (Rythme cardiaque, Biométrie FIDO2) doivent toujours être traitées en **100% local (Edge Computing)** et chiffrées avec AES-256. Ne jamais téléverser de données de santé sur les serveurs.
- **États-Unis (CCPA / CPRA)** : L'application logicielle est distribuée aux États-Unis. Il est impératif de respecter le principe absolu *"Do Not Sell My Personal Information"*. **Cependant, les modules matériels (Boîte noire / OBD-II) ne sont pas distribués aux US**. Toute fonctionnalité liée à la télémétrie de la boîte noire doit être considérée comme indisponible pour les résidents américains.
- **Chine (PIPL / DSL)** : Appliquer une minimisation extrême des données. Les données de trajets et sinistres sont catégorisées "Civiles" (aucune menace pour la sécurité nationale).
- **Intelligence Artificielle (AI Act)** : Toute utilisation des modules IA (Litigation AI, Meca Wizard, Oracle Voice) doit inclure une mention transparente stipulant que l'outil agit "à titre d'assistance" et qu'aucune décision légale automatisée n'est prise sans supervision humaine.
