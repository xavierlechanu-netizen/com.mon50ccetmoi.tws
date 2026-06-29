# Directives de Sécurité (Jarvis) - Projet mon50ccetmoi

Lors de la rédaction, de la modification ou de l'audit de code pour ce projet, l'agent doit **strictement** appliquer les principes de sécurité de l'OWASP Top 10 (édition 2021) que l'utilisateur a définis.

## Principes OWASP Top 10 à appliquer :
- **A01 (Contrôles d'accès défaillants)** : 
  - Ne jamais faire confiance au côté client pour l'accès aux données.
  - Toujours utiliser `firestore.rules` pour verrouiller l'accès aux documents (`request.auth.uid` doit être vérifié).
- **A02 (Défaillances cryptographiques)** : 
  - Ne jamais coder de mots de passe en dur ou les stocker en clair. 
  - Firebase Auth doit gérer les mots de passe.
- **A03 (Injections / XSS / SQL)** : 
  - Firebase empêche naturellement le SQL Injection.
  - Côté front-end, éviter d'utiliser `innerHTML` avec des variables dynamiques non fiables pour prévenir les failles XSS. Préférer `textContent` ou s'assurer que la donnée est assainie.
- **A05 (Mauvaise configuration)** : 
  - Bloquer les accès publics par défaut sur les bases de données.
- **A11 (Qualité du code / DoS)** : 
  - Éviter les requêtes lourdes ou infinies sur Firestore pour éviter le Déni de Service et la facturation excessive.
  - Garder le code Javascript propre, modulaire et factorisé.
