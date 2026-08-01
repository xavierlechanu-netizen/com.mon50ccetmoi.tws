<![CDATA[<div align="center">

# 🏍️ mon 50cc et moi

### Le copilote IA pour les conducteurs de 50cc et Voitures Sans Permis

[![Version](https://img.shields.io/badge/version-101.00.02-gold?style=for-the-badge)](https://mon50ccetmoi.com)
[![Platform](https://img.shields.io/badge/platform-PWA%20%7C%20Android-00d2ff?style=for-the-badge)](https://play.google.com/store/apps/details?id=com.mon50ccetmoi.twa)
[![License](https://img.shields.io/badge/license-Proprietary-ff0055?style=for-the-badge)](#licence)
[![Firebase](https://img.shields.io/badge/backend-Firebase-ffca28?style=for-the-badge&logo=firebase)](https://firebase.google.com)
[![Status](https://img.shields.io/badge/status-Production-00e676?style=for-the-badge)](#)

**🌐 [mon50ccetmoi.com](https://mon50ccetmoi.com)**

---

*La première application dédiée aux conducteurs de scooters 50cc et voitures sans permis.*
*Navigation intelligente sans autoroute, détection de chute, boîte noire certifiée, et portail assureur B2B.*

</div>

---

## 📋 Table des matières

- [Le Problème](#-le-problème)
- [La Solution](#-la-solution)
- [Fonctionnalités](#-fonctionnalités)
- [Stack Technique](#-stack-technique)
- [Architecture](#-architecture)
- [Modèle Économique](#-modèle-économique)
- [Installation & Déploiement](#-installation--déploiement)
- [Sécurité & Conformité](#-sécurité--conformité)
- [Roadmap](#-roadmap)
- [Licence](#-licence)

---

## 🎯 Le Problème

En France, **+2,5 millions** de conducteurs roulent en 50cc ou en voiture sans permis (VSP). Pourtant :

- ❌ Aucune application GPS ne propose de **routage sans autoroute par défaut**
- ❌ Aucune app ne propose de **détection de chute** pour deux-roues légers
- ❌ Les assureurs n'ont **aucune donnée télémétrique** en cas de sinistre
- ❌ Aucune **communauté dédiée** n'existe pour cette catégorie de véhicules

---

## 💡 La Solution

**mon 50cc et moi** est une application tout-en-un qui transforme le smartphone du conducteur en :

| 🗺️ GPS Intelligent | 🛡️ Ange Gardien | 📋 Boîte Noire | 💼 InsurTech B2B |
|---|---|---|---|
| Routage sans autoroute | Détection de chute (G-Force) | Enregistrement télémétrique | Rapports d'expertise vendus aux assureurs |
| Alertes communautaires | Alerte SOS automatique | Horodatage certifié | Portail professionnel sécurisé |
| Navigation vocale IA | Contacts d'urgence | Preuve juridique | Paiement intégré (Revolut) |

---

## ✨ Fonctionnalités

### 🗺️ Navigation & Cartographie
- **GPS sans autoroute** — Routage intelligent qui exclut automatiquement les voies interdites aux 50cc
- **Google Maps + Leaflet** — Double moteur cartographique avec fallback hors-ligne
- **Alertes communautaires** — Signalement en temps réel : police, routes dégradées, animaux, dangers
- **Navigation vocale IA** — Assistant Oracle avec synthèse vocale multilingue (7000+ langues)

### 🛡️ Sécurité (Ange Gardien)
- **Détection de chute** — Analyse en temps réel des données G-Force via accéléromètre
- **Alerte SOS automatique** — Compte à rebours de 10 secondes avant appel aux urgences
- **Contacts d'urgence** — Notification automatique aux proches en cas de chute grave
- **Anti-vol** — Détection de mouvement et géofencing

### 📋 Boîte Noire Certifiée
- **Enregistrement télémétrique** — Vitesse, angle, G-Force, trajectoire GPS
- **Horodatage cryptographique** — Preuve immuable et non-falsifiable
- **Caméra certifiée** — Capture photo/vidéo horodatée pour constat
- **Export rapport** — Génération de rapports d'expertise pour assureurs

### 💼 Portail Assureur B2B (InsurTech)
- **Dashboard professionnel** — Connexion sécurisée pour les compagnies d'assurance
- **Achat de rapports** — 3 niveaux d'expertise (Standard 49.99€, Intermédiaire 89.99€, Expert 199.99€)
- **Paiement Revolut** — Intégration complète avec webhooks et confirmation automatique
- **Reconstitution IA** — Analyse prédictive de l'accident (niveau Expert)

### 🤖 Intelligence Artificielle
- **Oracle** — Assistant vocal contextuel pour la navigation
- **Jarvis** — Traducteur universel multilingue
- **Neural HUD** — Affichage tête haute holographique
- **Meca Wizard** — Assistant mécanique prédictif

### 💰 Économie & Gamification
- **Ride-to-Earn** — Minage de tokens BVC à chaque kilomètre
- **Système XP** — Expérience et niveaux de pilote
- **Hall of Fame** — Classement communautaire
- **Bilan Carbone** — Suivi de l'empreinte écologique vs voiture

---

## 🛠️ Stack Technique

| Couche | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 (Glassmorphism/Cyberpunk), JavaScript ES6+ |
| **Cartographie** | Google Maps API (Geometry, Places, Marker) + Leaflet (hors-ligne) |
| **Backend** | Firebase (Auth, Firestore, Cloud Functions, Hosting) |
| **Paiement** | Revolut Merchant API (SDK embed + webhooks) |
| **Sécurité** | CryptoJS (AES-256), WebAuthn/FIDO2, Architecture Zero Trust |
| **PWA** | Service Worker, Cache API, Web App Manifest (Fullscreen) |
| **Android** | TWA (Trusted Web Activity) via Bubblewrap CLI |
| **IA / Voix** | Web Speech API (SpeechSynthesis + SpeechRecognition) |
| **Capteurs** | DeviceMotion API, DeviceOrientation API, Geolocation API |
| **Temps réel** | Firestore Realtime Listeners, Presence System |

---

## 🏗️ Architecture

```
mon50ccetmoi/
├── index.html              # Application principale (PWA)
├── login.html              # Authentification (Firebase Auth + Google + FIDO2)
├── assureur.html           # Portail assureur B2B
├── partenaires.html        # Dashboard partenaires B2B
├── admin.html              # Console d'administration
├── manifest.json           # Web App Manifest (PWA)
├── sw.js                   # Service Worker (cache hors-ligne)
├── firebase.json           # Configuration Firebase Hosting
├── firestore.rules         # Règles de sécurité Firestore (16 collections)
│
├── js/                     # 59 modules JavaScript
│   ├── app-core.js         # Moteur principal (GPS, routage, navigation)
│   ├── app-map.js          # Gestion cartographique (Google Maps + Leaflet)
│   ├── app-ui.js           # Interface utilisateur et interactions
│   ├── app-features.js     # Fonctionnalités avancées
│   ├── app-garage.js       # Gestion véhicule et garage virtuel
│   ├── guardian-angel.js   # Détection de chute et SOS
│   ├── blackbox.js         # Enregistrement télémétrique
│   ├── insurance-portal.js # Portail assureur complet
│   ├── litigation-ai.js    # Reconstitution d'accident par IA
│   ├── oracle-voice.js     # Assistant vocal IA
│   ├── auth.js             # Authentification et sessions chiffrées
│   ├── database.js         # Abstraction Firestore
│   └── ...                 # +47 autres modules spécialisés
│
├── css/
│   ├── style.css           # Design system principal (Cyberpunk/Neon)
│   └── premium.css         # Styles premium additionnels
│
├── functions/              # Firebase Cloud Functions (Node.js 20)
│   └── index.js            # 3 endpoints : createRevolutOrder, revolutWebhook, checkPaymentStatus
│
└── docs/                   # Documentation technique
    └── ARCHITECTURE.md     # Diagramme d'architecture détaillé
```

---

## 💰 Modèle Économique

```
┌─────────────────────────────────────────────────────────┐
│                    SOURCES DE REVENUS                     │
├─────────────────┬───────────────────────────────────────┤
│ B2B InsurTech   │ Vente de rapports d'expertise aux     │
│ (Principal)     │ assureurs : 49.99€ / 89.99€ / 199.99€│
├─────────────────┼───────────────────────────────────────┤
│ B2B Partenaires │ Campagnes sponsorisées in-app         │
│                 │ (garages, équipementiers, assurances)  │
├─────────────────┼───────────────────────────────────────┤
│ B2C Premium     │ Fonctionnalités Gold (gratuit < 2032) │
├─────────────────┼───────────────────────────────────────┤
│ Web3            │ Token BVC (Ride-to-Earn)              │
└─────────────────┴───────────────────────────────────────┘
```

---

## 🚀 Installation & Déploiement

### Prérequis
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Compte Firebase avec projet configuré
- Clé API Google Maps (Android + Web)
- Compte Revolut Business (pour les paiements B2B)

### Installation locale
```bash
# Cloner le dépôt
git clone https://github.com/xavierlechanu-netizen/com.mon50ccetmoi.tws.git
cd com.mon50ccetmoi.tws

# Installer les dépendances Cloud Functions
cd functions && npm install && cd ..

# Configurer le secret Revolut
firebase functions:secrets:set REVOLUT_SECRET_KEY

# Lancer en local
firebase serve
```

### Déploiement en production
```bash
# Déployer tout (hosting + functions + rules)
firebase deploy

# Ou déployer séparément
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

### Build Android (APK/AAB)
```bash
# Générer le TWA via Bubblewrap
npx @nicolo-ribaudo/bubblewrap build

# Signer l'AAB
jarsigner -keystore upload-keystore.jks app-release-unsigned.aab upload
```

---

## 🔒 Sécurité & Conformité

| Domaine | Implémentation |
|---|---|
| **Authentification** | Firebase Auth + Google Sign-In + WebAuthn FIDO2 |
| **Chiffrement** | AES-256 (CryptoJS) pour les données locales |
| **Sessions** | Sessions chiffrées avec expiration automatique |
| **Firestore** | 16 collections avec règles granulaires (read/write par rôle) |
| **Cloud Functions** | Clés API en Secret Manager, validation serveur des montants |
| **CORS** | Origine restreinte à `mon50ccetmoi.com` |
| **RGPD** | Consentement cookies, politique de confidentialité, droit à l'oubli |
| **PWA** | CSP (Content Security Policy) configurée |
| **Paiement** | Revolut Merchant API avec webhook sécurisé |
| **Kill Switch** | Protocole 0 : effacement d'urgence de toutes les données |

---

## 🗺️ Roadmap

| Version | Statut | Fonctionnalités clés |
|---|---|---|
| v1.0 – v20.0 | ✅ Livré | GPS de base, interface initiale |
| v30.0 – v40.0 | ✅ Livré | Communauté, alertes, système de points |
| v50.0 | ✅ Livré | Publication Google Play Store, Firebase Auth |
| v60.0 | ✅ Livré | Portail Assureur B2B, Revolut, Litige IA, FIDO2 |
| v70.0 | ✅ Livré | Architecture modulaire, Neural HUD, Self-Evolution |
| v80.0 | ✅ Livré | OBD-II Bluetooth (HUD Temps réel), Compatibilité Android 16 |
| v101.00.02 | ✅ Actuel | API Vigilance Météo-France officielle et sécurisation de production |
| v102.00.00 | 🔜 Prévu | Réalité Augmentée pour la navigation, App Apple Watch / Wear OS |
| v90.0 | 📋 Planifié | Marketplace pièces, assurance intégrée, API ouverte |

---

## 📊 Métriques Clés

| Métrique | Valeur |
|---|---|
| Lignes de code | ~35 000+ |
| Modules JavaScript | 59 |
| Collections Firestore | 16 |
| Cloud Functions | 3 endpoints |
| Pages HTML | 8 |
| Versions publiées | 60+ |
| Langues supportées | 7000+ (via synthèse vocale IA) |

---

## 👥 Équipe

Développé par **Xavier Le Chanu** — Développeur full-stack, passionné de mobilité urbaine et de sécurité routière.

---

## 📄 Licence

Ce projet est propriétaire. Tous droits réservés © 2024-2026 mon50ccetmoi.

L'utilisation, la copie, la modification ou la distribution du code source sans autorisation écrite est interdite.

---

<div align="center">

**🏍️ Roulez en sécurité. Roulez connecté.**

[Site Web](https://mon50ccetmoi.com) · [Google Play](https://play.google.com/store/apps/details?id=com.mon50ccetmoi.twa) · [Contact](mailto:contact@mon50ccetmoi.com)

</div>
]]>
