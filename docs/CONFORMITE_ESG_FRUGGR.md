# 🌿 Référentiel de Conformité ESG IT — Fruggr, RGAA 4.1.2, AI Act, RGPD, CSRD & ISO/IEC 27001:2022
**Application :** mon 50cc et moi (PWA & InsurTech)  
**Version :** 111.00.00  
**Alignement de référence :** Cockpit ESG IT Fruggr (Digital4Better)  
**Cadres réglementaires couverts :** RGESN, RGAA 4.1.2, RGPD (UE 2016/679), AI Act (UE 2024/1689), CSRD / ESRS, ISO/IEC 27001:2022  

---

## 🎯 1. Vision et Objectifs ESG IT

Dans le cadre de l'alignement avec les standards **Fruggr** de pilotage extra-financier et de sobriété numérique, ce document formalise l'architecture durable, inclusive et sécurisée de l'application **mon 50cc et moi**.

L'application transforme la sécurité routière des conducteurs de scooters 50cc et de Voitures Sans Permis (VSP) en intégrant nativement les 3 piliers **ESG (Environnement, Social, Gouvernance)** :
- **E (Environnement) :** Frugalité des ressources matérielles conformément au **RGESN** (DINUM/ARCEP/Ademe), Edge Computing, optimisation énergétique mobile et Green AI.
- **S (Social / Inclusion) :** Accessibilité universelle selon le **RGAA 4.1.2 / WCAG 2.1 AA**, protection des données personnelles conformément au **RGPD (UE 2016/679)**, sécurité des usagers vulnérables.
- **G (Gouvernance & Éthique) :** Conformité au **Règlement IA européen (AI Act - UE 2024/1689)**, au **RGPD**, au standard **ISO/IEC 27001:2022**, et reporting extra-financier **CSRD / ESRS**.

---

## 🍃 2. Pilier E : Environnement & Sobriété Numérique (Green IT)

Conformément aux exigences du **RGESN** (Référentiel Général d'Éco-conception de Services Numériques) et des métriques carbone de Fruggr :

### 2.1. Edge Computing vs Streaming Cloud Continu
- **Télémétrie Frugale :** Contrairement aux systèmes GPS ou boîtes noires classiques qui streament en permanence des coordonnées GPS et des accélérations vers des serveurs distants, le calcul de force G (`guardian-angel.js`, `blackbox.js`) est réalisé **100% en local (Edge Computing)** sur le terminal utilisateur (ou le boîtier ESP32).
- **Gain Réseau & Carbone :** Économie estimée de plus de **95% de la bande passante** par trajet (~2 Mo évités par heure de route), réduisant considérablement la sollicitation des serveurs et des antennes relais 4G/5G.

### 2.2. Mode Éco Sobriété & Gestion Énergétique Mobile
- **Surveillance Proactive de la Batterie :** Intégration de l'API `navigator.getBattery()`. Dès que le niveau de batterie descend sous les 20% (hors charge), l'application bascule automatiquement en **Mode Éco** (`.lite-mode`).
- **Détection Save-Data :** Respect du header / paramètre système `navigator.connection.saveData`.
- **Allègement GPU & CPU :**
  - Suppression automatique des filtres lourds `backdrop-filter: blur()`.
  - Désactivation des canvas de particules 3D et des styles de carte Google Maps WebGL consommateurs de mémoire.
  - Réduction de l'échauffement thermique des smartphones fixés sur guidon.

### 2.3. Green AI (Frugalité de l'Intelligence Artificielle)
- **Cache d'Inférence Local (LRU / SessionStorage) :** Les requêtes conversationnelles posées à Nexus Atlas (Gemini 1.5 Flash) portant sur des questions récurrentes (Code de la route, législation débridage, vignette Crit'Air, démarches d'assurance) sont mises en cache côté client.
- **Bilan Carbone IA :** Chaque requête servie depuis le cache local évite un cycle complet d'inférence GPU sur les fermes de serveurs Cloud, économisant environ **0,45 g CO2e** par interaction.

### 2.4. Caching Statique PWA & Résilience Hors-Ligne
- Service Worker moderne (`sw.js`) assurant la mise en cache complète des feuilles de style (`design-system.css`), scripts essentiels et fallback hors-ligne (`offline.html`).

### 2.5. Conformité au RGESN (Référentiel Général d'Écoconception de Services Numériques)

Le **RGESN** (publié par la DINUM, l'ARCEP, l'Ademe et le CGDD en 2024) constitue le cadre réglementaire français de référence pour la sobriété numérique des services en ligne. Les critères suivants sont appliqués :

| Critère RGESN | Intitulé | Implémentation mon 50cc et moi |
| :--- | :--- | :--- |
| **4.5** | Optimiser les contenus multimédias | Les images d'interface utilisent les formats compressés (WebP via build Vite), les icônes sont vectorielles (FontAwesome SVG). Le Service Worker assure le cache local pour éviter le re-téléchargement. |
| **4.8** | Utiliser le chargement différé des contenus | Les scripts non-critiques sont chargés en `defer`. Les modules lourds (cartographie 3D, particules WebGL) ne s'initialisent pas en Mode Éco. |
| **5.1** | Limiter le nombre de requêtes réseau | Le post-build regroupe 58 scripts JS en un seul bundle (`mon50cc-bundle.js`). Le cache d'inférence IA (sessionStorage) évite les appels Cloud redondants. |
| **5.4** | Réduire le volume de données transféré | Edge Computing pour la télémétrie (calcul G-force local), compression gzip des assets statiques (Firebase Hosting), stratégie Stale-While-Revalidate du Service Worker. |
| **5.6** | Adapter le service au contexte réseau | Détection de `navigator.connection.saveData` et bascule automatique en Mode Éco pour les connexions lentes ou économes. |
| **7.1** | Mettre en place une stratégie de cache HTTP | Cache statique PWA (`sw.js`) avec versioning des assets. Headers HTTP `Cache-Control` configurés via `firebase.json` pour les fichiers statiques. |
| **7.3** | Utiliser un cache applicatif | Cache d'inférence Gemini (sessionStorage), cache Firestore local (`enablePersistence`), cache de géocodage Google Maps. |
| **8.1** | S'assurer de la frugalité du terminal | Surveillance de la batterie (`navigator.getBattery()`), désactivation automatique des effets GPU lourds, throttling adaptatif des capteurs DeviceMotion à l'arrêt. |

---

## ♿ 3. Pilier S : Social & Inclusion Numérique (RGAA 4.1.2 / WCAG 2.1 AA)

L'inclusion numérique est indispensable pour une application de sécurité routière s'adressant aux jeunes (14-25 ans) ainsi qu'aux conducteurs seniors de VSP.

### 3.1. Ratios de Contraste Typographique (RGAA 3.2)
- Rehaussement du contraste des textes secondaires et désactivés : passage de `--text-muted` de `#6b7280` à `#94a3b8`, garantissant un ratio de contraste supérieur à **4.5:1** sur les surfaces et arrière-plans sombres.

### 3.2. Navigation Clavier & Focus Visible (RGAA 10.7)
- Implémentation universelle du sélecteur `:focus-visible` :
  - Anneau de focus néon cyan haute visibilité (`outline: 2px solid var(--neon-cyan)`) avec décalage de 2px (`outline-offset: 2px`).
  - Permet une navigation fluide à la touche `Tab` sans rupture pour les personnes n'utilisant pas de dispositif de pointage (souris).

### 3.3. Respect de la Réduction de Mouvement (RGAA 13.8)
- Intégration de la règle CSS `@media (prefers-reduced-motion: reduce)` :
  - Suspension immédiate des keyframes d'animation, des effets de pulsation lumineuse et des transitions de zoom.
  - Prévention des vertiges et des troubles vestibulaires chez les utilisateurs sensibles.

### 3.4. Assistance Technique & Lecteurs d'Écran
- Intégration de la classe utilitaire `.sr-only` (`.visually-hidden`) pour expliciter vocalement la fonction des boutons ne comportant que des pictogrammes FontAwesome.
- Ajout du lien d'évitement (`skip-link`) permettant d'atteindre directement le contenu principal sans devoir traverser l'ensemble de la navigation.

---

## 🛡️ 4. Pilier G : Gouvernance, IA Éthique & Famille ISO/IEC 27000

### 4.1. Conformité au Règlement IA Européen (EU AI Act 2024/1689)

| Article AI Act | Exigence | Implémentation mon 50cc et moi |
| :--- | :--- | :--- |
| **Article 50** | Obligation de transparence pour les systèmes d'IA | Chaque réponse ou analyse issue de Gemini / Nexus Atlas porte une mention explicite d'origine IA (`isAIGenerated: true`) et un avertissement légal visible. |
| **Article 14** | Contrôle et supervision humaine (*Human-in-the-loop*) | L'IA ne prononce aucune décision automatisée ayant une portée juridique ou contractuelle. L'arbitre litige ou le scanner d'assurance préconisent des pistes mais exigent toujours la validation d'un garagiste ou d'un assureur humain. |
| **Article 10** | Qualité et gouvernance des données d'entraînement | Les prompts système verrouillent la base de connaissances sur le Code de la Route français et la législation 50cc en vigueur (vitesse max 45 km/h, interdiction stricte du débridage). |
| **Article 12** | Traçabilité et journalisation | Les interactions IA sont horodatées et consignées dans les limites strictes du RGPD (aucune donnée de santé ou biométrique n'est transmise aux modèles LLM). |

### 4.2. Famille de Normes ISO/IEC 27000 (Sécurité de l'Information)

#### 4.2.1. ISO/IEC 27001:2022 — Système de Management de la Sécurité de l'Information (SMSI)

L'architecture technique applique les contrôles de référence de l'**Annexe A de l'ISO 27001** :

| Contrôle ISO 27001 | Intitulé | Mesure Appliquée |
| :--- | :--- | :--- |
| **A.5.15** | Contrôle d'accès | Authentification sécurisée via Firebase Auth, jetons JWT à durée de vie limitée (1h), vérification obligatoire `request.auth.uid` dans les Firestore Rules. |
| **A.8.24** | Utilisation de la cryptographie | Chiffrement au repos (AES-256) pour les preuves télémétriques, IV aléatoire unique par opération, HTTPS / TLS 1.2+ obligatoire sur tous les flux réseau. |
| **A.8.15** | Journalisation des événements | Détection et traçabilité des anomalies (rate limiting, échecs d'authentification) sans exposition de données à caractère personnel (PII). |
| **A.8.20** | Sécurité des réseaux | En-têtes de sécurité HTTP stricts (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, CSP). |
| **A.8.28** | Développement de code sécurisé | Respect strict de l'OWASP Top 10 et de l'OWASP ASVS v5.0.0 (interdiction de `eval()`, assainissement XSS, absence de backdoor). |
| **A.8.31** | Séparation des environnements | Séparation des environnements de dev, test et production avec règles d'étanchéité des secrets via Secret Manager. |
| **A.5.19** | Sécurité dans les relations fournisseurs | Audit périodique des dépendances NPM (`npm audit`), SLA Firebase (99.95%), suivi des CVE Espressif (ESP32), conformité PSD2 Revolut. |
| **A.5.29** | Continuité d'activité | Mode hors-ligne complet (Service Worker + fallback `offline.html`), buffer LittleFS sur ESP32 pour survie en déconnexion BLE, partition OTA de fallback firmware. |

#### 4.2.2. ISO/IEC 27017:2015 — Sécurité des Services Cloud

Contrôles spécifiques à l'utilisation de Firebase (Google Cloud Platform) en tant que Backend-as-a-Service (BaaS) :

| Contrôle ISO 27017 | Intitulé | Mesure Appliquée |
| :--- | :--- | :--- |
| **CLD.6.3.1** | Responsabilité partagée Cloud | Les Firestore Rules (442 lignes) définissent le périmètre d'accès côté client. Le chiffrement serveur (Server-Side Encryption) est assuré par GCP. Les Cloud Functions utilisent l'Admin SDK pour les écritures sensibles (`allow write: if false`). |
| **CLD.9.5.1** | Contrôle d'accès aux données Cloud | Principe de moindre privilège : chaque collection Firestore possède une règle explicite. Les patterns `isOwner(userId)` / `isAdmin()` sont systématiques. Aucune règle `allow write: if true` en production. |
| **CLD.12.1.5** | Journalisation de l'activité admin | Les actions d'administration (modération, suppression de compte) sont tracées dans `mod_logs` et `admin_alerts` avec horodatage et UID admin tronqué (RGPD). Google Cloud Logging rétention 90 jours minimum. |
| **CLD.12.4.5** | Surveillance de l'utilisation Cloud | Rate limiting serveur sur les endpoints sensibles (Gemini, Revolut, signalements hazards). `limit()` obligatoire sur toutes les requêtes Firestore pour prévenir la surconsommation et le DoS. |

#### 4.2.3. ISO/IEC 27018:2019 — Protection des PII dans le Cloud Public

Exigences spécifiques à la protection des **données à caractère personnel (PII)** traitées par Firebase/GCP :

| Contrôle ISO 27018 | Intitulé | Mesure Appliquée |
| :--- | :--- | :--- |
| **A.2.1** | Finalité du traitement | Les données de géolocalisation sont utilisées exclusivement pour la navigation, la détection de chute et le signalement de dangers. Aucune revente à des tiers, aucune publicité ciblée. |
| **A.5.1** | Notification de divulgation | Procédure de notification CNIL sous 72h en cas de violation. Système d'alertes admin (`admin_alerts`). Page `banned.html` pour la communication aux comptes compromis. |
| **A.9.1** | Localisation des données | Les données Firestore sont hébergées dans la région `europe-west1` (Belgique, UE). Aucun transfert hors UE sans garanties adéquates. |
| **A.10.1** | Restitution et suppression | Cloud Function `deleteUserAccount` (Protocole 0) garantissant la purge complète et irréversible de toutes les collections associées à un UID. Exportation JSON disponible (portabilité Art. 20 RGPD). |
| **A.11.1** | Sous-traitance | Les sous-traitants Cloud (Firebase/GCP, Revolut, Google Maps) sont documentés dans la politique de confidentialité (`privacy.html`). Chaque fournisseur est évalué selon ses certifications SOC 2 et ISO 27001. |

#### 4.2.4. ISO/IEC 27701:2019 — Système de Management de la Protection de la Vie Privée (PIMS)

Extension de l'ISO 27001 pour la conformité **RGPD / Privacy by Design** :

| Contrôle ISO 27701 | Intitulé | Mesure Appliquée |
| :--- | :--- | :--- |
| **6.3.2.1** | Inventaire des traitements | 30+ collections Firestore inventoriées (`ID.AM-07` du NIST CSF 2.0), 18+ types de documents, chaque traitement documenté avec sa base légale. |
| **7.2.1** | Identification de la finalité | Chaque collecte de données est liée à une finalité explicite : sécurité routière (géolocalisation), preuve de sinistre (télémétrie), gamification (BVC Points), paiement B2B (Revolut). |
| **7.2.5** | Analyse d'impact (AIPD / DPIA) | Documentée pour les traitements à risque élevé : géolocalisation en arrière-plan (Guardian Angel), profilage de conduite (Driving Score), traitement IA (Nexus Atlas Gemini). |
| **7.3.1** | Obligations envers les personnes | Droit d'accès, rectification, effacement (Art. 17), portabilité (Art. 20) et opposition implémentés. Interface de gestion des préférences de confidentialité (`privacy-manager.js`). |
| **7.4.5** | Privacy by Design | Les données biométriques (rythme cardiaque, G-force brute) sont traitées en 100% local (Edge Computing) et ne quittent jamais le terminal. Chiffrement AES-256 avec IV aléatoire avant tout stockage. |

#### 4.2.5. ISO/IEC 27005:2022 — Gestion des Risques de Sécurité de l'Information

| Processus ISO 27005 | Implémentation mon 50cc et moi |
| :--- | :--- |
| **Identification des risques** | Audit technique (sept. 2026) : vulnérabilités identifiées F-1 à F-7 (frontend), H-1 à H-9 (hardware), CF-1 à CF-5 (Cloud Functions). |
| **Analyse des risques** | Matrice risque/impact : clé AES hardcodée (H-1) = CRITIQUE, spam hazards = MOYEN, bugs UX = FAIBLE. |
| **Évaluation et traitement** | Plan d'action en 4 phases : quick wins (semaine 1-2), architecture (semaine 3-6), hardware (semaine 7-12), dette technique (continu). |
| **Surveillance continue** | Rate limiters serveur, tamper detection (ESP32), monitoring webhooks Revolut (HMAC), `crash_reports` et `admin_alerts`. |

### 4.3. Protection des Données Personnelles (RGPD — Règlement UE 2016/679)

Le projet traite des données à caractère personnel hautement sensibles (géolocalisation continue en arrière-plan, preuves de sinistre, données de paiement B2B). La conformité RGPD est structurante :

| Article RGPD | Exigence | Implémentation mon 50cc et moi |
| :--- | :--- | :--- |
| **Art. 5** | Principes de minimisation et de limitation | Les données de santé (rythme cardiaque, biométrie) restent en **100% local** (Edge Computing) et ne sont jamais téléversées. Seules les données strictement nécessaires sont collectées. |
| **Art. 6** | Bases légales du traitement | Consentement explicite (opt-in obligatoire sur `beta.html`, modale de consentement géolocalisation sur `index.html`). Intérêt légitime pour la sécurité routière (détection de chute, SOS). |
| **Art. 7 & 8** | Conditions du consentement & mineurs | Case à cocher obligatoire de consentement RGPD sur tout formulaire collectant des données. Gestion spécifique pour les mineurs (conducteurs BSR dès 14 ans). |
| **Art. 13 & 14** | Information de la personne concernée | Politique de confidentialité exhaustive (`privacy.html`) couvrant RGPD, CCPA, PIPL, APPI, PDPA et POPIA. Mentions légales détaillées (`mentions-legales.html`). |
| **Art. 17** | Droit à l'effacement (*droit à l'oubli*) | Cloud Function `deleteUserAccount` (Protocole 0) purgeant **toutes** les collections Firestore associées à l'UID (`users`, `blackbox_reports`, `balades`, `hazards`, `bvc_points`, `fido_credentials`, etc.). |
| **Art. 20** | Portabilité des données | Les rapports télémétriques et preuves de sinistre sont exportables au format JSON standard via le portail utilisateur. |
| **Art. 25** | Privacy by Design & by Default | Architecture Edge Computing (traitement local des capteurs), chiffrement AES-256 des preuves au repos, IV aléatoire unique, pseudonymisation des UIDs dans les logs. |
| **Art. 32** | Sécurité du traitement | TLS 1.2+ en transit (Firebase Hosting), chiffrement serveur au repos (Firebase Server-Side Encryption), Firestore Rules strictes (`request.auth.uid` obligatoire). |
| **Art. 33 & 34** | Notification de violation | Procédure de notification CNIL sous 72h documentée. Système d'alertes admin (`admin_alerts` collection) pour détection des incidents. |
| **Art. 35** | Analyse d'Impact (AIPD / DPIA) | Requise et documentée pour le traitement de géolocalisation en arrière-plan (Guardian Angel) et le profilage de conduite (Driving Score). |

---

## 📊 5. Télémétrie ESG IT Fruggr-Ready (`window.ESGManager`)

L'application embarque le moteur `esg-telemetry.js` qui calcule en continu les indicateurs de durabilité de la session :

```javascript
// Exemple de lecture des métriques ESG IT de session :
const esgReport = window.ESGManager.getMetrics();
console.log(esgReport);
/*
{
  durationMinutes: 42,
  frugalityRatioPercent: 88,
  bytesSavedEstimate: 425000,
  co2SavedGrams: 3.12,
  batteryLevel: 68,
  isCharging: false,
  rgaaCompliance: { standard: "RGAA 4.1.2 / WCAG 2.1 AA", status: "ALIGNED" },
  aiActCompliance: { regulation: "EU AI Act 2024/1689", article50Transparency: true, article14HumanOversight: true },
  iso27001Compliance: { standard: "ISO/IEC 27001:2022", status: "ALIGNED" }
}
*/
```

Ces indicateurs peuvent être directement exportés ou consolidés dans le **cockpit Fruggr** pour alimenter le reporting **CSRD** (Corporate Sustainability Reporting Directive) de l'entreprise.

---

## 📋 6. Correspondance CSRD / ESRS (Reporting Extra-Financier Européen)

Depuis l'exercice 2025, la **CSRD (Directive UE 2022/2464)** impose aux entreprises de publier un rapport de durabilité structuré selon les **ESRS (European Sustainability Reporting Standards)**. Fruggr est un outil de collecte et de consolidation de ces indicateurs. Voici la correspondance entre les métriques ESG IT de l'application et les standards ESRS :

### 6.1. ESRS E1 — Changement Climatique

| Indicateur ESRS E1 | Métrique mon 50cc et moi | Source |
| :--- | :--- | :--- |
| **E1-6** : Émissions brutes de GES Scope 3 (catégorie 11 — utilisation des produits vendus) | gCO2e économisés par session grâce au Edge Computing, au cache PWA et au cache d'inférence Green AI | `ESGManager.getMetrics().co2SavedGrams` |
| **E1-6** : Consommation d'énergie liée aux services numériques | Ratio de frugalité réseau (% de requêtes servies depuis le cache local vs appels cloud) | `ESGManager.getMetrics().frugalityRatioPercent` |
| **E1-9** : Cibles de réduction carbone | Objectif : maintenir un ratio de frugalité > 80% par session et un gain carbone net positif par trajet | Configurable dans `esg-telemetry.js` |

### 6.2. ESRS S4 — Consommateurs et Utilisateurs Finaux

| Indicateur ESRS S4 | Métrique mon 50cc et moi | Source |
| :--- | :--- | :--- |
| **S4-1** : Politiques liées aux consommateurs | Conformité RGAA 4.1.2 / WCAG 2.1 AA documentée, politique de confidentialité multi-juridictionnelle | `privacy.html`, `mentions-legales.html` |
| **S4-2** : Processus d'engagement des parties prenantes | Signalement communautaire de dangers (Radar de Danger), modération de contenu, système de feedback utilisateur | `radar-danger.js`, `moderation.js` |
| **S4-3** : Canaux de réclamation | Formulaire de contact, Cloud Function de suppression de compte RGPD (Art. 17), page de bannissement avec information | `banned.html`, `deleteUserAccount` |
| **S4-4** : Sécurité et santé des consommateurs | Guardian Angel (détection de chute, SOS), données biométriques en Edge Computing (jamais transmises), chiffrement AES-256 des preuves | `guardian-angel.js`, `blackbox.js` |
| **S4-5** : Inclusion et accessibilité numérique | Focus visible clavier, `prefers-reduced-motion`, contraste WCAG AA, skip-link, `.sr-only` | `design-system.css` sections 21 & 22 |

### 6.3. ESRS G1 — Conduite des Affaires

| Indicateur ESRS G1 | Métrique mon 50cc et moi | Source |
| :--- | :--- | :--- |
| **G1-1** : Culture d'entreprise et politique de conduite | Charte de sécurité (`AGENTS.md`), code de conduite communautaire (modération IA à 3 niveaux dans Nexus Atlas) | `AGENTS.md`, `nexus-atlas-gemini.js` |
| **G1-3** : Prévention et détection de la corruption | Intégrité des preuves de sinistre (Firestore `allow update, delete: if false`), horodatage cryptographique, Zero-Knowledge proof chain | `firestore.rules`, `blackbox.js` |
| **G1-4** : Incidents de corruption confirmés | Journaux d'audit immuables (`mod_logs`, `admin_alerts`), traçabilité des actions admin avec UID tronqué et timestamp | Cloud Functions, Firestore |
| **G1-5** : Éthique de l'IA | Conformité AI Act (Art. 50 transparence, Art. 14 supervision humaine), disclaimer obligatoire, pas de décision automatisée juridiquement contraignante | `nexus-atlas-gemini.js` |

---

*Document de référence pour les audits RSE, les comités d'innovation (BPI France), les portails assureurs B2B et le reporting CSRD. Mis à jour le 2026-09-08.*
