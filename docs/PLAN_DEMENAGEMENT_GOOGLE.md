# Plan de déménagement : quitter Google pour OVHcloud

*Inventaire du 15/11/2026, à partir du code de `main` (f183442).*

Objectif : plus aucune donnée ni aucun service chez Google. Tout tourne sur le VPS OVHcloud de
Gravelines (`sovereign-core/`), commandé le 14/11/2026 ; son installation est prête
(`sovereign-core/deploy/README.md`).

> **Situation de départ** : la facturation Google du projet Firebase est coupée. Les Cloud Functions
> ne répondent plus (erreur 500) : paiements, météo, copilote IA, SOS, connexion par clé d'accès…
> Chaque étape de ce plan **rend un service qui ne marche plus aujourd'hui**.

## 1. Les cartons : ce qui dépend encore de Google

| Carton | Ce qu'il contient | Taille |
| :--- | :--- | :--- |
| **Comptes** (Firebase Auth) | Email + mot de passe, connexion Google (`inline-login-3.js`), clés d'accès FIDO, suivi de session (`onAuthStateChanged`, 11 endroits) | 1 carton lourd |
| **Données** (Firestore) | ~57 collections lues ou écrites par l'appli, dans 53 fichiers de `src/js/` | le gros du déménagement |
| **Temps réel** (Firestore `onSnapshot`) | 23 écoutes dans 18 fichiers : cortège, convois, chats d'équipe, radar social, SOS, dangers, bourse d'échange… | à repenser (WebSocket) |
| **Fonctions serveur** (Cloud Functions) | 33 fonctions : paiements Revolut, points, SOS, Boîte Noire, assureurs, garages, FIDO, météo, Légifrance, Notion, Facebook, copilote Gemini, analyses | à réécrire en routes du serveur |
| **IA** (Gemini) | Copilote vocal Nexus Atlas (`nexus-atlas-gemini.js`, `functions/api/`) | → Mistral (OVHcloud AI Endpoints) |
| **Mesure et anti-robot** | Firebase Analytics (2 appels), App Check / reCAPTCHA | à retirer ou remplacer |
| **Polices** (Google Fonts) | 17 pages sur 32 chargent leurs polices chez Google (adresse IP des visiteurs transmise à Google) | petit carton, rapide |
| **Hébergement** (Firebase Hosting) | mon50ccetmoi.web.app | à fermer : le site vit déjà sur GitHub Pages |

### Les collections Firestore, regroupées par usage

| Domaine | Collections | Déjà prévu dans le serveur souverain ? |
| :--- | :--- | :--- |
| Comptes et profils | `users`, `usernames`, `auth_logs`, `presence`, `beta_testers` | ✅ inscription, connexion, RGPD |
| Dangers et points | `hazards`, `gamification_stats`, `weekly_stats`, `leaderboard`, `history`, `referral_rewards`, `loot_drops` | ✅ dangers, points, classement |
| Boîte Noire et preuves | `blackbox_units`, `blackbox_registry`, `blackbox_sales`, `crash_reports`, `obd_sessions`, `battery_certificates` | ✅ télémétrie signée, boîtiers, usine |
| Assureurs et litiges | `insurer_reports`, `litigation_previews`, `litigation_proposals`, `payment_confirmations`, `complaints_official` | ⚠️ webhook Revolut seulement |
| Social et temps réel | `crews`, `members`, `crew_chats`, `messages`, `convoys`, `cortege_sessions`, `positions`, `social_radar`, `moods`, `sos_alerts`, `helpers`, `territory_sectors` | ❌ à faire (WebSocket) |
| Garages et entretien | `maintenance_logs`, `garage_evaluations`, `garage_trades`, `pit_stops`, `stats` | ❌ à faire |
| Bourse et roadbooks | `exchange_listings`, `exchange_messages`, `marketplace`, `roadbooks`, `community_roadbooks`, `trips`, `blacklist_stations` | ❌ à faire |
| Modération et admin | `mod_logs`, `mod_appeals`, `reports_abuse`, `banned_ips`, `admin_alerts` | ❌ à faire |
| Copilote | `nexus_conversations`, `nexus_suggestions` | ❌ avec Mistral |

Le serveur souverain a aujourd'hui 12 routes (`/api/v1/auth/*`, `hazards`, `points/transact`,
`leaderboard`, `telemetry/upload`, `rgpd/account`, `webhooks/revolut`, usine et admin Boîte Noire).
Le SDK client (`sovereign-core/client/sovereign-sdk.js`) n'en couvre encore qu'une partie.

## 2. Ordre du déménagement

Chaque étape passe par l'interrupteur `CONFIG.BACKEND_MODE = "SOVEREIGN" | "FIREBASE"` (phase A du
plan OVHcloud) : on bascule un domaine à la fois, et on peut revenir en arrière.

| Étape | Contenu | Pourquoi à ce moment-là |
| :--- | :--- | :--- |
| **0. Installer le VPS** | Guide `sovereign-core/deploy/README.md` : Object Storage, DNS `api`, installation, `check.sh` | Prêt, attend la livraison |
| **1. Petits cartons sans risque** | Polices hébergées sur le site (fin de Google Fonts), retrait de Firebase Analytics | Rapide, utile pour le RGPD, ne dépend pas du VPS |
| **2. Comptes** | Connexion par le serveur souverain ; vérification des mots de passe Firebase (voir § 3) ; comptes Google ; clés d'accès FIDO | Tout le reste en dépend |
| **3. Dangers, points, classement** | Routes déjà écrites : brancher l'appli dessus | Le cœur de l'appli, déjà prêt côté serveur |
| **4. Paiements et assureurs** | Création de commande Revolut, rapports et litiges, abonnements | Les paiements sont coupés aujourd'hui : c'est de l'argent qui ne rentre pas |
| **5. Boîte Noire** | Télémétrie signée (prête), boîtiers, certificats batterie | Indépendant du lancement du boîtier, mais prêt pour lui |
| **6. Temps réel** | WebSocket sur le VPS (Caddy le gère déjà) : cortège, convois, chats, radar, SOS | Le plus gros chantier technique |
| **7. Garages, bourse, roadbooks** | Routes simples de lecture et d'écriture | Peu de risques |
| **8. Services extérieurs** | Copilote Mistral, météo (Météo-France), Légifrance, Notion, Facebook | Chacun indépendant |
| **9. Déménagement des données** | Export Firestore → script d'import PostgreSQL, vérifié par comptage | Juste avant la bascule finale |
| **10. Fermer Google** | Firebase Hosting, Auth, Firestore, projet Google Cloud | Quand plus rien ne lit Firebase |

## 3. Points délicats

- **Mots de passe** : Firebase les garde chiffrés avec sa propre variante de scrypt, et ne les donne
  jamais en clair. Le meilleur choix : le serveur souverain sait **vérifier ce format** à la première
  connexion, puis réenregistre le mot de passe dans son propre format. Bascule invisible pour les
  utilisateurs. (L'export des comptes Firebase fournit les empreintes et les paramètres nécessaires.)
- **Connexion avec Google** : par définition liée à Google. Ces comptes passeront à l'email
  (lien de connexion envoyé par email, ou mot de passe à choisir).
- **Temps réel** : Firestore pousse les changements tout seul. Il faudra un WebSocket sur le VPS ;
  le VPS-2 (4 vCPU, 8 Go) suffit largement au démarrage.
- **Anti-robot** : App Check (reCAPTCHA) disparaît ; à remplacer par des limites de requêtes côté
  serveur (déjà en place pour la connexion) et, si besoin, une solution européenne.
- **Notifications push** : à vérifier au moment de l'étape 6 (aucun usage de Firebase Messaging
  trouvé dans le code).

## 4. Ce qui ne bouge pas

- **Le site** reste sur GitHub Pages (mon50ccetmoi.com).
- **Les cartes** sont déjà sans Google (IGN + Leaflet + OpenStreetMap).
- **L'appli Android** (TWA) ouvre le site : elle suit sans nouvelle publication, sauf changement de domaine.
