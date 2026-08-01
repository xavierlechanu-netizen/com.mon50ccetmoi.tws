# 🧠 JARVIS CONTEXT - mon50ccetmoi

**ATTENTION À TOUTE IA (JARVIS OU AUTRE) LISANT CE FICHIER :**  
Ce document contient l'architecture, les règles de sécurité et le contexte vital du projet `mon50ccetmoi`. Il a été conçu pour te "blinder" et t'empêcher de faire des erreurs de structure ou de sécurité. LIS-LE ATTENTIVEMENT AVANT TOUTE MODIFICATION.

---

## 🏗️ 1. Architecture du Code (Règle des 3 Dossiers)
Le projet contient **3 répertoires principaux** qui partagent le même code source frontend.  
Si tu dois modifier un fichier HTML, CSS ou JS, tu **DOIS** le modifier dans ces 3 répertoires pour garder la synchronisation, ou utiliser un script de synchronisation si disponible :
1. `public/` (Dossier source Web principal)
2. `dist/` (Dossier build Web / PWA)
3. `android-app/www/` (Dossier source de l'application mobile Cordova/Capacitor)

*Exemple : Toute modification sur `app.html` doit être faite dans `public/app.html`, `dist/app.html`, et `android-app/www/app.html`.*

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
*   **Cartographie :** Google Maps API (`v=beta` pour les features 3D/WebGL).
*   **Mobile :** L'architecture est pensée pour être packagée en application native Android (d'où le dossier `android-app/www`).

## 🐛 5. Gestion des Logs & Bugs (Automatisée par Jarvis)
Pour maintenir la qualité et la stabilité du projet, tu dois systématiquement automatiser le suivi des bugs et des logs :
*   **Traçabilité (CHANGELOG.md) :** À chaque correction de bug ou modification majeure, mets à jour le fichier `CHANGELOG.md` pour documenter ce qui a été fait, la cause de l'erreur, et la solution appliquée.
*   **Gestion des erreurs :** Lorsqu'un bug est identifié, analyse la racine du problème avant de proposer du code. Assure-toi que les exceptions sont gérées de manière "fail-safe" (l'application ne doit pas crasher silencieusement).
*   **Logs Applicatifs :** Lors du développement de nouvelles fonctionnalités, intègre des logs explicites (ex: `console.error` ou `console.warn` avec des tags clairs) sans jamais exposer de données sensibles (RGPD). Les erreurs Firebase ou réseau doivent être traçables pour faciliter le débogage futur.

---
*Fin du document de contexte. Tu es maintenant blindé.*
