# Registre des activités de traitement (RGPD, article 30) — mon50ccetmoi.com

Établi le 17/11/2026 d'après le code source (`src/`, `sovereign-core/server/`, `functions/`, `firestore.rules`).
À tenir à jour à chaque nouvelle fonction ou nouveau prestataire. Ce registre est un document interne : il peut être
demandé par la CNIL. Il ne remplace pas l'avis d'un juriste ou d'un DPO.

## Responsable du traitement

| | |
| :--- | :--- |
| Responsable | Xavier Le Chanu, entrepreneur individuel — SIRET 891 912 503 00036 |
| Contact RGPD | contact@mon50ccetmoi.com (aucun DPO désigné à ce jour, voir le rapport, décision D-1) |
| Représentant UE | Sans objet (établi en France) |

## Prestataires (sous-traitants, art. 28) et lieux

| Prestataire | Rôle | Lieu | Garantie de transfert | Contrat (DPA) |
| :--- | :--- | :--- | :--- | :--- |
| OVHcloud (OVH SAS) | VPS (API, PostgreSQL), Object Storage (preuves WORM, sauvegardes chiffrées), SMS SOS | France (Gravelines, Roubaix) | Sans transfert | DPA d'OVHcloud intégré aux conditions générales — **à vérifier et archiver** |
| Google Ireland (Firebase Auth, Firestore) | Comptes, base de l'application (transition) | UE (Belgique) ; Auth : États-Unis possible | DPF + clauses types | Conditions Firebase « Data Processing and Security Terms » — **à accepter dans la console** |
| Google (Identity Services) | Bouton « Continuer avec Google » | États-Unis | DPF | Conditions Google |
| Google (Gemini) | Assistant Nexus Atlas — **à l'arrêt** depuis le 14/11/2026 | UE / États-Unis | DPF | Conditions Google Cloud |
| GitHub (Pages) | Hébergement des pages (reçoit l'IP des visiteurs) | États-Unis | DPF | DPA GitHub |
| Revolut | Paiements | UE (Lituanie) | Sans transfert | Conditions Revolut Business |
| Kolecto | Factures électroniques | France | Sans transfert | **à vérifier** |
| Amen | Envoi des e-mails (bienvenue) | France | Sans transfert | **à vérifier** |
| Notion | Rapports d'erreur — **à l'arrêt** | États-Unis | DPF | **à vérifier** |
| IGN, OpenStreetMap (Overpass, Nominatim), Open-Meteo | Cartes, itinéraires, adresses, garages, météo — positions sans identité, IP du visiteur | France, Allemagne, Royaume-Uni, Suisse | Adéquation (R.-U., Suisse) | Services publics / conditions d'usage (pas de DPA) |
| Météo-France | Vigilance (appelée par notre serveur) | France | Aucune donnée personnelle envoyée | — |
| FreeTSA, OpenTimestamps | Horodatage (empreinte seule) — **à l'arrêt** | Allemagne / Bitcoin | Aucune donnée personnelle | — |

**Supprimés le 17/11/2026** (plus aucun appel) : Cloudflare cdnjs (icônes), Unsplash (images), ipify (adresse IP).

## Fiches de traitement

Légende de l'état : ✅ en service · 🟡 construit, pas encore en service · ⏸ à l'arrêt (fonctions Firebase coupées le 14/11/2026).

### T1 — Comptes et connexion ✅

| | |
| :--- | :--- |
| Finalité | Créer et gérer le compte, connecter le pilote |
| Base légale | Exécution du contrat (art. 6.1.b) |
| Personnes | Utilisateurs (dont mineurs de 14 à 18 ans) |
| Données | E-mail, pseudo, empreinte du mot de passe (scrypt / Firebase), rôle, points, véhicule ; clés d'accès FIDO2 (clé publique seule) |
| Où | Firebase Auth + Firestore `users`, `usernames`, `users/*/fido_credentials` ; serveur souverain table `users`, `fido_credentials` |
| Destinataires | Éditeur ; Google (Firebase) ; OVHcloud |
| Durée | Vie du compte ; effacement/anonymisation sous 30 jours après la demande |
| Code | `src/js/auth.js`, `sovereign-core/server/index.js` (`/auth/*`), `store-pg.js` |

### T2 — Géolocalisation et navigation ✅

| | |
| :--- | :--- |
| Finalité | Itinéraire sans autoroute, alertes de danger, ZFE, météo du trajet, détection de chute |
| Base légale | Consentement (écran de localisation), retirable |
| Données | Position précise et vitesse (dans le téléphone) ; position arrondie ~1 km envoyée à Open-Meteo et Nominatim (depuis le 17/11/2026) ; positions de départ/arrivée envoyées à l'IGN pour l'itinéraire |
| Où | Téléphone ; services cartographiques (sans identité) |
| Durée | Pas de conservation côté éditeur |
| Code | `src/js/app-core.js`, `route-planner.js`, `map-engine.js`, `app-features.js`, `safe-ride.js` |

### T3 — Présence et radar social ✅

| | |
| :--- | :--- |
| Finalité | Voir les pilotes proches (si activé) |
| Base légale | Consentement |
| Données | Pseudo, position arrondie ~100 m, horodatage |
| Où | Firestore `presence`, `social_radar`, `convoys/*/positions`, `cortege_sessions` |
| Destinataires | Membres connectés |
| Durée | Dernière position seulement ; masquée après 15 min ; supprimée à la désactivation ou à l'effacement |
| Point ouvert | L'arrondi est fait dans le navigateur : un client modifié peut publier une position exacte (voir rapport) |

### T4 — Alerte SOS et détection de chute ✅ (SMS serveur 🟡)

| | |
| :--- | :--- |
| Finalité | Prévenir les anges gardiens d'une chute ou d'un appel à l'aide |
| Base légale | Intérêts vitaux (art. 6.1.d) ; exécution du contrat |
| Personnes | Pilote ; **anges gardiens** (tiers dont le numéro est fourni par le pilote) |
| Données | Pseudo, position, précision, type d'alerte ; numéros (3 au plus) |
| Où | Numéros dans le téléphone ; envoi par l'API souveraine (`/api/v1/sos`) à OVHcloud SMS. Le serveur ne garde ni numéro ni position : seulement un compteur et une ligne d'audit (`sos.sent`, nombre de SMS). Firestore `sos_alerts`, `emergency_alerts` (alertes communautaires) |
| Destinataires | Anges gardiens ; OVHcloud (historique d'envoi de son côté) ; membres connectés pour les alertes communautaires |
| Durée | Serveur : rien ; OVHcloud : historique SMS selon OVHcloud ; Firestore : **pas d'effacement automatique** (à régler, rapport) |

### T5 — Contributions communautaires ✅

| | |
| :--- | :--- |
| Finalité | Dangers signalés, crews et discussions, annonces, avis garages, roadbooks, convois |
| Base légale | Exécution du contrat |
| Données | Pseudo, contenus, positions des dangers, photos d'annonces |
| Où | Firestore (`hazards`, `crews`, `crew_chats`, `exchange_listings`, `exchange_messages`, `garage_evaluations`, `roadbooks`…) ; API souveraine `hazards` |
| Destinataires | Membres connectés |
| Durée | Vie du compte ; à l'effacement, le texte libre des dangers est vidé (serveur souverain) |

### T6 — Classement et points ✅

| | |
| :--- | :--- |
| Finalité | Animation (points gagnés, classement) |
| Base légale | Intérêt légitime ; **opposition possible** (`PATCH /api/v1/rgpd/account {leaderboardVisible:false}`, depuis le 17/11/2026) |
| Données | Pseudo, points, grand livre des gains/dépenses |
| Où | Firestore `leaderboard`, `points_ledger` ; API souveraine `points_ledger` (ajout seul) |
| Durée | Vie du compte ; grand livre conservé (immuable) sous identifiant pseudonymisé après effacement |

### T7 — Boîte Noire : télémétrie et preuves d'accident 🟡

| | |
| :--- | :--- |
| Finalité | Preuve d'un accident (trames signées par le boîtier), rapport de sinistre |
| Base légale | Exécution du contrat ; intérêt légitime (conservation de la preuve) ; consentement pour transmission à un assureur |
| Données | Trames : accélérations, chocs, positions, horodatages, numéro de série ; métadonnées de session |
| Où | Coffre S3 Object Lock COMPLIANCE (OVHcloud) ; table `telemetry_sessions` (immuable) |
| Destinataires | Éditeur ; assureur désigné par le pilote |
| Durée | **5 ans**, non effaçable (Object Lock). Après effacement du compte : rattachées à un identifiant qui ne mène plus à l'identité (art. 17.3.e). **Données pseudonymisées, pas anonymes** (un trajet peut ré-identifier) |
| AIPD | **Requise** (rapport, décision D-2) |

### T8 — Portail assureurs B2B ⏸

| | |
| :--- | :--- |
| Finalité | Vente de rapports de sinistre à des assureurs vérifiés (SIREN) |
| Base légale | Contrat (assureur) ; consentement du pilote pour la transmission |
| Données | Rapport, coordonnées professionnelles de l'acheteur, factures |
| Où | Firestore `insurer_profiles`, `insurer_reports`, `invoices_to_issue` ; Revolut ; Kolecto |
| Durée | Factures 10 ans ; rapports vendus : archives de l'assureur |
| Audit | Action `b2b.report_access` réservée dans le journal : chaque consultation devra y être notée au passage sur le serveur souverain |

### T9 — Paiements et facturation ⏸

| | |
| :--- | :--- |
| Finalité | Encaisser, facturer, obligations comptables |
| Base légale | Exécution du contrat ; obligation légale (art. 6.1.c) |
| Données | Identifiant de commande, montant, statut ; coordonnées de facturation ; jamais de numéro de carte (Revolut) |
| Où | Firestore `revolut_orders`, `payment_confirmations`, `invoices_to_issue` ; Revolut ; Kolecto |
| Durée | 10 ans (Code de commerce, L123-22) |

### T10 — Assistant IA Nexus Atlas ⏸

| | |
| :--- | :--- |
| Finalité | Répondre aux questions du pilote ; analyses juridiques/mécaniques indicatives |
| Base légale | Exécution du contrat |
| Données | Texte des questions, contexte du trajet |
| Où | Firestore `nexus_conversations`, `nexus_suggestions`, `nexus_improvement_reports` ; Google Gemini |
| Durée | **Non définie** (à fixer, rapport) |
| Remplacement prévu | Mistral via OVHcloud AI Endpoints (phase B) |

### T11 — Liste d'attente Boîte Noire ✅

| | |
| :--- | :--- |
| Finalité | Un e-mail à la sortie du boîtier |
| Base légale | Consentement (case à cocher) |
| Données | E-mail, date |
| Où | Firestore `blackbox_waitlist` |
| Durée | Jusqu'à l'envoi, 2 ans au plus |

### T12 — Sécurité, modération et journaux ✅

| | |
| :--- | :--- |
| Finalité | Sécurité du service, lutte contre les abus, modération (DSA) |
| Base légale | Intérêt légitime ; obligation de sécurité (art. 32) |
| Données | Journaux de connexion (`auth_logs`, identifiant pseudonymisé), rapports d'erreur (`crash_reports`), signalements d'abus, décisions de modération (`mod_logs`, `mod_appeals`) ; journaux techniques du serveur (IP, URL, date, navigateur) |
| Où | Firestore ; journaux Docker du VPS (rotation 5 × 10 Mo par service depuis le 17/11/2026) |
| Durée | 12 mois (Firestore, **TTL à configurer**) ; journaux techniques : quelques semaines |

### T13 — Journal d'audit du serveur souverain 🟡 (nouveau, 17/11/2026)

| | |
| :--- | :--- |
| Finalité | Savoir qui a fait quoi et quand sur les données personnelles et les actions sensibles ; prouver le traitement des demandes RGPD |
| Base légale | Obligation de responsabilité (art. 5.2) et de sécurité (art. 32) ; intérêt légitime |
| Données | Identifiant interne de l'auteur et de la cible (UUID), rôle, action (liste fermée), date, résultat, détails chiffrés filtrés. **Jamais** d'e-mail, de pseudo, de numéro, de position ni d'IP |
| Où | Table `audit_log` (ajout seul, chaînée SHA-256, triggers anti-modification) ; tête de chaîne scellée chaque jour dans le coffre Object Lock |
| Destinataires | Administrateur (lecture elle-même journalisée) ; la personne concernée (dans son export) |
| Durée | 1 an (purge automatique, seule suppression acceptée par la base) |

### T14 — Traceurs sur l'appareil ✅

| | |
| :--- | :--- |
| Finalité | Connexion, préférences, choix cookies, jeton SOS, fonctionnement hors ligne |
| Base légale | Exemption de consentement (art. 82 loi Informatique et Libertés : strictement nécessaires) |
| Durée | Choix cookies 6 mois ; jeton SOS 30 jours glissants ; autres jusqu'à effacement |
| Code | `src/js/cookie-consent.js`, `src/cookies.html` |

### T15 — Publication automatique Facebook ⏸

Publication de messages de prévention sur la page Facebook de mon50ccetmoi (`functions/api/social.js`). Aucune donnée
d'utilisateur publiée. Hors périmètre des données personnelles des pilotes.

## Droits des personnes — où ils s'exercent

| Droit | Application | Serveur souverain | E-mail |
| :--- | :--- | :--- | :--- |
| Accès, portabilité (15, 20) | Export JSON (téléphone + profil Firestore) | `GET /api/v1/rgpd/account` (tout le compte + historique d'audit) | ✅ |
| Rectification (16) | Profil | `PATCH /api/v1/rgpd/account` (email, pseudo : mot de passe exigé) | ✅ |
| Effacement (17) | « Supprimer mon compte » (fonction Firebase ⏸ → proposition d'e-mail) | `DELETE /api/v1/rgpd/account` | ✅ |
| Opposition (21) | — | `PATCH … {leaderboardVisible:false}` | ✅ |
| Limitation (18), directives post-mortem | — | — | ✅ |
