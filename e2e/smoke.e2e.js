// Tests de fumée dans un vrai navigateur : chaque page du site se charge sans erreur
// JavaScript non rattrapée et sans fichier du site introuvable (script, style, image).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openAndWatch } from "./helpers.js";

const DIST = path.resolve("dist");
const PAGES = fs.readdirSync(DIST).filter((f) => f.endsWith(".html") && !f.startsWith("google"));

test.describe("Toutes les pages se chargent sans erreur", () => {
  for (const file of PAGES) {
    test(file, async ({ page }) => {
      const { pageErrors, missing, cspViolations } = await openAndWatch(page, `/${file}`);
      expect(missing, "fichiers du site introuvables").toEqual([]);
      expect(cspViolations, "scripts bloqués par la CSP").toEqual([]);
      expect(pageErrors, "erreurs JavaScript non rattrapées").toEqual([]);
    });
  }
});
