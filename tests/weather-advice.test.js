/**
 * @jest-environment node
 *
 * Conseil météo de l'Assistant Trajet : src/js/weather-advice.js
 */
const fs = require("fs");
const path = require("path");

// Le module est en ESM (navigateur) : on retire les "export" pour l'évaluer ici, comme les autres tests.
function loadModule() {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/js/weather-advice.js"), "utf8")
    .replace(/^export (const|function) /gm, "$1 ");
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn { describeWeather, weatherIsStale, WEATHER_MAX_AGE_MS };`)();
}

const { describeWeather, weatherIsStale, WEATHER_MAX_AGE_MS } = loadModule();
const NOON = 12;

describe("Assistant Trajet : conseil tiré de la vraie météo", () => {
  test("pluie réelle → alerte pluie, jamais « route sèche »", () => {
    for (const code of [51, 61, 63, 65, 80, 82]) {
      const a = describeWeather({ temp: 12, wind: 10, code }, NOON);
      expect(a.type).toBe("rain");
      expect(a.message).not.toMatch(/sèche|idéale/i);
    }
  });

  test("ciel dégagé → aucun message de pluie inventé", () => {
    const a = describeWeather({ temp: 18, wind: 8, code: 0 }, NOON);
    expect(a.type).toBe("clear");
    expect(a.message).not.toMatch(/pluie dans|min\b/i);
  });

  test("orage, neige/verglas et brouillard sont prioritaires", () => {
    expect(describeWeather({ temp: 20, wind: 5, code: 95 }, NOON).type).toBe("storm");
    expect(describeWeather({ temp: 0, wind: 5, code: 71 }, NOON).type).toBe("ice");
    expect(describeWeather({ temp: 2, wind: 5, code: 66 }, NOON).type).toBe("ice");
    expect(describeWeather({ temp: 8, wind: 5, code: 45 }, NOON).type).toBe("fog");
  });

  test("vent fort, froid, puis nuit", () => {
    expect(describeWeather({ temp: 15, wind: 62, code: 1 }, NOON).type).toBe("wind");
    expect(describeWeather({ temp: 1, wind: 5, code: 0 }, NOON).message).toContain("1 °C");
    expect(describeWeather({ temp: 14, wind: 5, code: 0 }, 22).type).toBe("night");
    expect(describeWeather({ temp: 14, wind: 5, code: 0 }, 5).type).toBe("night");
  });

  test("la météo est redemandée après 15 minutes, ou si elle n'existe pas", () => {
    const now = Date.UTC(2026, 10, 7, 12, 0, 0);
    expect(weatherIsStale(null, now)).toBe(true);
    expect(weatherIsStale({ temp: 10, at: now - 60 * 1000 }, now)).toBe(false);
    expect(weatherIsStale({ temp: 10, at: now - WEATHER_MAX_AGE_MS - 1 }, now)).toBe(true);
  });
});
