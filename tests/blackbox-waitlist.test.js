/**
 * @jest-environment jsdom
 *
 * Liste d'attente de la Boîte Noire (le boîtier n'est pas encore fabriqué : pas de vente).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.resolve(__dirname, "../src/js/blackbox-waitlist.js");
const PAGE = path.resolve(__dirname, "../src/marketplace.html");
const RULES = path.resolve(__dirname, "../firestore.rules");

function loadModule() {
  const code = fs.readFileSync(SRC, "utf8").replace(/export\s+/g, "")
    + "\n;({ WAITLIST_EMAIL_RE, normalizeWaitlistEmail, buildWaitlistEntry, initBlackboxWaitlist })";
  return vm.runInNewContext(code, { document, console: { warn() {} }, String });
}

/** Monte le vrai bloc de la page (et pas une copie) pour tester ce qui est en ligne. */
function mountPageSection() {
  const html = fs.readFileSync(PAGE, "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const section = parsed.getElementById("blackbox-shop-section");
  document.body.replaceChildren(document.importNode(section, true));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Liste d'attente Boîte Noire", () => {
  let M;
  beforeEach(() => {
    mountPageSection();
    M = loadModule();
  });

  test("la page ne vend plus le boîtier : ni prix, ni stock, ni livraison promise", () => {
    const text = document.body.textContent;
    expect(text).not.toMatch(/€/);
    expect(text).not.toMatch(/en stock|Livraison|24\s*h|Commander/i);
    expect(document.querySelector("[data-action*='buyUnit'], [data-action*='buyPack']")).toBeNull();
    expect(text).toMatch(/six mois/);
  });

  test("normalise les adresses et refuse celles qui ne sont pas valables", () => {
    expect(M.normalizeWaitlistEmail("  Alice.Martin@Exemple.FR ")).toBe("alice.martin@exemple.fr");
    for (const bad of ["", "alice", "alice@", "@exemple.fr", "alice@exemple", "a b@exemple.fr", "a".repeat(250) + "@x.fr"]) {
      expect(M.normalizeWaitlistEmail(bad)).toBeNull();
    }
  });

  test("le motif du site est le même que celui des règles Firestore", () => {
    const rules = fs.readFileSync(RULES, "utf8");
    expect(rules).toContain("matches('^[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}$')");
    expect(M.WAITLIST_EMAIL_RE.source).toBe("^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$");
  });

  test("inscription : enregistre exactement les champs autorisés, puis confirme", async () => {
    const saved = [];
    expect(M.initBlackboxWaitlist(document, async (e) => saved.push(e), () => "HORODATAGE")).toBe(true);
    document.getElementById("bb-waitlist-email").value = " Bob@Exemple.fr ";
    document.getElementById("bb-waitlist-consent").checked = true;
    document.getElementById("bb-waitlist-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(saved).toEqual([{ email: "bob@exemple.fr", consent: true, source: "marketplace", createdAt: "HORODATAGE" }]);
    expect(document.getElementById("bb-waitlist-status").textContent).toMatch(/C'est noté/);
    expect(document.getElementById("bb-waitlist-email").value).toBe("");
  });

  test("rien n'est enregistré sans consentement ou avec une adresse invalide", async () => {
    const saved = [];
    M.initBlackboxWaitlist(document, async (e) => saved.push(e), () => 0);
    const form = document.getElementById("bb-waitlist-form");
    const status = document.getElementById("bb-waitlist-status");

    document.getElementById("bb-waitlist-email").value = "bob@exemple.fr";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(status.textContent).toMatch(/Cochez la case/);

    document.getElementById("bb-waitlist-consent").checked = true;
    document.getElementById("bb-waitlist-email").value = "pas-une-adresse";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(status.textContent).toMatch(/pas valable/);
    expect(saved).toHaveLength(0);
  });

  test("en cas d'échec, le dit honnêtement et garde l'adresse saisie", async () => {
    M.initBlackboxWaitlist(document, async () => { throw new Error("réseau"); }, () => 0);
    document.getElementById("bb-waitlist-email").value = "bob@exemple.fr";
    document.getElementById("bb-waitlist-consent").checked = true;
    document.getElementById("bb-waitlist-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(document.getElementById("bb-waitlist-status").textContent).toMatch(/n'a pas pu être enregistrée/);
    expect(document.getElementById("bb-waitlist-email").value).toBe("bob@exemple.fr");
    expect(document.getElementById("bb-waitlist-submit").disabled).toBe(false);
  });
});
