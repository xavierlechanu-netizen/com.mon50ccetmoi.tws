// Portail assureur (assureur.html) dans un vrai navigateur, sur la page compilée.
// Aucune connexion réelle : on vérifie l'écran de connexion et que chaque bouton est branché.
// Le parcours complet (dossier, SIREN, paiement, rapport) est testé dans tests/assureur-portal.test.js.
import { test, expect } from "@playwright/test";
import { openAndWatch } from "./helpers.js";

test("écran de connexion affiché, boutons branchés, aucune erreur", async ({ page }) => {
  const { pageErrors, missing, cspViolations } = await openAndWatch(page, "/assureur.html", { settleMs: 2500 });
  expect(missing).toEqual([]);
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);

  await expect(page.locator("#login-screen")).toBeVisible();
  await expect(page.locator("#portal-content")).toBeHidden();

  // Chaque action de la page désigne une fonction réellement chargée
  const dead = await page.evaluate(() =>
    [...document.querySelectorAll("[data-action], [data-enter-action]")]
      .map((el) => el.getAttribute("data-action") || el.getAttribute("data-enter-action"))
      .map((a) => a.replace(/\(.*$/, "").trim())
      .filter((name) => typeof window.getAction(name) !== "function"),
  );
  expect(dead).toEqual([]);
});

test("connexion sans identifiants : message, pas d'appel au serveur d'authentification", async ({ page }) => {
  const authCalls = [];
  page.on("request", (req) => {
    if (/identitytoolkit|securetoken/.test(req.url())) authCalls.push(req.url());
  });
  await openAndWatch(page, "/assureur.html");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("#login-status")).toHaveText("Saisissez votre email et votre mot de passe.");
  expect(authCalls).toEqual([]);
});
