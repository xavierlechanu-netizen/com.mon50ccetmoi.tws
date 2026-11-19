/**
 * Comptes « Google seul » : proposer un mot de passe après la connexion Google
 * (src/js/google-password.js), pour qu'ils survivent à la fin de la connexion Google.
 */
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "..", "src", "js", "google-password.js"), "utf8").replace(/^export /gm, "");
// eslint-disable-next-line no-new-func
const G = new Function(`${code}; return { needsPassword, shouldAsk, checkPassword, showPasswordDialog, offerGooglePassword,
  GOOGLE_PASSWORD_LATER_KEY };`)();

const NOW = 1_800_000_000_000;
const DAY = 24 * 3600 * 1000;

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

const googleUser = (over = {}) => ({
  email: "pilote@gmail.com",
  providerData: [{ providerId: "google.com" }],
  linkWithCredential: jest.fn(async () => ({})),
  ...over,
});

const firebaseNs = { auth: { EmailAuthProvider: { credential: jest.fn((email, pw) => ({ email, pw })) } } };

const dialog = () => document.querySelector("[role=dialog]");
const inputs = () => [...dialog().querySelectorAll("input")];
const button = (label) => [...dialog().querySelectorAll("button")].find((b) => b.textContent === label);

beforeEach(() => {
  document.body.textContent = "";
  firebaseNs.auth.EmailAuthProvider.credential.mockClear();
});

describe("Règles", () => {
  test("seulement les comptes sans mot de passe", () => {
    expect(G.needsPassword(googleUser())).toBe(true);
    expect(G.needsPassword(googleUser({ providerData: [{ providerId: "google.com" }, { providerId: "password" }] }))).toBe(false);
    expect(G.needsPassword(googleUser({ email: null }))).toBe(false);
    expect(G.needsPassword(null)).toBe(false);
  });

  test("« Plus tard » : redemandé au bout de 7 jours", () => {
    expect(G.shouldAsk(memoryStorage(), NOW)).toBe(true);
    const s = memoryStorage({ [G.GOOGLE_PASSWORD_LATER_KEY]: String(NOW - 2 * DAY) });
    expect(G.shouldAsk(s, NOW)).toBe(false);
    expect(G.shouldAsk(s, NOW + 6 * DAY)).toBe(true);
    expect(G.shouldAsk(null, NOW)).toBe(true); // stockage indisponible : on propose
  });

  test("8 caractères au moins (comme le serveur souverain), deux fois le même", () => {
    expect(G.checkPassword("court", "court")).toMatch(/8 caractères/);
    expect(G.checkPassword("assez-long", "autre-chose")).toMatch(/identiques/);
    expect(G.checkPassword("x".repeat(257), "x".repeat(257))).toMatch(/256/);
    expect(G.checkPassword("assez-long", "assez-long")).toBeNull();
  });
});

describe("Fenêtre", () => {
  test("adresse affichée comme du texte, champs masqués, erreurs avant d'enregistrer", async () => {
    const result = G.showPasswordDialog(document, "<img src=x onerror=alert(1)>@gmail.com");
    expect(dialog()).not.toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(dialog().textContent).toContain("<img src=x onerror=alert(1)>@gmail.com");
    expect(inputs().map((i) => i.type)).toEqual(["password", "password"]);

    const [a, b] = inputs();
    a.value = "motdepasse-2026";
    b.value = "autre";
    button("Enregistrer").click();
    expect(dialog().textContent).toMatch(/identiques/);

    b.value = "motdepasse-2026";
    button("Enregistrer").click();
    await expect(result).resolves.toBe("motdepasse-2026");
    expect(dialog()).toBeNull();
  });

  test("« Plus tard » ferme sans rien", async () => {
    const result = G.showPasswordDialog(document, "pilote@gmail.com");
    button("Plus tard").click();
    await expect(result).resolves.toBeNull();
  });
});

describe("Après la connexion Google", () => {
  test("mot de passe ajouté au même compte Firebase", async () => {
    const user = googleUser();
    const storage = memoryStorage({ [G.GOOGLE_PASSWORD_LATER_KEY]: String(NOW - 30 * DAY) });
    const notify = jest.fn();
    const p = G.offerGooglePassword({ user, firebaseNs, doc: document, storage, notify, now: NOW });
    const [a, b] = inputs();
    a.value = b.value = "motdepasse-2026";
    button("Enregistrer").click();
    await expect(p).resolves.toBe("linked");
    expect(firebaseNs.auth.EmailAuthProvider.credential).toHaveBeenCalledWith("pilote@gmail.com", "motdepasse-2026");
    expect(user.linkWithCredential).toHaveBeenCalledWith({ email: "pilote@gmail.com", pw: "motdepasse-2026" });
    expect(storage.m.has(G.GOOGLE_PASSWORD_LATER_KEY)).toBe(false);
    expect(notify.mock.calls[0][0]).toMatch(/pilote@gmail.com/);
    expect(JSON.stringify([...storage.m])).not.toContain("motdepasse-2026"); // jamais gardé sur le téléphone
  });

  test("« Plus tard » : la date est notée, rien n'est envoyé", async () => {
    const user = googleUser();
    const storage = memoryStorage();
    const p = G.offerGooglePassword({ user, firebaseNs, doc: document, storage, notify: jest.fn(), now: NOW });
    button("Plus tard").click();
    await expect(p).resolves.toBe("later");
    expect(storage.m.get(G.GOOGLE_PASSWORD_LATER_KEY)).toBe(String(NOW));
    expect(user.linkWithCredential).not.toHaveBeenCalled();
  });

  test("compte qui a déjà un mot de passe, ou « Plus tard » récent : rien n'est proposé", async () => {
    const withPw = googleUser({ providerData: [{ providerId: "password" }] });
    expect(await G.offerGooglePassword({ user: withPw, firebaseNs, doc: document, storage: memoryStorage(), notify: jest.fn() }))
      .toBe("skip");
    const recent = memoryStorage({ [G.GOOGLE_PASSWORD_LATER_KEY]: String(NOW - DAY) });
    expect(await G.offerGooglePassword({ user: googleUser(), firebaseNs, doc: document, storage: recent, notify: jest.fn(), now: NOW }))
      .toBe("skip");
    expect(dialog()).toBeNull();
  });

  test("refus de Firebase : message clair, la connexion continue", async () => {
    const user = googleUser({ linkWithCredential: jest.fn(async () => { throw Object.assign(new Error("x"), { code: "auth/weak-password" }); }) });
    const notify = jest.fn();
    const p = G.offerGooglePassword({ user, firebaseNs, doc: document, storage: memoryStorage(), notify, now: NOW });
    const [a, b] = inputs();
    a.value = b.value = "motdepasse-2026";
    button("Enregistrer").click();
    await expect(p).resolves.toBe("error");
    expect(notify.mock.calls[0][0]).toMatch(/trop faible/);
  });

  test("branché sur la connexion Google de la page de connexion", () => {
    const login = fs.readFileSync(path.join(__dirname, "..", "src", "js", "inline-login-3.js"), "utf8");
    expect(login).toMatch(/import \{ offerGooglePassword \} from '\.\/google-password\.js';/);
    expect(login.indexOf("offerGooglePassword({")).toBeLessThan(login.indexOf('secureSetItem("session"'));
  });
});
