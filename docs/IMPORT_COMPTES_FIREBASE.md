# Importer les comptes Firebase sur le serveur du VPS

*Préparé le 18/11/2026. Rien n'est importé tant que vous ne l'avez pas décidé.*

## Pourquoi, et pourquoi tôt

Pour que la connexion passe par le serveur du VPS (phase A, `docs/PLAN_DEMENAGEMENT_GOOGLE.md` § 6),
le serveur doit connaître les pilotes. On y copie donc les comptes Firebase. Les mots de passe ne
sont jamais lus : on copie leur **empreinte**. Le serveur sait la vérifier, puis la convertit à son
propre format à la première connexion. Pour les pilotes, rien ne change : même pseudo, même mot de
passe.

**Le faire tôt** : la base du VPS est vide aujourd'hui. Tant que les comptes n'y sont pas, quelqu'un
pourrait y créer un compte avec l'adresse d'un pilote. Le script d'import le repère : ces comptes
sont listés « adresse déjà prise » et ne sont ni importés ni rattachés. Mais il vaut mieux qu'il n'y
en ait aucun.

**Coût : 0 €.** Rien ne passe par les Cloud Functions, coupées : l'export se fait avec l'outil
Firebase du PC.

## Qui fait quoi

| # | Étape | Qui | Durée |
| :--- | :--- | :--- | :--- |
| 1 | Relever les 4 « paramètres de hachage » dans la console Firebase | **Vous** (ils sont secrets) | 2 min |
| 2 | Les mettre sur le VPS | **Vous**, dans la fenêtre de saisie des clés | 2 min |
| 3 | Exporter les comptes, les copier sur le VPS, lancer la simulation | Claude, avec votre accord | 5 min |
| 4 | Lire le bilan de la simulation | Vous et Claude | 2 min |
| 5 | Import réel, puis effacement du fichier exporté | Claude, avec votre accord | 2 min |
| 6 | Remettre le rôle « admin » à votre compte | Claude, avec votre accord | 1 min |

### 1. Les paramètres de hachage (vous)

Console Firebase › projet **mon50ccetmoi** › **Authentication** › onglet **Users** › bouton **⋮** en
haut à droite de la liste › **Password hash parameters**. Quatre valeurs s'affichent :

- `base64_signer_key` → `FIREBASE_SCRYPT_SIGNER_KEY` (secret) ;
- `base64_salt_separator` → `FIREBASE_SCRYPT_SALT_SEPARATOR` (secret) ;
- `rounds` → `FIREBASE_SCRYPT_ROUNDS` (souvent 8) ;
- `mem_cost` → `FIREBASE_SCRYPT_MEM_COST` (souvent 14).

**Ne les collez jamais dans une conversation, un email ou le code.**

### 2. Les mettre sur le VPS (vous)

La fenêtre `sovereign-core\deploy\windows\saisir-cles.cmd` ne connaît pas encore ces 4 noms. Il faut
d'abord les ajouter à `ALLOWED` dans `deploy/set-secret.sh`, et au catalogue de
`deploy/windows/saisir-cles.ps1` (groupe `firebase`). Ensuite :

```
sovereign-core\deploy\windows\saisir-cles.cmd -Noms FIREBASE_SCRYPT_SIGNER_KEY,FIREBASE_SCRYPT_SALT_SEPARATOR,FIREBASE_SCRYPT_ROUNDS,FIREBASE_SCRYPT_MEM_COST
```

Puis relancer l'API pour qu'elle lise les nouvelles valeurs (Claude peut le faire) :
`cd /opt/mon50cc/sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d`.
`check.sh` le vérifie ensuite : il signale les comptes importés qui ne pourraient pas se connecter
parce que ces paramètres manquent.

### 3 à 5. Export, simulation, import

C'est l'étape 11 de `sovereign-core/deploy/README.md`. Elle se fait avec l'outil Firebase déjà
installé sur le PC (`npx firebase`, celui qui publiait le site), sans la console.

1. `npx firebase auth:export comptes.json --format=json --project mon50ccetmoi`
2. Copie sur le VPS (`scp`), puis effacement immédiat sur le PC.
3. **Simulation** : le script dit combien de comptes il importerait, sans rien écrire.
4. **Import réel** (`--apply`), seulement après avoir lu la simulation. Le fichier est ensuite effacé
   du VPS (`shred`).

Le bilan sépare :

- les comptes à importer (avec mot de passe, ou « Google seul ») ;
- ceux déjà importés : on peut relancer sans risque, aucun doublon n'est créé ;
- ceux dont l'**adresse est déjà prise** sur le serveur, à vérifier un par un ;
- les comptes désactivés ou sans email, ignorés.

### 6. Le rôle admin

L'import crée tous les comptes avec le rôle « user » : le rôle admin est dans Firestore, pas dans
l'export. Commande (adresse = `pseudo@mon50cc.internal` pour un compte créé dans l'appli) :

```bash
cd /opt/mon50cc/sovereign-core
sudo docker compose -f docker-compose.vps.yml exec -T postgres-postgis \
  psql -U mon50cc_admin -d mon50ccetmoi -c "UPDATE users SET role = 'admin' WHERE email = 'ADRESSE';"
```

## Ce qui se passe ensuite

- **Rien ne change pour les pilotes** tant que l'interrupteur des comptes reste sur `"FIREBASE"`.
- Chaque pilote qui se reconnecte reçoit aussi sa session sur le serveur du VPS (alerte SOS
  automatique comprise). À la bascule, il n'aura rien à retaper.
- **Nouveaux inscrits** : ils n'existent que chez Firebase jusqu'au prochain import. On relance donc
  l'import juste avant la bascule. Le script ignore les comptes déjà présents.
- **Comptes « Google seul »** : importés sans mot de passe, ils ne peuvent pas se connecter au serveur
  du VPS. Il faudra leur faire choisir un mot de passe avant la bascule (plan, § 6).
