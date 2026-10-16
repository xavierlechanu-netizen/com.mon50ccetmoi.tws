<![CDATA[# 📋 Changelog — mon 50cc et moi

Toutes les modifications notables du projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère au [Versionnement Sémantique](https://semver.org/lang/fr/).

## [111.05.00] - 2026-10-16 - 🛡️ Modération Autonome Nexus Atlas, Analyse Sémantique Continue, Sanctions Strictes & Responsabilité Solidaire du Parrainage

### Fonctionnalités
- **Analyse Sémantique d'Amélioration Continue (`src/js/nexus-semantic-analyzer.js`, `src/js/nexus-atlas-gemini.js`, `src/js/nexus-atlas-chat.js`)** :
  - Détection proactive et bienveillante en temps réel des suggestions, idées et retours constructifs dans les échanges avec Nexus Atlas (IA Act Art. 50).
  - Classification automatique multi-thématique (`navigation`, `mechanics`, `security`, `social`, `ui_ux`, `marketplace`, `general`) et calcul de score d'impact.
  - Enregistrement immédiat dans `localStorage` (Boîte à Idées Admin) et synchronisation Firestore (`nexus_suggestions`).
  - Badge visuel interactif notifiant discrètement l'utilisateur de la prise en compte de sa suggestion.
- **Modération Autonome des Espaces de Groupe & Base de Données de Termes Grossiers (`src/js/moderation.js`, `src/js/crew-chat.js`, `src/js/cortege-mode.js`)** :
  - Intégration de la base étendue `FrenchBadWords` et algorithme de normalisation leetspeak, ponctuation, accents et lettres répétées.
  - Modération proactive et continue appliquée de façon 100% autonome par Nexus Atlas dans le Crew Chat, les Cortèges et espaces collectifs sans intervention humaine préalable.
  - Progression stricte des sanctions : 1er ban temporaire (24h), 2e ban temporaire (48h), 3e ban temporaire (7 jours - dernier avertissement), et Bannissement Définitif automatique au-delà de 3 bans temporaires (ou immédiat en cas de propos racistes/haineux Tolérance Zéro).
  - **Clause stricte de non-remboursement** : aucun remboursement d'abonnements, points BVC ou achats virtuels en cas de bannissement.
- **Responsabilité Solidaire du Parrainage (Règle des 5 Avertissements)** :
  - En parrainant un pilote, le parrain engage sa responsabilité en cas de dérive de son filleul.
  - Sanctions graduées (blâme, retrait de Brave Coins BVC, restriction communautaire).
  - Au **5e avertissement cumulé** (direct ou imputable aux agissements des pilotes parrainés), le parrain perd également son compte de manière définitive et sans aucun remboursement.
- **Conformité Internationale Stricte & Sécurité de Niveau Élite** :
  - Respect universel des réglementations locales (RGPD en Europe, CCPA/CPRA aux USA, PIPL en Chine, APPI en Asie, POPIA en Afrique).
  - Protocoles de chiffrement ultra-avancés dépassant le RGPD : AES-GCM 256 bits, dérivation PBKDF2 à 100 000 itérations SHA-256, TRNG matériel et architecture Zero-Knowledge.
- **Mise à jour Juridique & Contractuelle (`src/terms.html`, `src/cgv.html`, `src/moderation.html`)** :
  - Synchronisation complète des CGU, CGV et de la Charte de Modération.

### Tests & Qualité
- 8 suites de tests unitaires Jest (`tests/nexus-semantic.test.js`, `tests/moderation-group.test.js`, etc.) — 64 tests passés avec 100% de succès.
- Validation ESLint stricte sans erreur (`npm run lint`).
- Compilation de production Vite validée (`npm run build`).

## [111.04.00] - 2026-10-16 - 📳 Mode Cockpit OLED HUD Furtif & Guidage Haptique Réflexe (Inclusif Sourds & Sécurité Motarde)

### Fonctionnalités
- **Moteur de Guidage Tactile & Cockpit OLED (`src/js/haptic-navigation.js`, `src/css/haptic-navigation.css`)** :
  - **Mode Cockpit HUD Furtif (Recommandé - Zéro Distraction)** :
    * *En croisière (> 180m)* : Écran 100% noir profond OLED (`#000000`) reposant la vision nocturne du motard, éliminant tout éblouissement et économisant jusqu'à 70% de batterie. Affichage d'un cluster minimaliste de vitesse.
    * *À l'approche (< 180m)* : Réveil dynamique instantané sans quitter la route des yeux avec "coup de coude" tactile (signaux vibratoires directionnels asymétriques), flash lumineux périphérique, pictogramme géant XXL (flèche néon jaune/vert) et distance restante en gros caractères lisibles à 1 mètre de distance.
    * *Ronds-points* : badge circulaire géant affichant immédiatement le numéro de sortie (ex: `2`).
    * *Retour immédiat en veille furtive* dès la manœuvre franchie (< 25m).
  - **Mode Tactile Pur (100% aveugle / dans la veste)** :
    * Suppression complète de l'affichage distrayant et coupure automatique de la voix de synthèse.
    * Guidage par signatures vibratoires distinctives :
      - *Gauche* : 2 impulsions asymétriques (court - long `[100, 80, 250]ms`).
      - *Droite* : 3 impulsions staccato ternaires (`[80, 50, 80, 50, 80]ms`).
      - *Tout droit* : 1 pulsation douce et continue (`[240]ms`).
      - *Rond-point* : rotation tactile en 3 temps (`[120, 60, 120, 60, 260]ms`).
      - *Danger / Radar* : rafale staccato urgente (`[70, 40, 70, 40, 70, 40, 250]ms`).
      - *Arrivée* : célébration tactile (`[160, 80, 160, 80, 450]ms`).
  - **Accessibilité & Inclusivité Sourds / Malentendants** :
    * Suppression de la dépendance à la voix de synthèse.
    * Flash périphérique dynamique exploitant l'acuité visuelle réflexe périphérique naturelle des conducteurs sourds sans obliger à lire l'écran au guidon.
  - **Fallback Intelligent Apple iOS / Safari** :
    * Détection automatique de l'absence de l'API `navigator.vibrate` sur iPhone et compensation automatique par stroboscopie périphérique lumineuse sans laisser le pilote aveugle.
  - **Liaison Déportée Black Box (Francelog ESP32 BLE)** :
    * Crochet logiciel prêt à diffuser les impulsions vibratoires déportées sur les poignées du guidon ou le boîtier Black Box.
  - **Arrêt d'Urgence Tactile Géant** :
    * Bouton pleine largeur accessible et déclenchable d'un tap rapide avec gants moto.
- **Intégration Radar & Navigation (`src/radar-danger.html`, `src/js/radar-danger.js`)** :
  - Sélecteur de mode segmenté directement dans la carte de prévisualisation d'itinéraire ("HUD Furtif", "Tactile Pur", "Carte").
  - Bouton de bascule en 1 clic dans le cockpit de guidage actif (`#btn-hud-mode-toggle`).
  - Coupure automatique de `speakText()` en mode tactile exclusif.
  - Alertes haptiques automatiques couplées aux signalements de dangers communautaires à moins de 200m.

### Tests & Sécurité (OWASP ASVS v5.0.0-3.2.2)
- **Suite de tests unitaires dédiée (`tests/haptic-navigation.test.js`)** : 10 tests automatisés validant la résolution des manœuvres, la détection des sorties, la gestion du fallback iOS, la bascule de veille furtive/réveil, et la persistance locale (54/54 tests passants).
- **Zéro `innerHTML` non assaini** : conformité stricte OWASP ASVS v5.0.0-3.2.2 et validation ESLint 0 erreur.

## [111.03.00] - 2026-10-16 - 🏭 Registre Industriel Black Box (Francelog S.A. Linselles), Série A01 (00 Exclu), Code Bluetooth Unique & Livraison < 24h

### Fonctionnalités
- **Registre Industriel des Black Boxes (`src/admin-blackbox.html`, `src/js/admin-blackbox.js`, `src/css/admin-blackbox.css`)** :
  - Interface dédiée d'administration permettant de gérer et suivre tous les boîtiers matériels (prototypes et unités de série).
  - Traçabilité complète du partenariat industriel avec **Francelog S.A. à Linselles (59)**, avec bannière d'état de production (en attente de validation Francelog pour la production en série, prototypes validés).
  - Numérotation conforme :
    * **10 prototypes réservés** sous format `BB50V1-P01` à `BB50V1-P10` (la lettre P est strictement réservée aux prototypes).
    * **Série commerciale débutant à `A01`** : progression `BB50V1-A01`...`BB50V1-A99`, puis `BB50V1-B01`...`BB50V1-B99` jusqu'à `Z99`.
    * **Le numéro `00` est STRICTEMENT EXCLU de la numérotation** (`A00`, `B00`, `P00` interdits et rejetés).
  - **Code Bluetooth Unique (`blePasskey`)** :
    * Chaque boîtier génère et conserve un code d'appairage Bluetooth unique (passkey BLE sécurisé à 6 chiffres, compatible avec le bonding firmware ESP32 `blackbox_ble.ino`).
    * Affichage dédié dans la table admin, recherche instantanée par code Bluetooth, tiroir latéral avec bouton de copie en 1 clic et régénération sécurisée.
    * Inclus dans l'export CSV officiel.
  - **Engagement Livraison Express Garantie en moins de 24h (< 24h)** sur l'ensemble de la console et de la boutique.
  - **Double mode d'intégration géré par l'équipe** :
    * *Intégration Unitaire* : saisie manuelle d'un numéro d'unité (ex: `A01`) avec assignation d'un code Bluetooth personnalisé ou auto-généré.
    * *Générateur de Lot* : création par lot atomique (1 à 100) débutant au prochain numéro de série disponible ou code défini par l'administrateur.
  - Machine à états stricte (Fabrication → Contrôle qualité → En stock → Vendu → Activé → SAV/RMA → Volé/Perdu → Rebut).
  - Attribution et désattribution sécurisées aux commandes clients réelles.
  - Export CSV complet sécurisé contre les injections de formules (`=`, `+`, `-`, `@`).
  - Journal d'audit et frise chronologique immuable (`blackbox_units/{serial}/history`).
  - Bouton d'accès direct intégré dans le bandeau de `src/admin.html`.

- **Cloud Functions Administrateur (`functions/api/blackbox-registry.js`, `functions/api/blackbox-core.js`)** :
  - `adminRegisterBlackboxUnits` : Enregistrement transactionnel de lots industriels de série (débutant à A01, 00 exclu) ou prototypes individuels avec génération de codes Bluetooth uniques.
  - `adminUpdateBlackboxStatus` : Validation stricte des transitions autorisées avec motif obligatoire pour RMA/Vol/Rebut.
  - `adminAssignBlackbox` / `adminUnassignBlackbox` : Liaison transactionnelle avec mise à jour du profil pilote (`users/{uid}.blackbox_serial`).
  - `adminUpdateBlackboxInfo` : Mise à jour sécurisée des codes Bluetooth (passkeys 6 chiffres), adresses MAC BLE, firmware et notes d'atelier.

### Sécurité & Conformité (OWASP ASVS v5.0.0, NIST CSF 2.0 & RGPD)
- **Neutralisation de la Faille d'Escalade de Privilèges (`firestore.rules`)** :
  - Verrouillage strict de `match /users/{userId}` à la création : interdiction absolue de s'auto-attribuer `role: "admin"` ou `blackbox_serial`.
  - Verrouillage en mise à jour : les utilisateurs authentifiés ne peuvent modifier ni leur rôle ni leur numéro de série sans droits administrateurs (`affectedKeys().hasAny(['role', 'blackbox_serial'])`).
  - Ajout des règles de sécurité zero-trust pour `blackbox_units/{serial}`, `history` et `blackbox_registry/{revision}` (`write: if false`, `read: if isAdmin()`).
- **Sécurisation de la Boutique Matérielle (`src/js/blackbox-shop.js`, `functions/api/payments.js`)** :
  - Remplacement intégral de la simulation de paiement par le véritable flux **Revolut Merchant API (SDK Revolut Checkout)**.
  - Verrouillage de la collection `blackbox_sales` : interdiction d'écriture directe côté client (`allow create: if false`), persistance exclusive via le Webhook Revolut après confirmation bancaire.
  - Implémentation de la vérification de signature webhook Revolut conforme aux spécifications officielles (`functions/api/revolut-signature.js`) : HMAC SHA-256 avec timestamp `v1.{timestamp}.{body}`, fenêtre anti-rejeu de 5 minutes et comparaison en temps constant `crypto.timingSafeEqual`.
- **Conformité RGPD Art. 17 (`functions/api/auth.js`)** :
  - En cas d'effacement de compte (`deleteUserAccount`), les boîtiers matériels sont détachés (`ownerUid` purgé) tout en conservant l'enregistrement matériel et son numéro de série pour la sécurité des produits sans PII.

### Tests Unitaires
- Ajout de `tests/blackbox-core.test.js` (validation des numéros de série, machine à états, garanties, tarification).
- Ajout de `tests/revolut-signature.test.js` (validation signature HMAC, anti-rejeu, secrets tournants).
- Extension de `tests/firestore.rules.test.js` (vérification de la protection contre l'escalade de privilèges et l'isolation des écritures).

---

## [111.02.02] - 2026-10-13 - 📱 Android 15 Edge-to-Edge, Durcissement Sécurité ASVS v5.0.0 & Remédiation Globale

### Sécurité & Conformité (OWASP ASVS v5.0.0, NIST CSF 2.0 & RGPD)
- **Éradication Complète des Exécutions Dynamiques (ASVS v5.0.0-1.3.2)** :
  - **`src/js/dom-security.js`** : Suppression intégrale de tous les constructeurs `new Function()` et de l'évaluation dynamique de handlers `onclick`.
  - Implémentation d'un parseur d'arguments déterministe `parseSafeArgs()` (support exclusif des littéraux primitifs et tableaux JSON, zéro évaluation de code).
  - Durcissement de DOMPurify avec interdiction explicite des balises dangereuses (`iframe`, `style`, `script`, `object`, `embed`).
  - Ajout d'une suite de tests unitaires Jest dédiée (`tests/dom-security.test.js`) validant l'assainissement et la neutralisation des payloads XSS.
- **Assainissement des Dépendances & Vulnérabilités de la Chaîne d'Approvisionnement (NIST GV.SC-01 & ASVS V13)** :
  - **`functions/`** : Élimination de 100% des vulnérabilités de dépendances (`0 vulnerability`), dont la mise à niveau critique de `nodemailer` vers `>=10.1.0` (advisories GHSA-6vj9-mwq6-2f5v, GHSA-8vvx-rff5-p5rq, GHSA-g57g-f23g-4646, etc.).
  - **Racine / Client** : Neutralisation de toutes les vulnérabilités de niveau High/Critical via `overrides` stricts (`@grpc/grpc-js` ^1.14.6, `uuid` ^11.1.1).
- **Télémétrie d'Authentification Pseudonymisée & Audit (NIST CSF 2.0 DE.AE-08 & RGPD Art. 5/32)** :
  - Ajout de la collection `auth_logs` dans `firestore.rules` avec validation stricte du schéma (seuls `uid_hash`, `method`, `status`, `errorCode`, `timestamp` sont autorisés).
  - Interdiction stricte de stockage d'emails, mots de passe, adresses IP ou PII dans les logs de connexion.
  - Immutabilité absolue des logs d'audit (`allow update, delete: if false`) et restriction de lecture aux seuls administrateurs.
  - Intégration de la télémétrie dans `src/js/auth.js` (`recordAuthEvent`) pour mot de passe et FIDO2/biométrie, ainsi que dans `inline-login-3.js` pour Google Sign-In.
- **Règles de Sécurité Firestore Zero-Trust (`firestore.rules` & `tests/firestore.rules.test.js`)** :
  - Extension de la suite de tests unitaires pour valider l'immutabilité des rapports de boîte noire (`blackbox_reports`), l'interdiction d'accès client direct aux collections système (`fido_challenges`, `rate_limits`), et le rejet de tout champ non conforme dans `auth_logs`.
- **Intégration Continue & Hygiène du Dépôt** :
  - Création du workflow GitHub Actions `.github/workflows/ci.yml` assurant l'exécution automatique des tests unitaires Jest, d'ESLint, du build de production Vite, et de l'audit de sécurité des Cloud Functions sur chaque push et pull request.

### Android 15 & TWA
- **Conformité Android 15 & SDK 35/36 (Google Play Console - Edge-to-Edge)** :
  - Suppression de l'attribut obsolète `android:windowOptOutEdgeToEdgeEnforcement="true"` dans `AndroidManifest.xml`.
  - Préservation de la `LauncherActivity` standard d'androidbrowserhelper (2.7.4) garantissant les validations de sécurité d'intent et le filtrage des partages sans risque d'incompatibilité de thème (`IllegalStateException`).
  - Ajustement des règles ProGuard (`app/proguard-rules.pro`) pour préserver `Log.e`, garantissant la visibilité des stacktraces critiques de crash sur Google Play Vitals / Crashlytics.
  - Nettoyage des options obsolètes de réduction de ressources dans `gradle.properties`.
  - Génération du bundle signé release `mon50ccetmoi_v111.02.02.aab` validé sans erreur.

---

## [111.02.01] - 2026-10-11 - 🛡️ Nexus Atlas — Audit Automatisé, Sécurité DOM (ASVS v5.0.0-3.2.2) & Résolution d'Assets

### Corrigé
- **Sécurité des Injections DOM (OWASP ASVS v5.0.0-3.2.2 & Top 10 A03)** :
  - Remplacement des assignations non assainies `innerHTML` par la création d'éléments DOM natifs sécurisés (`createTextNode`, `replaceChildren`) ou via `window.DOMSecurity.safeHTML()` dans `src/js/app-map.js`, `src/js/crash-detection.js` et `src/js/radar-danger.js`.
  - Rétablissement de la conformité stricte ESLint (`npm run lint` : 0 erreur, 0 avertissement).
- **Gestion et Traçabilité des Erreurs Réseau (`src/js/nexus-atlas-facebook.js`)** :
  - Attachement de `{ cause: error }` lors de l'interruption `AbortError` pour préserver la cause racine et les traces d'appels conformément aux exigences ES2022 et Zero Trust.
- **Résolution des Ressources Statiques Vite (`src/partenaires.html` & `src/marketplace.html`)** :
  - Normalisation des chemins relatifs en chemins absolus (`/assets/ui/screenshot_wide.jpg`, `/assets/ui/blackbox.jpg`) et ajout du visuel dans `src/public/assets/ui/`, éliminant les alertes de résolution de bundle Rollup/Vite.
- **Directives Opérationnelles Nexus Atlas (`.agents/rules/nexus-atlas-role.md`)** :
  - Intégration des 7 directives standardisées couvrant l'audit, les correctifs renforcés, les rapports d'activité, les règles logiques, l'autonomie, le multilinguisme international et le Zero Trust.

---

## [111.02.00] - 2026-10-10 - 🧠 Nexus Atlas — Moteur d'Analyse Autonome, Résolution GSI & Durcissement COOP

### Ajouté
- **Moteur d'Analyse Autonome & Détection de Logs (`functions/api/nexus-insights.js`)** : Cloud Function planifiée (CRON 02:00) et endpoint sécurisé (`triggerNexusAnalysis`) ingérant automatiquement les logs de crashs et les sessions de conversations utilisateurs pour générer des rapports causaux (RCA) et des recommandations P0/P1/P2 via Gemini 2.5 Flash / Vertex AI.
- **Synchronisation d'Interactions & Feedback (`nexus-atlas-gemini.js`)** : Capture de session conversationnelle asynchrone non-bloquante avec identifiant unique (`sessionId`) et journalisation dans `nexus_conversations`.
- **Règles Firestore & Télémétrie (`firestore.rules`)** : Sécurisation Zero-Trust des collections `crash_reports`, `nexus_conversations` et `nexus_improvement_reports`.

### Corrigé
- **Google Sign-In (GSI Client Callback Timing)** : Résolution de l'erreur `[GSI_LOGGER]: The value of 'callback' is not a function`. La fonction `window.handleCredentialResponse` est désormais attachée de manière synchrone avant le chargement asynchrone de `gsi/client`, avec mise en file d'attente sécurisée (`_pendingGoogleResponse`).
- **Politique COOP (Cross-Origin-Opener-Policy)** : Ajout de l'en-tête `Cross-Origin-Opener-Policy: same-origin-allow-popups` dans `firebase.json` pour autoriser les communications `window.postMessage` entre le popup Google Sign-In / Revolut et l'application.
- **Affichage Modale de Localisation iOS (`inline-index-1.js` & `inline-login-2.js`)** : La modale `prominent-disclosure-modal` (exigence Google Play Android) est désormais strictement restreinte aux terminaux Android, empêchant le masquage intempestif de l'écran d'accueil et le déclenchement forcé du mode lecteur Safari sur iPhone.

---

## [111.01.00] - 2026-10-05 - 🤖 Nexus Atlas — Publication Autonome Facebook (Visuel Télémétrie) & Durcissement ISO 27001

### Ajouté
- **Publication Quotidienne Autonome Facebook Photo (`functions/api/social.js`)** : Cloud Function planifiée (CRON 10:00 Europe/Paris) générant et publiant chaque jour un post Facebook de type Photo associant texte rédigé par Gemini et carte de télémétrie.
- **Moteur de Rendu Visuel Télémétrie (`functions/api/social-visual.js`)** : Générateur de carte carrée 1080x1080 (SVG -> PNG haute résolution via `@resvg/resvg-js`) affichant l'indice d'activité communautaire (jauge 0-100), l'histogramme des 24h et les compteurs de télémétrie/boîte noire avec polices embarquées (Outfit & JetBrains Mono).
- **Prévisualisation Admin Sécurisée (`functions/api/social.js` & `src/js/nexus-atlas-facebook.js`)** : Endpoint de simulation et fonction client `NexusAtlasFacebook.previewDailyPost()` et `renderPreview()` (injection XSS-safe via `textContent`) permettant aux administrateurs de contrôler le rendu texte et graphique avant publication.
- **Transparence IA (AI Act art. 50)** : Mention automatique de divulgation des contenus générés par IA apposée sur le texte du post et dans le cartouche du visuel.
- **Script de Test Hors-Ligne (`functions/scripts/preview-daily-post.js`)** : Outil de test local générant l'aperçu HTML et le fichier PNG sans dépendance réseau.

### Sécurité & Norme ISO/IEC 27001:2022
- **Contrôle d'accès & Idempotence (A.5.15 & A.8.28)** : Verrou transactionnel Firestore sur `facebook_daily_runs/{dateKey}` empêchant tout doublon même en cas de rejeu Cloud Scheduler ; protection stricte des collections `config/social_automation` et `facebook_daily_runs` dans `firestore.rules`.
- **Résilience & Gestion des Replis (A.5.29)** : Triple mécanisme de fail-safe : Vertex AI -> Gemini AI Studio -> Gabarit éditorial déterministe (zéro rupture si l'IA est indisponible) ; repli texte seul si l'upload d'image échoue ; suspension des rejeux en cas de timeout pour éviter toute publication multiple.

---

## [111.00.00] - 2026-09-08 - 🌿 Alignement ESG IT — Fruggr, RGAA 4.1.2, AI Act & ISO/IEC 27001

### Ajouté
- **Télémétrie & Sobriété ESG IT (`public/js/esg-telemetry.js`)** : Module singleton `window.ESGManager` calculant en continu les métriques de frugalité de session (données réseau économisées, ratio Edge Computing / Cache local, équivalent gCO2e épargné).
- **Gestion Énergétique Mobile Proactive** : Bascule automatique en Mode Éco Sobriété (`.lite-mode`) lorsque la batterie est faible (<= 20% via `navigator.getBattery()`) ou lorsque le client signale `navigator.connection.saveData`.
- **Green AI & Cache d'Inférence (`nexus-atlas-gemini.js`)** : Mise en cache locale (sessionStorage) des requêtes/réponses de Nexus Atlas sur les sujets récurrents (Code de la route, législation, ZFE), évitant des millions de cycles d'inférence GPU sur serveurs distants.
- **Référentiel Officiel ESG IT (`docs/CONFORMITE_ESG_FRUGGR.md`)** : Documentation complète de la grille de conformité Fruggr couvrant les piliers E (Green IT), S (RGAA 4.1.2) et G (AI Act UE 2024/1689 & ISO/IEC 27001:2022).
- **Accessibilité Numérique RGAA 4.1.2 & WCAG 2.1 AA** :
  - Styles `:focus-visible` universels haute visibilité avec contour néon cyan pour la navigation clavier sans souris.
  - Support de `@media (prefers-reduced-motion: reduce)` désactivant immédiatement les animations continues et les pulsations pour prévenir les troubles vestibulaires.
  - Classes utilitaires `.sr-only` et `.visually-hidden` pour les lecteurs d'écran.
  - Liens d'évitement (`skip-link`) pour accéder directement au contenu principal.

### Modifié
- `css/design-system.css` : Rehaussement du contraste de `--text-muted` (`#94a3b8`) pour dépasser le ratio 4.5:1 sur fond sombre, allègement drastique des filtres `backdrop-filter` et des ombres en Mode Éco.
- `public/js/app-core.js` : Synchronisation bidirectionnelle du Mode Éco avec `ESGManager` et écoute de l'événement `esg-mode-change`.
- `public/sw.js` : Enregistrement des feuilles de style et modules ESG dans le cache statique de la PWA et passage au cache `mon50cc-cache-v1090000`.
- `index.html` & `app.html` : Intégration du script `esg-telemetry.js`, mise en place des skip-links et mise à jour du scope Service Worker.

---

## [110.00.00] - 2026-09-07 - 🚀 Valorisation — IA Gemini & Nouvelles Fonctionnalités

### Ajouté
- **Nexus Atlas v2.0 — Météo Contextuelle** : Le simulateur Code de la Route interroge désormais `getVigilanceMeteo` (Météo-France) au démarrage. Le prompt système envoyé à Gemini est enrichi du niveau de vigilance météo national (vert/jaune/orange/rouge), ce qui permet à Nexus Atlas de poser des questions adaptées aux conditions réelles du jour.
- **Nexus Atlas v2.0 — Oracle Voice** : Ajout de la synthèse vocale (Web Speech API TTS) pour lire les réponses de l'IA à voix haute, et de la reconnaissance vocale (STT) pour que l'utilisateur puisse répondre à l'oral. Deux boutons (🔊 et 🎤) ajoutés dans l'en-tête de `code-de-la-route.html`.
- **Contrat de Route** (`contrat-de-route.html` + `js/contrat-de-route.js`) : Nouvelle page de gamification de la sécurité. Le conducteur signe chaque mois jusqu'à 5 engagements de sécurité (casque, alcool, angles morts...). Chaque signature attribue des BVC Points via une écriture atomique Firestore.
- **Radar de Danger** (`radar-danger.html` + `js/radar-danger.js`) : Nouvelle page de signalement communautaire géolocalisé. Affiche une carte Google Maps en mode sombre avec les dangers signalés en temps réel (écoute Firestore `onSnapshot` sur la collection `hazards`). Les utilisateurs peuvent signaler 8 types de dangers. Rate limiting côté client (30s entre signalements).
- **Assistant Sinistre IA** (`js/assistant-sinistre.js`) : Module injectable qui écoute l'événement `crashDetected` (émis par `guardian-angel.js` / `anti-theft.js`) et ouvre un panneau de chat guidé alimenté par Gemini. L'IA guide l'utilisateur étape par étape (Sécurité → Constat → Preuves → Assurance). Boutons d'action intégrés (Appel 15/18, prise de photo, partage télémétrie).
- **Ma Progression** (`ma-progression.html` + `js/ma-progression.js`) : Dashboard personnel avec anneau de score SVG animé, grille de stats (BVC Points, contrats, signalements) et barre de niveau gamifiée. Inclut le **Mode Entraîneur** : génère un bilan hebdomadaire IA (via Gemini) à destination des parents.

### Modifié
- `vite.config.js` : Ajout des 4 nouvelles pages comme points d'entrée Rollup.
- `code-de-la-route.html` : Ajout des boutons voix/micro dans l'en-tête.

### Sécurité
- Rate limiting Firestore sur les signalements de danger (localStorage + OWASP A11).
- Toutes les données HTML injectées depuis Gemini proviennent d'une Cloud Function authentifiée (OWASP A03).

---

## [110.00.00] - 2026-08-17 - 🐛 Résolution de Bugs et Améliorations UI

### Corrigé
- **Avocat de Poche (UI)** : Correction d'un bug d'affichage (texte tronqué) sur l'avertissement de l'IA.
- **JavaScript (Bundle)** : Correction d'une erreur de syntaxe fatale (nom de variable invalide `nexus-atlasFeedback`) dans `nexus-atlas-voice.js` qui corrompait le fichier minifié.
- **Boîte Noire (Bluetooth)** : Correction de l'erreur réseau 404 sur `blackbox-ble.js` qui n'était pas copié dans le dossier public.

---


## [101.00.05] - 2026-08-09 - 🛡️ Dépôt eSoleau INPI

### Ajouté
- **Propriété Intellectuelle** : Ajout du reçu INPI (`recap_DSO2026028777.pdf`) dans `docs/PI_INPI/` pour conserver la preuve du dépôt eSoleau au sein du projet.
- **Script de génération** : Création du script `scripts/generate_esoleau_archive.ps1` pour automatiser la génération d'une archive source propre (sans dépendances) pour les futurs dépôts INPI.

---

## [101.00.04] — 2026-08-07 — 🚀 Signature Automatique & AAB (Google Play)

### Ajouté
- **Signature Automatique de l'App Bundle** : Mise en place de la configuration automatique (`signingConfigs`) dans Gradle pour que le fichier `.aab` soit automatiquement signé avec le keystore officiel (`new-upload-keystore.jks`) lors du processus de compilation.
- **Gestion sécurisée des mots de passe** : Séparation des mots de passe dans le fichier non-versionné `local.properties` pour sécuriser l'accès au keystore.

### Amélioré
- **Déploiement Google Play** : Le workflow de compilation natif (`bundleRelease`) est désormais 100% prêt pour la Google Play Console avec une validation de signature native.

---

## [100.50.03] — 2026-06-28 — 🎨 Nouvelle Identité Cyberpunk & Refonte Graphique

### Ajouté
- **Nouvelle Identité Visuelle** : Lancement d'un tout nouveau design premium de type "Cyberpunk", arborant des teintes néon cyan et vert émeraude.
- **Icônes Haute Définition** : Refonte de l'icône de l'application sur tous les écrans (lanceur Android et UI) pour correspondre au nouveau thème "Copilote IA".
- **Bannière YouTube Officielle** : Intégration de la direction artistique sur les réseaux avec le slogan "Le Copilote IA des Scooters et VSP".

### Amélioré
- **Ressources Android (AAB)** : Mise à jour complète des `mipmap` natifs et compilation d'une nouvelle version signée (v100.50.03) prête pour le Play Store.

---

## [100.50.00] — 2026-06-26 — 🌍 Global Privacy & Android Sync

### Ajouté
- **Bouclier Légal Mondial (Privacy Manager)** : Déploiement d'un gestionnaire de confidentialité universel supportant le RGPD (Europe), le CCPA (USA), la PIPL/DSL (Chine), l'APPI/PDPA (Asie) et la loi POPIA / Malabo (Afrique).
- **Mode Fantôme (Ghost Mode)** : Ajout d'un bouton d'action rapide dans le dock pour disparaître instantanément de la carte sociale.
- **Droit à l'Oubli (Right to Forget)** : Implémentation de la suppression totale des données personnelles depuis l'interface (nettoyage Firebase et cache local).
- **Mentions Légales** : Ajout d'une clause d'exclusion explicite pour la Corée du Nord (RPDC) afin de respecter les sanctions internationales et les embargos.

### Amélioré
- **Compilation Android (Capacitor/Bubblewrap)** : Synchronisation du code web optimisé avec le moteur natif Android.
- **Support Java 17 (Gradle)** : Patch des plugins natifs Capacitor 8 pour garantir la compilation avec la chaîne d'outils Java 17, assurant la stabilité de la génération du fichier AAB signé.

## [100.00.08] — 2026-06-24 — 🏆 GOLD EDITION: Sécurité, RGPD Mondial & Performances

### Ajouté
- **Conformité Internationale Massive (RGPD/PIPL/CCPA)** : Intégration dynamique de la politique de confidentialité en **25 langues** (FR, EN, ES, IT, DE, PT, NL, PL, ZH, JA, KO, HE, ID, HU, HI, FI, DA, RO, SK, SV, TH, TR, CS, NO). Adaptation automatique selon la locale de l'utilisateur.
- **Prominent Disclosure (Google Play)** : Refonte de la modale de consentement pour respecter les nouvelles exigences de localisation en arrière-plan du Play Store.

### Amélioré
- **Architecture & Performances** : Minification agressive du CSS (réduction de 25%) et création d'un bundler JS (fusion de 34 fichiers en un seul `app-bundle.min.js`) pour diviser drastiquement le temps de chargement de l'application (TTI).
- **Hébergement** : Déploiement optimisé sur Firebase Hosting (contournement des quotas API).

### Sécurité
- **Patch Firestore Rules** : Verrouillage strict des règles de base de données. 
  - Restriction totale sur les données biométriques et télémétriques (Guardian Angel).
  - Protection des données sensibles du portail assureur (B2B).
  - Validation stricte des schémas de données pour prévenir les injections.

---

## [80.0.3] — 2026-06-22 — 🎛️ OBD-II HUD Dashboard

### Ajouté
- **Interface OBD-II (HUD)** : Déploiement du tableau de bord transparent (Glassmorphism) superposé à la carte pour l'affichage en direct des données moteur.
- **Indicateurs Temps Réel** : Jauges animées pour le régime moteur (RPM), la vitesse (km/h) et la température du liquide de refroidissement (°C).
- **Gestionnaire d'état Bluetooth** : Indicateur visuel de connexion et déconnexion en un clic, avec retour haptique (vibration) lors de l'appairage réussi.
- **Outil de simulation** : Fonction `testOBD()` ajoutée pour permettre de tester l'interface utilisateur sans nécessiter de dongle ELM327 physique.

---

## [80.0.2] — 2026-06-19 — 📱 Compatibilité Android 15 & 16

### Amélioré
- **Affichage Bord à Bord (Edge-to-Edge)** : Implémentation native de l'affichage en plein écran via `WindowCompat` pour une compatibilité parfaite avec Android 15 (API 35).
- **Compatibilité Grands Écrans** : Suppression totale des restrictions d'orientation dans la configuration (passage de `default` à `any`) pour s'adapter nativement aux tablettes et appareils pliables sous Android 16.
- **Optimisation des API Fenêtre** : Remplacement des anciennes API de couleurs de barre de navigation et barre d'état obsolètes par des méthodes transparentes modernes.

### Corrigé
- Suppression de l'activité `WebViewFallbackActivity` devenue inutile, pour résoudre les avertissements de sécurité de la Play Console liés aux API dépréciées.

### Sécurité & Déploiement
- Nouveau build AAB signé (v80.0.2) prêt pour le Google Play Store.

---

## [80.0.1] — 2026-06-18 — 🇪🇺 Conformité & Déploiement

### Ajouté
- **Conformité au Règlement (UE) 2018/302 (Blocage Géographique)** : Audit complet validant l'absence de discrimination basée sur la localisation dans l'Union Européenne.
- **Mentions Légales** : Ajout d'une section sur le blocage géographique et d'une clause explicite sur la juridiction applicable (Règlement Bruxelles I bis).
- **Conditions Générales d'Utilisation (CGU)** : Ajout de clauses garantissant l'égalité d'accès et de tarification pour tous les utilisateurs de l'UE.

### Corrigé
- **Cartographie Hors-Ligne (Nominatim)** : Suppression de la restriction de recherche (`countrycodes: 'fr'`) pour permettre la recherche de POI et d'adresses dans toute l'Europe sans limitation.

### Sécurité & Déploiement
- Mise à jour du document d'audit (`AUDIT_SECURITE_RGPD.md`) qui valide désormais 8 cadres réglementaires européens (RGPD, ePrivacy, DSA, AI Act, Geo-blocking, RGSP, A11y, LCEN).
- Nouveau build AAB signé (v80.0.1) prêt pour le Google Play Store.
- Déploiement Cloud sur Firebase Hosting.

---

## [80.0.0] — 2026-06-14 — 🌐 Connectivité & Immersivité

### Ajouté
- **Module OBD-II (Web Bluetooth)** : connexion aux boîtiers de diagnostic moteur ELM327.
- Affichage de la télémétrie moteur temps réel dans le HUD (Vitesse réelle, RPM, Température).
- **Navigation en Réalité Augmentée (AR)** : surimpression vidéo de la caméra avec superposition du HUD.
- Flèche de direction holographique 3D couplée au gyroscope et à la boussole magnétique.

### Sécurité & Légal
- **Conformité RGPD / CNIL** : Mise à jour de la politique de confidentialité pour déclarer l'utilisation locale de la caméra, des capteurs de mouvement et de la télémétrie OBD-II.
- **Conformité EU AI Act** : Ajout d'une clause de transparence sur l'usage des algorithmes d'IA (Litigation AI, Meca Wizard) et déclaration de supervision humaine pour éviter toute décision juridique automatisée.

---

## [70.0.0] — 2026-06-14 — 🧠 Neural Evolution

### Ajouté
- Architecture modulaire complète (app-core, app-map, app-ui, app-features, app-wallet, app-garage)
- Neural HUD holographique avec données temps réel
- Self-Evolution Engine : système d'auto-apprentissage IA
- Telemetry v2 : collecte avancée de données de conduite
- Documentation technique complète (README, ARCHITECTURE, CHANGELOG)
- Structured Data JSON-LD pour le référencement Google
- Firebase Analytics intégré

### Amélioré
- Service Worker v70007 avec cache résilient
- Performance du rendu cartographique
- Manifest PWA avec raccourcis et catégories
- SEO : sitemap complet, robots.txt corrigé, meta tags sur toutes les pages

### Corrigé
- Doublons CSS supprimés (-15 Ko)
- Page 404 personnalisée ajoutée

---

## [60.0.27] — 2026-05 — 💼 InsurTech & Legal

### Ajouté
- **Portail Assureur B2B** : dashboard professionnel sécurisé
- **Intégration Revolut Merchant API** : paiements en ligne pour rapports d'expertise
  - 3 Cloud Functions : `createRevolutOrder`, `revolutWebhook`, `checkPaymentStatus`
  - Validation serveur des montants (anti-triche)
  - Webhooks automatiques pour déblocage de rapports
- **Litige IA** (litigation-ai.js) : reconstitution d'accident par intelligence artificielle
- **Avocat de Poche** (pocket-lawyer.js) : assistant juridique IA
- **Caméra Certifiée** (certified-camera.js) : capture photo/vidéo horodatée à valeur juridique
- **Insurance Portal** (insurance-portal.js) : portail assurance complet (20 Ko)
- Page dédiée `assureur.html` avec interface B2B
- Page `partenaires.html` : dashboard Partner Connect avec KPIs et gestion de campagnes
- Authentification **FIDO2/WebAuthn** (biométrie sans mot de passe)
- Authentification **Google Sign-In** via Firebase Auth
- Sécurité **NIS2** : conformité renforcée
- Architecture **Zero Trust** (zero-trust.js)
- Chiffrement **Post-Quantique** (quantum-crypto.js)
- **Protocole 0** : Kill-Switch d'urgence (effacement total des données)
- Tarification B2B : Standard (49.99€), Intermédiaire (89.99€), Expert Neural (199.99€)

### Amélioré
- Règles Firestore : 16 collections avec contrôle d'accès granulaire
- Sécurité des paiements : montants forcés côté serveur
- Page de login : ajout mode Investisseur VIP, accès Portail Assureur

---

## [50.1.8] — 2026-04 — 📱 Gold Edition (Play Store)

### Ajouté
- **Publication Google Play Store** (AAB signé)
- Build Android via **TWA** (Trusted Web Activity) avec Bubblewrap CLI
- Configuration Android : `twa-manifest.json`, keystore de signature
- Digital Asset Links pour la vérification du domaine
- Scripts de build automatisés (`build_aab.bat`, `build_and_upload_ready.bat`)
- Déploiement FTP Amen (`deploy_ftp_amen.bat`)

### Amélioré
- Orientation : support portrait + paysage
- Splash screen avec fade-out de 300ms
- Notifications push activées

---

## [50.0.x] — 2026-03 — 🔐 Sécurité & Auth

### Ajouté
- **Firebase Authentication** : inscription, connexion, sessions chiffrées
- **Firestore Database** : stockage cloud temps réel
- **Modération Bot** : détection automatique des comportements abusifs
- **Arbitre Bot** : arbitrage automatique des conflits communautaires
- **Sentinel v2** : système de détection et prévention des risques
- **SecBot** : bot de sécurité (15 Ko)
- Page `admin.html` : console d'administration
- Page `banned.html` : écran de bannissement
- Chiffrement AES-256 des sessions locales (crypto-native.js)
- Système de ban IP et modération

### Amélioré
- Pages légales : `privacy.html`, `terms.html`, `cookies.html`
- RGPD/CNIL : consentement cookies, politique de confidentialité

---

## [40.0.x] — 2026-02 — 🌐 Communauté & Social

### Ajouté
- **Carte sociale** : voir les riders connectés en temps réel
- **Intercom tactique** : communication vocale entre pilotes
- **Système de présence** : partage de position en temps réel
- **Humeurs / Ticker social** : partage d'états d'esprit
- **Système XP** : points d'expérience et niveaux de pilote
- **Hall of Fame** : classement communautaire
- **Roadbooks partagés** : itinéraires communautaires

### Amélioré
- Interface glassmorphism avec thème Cyberpunk/Neon
- Dock Apple-style avec 12 boutons d'action rapide

---

## [30.0.x] — 2026-01 — 🛡️ Guardian Angel

### Ajouté
- **Détection de chute** (Guardian Angel) : analyse G-Force via accéléromètre
- **Alerte SOS automatique** : compte à rebours de 10 secondes style Apple Crash Detection
- **Boîte Noire** : enregistrement télémétrique certifié
- **Contacts d'urgence** : notification automatique aux proches
- **Anti-vol** : détection de mouvement avec géofencing
- **Ghost Rider** : détection de conduite dangereuse
- **Engine Pulse** : monitoring moteur
- **Bilan Carbone** : comparaison écologique vs voiture

### Amélioré
- HUD (Heads Up Display) avec données temps réel
- Mode holographique pour projection sur pare-brise

---

## [20.0.x] — 2025-11 — 🤖 Intelligence Artificielle

### Ajouté
- **Oracle Voice** : assistant vocal IA pour la navigation
- **Nexus Atlas Voice** : synthèse vocale multilingue
- **Neural HUD** : affichage tête haute avec données de conduite
- **Habits** : apprentissage des habitudes de conduite
- **Predictive Meca** : maintenance prédictive du véhicule
- **Meca Wizard** : assistant mécanique IA

### Amélioré
- Internationalisation (i18n.js) : support multilingue complet
- Design premium avec animations cyberpunk

---

## [10.0.x] — 2025-09 — 🗺️ GPS Foundation

### Ajouté
- **Navigation GPS** avec Google Maps API
- **Routage sans autoroute** : algorithme d'évitement des voies rapides
- **Signalement de dangers** : police, routes dégradées, animaux, accidents
- **Configuration véhicule** : marque, modèle, profil de conduite
- **Mode Lite** : économie de batterie
- **PWA** : installation sur écran d'accueil, mode fullscreen
- **Service Worker** : cache hors-ligne

---

## [1.0.0] — 2025-07 — 🎬 Lancement Initial

### Ajouté
- Prototype initial de l'application
- Concept de GPS dédié aux 50cc
- Interface de base avec carte
- Domaine `mon50ccetmoi.com` enregistré

---

> 📝 **Note** : Les numéros de version intermédiaires (ex: v50.0.41, v60.0.13, v60.0.24) correspondent à des correctifs, des optimisations de performance et des ajustements UI mineurs non détaillés ici.
]]>
