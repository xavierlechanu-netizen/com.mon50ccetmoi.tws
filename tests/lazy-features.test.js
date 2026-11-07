/**
 * Chargement à la demande des fonctions rares : src/js/lazy-features.js (étape 5, 7/11/2026).
 */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.resolve(__dirname, "../src/js/lazy-features.js"), "utf8");

// Le module est en ESM (navigateur) : on n'évalue que la fonction installLazyFeature
function loadInstaller() {
  const start = SRC.indexOf("export function installLazyFeature");
  const end = SRC.indexOf("\nfor (const [name, load]", start);
  const code = SRC.slice(start, end).replace("export function", "function");
  return new Function(`${code}\nreturn installLazyFeature;`)();
}

describe("lazy-features : remplaçant chargé au premier appel", () => {
  let installLazyFeature;
  beforeEach(() => {
    installLazyFeature = loadInstaller();
    delete window.Demo;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test("rien n'est chargé tant qu'on n'appelle rien", () => {
    const load = jest.fn(() => Promise.resolve());
    installLazyFeature("Demo", load);
    expect(window.Demo.__lazy).toBe(true);
    expect(typeof window.Demo.open).toBe("function"); // les tests « if (window.X.open) » passent
    expect(load).not.toHaveBeenCalled();
  });

  test("le premier appel charge le module puis lui transmet l'appel et ses arguments", async () => {
    const real = { open: jest.fn((a, b) => a + b) };
    const load = jest.fn(() => { window.Demo = real; return Promise.resolve(); });
    installLazyFeature("Demo", load);
    await expect(window.Demo.open(2, 3)).resolves.toBe(5);
    expect(real.open).toHaveBeenCalledWith(2, 3);
    expect(window.Demo).toBe(real); // le vrai module a remplacé le remplaçant
  });

  test("deux clics rapides ne chargent le module qu'une fois", async () => {
    const real = { open: jest.fn() };
    const load = jest.fn(() => new Promise((r) => setTimeout(() => { window.Demo = real; r(); }, 5)));
    installLazyFeature("Demo", load);
    const stub = window.Demo;
    await Promise.all([stub.open(), stub.open()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(real.open).toHaveBeenCalledTimes(2);
  });

  test("après un échec réseau, un nouveau clic réessaie", async () => {
    const real = { open: jest.fn() };
    const load = jest.fn()
      .mockImplementationOnce(() => Promise.reject(new Error("hors ligne")))
      .mockImplementationOnce(() => { window.Demo = real; return Promise.resolve(); });
    installLazyFeature("Demo", load);
    const stub = window.Demo;
    await expect(stub.open()).rejects.toThrow("hors ligne");
    await stub.open();
    expect(real.open).toHaveBeenCalledTimes(1);
  });

  test("ne remplace pas un module déjà chargé", () => {
    const real = { open() {} };
    window.Demo = real;
    installLazyFeature("Demo", () => Promise.resolve());
    expect(window.Demo).toBe(real);
  });
});

describe("lazy-features : liste des modules", () => {
  const entries = [...SRC.matchAll(/^\s+(\w+): \(\) => (import\("\.\/[\w-]+\.js"\)[^\n]*),$/gm)];
  const appHtml = fs.readFileSync(path.resolve(__dirname, "../src/app.html"), "utf8");

  test("la liste n'est pas vide", () => {
    expect(entries.length).toBeGreaterThanOrEqual(5);
  });

  test.each(entries.map((m) => [m[1], m[2]]))("%s : le fichier existe, définit window.%s et n'est plus chargé au démarrage", (name, imports) => {
    const files = [...imports.matchAll(/import\("\.\/([\w-]+\.js)"\)/g)].map((m) => m[1]);
    const last = files[files.length - 1];
    const text = fs.readFileSync(path.resolve(__dirname, "../src/js", last), "utf8");
    expect(text).toMatch(new RegExp(`window\\.${name}\\s*=`));
    for (const f of files) expect(appHtml).not.toContain(`/js/${f}`);
  });
});
