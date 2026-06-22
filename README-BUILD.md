# 🚀 Guide de Compilation Android (mon 50cc et moi)

Le code source de votre application est **100% prêt** et configuré (Version 100.00-GOLD). 
Ce guide vous explique comment générer le fichier **`.aab`** (Android App Bundle) nécessaire pour publier votre application sur le Google Play Store.

---

## 🛠️ Pré-requis

1. Téléchargez et installez [Android Studio](https://developer.android.com/studio) (gratuit).
2. Vérifiez que vous avez bien Node.js installé sur votre machine.

---

## 💻 Étape 1 : Synchronisation du projet (Capacitor)

Avant d'ouvrir Android Studio, il faut s'assurer que le code web est bien injecté dans le projet Android.
Ouvrez un terminal (Invite de commandes ou PowerShell), allez dans le dossier `android-app` de votre projet, et tapez :

```bash
cd android-app
npm install
npx cap sync android
```
*Cela copiera vos fichiers HTML/JS/CSS vers le projet natif Android.*

---

## 📱 Étape 2 : Ouverture dans Android Studio

1. Ouvrez **Android Studio**.
2. Cliquez sur **Open** (ou "Open an existing Android Studio project").
3. Naviguez jusqu'à votre projet et sélectionnez le dossier `android-app/android`.
4. **Attendez quelques minutes** : Laissez Android Studio télécharger toutes les dépendances Gradle (une barre de progression s'affichera en bas à droite).

---

## 🔑 Étape 3 : Création du fichier `.aab` (Signature)

Google Play n'accepte que les applications "signées" avec une clé cryptographique unique (Keystore) pour prouver que vous en êtes bien l'auteur.

1. Dans le menu en haut d'Android Studio, cliquez sur **Build > Generate Signed Bundle / APK...**
2. Sélectionnez **Android App Bundle** et cliquez sur *Next*.
3. Sous `Key store path`, cliquez sur **Create new...**
   - Choisissez un emplacement sur votre ordinateur pour sauvegarder ce fichier `.jks` (⚠️ **GARDER CE FICHIER PRÉCIEUSEMENT, NE LE PERDEZ JAMAIS !**)
   - Entrez un mot de passe solide.
   - Remplissez les champs de certificat (Votre nom, "mon50ccetmoi", etc).
   - Cliquez sur *OK*.
4. Cliquez sur **Next**.
5. Sous `Build Variants`, sélectionnez **release**.
6. Cliquez sur **Finish**.

---

## 🎉 Étape 4 : Publication

Android Studio va travailler pendant quelques minutes. Une fois terminé, une petite bulle apparaîtra en bas à droite vous indiquant que la compilation a réussi.

1. Cliquez sur le lien **locate** dans cette bulle, ou allez dans le dossier :
   `android-app\android\app\release\`
2. Vous y trouverez le fichier **`app-release.aab`**.
3. **C'est ce fichier qu'il faut envoyer sur la Google Play Console !**

*Si vous avez la moindre erreur durant ces étapes, contactez votre support technique.*
