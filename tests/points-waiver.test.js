/**
 * Packs de points : pas de paiement sans la case de renonciation au droit de rétractation.
 */
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "../src/js/blackbox-shop.js"), "utf8")
  .replace(/^import .*$/gm, "")
  .replace(/^export (const|function) /gm, "$1 ")
  .replace(/^registerAction\(.*$/gm, "");
// Même méthode que les autres tests du projet pour charger un module ES sans transpilation
// eslint-disable-next-line no-new-func
const { BlackBoxShop } = new Function(`${code}; return { BlackBoxShop };`)();

function openPurchase() {
  BlackBoxShop.processRevolutPayment = jest.fn();
  const done = BlackBoxShop.buyPointsPack("POINTS_100");
  const dialog = document.querySelector("dialog");
  const [cancel, pay] = dialog.querySelectorAll("button");
  return { done, dialog, box: dialog.querySelector("input"), cancel, pay };
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function (value = "") {
    this.open = false;
    this.returnValue = value;
    this.dispatchEvent(new Event("close"));
  };
});

describe("Renonciation avant l'achat de points", () => {
  test("la case n'est jamais pré-cochée et bloque le paiement", async () => {
    const { done, box, pay, cancel } = openPurchase();
    expect(box.checked).toBe(false);
    expect(pay.disabled).toBe(true);
    pay.click();
    expect(document.querySelector("dialog")).not.toBeNull();
    cancel.click();
    await done;
    expect(BlackBoxShop.processRevolutPayment).not.toHaveBeenCalled();
  });

  test("case cochée puis Payer : le paiement part", async () => {
    const { done, box, pay } = openPurchase();
    box.click();
    expect(pay.disabled).toBe(false);
    pay.click();
    await done;
    expect(BlackBoxShop.processRevolutPayment).toHaveBeenCalledWith("POINTS_100", expect.any(String));
    expect(document.querySelector("dialog")).toBeNull();
  });

  test("case cochée puis Annuler ou Échap : aucun paiement", async () => {
    const { done, box, dialog } = openPurchase();
    box.click();
    dialog.close();
    await done;
    expect(BlackBoxShop.processRevolutPayment).not.toHaveBeenCalled();
  });
});
