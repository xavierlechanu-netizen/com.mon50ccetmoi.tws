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
| **IA** (Gemini) | Copilote vocal Nexus Atlas (`nexus-atlas-gemini.js`, `functions/api/`) | **Fait** (19/11/2026) : cerveau mixte, Nexus Atlas d'abord puis Mistral 7B **sur le VPS** (gratuit, sans service extérieur), jamais pour une urgence ; carnet d'apprentissage vérifié (`admin-nexus.html`). Restent sur Gemini : quiz du Code de la route et coach de progression |
| **Mesure et anti-robot** | Firebase Analytics (2 appels), App Check / reCAPTCHA | **Fait** (19/11/2026) : Analytics retiré, App Check retiré (jamais activé) |
| **Polices** (Google Fonts) | 17 pages sur 32 chargent leurs polices chez Google (adresse IP des visiteurs transmise à Google) | petit carton, rapide |
| **Hébergement** (Firebase Hosting) | mon50ccetmoi.web.app | **Éteint** le 19/11/2026 (`firebase hosting:disable`) : le site vit sur le VPS |

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
`leaderboard`, `telemetry/upload`, `rgpd/account`, `webhooks/revolut`, usine et admin Boîte Noire),
plus, depuis, l'alerte SOS (`sos`) et la vigilance Météo-France (`meteo/vigilance`, 16/11/2026).
Le SDK client (`sovereign-core/client/sovereign-sdk.js`) n'en couvre encore qu'une partie.

## 2. Ordre du déménagement

Chaque étape passe par l'interrupteur `CONFIG.BACKEND_MODE = "SOVEREIGN" | "FIREBASE"` (phase A du
plan OVHcloud) : on bascule un domaine à la fois, et on peut revenir en arrière.

| Étape | Contenu | Pourquoi à ce moment-là |
| :--- | :--- | :--- |
| **0. Installer le VPS** | Guide `sovereign-core/deploy/README.md` : Object Storage, DNS `api`, installation, `check.sh` | Prêt, attend la livraison |
| **1. Petits cartons sans risque** | Polices hébergées sur le site (fin de Google Fonts), retrait de Firebase Analytics | Rapide, utile pour le RGPD, ne dépend pas du VPS |
| **2. Comptes** | Connexion par le serveur souverain ; vérification des mots de passe Firebase (voir § 3) ; comptes Google ; clés d'accès FIDO. **Interrupteur prêt** (18/11/2026, voir § 6) : connexion, inscription, déconnexion et les 11 suivis de session passent par `src/js/comptes.js` ; reste sur `"FIREBASE"` jusqu'à l'import des comptes | Tout le reste en dépend |
| **3. Dangers, points, classement** | Routes déjà écrites : brancher l'appli dessus | Le cœur de l'appli, déjà prêt côté serveur |
| **4. Paiements et assureurs** | Création de commande Revolut, rapports et litiges, abonnements. **Paiements codés** (18/11/2026, § 7) : rien en vente tant que vous ne l'avez pas décidé, droit d'entrée garage d'abord, interrupteur `paiements` sur `"FIREBASE"` | Les paiements sont coupés aujourd'hui : c'est de l'argent qui ne rentre pas |
| **5. Boîte Noire** | Télémétrie signée (prête), boîtiers, certificats batterie | Indépendant du lancement du boîtier, mais prêt pour lui |
| **6. Temps réel** | WebSocket sur le VPS (Caddy le gère déjà) : cortège, convois, chats, radar, SOS | Le plus gros chantier technique |
| **7. Garages, bourse, roadbooks** | Routes simples de lecture et d'écriture | Peu de risques |
| **8. Services extérieurs** | Copilote Mistral, ~~météo (Météo-France)~~ **prête** (16/11/2026 : route publique `GET /api/v1/meteo/vigilance`, appli branchée dessus ; reste à coller `METEO_FRANCE_API_KEY` sur le VPS, `deploy/README.md` étape 9 bis), Légifrance, Notion, Facebook | Chacun indépendant |
| **9. Déménagement des données** | Export Firestore → script d'import PostgreSQL, vérifié par comptage | Juste avant la bascule finale |
| **10. Fermer Google** | Firebase Hosting, Auth, Firestore, projet Google Cloud | Quand plus rien ne lit Firebase |

## 3. Points délicats

- **Mots de passe** : Firebase les garde chiffrés avec sa propre variante de scrypt, et ne les donne
  jamais en clair. Le meilleur choix : le serveur souverain sait **vérifier ce format** à la première
  connexion, puis réenregistre le mot de passe dans son propre format. Bascule invisible pour les
  utilisateurs. (L'export des comptes Firebase fournit les empreintes et les paramètres nécessaires.)
  **Prêt** (15/11/2026) : vérification et conversion dans `sovereign-core/server/crypto-auth.js`,
  import par `sovereign-core/scripts/import-firebase-users.js` ; mode d'emploi dans
  `sovereign-core/deploy/README.md`, étape 11.
- **Connexion avec Google** : par définition liée à Google. Ces comptes passeront à l'email
  (lien de connexion envoyé par email, ou mot de passe à choisir).
- **Temps réel** : Firestore pousse les changements tout seul. Il faudra un WebSocket sur le VPS ;
  le VPS-2 (4 vCPU, 8 Go) suffit largement au démarrage.
- **Anti-robot** : App Check (reCAPTCHA) disparaît ; à remplacer par des limites de requêtes côté
  serveur (déjà en place pour la connexion) et, si besoin, une solution européenne.
- **Notifications push** : à vérifier au moment de l'étape 6 (aucun usage de Firebase Messaging
  trouvé dans le code).

## 4. Quitter aussi GitHub (Microsoft)

Décidé le 15/11/2026 : après Google, GitHub (Microsoft, américain) part aussi. Tout va sur le VPS
de Gravelines, avec des logiciels libres. Codeberg et Framagit, européens, sont exclus : ils sont
réservés aux projets en logiciel libre.

| Aujourd'hui sur GitHub | Remplaçant | Où |
| :--- | :--- | :--- |
| Hébergement du site (GitHub Pages) | Caddy (déjà installé par `deploy/install.sh`) sert `dist/` | VPS |
| Dépôt du code et miroir | **Forgejo** (pull requests, tickets, interface proche de GitHub) | VPS |
| Vérifications (GitHub Actions) | **Forgejo Actions** (relit presque tels quels les fichiers de `.github/workflows/`) | VPS ; travaux lourds (Android, navigateur) sur le PC ou un second petit serveur |
| Mises à jour des dépendances (Dependabot) | **Renovate** auto-hébergé | VPS |
| Analyse de sécurité (CodeQL) | **Semgrep** (logiciel libre), dans les vérifications | VPS |

Ordre, une fois le VPS installé :

1. **Site** : Caddy sert le site sur le VPS ; DNS de `mon50ccetmoi.com` et `www` chez Amen.fr vers
   l'IP du VPS. L'appli Android (TWA) suit, le domaine ne changeant pas (`assetlinks.json` à garder).
   **Prêt** (15/11/2026) : `deploy/publish-site.sh` et le `Caddyfile` ; bascule et retour arrière
   dans `sovereign-core/deploy/README.md`, étapes 10 et 12.
2. **Code** : Forgejo sur le VPS, dépôt importé avec tout son historique, sauvegardé comme la base.
3. **Vérifications** : Forgejo Actions, Renovate, Semgrep.
4. **Fermer** GitHub Pages, puis les dépôts GitHub (principal et miroir).

### Le domaine (registrar)

Le domaine reste chez **Amen.fr** (société européenne) pendant le déménagement : seuls les
enregistrements DNS changent, et l'email **contact@mon50ccetmoi.com** continue de fonctionner.
Plus tard, transfert possible chez OVHcloud pour tout regrouper : code de transfert (AUTH) chez
Amen, zone DNS recopiée **avant** (surtout les **MX** de l'email), environ une semaine de délai.

## 5. Ce qui ne bouge pas

- **Le domaine** `mon50ccetmoi.com` (chez Amen.fr pour l'instant, voir § 4).
- **Les cartes** sont déjà sans Google (IGN + Leaflet + OpenStreetMap).
- **L'appli Android** (TWA) ouvre le site : elle suit sans nouvelle publication, sauf changement de domaine.

## 6. Phase A : l'interrupteur des comptes (18/11/2026)

### Ce qui est fait

- **L'interrupteur** : `CONFIG.BACKEND_MODE` dans `src/js/config.js`, domaine par domaine
  (`comptes` aujourd'hui ; `dangers`, `points`, `paiements` ensuite). Valeur `"FIREBASE"` : rien ne
  change. Valeur `"SOVEREIGN"` : le serveur du VPS (`api.mon50ccetmoi.com`) fait le travail.
  Logique : `src/js/backend-mode.js`.
- **Les comptes** (`src/js/comptes.js`, logique dans `comptes-core.js`) : connexion, inscription,
  déconnexion et « qui est connecté » passent tous par ce module. Ça couvre `auth.js`, les 11 suivis
  de session (`onAuthStateChanged`), les portails assureurs et garages et la page profil.
- **En mode `"SOVEREIGN"`**, le serveur du VPS est **seul juge** du mot de passe. Tant que les données
  (profil, points, dangers…) sont encore dans Firestore, l'appli ouvre aussi Firebase avec le même
  email et le même mot de passe : c'est le **pont Firebase** (`CONFIG.PONT_FIREBASE`). Il disparaîtra
  quand plus rien ne lira Firestore. Sans pont, le pilote reste connecté avec un profil réduit.
- **Rester connecté** : le serveur donne une session d'une heure et un jeton de renouvellement de
  30 jours (route `POST /api/v1/auth/refresh`). Le jeton est refusé si le compte a été effacé (RGPD)
  ou banni. Le mot de passe n'est jamais gardé sur le téléphone.
- **Dès maintenant, en mode `"FIREBASE"`**, la connexion au serveur du VPS (faite en parallèle pour
  l'alerte SOS) est gardée. À la bascule, les pilotes déjà connectés n'auront rien à retaper.
- **Corrigé au passage** : si un deuxième pilote se connectait sur le même téléphone alors que le
  serveur du VPS ne répondait pas, l'alerte SOS restait au nom du premier.
- **Tests** : `tests/comptes-souverains.test.js` (31 cas, contre un vrai serveur souverain), plus le
  renouvellement de session sur un vrai PostgreSQL (`tests/sovereign-pg.test.js`). Vérifié aussi
  dans l'appli, en local : connexion, changement de page, déconnexion, garde des pages admin, mauvais
  mot de passe, inscription.

### Essayer sur un seul téléphone, sans rien changer pour les autres

Une fois les comptes importés, ouvrir
`https://mon50ccetmoi.com/login.html?essai-souverain=comptes`, puis se connecter normalement. Le
choix est gardé sur ce téléphone. Pour revenir : `https://mon50ccetmoi.com/?essai-souverain=non`.

### Avant de basculer tout le monde

1. **Importer les comptes Firebase** sur le serveur : `docs/IMPORT_COMPTES_FIREBASE.md` (qui fait
   quoi) et `sovereign-core/deploy/README.md`, étape 11. Il faut le faire **avant** : sinon le serveur
   ne connaît personne. Le refaire juste avant la bascule, pour les derniers inscrits.
2. **Comptes Google** : en mode `"SOVEREIGN"`, le bouton Google explique qu'il faut se connecter avec
   l'adresse Gmail et un mot de passe. **Prêt** (18/11/2026, `src/js/google-password.js`) : après
   une connexion Google, l'appli propose aux comptes sans mot de passe d'en choisir un (« Plus tard »
   possible, redemandé 7 jours après). Au nouvel import, leur empreinte est ajoutée sur le serveur
   (`passwordsAdded` dans le bilan). Comptes importés le 18/11/2026 : 15, dont 4 « Google seul ».
3. **Administrateurs** : l'import crée tous les comptes avec le rôle « user ». Remettre « admin » à
   la main sur le VPS pour les comptes qui l'ont dans Firestore. **Fait** le 18/11/2026.
4. **Clé d'accès (empreinte)** : en mode `"SOVEREIGN"`, elle affiche « revient bientôt ». Elle passait
   déjà par les Cloud Functions, coupées depuis le 14/11.
5. **Effacement du compte (RGPD)** : **prêt** (19/11/2026, `src/js/effacement-compte.js`), dans les
   deux modes. Avec une session sur le serveur du VPS, le bouton passe par `DELETE /api/v1/rgpd/account` :
   le serveur anonymise le compte tout de suite. Il note aussi ce qui reste chez Firebase dans la table
   `rgpd_firebase_a_effacer`, que vous effacez à la main sous 30 jours (`deploy/README.md`, étape 13 ;
   `check.sh` le rappelle). Tant qu'une ligne est dans cette liste, l'import ne recrée pas ce compte.
   Sans session, il faut se reconnecter, ou la demande part par email, comme avant.
6. Essai sur un téléphone (ci-dessus), puis bascule : `comptes: "SOVEREIGN"` dans `config.js`,
   `CACHE_NAME` incrémenté dans `src/public/sw.js`, publication du site.

**Retour arrière** : remettre `comptes: "FIREBASE"` et republier le site. Les comptes Firebase n'ont
pas bougé. Un pilote inscrit pendant la bascule a aussi son compte Firebase, grâce au pont.

## 7. Paiements Revolut (18/11/2026)

**Situation** : plus aucun paiement depuis le 14/11. Les commandes passaient par trois Cloud Functions
(`createRevolutOrder`, `revolutWebhook`, `checkPaymentStatus`), coupées avec la facturation Google.

### Ce qui est fait (option B : commandes par le serveur du VPS)

- **Serveur** (`sovereign-core/server/payments.js`, `revolut-merchant.js`) :
  - `POST /api/v1/payments/orders` : le prix vient du catalogue (`functions/api/payments-catalog.js`),
    jamais de la demande. Double clic : la même commande est reprise.
  - `GET /api/v1/payments/orders?case_id=…` : suivi par l'acheteur seulement.
  - `POST /api/v1/webhooks/revolut` : signature vérifiée, puis la commande est **relue chez Revolut**.
    Elle n'est livrée que si Revolut dit « payée », au bon montant, et une seule fois. Si le webhook
    n'arrive pas, le suivi relit Revolut et livre aussi.
  - Livraison : **droit d'entrée garage** → compte « garage certifié » sur le serveur ; **points** →
    grand livre du serveur, sans compter au classement. Une **facture à émettre** est préparée à chaque
    paiement (même format qu'avant, pour Kolecto).
  - Administrateur : `GET /api/v1/admin/payments` (commandes, et ce qu'il reste à faire à la main) et
    `GET /api/v1/admin/payments/invoices.csv` (factures à émettre).
  - Produits en vente : `PAYMENTS_OPEN_PRODUCTS`, **vide par défaut** : même avec la clé Revolut en place,
    rien ne se vend tant que vous ne l'avez pas décidé. Premier produit prévu : `GARAGE_FEE`.
  - Sans `REVOLUT_SECRET_KEY`, tout répond « paiement pas encore ouvert ». `REVOLUT_ENV=sandbox` :
    essais avec le compte de test de Revolut (l'appli ouvre alors la fenêtre de paiement de test).
- **Appli** : interrupteur `paiements` (reste sur `"FIREBASE"`). Les 4 écrans qui vendent passent par
  `api-client.js` sans autre changement. Essai sur un seul téléphone : `?essai-souverain=paiements`.
- **Prix du garage corrigé** : l'écran annonçait 19,99 € (« 50 premiers garages ») ou 49,99 €, alors que
  le serveur encaissait 50 €. Il affiche maintenant le montant réellement débité. Une offre de lancement
  devra être ajoutée au catalogue si vous la voulez (décision à prendre).
- **Tests** : `tests/sovereign-payments.test.js` (25 cas, Revolut simulé) et le même parcours sur un vrai
  PostgreSQL. Vérifié dans l'appli en local : l'achat garage part bien vers le serveur du VPS.

### Ce qui reste à la main, tant que les données sont dans Firestore

- **Garage** : l'espace garage lit encore Firestore. Après un paiement, recopier `isCertifiedGarage: true`
  dans la console Firebase (fiche `users/<identifiant Firebase>`, donné par `/admin/payments`). Le pilote
  voit « accès activé sous 24 h ».
- **Packs de points** : prêts, mais fermés. L'appli lit le solde dans Firestore : les points achetés ne
  s'y verraient pas. À ouvrir quand le domaine `points` passera sur le serveur.
- **Acheteurs** : il faut un compte sur le serveur du VPS, donc l'import des comptes d'abord.

### Pour rouvrir les ventes, dans l'ordre

| # | Étape | Qui |
| :--- | :--- | :--- |
| 1 | Importer les comptes (`docs/IMPORT_COMPTES_FIREBASE.md`) | Vous, puis Claude avec votre accord |
| 2 | Dire si la clé déjà saisie sur le VPS (18/11/2026) est de **production** ou de **test**. Pour les essais : compte de test Revolut (sandbox-business.revolut.com, gratuit), clé secrète de test et webhook de test vers `https://api.mon50ccetmoi.com/api/v1/webhooks/revolut` | Vous |
| 3 | Les deux secrets de test dans la fenêtre : `saisir-cles.cmd -Groupe revolut` | Vous |
| 4 | `REVOLUT_ENV=sandbox` et `PAYMENTS_OPEN_PRODUCTS=GARAGE_FEE` sur le VPS, API reconstruite | Claude, avec votre accord |
| 5 | Sur votre téléphone : `mon50ccetmoi.com/app.html?essai-souverain=paiements`, achat du droit d'entrée garage avec une carte de test Revolut | Vous |
| 6 | Production : nouvelle clé secrète dans Revolut Business, **ancienne révoquée** (elle était chez Google), webhook de production vers la même adresse, les deux secrets dans la fenêtre | Vous |
| 7 | `REVOLUT_ENV=prod`, API reconstruite, un vrai achat d'essai (remboursable dans Revolut) | Vous et Claude |
| 8 | Bascule `paiements: "SOVEREIGN"` pour tout le monde (site republié) | Claude, avec votre accord |

**Coût** : aucun abonnement. Le compte de test Revolut est gratuit ; en production, seulement la
commission Revolut par paiement, inchangée.

*Écartées* : les liens de paiement Revolut (tout à la main) et la réactivation de la facturation Google
(une carte bancaire chez Google, au rebours du déménagement).
