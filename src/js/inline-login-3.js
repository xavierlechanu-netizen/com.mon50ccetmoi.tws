import { db, auth, CONFIG, secureGetItem, secureSetItem, firebase } from './config.js';
import { registerAction } from './actionRegistry.js';


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
        if (typeof window.register === 'function') {
          window.register(u, p, b, m);
        } else if (typeof register === 'function') {
          register(u, p, b, m);
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
            profile = {
              uid: user.uid,
              username: user.displayName || user.email.split("@")[0],
              role: "user",
              points: 50,
              registrationDate: Date.now(),
              brand: "Google Pilot",
            };
            await firebase
              .firestore()
              .collection("users")
              .doc(user.uid)
              .set(profile);
          } else {
            profile = doc.data();
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

