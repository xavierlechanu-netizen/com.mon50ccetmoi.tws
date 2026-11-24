/**
 * Rejoindre un cortège (24/11/2026, serveur souverain) : le pilote rejoint le groupe en y envoyant
 * sa position ; la réponse donne les autres membres et leurs signaux rapides.
 */
const fs = require("fs");
const path = require("path");

function load(reponse) {
  const calls = [];
  const sovereignRequest = jest.fn(async (endpoint, options) => {
    calls.push([endpoint, options]);
    return reponse(endpoint, options);
  });
  window.session = { uid: "pilote", username: "Pilote" };
  window.alert = jest.fn();
  const code = fs.readFileSync(path.join(__dirname, "../src/js/cortege-mode.js"), "utf8").replace(/^import .*$/gm, "");
  new Function("registerAction", "escapeHtml", "sovereignRequest", code)(() => {}, (t) => t, sovereignRequest);
  const system = window.CortegeSystem;
  system.sessionId = null;
  system.members = {};
  system.startSharing = () => {};
  system.updateMemberMarker = () => {};
  system.checkDistances = () => {};
  system.handleNewSignal = jest.fn();
  return { system, calls };
}

afterEach(() => {
  delete window.currentPosition;
});

describe("Rejoindre un cortège", () => {
  test("le pilote rejoint en envoyant sa position, et voit le groupe", async () => {
    window.currentPosition = { lat: 45, lng: 4 };
    const { system, calls } = load(() => ({ members: [{ uid: "ami", name: "Ami", lat: 45.001, lng: 4, signal: null }] }));
    await system.joinSession(" ab2c ");
    expect(calls).toEqual([["/groupes/AB2C", { method: "POST", body: { lat: 45, lng: 4 } }]]);
    expect(system.sessionId).toBe("AB2C");
    expect(system.members.ami).toMatchObject({ name: "Ami" });
  });

  test("sans position GPS, il ne rejoint pas et le sait", async () => {
    const { system, calls } = load(() => ({ members: [] }));
    await system.joinSession("AB2C");
    expect(calls).toEqual([]);
    expect(system.sessionId).toBeNull();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Position GPS"));
  });

  test("code inconnu : pas de cortège, et le pilote le voit", async () => {
    window.currentPosition = { lat: 45, lng: 4 };
    const { system } = load(() => { throw Object.assign(new Error("Groupe introuvable"), { status: 404 }); });
    await system.joinSession("ZZZZ");
    expect(system.sessionId).toBeNull();
    expect(window.alert).toHaveBeenCalledWith("Cortège introuvable ou expiré avec ce code.");
  });

  test("un signal d'un autre membre est annoncé une seule fois, et un membre parti disparaît", () => {
    const { system } = load(() => ({}));
    const essence = { icon: "⛽", text: "Besoin d'essence", time: 1 };
    system.applyMembers([{ uid: "ami", name: "Ami", lat: 45, lng: 4, signal: null }]);
    system.applyMembers([{ uid: "ami", name: "Ami", lat: 45, lng: 4, signal: essence }]);
    system.applyMembers([{ uid: "ami", name: "Ami", lat: 45, lng: 4, signal: essence }]);
    expect(system.handleNewSignal).toHaveBeenCalledTimes(1);
    expect(system.handleNewSignal).toHaveBeenCalledWith("Ami", essence);
    system.applyMembers([]);
    expect(system.members).toEqual({});
  });

  test("quitter : le serveur est prévenu et les autres disparaissent de la carte", async () => {
    window.currentPosition = { lat: 45, lng: 4 };
    const { system, calls } = load((endpoint, o) => (o.method === "DELETE" ? { ok: true } : { members: [{ uid: "ami", name: "Ami", lat: 45, lng: 4 }] }));
    await system.joinSession("AB2C");
    await system.leaveSession();
    expect(calls[1]).toEqual(["/groupes/AB2C", { method: "DELETE" }]);
    expect(system.sessionId).toBeNull();
    expect(system.members).toEqual({});
  });
});
