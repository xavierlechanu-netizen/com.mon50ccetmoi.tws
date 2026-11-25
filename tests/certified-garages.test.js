/**
 * @jest-environment jsdom
 *
 * Garages certifiés sur la carte (src/js/certified-garages.js) : un marqueur par fiche valable,
 * panneau en texte seul (un nom piégé reste du texte), lien d'appel nettoyé.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.resolve(__dirname, "../src/js/certified-garages.js"), "utf8")
  .replace(/^import .*$/gm, "").replace(/export\s+/g, "")
  + "\n;({ buildGaragePopup, showCertifiedGarages })";
const M = vm.runInNewContext(code, { document, Number, String });

describe("Garages certifiés sur la carte", () => {
  test("un marqueur par garage aux coordonnées valables", () => {
    const markers = [];
    const L = {
      divIcon: (o) => o,
      marker: (latlng, opts) => {
        const m = { latlng, opts, addTo: () => m, bindPopup: (node) => { m.popup = node; return m; } };
        markers.push(m);
        return m;
      },
    };
    const n = M.showCertifiedGarages({ map: {}, L, garages: [
      { name: "Garage A", address: "1 rue A", phone: null, lat: 45.3, lng: 4.2 },
      { name: "Sans position", address: "?", lat: null, lng: 4 },
    ] });
    expect(n).toBe(1);
    expect(markers[0].latlng).toEqual([45.3, 4.2]);
    expect(markers[0].popup.textContent).toContain("Garage certifié mon50ccetmoi");
  });

  test("texte seul : un nom piégé n'injecte rien, le téléphone est nettoyé", () => {
    const box = M.buildGaragePopup({ name: '<img src=x onerror="alert(1)">', address: "2 rue B", phone: "04 77 00 00 00" });
    expect(box.querySelector("img")).toBeNull();
    expect(box.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(box.querySelector("a").getAttribute("href")).toBe("tel:0477000000");
  });
});
