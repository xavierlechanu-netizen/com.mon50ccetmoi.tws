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
