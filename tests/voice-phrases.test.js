/**
 * @jest-environment node
 *
 * Dictionnaire des phrases vocales (src/js/voice-phrases.js) : chaque phrase prononcée
 * par l'app doit avoir sa traduction anglaise et espagnole. Plus aucun envoi à Google.
 */
const fs = require("fs");
const path = require("path");

const JS = path.resolve(__dirname, "../src/js");

function loadModule() {
  const src = fs.readFileSync(path.join(JS, "voice-phrases.js"), "utf8")
    .replace(/^export (const|function) /gm, "$1 ");
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn { PHRASES, PATTERNS, PREFIXES, translateForVoice, voiceLanguage };`)();
}
const V = loadModule();

// Toutes les phrases passées à speak(...) dans le code du site
function spokenPhrases() {
  const literals = [];
  const templates = [];
  for (const file of fs.readdirSync(JS).filter((f) => f.endsWith(".js") && f !== "voice-phrases.js")) {
    const s = fs.readFileSync(path.join(JS, file), "utf8");
    const re = /(?:^|[^.\w]|window\.)speak\(\s*/g;
    let m;
    while ((m = re.exec(s))) {
      const rest = s.slice(re.lastIndex);
      const q = rest[0];
      if (q === '"' || q === "'") {
        const end = rest.indexOf(q, 1);
        const text = rest.slice(1, end);
        const concatenated = /^\s*\+/.test(rest.slice(end + 1));
        literals.push({ text, concatenated, where: file });
      } else if (q === "`") {
        const end = rest.indexOf("`", 1);
        templates.push({ text: rest.slice(1, end).replace(/\$\{[^}]+\}/g, "3"), where: file });
      }
    }
  }
  return { literals, templates };
}

// Lexique « standard » d'OracleEngine (clés comme « start_guardian »)
function standardLexicon() {
  const s = fs.readFileSync(path.join(JS, "app-core.js"), "utf8");
  const start = s.indexOf("standard: {", s.indexOf("regionalLexicon"));
  const block = s.slice(start, s.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/(\w+):\s*\n?\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
}

describe("Voix de Nexus Atlas : dictionnaire intégré", () => {
  const { literals, templates } = spokenPhrases();
  const lexicon = standardLexicon();

  test("le code ne passe plus par Google Traduction", () => {
    const core = fs.readFileSync(path.join(JS, "app-core.js"), "utf8");
    expect(core).not.toMatch(/translate\.googleapis\.com/);
  });

  test("chaque entrée a une traduction anglaise et espagnole", () => {
    for (const [fr, t] of Object.entries(V.PHRASES)) {
      expect({ fr, en: !!t.en, es: !!t.es }).toEqual({ fr, en: true, es: true });
    }
    for (const p of V.PATTERNS) expect(Boolean(p.en && p.es)).toBe(true);
  });

  test("l'inventaire trouve bien les phrases du site", () => {
    expect(literals.length).toBeGreaterThan(150);
    expect(templates.length).toBeGreaterThan(15);
  });

  test.each(["en", "es"])("toutes les phrases fixes sont traduites (%s)", (lang) => {
    const missing = literals
      .map(({ text, concatenated }) => (/^[a-z_]+$/.test(text) ? lexicon[text] : text + (concatenated ? "3" : "")))
      .filter((text) => text && !V.translateForVoice(text, lang).translated);
    expect([...new Set(missing)]).toEqual([]);
  });

  test.each(["en", "es"])("toutes les phrases à partie variable sont traduites (%s)", (lang) => {
    const missing = templates.filter(({ text }) => !V.translateForVoice(text, lang).translated).map((t) => `${t.where}: ${t.text}`);
    expect(missing).toEqual([]);
  });

  test("exemples et langue de repli", () => {
    expect(V.translateForVoice("Alerte SOS : Pilote en détresse à 2.4 kilomètres.", "en").text)
      .toBe("SOS alert: rider in distress 2.4 kilometres away.");
    expect(V.translateForVoice("Client trouvé : Bob", "es").text).toBe("Cliente encontrado: Bob");
    expect(V.translateForVoice("Phrase inconnue", "en")).toEqual({ text: "Phrase inconnue", lang: "fr", translated: false });
    expect(V.voiceLanguage("en", "fr-FR")).toBe("en");
    expect(V.voiceLanguage(null, "es-ES")).toBe("es");
    expect(V.voiceLanguage("de", "de-DE")).toBe("fr");
  });
});
