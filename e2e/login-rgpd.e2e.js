// Page de connexion dans un vrai navigateur : plus aucun contact avec Google (24/11/2026, la connexion Google
// n'existe plus), et l'inscription exige la case « 15 ans ou plus, ou accord d'un parent » (18/11/2026).
import { test, expect } from "@playwright/test";

async function refuseCookies(page) {
  const refuse = page.locator("#cookie-consent-banner").getByRole("button", { name: "Tout refuser" });
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
}

test("la page de connexion ne contacte jamais Google", async ({ page }) => {
  const googleRequests = [];
  page.on("request", (req) => {
    if (/(^|\.)(google|googleapis|gstatic|googleusercontent|firebaseapp)\.com$/.test(new URL(req.url()).hostname)) googleRequests.push(req.url());
  });
  await page.goto("/login.html", { waitUntil: "load" });
  await refuseCookies(page);
  await page.waitForTimeout(2000);
  expect(googleRequests, "Google contacté").toEqual([]);
  await expect(page.locator("#google-signin-trigger")).toHaveCount(0);
  await expect(page.getByText("Inscrit avec Google ?")).toBeVisible();
});

test("inscription refusée tant que la case d'âge n'est pas cochée", async ({ page }) => {
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    d.dismiss().catch(() => {});
  });
  await page.goto("/login.html#register", { waitUntil: "load" });
  await refuseCookies(page);
  await expect(page.locator("#register-form")).toBeVisible();
  await expect(page.getByText("J'ai 15 ans ou plus")).toBeVisible();

  await page.fill("#reg-user", "PiloteTest");
  await page.fill("#reg-pass", "motdepasse-test");
  await page.selectOption("#reg-brand", "Peugeot");
  await page.fill("#reg-model", "Kisbee");
  await page.locator('[data-action="doRegister()"]').click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain("15 ans ou plus");
  await expect(page.locator("#reg-age")).not.toBeChecked();
});
