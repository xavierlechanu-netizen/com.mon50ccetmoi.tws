# Audit de sécurité — 16 novembre 2026

Référentiels : OWASP Top 10 (2021), OWASP ASVS v5.0.0, NIST CSF 2.0. Ce qui était déjà corrigé dans
`AUDIT_2026-11.md` et `PLAN_DETTE_TECHNIQUE_2026-11.md` n'est pas repris ; chaque point restant a été
vérifié dans le code.

Situation : site sur GitHub Pages + Firebase (Firestore et connexion actifs, Cloud Functions à
l'arrêt depuis le 14/11) ; serveur souverain installé sur le VPS OVHcloud mais pas encore démarré.

## 1. Corrigé dans cette PR

| Gravité | Problème | Où | Correction |
| :--- | :--- | :--- | :--- |
| 🔴 Exploitable aujourd'hui | **Faux boutons dans les contenus des membres.** DOMPurify retire les scripts mais garde `data-action` et `style`. Un message de crew, une annonce, une photo d'annonce, un arrêt ou une alerte pouvait poser un bouton invisible sur tout l'écran, qui lançait une fonction de l'appli au premier toucher (par ex. réserver l'annonce de l'attaquant avec les points de la victime). | `crew-chat.js:164`, `exchange.js:541` (photo) et `:569-576` (identifiants), `garage-market.js:75-79`, `pit-stops.js:60-63`, `sos-community.js:196-201`, `social-radar.js:161-171`, `radar-social.js:138-141`, `convoy.js:256,308`, `leaderboard.js:147`, `cortege-mode.js:148`, `garage.js:122,219-221`, `community-gas.js:187` | Nouveau `html-escape.js` (`escapeHtml`, `safeId`, `safeActionText`, `safeNumber`, `safeImageUrl`) appliqué partout. Garde-fou : `tests/html-escape.test.js`. |
| 🔴 Conformité (CNIL) | **Deux bandeaux cookies à la fois.** Le nôtre n'avait qu'un bouton « J'ai compris » et disait « en continuant votre navigation, vous acceptez », ce qui n'est pas un consentement pour la CNIL. Celui d'Axeptio s'affichait en même temps, en anglais ou en français selon la page, car deux réglages concurrents étaient chargés (`356689da…` français dans `config.js`, `73984ab7…` anglais dans `axeptio-config.js`). | `config.js:197-249`, `axeptio-config.js` | Axeptio est gardé comme **seul** bandeau (décision de l'utilisateur), en **français** partout : « Non merci » au même niveau que « OK pour moi ». `config.js` charge `axeptio-config.js` au lieu d'en avoir sa propre copie. `googleConsentMode` est retiré (plus aucune balise Google). La page Cookies a un bouton « Modifier mes choix » (`openAxeptioCookies()`). Test : `tests/cookie-banner.test.js`. |
| 🟠 Moyen | **CSP contournable** : `script-src` autorisait unpkg, jsdelivr et cdnjs (ils servent n'importe quel paquet npm, ou une vieille version d'AngularJS : une balise injectée suffit à exécuter du code), ainsi que Facebook, Google Traduction et Google Maps, que plus aucune page n'utilise. | `vite.config.js:22-25`, `firebase.json:53` | Retirés. `frame-ancestors 'self'` ajouté à l'en-tête Firebase. Garde-fou : `tests/strict-csp.test.js`. 39 tests navigateur verts (aucun script bloqué). |
| 🟡 Faible | `garage_partners` : n'importe quel membre pouvait créer sa propre fiche « garage partenaire payé », avec un faux numéro de commande. Personne ne lit encore cette collection. | `firestore.rules:610-614` | Écriture réservée au webhook de paiement. Testé dans l'émulateur. **Il reste à publier les règles** (voir § 3). |
| 🟡 Serveur souverain | Connexion : un email inconnu répondait environ 50 fois plus vite qu'un mauvais mot de passe, ce qui permettait de deviner quels emails sont inscrits. | `sovereign-core/server/index.js` (route `/auth/login`) | Même calcul scrypt dans les deux cas. Testé. |
| 🟡 Serveur souverain | Inscription : un mot de passe de plus de 256 caractères provoquait une erreur 500. L'email n'était pas validé, et le pseudo pouvait contenir du HTML. | idem (`/auth/register`) | Refus clair (400). Le pseudo ne peut plus contenir `< > " ' & \``. Testé. |
| 🟡 Conformité | L'écran de confidentialité de l'appli affirmait une localisation « continue, y compris en arrière-plan », ce qui contredit la politique de confidentialité. | `rgpd-cnil.js:88-89` | Texte corrigé : uniquement quand l'application est ouverte. |

## 2. Décisions à prendre (non faites)

- **D1 — Axeptio : gardé (décidé le 16/11/2026).** À faire dans la console Axeptio : retirer l'étape « Partage de données avec Google » (Google Consent Mode), car le site n'a plus aucune balise Google. La version anglaise `73984ab7…` n'est plus utilisée. Risque résiduel accepté : le script Axeptio, servi par un tiers, tourne aussi sur la page de connexion et les pages d'administration.
- **D2 — FAIT (16/11/2026)** : 10 alertes par pilote sur 24 h et budget global de SMS sur 24 h (`SOS_DAILY_SMS_BUDGET`, 300 par défaut) ; au-delà, l'appli propose le 112. Reste possible plus tard : numéros d'anges gardiens confirmés par SMS. Constat d'origine — **Coût et abus des SMS SOS** (serveur souverain, pas encore en ligne). Les numéros sont libres et la limite est de 3 alertes par compte toutes les 10 minutes, sans plafond par jour ni plafond global. Un compte malveillant peut donc envoyer des SMS payants à n'importe quel 06/07. Pistes : plafond quotidien par compte, alerte sur le crédit SMS dans l'espace OVHcloud, numéros d'anges gardiens confirmés par un SMS de vérification. À trancher, car chaque piste touche le comportement en urgence.
- **D3 — Alertes SOS lisibles par tous les membres connectés** (`firestore.rules:229-230` et `:514-515`) : lieu de l'accident et pseudo. C'est voulu pour l'entraide entre pilotes, mais on pourrait limiter l'accès aux membres proches ou aux contacts. Décision produit.
- **D4 — Écran « Vos données, vos règles »** (`rgpd-cnil.js`) : micro et caméra sont cochés d'avance. Pour la CNIL, une case pré-cochée ne vaut pas consentement. Proposition : cases décochées par défaut.
- **D5 — Connexion Google** (`login.html:29`) : le script Google se charge dès l'ouverture de la page de connexion, avant tout clic. Proposition : ne le charger qu'au clic sur « Continuer avec Google ».
- **D6 — GitHub Pages** n'envoie aucun en-tête de sécurité (HSTS, anti-iframe) : le site principal peut être affiché dans un cadre piégé (clickjacking). C'est réglé au passage sur le VPS (Caddy les envoie déjà). Sinon, il faudrait ajouter un petit script anti-iframe.

## 3. Reste à faire (connu)

- **Publier les règles Firestore** (`garage_partners`) : `npx firebase deploy --only firestore:rules`, avec votre compte Firebase. La PR ne les publie pas.
- **3 tests des règles Firestore échouent déjà sur `main`** avec l'émulateur local v1.22 (utilisateur non connecté, crews, rapports de sinistre). Ce n'est pas lié à cette PR, mais c'est à examiner.
- Positions exactes encore publiables par un client modifié (`social_radar`, `presence`, convois) : l'arrondi se fait dans le navigateur (déjà noté au § 5.3 de l'audit précédent). Solution : publication par le serveur souverain.
- Il reste environ 290 `innerHTML` dans le code. DOMPurify bloque les scripts, mais pas les faux boutons. Les textes d'IA (Nexus Atlas) et les autres écrans sont à passer progressivement à `textContent` (étape 5 du plan de dette technique).
- Firmware : Secure Boot v2, chiffrement de la flash et désactivation du JTAG toujours commentés (`hardware/firmware/sdkconfig.defaults:28-37`). C'est obligatoire avant toute vente de boîtier.
- Serveur souverain : limite de tentatives de connexion gardée en mémoire (une seule instance) ; un tiers peut bloquer un compte 15 minutes avec 10 essais. Acceptable sur un seul VPS ; à revoir avec Redis.
