# Audit RGPD / CNIL et documents légaux (CGU, CGV) — 7 novembre 2026

Comparaison des pages légales (`terms.html` = CGU, `cgv.html`, `privacy.html`, `mentions-legales.html`, `cookies.html`) avec ce que l'application fait réellement (code, catalogue de prix, services appelés).

> Ce document est une analyse technique, pas un avis juridique. Les points « à décider » et les nouveaux textes doivent être validés par un juriste ou un DPO avant publication.

## 1. Corrigé le 7 novembre

| Sujet | Avant | Maintenant |
| :--- | :--- | :--- |
| Hébergeur (LCEN) | Firebase (Google, Irlande) | GitHub Pages (GitHub Inc., États-Unis) pour le site ; Google Irlande pour les données |
| Sous-traitants | Google Maps (plus utilisé), Revolut | Liste réelle : GitHub, Gemini, Revolut, Axeptio, IGN, OpenStreetMap, Open-Meteo, FreeTSA, OpenTimestamps |
| Transferts hors UE | « Google Maps » | GitHub (pages) et Gemini (questions à Nexus Atlas), sous Data Privacy Framework |
| Abonnement Boîte Noire+ | CGV : 5,00 €/mois | 4,99 €/mois, le prix réellement encaissé |
| Avatars | Pseudo envoyé à ui-avatars.com (États-Unis) | Avatar aux initiales fabriqué dans le téléphone |
| Voix | Phrases envoyées à Google Traduction | Dictionnaire intégré (FR/EN/ES) |
| Cookies / GPS | Refuser des cookies bloquait le GPS | Consentements séparés |
| Positions partagées | Au mètre près, lisibles par tous | Arrondies à ~100 m, 15 dernières minutes |

## 2. Politique de confidentialité (`privacy.html`) — à réécrire

La page actuelle ne contient pas les informations obligatoires (articles 13 et 14 du RGPD) :

- identité et coordonnées du responsable de traitement ;
- liste des données collectées (compte, pseudo, position GPS, position en arrière-plan, données de conduite, boîte noire, photos de sinistre, paiements, factures assureurs…) ;
- finalité et base légale **de chaque traitement** ;
- **durées de conservation** par catégorie ;
- destinataires et sous-traitants (voir mentions légales) ;
- transferts hors UE et garanties ;
- tous les droits (dont retrait du consentement, directives post-mortem) et le droit de réclamation auprès de la CNIL ;
- prise de décision automatisée (sanctions automatiques de Nexus Atlas, voir §4).

Elle contient aussi des affirmations inexactes :

- « toutes les données stockées localement sont chiffrées AES-256 » : faux (la session est en localStorage, simplement encodée) ;
- sections Chine (PIPL) et Californie (CCPA) sans objet pour une application vendue en France ;
- un « formulaire sécurisé ci-dessous » qui n'existe pas.

## 3. CGV (`cgv.html`) — écarts avec ce qui est vendu

| Point | Constat | Décision à prendre |
| :--- | :--- | :--- |
| « 1 an d'abonnement Sentinel Care offert » avec le boîtier | **Réglé le 7/11** : le paiement d'un boîtier accorde 12 mois de Boîte Noire+ (et les abonnements payés, jusque-là non activés, le sont) | — |
| Pack « boîtier + abonnement » | Le paiement enregistre un **engagement de 24 mois** et une caution de 49,99 €, absents des CGV | Annoncer clairement l'engagement, la caution et sa restitution avant l'achat |
| Produits absents | Boîtier, pack duo (161,98 €), diagnostic IA (4,99 €), certificats batterie (4,99/14,99/29,99 €), droit d'entrée garage (50 €) | Les ajouter avec leurs prix TTC |
| Rapports assureurs (B2B, 49,99 à 199,99 € HT) | Absents | CGV professionnelles séparées |
| Vendeur | Ni adresse, ni SIRET dans les CGV | Reprendre les mentions légales |
| Boîtier physique | Pas de délai de livraison, pas de droit de rétractation de 14 jours, pas de garantie légale de conformité (2 ans) ni de vices cachés | Obligatoire pour un bien vendu à un particulier |
| Abonnements | Pas de résiliation en ligne simple (obligatoire depuis 2023), pas d'information sur la reconduction | À ajouter |
| Médiateur de la consommation | Absent | Obligatoire : adhérer à un médiateur et le citer |
| Points mon50cc | Renonciation au droit de rétractation : correcte **si** une case à cocher la recueille au moment de l'achat | Vérifier l'écran d'achat |

## 4. CGU (`terms.html`) et clauses risquées (CGU et CGV)

Clauses probablement **abusives** ou contraires à la loi, à faire revoir :

1. **Bannissement sans remboursement** d'abonnements payés : clause sans doute abusive pour un consommateur.
2. **Responsabilité du parrain** pour les actes d'une autre personne, jusqu'à la perte de son compte : sanction pour le fait d'autrui.
3. **Sanctions appliquées par Nexus Atlas « sans intervention humaine »** : décision automatisée aux effets importants (article 22 du RGPD) et obligations du DSA. Il faut une vérification humaine **gratuite** ; aujourd'hui le recours est payant (en points).
4. **Bannissement « des adresses IP et adresses MAC »** : une application web ne voit pas les adresses MAC ; l'IP est une donnée personnelle à justifier et à limiter dans le temps. Le code de blocage d'IP ne fonctionne d'ailleurs pas (la base refuse l'écriture).
5. **Affirmations techniques inexactes** : « chiffrement de bout en bout » grâce à FIDO2, « Zero-Knowledge », « PBKDF2 100 000 itérations », « certificats Blockchain », « Quantum Shield E2EE ». Elles exposent à des pratiques commerciales trompeuses et au refus Google Play.
6. **« Nexus Atlas » marque déposée** : à confirmer (numéro de dépôt INPI à citer).

## 5. RGPD / CNIL — autres points

1. **Mineurs** : un 50 cc se conduit dès 14 ans. En France, l'accord d'un parent est requis avant 15 ans pour les traitements fondés sur le consentement. Aucune vérification d'âge à l'inscription.
2. **Localisation en arrière-plan** (« même lorsque l'application est fermée ») : la justifier précisément, la limiter aux fonctions qui en ont besoin (détection de chute), et la rendre désactivable.
3. **Analyse d'impact (AIPD)** : très probablement obligatoire (géolocalisation à grande échelle, personnes vulnérables, boîte noire, décisions automatisées).
4. **Registre des traitements** : à tenir.
5. **Durées de conservation** non appliquées : positions, humeurs, alertes SOS sans effacement automatique (TTL Firestore à configurer).
6. **Alertes SOS et d'accident** lisibles par tous les membres connectés.
7. **Empreinte d'appareil** (`deviceFingerprint`) encore présente sur les anciens comptes.
8. **Fausse « plainte transmise à la DGCCRF »** annoncée aux utilisateurs alors que rien n'est transmis.

## 6. Ordre conseillé

1. Décider des points du §3 (promesse « 1 an offert », produits à lister) et du §4 (clauses de sanction).
2. Réécrire la politique de confidentialité (brouillon possible à partir de ce rapport, validé par un juriste).
3. Choisir un médiateur de la consommation.
4. Vérification d'âge à l'inscription.
5. AIPD et registre des traitements.
