/**
 * @jest-environment node
 *
 * Réparation des lettres abîmées (scripts/fix-mojibake.js), exécutée avant chaque build.
 */
const { repair } = require("../scripts/fix-mojibake");

// Reproduit l'accident : texte UTF-8 relu comme Windows-1252
const cp1252 = new TextDecoder("windows-1252");
const breakOnce = (s) => cp1252.decode(new TextEncoder().encode(s));

describe("Réparation des lettres abîmées", () => {
  test("les vrais accents, symboles et emojis ne sont jamais modifiés", () => {
    const ok = "Café à côté — déjà vu, naïve, Œuvre, Âge, 50 € « bien » ✅ 🏍️ 道路交通法";
    expect(repair(ok).text).toBe(ok);
    expect(repair(ok).changes).toBe(0);
  });

  test("texte abîmé une fois : « Ã© » redevient « é »", () => {
    const original = "Sécurité routière : vitesse élevée ⚠️ 49,99 €";
    expect(breakOnce(original)).toContain("Ã©");
    expect(repair(breakOnce(original)).text).toBe(original);
  });

  test("texte abîmé deux fois : réparé en deux passes", () => {
    const original = "Vous êtes garagiste ? Velocità massima";
    expect(repair(breakOnce(breakOnce(original))).text).toBe(original);
  });

  test("texte abîmé deux fois avec la lettre « Â » perdue (ancien script de build)", () => {
    expect(repair("Velocidad mÃƒ¡xima").text).toBe("Velocidad máxima");
  });

  test("tiret long dont le dernier octet est devenu un guillemet droit", () => {
    expect(repair("partenaires â€\" accès").text).toBe("partenaires — accès");
  });
});
