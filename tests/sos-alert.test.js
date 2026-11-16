/**
 * @jest-environment node
 *
 * Alerte SOS de l'appli (src/js/sos-alert.js et app-ui.js) : plus jamais de faux « prévenus ».
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../src/js");
const code = fs.readFileSync(path.join(SRC, "sos-alert.js"), "utf8").replace(/^export /gm, "");
// Même méthode que les autres tests du projet pour charger un module ES sans transpilation
// eslint-disable-next-line no-new-func
const M = new Function(`${code}; return { mapLink, sosText, cleanNumbers, smsHref, getSosPosition, sendSosAuto };`)();

const POS = { lat: 50.6292, lng: 3.0573, accuracy: 12 };

describe("Contenu de l'alerte", () => {
  test("lien de carte et texte avec la vraie position", () => {
    expect(M.mapLink(POS)).toBe("https://www.openstreetmap.org/?mlat=50.62920&mlon=3.05730#map=17/50.62920/3.05730");
    expect(M.sosText(POS, "fall")).toMatch(/peut-être chuté.*mlat=50\.62920.*112/);
    expect(M.sosText(POS, "manual")).toMatch(/j'ai besoin d'aide\./);
    expect(M.sosText(null)).toMatch(/n'a pas pu être obtenue/);
  });

  test("lien SMS pré-rempli, syntaxe Android et iPhone", () => {
    const text = "Aide 112";
    expect(M.smsHref(["06 12 34 56 78", "07-12-34-56-78"], text, "Android")).toBe("sms:0612345678,0712345678?body=Aide%20112");
    expect(M.smsHref(["0612345678", "0712345678"], text, "iPhone")).toBe("sms:/open?addresses=0612345678,0712345678&body=Aide%20112");
    expect(M.smsHref(["0612345678"], text, "iPhone")).toBe("sms:0612345678&body=Aide%20112");
    expect(M.cleanNumbers(["06 12", "", null, "0612345678", "0612345678"])).toEqual(["0612345678"]);
  });
});

describe("Position", () => {
  test("position récente de l'appli utilisée telle quelle", async () => {
    const win = { currentPosition: { lat: 1, lng: 2, timestamp: Date.now() } };
    await expect(M.getSosPosition({ win })).resolves.toMatchObject({ lat: 1, lng: 2 });
  });

  test("sinon nouvelle mesure GPS, et null si elle échoue", async () => {
    const ok = { navigator: { geolocation: { getCurrentPosition: (s) => s({ coords: { latitude: 3, longitude: 4, accuracy: 9 } }) } } };
    await expect(M.getSosPosition({ win: ok })).resolves.toEqual({ lat: 3, lng: 4, accuracy: 9 });
    const ko = { navigator: { geolocation: { getCurrentPosition: (s, e) => e(new Error("refus")) } } };
    await expect(M.getSosPosition({ win: ko })).resolves.toBeNull();
  });
});

describe("Envoi automatique : succès seulement si le serveur le confirme", () => {
  const contacts = ["0612345678"];

  test("serveur pas encore branché : sent = 0 et raison claire", async () => {
    const r = await M.sendSosAuto({ position: POS, contacts, kind: "fall" }, { client: undefined });
    expect(r).toEqual({ sent: 0, reason: expect.stringMatching(/pas encore en service/) });
  });

  test("serveur branché mais téléphone sans jeton : rien n'est tenté, raison claire", async () => {
    const client = { token: null, sosToken: null, sendSos: jest.fn() };
    const r = await M.sendSosAuto({ position: POS, contacts, kind: "fall" }, { client });
    expect(r).toEqual({ sent: 0, reason: expect.stringMatching(/pas activé sur ce téléphone/) });
    expect(client.sendSos).not.toHaveBeenCalled();
  });

  test("le jeton SOS seul suffit (session expirée depuis longtemps)", async () => {
    const client = { token: null, sosToken: "sos", sendSos: async (a) => ({ sent: a.contacts.length }) };
    await expect(M.sendSosAuto({ position: POS, contacts, kind: "manual" }, { client })).resolves.toEqual({ sent: 1 });
  });

  test("serveur qui confirme : sent = nombre de SMS acceptés", async () => {
    const client = { token: "t", sendSos: async (a) => ({ sent: a.contacts.length }) };
    await expect(M.sendSosAuto({ position: POS, contacts, kind: "fall" }, { client })).resolves.toEqual({ sent: 1 });
  });

  test("serveur en erreur : sent = 0, jamais un faux succès", async () => {
    const client = { token: "t", sendSos: async () => { throw new Error("L'envoi des SMS a échoué. Appelez le 112."); } };
    const r = await M.sendSosAuto({ position: POS, contacts, kind: "fall" }, { client });
    expect(r.sent).toBe(0);
    expect(r.reason).toMatch(/112/);
  });

  test("sans ange gardien ou sans position : rien n'est envoyé", async () => {
    const client = { token: "t", sendSos: jest.fn() };
    expect((await M.sendSosAuto({ position: POS, contacts: [] }, { client })).sent).toBe(0);
    expect((await M.sendSosAuto({ position: null, contacts }, { client })).sent).toBe(0);
    expect(client.sendSos).not.toHaveBeenCalled();
  });
});

describe("Plus de fausses promesses dans l'appli", () => {
  const appUi = fs.readFileSync(path.join(SRC, "app-ui.js"), "utf8");
  test("ni position fictive, ni « notifiés » sans confirmation, ni « secours prévenus »", () => {
    expect(appUi).not.toMatch(/GPS Coord \(Simulated\)/);
    expect(appUi).not.toMatch(/sendemergencysos/i);
    expect(appUi).not.toMatch(/notifiés par SMS/);
    expect(appUi).not.toMatch(/secours seront prévenus/);
    expect(appUi).toMatch(/auto\.sent > 0/);
  });
});
