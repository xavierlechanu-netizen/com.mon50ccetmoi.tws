/**
 * Rejoindre un cortège (23/11/2026) : les positions du groupe ne sont lisibles qu'une fois inscrit,
 * donc le pilote écrit sa fiche AVANT d'écouter les autres.
 */
const fs = require("fs");
const path = require("path");

function load({ setFails = false } = {}) {
  const calls = [];
  const members = {
    doc: () => ({
      set: async () => {
        calls.push("inscription");
        if (setFails) throw new Error("refusé");
      },
    }),
    onSnapshot: () => { calls.push("écoute"); return () => {}; },
  };
  const sessions = {
    where() { return this; },
    limit() { return this; },
    get: async () => ({ empty: false, docs: [{ id: "s1" }] }),
    doc: () => ({ collection: () => members }),
  };
  global.firebase = { firestore: () => ({ collection: () => sessions }) };
  window.session = { uid: "pilote", username: "Pilote" };
  window.alert = jest.fn();
  const code = fs.readFileSync(path.join(__dirname, "../src/js/cortege-mode.js"), "utf8").replace(/^import .*$/gm, "");
  new Function("registerAction", "escapeHtml", code)(() => {}, (t) => t);
  const system = window.CortegeSystem;
  system.startSharing = () => {};
  return { system, calls };
}

afterEach(() => {
  delete global.firebase;
  delete window.currentPosition;
});

describe("Rejoindre un cortège", () => {
  test("le pilote s'inscrit d'abord, puis écoute le groupe", async () => {
    window.currentPosition = { lat: 45, lng: 4 };
    const { system, calls } = load();
    await system.joinSession("1234");
    expect(calls).toEqual(["inscription", "écoute"]);
    expect(system.sessionId).toBe("s1");
  });

  test("sans position GPS, il ne rejoint pas et le sait", async () => {
    const { system, calls } = load();
    system.sessionId = null;
    await system.joinSession("1234");
    expect(calls).toEqual([]);
    expect(system.sessionId).toBeNull();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Position GPS"));
  });

  test("inscription refusée : pas d'écoute, et le pilote le voit", async () => {
    window.currentPosition = { lat: 45, lng: 4 };
    const { system, calls } = load({ setFails: true });
    system.sessionId = null;
    await system.joinSession("1234");
    expect(calls).toEqual(["inscription"]);
    expect(system.sessionId).toBeNull();
    expect(window.alert).toHaveBeenCalledWith("Impossible de rejoindre ce cortège.");
  });
});
