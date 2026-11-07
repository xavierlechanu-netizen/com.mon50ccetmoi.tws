/**
 * Suivi GPS du pilote : src/js/gps-tracking.js (sorti de app-core.js, étape 5 du plan de dette
 * technique, 7/11/2026). Le GPS du téléphone est simulé.
 */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.resolve(__dirname, "../src/js/gps-tracking.js"), "utf8");

// Le module est en ESM (navigateur) : on retire l'import et les "export" pour l'évaluer ici
function loadModule(speak) {
  const code = SRC.replace(/^import .*$/gm, "").replace(/^export (async function|function) /gm, "$1 ");
  return new Function(
    "speak",
    `${code}\nreturn { configureGps, hasLocationConsent, startGeolocation, activateLowAccuracyFallback, stopLowAccuracyFallback };`,
  )(speak);
}

const position = (accuracy, lat = 50.6292, lng = 3.0573) => ({ coords: { latitude: lat, longitude: lng, accuracy, speed: 0 } });

describe("gps-tracking", () => {
  let gps;
  let speak;
  let geo;
  let watchers;
  let onPosition;
  let onWakeLock;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = "";
    localStorage.clear();
    window.currentPosition = null;
    window.lastAccuracy = undefined;
    window.retryGps = jest.fn();
    watchers = [];
    geo = {
      watchPosition: jest.fn((ok, err, opts) => { watchers.push({ ok, err, opts }); return watchers.length; }),
      clearWatch: jest.fn(),
    };
    Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true });
    Object.defineProperty(navigator, "permissions", { value: undefined, configurable: true });
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    speak = jest.fn();
    gps = loadModule(speak);
    onPosition = jest.fn();
    onWakeLock = jest.fn();
    gps.configureGps({ onPosition, onWakeLock });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("sans accord de localisation, le GPS ne démarre pas et l'écran d'accord s'affiche", async () => {
    await gps.startGeolocation();
    expect(geo.watchPosition).not.toHaveBeenCalled();
    expect(onWakeLock).not.toHaveBeenCalled();
    expect(document.getElementById("location-disclosure-modal")).not.toBeNull();
  });

  test("avec accord : GPS haute précision, écran maintenu allumé, positions transmises", async () => {
    localStorage.setItem("location_consent_accepted", "true");
    await gps.startGeolocation();
    expect(onWakeLock).toHaveBeenCalled();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    expect(watchers[0].opts.enableHighAccuracy).toBe(true);

    const pos = position(12);
    watchers[0].ok(pos);
    expect(onPosition).toHaveBeenCalledWith(pos);
  });

  test("une position très dégradée est ignorée quand on en a déjà une bonne", async () => {
    localStorage.setItem("location_consent_accepted", "true");
    await gps.startGeolocation();
    watchers[0].ok(position(20));
    window.currentPosition = { lat: 50.6, lng: 3.05 };
    watchers[0].ok(position(5000));
    expect(onPosition).toHaveBeenCalledTimes(1);
  });

  test("permission refusée : message vocal et écran « GPS obligatoire » avec bouton Autoriser", async () => {
    localStorage.setItem("location_consent_accepted", "true");
    await gps.startGeolocation();
    watchers[0].err({ code: 1 });
    expect(speak).toHaveBeenCalled();
    const lock = document.getElementById("gps-hard-lock");
    expect(lock).not.toBeNull();
    expect(lock.querySelector('[data-action="window.repairGps()"]')).not.toBeNull();
  });

  test("signal faible sans aucune position : bannière d'erreur et basse précision", async () => {
    localStorage.setItem("location_consent_accepted", "true");
    await gps.startGeolocation();
    watchers[0].err({ code: 2 });
    expect(document.getElementById("gps-error-banner")).not.toBeNull();
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
  });

  test("aucune position après 15 s : passage en basse précision (Wi-Fi / réseau)", async () => {
    localStorage.setItem("location_consent_accepted", "true");
    await gps.startGeolocation();
    jest.advanceTimersByTime(15000);
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    expect(watchers[1].opts.enableHighAccuracy).toBe(false);

    // Le bon signal revient : la basse précision s'arrête
    gps.stopLowAccuracyFallback(30);
    expect(geo.clearWatch).toHaveBeenCalledWith(2);
  });

  test("la basse précision reste active tant que le signal est mauvais", () => {
    gps.activateLowAccuracyFallback();
    gps.stopLowAccuracyFallback(800);
    gps.stopLowAccuracyFallback(null);
    expect(geo.clearWatch).not.toHaveBeenCalled();
  });
});
