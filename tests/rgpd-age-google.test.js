/**
 * Page de connexion (18/11/2026, décisions D-4 et D-7 de docs/AUDIT_RGPD_CNIL_2026-11-17.md).
 *
 * D-4 : Google recevait l'adresse IP de chaque visiteur dès l'ouverture de la page de connexion ; il ne la
 *       recevait plus qu'au clic sur « Continuer avec Google » (18/11/2026). Depuis le 24/11/2026 la connexion
 *       Google n'existe plus : la page ne contacte jamais Google.
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

describe("D-4 : la page de connexion ne contacte plus jamais Google", () => {
  const login = read("src/login.html");

  test("plus de script, de bouton ni d'identifiant Google", () => {
    expect(login).not.toMatch(/accounts\.google\.com|googleusercontent|g_id_onload|g_id_signin|google-signin|gsi-callback|inline-login-1/i);
    expect(login).not.toMatch(/Continuer avec Google/);
  });

  test("les pilotes inscrits avec Google sont renvoyés vers « Mot de passe oublié »", () => {
    expect(login).toMatch(/Inscrit avec Google \?/);
    expect(login).toContain('href="mot-de-passe-oublie.html"');
  });

  test("les fichiers de la connexion Google n'existent plus", () => {
    for (const f of ["google-signin-loader.js", "gsi-callback.js", "google-password.js", "inline-login-1.js"]) {
      expect(fs.existsSync(path.join(ROOT, "src/js", f))).toBe(false);
    }
  });

  test("les pages Cookies, Confidentialité et Mentions légales ne parlent plus de « Continuer avec Google »", () => {
    for (const f of ["src/cookies.html", "src/privacy.html", "src/mentions-legales.html"]) {
      expect(read(f)).not.toMatch(/Continuer avec Google/);
    }
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
    function load() {
      return loadModule("src/js/inline-login-3.js", ["doRegister"], { registerAction: () => {} });
    }

    beforeEach(() => {
      document.body.innerHTML = `
        <input id="reg-user" value="Pilote42"><input id="reg-pass" value="motdepasse">
        <select id="reg-brand"><option value="Peugeot" selected>Peugeot</option></select>
        <input id="reg-model" value="Kisbee"><input type="checkbox" id="reg-age">`;
      window.alert = jest.fn();
      window.register = jest.fn();
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
