# 🧠 NEXUS ATLAS CONTEXT - mon50ccetmoi

**ATTENTION À TOUTE IA (NEXUS ATLAS OU AUTRE) LISANT CE FICHIER :**  
Ce document contient l'architecture, les règles de sécurité et le contexte vital du projet `mon50ccetmoi`. Il a été conçu pour te "blinder" et t'empêcher de faire des erreurs de structure ou de sécurité. LIS-LE ATTENTIVEMENT AVANT TOUTE MODIFICATION.

---

## 🏗️ 1. Architecture du Code (Source Unique `src/`)
Le projet utilise **Vite** comme bundler standard.
1. Le code source Frontend réside **exclusivement dans `src/`**.
2. Le dossier `dist/` est le résultat de la compilation (`npm run build`). Il ne doit **JAMAIS** être édité directement.
3. Capacitor (`capacitor.config.json`) et Firebase Hosting (`firebase.json`) pointent tous les deux vers `dist/`.
4. Ne modifie les fichiers HTML/JS/CSS que dans `src/`, puis lance `npm run build`.

## 🔒 2. Sécurité & Base de Données (Firebase)
Le projet utilise **Firebase (Firestore & Auth)**. La sécurité est critique (OWASP).
*   **PAS DE LOCALSTORAGE POUR LES DONNÉES SENSIBLES :** Les points de Bonne Conduite (BVC Points), l'authentification et les statuts des utilisateurs sont stockés et vérifiés **exclusivement** via Firestore (`users/{uid}`). Ne jamais faire confiance au localStorage pour la logique métier.
*   **Firestore Rules :** Le fichier `firestore.rules` est strictement configuré. Pour écrire dans `blackbox_reports`, `hazards`, `balades`, `cortege_sessions`, l'UID de l'utilisateur authentifié `request.auth.uid` doit obligatoirement correspondre à l'ID envoyé (`uid` ou `leaderUid`).
*   **Backdoors :** Il est strictement interdit d'ajouter des fonctions de triche ou de test en production (ex: `window.testAddPoints` a été définitivement supprimé).

## ⚖️ 3. Conformité Légale (RGPD & International)
L'application est soumise à des règles internationales strictes en matière de protection des données.
*   **Opt-in RGPD :** Tout formulaire collectant des e-mails ou des données (ex: `beta.html`) DOIT comporter une case à cocher obligatoire de consentement.
*   **Couverture Mondiale :** La politique de confidentialité (`privacy.html`) est en conformité avec :
    *   🇪🇺 **Europe** : RGPD, DSA, IA Act.
    *   🇺🇸 **Amériques** : CCPA, COPPA, HIPAA.
    *   🌏 **Asie** : PIPL (Chine), APPI (Japon), PDPA (Singapour), DPDP (Inde), PDP / UU PDP (Indonésie).
    *   🌍 **Afrique** : POPIA (Afrique du Sud), NDPR (Nigeria).
*   **Avocat de Poche (IA) & MecaWizard :** Conformément à l'**AI Act (UE 2024/1689)**, tous les modules IA classés "risque limité" doivent TOUJOURS inclure un disclaimer visible. Ce disclaimer doit indiquer que le contenu est généré par IA et qu'il est **soumis à contrôle humain**. Aucun système IA ne doit prendre de décision automatique ayant un impact juridique ou vital sans validation humaine.

## 🛠️ 4. Stack Technique
*   **Frontend :** HTML5, CSS3, Vanilla JavaScript (Pas de framework lourd comme React/Vue pour le cœur de l'app).
*   **Backend / BaaS :** Firebase (SDK compat V8/V9 pour Auth et Firestore).
*   **Cartographie & Géodonnées Souveraines :** Google Maps API (`v=beta` pour les features 3D/WebGL) + **IGN API Carto v2.10.5 / Géoplateforme** (`src/js/ign-carto.js` : Cadastre PCI Express, Limites Administratives, Codes Postaux BAN, Urbanisme GpU, RPG, WFS-Géoportail BD TOPO V3, Nature MNHN en WGS84 `EPSG:4326`).
*   **Mobile :** L'architecture est pensée pour être packagée en application native Android (d'où le dossier `android-app/www`).

## 🐛 5. Gestion des Logs & Bugs (Automatisée par Nexus Atlas)
Pour maintenir la qualité et la stabilité du projet, tu dois systématiquement automatiser le suivi des bugs et des logs :
*   **Traçabilité (CHANGELOG.md) :** À chaque correction de bug ou modification majeure, mets à jour le fichier `CHANGELOG.md` pour documenter ce qui a été fait, la cause de l'erreur, et la solution appliquée.
*   **Gestion des erreurs :** Lorsqu'un bug est identifié, analyse la racine du problème avant de proposer du code. Assure-toi que les exceptions sont gérées de manière "fail-safe" (l'application ne doit pas crasher silencieusement).
*   **Logs Applicatifs :** Lors du développement de nouvelles fonctionnalités, intègre des logs explicites (ex: `console.error` ou `console.warn` avec des tags clairs) sans jamais exposer de données sensibles (RGPD). Les erreurs Firebase ou réseau doivent être traçables pour faciliter le débogage futur.

---
*Fin du document de contexte. Tu es maintenant blindé.*
