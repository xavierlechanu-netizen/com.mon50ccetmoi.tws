// Bandeau cookies dans un vrai navigateur (16/11/2026) : un seul bandeau, « Tout refuser » aussi
// visible que « Tout accepter », le choix est gardé, et on peut le changer depuis la page Cookies.
import { test, expect } from "@playwright/test";

test("un seul bandeau : refuser le ferme, il ne revient pas, la page Cookies le rouvre", async ({ page }) => {
  await page.goto("/index.html");
  const banner = page.locator("#cookie-consent-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveCount(1);
  // Plus de second bandeau Axeptio
  await expect(page.locator("#axeptio_overlay")).toHaveCount(0);

  const refuse = banner.getByRole("button", { name: "Tout refuser" });
  const accept = banner.getByRole("button", { name: "Tout accepter" });
  await expect(refuse).toBeVisible();
  await expect(accept).toBeVisible();
  // Même taille à quelques pixels près : refuser n'est pas caché ni rapetissé
  const [r, a] = [await refuse.boundingBox(), await accept.boundingBox()];
  expect(Math.abs(r.width - a.width)).toBeLessThan(40);
  expect(Math.abs(r.height - a.height)).toBeLessThan(4);
  if (process.env.COOKIE_SCREENSHOT) await page.screenshot({ path: process.env.COOKIE_SCREENSHOT });

  await refuse.click();
  await expect(banner).toHaveCount(0);
  const choice = await page.evaluate(() => JSON.parse(localStorage.getItem("cookie_consent_choice")));
  expect(choice.choice).toBe("refused");

  await page.goto("/app.html");
  await expect(page.locator("#cookie-consent-banner")).toHaveCount(0);

  await page.goto("/cookies.html");
  await page.getByRole("button", { name: "Modifier mes choix" }).click();
  await expect(page.locator("#cookie-consent-banner")).toBeVisible();
});
