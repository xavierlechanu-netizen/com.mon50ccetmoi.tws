<![CDATA[# 📋 Changelog — mon 50cc et moi

Toutes les modifications notables du projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère au [Versionnement Sémantique](https://semver.org/lang/fr/).

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

## [109.00.00] - 2026-08-17 - 🐛 Résolution de Bugs et Améliorations UI

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
