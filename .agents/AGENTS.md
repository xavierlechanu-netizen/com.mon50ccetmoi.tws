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

## Principes CIS (Center for Internet Security) v8.1 à appliquer :
- **Control 3 (Data Protection)** : Chiffrer les données sensibles au repos et en transit (TLS, Firebase Encryption). Appliquer le principe du moindre privilège.
- **Control 4 (Secure Configuration)** : Utiliser des configurations sécurisées par défaut, modifier ou désactiver tous les comptes/services inutiles.
- **Control 6 (Access Control)** : Implémenter un contrôle d'accès rigoureux basé sur les rôles (RBAC) via Firebase Auth.
- **Control 16 (Application Software Security)** : 
  - **16.8** : Séparation stricte des environnements de développement, test, et production.
  - **16.10** : Architecture "Secure by Design" (validation rigoureuse de toutes les entrées utilisateurs, "never trust user input").
  - **16.11** : Utilisation exclusive de librairies de sécurité approuvées et maintenues.
