// Tests de fumée dans un vrai navigateur : chaque page du site se charge sans erreur
// JavaScript non rattrapée et sans fichier du site introuvable (script, style, image).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const PAGES = fs.readdirSync(DIST).filter((f) => f.endsWith(".html") && !f.startsWith("google"));

/** Ouvre une page en relevant les erreurs JS et les fichiers du site manquants. */
export async function openAndWatch(page, url, { settleMs = 1500 } = {}) {
  const pageErrors = [];
  const missing = [];
  page.on("pageerror", (err) => pageErrors.push(String(err.message || err).slice(0, 300)));
  page.on("response", (res) => {
    const u = new URL(res.url());
    if (u.hostname === "localhost" && res.status() >= 400 && !u.pathname.endsWith("favicon.ico")) {
      missing.push(`${res.status()} ${u.pathname}`);
    }
  });
  page.on("dialog", (d) => d.dismiss().catch(() => {})); // alert/confirm : jamais bloquants
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(settleMs);
  return { pageErrors, missing };
}

test.describe("Toutes les pages se chargent sans erreur", () => {
  for (const file of PAGES) {
    test(file, async ({ page }) => {
      const { pageErrors, missing } = await openAndWatch(page, `/${file}`);
      expect(missing, "fichiers du site introuvables").toEqual([]);
      expect(pageErrors, "erreurs JavaScript non rattrapées").toEqual([]);
    });
  }
});
