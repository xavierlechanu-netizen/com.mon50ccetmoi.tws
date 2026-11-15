/**
 * @jest-environment node
 *
 * Interrupteur des services serveur (src/js/service-guard.js) : tant que les Cloud Functions
 * sont à l'arrêt, chaque appel échoue tout de suite avec un message clair.
 */
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "../src/js/service-guard.js"), "utf8").replace(/^export /gm, "");
// Même méthode que les autres tests du projet pour charger un module ES sans transpilation
// eslint-disable-next-line no-new-func
const M = new Function(`${code}; return { installServiceGuard, ServiceIndisponibleError, MESSAGE_SERVICE_INDISPONIBLE };`)();

function fausseFenetre() {
  const appels = [];
  return { appels, fetch: async (input) => { appels.push(String(input)); return { ok: true }; } };
}

describe("Interrupteur des services serveur", () => {
  test("éteint : appels Firebase refusés tout de suite, avec le message clair", async () => {
    const win = fausseFenetre();
    const firebaseNs = { functions: () => ({ httpsCallable: () => async () => "réponse" }) };
    expect(M.installServiceGuard({ win, firebaseNs, actif: false })).toBe(true);

    const appel = firebaseNs.functions("europe-west1").httpsCallable("transactPoints");
    await expect(appel({})).rejects.toThrow(M.MESSAGE_SERVICE_INDISPONIBLE);
    await expect(appel({})).rejects.toMatchObject({ name: "ServiceIndisponibleError", indisponible: true });

    await expect(win.fetch("https://europe-west1-mon50ccetmoi.cloudfunctions.net/getVigilanceMeteo")).rejects.toThrow(/déménageons nos serveurs en France/);
    await expect(win.fetch("https://sendemergencysos-rwdjqtbv2q-ew.a.run.app")).rejects.toThrow(M.ServiceIndisponibleError);
    expect(win.appels).toEqual([]);
  });

  test("éteint : les autres adresses passent normalement (cartes IGN, Firestore…)", async () => {
    const win = fausseFenetre();
    M.installServiceGuard({ win, firebaseNs: {}, actif: false });
    await expect(win.fetch("https://data.geopf.fr/navigation/itineraire")).resolves.toEqual({ ok: true });
    await win.fetch({ url: "https://firestore.googleapis.com/v1/x" });
    expect(win.appels).toHaveLength(2);
  });

  test("allumé : rien n'est modifié", async () => {
    const win = fausseFenetre();
    const fetchAvant = win.fetch;
    const functionsAvant = () => ({});
    const firebaseNs = { functions: functionsAvant };
    expect(M.installServiceGuard({ win, firebaseNs, actif: true })).toBe(false);
    expect(win.fetch).toBe(fetchAvant);
    expect(firebaseNs.functions).toBe(functionsAvant);
  });

  test("config.js installe l'interrupteur, éteint pour l'instant", () => {
    const config = fs.readFileSync(path.join(__dirname, "../src/js/config.js"), "utf8");
    expect(config).toMatch(/SERVICES_SERVEUR_ACTIFS: false/);
    expect(config).toMatch(/installServiceGuard\(/);
  });
});
