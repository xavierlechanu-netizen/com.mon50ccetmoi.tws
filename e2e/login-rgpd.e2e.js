// Page de connexion dans un vrai navigateur (18/11/2026) : Google n'est contacté qu'au clic sur
// « Continuer avec Google », et l'inscription exige la case « 15 ans ou plus, ou accord d'un parent ».
import { test, expect } from "@playwright/test";

async function refuseCookies(page) {
  const refuse = page.locator("#cookie-consent-banner").getByRole("button", { name: "Tout refuser" });
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
}

test("Google n'est contacté qu'au clic sur « Continuer avec Google »", async ({ page }) => {
  const googleRequests = [];
  // Aucun accès réel à Google pendant le test : la demande est notée puis bloquée
  await page.route("https://accounts.google.com/**", (route) => {
    googleRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto("/login.html", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(googleRequests, "Google contacté avant tout clic").toEqual([]);

  await refuseCookies(page);
  const trigger = page.locator("#google-signin-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect.poll(() => googleRequests.length).toBeGreaterThan(0);
  expect(googleRequests[0]).toContain("accounts.google.com/gsi/client");
  // Google bloqué ici : le bouton revient, avec un message
  await expect(page.locator("#google-signin-status")).toContainText("Google ne répond pas");
  await expect(trigger).toBeEnabled();
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
