/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");

describe("HapticNavigationEngine — Tests Unitaires du Cockpit OLED & Moteur Haptique", () => {
  let HapticNav;
  let NAV_MODES;
  let HAPTIC_PATTERNS;
  let HAPTIC_MODE_STORAGE_KEY;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";

    // Charger haptic-navigation.js dans le contexte de test
    const rawCode = fs.readFileSync(path.resolve(__dirname, "../src/js/haptic-navigation.js"), "utf8");
    const sanitizedCode = rawCode
      .replace(/import\s+.*?;/g, "")
      .replace(/export\s+const\s+/g, "const ")
      .replace(/export\s+class\s+/g, "class ")
      .replace(/export\s+/g, "");

    const evalFn = new Function(
      "window",
      "document",
      "navigator",
      "localStorage",
      `${sanitizedCode}\nreturn { HapticNav, NAV_MODES, HAPTIC_PATTERNS, HAPTIC_MODE_STORAGE_KEY };`
    );

    const exportsObj = evalFn(window, document, navigator, localStorage);
    HapticNav = exportsObj.HapticNav;
    NAV_MODES = exportsObj.NAV_MODES;
    HAPTIC_PATTERNS = exportsObj.HAPTIC_PATTERNS;
    HAPTIC_MODE_STORAGE_KEY = exportsObj.HAPTIC_MODE_STORAGE_KEY;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("1. Initialisation : mode par défaut HUD_FLASH recommandé", () => {
    expect(HapticNav.currentMode).toBe(NAV_MODES.HUD_FLASH);
    expect(HapticNav.isHudActive).toBe(true);
    expect(HapticNav.isExclusiveHaptic).toBe(false);
  });

  test("2. Changement de mode et persistance localStorage", () => {
    HapticNav.setMode(NAV_MODES.TACTILE_PUR);
    expect(HapticNav.currentMode).toBe(NAV_MODES.TACTILE_PUR);
    expect(HapticNav.isExclusiveHaptic).toBe(true);
    expect(localStorage.getItem(HAPTIC_MODE_STORAGE_KEY)).toBe(NAV_MODES.TACTILE_PUR);

    HapticNav.setMode(NAV_MODES.STANDARD);
    expect(HapticNav.currentMode).toBe(NAV_MODES.STANDARD);
    expect(HapticNav.isHudActive).toBe(false);
    expect(HapticNav.isExclusiveHaptic).toBe(false);
  });

  test("3. Résolution des directions (Left, Right, Roundabout, U-Turn, Straight)", () => {
    expect(HapticNav.resolveDirectionType("turn-left", "Prendre à gauche")).toBe("LEFT");
    expect(HapticNav.resolveDirectionType("turn-right", "Tournez à droite")).toBe("RIGHT");
    expect(HapticNav.resolveDirectionType("roundabout-right", "Au rond-point, prenez la 2e sortie")).toBe("ROUNDABOUT");
    expect(HapticNav.resolveDirectionType("uturn", "Faites demi-tour")).toBe("UTURN");
    expect(HapticNav.resolveDirectionType("straight", "Continuez tout droit sur 500m")).toBe("STRAIGHT");
    expect(HapticNav.resolveDirectionType(null, "Vous êtes arrivé à destination")).toBe("DESTINATION");
  });

  test("4. Extraction du numéro de sortie de rond-point", () => {
    expect(HapticNav.extractRoundaboutExit("Au rond-point, prendre la 2e sortie")).toBe("2");
    expect(HapticNav.extractRoundaboutExit("Prendre la 3ème sortie")).toBe("3");
    expect(HapticNav.extractRoundaboutExit("Au giratoire, 1ère sortie")).toBe("1");
    expect(HapticNav.extractRoundaboutExit("Tournez à droite")).toBeNull();
  });

  test("5. Déclenchement des vibrations physiques quand navigator.vibrate est présent", () => {
    const mockVibrate = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "vibrate", {
      value: mockVibrate,
      writable: true,
      configurable: true
    });

    const success = HapticNav.vibratePattern(HAPTIC_PATTERNS.LEFT);
    expect(success).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.LEFT);
  });

  test("6. Fallback automatique et gracieux sans crash si navigator.vibrate n'est pas supporté (iOS Safari)", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      writable: true,
      configurable: true
    });

    expect(HapticNav.isVibrationSupported()).toBe(false);
    const success = HapticNav.vibratePattern(HAPTIC_PATTERNS.RIGHT);
    expect(success).toBe(false);
  });

  test("7. Navigation : Démarrage, création du HUD DOM et mode furtif en croisière (> 180m)", () => {
    HapticNav.startNavigation();
    expect(HapticNav.isNavigating).toBe(true);

    const hudOverlay = document.getElementById("haptic-hud-overlay");
    expect(hudOverlay).not.toBeNull();
    expect(hudOverlay.style.display).toBe("flex");

    // Étape à 500m (au-delà du seuil de 180m) -> Mode furtif (cruise state visible)
    HapticNav.updateStep(
      { maneuver: "turn-left", cleanInstruction: "Tournez à gauche" },
      500,
      "Puis tout droit",
      45
    );

    const cruiseState = document.getElementById("hud-cruise-state");
    const maneuverState = document.getElementById("hud-maneuver-state");
    expect(cruiseState.style.display).toBe("flex");
    expect(maneuverState.style.display).toBe("none");
  });

  test("8. Wake-up Réflexe à l'approche (< 180m) : apparition de la manœuvre géante", () => {
    HapticNav.startNavigation();

    // Étape à 120m (< 180m) -> Réveil de l'affichage manœuvre XXL
    HapticNav.updateStep(
      { maneuver: "turn-right", cleanInstruction: "Prendre à droite rue de Paris" },
      120,
      "Arrivée imminente",
      38
    );

    const cruiseState = document.getElementById("hud-cruise-state");
    const maneuverState = document.getElementById("hud-maneuver-state");
    const distVal = document.getElementById("hud-dist-val");
    const streetVal = document.getElementById("hud-street-val");

    expect(cruiseState.style.display).toBe("none");
    expect(maneuverState.style.display).toBe("flex");
    expect(distVal.textContent).toBe("120 m");
    expect(streetVal.textContent).toBe("Prendre à droite rue de Paris");
  });

  test("9. Alerte de danger à l'approche (< 250m)", () => {
    HapticNav.startNavigation();
    HapticNav.triggerHazardAlert("Nid-de-poule profond", 90);

    const hazardAlert = document.getElementById("hud-hazard-alert");
    const titleEl = document.getElementById("hud-hz-title");
    const distEl = document.getElementById("hud-hz-dist");

    expect(hazardAlert.style.display).toBe("flex");
    expect(titleEl.textContent).toBe("Nid-de-poule profond");
    expect(distEl.textContent).toBe("90m");
  });

  test("10. Arrêt de navigation et extinction du cockpit", () => {
    HapticNav.startNavigation();
    expect(HapticNav.isNavigating).toBe(true);

    HapticNav.stopNavigation();
    expect(HapticNav.isNavigating).toBe(false);

    const hudOverlay = document.getElementById("haptic-hud-overlay");
    expect(hudOverlay.style.display).toBe("none");
    expect(document.body.classList.contains("haptic-hud-active")).toBe(false);
  });
});
