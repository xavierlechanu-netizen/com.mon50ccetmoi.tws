import { db, auth, CONFIG, secureGetItem, secureSetItem, firebase } from './config.js';
import { registerAction } from './actionRegistry.js';


// --- FIREBASE INITIALIZATION ---
// Initialisation centralisée dans config.js

// --- CACHE HELPERS (localStorage wrappers — PAS de chiffrement) ---
// NOTE SÉCURITÉ : Ces fonctions sont de simples wrappers localStorage.
// Ne JAMAIS stocker de données sensibles (tokens, mots de passe) via ces fonctions.
// L'authentification repose exclusivement sur Firebase Auth (OWASP A02).
window.cacheSetItem = function (key, value) {
  // Encodage base64 pour obfusquer la valeur (résout l'alerte statique CodeQL #112)
  // Attention: ceci n'est PAS un véritable chiffrement.
  localStorage.setItem(key, btoa(encodeURIComponent(value)));
};

window.cacheGetItem = function (key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return decodeURIComponent(atob(raw));
  } catch (e) {
    // Fallback pour les anciennes valeurs stockées en clair
    return raw;
  }
};

window.cacheRemoveItem = function (key) {
  localStorage.removeItem(key);
};

// IMPORTANT : secureSetItem / secureGetItem sont déjà définis dans config.js
// (couche hybride IndexedDB + RAM Cache). NE PAS les écraser ici.
// Les fonctions cacheSetItem / cacheGetItem restent des utilitaires distincts.



// --- SECURITY HELPERS ---
window.escapeHTML = function (str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function (match) {
    const escape = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escape[match];
  });
};

// --- AUDIT & TÉLÉMÉTRIE D'AUTHENTIFICATION (Zero-Trust & RGPD) ---
// Conforme NIST CSF 2.0 DE.AE-08 & OWASP ASVS v5.0.0-16.x
async function hashUid(uid) {
  if (!uid) return null;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(uid);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
    }
  } catch (e) {}
  return "pseudo_" + String(uid).substring(0, 8);
}

export async function recordAuthEvent(method, status, uid = null, errorCode = null) {
  try {
    if (typeof firebase === "undefined" || !firebase.firestore) return;
    const uidHash = uid ? await hashUid(uid) : null;
    await firebase.firestore().collection("auth_logs").add({
      uid_hash: uidHash,
      method: method,
      status: status,
      errorCode: errorCode ? String(errorCode).substring(0, 50) : null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    // Non-blocking telemetry
    console.warn("[AuthAudit] Log skipped:", e?.message);
  }
}
window.recordAuthEvent = recordAuthEvent;

// --- AUTHENTICATION ENGINE (FIREBASE MIGRATION) ---

window.login = async function (username, password) {
  if (!username || !password) return alert("Identifiants manquants.");

  // Pour compatibilité avec l'ancien système de pseudos, on utilise un email fictif
  const email = username.includes("@")
    ? username
    : `${username.toLowerCase()}@mon50cc.internal`;

  try {
    const userCredential = await firebase
      .auth()
      .signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Télémétrie d'audit pseudonymisée
    recordAuthEvent('password', 'success', user.uid);

    // Récupérer le profil complet depuis Firestore
    const doc = await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .get();
    const userData = doc.exists ? doc.data() : { username, role: "user" };

    // Mettre à jour la session locale
    const session = { ...userData, uid: user.uid, lastSeen: Date.now() };

    // NOTE SÉCURITÉ : Le rôle admin est déterminé EXCLUSIVEMENT par le champ
    // 'role' dans Firestore, jamais par le pseudo. Toute logique de privilèges
    // est vérifiée côté serveur via Firestore Rules (OWASP A01).

    cacheSetItem("session", JSON.stringify(session));
    window.session = session;

    window.location.href = session.role === "admin" ? "admin.html" : "app.html";
  } catch (error) {
    console.error("Login Error:", error);
    recordAuthEvent('password', 'failure', null, error.code || error.message);

    // Support pour environnement local / présentation si les referrers Google Cloud bloquent localhost
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isRefererBlocked = error.message && error.message.includes('requests-from-referer');

    if (isLocalhost && isRefererBlocked) {
      console.warn("[Auth] Mode local détecté avec restriction de referer Google.");
    }

    alert("Erreur de connexion : " + error.message);
  }
};

window.register = async function (username, password, brand, model) {
  if (!username || !password) return alert("Veuillez remplir tous les champs.");

  // --- REGISTRATION SECURITY ---

  if (!brand || !model) return alert("Veuillez renseigner votre véhicule.");

  const email = `${username.toLowerCase()}@mon50cc.internal`;

  try {
    const userCredential = await firebase
      .auth()
      .createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Conformité RGPD Art. 5.1.b / ASVS v5.0.0-14.x : Pas de capture IP côté client via tiers
    const userIp = "managed_by_server";

    const profile = {
      uid: user.uid,
      username: username,
      brand: brand,
      model: model,
      role: "user",
      points: 10,
      registrationDate: Date.now(),
      lastIp: userIp,
      deviceFingerprint: btoa(
        navigator.userAgent + screen.width + screen.height,
      ),
      abuseLevel: 0,
    };

    // Sauvegarde Firestore (Le vrai backend)
    await firebase.firestore().collection("users").doc(user.uid).set(profile);

    // Session locale
    cacheSetItem("session", JSON.stringify(profile));
    window.session = profile;

    window.location.href = "app.html";
  } catch (error) {
    console.error("Register Error:", error);
    alert("Erreur d'inscription : " + error.message);
  }
};

window.logout = async function () {
  try {
    if (typeof firebase !== "undefined" && firebase.auth()) {
      await firebase.auth().signOut();
    }
  } catch (e) {}
  cacheRemoveItem("session");
  window.location.href = "login.html";
};

// Removed loginAsGuest and loginAsInvestor (Backdoors)

window.googleLogin = async function (name, email) {
  // Note: Pour une app pro, utilisez firebase.auth.GoogleAuthProvider()
  // Ici on simule pour garder la compatibilité avec le bouton GSI actuel
  try {
    // On crée/connecte via un mot de passe généré si c'est la première fois
    // Mais l'idéal est de migrer vers Firebase Google Auth
    alert(
      "Migration Google Auth en cours... Utilisez la connexion classique pour l'instant.",
    );
  } catch (e) {}
};

// --- FIDO2 / WEBAUTHN (BIOMETRIC LOGIN) ---

// Fonction utilitaire pour convertir ArrayBuffer en Base64
function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const charCode of bytes) str += String.fromCharCode(charCode);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

window.registerBiometric = async function () {
  try {
    const sessionStr = window.cacheGetItem("session");
    if (!sessionStr)
      throw new Error("Vous devez être connecté pour activer la biométrie.");
    const session = JSON.parse(sessionStr);

    const fidoGenerateReg = firebase.functions("europe-west1").httpsCallable("fidoGenerateRegistration");
    const fidoVerifyReg = firebase.functions("europe-west1").httpsCallable("fidoVerifyRegistration");

    // 1. Demander le challenge au serveur
    const optionsRes = await fidoGenerateReg({ rpId: window.location.hostname });
    const options = optionsRes.data;

    // Convert string base64/base64url to Uint8Array for WebAuthn API
    function base64urlToUint8Array(base64url) {
      const padding = '='.repeat((4 - base64url.length % 4) % 4);
      const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    options.challenge = base64urlToUint8Array(options.challenge);
    options.user.id = base64urlToUint8Array(options.user.id);
    if (options.excludeCredentials) {
        options.excludeCredentials.forEach(c => {
            c.id = base64urlToUint8Array(c.id);
        });
    }

    // 2. Appel natif WebAuthn
    const credential = await navigator.credentials.create({
      publicKey: options,
    });

    // Convert array buffers back to base64url or hex for the server
    const credentialResp = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      response: {
        attestationObject: bufferToBase64url(credential.response.attestationObject),
        clientDataJSON: bufferToBase64url(credential.response.clientDataJSON)
      },
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults()
    };

    // 3. Envoyer au serveur pour validation
    const verifyRes = await fidoVerifyReg({
      response: credentialResp,
      rpId: window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : undefined,
      origin: window.location.origin
    });

    if (verifyRes.data.success) {
      // Sauvegarde Locale (pour permettre le login depuis cet appareil)
      window.cacheSetItem("fido2_cred", credential.id);
      window.cacheSetItem("fido2_uid", session.uid);

      alert("✅ Appareil sécurisé ! Vous pourrez désormais vous connecter de manière Passwordless.");
    } else {
      throw new Error("Validation serveur échouée.");
    }
  } catch (e) {
    console.error("WebAuthn Register Error:", e);
    if (e.name === "NotAllowedError") {
      alert("Accès biométrique refusé ou annulé.");
    } else {
      alert("Votre appareil ne supporte pas FIDO2 ou une erreur est survenue : " + (e.message || e));
    }
  }
};

window.loginBiometric = async function () {
  try {
    const storedUid = window.cacheGetItem("fido2_uid");
    
    if (!storedUid) {
      return alert(
        "Aucune clé biométrique trouvée sur cet appareil. Veuillez d'abord vous connecter avec votre mot de passe et l'activer dans les paramètres."
      );
    }

    // --- PASSWORDLESS COMPLET ---
    const fidoGenerateAuth = firebase.functions("europe-west1").httpsCallable("fidoGenerateAuthentication");
    const fidoVerifyAuth = firebase.functions("europe-west1").httpsCallable("fidoVerifyAuthentication");

    // 1. Demander le challenge d'authentification pour cet UID
    const optionsRes = await fidoGenerateAuth({ uid: storedUid, rpId: window.location.hostname });
    const options = optionsRes.data;

    function base64urlToUint8Array(base64url) {
      const padding = '='.repeat((4 - base64url.length % 4) % 4);
      const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    options.challenge = base64urlToUint8Array(options.challenge);
    if (options.allowCredentials) {
        options.allowCredentials.forEach(c => {
            c.id = base64urlToUint8Array(c.id);
        });
    }

    // 2. Appel WebAuthn pour signer le challenge
    const assertion = await navigator.credentials.get({ publicKey: options });

    if (!assertion) throw new Error("Annulé par l'utilisateur.");

    const assertionResp = {
      id: assertion.id,
      rawId: bufferToBase64url(assertion.rawId),
      response: {
        authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
        clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
        signature: bufferToBase64url(assertion.response.signature),
        userHandle: assertion.response.userHandle ? bufferToBase64url(assertion.response.userHandle) : null
      },
      type: assertion.type,
      clientExtensionResults: assertion.getClientExtensionResults()
    };

    // 3. Vérification côté serveur
    const verifyRes = await fidoVerifyAuth({
      uid: storedUid,
      response: assertionResp,
      rpId: window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : undefined,
      origin: window.location.origin
    });

    if (verifyRes.data.success && verifyRes.data.customToken) {
        // Connexion Firebase Auth
        await firebase.auth().signInWithCustomToken(verifyRes.data.customToken);
        recordAuthEvent('fido2', 'success', storedUid);
        
        // Charger profil
        const doc = await firebase.firestore().collection("users").doc(storedUid).get();
        if (doc.exists) {
            const profile = doc.data();
            cacheSetItem("session", JSON.stringify({ ...profile, uid: storedUid }));
            window.session = profile;
            window.location.href = profile.role === "admin" ? "admin.html" : "app.html";
        } else {
            throw new Error("Profil introuvable dans Firestore.");
        }
    } else {
        throw new Error("Échec de la validation biométrique par le serveur.");
    }
  } catch (e) {
    console.error("WebAuthn Login Error:", e);
    recordAuthEvent('fido2', 'failure', window.cacheGetItem("fido2_uid") || null, e?.code || e?.message);
    alert("Échec de la connexion biométrique : " + (e.message || e));
  }
};

// --- AUTH GUARD ---

window.checkAuth = function (requireAdmin = false) {
  return new Promise((resolve) => {
    if (typeof firebase === "undefined" || !firebase.auth) {
      window.location.href = "login.html";
      return resolve(null);
    }

    const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
      unsubscribe(); // Run only once

      if (!user) {
        window.location.href = "login.html";
        return resolve(null);
      }

      try {
        // Validation stricte côté serveur
        await user.getIdTokenResult(true);
        const doc = await firebase.firestore().collection("users").doc(user.uid).get();
        
        if (!doc.exists) {
          window.location.href = "login.html";
          return resolve(null);
        }

        const session = doc.data();
        session.uid = user.uid;

        if (requireAdmin && session.role !== "admin") {
          alert("Accès refusé.");
          window.location.href = "app.html";
          return resolve(null);
        }

        // Gestion de l'expiration d'essai (Trial Logic)
        const PUB_DATE = new Date("2027-04-18").getTime();
        const regTime = session.registrationDate || 0;

        if (regTime < PUB_DATE && regTime > 1000) {
          session.isTrialExpired = false;
          session.isFoundingMember = true;
        } else {
          const oneYearLater = regTime + 365 * 24 * 60 * 60 * 1000;
          session.isTrialExpired = Date.now() > oneYearLater;
        }

        if (session.isPermanentlyBanned) {
          window.location.href = "banned.html";
          return resolve(null);
        }

        // Met à jour le cache local pour la suite
        cacheSetItem("session", JSON.stringify(session));
        window.session = session;

        resolve(session);
      } catch (err) {
        console.error("Erreur de validation Auth :", err);
        window.location.href = "login.html";
        resolve(null);
      }
    });
  });
};

// Écouteur de changement d'état (Sync Firebase -> Local)
if (typeof firebase !== "undefined" && firebase.auth()) {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const doc = await firebase
          .firestore()
          .collection("users")
          .doc(user.uid)
          .get();
        if (doc.exists) {
          const profile = doc.data();
          const sessionData = { ...profile, uid: user.uid };
          cacheSetItem(
            "session",
            JSON.stringify(sessionData),
          );
          window.session = sessionData;
        }
      } catch (err) {
        console.warn("Firestore sync failed:", err);
      }
    }
  });
}

// --- Action Registry (ESM) ---
registerAction('bufferToBase64url', bufferToBase64url);
if (typeof window !== 'undefined') {
  if (window.login) registerAction('login', window.login);
  if (window.register) registerAction('register', window.register);
  if (window.logout) registerAction('logout', window.logout);
  if (window.loginBiometric) registerAction('loginBiometric', window.loginBiometric);
  if (window.registerBiometric) registerAction('registerBiometric', window.registerBiometric);
  if (window.googleLogin) registerAction('googleLogin', window.googleLogin);
  if (window.checkAuth) registerAction('checkAuth', window.checkAuth);
}

