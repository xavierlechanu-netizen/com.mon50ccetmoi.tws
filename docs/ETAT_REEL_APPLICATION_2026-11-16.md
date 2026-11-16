# mon50ccetmoi — état réel de l'application (16 novembre 2026)

Document destiné à un investisseur, un assureur ou un estimateur. Il dit ce qui fonctionne vraiment, ce qui est
construit mais pas encore en service, et ce qui reste à faire. Établi d'après le code source, les tests automatiques
et le site en ligne, le 16/11/2026.

## 1. Vérifications du jour

| Vérification | Résultat |
| :--- | :--- |
| Tests automatiques (Jest) | **896 réussis**, 0 échec (60 suites) |
| Tests dans un vrai navigateur (Playwright) | **39 réussis** : chaque page se charge sans erreur ni script bloqué |
| Qualité du code (lint) et compilation | 0 erreur |
| Poids des pages | dans le budget (application : 485 Ko sur 499 Ko autorisés) |
| Règles de la base de données (émulateur) | 19 réussis, **3 échecs déjà présents** (à corriger, sans lien avec les dernières modifications) |
| Site en ligne mon50ccetmoi.com | à jour (version v1120040), carte fonctionnelle |
| Analyse de sécurité automatique de GitHub (CodeQL) | aucune alerte ouverte sur les derniers changements |

**Situation particulière** : depuis le 14/11/2026, la facturation Google Firebase est coupée. Les **fonctions serveur
Firebase sont à l'arrêt** (paiements, IA, connexion par clé d'accès, envois). Le **serveur souverain OVHcloud** qui les
remplace est installé mais **pas encore démarré** : il attend l'ouverture du stockage des preuves chez OVHcloud
(ticket en cours).

## 2. Fonction par fonction

Légende : ✅ fonctionne aujourd'hui · 🟡 construit, pas encore en service · 🔴 annoncé mais pas réel · ❓ non vérifié

| Fonction | État | Détail |
| :--- | :---: | :--- |
| Comptes, connexion par e-mail et Google | ✅ | Firebase Authentication. Pseudo unique et protégé. |
| Connexion par clé d'accès (FIDO2) | 🟡 | Réparée et testée (vraie signature, rejeu, hameçonnage), à l'arrêt avec les fonctions Firebase. |
| Suppression du compte, export des données | ✅ | Côté application ; le serveur souverain anonymise et garde les preuves d'accident (base légale RGPD). |
| GPS sans autoroute | ✅ | Itinéraires IGN qui excluent les autoroutes, durées adaptées à 45 km/h, carte IGN sans Google. |
| Guidage vocal pendant le trajet | ✅ | Virages, recalcul, arrivée, pauses ; appelle le pilote par son pseudo. **Pas encore essayé en roulant.** |
| Vignette Crit'Air et alertes ZFE | ✅ | Classe calculée selon les règles officielles ; commande uniquement sur le site de l'État. |
| Météo et vigilance Météo-France | ✅ / 🟡 | Météo réelle (Open-Meteo) ; vigilance servie par le serveur souverain (pas encore démarré). |
| Détection de chute (Ange Gardien) | ✅ | Par **seuil de choc** des capteurs du téléphone (pas d'intelligence artificielle), compte à rebours de 10 s. |
| SMS automatiques aux anges gardiens | 🟡 | Code prêt et testé (SMS OVHcloud, plafonds anti-abus), en attente du serveur ; en attendant, SMS envoyé depuis le téléphone du pilote. |
| Communauté : dangers, crews, discussions, convois, cortège | ✅ | Base Firestore, accès réservé aux membres connectés, contenus des membres sécurisés. |
| « Intercom tactique » (Squad Link) | 🔴 | Aucun intercom audio entre pilotes dans le code. Retiré de la page d'accueil. |
| Boîte Noire (boîtier) | 🟡 | Firmware prototype (ESP32-C3) : trames chiffrées, chaînées et signées. **Démarrage sécurisé et chiffrement de la mémoire pas encore activés.** |
| Preuves d'accident scellées (serveur) | 🟡 | Vérification de signature et coffre inaltérable 5 ans (Object Lock) prêts et testés, en attente du stockage OVHcloud. |
| Horodatage des rapports | 🟡 | Horodatage RFC 3161 (FreeTSA) et ancrage Bitcoin (OpenTimestamps) : réel, mais à l'arrêt avec les fonctions Firebase. **Ce n'est pas une « certification blockchain »** ni un horodatage qualifié eIDAS. |
| Portail assureur, rapport payant | 🟡 | Parcours réel (entreprise vérifiée par SIREN, paiement Revolut, factures) à l'arrêt ; **les trois niveaux de prix livrent aujourd'hui le même rapport.** |
| Rapport « par IA » | 🔴 | Le rapport assemble les données ; l'assistant IA (Gemini) est à l'arrêt, son remplacement par Mistral chez OVHcloud est prévu. |
| Assistance juridique IA | 🟡 | À l'arrêt (Gemini via fonctions Firebase). |
| Certificat batterie (SOH) | 🔴 | Voir § 3 : estimation déclarative, valeurs par défaut inventées, fausse « clé blockchain ». Retiré de la page d'accueil. |
| Espace garage partenaire | 🟡 | Inscription payante à l'arrêt (paiement) ; protections d'accès corrigées. |
| Boutique de points et « voix » | 🔴 | Points comptés dans le téléphone (falsifiables) ; le bouton d'achat des voix ne semble pas branché (non essayé). |
| Application Android (Play Store) | ✅ | Le site affiché par Chrome (TWA). |
| Cookies et consentement | ✅ | Un seul bandeau (Axeptio, en français) ; aucun traceur publicitaire ni de mesure d'audience. |

## 3. Décision urgente : le certificat batterie

Le certificat batterie (14,99 € et 29,99 €, `src/js/certificate.js`) ne doit pas être remis en vente en l'état :

- l'état de santé de la batterie est **calculé à partir de ce que déclare le pilote** (nombre de cycles, âge, style de
  conduite), sans aucune mesure ;
- **sans données, le certificat affiche des valeurs inventées** (« 92 % », « 12 450 km », « 345 cycles ») ;
- le niveau le plus cher affiche une **« clé » présentée comme blockchain, tirée au hasard** et inscrite nulle part ;
- il se présente comme un **« document officiel pour la revente »**, alors qu'aucun organisme ne l'a validé.

Aujourd'hui, rien ne se vend (paiements à l'arrêt). Avant toute reprise : soit retirer l'offre, soit la transformer
en « estimation indicative gratuite », sans valeurs par défaut ni mention « officiel » ou « blockchain ». Un vrai
certificat demanderait une mesure réelle (lecture du système de gestion de la batterie, ou banc de test) et, pour
être opposable, la validation d'un organisme.

## 4. Ce qui reste à faire, par priorité

| Priorité | Travail | Effort estimé |
| :--- | :--- | :--- |
| 1 | Démarrer le serveur souverain chez OVHcloud (stockage, clés, SMS, essai SOS), puis basculer les comptes | 3 à 5 jours, après le déblocage OVHcloud |
| 2 | Remettre en service paiements, portail assureur, clés d'accès sur le serveur souverain | 10 à 15 jours |
| 3 | Assistant IA (Mistral, OVHcloud AI Endpoints) | 5 à 10 jours |
| 4 | Décider du certificat batterie (§ 3) | 1 jour pour retirer ou requalifier ; bien plus pour un vrai certificat |
| 5 | Boîte Noire : sécurisation du firmware, fabrication, tests réels de chute | 20 à 40 jours + matériel |
| 6 | Rapports assureurs : trois niveaux réellement différents | 5 à 10 jours |
| 7 | Corriger les 3 tests de règles de la base | 1 jour |
| 8 | Points côté serveur, voix de Nexus Atlas (questions au pilote, voix régionales sans Google) | 10 à 20 jours |

## 5. Ce qui fait la valeur aujourd'hui

- Une **navigation réellement adaptée aux 50 cc et VSP** (sans autoroute, Crit'Air, ZFE, guidage vocal), sans
  dépendance à Google Maps.
- Une **architecture souveraine** prête (serveur en France, base PostgreSQL, preuves inaltérables), testée
  automatiquement (près de 900 tests).
- Un **effort de sécurité documenté** (audits du 6, 7 et 16 novembre 2026, corrections vérifiées par des tests).
- Une **chaîne de preuve Boîte Noire** cohérente de bout en bout (signature dans le boîtier, vérification et scellement
  côté serveur), dont il manque le passage en production.

*Ce document décrit l'état technique ; il ne vaut ni audit juridique ni certification. À tenir à jour à chaque mise en
service.*
