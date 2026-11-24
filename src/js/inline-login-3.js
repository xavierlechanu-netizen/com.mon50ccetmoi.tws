import { db, auth, CONFIG, secureGetItem, secureSetItem, firebase } from './config.js';
import { registerAction } from './actionRegistry.js';

// Âge (RGPD art. 8 ; loi Informatique et Libertés art. 45 : 15 ans en France). La réponse est
// gardée dans le profil (ageConfirmed, ageConfirmedAt) pour pouvoir montrer qu'elle a été demandée.
const AGE_REQUIRED_MESSAGE =
  "Pour créer un compte, il faut avoir 15 ans ou plus, ou l'accord d'un de vos parents (ou de votre représentant légal).";

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

      if (typeof window !== 'undefined') {
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

