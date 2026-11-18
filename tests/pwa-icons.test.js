/**
 * @jest-environment node
 *
 * Icônes de l'appli (PWA) : la taille annoncée dans manifest.json doit être la vraie taille de
 * l'image, et le favicon des pages doit rester léger. Avant le 17/11/2026, « icon-192x192.png »
 * était une image de 1024 × 1024 de 563 Ko, chargée comme favicon par chaque page du site.
 */
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "../src/public");
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, "manifest.json"), "utf8"));

/** Largeur et hauteur d'un PNG, lues dans son en-tête IHDR. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  expect(b.subarray(1, 4).toString("ascii")).toBe("PNG");
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

describe("Icônes de la PWA", () => {
  test.each(manifest.icons.map((i) => [i.src, i.sizes]))("%s fait bien %s", (src, sizes) => {
    expect(pngSize(path.join(PUBLIC, src))).toBe(sizes);
  });

  test("le favicon (icon-192x192.png) fait 192 × 192 et moins de 100 Ko", () => {
    const file = path.join(PUBLIC, "assets/icons/icon-192x192.png");
    expect(pngSize(file)).toBe("192x192");
    expect(fs.statSync(file).size).toBeLessThan(100 * 1024);
  });
});
