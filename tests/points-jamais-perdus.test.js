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

  test("recours contre une sanction : gratuit (DSA art. 20), par e-mail, aucun point retiré", () => {
    window.session = { uid: "pilote", username: "Pilote <b>" };
    window.BVCManager = { balance: 0, deduct: jest.fn() };
    const lawyer = loadLawyer();
    lawyer.appealBan();
    const msg = lawyer.messages.join(" ");
    expect(window.BVCManager.deduct).not.toHaveBeenCalled();
    expect(msg).toContain("gratuit");
    expect(msg).toContain('href="mailto:contact@mon50ccetmoi.com?subject=Recours%20contre%20une%20sanction%20-%20Pilote%20%3Cb%3E');
  });
});
