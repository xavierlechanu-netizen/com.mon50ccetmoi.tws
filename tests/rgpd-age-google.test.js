/**
 * Page de connexion (18/11/2026, décisions D-4 et D-7 de docs/AUDIT_RGPD_CNIL_2026-11-17.md).
 *
 * D-4 : le script de Google (accounts.google.com/gsi/client) était chargé à l'ouverture de la page :
 *       Google recevait l'adresse IP de chaque visiteur avant tout clic. Il n'est plus chargé
 *       qu'au clic sur « Continuer avec Google » (src/js/google-signin-loader.js).
 * D-7 : création de compte seulement avec la confirmation « 15 ans ou plus, ou accord d'un
 *       parent » (RGPD art. 8, loi Informatique et Libertés art. 45), gardée avec sa date.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Charge un module ES du site sans transpilation (même méthode que les autres tests). */
function loadModule(rel, names, deps = {}) {
  const code = read(rel).replace(/^import .*$/gm, "").replace(/^export /gm, "");
  const depNames = Object.keys(deps);
  // eslint-disable-next-line no-new-func
  return new Function(...depNames, `${code}; return { ${names.join(", ")} };`)(...depNames.map((k) => deps[k]));
}

describe("D-4 : Google n'est chargé qu'au clic", () => {
  const login = read("src/login.html");

  test("la page de connexion ne charge plus le script de Google", () => {
    expect(login).not.toMatch(/<script[^>]+accounts\.google\.com/i);
    expect(login).not.toMatch(/g_id_onload|g_id_signin/);
    expect(login).toMatch(/<script type="module" src="\/js\/google-signin-loader\.js"><\/script>/);
  });

  test("un bouton du site déclenche le chargement, avec l'identifiant client public", () => {
    const button = login.match(/<button[^>]*id="google-signin-trigger"[^>]*>/s);
    expect(button).not.toBeNull();
    expect(button[0]).toContain('data-action="startGoogleSignIn()"');
    expect(button[0]).toMatch(/data-client-id="\d+-[a-z0-9]+\.apps\.googleusercontent\.com"/);
    expect(login).toContain('id="google-signin-slot"');
    expect(login).toMatch(/Google n'est contacté que si vous cliquez/);
  });

  test("bouton du site aux couleurs de la version noire de Google (choix du 18/11/2026)", () => {
    const button = login.match(/<button[^>]*id="google-signin-trigger"[^>]*>/s)[0];
    expect(button).toMatch(/background: #131314;/);
    expect(button).toMatch(/color: #e3e3e3;/);
    expect(button).toMatch(/border: 1px solid #8e918f;/);
  });

  describe("google-signin-loader.js", () => {
    const registered = {};
    let L;

    function setupDom() {
      document.head.innerHTML = "";
      document.body.innerHTML = `
        <button id="google-signin-trigger" data-client-id="123-abc.apps.googleusercontent.com">Continuer avec Google</button>
        <div id="google-signin-slot"></div>
        <p id="google-signin-status">info</p>`;
    }
    const gsiScripts = () => [...document.head.querySelectorAll("script[src]")]
      .filter((s) => new URL(s.src).hostname === "accounts.google.com");

    beforeEach(() => {
      // Module rechargé à chaque test : l'état « chargement en cours » repart de zéro
      L = loadModule("src/js/google-signin-loader.js", ["GSI_SCRIPT_URL", "loadGsiScript", "startGoogleSignIn"], {
        registerAction: (name, fn) => { registered[name] = fn; },
      });
      setupDom();
    });

    test("rien n'est demandé à Google avant le clic ; l'action est enregistrée", () => {
      expect(gsiScripts()).toHaveLength(0);
      expect(typeof registered.startGoogleSignIn).toBe("function");
      expect(L.GSI_SCRIPT_URL).toBe("https://accounts.google.com/gsi/client");
    });

    test("au clic : script chargé une seule fois, vrai bouton Google affiché, réponse transmise", async () => {
      const id = { initialize: jest.fn(), renderButton: jest.fn() };
      const win = { handleCredentialResponse: jest.fn() };
      const started = L.startGoogleSignIn(document, win);
      await expect(L.startGoogleSignIn(document, win)).resolves.toBe(false); // double clic ignoré
      expect(gsiScripts()).toHaveLength(1);
      expect(document.getElementById("google-signin-trigger").disabled).toBe(true);

      win.google = { accounts: { id } };
      gsiScripts()[0].onload();
      await expect(started).resolves.toBe(true);

      expect(id.initialize).toHaveBeenCalledTimes(1);
      expect(id.initialize).toHaveBeenCalledWith(expect.objectContaining({
        client_id: "123-abc.apps.googleusercontent.com", ux_mode: "popup", auto_select: false,
      }));
      expect(id.renderButton).toHaveBeenCalledWith(document.getElementById("google-signin-slot"),
        expect.objectContaining({ theme: "filled_black", text: "signin_with" }));
      expect(document.getElementById("google-signin-trigger").style.display).toBe("none");
      expect(document.getElementById("google-signin-status").textContent).toMatch(/bouton Google/);

      // La réponse de Google arrive au traitement habituel (inline-login-3.js)
      id.initialize.mock.calls[0][0].callback({ credential: "jeton" });
      expect(win.handleCredentialResponse).toHaveBeenCalledWith({ credential: "jeton" });
    });

    test("Google injoignable : bouton réactivé, message clair, un nouveau clic réessaie", async () => {
      const win = {};
      const started = L.startGoogleSignIn(document, win);
      gsiScripts()[0].onerror();
      await expect(started).resolves.toBe(false);
      expect(document.getElementById("google-signin-trigger").disabled).toBe(false);
      expect(document.getElementById("google-signin-status").textContent).toMatch(/Google ne répond pas/);

      L.startGoogleSignIn(document, win);
      expect(gsiScripts()).toHaveLength(2);
    });
  });

  test("les pages Cookies et Confidentialité le disent", () => {
    expect(read("src/cookies.html")).toMatch(/Google n'est contacté que si vous cliquez/);
    expect(read("src/privacy.html")).toMatch(/Google n'est contacté \(et ne reçoit votre adresse IP\) que si vous cliquez/);
  });
});

describe("D-7 : confirmation de l'âge à la création du compte", () => {
  test("le formulaire d'inscription a la case obligatoire, avec un lien d'explication", () => {
    const login = read("src/login.html");
    const box = login.match(/<input[^>]*id="reg-age"[^>]*>/s);
    expect(box).not.toBeNull();
    expect(box[0]).toContain('type="checkbox"');
    expect(box[0]).toContain("required");
    expect(login).toMatch(/J'ai 15 ans ou plus, ou l'un de mes parents/);
    expect(login).toContain('href="privacy.html#mineurs"');
  });

  test("auth.js refuse l'inscription sans confirmation et la garde avec sa date", () => {
    const auth = read("src/js/auth.js");
    expect(auth).toMatch(/window\.register = async function \(username, password, brand, model, \{ ageConfirmed = false \} = \{\}\)/);
    expect(auth).toMatch(/if \(ageConfirmed !== true\) \{\s*return alert\(/);
    expect(auth).toMatch(/brand, model, ageConfirmed: true, ageConfirmedAt: Date\.now\(\)/);
  });

  describe("inline-login-3.js", () => {
    let authObj;
    let profileDoc;

    function load() {
      authObj = { signInWithCredential: jest.fn(), signOut: jest.fn(async () => {}) };
      profileDoc = { exists: false };
      const firebase = {
        auth: Object.assign(() => authObj, { GoogleAuthProvider: { credential: (t) => ({ t }) } }),
        firestore: () => ({ collection: () => ({ doc: () => ({ get: async () => profileDoc }) }) }),
      };
      return loadModule("src/js/inline-login-3.js", ["doRegister", "handleCredentialResponse"], {
        firebase, registerAction: () => {}, secureSetItem: jest.fn(), comptes: { mode: comptesMode },
      });
    }
    let comptesMode = "FIREBASE";
    afterEach(() => { comptesMode = "FIREBASE"; });

    test("comptes sur SOVEREIGN : la connexion Google n'ouvre rien et explique quoi faire", async () => {
      comptesMode = "SOVEREIGN";
      await load().handleCredentialResponse({ credential: "jeton-google" });
      expect(authObj.signInWithCredential).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/adresse email de votre compte Google/));
    });

    beforeEach(() => {
      document.body.innerHTML = `
        <input id="reg-user" value="Pilote42"><input id="reg-pass" value="motdepasse">
        <select id="reg-brand"><option value="Peugeot" selected>Peugeot</option></select>
        <input id="reg-model" value="Kisbee"><input type="checkbox" id="reg-age">`;
      window.alert = jest.fn();
      window.register = jest.fn();
      window.recordAuthEvent = jest.fn();
      window.createProfileWithAvailableUsername = jest.fn(async () => ({ username: "Jean" }));
    });

    test("case non cochée : pas d'inscription, message expliquant la règle", () => {
      load().doRegister();
      expect(window.register).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/15 ans ou plus.*Cochez la case/));
    });

    test("case cochée : inscription avec la confirmation", () => {
      document.getElementById("reg-age").checked = true;
      load().doRegister();
      expect(window.register).toHaveBeenCalledWith("Pilote42", "motdepasse", "Peugeot", "Kisbee", { ageConfirmed: true });
    });

    test("1re connexion Google refusée à la question d'âge : compte supprimé, rien d'enregistré", async () => {
      const M = load();
      const user = { uid: "u1", displayName: "Jean", delete: jest.fn(async () => {}) };
      authObj.signInWithCredential.mockResolvedValue({ user, additionalUserInfo: { isNewUser: true } });
      window.confirm = jest.fn(() => false);
      await M.handleCredentialResponse({ credential: "jeton" });
      expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/15 ans ou plus/));
      expect(user.delete).toHaveBeenCalled();
      expect(authObj.signOut).toHaveBeenCalled();
      expect(window.createProfileWithAvailableUsername).not.toHaveBeenCalled();
    });

    test("1re connexion Google acceptée : profil créé avec la confirmation datée", async () => {
      const M = load();
      const user = { uid: "u1", displayName: "Jean", delete: jest.fn() };
      authObj.signInWithCredential.mockResolvedValue({ user, additionalUserInfo: { isNewUser: true } });
      window.confirm = jest.fn(() => true);
      const quiet = jest.spyOn(console, "error").mockImplementation(() => {}); // navigation jsdom
      await M.handleCredentialResponse({ credential: "jeton" });
      quiet.mockRestore();
      expect(user.delete).not.toHaveBeenCalled();
      const extra = window.createProfileWithAvailableUsername.mock.calls[0][2];
      expect(extra).toEqual(expect.objectContaining({ ageConfirmed: true, ageConfirmedAt: expect.any(Number) }));
    });

    test("membre déjà inscrit avec Google : aucune question", async () => {
      const M = load();
      profileDoc = { exists: true, data: () => ({ username: "Jean" }) };
      authObj.signInWithCredential.mockResolvedValue({ user: { uid: "u1" }, additionalUserInfo: { isNewUser: false } });
      window.confirm = jest.fn();
      window.reserveOwnUsername = jest.fn();
      const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
      await M.handleCredentialResponse({ credential: "jeton" });
      quiet.mockRestore();
      expect(window.confirm).not.toHaveBeenCalled();
    });
  });

  test("CGU et politique de confidentialité l'annoncent", () => {
    const privacy = read("src/privacy.html");
    expect(privacy).toContain('<h2 id="mineurs">6. Mineurs</h2>');
    expect(privacy).toMatch(/Sans cette confirmation, le compte n'est pas créé/);
    expect(read("src/terms.html")).toMatch(/pour créer un compte, il faut avoir 15 ans ou plus/);
  });
});

describe("D-5 : mentions légales de l'éditeur", () => {
  test("numéro d'immatriculation au RCS présent avec le SIRET", () => {
    const m = read("src/mentions-legales.html");
    expect(m).toContain("RCS Le Puy-en-Velay 891 912 503");
    expect(m).toContain("891 912 503 00036");
  });

  test("numéro de téléphone de l'éditeur (LCEN art. 6), lien d'appel au bon format", () => {
    const m = read("src/mentions-legales.html");
    const tel = m.match(/<a href="tel:(\+33\d{9})">(0\d(?: \d\d){4})<\/a>/);
    expect(tel).not.toBeNull();
    expect(tel[1].slice(3)).toBe(tel[2].replace(/\s/g, "").slice(1)); // lien et texte identiques
  });

  test("même adresse de l'éditeur dans les mentions légales, les CGV et la politique de confidentialité", () => {
    const m = read("src/mentions-legales.html").match(/<th>Adresse<\/th>\s*<td>([^<]+)<\/td>/);
    expect(m).not.toBeNull();
    const adresse = m[1].trim();
    expect(adresse).toMatch(/\b\d{5} [A-ZÉ][\w-]+/); // code postal + commune
    expect(read("src/cgv.html")).toContain(adresse);
    expect(read("src/privacy.html")).toContain(adresse);
  });
});
