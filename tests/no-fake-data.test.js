/**
 * @jest-environment node
 *
 * Fausses données présentées comme réelles (corrigées le 7/11/2026) : ce test empêche leur
 * retour. (app-garage.js, neural-hud.js et neural-sync.js, jamais chargés, ont été retirés.) Pour une app de sécurité routière, une alerte météo, un diagnostic ou un verdict
 * tiré au hasard est dangereux, et un motif de refus sur Google Play.
 */
const fs = require("fs");
const path = require("path");

const JS = path.resolve(__dirname, "../src/js");
const read = (f) => fs.readFileSync(path.join(JS, f), "utf8");

describe("Aucune fausse donnée présentée comme réelle", () => {
  // Modules qui affichaient des valeurs tirées au hasard comme si elles étaient mesurées
  test.each([
    ["weather-alert.js", "alertes météo (pluie, vent, verglas)"],
    ["meca-wizard.js", "diagnostic mécanique payant"],
    ["v3-smartcity.js", "feux tricolores connectés, destination « devinée »"],
    ["pocket-lawyer.js", "verdict de stationnement"],
    ["silicon-valley.js", "rythme cardiaque"],
    ["social-radar.js", "pilotes fantômes"],
    ["app-map.js", "flotte de pilotes fictifs"],
  ])("%s : aucun tirage au hasard (%s)", (file) => {
    expect(read(file)).not.toMatch(/Math\.random\(\)/);
  });

  test("pas de fausse transmission à la DGCCRF", () => {
    const db = read("database.js");
    expect(db).not.toMatch(/TRANSMIS_DGCCRF/);
    expect(db).not.toMatch(/transmis à la DGCCRF\./);
  });

  test("pas de faux cours du carbone ni de faux « fonds transférés »", () => {
    const carbon = read("carbon-trading.js");
    expect(carbon).not.toMatch(/14\.5 \+ \(Math\.random/);
    expect(carbon).not.toMatch(/Fonds transférés sur votre portefeuille/);
  });

  test("la page de démonstration assureurs est étiquetée comme fictive", () => {
    const demo = fs.readFileSync(path.resolve(__dirname, "../src/b2b-assureur.html"), "utf8");
    expect(demo).toMatch(/PAGE DE DÉMONSTRATION/);
    expect(demo).toMatch(/EXEMPLE FICTIF/);
  });
});
