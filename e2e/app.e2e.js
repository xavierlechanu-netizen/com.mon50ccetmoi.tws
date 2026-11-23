// L'application principale dans un vrai navigateur : carte, barre d'outils, écrans.
// GPS simulé (Lille) et accord de localisation donné, comme pour un pilote réel.
import { test, expect } from "@playwright/test";

const LILLE = { latitude: 50.6292, longitude: 3.0573 };

test.use({ geolocation: LILLE, permissions: ["geolocation"] });

async function openApp(page) {
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err.message || err).slice(0, 300)));
  // Toute fenêtre de confirmation est refusée : aucun SOS, achat ou partage n'est réellement lancé
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.addInitScript(() => {
    localStorage.setItem("location_consent_accepted", "true");
    localStorage.setItem("cnil_consent", "true");
  });
  await page.goto("/app.html", { waitUntil: "load" });
  await page.waitForTimeout(4000);
  return pageErrors;
}

test("la carte s'affiche et la barre contient ses boutons", async ({ page }) => {
  const pageErrors = await openApp(page);
  await expect(page.locator(".leaflet-container").first()).toBeVisible();
  expect(await page.locator("#apple-smart-dock button").count()).toBeGreaterThanOrEqual(30);
  expect(pageErrors).toEqual([]);
});

test("l'app reste sur la carte (pas de renvoi vers l'accueil)", async ({ page }) => {
  await openApp(page);
  expect(new URL(page.url()).pathname).toBe("/app.html");
});

test("la position GPS simulée (Lille) arrive jusqu'à l'app", async ({ page }) => {
  await openApp(page);
  await page.waitForFunction(() => window.currentPosition && window.currentPosition.lat, null, { timeout: 20_000 });
  const pos = await page.evaluate(() => window.currentPosition);
  expect(pos.lat).toBeCloseTo(LILLE.latitude, 3);
  expect(pos.lng).toBeCloseTo(LILLE.longitude, 3);
});

// Borne une action dans le temps : pendant un changement de page, certaines commandes
// attendent un contexte qui disparaît et ne rendraient jamais la main.
const withTimeout = (promise, ms) =>
  Promise.race([promise.catch(() => {}), new Promise((resolve) => setTimeout(resolve, ms))]);

test("chaque bouton de la barre se clique sans erreur", async ({ page }) => {
  test.setTimeout(240_000); // 37 boutons, certains ouvrent une autre page
  const pageErrors = await openApp(page);
  const labels = await page.$$eval("#apple-smart-dock button", (els) =>
    els.map((el, i) => el.getAttribute("aria-label") || el.title || el.textContent.trim() || `bouton ${i}`));
  const broken = [];

  for (let i = 0; i < labels.length; i++) {
    if (new URL(page.url()).pathname !== "/app.html") {
      // Le bouton précédent menait vers une autre page : on revient à l'app. On n'attend pas
      // les ressources externes (polices, cartes…), qui peuvent être lentes en CI.
      await withTimeout(page.goto("/app.html", { waitUntil: "domcontentloaded" }), 20_000);
      await withTimeout(page.locator("#apple-smart-dock button").first().waitFor(), 15_000);
    }
    const before = pageErrors.length;
    // Clic direct sur l'élément (un écran ouvert juste avant peut le recouvrir)
    await withTimeout(page.evaluate((n) => document.querySelectorAll("#apple-smart-dock button")[n]?.click(), i), 5_000);
    await page.waitForTimeout(700);
    await withTimeout(page.waitForLoadState("domcontentloaded"), 10_000);
    if (pageErrors.length > before) broken.push(`${labels[i]} : ${pageErrors.slice(before).join(" | ")}`);
    // Ferme l'écran éventuellement ouvert
    await withTimeout(page.evaluate(() => window.ScreenManager?.close?.()), 3_000);
  }

  expect(labels.length).toBeGreaterThanOrEqual(30);
  expect(broken).toEqual([]);
});

test("les fonctions rares se chargent au premier clic, pas au démarrage", async ({ page }) => {
  const pageErrors = await openApp(page);
  const lazyAtStart = await page.evaluate(() =>
    ["PocketLawyer", "MecaWizard", "InsurerPortal", "arNavigationManager"].filter((n) => window[n]?.__lazy));
  expect(lazyAtStart).toEqual(["PocketLawyer", "MecaWizard", "InsurerPortal", "arNavigationManager"]);

  // Bouton « Nexus Atlas Juridique » de la barre
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("#apple-smart-dock button")]
      .find((b) => /Juridique/.test(b.getAttribute("aria-label") || b.title || b.textContent));
    btn.click();
  });
  await page.waitForFunction(() => window.PocketLawyer && !window.PocketLawyer.__lazy, null, { timeout: 15_000 });
  expect(pageErrors).toEqual([]);
});

// Itinéraire IGN simulé (Lille → Roubaix, deux rues) : pas d'appel réseau réel en test
const IGN_ROUTE = {
  distance: 12345,
  duration: 1000,
  geometry: { coordinates: [[3.0573, 50.6292], [3.1, 50.65], [3.1746, 50.6942]] },
  portions: [{ steps: [
    { attributes: { nom_1_droite: "R NATIONALE" }, geometry: { coordinates: [[3.0573, 50.6292], [3.1, 50.65]] }, distance: 4000, duration: 300 },
    { attributes: { nom_1_droite: "BD DE LA LIBERTE" }, geometry: { coordinates: [[3.1, 50.65], [3.1746, 50.6942]] }, distance: 8345, duration: 700 },
  ] }],
};

test("itinéraire sans autoroute : tracé, bandeau de guidage, puis arrêt", async ({ page }) => {
  const ignRequests = [];
  await page.route("https://data.geopf.fr/navigation/itineraire**", (route) => {
    ignRequests.push(new URL(route.request().url()));
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(IGN_ROUTE) });
  });
  // Météo fixée (temps calme) : avec la vraie météo de Lille, une pluie affichait « 28 min (Météo) »
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current_weather: { temperature: 15, windspeed: 5, weathercode: 0 } }) }));
  const pageErrors = await openApp(page);
  const paths = () => page.locator(".leaflet-overlay-pane path").count();
  const before = await paths();

  await page.evaluate(() => window.calculateRouteSansAutoroute({ lat: 50.6292, lng: 3.0573 }, { lat: 50.6942, lng: 3.1746 }));

  // Autoroutes interdites dans la requête envoyée à l'IGN (Code de la route R421-2)
  expect(ignRequests).toHaveLength(1);
  expect(ignRequests[0].searchParams.get("constraints")).toContain("type_autoroutier");
  expect(JSON.parse(ignRequests[0].searchParams.get("constraints").split("|")[0])).toMatchObject({ key: "waytype", value: "autoroute", constraintType: "banned" });
  await expect(page.locator("#nav-info-bar")).toBeVisible();
  await expect(page.locator("#nav-dist")).toHaveText("12,3 km");
  await expect(page.locator("#nav-time")).toHaveText("23 min"); // 32 km/h de moyenne
  await expect(page.locator("#next-step-name")).toHaveText("Partez par Rue Nationale");
  expect(await paths()).toBe(before + 1);

  // Clic direct : la bannière de cookies peut recouvrir le bas de l'écran
  await page.evaluate(() => document.getElementById("btn-stop-nav").click());
  await expect(page.locator("#nav-info-bar")).toBeHidden();
  await expect(page.locator("#nav-instruction")).toBeHidden();
  expect(await paths()).toBe(before);
  expect(pageErrors).toEqual([]);
});

// Un téléphone qui roule fournit un cap (heading). Avant le 23/11/2026, ce cap faisait planter le
// traitement de chaque position : ni guidage, ni alerte de danger, ni ZFE, ni compteur.
test("en roulant avec un cap GPS : guidage, danger, ZFE et compteur fonctionnent", async ({ page, context }) => {
  test.setTimeout(90_000);
  const route = {
    distance: 880, duration: 80,
    geometry: { coordinates: [[4.8357, 45.764], [4.8357, 45.768], [4.8417, 45.768]] },
    portions: [{ steps: [
      { attributes: { nom_1_droite: "RUE A" }, geometry: { coordinates: [[4.8357, 45.764], [4.8357, 45.768]] }, distance: 445, duration: 40 },
      { attributes: { nom_1_droite: "RUE B" }, geometry: { coordinates: [[4.8357, 45.768], [4.8417, 45.768]] }, distance: 435, duration: 40 },
    ] }],
  };
  await page.route("https://data.geopf.fr/navigation/itineraire**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route) }));
  await page.route("https://api.open-meteo.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current_weather: { temperature: 15, windspeed: 5, weathercode: 0 } }) }));
  await page.route("**/voix/**/manifest.json", (r) => r.fulfill({ status: 404, body: "" })); // tout passe par la voix simulée
  await page.addInitScript(() => {
    localStorage.setItem("session", JSON.stringify({ uid: "e2e", username: "e2e", totalDistance: 0 }));
    localStorage.setItem("hazards", JSON.stringify([{ lat: 45.765, lon: 4.8357, type: "Nid-de-poule", date: new Date().toISOString() }]));
    window.__voix = [];
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      speaking: false, pending: false, paused: false, getVoices: () => [], cancel() {}, resume() {}, pause() {},
      addEventListener() {}, removeEventListener() {},
      speak(u) { window.__voix.push(u.text); setTimeout(() => u.onend && u.onend({}), 5); },
    } });
  });
  const pageErrors = await openApp(page);
  await page.evaluate(() => window.calculateRouteSansAutoroute({ lat: 45.764, lng: 4.8357 }, { lat: 45.768, lng: 4.8417 }));
  await page.waitForTimeout(9500); // le guidage se tait 9 s pendant les annonces de départ

  const cdp = await context.newCDPSession(page);
  const points = [];
  for (let i = 0; i <= 16; i++) points.push([45.764 + i * 0.00025, 4.8357, 0]);
  for (let i = 1; i <= 24; i++) points.push([45.768, 4.8357 + i * 0.00025, 90]);
  for (const [latitude, longitude, heading] of points) {
    await cdp.send("Emulation.setGeolocationOverride", { latitude, longitude, accuracy: 5, speed: 9, heading });
    await page.waitForTimeout(250);
  }

  expect(pageErrors).toEqual([]);
  const state = await page.evaluate(() => ({ distance: window.session.totalDistance, voix: window.__voix.join(" | ") }));
  expect(state.distance).toBeGreaterThan(0.5);
  expect(state.voix).toMatch(/Nid-de-poule signalé/);
  expect(state.voix).toMatch(/faibles émissions|ZFE/);
  expect(state.voix).toMatch(/Dans \d+ m|Tournez/);
});

test("SOS refusé par le serveur : l'écran le dit et propose le 112 et le SMS", async ({ page }) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const token = `${b64({ alg: "ES256" })}.${b64({ uid: "e2e", purpose: "sos", iat: now, exp: now + 86400 })}.x`;
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  // Aucun appel réel au serveur : aucun SMS ne peut partir
  await page.route("https://api.mon50ccetmoi.com/**", (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    if (!r.request().url().endsWith("/sos")) return r.abort();
    return r.fulfill({ status: 429, headers: cors, contentType: "application/json",
      body: JSON.stringify({ error: "Trop de numéros différents alertés aujourd'hui. Appelez le 112.", sent: 0 }) });
  });
  await page.addInitScript((t) => {
    localStorage.setItem("sovereign_sos_token", t);
    localStorage.setItem("guardian_contact_1", "0612345678");
  }, token);
  await openApp(page);
  await page.waitForFunction(() => window.currentPosition);
  await page.evaluate(async () => {
    window.triggerFallAlert(true);
    clearInterval(window.fallAlertInterval); // pas d'attente des 15 s
    await window.executeAngeGardienProtocol();
  });
  const screen = page.locator("#fall-screen");
  await expect(screen).toContainText("Trop de numéros différents");
  await expect(screen).toContainText("PAS prévenus");
  await expect(screen.locator('a[href="tel:112"]')).toBeVisible();
  await expect(screen.locator('a[href^="sms:"]')).toBeVisible();
});
