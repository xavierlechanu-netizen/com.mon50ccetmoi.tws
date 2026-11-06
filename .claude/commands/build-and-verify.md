Exécute une vérification complète de qualité, d'encodage et de build du projet `mon50ccetmoi.com` :

1. Lance `node scripts/sanitize-encoding.js` pour garantir l'absence de mojibake UTF-8 dans `src/` et `screens/`.
2. Lance la suite complète de tests unitaires avec `npm test` et vérifie que les 13 suites passent à 100 %.
3. Vérifie avec ESLint (`npx eslint src/js/app-core.js src/js/app-map.js src/js/app-features.js src/js/app-ui.js src/js/i18n.js`) qu'aucune erreur de syntaxe ou d'action manquante n'a été introduite.
4. Compile le bundle de production avec `npm run build` et vérifie la génération propre du dossier `dist/`.
5. Résume l'état du build et indique si le projet est prêt à être poussé sur `origin` et `repo2`.

