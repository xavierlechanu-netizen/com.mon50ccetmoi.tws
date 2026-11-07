/**
 * @jest-environment node
 *
 * Barre d'outils (src/js/dock.js) : chaque bouton doit appeler une fonction qui existe.
 * Le 7/11/2026, 3 boutons sur 37 ne faisaient rien (Radar Social, Score de Pilotage,
 * REC Trace) : ils appelaient des objets absents de la page, sans aucun message.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.resolve(__dirname, "../src");
const dockSource = fs.readFileSync(path.join(SRC, "js/dock.js"), "utf8");

function readArray(name) {
  const start = dockSource.indexOf(`const ${name} = [`);
  const end = dockSource.indexOf("];", start);
  const literal = dockSource.slice(start + `const ${name} = `.length, end + 1);
  return vm.runInNewContext(`(${literal})`, {});
}

const buttons = [...readArray("DOCK_BUTTONS"), ...readArray("DOCK_FEATURE_BUTTONS")];

// Scripts réellement chargés par app.html
const appHtml = fs.readFileSync(path.join(SRC, "app.html"), "utf8");
const loadedScripts = [...appHtml.matchAll(/<script[^>]*src="\/js\/([^"?]+)/g)]
  .map((m) => path.join(SRC, "js", m[1]))
  .filter((f) => fs.existsSync(f))
  .map((f) => ({ file: path.basename(f), text: fs.readFileSync(f, "utf8") }));

function definingScript(root) {
  // « window.X = » est une définition ; « window.X === … » n'est qu'une comparaison
  const definition = new RegExp(`window\\.${root}\\s*=(?!=)|registerAction\\(\\s*['"]${root}['"]`);
  return loadedScripts.find((s) => definition.test(s.text));
}

describe("Barre d'outils : aucun bouton mort", () => {
  test("la barre contient bien ses boutons", () => {
    expect(buttons.length).toBeGreaterThanOrEqual(30);
  });

  test.each(buttons.map((b) => [b.label || b.text || b.id, b]))("%s", (_label, button) => {
    const src = button.action.toString();
    const opensScreen = /ScreenManager\.open\('([^']+)'\)/.exec(src);
    const goesToPage = /location\.href\s*=\s*'([^']+)'/.exec(src);

    if (opensScreen) {
      expect(fs.existsSync(path.join(SRC, "public/screens", `${opensScreen[1]}.html`))).toBe(true);
      return;
    }
    if (goesToPage) {
      expect(fs.existsSync(path.join(SRC, goesToPage[1]))).toBe(true);
      return;
    }

    // Au moins une des fonctions appelées doit exister dans un script chargé par app.html
    const calls = [...src.matchAll(/window\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\(/g)];
    expect(calls.length).toBeGreaterThan(0);
    const reachable = calls.some(([, root, method]) => {
      const script = definingScript(root);
      if (!script) return false;
      return !method || new RegExp(`\\b${method}\\s*(:|\\()`).test(script.text);
    });
    expect({ bouton: button.id, appels: calls.map((c) => c[0]), trouvé: reachable })
      .toEqual(expect.objectContaining({ trouvé: true }));
  });
});
