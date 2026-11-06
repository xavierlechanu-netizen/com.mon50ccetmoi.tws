/**
 * @jest-environment jsdom
 *
 * Couche de compatibilité google.maps → Leaflet + IGN (src/js/gmaps-compat.js)
 */
const fs = require("fs");
const path = require("path");

function loadCompat() {
  const strip = (file) => fs.readFileSync(path.resolve(__dirname, "../src/js", file), "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^export (const|function|async function|class) /gm, "$1 ");
  const code = `${strip("map-engine.js")}\n${strip("gmaps-compat.js")}\nreturn { installSovereignMaps };`;
  // eslint-disable-next-line no-new-func
  return new Function(code)();
}

describe("google.maps souverain (Leaflet + IGN)", () => {
  let gm;
  let el;

  beforeAll(() => {
    window.L = require("leaflet");
    gm = loadCompat().installSovereignMaps();
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    el = document.createElement("div");
    el.style.width = "400px";
    el.style.height = "300px";
    document.body.appendChild(el);
    window.currentPosition = null;
  });

  test("installe google.maps sans aucun script Google", () => {
    expect(window.google.maps.__sovereign).toBe(true);
    expect(document.querySelector('script[src*="googleapis"]')).toBeNull();
  });

  test("Map : une carte Leaflet sur fond Plan IGN, qui comprend les appels Google", () => {
    const map = new gm.Map(el, { center: { lat: 48.8566, lng: 2.3522 }, zoom: 14, styles: [{}] });
    expect(map instanceof window.L.Map).toBe(true);
    const tiles = Object.values(map._layers).find((l) => l._url);
    expect(tiles._url).toContain("data.geopf.fr/wmts");
    expect(tiles._url).toContain("PLANIGNV2");
    expect(el.classList.contains("gmc-dark")).toBe(true); // style sombre conservé

    map.setCenter(new gm.LatLng(45.764, 4.8357));
    expect(map.getCenter().lat).toBeCloseTo(45.764);
    map.panTo({ lat: () => 43.6, lng: () => 1.44 });
    expect(map.getTilt()).toBe(0);
    map.setTilt(45); // sans effet, sans erreur

    const seen = [];
    const h = map.addListener("idle", () => seen.push("idle"));
    map.fire("moveend");
    h.remove();
    map.fire("moveend");
    expect(seen).toEqual(["idle"]);
  });

  test("Marker / AdvancedMarkerElement : position, carte, clic, contenu HTML", () => {
    const map = new gm.Map(el, { center: { lat: 48.85, lng: 2.35 }, zoom: 14 });
    const content = document.createElement("div");
    content.className = "mon-icone";
    const m = new gm.marker.AdvancedMarkerElement({ map, position: { lat: 48.85, lng: 2.35 }, content, title: "Moi" });
    expect(m.map).toBe(map);
    expect(m.position).toEqual({ lat: 48.85, lng: 2.35 });
    expect(el.querySelector(".mon-icone")).not.toBeNull();

    let clicked = 0;
    m.addListener("click", () => clicked++);
    m._layer.fire("click", { latlng: window.L.latLng(48.85, 2.35) });
    expect(clicked).toBe(1);

    m.position = { lat: 48.86, lng: 2.36 };
    expect(m.getPosition().lat()).toBe(48.86);
    m.map = null;
    expect(el.querySelector(".mon-icone")).toBeNull();

    const dot = new gm.Marker({ map, position: new gm.LatLng(48.8, 2.3), icon: { path: gm.SymbolPath.CIRCLE, scale: 8, fillColor: "#f00" } });
    expect(dot.getPosition().lng()).toBe(2.3);
  });

  test("InfoWindow s'ouvre sur un marqueur (forme Google open(map, marker))", () => {
    const map = new gm.Map(el, { center: { lat: 48.85, lng: 2.35 }, zoom: 14 });
    const m = new gm.Marker({ map, position: { lat: 48.85, lng: 2.35 } });
    const info = new gm.InfoWindow({ content: "<b>Garage</b>" });
    info.open(map, m);
    expect(el.querySelector(".leaflet-popup-content").innerHTML).toContain("Garage");
    info.close();
    expect(el.querySelector(".leaflet-popup-content")).toBeNull();
  });

  test("Polyline, Circle, LatLngBounds et fitBounds", () => {
    const map = new gm.Map(el, { center: { lat: 48.85, lng: 2.35 }, zoom: 14 });
    const path = [new gm.LatLng(48.85, 2.30), new gm.LatLng(48.85, 2.40)];
    const line = new gm.Polyline({ path, map, strokeColor: "#00d2ff", strokeWeight: 6 });
    expect(line.getPath().getLength()).toBe(2);
    expect(line._layer.options.color).toBe("#00d2ff");
    const circle = new gm.Circle({ map, center: { lat: 48.85, lng: 2.35 }, radius: 50 });
    circle.setRadius(80);
    expect(circle.getRadius()).toBe(80);
    const b = new gm.LatLngBounds();
    path.forEach((p) => b.extend(p));
    expect(() => map.fitBounds(b)).not.toThrow();
    expect(gm.geometry.poly.isLocationOnEdge(new gm.LatLng(48.8502, 2.35), line, 0.001)).toBe(true);
  });

  test("event.addListener sur un objet qui redéfinit addListener (cas du marqueur SOS) : pas de boucle", () => {
    class Gyro extends gm.OverlayView {}
    const g = new Gyro();
    g.addListener = function (name, fn) { return gm.event.addListener(this, name, fn); };
    let n = 0;
    g.addListener("click", () => n++);
    gm.event.trigger(g, "click");
    expect(n).toBe(1);
  });

  test("DirectionsService : résultat au format Google, autoroute toujours interdite", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        distance: 257, duration: 32,
        geometry: { coordinates: [[2.35, 48.85], [2.352, 48.85], [2.352, 48.851]] },
        portions: [{ steps: [
          { attributes: { nom_1_droite: "R DE RIVOLI" }, geometry: { coordinates: [[2.35, 48.85], [2.352, 48.85]] }, distance: 146, duration: 20 },
          { attributes: { nom_1_droite: "R SAINT-MARTIN" }, geometry: { coordinates: [[2.352, 48.85], [2.352, 48.851]] }, distance: 111, duration: 12 },
        ] }],
      }),
    }));
    const svc = new gm.DirectionsService();
    const { result, status } = await new Promise((resolve) => {
      svc.route({ origin: new gm.LatLng(48.85, 2.35), destination: { lat: 48.851, lng: 2.352 }, travelMode: gm.TravelMode.DRIVING, avoidHighways: false },
        (r, s) => resolve({ result: r, status: s }));
    });
    expect(status).toBe(gm.DirectionsStatus.OK);
    const url = new URL(global.fetch.mock.calls[0][0]);
    expect(url.searchParams.get("constraints")).toContain("autoroute"); // même si avoidHighways: false
    const leg = result.routes[0].legs[0];
    expect(leg.distance.text).toBe("257 m");
    expect(leg.steps[1].instructions).toBe("Tournez à gauche sur Rue Saint-Martin");
    expect(leg.steps[1].end_location.lat()).toBeCloseTo(48.851);
    expect(result.routes[0].overview_path).toHaveLength(3);

    const map = new gm.Map(el, { center: { lat: 48.85, lng: 2.35 }, zoom: 14 });
    const renderer = new gm.DirectionsRenderer({ map, polylineOptions: { strokeColor: "#ff007f" } });
    renderer.setDirections(result);
    expect(renderer._layers.length).toBe(3); // tracé + départ + arrivée
    renderer.setDirections({ routes: [] });
    expect(renderer._layers.length).toBe(0);
  });

  test("Geocoder : erreur réseau → liste vide, jamais d'exception", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const res = await new gm.Geocoder().geocode({ address: "10 rue de Rivoli Paris" });
    expect(res.results).toEqual([]);
  });

  test("importLibrary renvoie les classes attendues par app-core.js", async () => {
    const { Map } = await gm.importLibrary("maps");
    const { AdvancedMarkerElement, PinElement } = await gm.importLibrary("marker");
    expect(typeof Map).toBe("function");
    expect(typeof AdvancedMarkerElement).toBe("function");
    expect(new PinElement({ background: "#000" }).element).toBeInstanceOf(HTMLElement);
    await expect(gm.importLibrary("routes")).rejects.toThrow();
  });
});
