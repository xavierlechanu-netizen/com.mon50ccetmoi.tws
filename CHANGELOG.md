<![CDATA[# 📋 Changelog — mon 50cc et moi

Toutes les modifications notables du projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère au [Versionnement Sémantique](https://semver.org/lang/fr/).

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
- **Jarvis Voice** : synthèse vocale multilingue
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
