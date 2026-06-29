# Présentation de l'application "Mon50ccEtMoi"

Ce document offre une vue d'ensemble de l'application, de son architecture technique et de sa proposition de valeur, à l'attention de l'équipe Innovation.

## 1. La Vision et la Proposition de Valeur

**Mon50ccEtMoi** est la première application entièrement dédiée aux conducteurs de scooters 50cc et de voitures sans permis (VSP). Face à l'absence de solutions adaptées sur le marché (les GPS classiques proposant souvent des itinéraires interdits), l'application répond à 4 piliers majeurs :

*   **🗺️ GPS Intelligent :** Routage spécifique excluant les autoroutes et voies rapides.
*   **🛡️ Ange Gardien :** Sécurité active avec détection de chute (via accéléromètre) et alerte SOS automatique.
*   **📋 Boîte Noire Certifiée :** Enregistrement de la télémétrie en cas de sinistre pour fournir une preuve.
*   **💼 InsurTech B2B :** Portail permettant la revente de rapports d'expertise de ces accidents aux assureurs.

## 2. Architecture Technique (Stack)

L'application est construite comme une **PWA (Progressive Web App)** packagée pour Android sous forme de **TWA (Trusted Web Activity)**.

*   **Frontend :** HTML5, CSS3, JavaScript Vanilla (ES6+). Conception "Glassmorphism/Cyberpunk".
*   **Backend (BaaS) :** Firebase (Auth, Firestore, Cloud Functions, Hosting).
*   **Cartographie :** Google Maps API (avec calcul d'itinéraires) couplé à Leaflet pour un mode hors-ligne.
*   **Capteurs et Hardware :** Utilisation intensive des API Web (`DeviceMotion`, `DeviceOrientation`, `Geolocation`, `Web Speech API`).
*   **Monétisation B2B :** Intégration de Revolut Merchant API pour la vente de rapports d'expertise aux assureurs.

## 3. Structure du Code

Le projet suit une structure modulaire sans framework lourd, privilégiant la performance et l'accès bas niveau :

*   `app.html` / `index.html` : Entrées principales de l'application utilisateur (PWA).
*   `assureur.html` : Portail dédié au B2B (InsurTech).
*   `sw.js` : Service Worker pour le cache hors-ligne et la PWA.
*   `public/js/` : Contient environ 60 modules spécialisés :
    *   `app-core.js` : Moteur de l'application.
    *   `guardian-angel.js` : Logique de détection de chute (analyse de la G-Force).
    *   `blackbox.js` : Enregistrement de la télémétrie et création de preuves.
    *   `insurance-portal.js` : Gestion des rapports côté assureur.
    *   `cortege-mode.js`, `safe-ride.js`, `leaderboard.js` : Fonctionnalités sociales et de gamification.
*   `functions/` : Cloud Functions Firebase (Node.js) gérant notamment les webhooks de paiement (Revolut).

## 4. Points d'Intérêt pour l'Innovation

Les domaines dans lesquels l'application pourrait bénéficier d'un soutien ou d'une exploration conjointe avec l'équipe innovation incluent :
*   **IA et Reconstitution (Litigation AI) :** Améliorer la précision de la reconstitution des accidents à partir des données des capteurs de la boîte noire.
*   **Optimisation des Capteurs :** Réduire la consommation de batterie tout en maintenant la précision de la détection de chute en arrière-plan.
*   **Intégration Blockchain / Web3 :** Consolidation de l'horodatage cryptographique des rapports pour garantir leur intégrité auprès des assurances.
