/**
 * Bandeau cookies (src/js/cookie-consent.js, 16/11/2026).
 *
 * Avant : « J'ai compris » seul et « en continuant votre navigation, vous acceptez » (pas un
 * consentement pour la CNIL), plus un second bandeau Axeptio en anglais. Maintenant : un seul
 * bandeau, « Tout refuser » aussi simple et visible que « Tout accepter », choix gardé 6 mois.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const registered = {};

function loadConsentModule() {
  const code = fs.readFileSync(path.join(ROOT, "src/js/cookie-consent.js"), "utf8")
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "");
  const names = ["CONSENT_KEY", "CONSENT_VERSION", "CHOICE_TTL_MS", "readChoice", "saveChoice",
    "optionalTrackersAllowed", "createBanner", "showCookieBanner"];
  // Même méthode que les autres tests du projet pour charger un module ES sans transpilation
  // eslint-disable-next-line no-new-func
  return new Function("registerAction", `${code}; return { ${names.join(", ")} };`)(
    (name, fn) => { registered[name] = fn; },
  );
}

const C = loadConsentModule();
const NOW = Date.parse("2026-11-16T12:00:00Z");
const DAY = 24 * 3600 * 1000;

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

afterEach(() => {
  document.body.innerHTML = ""; // eslint-disable-line no-restricted-syntax
});

describe("Bandeau cookies", () => {
  test("premier passage : un bandeau en français avec Tout refuser et Tout accepter, au même style", () => {
    const banner = C.showCookieBanner({ doc: document, storage: memoryStorage(), now: NOW });
    expect(banner).not.toBeNull();
    const [refuse, accept] = banner.querySelectorAll("button");
    expect(refuse.textContent).toBe("Tout refuser");
    expect(accept.textContent).toBe("Tout accepter");
    expect(refuse.style.cssText).toBe(accept.style.cssText);
    expect(banner.textContent).not.toMatch(/en continuant/i);
    expect(banner.querySelector('a[href="cookies.html"]')).not.toBeNull();
    expect(banner.getAttribute("role")).toBe("dialog");
  });

  test("refuser ferme le bandeau, garde le choix daté et ne le redemande pas", () => {
    const storage = memoryStorage({ cookie_consent_accepted: "true" });
    const banner = C.showCookieBanner({ doc: document, storage, now: NOW });
    banner.querySelector('[data-cookie-choice="refused"]').click();
    expect(document.getElementById("cookie-consent-banner")).toBeNull();
    const record = JSON.parse(storage.data[C.CONSENT_KEY]);
    expect(record.choice).toBe("refused");
    expect(record.version).toBe(C.CONSENT_VERSION);
    expect(Number.isFinite(Date.parse(record.date))).toBe(true);
    expect(storage.data.cookie_consent_accepted).toBeUndefined(); // ancien « J'ai compris » effacé
    expect(C.optionalTrackersAllowed(storage)).toBe(false);
    expect(C.showCookieBanner({ doc: document, storage })).toBeNull();
  });

  test("accepter autorise les traceurs facultatifs, refuser ou ne rien choisir non", () => {
    const storage = memoryStorage();
    expect(C.optionalTrackersAllowed(storage, NOW)).toBe(false);
    C.saveChoice(storage, "accepted", NOW);
    expect(C.optionalTrackersAllowed(storage, NOW)).toBe(true);
    C.saveChoice(storage, "refused", NOW);
    expect(C.optionalTrackersAllowed(storage, NOW)).toBe(false);
    C.saveChoice(storage, "n'importe quoi", NOW);
    expect(JSON.parse(storage.data[C.CONSENT_KEY]).choice).toBe("refused");
  });

  test("l'ancien bandeau « J'ai compris » ne vaut pas un choix : on redemande", () => {
    const storage = memoryStorage({ cookie_consent_accepted: "true" });
    expect(C.readChoice(storage, NOW)).toBeNull();
    expect(C.showCookieBanner({ doc: document, storage, now: NOW })).not.toBeNull();
  });

  test("le choix est redemandé après 6 mois, ou s'il est illisible", () => {
    const storage = memoryStorage();
    C.saveChoice(storage, "accepted", NOW);
    expect(C.readChoice(storage, NOW + 100 * DAY)).not.toBeNull();
    expect(C.readChoice(storage, NOW + C.CHOICE_TTL_MS + DAY)).toBeNull();
    storage.setItem(C.CONSENT_KEY, "{pas du json");
    expect(C.readChoice(storage, NOW)).toBeNull();
    storage.setItem(C.CONSENT_KEY, JSON.stringify({ choice: "accepted", date: "2026-11-16T12:00:00Z", version: 0 }));
    expect(C.readChoice(storage, NOW)).toBeNull();
  });

  test("stockage bloqué (navigation privée) : le bandeau s'affiche quand même, sans erreur", () => {
    const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); }, removeItem() {} };
    const banner = C.showCookieBanner({ doc: document, storage: blocked, now: NOW });
    expect(() => banner.querySelector('[data-cookie-choice="accepted"]').click()).not.toThrow();
    expect(document.getElementById("cookie-consent-banner")).toBeNull();
  });

  test("« Modifier mes choix » (page Cookies) rouvre le bandeau même après un choix", () => {
    expect(typeof registered.openCookieChoices).toBe("function");
    const storage = memoryStorage();
    C.saveChoice(storage, "refused", NOW);
    expect(C.showCookieBanner({ doc: document, storage, now: NOW })).toBeNull();
    expect(C.showCookieBanner({ doc: document, storage, now: NOW, force: true })).not.toBeNull();
    // Jamais deux bandeaux à la fois
    C.showCookieBanner({ doc: document, storage, now: NOW, force: true });
    expect(document.querySelectorAll("#cookie-consent-banner")).toHaveLength(1);
  });
});

describe("Un seul bandeau sur le site", () => {
  const pages = fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".html"));

  test("Axeptio n'est plus chargé (ni par une page, ni par config.js, ni autorisé par la CSP)", () => {
    const loaders = pages.filter((p) => /axept/i.test(fs.readFileSync(path.join(ROOT, "src", p), "utf8")));
    expect(loaders).toEqual([]);
    const config = fs.readFileSync(path.join(ROOT, "src/js/config.js"), "utf8");
    expect(config).not.toMatch(/axept\.io/);
    expect(config).toMatch(/from '\.\/cookie-consent\.js'/);
    expect(fs.readFileSync(path.join(ROOT, "vite.config.js"), "utf8")).not.toMatch(/axept/);
    expect(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8")).not.toMatch(/axept/);
  });

  test("la page Cookies propose « Modifier mes choix » et ne dit plus que naviguer vaut accord", () => {
    const html = fs.readFileSync(path.join(ROOT, "src/cookies.html"), "utf8");
    expect(html).toMatch(/data-action="openCookieChoices\(\)"/);
    expect(html).toMatch(/\/js\/cookie-consent\.js/);
    expect(html).not.toMatch(/vaut\s+acceptation/);
  });
});
