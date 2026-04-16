# 🚀 Guide de déploiement : mon50ccetmoi

Pour tester votre application sur la route avec votre iPhone, vous devez l'héberger sur un serveur sécurisé (HTTPS). Voici comment faire gratuitement en 2 minutes.

## Option 1 : Netlify (Le plus simple)
1.  Créez un compte sur [Netlify](https://www.netlify.com/).
2.  Allez dans l'onglet **"Add new site"** > **"Deploy manually"**.
3.  Glissez-déposez tout le dossier `balade-app` dans la zone de dépôt.
4.  Une fois terminé, Netlify vous donnera une adresse type `https://nom-du-site.netlify.app`.
5.  Ouvrez ce lien sur votre Safari iPhone !

## Option 2 : Vercel (Très performant)
1.  Installez l'outil Vercel ou utilisez leur interface web [Vercel CLI](https://vercel.com/).
2.  Lancez la commande `vercel` dans le terminal à l'intérieur du dossier.
3.  Suivez les étapes par défaut.

## ✅ Pourquoi déployer ?
- **GPS Mobile** : Safari bloque l'accès à la position ultra-précise si le site n'est pas en `https://`.
- **Durable** : L'adresse fonctionnera même si vous éteignez votre ordinateur.
- **Vrai Test** : Vous pourrez laisser votre téléphone dans votre poche, l'écran ne s'éteindra pas grâce à l'optimisation **Wake Lock** que j'ai ajoutée.

---
**Note :** N'oubliez pas d'autoriser l'accès aux capteurs sur l'iPhone quand le message s'affiche !
