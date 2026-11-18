# Audit RGPD / CNIL et auditabilité — 17 novembre 2026

Suite de `AUDIT_JURIDIQUE_RGPD_2026-11-07.md` et `AUDIT_SECURITE_2026-11-16.md`. Analyse technique, pas un avis
juridique : les points « à décider » demandent l'avis d'un juriste ou d'un DPO. Registre des traitements :
`docs/REGISTRE_TRAITEMENTS_RGPD.md`.

## 1. Ce qui était déjà conforme

- **Bandeau cookies** (`src/js/cookie-consent.js`, PR #35), **vérifié dans un vrai navigateur** le 17/11 :
  « Tout refuser » et « Tout accepter » au même endroit, même taille, même couleur ; refuser ferme le bandeau et
  mémorise le choix avec sa date ; pas redemandé au rechargement ; redemandé au bout de 6 mois ; bouton
  « Modifier mes choix » sur la page Cookies. Aucun traceur publicitaire ni de mesure d'audience.
- Positions partagées arrondies à ~100 m ; écran de consentement séparé pour la localisation.
- Serveur souverain : mots de passe en scrypt, effacement par anonymisation, preuves conservées (art. 17.3.e),
  alerte SOS sans conservation des numéros, journaux sans numéro de téléphone.
- En-têtes de sécurité de l'API : HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy.

## 2. Corrigé dans cette PR

| Sujet | Avant | Maintenant |
| :--- | :--- | :--- |
| **Appels à des tiers avant tout consentement** | Chaque page chargeait les icônes chez **Cloudflare** (cdnjs, États-Unis) : l'adresse IP de chaque visiteur partait avant tout choix. La page de connexion chargeait une photo chez **Unsplash** (États-Unis). | Icônes Font Awesome 6.5.1 servies par le site (`src/public/vendor/fontawesome`, licences libres jointes) ; fond de la page de connexion en dégradé. **Vérifié au navigateur** : 0 appel à un tiers sur l'accueil avant le choix. Cloudflare retiré de la CSP. |
| **Adresse IP envoyée à ipify** | Un bannissement définitif demandait l'adresse IP du pilote à un service américain (ipify) pour l'écrire dans `banned_ips`, ce que les règles Firestore refusaient de toute façon. Non annoncé. | Supprimé ; CGU corrigées (« aucun blocage par adresse IP »). |
| Minimisation des positions | Position exacte envoyée à Open-Meteo (météo) et à Nominatim (message d'accueil régional). | Arrondie à ~1 km (2 décimales), Nominatim interrogé au niveau « région ». |
| **Effacement impossible depuis l'appli** | « Supprimer mon compte » appelle une fonction Firebase **à l'arrêt depuis le 14/11** : échec. L'autre bouton (`privacy-manager.js`) n'effaçait que la fiche `users/{uid}` en annonçant « toutes vos données supprimées ». | Si l'effacement automatique ne répond pas, l'appli propose un e-mail tout prêt à contact@ (traité sous un mois). Le second bouton passe par le vrai parcours. |
| Export incomplet | L'export ne contenait que les données du téléphone. | Il ajoute le profil enregistré sur le serveur (Firestore `users/{uid}`) et indique comment obtenir le reste. |
| **Droits sur le serveur souverain** | Seulement l'effacement. | `GET /api/v1/rgpd/account` (accès + portabilité, JSON, avec l'historique d'audit du compte, jamais mis en cache), `PATCH` (rectification de l'email/pseudo avec le mot de passe actuel ; **opposition** au classement), `DELETE` (efface aussi le texte libre des signalements). SDK : `exportMyDataRgpd()`, `updateMyAccountRgpd()`. |
| **Journal d'audit** | Aucun. | `sovereign-core/server/audit-log.js` + table `audit_log` : qui (UUID), quoi (liste fermée), quand, résultat. Notés : inscription, connexion, échec de connexion (compte existant seulement), export, rectification, effacement, preuve scellée, SOS (nombre de SMS), provisionnement de boîtier (y compris refusé), mise en service usine, lecture du journal. **Minimal** : ni e-mail, ni pseudo, ni numéro, ni position, ni IP (filtre automatique, testé). **Résistant** : chaîne SHA-256, triggers PostgreSQL contre UPDATE/DELETE/TRUNCATE (testés sur un vrai PostgreSQL), tête de chaîne scellée chaque jour dans le coffre Object Lock 5 ans. Purge à 1 an. Lecture réservée aux administrateurs : `GET /api/v1/admin/audit`, vérification `GET /api/v1/admin/audit/verify`. |
| Migrations de la base | `schema.sql` n'est lu qu'à la création de la base : une base déjà en service n'aurait jamais reçu une nouvelle table. | `db/migrations/*.sql` rejouables, appliquées par le serveur à chaque démarrage. |
| security.txt | Absent. | `/.well-known/security.txt` (RFC 9116) sur le site et l'API ; un test échoue un mois avant l'échéance pour rappeler de le renouveler. |
| En-têtes de sécurité vérifiables | Non testés sur l'API ; faute de frappe dans la CSP Firebase (`…/gsi/https://*.googleapis.com`, deux adresses collées). | Test des en-têtes de l'API ; `Cache-Control: no-store` sur toutes les réponses ; faute corrigée et détectée par un test. |
| Journaux du VPS | Journaux Docker (dont les IP de Caddy) sans limite de durée ni de taille. | Rotation 5 × 10 Mo par service (`docker-compose.vps.yml`), effective au prochain déploiement. |
| **Pages légales fausses ou incomplètes** | OVHcloud absent (hébergeur, SMS, coffre) ; « données de boîte noire supprimées avec le compte » (faux : 5 ans non effaçables) ; GPS en « nécessité contractuelle » dans les mentions mais « consentement » dans la politique ; « analytics » alors qu'il n'y en a pas ; Kolecto absent ; anges gardiens non informés. | Politique de confidentialité, cookies (liste des traceurs avec durées, contenus de tiers), mentions légales (OVH SAS hébergeur, sous-traitants, bases légales, durées, transferts) et CGU (blocage d'IP) corrigées. |

Tests : 924 tests verts avant les dernières retouches de texte, dont 11 nouveaux (mémoire) et 4 sur PostgreSQL ;
garde-fou `tests/rgpd-tiers.test.js` (plus de Cloudflare, Unsplash, ipify ; positions arrondies ; CSP propre).

## 3. Reste à faire (technique, sans décision)

1. **Publier** : site (GitHub Pages) et API (VPS) — avec votre accord. Au redémarrage de l'API, la migration crée
   le journal d'audit toute seule.
2. **Durées de vie Firestore (TTL)** non configurées : `auth_logs`, `crash_reports` (12 mois annoncés), `sos_alerts`,
   `emergency_alerts`, `presence`, `nexus_conversations`. À régler dans la console Firebase (gratuit) ou à la bascule
   vers le serveur souverain.
3. **Dangers sur le serveur souverain** : pas d'expiration automatique (`hazards`). Proposer 30 jours.
4. **Positions du radar arrondies dans le navigateur** : un client modifié peut publier une position exacte.
   Solution : publication par le serveur souverain (phase A).
5. **Portail assureur** : quand il passera sur le serveur souverain, noter chaque consultation de rapport
   (`b2b.report_access`, déjà prévu) et donner au pilote la liste des assureurs qui ont consulté son rapport.
6. **Masquage des IP dans les journaux de Caddy** (`format filter` + `ip_mask`) : à faire avec un test de la
   configuration Caddy sur le VPS (non testable ici).
7. **CGU** : il reste des affirmations à revoir (« Zero-Knowledge », « chiffrement ultra-avancé », bannissement sans
   remboursement, cf. audit du 7/11, § 4).
8. **Certificat batterie, nexus_conversations** : durées de conservation à fixer.

## 4. Décisions qui vous reviennent

| # | Décision | Pourquoi | Recommandation |
| :--- | :--- | :--- | :--- |
| D-1 | **Délégué à la protection des données (DPO)** | Obligatoire si l'activité principale est un « suivi régulier et systématique à grande échelle » (art. 37). La géolocalisation des pilotes et la boîte noire peuvent entrer dans ce cas quand le nombre d'utilisateurs grandira. | Pas obligatoire à 0 utilisateur ; à réexaminer avant 1 000 pilotes actifs. Un DPO externe mutualisé coûte de l'ordre de 100 à 300 €/mois : **aucune dépense engagée**. En attendant, contact@ fait office de point de contact (écrit dans la politique). |
| D-2 | **Analyse d'impact (AIPD/DPIA)** | La CNIL la rend obligatoire pour la géolocalisation à grande échelle, les données de personnes vulnérables (mineurs dès 14 ans) et le croisement de données (boîte noire + assurance). | **À faire avant la vente du boîtier et l'ouverture du portail assureurs.** L'outil PIA de la CNIL est gratuit ; je peux préparer un brouillon à partir du registre. |
| D-3 | **Contrats de sous-traitance (DPA)** | Art. 28 : un contrat écrit avec chaque prestataire. | Télécharger et archiver ceux d'OVHcloud (dans l'espace client), de Google (accepter les « Data Processing Terms » dans la console Firebase), GitHub, Revolut ; demander ceux de Kolecto et Amen. Gratuit. Une seule session à la fois dans l'espace OVHcloud. |
| D-4 | **Bouton « Continuer avec Google »** chargé à l'ouverture de la page de connexion | Vérifié au navigateur : Google reçoit l'IP du visiteur (et peut lire ses cookies) **avant tout clic**. | ✅ **Fait le 18/11/2026** : Google n'est chargé qu'au clic (`src/js/google-signin-loader.js`, deux clics au lieu d'un) ; pages Cookies et Confidentialité mises à jour ; tests `tests/rgpd-age-google.test.js` et `e2e/login-rgpd.e2e.js`. |
| D-5 | **Adresse et téléphone de l'éditeur** dans les mentions légales | La LCEN exige pour un professionnel l'adresse et un numéro de téléphone ; le numéro RCS aussi si l'entreprise est inscrite (RCS du Puy-en-Velay). | 🟡 **RCS et téléphone ajoutés le 18/11/2026** (SIRET et TVA y étaient déjà). **Reste : l'adresse**, à fournir par l'éditeur (une domiciliation suffit si vous ne voulez pas publier votre domicile). |
| D-6 | **Alertes SOS lisibles par tous les membres** (D3 du 16/11) | Lieu et pseudo d'un accident visibles par toute la communauté. | Limiter aux membres proches ou aux contacts. |
| D-7 | **Vérification de l'âge** (moins de 15 ans) | Accord parental requis pour les traitements fondés sur le consentement. | ✅ **Fait le 18/11/2026** : case obligatoire à l'inscription, même question à la 1re connexion Google (refus → compte Google tout juste créé supprimé) ; réponse gardée avec sa date (`ageConfirmed`, `ageConfirmedAt` dans le profil) ; CGU et politique (§ 6) mises à jour. Le serveur souverain ne la demande pas encore : à ajouter quand l'inscription y sera branchée (phase A). |
| D-8 | **Information des anges gardiens** | Ils reçoivent un SMS sans avoir rien demandé (art. 14). | Ajouter au SMS « Infos : mon50ccetmoi.com/privacy » (quelques caractères, même coût). |
