/**
 * Textes des membres affichés sans danger (src/js/html-escape.js, audit du 16/11/2026).
 *
 * DOMPurify garde les attributs data-action et style (ils font marcher les boutons de l'appli) :
 * un message de crew, une annonce ou un arrêt pouvait donc poser un faux bouton invisible sur tout
 * l'écran, qui lançait une fonction de l'appli au premier toucher. Ce test vérifie l'échappement,
 * puis qu'aucun écran communautaire ne remet un champ écrit par un membre tel quel dans du HTML.
 */
const fs = require("fs");
const path = require("path");

function loadModule(file, names) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8").replace(/^export /gm, "");
  // Même méthode que les autres tests du projet pour charger un module ES sans transpilation
  // eslint-disable-next-line no-new-func
  return new Function(`${code}; return { ${names.join(", ")} };`)();
}

const { escapeHtml, safeId, safeActionText, safeNumber, safeImageUrl } = loadModule("src/js/html-escape.js",
  ["escapeHtml", "safeId", "safeActionText", "safeNumber", "safeImageUrl"]);

describe("escapeHtml", () => {
  test("un faux bouton devient du texte visible, sans balise ni attribut", () => {
    const piege = `<button data-action="ExchangeMarket.reserveListing('x', 1, 'bvc')" style="position:fixed;inset:0">OK</button>`;
    const div = document.createElement("div");
    div.innerHTML = `<p>${escapeHtml(piege)}</p>`; // eslint-disable-line no-restricted-syntax
    expect(div.querySelector("button")).toBeNull();
    expect(div.querySelector("[data-action]")).toBeNull();
    expect(div.textContent).toBe(piege);
  });

  test("guillemets échappés : impossible de sortir d'un attribut", () => {
    const div = document.createElement("div");
    div.innerHTML = `<span title="${escapeHtml(`x" data-action="logout()`)}"></span>`; // eslint-disable-line no-restricted-syntax
    expect(div.querySelector("[data-action]")).toBeNull();
    expect(div.querySelector("span").getAttribute("title")).toBe(`x" data-action="logout()`);
  });

  test("null et undefined donnent une chaîne vide, les nombres restent lisibles", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(12.5)).toBe("12.5");
    expect(escapeHtml("Café & co")).toBe("Café &amp; co");
  });
});

describe("safeId, safeNumber, safeImageUrl", () => {
  test("safeId garde les identifiants Firestore et pseudos, refuse tout le reste", () => {
    expect(safeId("aZ09_-.")).toBe("aZ09_-.");
    expect(safeId("Kx7fP2mQ9rT")).toBe("Kx7fP2mQ9rT");
    // &#39; est décodé par le navigateur AVANT la lecture du data-action : on refuse l'apostrophe
    expect(safeId("x'); logout('")).toBe("");
    expect(safeId("a b")).toBe("");
    expect(safeId("")).toBe("");
    expect(safeId(null)).toBe("");
    expect(safeId("a".repeat(129))).toBe("");
  });

  test("safeActionText garde les anciens pseudos (espaces, accents) mais rien qui sorte de l'argument", () => {
    expect(safeActionText("Jean Dupont")).toBe("Jean Dupont");
    expect(safeActionText("Zoé_50cc")).toBe("Zoé_50cc");
    // le lecteur d'actions coupe sur « ; » et l'apostrophe ferme l'argument
    expect(safeActionText("x'); logout('")).toBe("");
    expect(safeActionText("a; logout()")).toBe("");
    expect(safeActionText('a" data-action="logout()')).toBe("");
    expect(safeActionText("a".repeat(129))).toBe("");
    expect(safeActionText(undefined)).toBe("");
  });

  test("safeNumber n'accepte que de vrais nombres finis", () => {
    expect(safeNumber(48.85)).toBe(48.85);
    expect(safeNumber("1)); logout((")).toBe(0);
    expect(safeNumber(Number.NaN, 7)).toBe(7);
    expect(safeNumber(Infinity)).toBe(0);
  });

  test("safeImageUrl : https et images intégrées seulement", () => {
    expect(safeImageUrl("https://exemple.fr/photo.jpg")).toBe("https://exemple.fr/photo.jpg");
    expect(safeImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(safeImageUrl("javascript:alert(1)")).toBe("");
    expect(safeImageUrl("http://exemple.fr/photo.jpg")).toBe("");
    expect(safeImageUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("");
    expect(safeImageUrl(`x" data-action="logout()`)).toBe("");
    expect(safeImageUrl(undefined)).toBe("");
    // Un guillemet dans une adresse https est encodé par URL : il ne peut pas fermer l'attribut
    expect(safeImageUrl(`https://exemple.fr/a"b.jpg`)).not.toContain('"');
  });
});

// Écrans qui affichent des contenus écrits par d'autres membres
const COMMUNITY_SCREENS = [
  "crew-chat.js", "garage-market.js", "pit-stops.js", "sos-community.js", "social-radar.js",
  "radar-social.js", "convoy.js", "leaderboard.js", "cortege-mode.js", "exchange.js",
  "community-gas.js", "garage.js",
];
// Champs écrits par les membres (titre, texte, pseudo…)
const MEMBER_FIELD = /\$\{[A-Za-z_]+\.(name|desc|description|author|authorName|username|title|text|body|seller|vehicle|category|type|photoUrl)\b[^}]*\}/;

describe("Écrans communautaires : aucun champ de membre mis tel quel dans du HTML", () => {
  test.each(COMMUNITY_SCREENS)("%s", (file) => {
    const lines = fs.readFileSync(path.join(__dirname, "../src/js", file), "utf8").split(/\r?\n/);
    const found = [];
    lines.forEach((line, i) => {
      // Ligne de HTML (balise) contenant un champ de membre non échappé
      if (/<\/?[a-z][^>]*>/i.test(line) && MEMBER_FIELD.test(line)) found.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
    expect(found).toEqual([]);
  });

  test.each(COMMUNITY_SCREENS)("%s importe html-escape.js", (file) => {
    const text = fs.readFileSync(path.join(__dirname, "../src/js", file), "utf8");
    expect(text).toMatch(/from '\.\/html-escape\.js'/);
  });
});
