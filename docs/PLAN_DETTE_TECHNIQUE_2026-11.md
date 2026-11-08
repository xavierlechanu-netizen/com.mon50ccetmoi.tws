# Plan de remboursement de la dette technique — novembre 2026

État mesuré le 7 novembre 2026, après l'audit de sécurité, RGPD et le retrait des fausses données (voir `AUDIT_2026-11.md` et `AUDIT_JURIDIQUE_RGPD_2026-11-07.md`).

## 1. État des lieux chiffré

| Indicateur | Valeur | Commentaire |
| :--- | :--- | :--- |
| Fichiers suivis par git | 626 | dont 246 dans `src/` |
| JavaScript du site | 165 fichiers, 41 836 lignes | 5 fichiers de plus de 1 000 lignes (`app-core.js` : 2 063) |
| **Code jamais chargé** | **26 fichiers, ~7 600 lignes** | Aucune page ne les charge (vérifié un par un) |
| Scripts chargés par `app.html` | 81 | Tous au démarrage, communiquant par `window` |
| Variables globales `window.X =` | 489 | Couplage fort entre modules |
| Scripts « inline-*.js » | 38 | Anciens `<script>` extraits des pages, sans structure |
| `onclick=` restants | 58 | Bloquent une CSP stricte (sans `unsafe-inline`) |
| `innerHTML =` | 296 | Protégés par DOMPurify, mais chacun est un risque XSS potentiel |
| `eslint-disable` | 299 | Presque tous pour autoriser `innerHTML` |
| Accès Firestore directs depuis le navigateur | 130 | Dispersés dans des dizaines de fichiers : rend la migration OVH coûteuse |
| `localStorage` | 174 | Sans couche commune |
| Démarrage | ~390 Ko compressés | Firebase « compat » 218 Ko + code de l'app 171 Ko |
| Tests | 30 suites, 252 tests | Bonne couverture serveur et sécurité ; **aucune** sur `app-core`, `app-map`, `app-features` |
| Fichiers lourds dans git | `tools/bundletool.jar` (31 Mo) | Outil téléchargeable, n'a pas sa place dans le dépôt |
| Dossiers en double | `screens/` = copie exacte de `src/public/screens/` | 15 fichiers |
| Deux apps Android | TWA (`app/`) et Capacitor (`android/`) | Même identifiant ; seule la TWA est publiée |
| Dépendances (majeures en retard) | firebase 12→13, firebase-admin 13→14, @simplewebauthn/server 13→14, rules-unit-testing 5→6 | 0 vulnérabilité en production |

Fichiers jamais chargés : `app-garage`, `arbitre-bot`, `assistant-sinistre`, `blackbox`, `certified-camera`, `chronos`, `engine-pulse`, `ghost-rider`, `ghost-rider-v2`, `guardian-angel`, `habits`, `hardware`, `hardware-ble`, `i18n-legal`, `moderation-bot`, `neural-hud`, `neural-sync`, `nexus-atlas-facebook`, `offline-map`, `predictive-meca`, `premium`, `secbot`, `sentinel-v2`, `social-map`, `telemetry`, `wallet`.

Conséquence déjà visible : le bouton « Télécharger le rapport » du portail assurance appelle une fonction de `app-garage.js`, jamais chargé, donc il ne fait rien.

## 2. Principes

1. **Rien de cassé en production** : chaque étape se termine par tests, lint, build et une vérification dans le navigateur.
2. **Petits pas** : une étape = un commit, publiable seule.
3. **Pas de travail jeté** : on ne modernise pas ce que la migration OVH remplacera (Firebase « compat » côté client).
4. **Des garde-fous** : chaque dette remboursée reçoit un test qui empêche son retour (comme pour les fausses données et les boutons morts).

## 3. Plan par étapes

### Étape 1 — Grand ménage sans risque (½ journée) — FAIT le 7/11/2026

- Archiver les 26 fichiers morts sur une branche `archive/code-mort-2026-11`, puis les retirer de `main`. Certains contiennent des idées à reprendre (Ange Gardien, caméra certifiée, cartes hors ligne) : la branche les garde.
- Réparer ou retirer le bouton « Télécharger le rapport » du portail assurance.
- Supprimer `screens/`, doublon exact de `src/public/screens/`.
- Sortir `tools/bundletool.jar` de git : le télécharger dans la CI et l'ignorer.
- Ranger la racine : archives `.zip`, anciens `.aab`, journaux. Ils sont déjà ignorés par git, mais encombrent le dossier.
- **Sécurité** : la clé de signature Play Store (`new-upload-keystore.jks`) et son mot de passe sont dans le dossier du projet. Les déplacer hors du projet, avec une sauvegarde chiffrée hors du PC : sa perte empêcherait toute mise à jour de l'app.
- Garde-fou : un test échoue si un fichier de `src/js/` n'est chargé par aucune page.

### Étape 2 — Filet de sécurité de l'interface (1 jour) — FAIT le 7/11/2026 (fonctions pures de app-core : reporté à l’étape 5)

- Tests de fumée dans un vrai navigateur (Playwright) : chaque page se charge sans erreur, les écrans principaux s'ouvrent, aucun bouton de la barre n'est mort. Lancés par la CI avant chaque publication.
- Budget de poids : la CI échoue si le code chargé au démarrage grossit de plus de 5 %.
- Sortir les fonctions pures de `app-core.js` (calculs de vitesse, d'itinéraire, de consentement) dans des modules testés.

### Étape 3 — Supprimer les derniers `onclick` et durcir la CSP (1 jour) — FAIT le 7/11/2026

- Remplacer les 58 `onclick=` par `data-action` (le système sécurisé du projet).
- Retirer `'unsafe-inline'` des scripts dans la CSP : c'est le dernier gros verrou contre les injections de code.
- Garde-fou : un test interdit tout nouveau `onclick=`.

Réalisé : 67 attributs `on…=` convertis (`data-action`, et nouveaux `data-enter-action`, `data-change-action`,
`data-input-filter`, `data-fallback-icon` dans `dom-security.js`) ; 8 scripts écrits dans les pages déplacés dans
des fichiers (`axeptio-config.js`, `gsi-callback.js`, `b2b-assureur-demo.js`, `dashboard-extras.js`,
`radar-danger-init.js`, `banned-page.js`) ; `'unsafe-inline'` retiré de `script-src` (balise CSP et
`firebase.json`). Garde-fous : `tests/strict-csp.test.js` et les tests navigateur, qui échouent si la CSP bloque un script.
Corrigé au passage : renouvellement Boîte Noire+ (boutons morts, prix affiché 5,00 € au lieu de 4,99 €), bouton
« Publier l'annonce » de la bourse d'échange, défi de la quinzaine ; retirés : page « IA prédictive » inaccessible
(résultat d'analyse inventé), widget Google Traduction qui ne s'exécutait jamais.
Repris le 8/11/2026 : `assureur.html` appelait des fonctions inexistantes (`authenticateInsurer`, `searchCase`,
`selectReport`) et `assureur.js` était une simulation (faux dossier chiffré, « paiement » validé au bout de 2 s,
clé de démo dans le code). La page suit maintenant le vrai parcours : connexion Firebase, entreprise vérifiée par
SIREN, aperçu du dossier, paiement Revolut, rapport lisible seulement après confirmation du serveur. Offres, codes
de dossier et contenu du rapport scellé sont dans `insurer-reports.js`, partagé avec l'app. Tests :
`tests/insurer-reports.test.js` (prix identiques au catalogue serveur), `tests/assureur-portal.test.js` (parcours
complet, Firebase et Revolut simulés) et `e2e/assureur.e2e.js`.
Reste à décider : les trois niveaux (49,99 / 89,99 / 199,99 € HT) livrent aujourd'hui le même rapport.

### Étape 4 — Une couche d'accès aux données unique (3 à 5 jours, prépare OVH)

- Regrouper les 130 accès Firestore du navigateur derrière un module unique par domaine (comptes, dangers, communauté, garages, boîte noire, paiements).
- Ajouter l'interrupteur `CONFIG.BACKEND_MODE = "FIREBASE" | "SOVEREIGN"` prévu par la Phase A : la migration OVH se fera ensuite domaine par domaine, sans toucher au reste.
- Même chose pour `localStorage` : un module de stockage local, avec des clés déclarées en un seul endroit.

### Étape 5 — Découper l'application en modules (2 à 3 semaines, progressif) — EN COURS (tranches 1 à 3 faites le 7/11/2026)

- Passer des 81 scripts qui communiquent par `window` (489 globales) à de vrais imports entre modules, rangés par fonctionnalité (`carte/`, `communauté/`, `boîte-noire/`, `assistant/`…).
- Charger à la demande les fonctions rares (avocat de poche, certificats, diagnostic, marché du carbone…) : démarrage plus rapide.
- Découper `app-core.js` (2 063 lignes), `app-features.js` (1 493) et `app-map.js` (1 226).
- Remplacer progressivement les `innerHTML` par des créations d'éléments (`textContent`) : moins de `eslint-disable`, moins de risque XSS.
- Méthode : un module à la fois, avec les tests de l'étape 2 comme filet.

Tranche 1 (7/11/2026) :
- `lazy-features.js` : avocat de poche, diagnostic mécanique, portails assureur, analyse de litige et vision AR
  ne sont plus chargés au démarrage mais au premier clic. Démarrage de l'app : 499,8 → 479,4 Ko compressés
  (budget abaissé en conséquence). Tests : `tests/lazy-features.test.js` et un test navigateur.
- `geo-math.js` : distance GPS, lissage de vitesse, heures du mode nuit, icône du véhicule. La distance était
  recopiée dans 7 fichiers ; un test interdit d'en réintroduire une copie. Tests : `tests/geo-math.test.js`.
- Réparé au passage : calculateur de mélange 2 temps (son bouton ne pouvait pas fonctionner).

Tranche 2 (7/11/2026) — `app-core.js` : 2 063 → 1 000 lignes :
- `voice-engine.js` : voix de l'assistant (lexique régional, choix de la voix, `speak`, `vibrate`).
- `gps-tracking.js` : accord de localisation, démarrage du GPS, basse précision, bannières d'erreur ;
  branché sur `updatePosition` par `configureGps()`. Tests : `tests/gps-tracking.test.js` (GPS simulé)
  et un test navigateur qui vérifie que la position arrive jusqu'à l'app.
- Retirés : « moteur de prédiction d'adhérence » (valeurs jamais lues, affichage inexistant) et 65 lignes
  de style Google Maps (seul l'interrupteur du thème sombre servait).

Tranche 3 (7/11/2026) — `app-core.js` : 1 000 → 903 lignes :
- `hazard-alerts.js` : alertes de danger pendant la conduite (règles de distance dans `hazardAlertFor`,
  fonction pure). Tests : `tests/hazard-alerts.test.js` (18 cas).
- Corrigé : un danger était reconnu par la somme latitude + longitude (deux dangers pouvaient se masquer) ;
  seul le dernier danger annoncé était retenu (deux dangers proches répétés à chaque position GPS) ;
  le type de danger était inséré comme du HTML dans « Toujours là ? ».
- Suite : `app-features.js` (1 493 lignes) et `app-map.js` (1 226 lignes).

Tranche 4 (8/11/2026) — `app-map.js` : 1 221 → 602 lignes :
- Retiré : l'ancien « radar » de points d'intérêt (carburant, garages, santé, DAB, ~400 lignes). Aucun
  bouton n'y menait depuis la refonte ; le radar carburant actif est `community-gas.js`. Il était de toute
  façon cassé : il lisait les signalements d'abus, réservés aux administrateurs, et échouait pour tous les
  autres ; il lisait la ville dans un champ mal orthographié (`vile`) et ne savait pas lire les prix d'une
  station ne vendant qu'un carburant. Retirés aussi : le chrono (`trip-timer` n'existe dans aucune page), la
  liste latérale des dangers (`live-hazards-list`, idem), l'appel à `updateXP` (fonction inexistante).
- `hazard-reports.js` : menu, enregistrement et affichage des dangers de la communauté. Fonctions pures
  (position, expiration des animaux après 30 min, doublons, sélection dans un rayon de 25 km), bulle en
  texte brut. Tests : `tests/hazard-reports.test.js` (24 cas).
- Corrigé : un danger enregistré au format `{pos}` était placé sans position sur la carte ; doublons
  reconnus par identifiant de document (avant : date + auteur).
- Démarrage de l'app : 478,7 → 475,8 Ko compressés (budget abaissé).
- À reprendre : les alertes de conduite (`hazard-alerts.js`) ne lisent que les dangers signalés par le
  pilote lui-même (stockage local), pas ceux de la communauté affichés sur la carte. Le signalement
  d'abus de prix (`reportStationAbuse`, `database.js`) échoue pour tout non-administrateur (lecture de
  `reports_abuse` refusée) : à refaire par une fonction serveur.
- Suite : itinéraire (`calculateRouteSansAutoroute`, 320 lignes) puis `app-features.js`.

### Étape 6 — Dépendances et outillage (½ journée, puis en continu) — FAIT le 8/11/2026

- `firebase-admin` 14 et `@simplewebauthn/server` 14 (serveur), `@firebase/rules-unit-testing` 6, Jest et ESLint (alertes « modérées » des outils de développement).
- Ne pas migrer le SDK Firebase du navigateur vers la v13 : il sera remplacé par le serveur OVH.
- Mise à jour automatique des dépendances (Dependabot) avec CI obligatoire.

Réalisé :
- **Connexion par clé d'accès réparée** (`functions/api/auth.js`, nouveau `fido-credentials.js`). Le code
  utilisait l'interface de SimpleWebAuthn v10 avec la v13 installée : enregistrer une clé plantait et la
  connexion échouait toujours. Autre bug : l'identifiant du document Firestore était en base64, qui contient
  souvent « / » (environ une clé sur deux), refusé par Firestore ; les nouveaux documents sont en base64url,
  les anciens restent lus. `@simplewebauthn/server` 14.1 (2 failles modérées corrigées en 14.0.2). Test de
  bout en bout avec une clé d'accès simulée (vraie signature P-256) : `tests/fido-passkeys.test.js` (13 cas,
  dont hameçonnage, rejeu, signature falsifiée) ; l'ancien code en échoue 8.
- Mises à jour mineures (site : Capacitor 8.6, Vite 8.3.6… ; serveur : firebase-functions 7.4, nodemailer
  10.4…). Outils de développement : `glob` 14 et `minimatch` 11 imposés (`overrides`) ; reste 1 alerte faible
  (`deepmerge`, utilisé par Jest, aucun correctif publié). Code livré aux utilisateurs et serveur : 0 faille.
- **Non fait, volontairement** : `firebase-admin` 14 supprime `admin.firestore()`, `admin.auth()`… utilisés
  plus de 90 fois : réécriture du serveur Firebase inutile avant son remplacement par OVH (la v13 n'a aucune
  faille connue). `@firebase/rules-unit-testing` 6 exige firebase 13 et Node 24.
- `.github/dependabot.yml` : propositions hebdomadaires groupées (site, outils, serveur, serveur souverain),
  mensuelles (actions GitHub, Android) ; majeures de firebase, rules-unit-testing et firebase-admin ignorées.
  Pour rendre la CI obligatoire avant fusion : règle de protection de la branche `main` dans GitHub.
- GitHub annonçait 57 alertes sur le dépôt miroir (3 critiques, 24 élevées) ; l'audit npm n'en trouve
  aucune critique ou élevée dans les trois projets. Liste à vérifier sur la page Dependabot du dépôt.

### Étape 7 — Android et documentation (½ journée)

- Garder la seule TWA (`app/`) pour le Play Store ; archiver la version Capacitor (`android/`) jusqu'au projet iPhone, où elle servira au Bluetooth de la boîte noire.
- Regrouper les 21 documents de `docs/` : un document d'architecture à jour, un historique des audits, un guide de publication (site, Firebase, Play Store). Mettre à jour `CLAUDE.md`.

## 4. Ordre conseillé et effort

| Étape | Effort | Gain principal |
| :--- | :--- | :--- |
| 1. Ménage | ½ j | -7 600 lignes mortes, dépôt allégé de 31 Mo, clé Play Store protégée |
| 2. Filet de sécurité | 1 j | Les étapes suivantes deviennent sûres |
| 3. CSP stricte | 1 j | Protection forte contre l'injection de code |
| 4. Couche de données | 3–5 j | Migration OVH domaine par domaine |
| 5. Modules | 2–3 sem. | Code maintenable, démarrage plus rapide |
| 6. Dépendances | ½ j | Outils à jour |
| 7. Android, docs | ½ j | Clarté |

Les étapes 1 à 3 tiennent en 2 à 3 jours et réduisent fortement le risque. Les étapes 4 et 5 se font en parallèle de la migration OVH.
