# Mise en ligne sur le VPS OVHcloud

Tout tourne sur **un seul VPS** : l'API, la base PostgreSQL + PostGIS, et Caddy pour le HTTPS.
Les preuves de la Boîte Noire et les sauvegardes partent dans l'**Object Storage** OVHcloud.

| Élément | Offre OVHcloud | Prix |
| --- | --- | --- |
| Serveur | VPS-2 2027 (4 vCPU, 8 Go, 75 Go NVMe), Ubuntu 26.04, **Gravelines** | 12,40 € / mois, sauvegarde automatique Premium comprise (commande du 14/11/2026, engagement 12 mois) |
| Preuves + sauvegardes | Object Storage (projet Public Cloud), région **GRA** | à l'usage, quelques centimes par Go et par mois (prix indicatif) |

Fichiers :

- `../docker-compose.vps.yml` — les 3 services ; la base n'a **aucun port ouvert**.
- `Caddyfile` — HTTPS automatique (Let's Encrypt) pour le domaine de l'API.
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

```bash
sudo nano /opt/mon50cc/sovereign-core/.env
```

- Collez les **4 clés S3** de l'étape 1 (`WORM_S3_…` pour les preuves, `BACKUP_S3_…` pour les sauvegardes).
- `ACME_EMAIL` : une adresse qui reçoit vraiment le courrier (avertissements du certificat HTTPS).
- `API_DOMAIN` et `CORS_ORIGIN` : à changer seulement si le domaine n'est pas `mon50ccetmoi.com`.
- `REVOLUT_WEBHOOK_SECRET` : à laisser vide pour l'instant.

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

```bash
cd /opt/mon50cc && sudo git pull
cd sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d --build
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
