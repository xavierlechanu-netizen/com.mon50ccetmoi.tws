<![CDATA[# 🏗️ Architecture Technique — mon 50cc et moi

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        UTILISATEUR                               │
│                   (Navigateur / Android TWA)                     │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│   FRONTEND (PWA)         │    │   GOOGLE MAPS API            │
│                          │    │                              │
│  index.html              │    │  • Directions API            │
│  ├── js/ (59 modules)    │    │  • Geometry Library          │
│  ├── css/ (2 fichiers)   │    │  • Places Library            │
│  └── sw.js (cache)       │    │  • Marker Library            │
└──────────┬───────────────┘    └──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                    FIREBASE PLATFORM                          │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │  Auth       │  │  Firestore   │  │  Cloud Functions  │   │
│  │             │  │  (16 coll.)  │  │  (3 endpoints)    │   │
│  │ • Email/Pwd │  │              │  │                   │   │
│  │ • Google    │  │ • users      │  │ • createOrder     │   │
│  │ • FIDO2     │  │ • hazards    │  │ • webhook         │   │
│  │ • Guest     │  │ • blackbox   │  │ • checkStatus     │   │
│  └─────────────┘  └──────────────┘  └────────┬──────────┘   │
│                                               │              │
│  ┌─────────────┐  ┌──────────────┐            │              │
│  │  Hosting    │  │  Secret Mgr  │            │              │
│  │  (CDN)      │  │  (API Keys)  │            │              │
│  └─────────────┘  └──────────────┘            │              │
└───────────────────────────────────────────────┼──────────────┘
                                                │
                                                ▼
                                   ┌─────────────────────────┐
                                   │   REVOLUT MERCHANT API  │
                                   │                         │
                                   │  • Création d'ordres    │
                                   │  • Webhooks paiement    │
                                   │  • Confirmation auto    │
                                   └─────────────────────────┘
```

---

## Modules JavaScript (59 fichiers)

### Couche Core (Moteur principal)

| Module | Taille | Responsabilité |
|---|---|---|
| `app-core.js` | 78 Ko | Moteur GPS, routage sans autoroute, boucle principale |
| `app-map.js` | 31 Ko | Abstraction Google Maps / Leaflet, marqueurs, polylines |
| `app-ui.js` | 57 Ko | Interface utilisateur, modales, transitions, dock |
| `app-features.js` | 34 Ko | Fonctionnalités avancées (signalements, balades, etc.) |
| `app-wallet.js` | 2,4 Ko | Gestion du portefeuille in-app |
| `app-garage.js` | 29 Ko | Gestion véhicule, profil moto, entretien |
| `config.js` | 2,9 Ko | Configuration (clés API, Firebase config) |
| `infallible.js` | 3,9 Ko | Watchdog anti-crash global |

### Couche Sécurité

| Module | Taille | Responsabilité |
|---|---|---|
| `auth.js` | 14,6 Ko | Firebase Auth, sessions chiffrées, login/register |
| `crypto-native.js` | 26 Ko | Chiffrement AES-256, gestion de clés |
| `zero-trust.js` | 5,2 Ko | Architecture sécurité Zero Trust |
| `quantum-crypto.js` | 2 Ko | Chiffrement post-quantique (préparation) |
| `rgpd-cnil.js` | 2,9 Ko | Conformité RGPD, consentement cookies |

### Couche Protection (Ange Gardien)

| Module | Taille | Responsabilité |
|---|---|---|
| `guardian-angel.js` | 8,7 Ko | Détection de chute par analyse G-Force |
| `sentinel-v2.js` | 6,2 Ko | Prévention des risques en temps réel |
| `blackbox.js` | 6 Ko | Enregistrement télémétrique certifié |
| `telemetry.js` | 9,5 Ko | Collecte vitesse, angle, accélération |
| `anti-theft.js` | 4 Ko | Alarme mouvement, géofencing |
| `ghost-rider-v2.js` | 2 Ko | Détection conduite dangereuse |
| `hardware.js` | 4,3 Ko | Accès accéléromètre, gyroscope |
| `tim-cook.js` | 3,3 Ko | Écran SOS style Apple Crash Detection |
| `certified-camera.js` | 10,4 Ko | Capture photo/vidéo horodatée |

### Couche InsurTech (B2B)

| Module | Taille | Responsabilité |
|---|---|---|
| `insurance-portal.js` | 20 Ko | Dashboard assureur complet |
| `insurer-portal.js` | 4,8 Ko | Login/achat assureur |
| `litigation-ai.js` | 20,5 Ko | Reconstitution d'accident par IA |
| `pocket-lawyer.js` | 9,9 Ko | Assistant juridique IA |
| `certificate.js` | 4 Ko | Génération de certificats blockchain |

### Couche IA & Voix

| Module | Taille | Responsabilité |
|---|---|---|
| `oracle-voice.js` | 10,9 Ko | Assistant vocal principal |
| `jarvis-voice.js` | 5,4 Ko | Synthèse vocale multilingue |
| `neural-hud.js` | 20,4 Ko | HUD holographique temps réel |
| `neural-sync.js` | 1,8 Ko | Synchronisation inter-modules IA |
| `self-evolution.js` | 4,9 Ko | Auto-apprentissage IA |
| `predictive-meca.js` | 1 Ko | Maintenance prédictive |
| `meca-wizard.js` | 11 Ko | Assistant mécanique IA |

### Couche Communauté & Social

| Module | Taille | Responsabilité |
|---|---|---|
| `social-map.js` | 4,6 Ko | Positions riders en temps réel |
| `intercom.js` | 2,6 Ko | Communication vocale entre pilotes |
| `moderation.js` | 1,3 Ko | Modération communautaire |
| `moderation-bot.js` | 2,2 Ko | Bot de modération automatique |
| `arbitre-bot.js` | 9 Ko | Arbitrage automatique des conflits |
| `secbot.js` | 15,6 Ko | Bot de sécurité avancé |
| `habits.js` | 2,7 Ko | Apprentissage des habitudes |
| `chronos.js` | 2,9 Ko | Historique et temps de conduite |

### Couche Web3 & Économie

| Module | Taille | Responsabilité |
|---|---|---|
| `wallet.js` | 4,3 Ko | Portefeuille utilisateur |
| `web4-mining.js` | 4 Ko | Minage Ride-to-Earn |
| `web4-recovery.js` | 2,7 Ko | Récupération de wallet |
| `carbon-trading.js` | 4,3 Ko | Crédits carbone tokenisés |

### Couche Data & Infra

| Module | Taille | Responsabilité |
|---|---|---|
| `database.js` | 14,6 Ko | Abstraction Firestore CRUD |
| `i18n.js` | 22 Ko | Internationalisation |
| `vehicle-config.js` | 3,5 Ko | Configuration véhicule |
| `beyond-maps.js` | 4,4 Ko | Fonctionnalités carto avancées |
| `offline-map.js` | 21 Ko | Navigation hors-ligne |

---

## Collections Firestore (16)

| Collection | Lecture | Écriture | Description |
|---|---|---|---|
| `users` | Public | Propriétaire/Admin | Profils utilisateurs |
| `blackbox_reports` | Propriétaire/Admin/Débloqué | Utilisateur authentifié (create only) | Rapports boîte noire **immuables** |
| `ants_wallet` | Propriétaire | Propriétaire | Coffre-fort ANTS |
| `guardian_sessions` | Public (partage urgence) | Propriétaire | Sessions Ange Gardien |
| `hazards` | Public | Utilisateur authentifié | Alertes communautaires |
| `balades` | Public | Propriétaire | Sessions de balades |
| `presence` | Public | Propriétaire (par username) | Position temps réel |
| `moods` | Public | Propriétaire (par username) | Humeurs sociales |
| `emergency_alerts` | Public | Propriétaire | Alertes SOS |
| `reports_abuse` | Authentifié | Authentifié | Signalements d'abus |
| `blacklist_stations` | Public | Authentifié | Stations blacklistées |
| `complaints_official` | Admin | Authentifié | Plaintes officielles |
| `admin_alerts` | Admin | Authentifié | Alertes admin |
| `garage_evaluations` | Public | Authentifié | Évaluations garages |
| `community_roadbooks` | Public | Authentifié | Roadbooks partagés |
| `revolut_orders` | Propriétaire | Cloud Functions uniquement | Ordres de paiement Revolut |
| `payment_confirmations` | Propriétaire | Cloud Functions uniquement | Confirmations de paiement |
| `litigation_proposals` | Propriétaire/Admin | Propriétaire (create) | Propositions de litige IA |

---

## Cloud Functions (3 endpoints)

### `createRevolutOrder` (POST)
```
Endpoint : https://europe-west1-mon50ccetmoi.cloudfunctions.net/createRevolutOrder
Auth     : Firebase Secret Manager (REVOLUT_SECRET_KEY)
CORS     : https://mon50ccetmoi.com

Body (JSON) :
{
  "case_id":     "LIT-XXXX",       // Référence du litige
  "user_id":     "firebase_uid",    // UID Firebase de l'acheteur
  "report_type": "SIMPLE|INTERMEDIAIRE|EXPERT"
}

Réponse :
{
  "order_id":    "revolut_id",
  "order_token": "token_for_checkout",
  "amount":      4990,              // Centimes (forcé côté serveur)
  "currency":    "EUR",
  "status":      "PENDING"
}

Sécurité : Le montant est TOUJOURS forcé côté serveur selon le report_type.
           SIMPLE=49.90€, INTERMEDIAIRE=89.99€, EXPERT=149.99€
```

### `revolutWebhook` (POST)
```
Endpoint : https://europe-west1-mon50ccetmoi.cloudfunctions.net/revolutWebhook
Auth     : Revolut Dashboard (configurer l'URL du webhook)

Événements gérés :
  - ORDER_COMPLETED    → Déblocage rapport + mise à jour Firestore (batch)
  - ORDER_PAYMENT_DECLINED → Marquage échec

Actions sur ORDER_COMPLETED :
  1. Met à jour revolut_orders (status: COMPLETED)
  2. Débloque litigation_proposals (report_unlocked: true)
  3. Crée payment_confirmations (preuve de paiement)
```

### `checkPaymentStatus` (GET)
```
Endpoint : https://europe-west1-mon50ccetmoi.cloudfunctions.net/checkPaymentStatus
CORS     : https://mon50ccetmoi.com

Params : ?case_id=LIT-XXXX&user_id=firebase_uid

Réponse :
{
  "paid":             true|false,
  "status":           "COMPLETED|PENDING",
  "revolut_order_id": "...",
  "report_type":      "SIMPLE|INTERMEDIAIRE|EXPERT",
  "confirmed_at":     "ISO 8601"
}
```

---

## Flux de Paiement B2B

```
Assureur                    Frontend                 Cloud Function           Revolut API
   │                           │                          │                       │
   │  1. Choisit un rapport    │                          │                       │
   │──────────────────────────►│                          │                       │
   │                           │  2. POST createOrder     │                       │
   │                           │─────────────────────────►│                       │
   │                           │                          │  3. POST /api/orders  │
   │                           │                          │──────────────────────►│
   │                           │                          │  4. order_id + token  │
   │                           │                          │◄──────────────────────│
   │                           │  5. order_token          │                       │
   │                           │◄─────────────────────────│                       │
   │  6. RevolutCheckout(token)│                          │                       │
   │◄──────────────────────────│                          │                       │
   │                           │                          │                       │
   │  7. Paiement réussi       │                          │                       │
   │──────────────────────────►│                          │                       │
   │                           │                          │  8. Webhook COMPLETED │
   │                           │                          │◄──────────────────────│
   │                           │                          │  9. Unlock rapport    │
   │                           │                          │  (Firestore batch)    │
   │                           │  10. Poll checkStatus    │                       │
   │                           │─────────────────────────►│                       │
   │                           │  11. { paid: true }      │                       │
   │                           │◄─────────────────────────│                       │
   │  12. Rapport débloqué     │                          │                       │
   │◄──────────────────────────│                          │                       │
```

---

## Capteurs Matériels Utilisés

| Capteur | API Web | Usage |
|---|---|---|
| Accéléromètre | `DeviceMotionEvent` | Détection de chute (G-Force) |
| Gyroscope | `DeviceOrientationEvent` | Angle d'inclinaison |
| GPS | `Geolocation API` | Position, vitesse, cap |
| Caméra | `MediaDevices.getUserMedia()` | Caméra certifiée |
| Microphone | `SpeechRecognition API` | Commandes vocales |
| Haut-parleur | `SpeechSynthesis API` | Synthèse vocale IA |
]]>
