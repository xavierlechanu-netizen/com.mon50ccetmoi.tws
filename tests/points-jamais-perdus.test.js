/**
 * Aucun point retiré sans service rendu (23/11/2026) : plus de remise à zéro au 1er janvier,
 * et un recours n'est payé qu'une fois enregistré.
 */
const fs = require("fs");
const path = require("path");

const JS = path.join(__dirname, "../src/js");

function loadLawyer() {
  const code = fs.readFileSync(path.join(JS, "pocket-lawyer.js"), "utf8").replace(/^import .*$/gm, "");
  new Function("registerAction", code)(() => {});
  const lawyer = window.PocketLawyer;
  lawyer.messages = [];
  lawyer.addBotMessage = (m) => lawyer.messages.push(m);
  return lawyer;
}

describe("Points jamais perdus", () => {
  test("aucun code ne vide le solde d'un pilote", () => {
    for (const f of fs.readdirSync(JS).filter((n) => n.endsWith(".js"))) {
      const src = fs.readFileSync(path.join(JS, f), "utf8");
      expect([f, /deduct\(\s*(window\.)?BVCManager\.balance|checkYearlyExpiration/.test(src)]).toEqual([f, false]);
    }
  });

  describe("recours contre une sanction", () => {
    let calls, lawyer;
    const setup = (success) => {
      calls = [];
      window.session = { uid: "pilote", username: "Pilote" };
      window.confirm = () => true;
      window.prompt = () => "Malentendu";
      window.BVCManager = { balance: 10, deduct: jest.fn(async () => { calls.push("retrait"); return true; }) };
      window.Moderation = {
        getBanStatus: () => ({ isBanned: false, isTempBanned: true, tempBansCount: 1 }),
        requestAppeal: jest.fn(async () => {
          calls.push("demande");
          return success ? { success: true } : { success: false, error: "Demande non enregistrée" };
        }),
      };
      lawyer = loadLawyer();
    };

    test("demande refusée : aucun point retiré, et le pilote le voit", async () => {
      setup(false);
      await lawyer.appealBan();
      expect(calls).toEqual(["demande"]);
      expect(lawyer.messages.join(" ")).toContain("Demande non enregistrée");
    });

    test("demande enregistrée : les points sont retirés une seule fois, après", async () => {
      setup(true);
      await lawyer.appealBan();
      expect(calls).toEqual(["demande", "retrait"]);
      expect(lawyer.messages.join(" ")).toContain("5 points mon50cc utilisés");
    });
  });
});
