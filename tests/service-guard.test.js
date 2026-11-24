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
const M = new Function(`${code}; return { installServiceGuard, installFirestorePause, ServiceIndisponibleError, MESSAGE_SERVICE_INDISPONIBLE, MESSAGE_BIENTOT_DISPONIBLE };`)();

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

describe("Collections Firestore en pause (fonctions « Bientôt disponible »)", () => {
  // Fausses classes du SDK compat : on vérifie qu'aucun appel n'atteint le vrai Firestore
  function fauxFirestore() {
    const vraies = [];
    class DocumentReference { collection(nom) { vraies.push(`sous:${nom}`); return { vraie: nom }; } }
    class Firestore {
      collection(nom) { vraies.push(nom); return { vraie: nom, doc: () => new DocumentReference() }; }
      collectionGroup(nom) { vraies.push(`groupe:${nom}`); return { vraie: nom }; }
    }
    return { vraies, ns: { Firestore, DocumentReference } };
  }

  test("collection en pause : lectures vides, écritures refusées, rien vers Firestore", async () => {
    const { vraies, ns } = fauxFirestore();
    expect(M.installFirestorePause(ns, ["crews", "trips"])).toBe(true);
    const db = new ns.Firestore();

    const snap = await db.collection("crews").where("a", "==", 1).orderBy("b").limit(3).get();
    expect(snap).toMatchObject({ empty: true, size: 0, docs: [] });
    const doc = await db.collection("crews").doc("x").get();
    expect(doc.exists).toBe(false);
    expect(doc.data()).toBeUndefined();

    const recu = await new Promise((resolve) => {
      const stop = db.collection("crews").onSnapshot((s) => resolve(s));
      expect(typeof stop).toBe("function");
    });
    expect(recu.docChanges()).toEqual([]);

    await expect(db.collection("crews").add({})).rejects.toThrow(/Bientôt disponible/);
    await expect(db.collection("crews").doc("x").set({})).rejects.toMatchObject({ indisponible: true });
    await expect(db.collection("crews").doc("x").collection("messages").doc("m").update({})).rejects.toThrow(M.MESSAGE_BIENTOT_DISPONIBLE);

    // Sous-collection en pause sous une collection active (users/{uid}/trips)
    const trajets = await db.collection("users").doc("u").collection("trips").orderBy("t").get();
    expect(trajets.empty).toBe(true);
    expect(db.collectionGroup("crews").get).toBeDefined();

    expect(vraies).toEqual(["users"]);
  });

  test("les autres collections passent normalement", () => {
    const { vraies, ns } = fauxFirestore();
    M.installFirestorePause(ns, ["crews"]);
    expect(new ns.Firestore().collection("users")).toMatchObject({ vraie: "users" });
    expect(vraies).toEqual(["users"]);
  });

  test("config.js : jamais en pause les collections qui ont des données ni la sécurité", () => {
    const config = fs.readFileSync(path.join(__dirname, "../src/js/config.js"), "utf8");
    expect(config).toMatch(/installFirestorePause\(firebase\.firestore, CONFIG\.COLLECTIONS_EN_PAUSE\)/);
    const liste = config.match(/COLLECTIONS_EN_PAUSE: \[([\s\S]*?)\]/)[1].match(/"[a-z_]+"/g).map((s) => s.slice(1, -1));
    expect(liste.length).toBeGreaterThan(20);
    const aGarder = [
      // Comptage du 23/11/2026 : collections avec des données
      "crash_reports", "nexus_improvement_reports", "facebook_daily_runs", "users", "auth_logs", "presence",
      "usernames", "rate_limits", "moods", "config", "hazards", "nexus_suggestions",
      // Sécurité : SOS communautaire et cortège (décision de Xavier attendue)
      "sos_alerts", "helpers", "cortege_sessions", "members", "convoys", "positions",
      // Liste d'attente de la Boîte Noire (inscriptions sans compte)
      "blackbox_waitlist",
    ];
    for (const nom of aGarder) expect(liste).not.toContain(nom);
  });
});
