import { db, auth, CONFIG, secureGetItem, secureSetItem, firebase } from './config.js';
import { registerAction } from './actionRegistry.js';

// Âge (RGPD art. 8 ; loi Informatique et Libertés art. 45 : 15 ans en France). La réponse est
// gardée dans le profil (ageConfirmed, ageConfirmedAt) pour pouvoir montrer qu'elle a été demandée.
const AGE_REQUIRED_MESSAGE =
  "Pour créer un compte, il faut avoir 15 ans ou plus, ou l'accord d'un de vos parents (ou de votre représentant légal).";
const AGE_GOOGLE_QUESTION =
  "Création de votre compte : avez-vous 15 ans ou plus, ou l'accord d'un de vos parents " +
  "(ou de votre représentant légal) pour utiliser l'application ?";

function toggleForm(formType) {
        document.getElementById("login-form").classList.add("hidden");
        document.getElementById("register-form").classList.add("hidden");
        document.getElementById(formType + "-form").classList.remove("hidden");
      }

function doLogin() {
        const u = document.getElementById("login-user")?.value || "";
        const p = document.getElementById("login-pass")?.value || "";
        if (typeof window.login === 'function') {
          window.login(u, p);
        } else if (typeof login === 'function') {
          login(u, p);
        } else {
          console.error("Fonction login non disponible.");
        }
      }
      function doRegister() {
        const u = document.getElementById("reg-user")?.value || "";
        const p = document.getElementById("reg-pass")?.value || "";
        const b = document.getElementById("reg-brand")?.value || "";
        const m = document.getElementById("reg-model")?.value || "";
        // Case « 15 ans ou plus, ou accord d'un parent » (RGPD art. 8) : obligatoire pour s'inscrire
        const ageConfirmed = document.getElementById("reg-age")?.checked === true;
        if (!ageConfirmed) {
          alert(AGE_REQUIRED_MESSAGE + " Cochez la case quand c'est le cas.");
          return;
        }
        if (typeof window.register === 'function') {
          window.register(u, p, b, m, { ageConfirmed });
        } else if (typeof register === 'function') {
          register(u, p, b, m, { ageConfirmed });
        } else {
          console.error("Fonction register non disponible.");
        }
      }

      // --- NEW: URL Hash Routing ---
      window.addEventListener("DOMContentLoaded", () => {
        if (window.location.hash === "#register") {
          toggleForm("register");
        }
      });

      // --- NEW: Google Login Callback via Firebase ---
      async function handleCredentialResponse(response) {
        console.log("Tentative de connexion Google via Firebase...");
        if (!response || !response.credential) {
          console.warn("Credential Google manquant.");
          return;
        }
        const credential = firebase.auth.GoogleAuthProvider.credential(
          response.credential,
        );
        try {
          const userCredential = await firebase
            .auth()
            .signInWithCredential(credential);
          const user = userCredential.user;

          if (typeof window.recordAuthEvent === 'function') {
            window.recordAuthEvent('google', 'success', user.uid);
          }

          // Vérifier si le profil Firestore existe
          const doc = await firebase
            .firestore()
            .collection("users")
            .doc(user.uid)
            .get();
          let profile;
          if (!doc.exists) {
            // Création du compte : même question d'âge que le formulaire d'inscription.
            // Refus → rien n'est enregistré (compte Google tout juste créé supprimé).
            if (!window.confirm(AGE_GOOGLE_QUESTION)) {
              if (userCredential.additionalUserInfo?.isNewUser) await user.delete().catch(() => {});
              await firebase.auth().signOut().catch(() => {});
              alert(AGE_REQUIRED_MESSAGE);
              return;
            }
            // Pseudo unique dérivé du nom Google (« Jean Dupont » → « JeanDupont », puis
            // « JeanDupont-1234 » s'il est pris). Plus de champ « points » : il faisait
            // refuser le profil, et seules les fonctions serveur attribuent des points.
            profile = await window.createProfileWithAvailableUsername(
              user,
              user.displayName || (user.email || "").split("@")[0],
              { brand: "Google Pilot", ageConfirmed: true, ageConfirmedAt: Date.now() },
            );
          } else {
            profile = doc.data();
            window.reserveOwnUsername?.(user, profile);
          }

          secureSetItem("session", JSON.stringify(profile));
          window.location.href = "app.html";
        } catch (error) {
          console.error("Google Auth Error:", error);
          if (typeof window.recordAuthEvent === 'function') {
            window.recordAuthEvent('google', 'failure', null, error.code || error.message);
          }
          alert("Erreur Google Auth : " + error.message);
        }
      }

      // Attacher le callback Google réel
      if (typeof window !== 'undefined') {
        window._handleCredentialResponseReal = handleCredentialResponse;
        window.handleCredentialResponse = handleCredentialResponse;
        if (window._pendingGoogleResponse) {
          const pending = window._pendingGoogleResponse;
          delete window._pendingGoogleResponse;
          handleCredentialResponse(pending);
        }
        window.doLogin = doLogin;
        window.doRegister = doRegister;
        window.toggleForm = toggleForm;
      }

      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("./sw.js?v=1060000")
            .then((reg) => console.log("Service Worker (Login) enregistré"))
            .catch((err) => console.log("Échec Service Worker: ", err));
        });
      }

// --- Action Registry (ESM) ---
registerAction('toggleForm', toggleForm);
registerAction('doLogin', doLogin);
registerAction('doRegister', doRegister);
registerAction('handleCredentialResponse', handleCredentialResponse);

