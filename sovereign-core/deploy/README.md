# Mise en ligne sur le VPS OVHcloud

Tout tourne sur **un seul VPS** : l'API, la base PostgreSQL + PostGIS, et Caddy pour le HTTPS.
Les preuves de la Boîte Noire et les sauvegardes partent dans l'**Object Storage** OVHcloud.

| Élément | Offre OVHcloud | Prix |
| --- | --- | --- |
| Serveur | VPS-2 2027 (4 vCPU, 8 Go, 75 Go NVMe), Ubuntu 26.04, **Gravelines** | 12,40 € / mois, sauvegarde automatique Premium comprise (commande du 14/11/2026, engagement 12 mois) |
| Preuves + sauvegardes | Object Storage (projet Public Cloud), région **GRA** | à l'usage, quelques centimes par Go et par mois (prix indicatif) |

Fichiers :

- `../docker-compose.vps.yml` — les 3 services ; la base n'a **aucun port ouvert**.
- `Caddyfile` — HTTPS automatique (Let's Encrypt) pour l'API et, au jour J, pour le site.
- `publish-site.sh` — construit et publie le site sur le VPS (bascule d'un seul coup, retour arrière possible).
- `env.vps.example` — modèle du fichier `.env`.
- `install.sh` — prépare le VPS (Docker, pare-feu, SSH par clé, mises à jour auto, swap, secrets, sauvegarde nocturne).
- `check.sh` — bilan de santé, ne modifie rien.
- `backup.sh` / `restore.sh` — sauvegarde chiffrée et restauration de la base.

> **Rien ne change pour les utilisateurs pendant cette installation.** L'appli et le site continuent
> d'utiliser Firebase. Le VPS sera en ligne mais inutilisé tant que l'appli n'est pas branchée dessus
> (phase A du plan de migration, `CONFIG.BACKEND_MODE`). On peut donc tout tester sans risque.

## Avant de commencer : à avoir sous la main

- [ ] L'email de livraison d'OVHcloud : **adresse IP** du VPS, nom d'utilisateur (souvent `ubuntu`) et accès.
- [ ] Une **clé SSH** sur votre PC (étape 0).
- [ ] L'accès à la **zone DNS** du domaine (Amen.fr tant que le domaine y est).
- [ ] Un **gestionnaire de mots de passe** ouvert : il recevra 5 secrets (4 clés S3 et la phrase des sauvegardes).
- [ ] Ce déploiement présent dans `main` sur GitHub (pull requests des preuves signées et du déploiement fusionnées).

## 0. Sur votre PC : créer une clé SSH (une seule fois)

Dans PowerShell :

```powershell
ssh-keygen -t ed25519 -C "mon50cc-vps"
```

Appuyez sur Entrée pour l'emplacement proposé, puis choisissez une phrase de passe (à garder aussi
dans le gestionnaire de mots de passe). La clé publique est dans `%USERPROFILE%\.ssh\id_ed25519.pub`.
La clé privée (`id_ed25519`, sans `.pub`) ne quitte **jamais** votre PC.

## 1. Espace client OVHcloud : l'Object Storage

1. **Public Cloud** : créez un projet s'il n'y en a pas (l'Object Storage en fait partie, facturé à l'usage).
2. **Object Storage › créer un conteneur**, API **S3**, région **GRA** (Gravelines), deux fois :
   - `mon50cc-preuves` — **activez Object Lock (verrouillage des objets) à la création**.
     Impossible de l'activer après coup : sinon, supprimer le conteneur et recommencer.
   - `mon50cc-sauvegardes` — **sans** Object Lock (les vieilles sauvegardes doivent pouvoir être supprimées).
3. **Utilisateurs S3** : créez-en deux, chacun avec des droits sur **son seul** conteneur :
   - un pour `mon50cc-preuves` : lecture et écriture ;
   - un pour `mon50cc-sauvegardes` : lecture, écriture et suppression.

   Pour chacun, notez la **clé d'accès** et la **clé secrète** dans le gestionnaire de mots de passe :
   la clé secrète n'est affichée qu'une fois.

Les noms de menus peuvent varier selon l'espace client ; l'essentiel est : S3, région GRA,
Object Lock sur les preuves seulement, un utilisateur par conteneur.

## 2. DNS chez Amen.fr

Ajoutez un enregistrement **A** : `api` (soit `api.mon50ccetmoi.com`) → **adresse IPv4 du VPS**.
Il faut parfois quelques minutes à quelques heures pour qu'il soit visible. Vérification depuis le PC :

```powershell
nslookup api.mon50ccetmoi.com
```

Le certificat HTTPS ne pourra être obtenu (étape 6) qu'une fois ce nom dirigé vers le VPS.

## 3. Première connexion et installation de votre clé

Remplacez `IP` par l'adresse du VPS et `ubuntu` par l'utilisateur indiqué dans l'email d'OVHcloud.
Dans PowerShell, sur votre PC :

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh ubuntu@IP
```

La seconde commande doit vous connecter **sans le mot de passe du serveur** (seulement la phrase de
votre clé). Si c'est le cas, la clé est en place.

## 4. Installation (sur le VPS)

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/xavierlechanu-netizen/xavierlechanu-netizen.github.io.git /opt/mon50cc
cd /opt/mon50cc
sudo sovereign-core/deploy/install.sh
```

Pendant l'installation :

- Le script affiche une **phrase de chiffrement des sauvegardes** : recopiez-la **tout de suite** dans
  le gestionnaire de mots de passe. Sans elle, aucune sauvegarde n'est relisible.
- Il **coupe la connexion SSH par mot de passe**, mais seulement si votre clé est installée (étape 3).
  Sinon, il le dit et ne touche à rien : installez la clé, puis relancez le script (sans risque).
- **Avant de fermer votre session**, ouvrez une deuxième fenêtre PowerShell et vérifiez que
  `ssh ubuntu@IP` fonctionne toujours.

## 5. Compléter le fichier .env

Si le VPS a été installé il y a quelque temps, récupérez d'abord la dernière version :

```bash
cd /opt/mon50cc && sudo git pull
```

Puis enregistrez les clés **une par une**, sans éditeur : chaque commande demande la valeur, qui
reste **invisible** pendant que vous la collez, et l'écrit dans `.env` (seule la longueur s'affiche).
Ne collez ces clés nulle part ailleurs (e-mail, conversation, capture d'écran).

```bash
sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh WORM_S3_ACCESS_KEY_ID
sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh WORM_S3_SECRET_ACCESS_KEY
sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh BACKUP_S3_ACCESS_KEY_ID
sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh BACKUP_S3_SECRET_ACCESS_KEY
sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh ACME_EMAIL
```

- Les **4 clés S3** de l'étape 1 (`WORM_S3_…` pour les preuves, `BACKUP_S3_…` pour les sauvegardes).
- `ACME_EMAIL` : une adresse qui reçoit vraiment le courrier (avertissements du certificat HTTPS).
- Pour vérifier ou corriger autre chose : `sudo nano /opt/mon50cc/sovereign-core/.env`.

**Depuis Windows, sans terminal** : `sovereign-core\deploy\windows\saisir-cles.cmd -Groupe stockage`
(ou `sms`, `meteo`, `revolut`, ou `-Noms NOM1,NOM2`) ouvre une fenêtre avec une case par clé. On copie
chaque clé, puis on la colle avec Ctrl+V. Elle reste masquée, un ✓ vert confirme qu'elle est reconnue,
et elle part au VPS par SSH, sans passer par aucun fichier. La fenêtre repère aussi :
- une ligne entière de tableau copiée par erreur, dont elle ne garde que la clé ;
- une clé Météo-France incomplète (le double-clic s'arrête au premier point) ;
- une même clé collée dans deux cases.

Cet outil a servi le 17/11/2026 : la saisie dans le terminal ne recevait pas le collage.
- `API_DOMAIN` et `CORS_ORIGIN` : à changer seulement si le domaine n'est pas `mon50ccetmoi.com`.
- `REVOLUT_WEBHOOK_SECRET` : à laisser vide pour l'instant.
- `METEO_FRANCE_API_KEY` : à laisser vide pour l'instant (étape 9 bis).

Enregistrez avec Ctrl+O puis Entrée, quittez avec Ctrl+X.

## 6. Démarrer

```bash
cd /opt/mon50cc/sovereign-core
sudo docker compose -f docker-compose.vps.yml up -d --build
sudo docker compose -f docker-compose.vps.yml logs -f sovereign-api
```

La première construction prend quelques minutes. Dans le journal, on attend
« Serveur actif sur le port 8080 — stockage : PostgreSQL — preuves : … » ; Ctrl+C pour quitter le journal
(les services continuent de tourner).

Si le journal dit **« Démarrage refusé »**, c'est voulu : le conteneur des preuves n'a pas Object Lock,
ou une clé S3 est fausse. Corrigez (étapes 1 et 5), puis relancez la commande `up -d`.

## 7. Vérifier

```bash
sudo /opt/mon50cc/sovereign-core/deploy/check.sh
sudo /opt/mon50cc/sovereign-core/deploy/backup.sh
sudo /opt/mon50cc/sovereign-core/deploy/check.sh
```

Le premier bilan signale « aucune sauvegarde » : normal, la sauvegarde qui suit la crée.
Au second, tout doit être ✅. Depuis le PC, `https://api.mon50ccetmoi.com/api/v1/health` doit
afficher `"status":"OK"`.

## 8. Tester une restauration (maintenant, puis chaque trimestre)

Le premier jour, la base est vide : c'est le meilleur moment pour vérifier que la restauration marche.

```bash
sudo /opt/mon50cc/sovereign-core/deploy/restore.sh --list
sudo /opt/mon50cc/sovereign-core/deploy/restore.sh <nom affiché> --yes
```

Une sauvegarde jamais relue n'est pas une sauvegarde.

## 9. SMS d'urgence (alerte SOS)

Sans cette étape, le serveur fonctionne, mais l'alerte SOS ne peut pas envoyer de SMS : l'appli le
dit honnêtement et propose d'appeler le 112.

1. **Espace client OVHcloud › Télécom › SMS** : commandez un petit pack de crédits SMS. Le message
   d'alerte (pseudo, lien de carte, 112) dépasse 160 caractères : comptez **2 crédits par ange
   gardien et par alerte** en France. Notez le nom du compte SMS (`sms-xx12345-1`).
   N'utilisez pas « Créer un utilisateur API » sur cette page : c'est l'ancienne méthode
   (identifiant et mot de passe), le serveur passe par la clé d'API de l'étape 3.
2. **Facultatif** : déclarez un nom d'expéditeur (par exemple `MON50CC`), validé par OVHcloud sous
   quelques jours. Sans lui, les SMS partent d'un numéro court.
3. **Clé d'API limitée au seul envoi de SMS** : sur <https://eu.api.ovh.com/createToken/>, créez une
   clé avec un seul droit, `POST /sms/<nom du compte SMS>/jobs`, durée illimitée. Notez les trois
   valeurs (Application Key, Application Secret, Consumer Key) dans le gestionnaire de mots de passe.
4. Enregistrez-les sans éditeur (valeur invisible, voir l'étape 5), puis redémarrez :

   ```bash
   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh OVH_SMS_APP_KEY
   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh OVH_SMS_APP_SECRET
   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh OVH_SMS_CONSUMER_KEY
   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh OVH_SMS_SERVICE
   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh OVH_SMS_SENDER
   cd /opt/mon50cc/sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d
   ```

   `OVH_SMS_SERVICE` = nom du compte SMS (`sms-xx12345-1`) ; `OVH_SMS_SENDER` seulement une fois
   l'expéditeur validé par OVHcloud.

Protections en place : pilote connecté obligatoire, 1 à 3 mobiles français (06/07) seulement,
au plus 3 alertes par 10 minutes et 10 par 24 h et par pilote, et un budget de SMS par jour pour tout
le serveur (`SOS_DAILY_SMS_BUDGET`, 300 par défaut). Un SMS n'est annoncé comme envoyé que si OVHcloud l'a accepté.

**Ces clés restent sur le VPS, jamais dans l'appli** : elles permettent d'envoyer des SMS à nos
frais. L'appli ne fait que prévenir le serveur, qui envoie les SMS.

**Côté appli** (déjà branché, `CONFIG.SOVEREIGN` dans `src/js/config.js`) : à chaque connexion par
mot de passe, l'appli se connecte aussi à l'API et garde un **jeton SOS** de 30 jours, renouvelé
chaque jour d'utilisation, qui n'ouvre que l'alerte SOS. Pour qu'un pilote en ait un, il faut :

- que son compte existe sur le serveur (étape 11, import des comptes Firebase, à refaire de temps
  en temps pour les nouveaux inscrits) ;
- qu'il se reconnecte **une fois** après la mise en ligne de l'API (les pilotes déjà connectés ne
  retapent jamais leur mot de passe). L'écran « Contacts Ange Gardien » lui dit si l'envoi
  automatique est actif sur son téléphone.

## 9 bis. Vigilance Météo-France (bandeau « vigilance rouge »)

Sans cette étape, le serveur fonctionne, mais l'appli n'affiche pas d'alerte de vigilance
Météo-France (la météo du trajet, qui vient d'Open-Meteo, n'est pas concernée).

1. Sur <https://portail-api.meteofrance.fr>, créez un compte (gratuit), puis abonnez-vous à l'API
   **« Données Publiques Vigilance »**.
2. Générez une **clé d'API** (« API Key »), pas un identifiant d'application (« Application ID ») :
   le serveur envoie la clé telle quelle, dans l'en-tête `apikey`. Prenez la durée de validité la
   plus longue proposée et notez la **date d'expiration** dans le gestionnaire de mots de passe :
   il faudra recréer la clé avant cette date.
3. **Vous-même**, enregistrez-la sur le VPS, jamais dans une conversation, un email ou le code de
   l'appli. Copiez-la en entier avec le bouton « Copier » du site : un double-clic n'en prend que le
   début, qui s'arrête au premier point. Depuis Windows : `sovereign-core\deploy\windows\saisir-cles.cmd -Groupe meteo`.
   Sur le VPS :

   ```bash
   sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh METEO_FRANCE_API_KEY
   ```

   Puis :

   ```bash
   cd /opt/mon50cc/sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d
   ```

4. Vérification : `sudo /opt/mon50cc/sovereign-core/deploy/check.sh` (ligne « vigilance
   Météo-France »), ou depuis le PC `https://api.mon50ccetmoi.com/api/v1/meteo/vigilance`, qui doit
   afficher une longue réponse contenant `"product"`. Si elle contient `"fallback":true`, la clé est
   absente, refusée (expirée, ou pas d'abonnement à l'API Vigilance) ou Météo-France ne répond pas :
   `sudo docker compose -f docker-compose.vps.yml logs sovereign-api | grep Meteo` dit pourquoi.

Fonctionnement : route publique (les visiteurs sans compte voient aussi l'alerte), carte gardée
10 minutes en mémoire, donc Météo-France est interrogé au plus 6 fois par heure quel que soit le
nombre de pilotes. Si Météo-France ne répond plus, la dernière carte connue (24 h au plus) est
renvoyée avec `"stale":true`. Au plus 120 demandes par adresse IP et par 10 minutes.

---

# Jour J : le site et les comptes passent sur le VPS

Les étapes 10 et 11 se préparent **sans rien changer pour le public** : tant que le DNS de
`mon50ccetmoi.com` n'est pas modifié, les visiteurs voient l'ancien hébergement (GitHub Pages).
Seule l'étape 12 fait la bascule, et elle se défait en remettant les anciens enregistrements DNS.

> **À savoir.** Après la bascule du site, l'appli utilise encore Firebase pour les connexions et les
> données : c'est la phase A (`CONFIG.BACKEND_MODE`) qui la branchera sur le VPS. L'import des
> comptes (étape 11) prépare ce moment ; on le **refait juste avant** la phase A pour inclure les
> derniers inscrits (le script ignore les comptes déjà importés).

## 10. Le site sur le VPS (sans toucher au DNS)

```bash
sudo /opt/mon50cc/sovereign-core/deploy/publish-site.sh
sudo /opt/mon50cc/sovereign-core/deploy/check.sh
```

Le script construit le site à partir de ce qui est dans git (quelques minutes) et le publie d'un
seul coup. `check.sh` doit dire « site publié, prêt à l'intérieur du VPS ».
Après chaque `git pull`, relancez `publish-site.sh` pour mettre le site à jour.
En cas de souci après une publication : `sudo .../publish-site.sh --rollback` remet la version d'avant.

## 11. Les comptes Firebase

Les mots de passe ne sont jamais connus, ni de Firebase ni de nous : on copie leur **empreinte**,
que le serveur sait vérifier, puis convertit à son propre format à la première connexion.

1. **Console Firebase › Authentication › Users › ⋮ (en haut à droite de la liste) › Password hash
   parameters** : enregistrez les 4 valeurs sur le VPS (`FIREBASE_SCRYPT_SIGNER_KEY`,
   `FIREBASE_SCRYPT_SALT_SEPARATOR`, `FIREBASE_SCRYPT_ROUNDS`, `FIREBASE_SCRYPT_MEM_COST`).
   Depuis Windows, sans terminal : `sovereign-core\deploy\windows\saisir-cles.cmd -Groupe firebase`.
   Sur le VPS : `sudo /opt/mon50cc/sovereign-core/deploy/set-secret.sh FIREBASE_SCRYPT_SIGNER_KEY`, et
   ainsi de suite. Puis `cd /opt/mon50cc/sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d`.
2. **Sur le PC**, dans le dossier du projet :

   ```powershell
   npx firebase auth:export comptes.json --format=json --project mon50ccetmoi
   scp comptes.json ubuntu@IP:/tmp/comptes.json
   Remove-Item comptes.json
   ```

3. **Sur le VPS**, d'abord une simulation (rien n'est écrit), puis l'import :

   ```bash
   cd /opt/mon50cc/sovereign-core
   sudo docker compose -f docker-compose.vps.yml exec -T sovereign-api node scripts/import-firebase-users.js - < /tmp/comptes.json
   sudo docker compose -f docker-compose.vps.yml exec -T sovereign-api node scripts/import-firebase-users.js - --apply < /tmp/comptes.json
   shred -u /tmp/comptes.json
   ```

   Le bilan donne le nombre de comptes importés. Ceux qui se connectaient **uniquement avec Google**
   n'ont pas de mot de passe : ils devront en choisir un (« mot de passe oublié », à construire avec
   l'envoi d'emails). Les comptes désactivés et ceux sans email ne sont pas importés.

`comptes.json` contient les empreintes de tous les mots de passe : il ne doit rester **nulle part**
(ni sur le PC, ni sur le VPS, ni dans git).

## 12. La bascule du DNS (le site passe sur le VPS)

1. **La veille**, chez Amen.fr : réduisez la durée de vie (TTL) des enregistrements de
   `mon50ccetmoi.com` et `www` à 5 minutes, et **notez les valeurs actuelles** (adresses de GitHub
   Pages `185.199.108.153` à `.111.153`, et `www` → `xavierlechanu-netizen.github.io`) : c'est le
   retour arrière.
2. Dans `.env` : `SITE_DOMAIN=mon50ccetmoi.com` et `SITE_WWW_DOMAIN=www.mon50ccetmoi.com`.
3. Chez Amen.fr : remplacez les 4 enregistrements **A** de `mon50ccetmoi.com` par **un seul A vers
   l'IP du VPS** (supprimez aussi un éventuel AAAA de GitHub), et faites pointer `www` vers l'IP du
   VPS (enregistrement A) au lieu de GitHub.
4. Dès que `nslookup mon50ccetmoi.com` donne l'IP du VPS :

   ```bash
   cd /opt/mon50cc/sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d
   sudo /opt/mon50cc/sovereign-core/deploy/check.sh
   ```

   Caddy obtient alors le certificat HTTPS du site (une minute environ). `check.sh` doit dire
   « site en ligne depuis le VPS ».
5. Vérifiez à la main sur le téléphone : accueil, connexion, carte et itinéraire.

**Retour arrière** : remettre chez Amen.fr les valeurs notées au point 1 ; le site revient sur
GitHub Pages en quelques minutes (TTL réduit). Rien n'est perdu : rien n'a été effacé.

## Au quotidien

### Sauvegardes

- Automatiques chaque nuit à 3 h 30 (journal : `/var/log/mon50cc-backup.log`).
- Chiffrées sur le serveur avant l'envoi, vérifiées (relues) avant d'être gardées.
- Conservées 7 jours sur le VPS et 30 jours dans l'Object Storage (`BACKUP_RETENTION_DAYS`).
- En plus, la sauvegarde automatique Premium d'OVHcloud garde 7 jours du serveur entier.

```bash
sudo /opt/mon50cc/sovereign-core/deploy/backup.sh                    # sauvegarde immédiate
sudo /opt/mon50cc/sovereign-core/deploy/restore.sh --list            # sauvegardes disponibles
sudo /opt/mon50cc/sovereign-core/deploy/restore.sh <nom> --yes       # REMPLACE la base par cette sauvegarde
```

### Mettre à jour l'application

**Le site se met à jour tout seul.** Toutes les 5 minutes, `deploy/auto-update.sh` regarde s'il y a
du nouveau sur `main`. Si oui, il avance le dépôt du VPS, en avance rapide seulement, puis republie le
site avec `publish-site.sh`. Si la construction échoue, le site en ligne ne change pas.
Le journal est dans `/var/log/mon50cc-auto-update.log`, et `check.sh` signale un échec.
Pour forcer tout de suite : `sudo /opt/mon50cc/sovereign-core/deploy/auto-update.sh`.

**L'API, elle, se reconstruit à la main**, parce qu'elle porte les alertes SOS. Quand son code a
changé, `check.sh` affiche « API pas à jour », et le journal de mise à jour le signale aussi :

```bash
cd /opt/mon50cc && sudo git pull
cd sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d --build
sudo /opt/mon50cc/sovereign-core/deploy/publish-site.sh
sudo /opt/mon50cc/sovereign-core/deploy/check.sh
```

### Redémarrage du serveur

Les mises à jour de sécurité s'installent seules, mais le serveur ne redémarre pas tout seul.
Quand `check.sh` l'indique : `sudo reboot`. Docker et les trois services repartent d'eux-mêmes.

## Sécurité

- Entrent seulement SSH (22), HTTP (80) et HTTPS (443) ; la base n'est joignable que par l'API.
- SSH par clé uniquement (réglé par `install.sh` dès qu'une clé est installée).
- `.env` est lisible par root seulement et n'est jamais mis dans git.
- Les preuves ne peuvent être ni modifiées ni supprimées pendant 5 ans, même par nous (Object Lock Compliance).

## Limites de cette formule

Une seule machine : si elle tombe, l'appli est coupée le temps de la relancer (aucune donnée
perdue grâce aux sauvegardes et au coffre des preuves). Quand les revenus le permettront :
base PostgreSQL gérée par OVHcloud et deux serveurs derrière un répartiteur de charge
(voir `../CAHIER_DES_CHARGES_OVHCLOUD.md`).
