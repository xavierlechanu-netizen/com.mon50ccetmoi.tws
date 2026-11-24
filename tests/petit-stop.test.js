/**
 * @jest-environment jsdom
 *
 * « Petit Stop » (Garage du Petit Fontenay) : un marqueur avec un panneau qui raconte, sans HTML injecté et sans
 * promettre de service ; il s'éteint d'un seul réglage si le garage le demande.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.resolve(__dirname, "../src/js/petit-stop.js");

function loadModule() {
  const code = fs.readFileSync(SRC, "utf8").replace(/export\s+/g, "")
    + "\n;({ PETIT_STOP, buildPetitStopPopup, initPetitStop })";
  return vm.runInNewContext(code, { document, Object, console });
}

/** Leaflet minimal : enregistre ce qu'on lui demande. */
function fakeLeaflet() {
  const calls = { markers: [] };
  const L = {
    divIcon: (o) => o,
    marker: (latlng, opts) => {
      const m = { latlng, opts, addTo: (map) => { m.map = map; return m; }, bindPopup: (node) => { m.popup = node; return m; } };
      calls.markers.push(m);
      return m;
    },
  };
  return { L, calls };
}

describe("Petit Stop", () => {
  const M = loadModule();

  test("livré allumé : un marqueur au garage, avec la distance annoncée et sans promesse de service", () => {
    expect(M.PETIT_STOP.ENABLED).toBe(true);
    const { L, calls } = fakeLeaflet();
    const map = {};
    expect(M.initPetitStop({ map, L })).toBe(true);
    const [marker] = calls.markers;
    expect(marker.latlng).toEqual([48.516713, 4.513603]);
    expect(marker.map).toBe(map);
    const text = marker.popup.textContent;
    expect(text).toMatch(/Garage du Petit Fontenay/);
    expect(text).toMatch(/environ 15 km/);
    expect(text).toMatch(/Ce n'est pas un service de dépannage/);
    // L'histoire du fondateur, présentée comme un récit (« d'après son récit »), pas comme une mesure
    expect(text).toMatch(/Notre histoire/);
    expect(text).toMatch(/Bruges à Aurec-sur-Loire/);
    expect(text).toMatch(/850 km en 48 heures.*d'après son récit/);
    expect(text).toMatch(/ce garage l'a dépanné/i);
  });

  test("éteint d'un seul réglage : aucun marqueur", () => {
    const { L, calls } = fakeLeaflet();
    expect(M.initPetitStop({ map: {}, L, stop: { ...M.PETIT_STOP, ENABLED: false } })).toBe(false);
    expect(calls.markers).toHaveLength(0);
  });

  test("sans carte ou sans Leaflet : rien, sans erreur", () => {
    expect(M.initPetitStop({})).toBe(false);
    expect(M.initPetitStop({ map: {}, L: null })).toBe(false);
  });

  test("le panneau n'est que du texte : une balise dans un champ ne devient pas du HTML", () => {
    const node = M.buildPetitStopPopup({ ...M.PETIT_STOP, NAME: "<img src=x onerror=alert(1)>" });
    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toContain("<img src=x");
  });

  test("la page de la carte charge le module", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../src/app.html"), "utf8");
    expect(html).toMatch(/src="\/js\/petit-stop\.js"/);
  });
});
