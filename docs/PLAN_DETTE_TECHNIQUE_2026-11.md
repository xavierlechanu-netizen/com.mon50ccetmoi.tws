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

### Étape 2 — Filet de sécurité de l'interface (1 jour)

- Tests de fumée dans un vrai navigateur (Playwright) : chaque page se charge sans erreur, les écrans principaux s'ouvrent, aucun bouton de la barre n'est mort. Lancés par la CI avant chaque publication.
- Budget de poids : la CI échoue si le code chargé au démarrage grossit de plus de 5 %.
- Sortir les fonctions pures de `app-core.js` (calculs de vitesse, d'itinéraire, de consentement) dans des modules testés.

### Étape 3 — Supprimer les derniers `onclick` et durcir la CSP (1 jour)

- Remplacer les 58 `onclick=` par `data-action` (le système sécurisé du projet).
- Retirer `'unsafe-inline'` des scripts dans la CSP : c'est le dernier gros verrou contre les injections de code.
- Garde-fou : un test interdit tout nouveau `onclick=`.

### Étape 4 — Une couche d'accès aux données unique (3 à 5 jours, prépare OVH)

- Regrouper les 130 accès Firestore du navigateur derrière un module unique par domaine (comptes, dangers, communauté, garages, boîte noire, paiements).
- Ajouter l'interrupteur `CONFIG.BACKEND_MODE = "FIREBASE" | "SOVEREIGN"` prévu par la Phase A : la migration OVH se fera ensuite domaine par domaine, sans toucher au reste.
- Même chose pour `localStorage` : un module de stockage local, avec des clés déclarées en un seul endroit.

### Étape 5 — Découper l'application en modules (2 à 3 semaines, progressif)

- Passer des 81 scripts qui communiquent par `window` (489 globales) à de vrais imports entre modules, rangés par fonctionnalité (`carte/`, `communauté/`, `boîte-noire/`, `assistant/`…).
- Charger à la demande les fonctions rares (avocat de poche, certificats, diagnostic, marché du carbone…) : démarrage plus rapide.
- Découper `app-core.js` (2 063 lignes), `app-features.js` (1 493) et `app-map.js` (1 226).
- Remplacer progressivement les `innerHTML` par des créations d'éléments (`textContent`) : moins de `eslint-disable`, moins de risque XSS.
- Méthode : un module à la fois, avec les tests de l'étape 2 comme filet.

### Étape 6 — Dépendances et outillage (½ journée, puis en continu)

- `firebase-admin` 14 et `@simplewebauthn/server` 14 (serveur), `@firebase/rules-unit-testing` 6, Jest et ESLint (alertes « modérées » des outils de développement).
- Ne pas migrer le SDK Firebase du navigateur vers la v13 : il sera remplacé par le serveur OVH.
- Mise à jour automatique des dépendances (Dependabot) avec CI obligatoire.

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
