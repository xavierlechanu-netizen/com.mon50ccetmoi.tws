/**
 * ScreenManager (src/js/screen-manager.js) : un écran ouvert doit être visible.
 * Le 16/11/2026, « Mon Véhicule » s'ouvrait et restait invisible : le conteneur perdait
 * `hidden`, mais pas la racine <div id="<écran>" class="hidden ..."> du fichier chargé.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../src");
const SCREENS = path.join(SRC, "public/screens");

function loadScreenManager() {
  const source = fs
    .readFileSync(path.join(SRC, "js/screen-manager.js"), "utf8")
    .replace(/^import\s+.*?;\s*$/gm, "");
  const registerAction = () => {};
  // eslint-disable-next-line no-new-func
  new Function("registerAction", source)(registerAction);
  return window.ScreenManager;
}

function serveScreens() {
  global.fetch = jest.fn(async (url) => {
    const file = path.join(SCREENS, path.basename(url));
    if (!fs.existsSync(file)) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => fs.readFileSync(file, "utf8") };
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ScreenManager : l'écran ouvert est visible", () => {
  let SM;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-container" class="hidden"></div>';
    window.DOMPurify = { sanitize: (html) => html };
    serveScreens();
    SM = loadScreenManager();
  });

  const screenFiles = fs.readdirSync(SCREENS).filter((f) => f.endsWith(".html"));

  test.each(screenFiles.map((f) => [f.replace(/\.html$/, "")]))("%s", async (screenId) => {
    await SM.open(screenId);
    const container = document.getElementById("screen-container");
    const root = document.getElementById(screenId);

    expect(container.classList.contains("hidden")).toBe(false);
    expect(root).not.toBeNull();
    expect(root.parentElement).toBe(container);
    if (root.getAttribute("data-screen-show") === "manual") {
      // Écran montré plus tard par son propre code (ex. après une chute)
      expect(root.classList.contains("hidden")).toBe(true);
    } else {
      expect(root.classList.contains("hidden")).toBe(false);
    }
  });

  test("Mon Véhicule s'affiche sans contournement", async () => {
    await SM.open("vehicle-config-screen");
    expect(document.getElementById("vehicle-config-screen").classList.contains("hidden")).toBe(false);
  });

  test("l'écran de choc reste caché jusqu'à ce que son code le montre", async () => {
    await SM.open("tim-cook-sos-screen");
    expect(document.getElementById("tim-cook-sos-screen").classList.contains("hidden")).toBe(true);
  });

  test("un écran qui se cache lui-même ferme aussi le fond noir", async () => {
    await SM.open("leaderboard-modal");
    document.getElementById("leaderboard-modal").classList.add("hidden");
    await flush();
    expect(SM.activeScreenId).toBeNull();
    expect(document.getElementById("screen-container").classList.contains("hidden")).toBe(true);
  });

  test("une fenêtre fermée par display:none ferme aussi le fond noir (chat Nexus Atlas)", async () => {
    await SM.open("nexus-atlas-chat-modal");
    const modal = document.getElementById("nexus-atlas-chat-modal");
    modal.style.display = "flex"; // NexusAtlasChat.open()
    await flush();
    expect(SM.activeScreenId).toBe("nexus-atlas-chat-modal");
    modal.style.display = "none"; // NexusAtlasChat.close()
    await flush();
    expect(SM.activeScreenId).toBeNull();
    expect(document.getElementById("screen-container").classList.contains("hidden")).toBe(true);
  });

  test("ouvrir un autre écran ne referme pas le nouveau", async () => {
    await SM.open("leaderboard-modal");
    await SM.open("security-settings-screen");
    await flush();
    expect(SM.activeScreenId).toBe("security-settings-screen");
    expect(document.getElementById("security-settings-screen").classList.contains("hidden")).toBe(false);
  });

  test("un écran introuvable affiche l'erreur, sans planter", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    await SM.open("ecran-inexistant");
    expect(document.getElementById("screen-container").textContent).toContain("Erreur de chargement");
  });
});
