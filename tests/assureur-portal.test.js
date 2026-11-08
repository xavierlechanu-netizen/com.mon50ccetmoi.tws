/**
 * Parcours complet du portail assureur (src/assureur.html + src/js/assureur.js), avec Firebase et
 * Revolut simulés : connexion, entreprise (SIREN), recherche du dossier, paiement, rapport scellé.
 * Point clé : le rapport ne s'affiche qu'une fois le paiement confirmé par le serveur.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../src");
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

const BODY = read("assureur.html")
  .match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<script[\s\S]*?<\/script>/g, "");

// Modules ESM (navigateur) : on retire imports et "export" pour les évaluer ici
const REPORTS = read("js/insurer-reports.js").replace(/^export (const|function) /gm, "$1 ");
const PORTAL = read("js/assureur.js").replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "");

const CODE = "LITIGE-AB2C-D3EF-GH4J-K5LM";
const USER = { uid: "insurer9", email: "expert@assureur.fr" };
const AXA = { registered: true, name: "ASSUREUR TEST SA", siren: "123456789" };

const $ = (id) => document.getElementById(id);
const visible = (id) => !$(id).hidden;
const flush = () => jest.advanceTimersByTimeAsync(0);

function setup({ profile = AXA, preview, sealed } = {}) {
  document.body.innerHTML = BODY;
  const actions = {};
  let authCallback = () => {};
  const server = { paid: false };

  const auth = {
    currentUser: null,
    onAuthStateChanged: (cb) => { authCallback = cb; },
    signInWithEmailAndPassword: jest.fn(async () => {
      auth.currentUser = USER;
      authCallback(USER);
    }),
    signOut: jest.fn(async () => {
      auth.currentUser = null;
      authCallback(null);
    }),
  };

  const permissionDenied = Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (name === "litigation_proposals") {
            // Règles Firestore : lisible seulement après paiement (unlocked_for)
            if (!server.paid || !sealed || id !== CODE) throw permissionDenied;
            return { exists: true, data: () => ({ ...sealed, unlocked_for: [USER.uid] }) };
          }
          const data = name === "litigation_previews" && id === CODE ? preview : undefined;
          return { exists: Boolean(data), data: () => data };
        },
      }),
    }),
  };

  const callables = {
    getInsurerProfile: jest.fn(async () => ({ data: profile })),
    registerInsurerProfile: jest.fn(async ({ siren }) => ({ data: { name: "ENTREPRISE VÉRIFIÉE", siren } })),
  };
  const firebase = { app: () => ({ functions: () => ({ httpsCallable: (n) => callables[n] }) }) };
  const authFetch = jest.fn(async () => ({ order_token: "tok_123", order_id: "ord_1" }));

  let popup = null;
  window.RevolutCheckout = jest.fn(async () => ({ payWithPopup: (opts) => { popup = opts; } }));
  window.confirm = jest.fn(() => true);

  new Function("db", "auth", "firebase", "registerAction", "authFetch", `${REPORTS}\n${PORTAL}`)(
    db, auth, firebase, (name, fn) => { actions[name] = fn; }, authFetch,
  );
  authCallback(null); // Firebase signale l'état de connexion au chargement

  return { actions, auth, callables, authFetch, server, popup: () => popup };
}

async function signIn(ctx) {
  $("insurer-email").value = USER.email;
  $("insurer-password").value = "mot-de-passe";
  await ctx.actions.authenticateInsurer();
  await flush();
}

async function search(ctx, code = CODE) {
  $("input-case-code").value = code;
  await ctx.actions.searchCase();
  await flush();
}

const PREVIEW = {
  caseCode: CODE,
  dateLabel: "07/11/2026 18:42",
  severityLabel: "Choc modéré",
  recommendedReport: "INTERMEDIAIRE",
  expiresAt: Date.now() + 3600 * 1000,
};
const SEALED = {
  caseCode: CODE,
  dateLabel: "07/11/2026 18:42",
  paid_tiers: { insurer9: "EXPERT" },
  telemetry: { maxG_force: 4.8, maxSpeed_kmh: 42.5, maxLeanAngle_deg: 31, gpsIncident: { lat: 48.85, lng: 2.35 } },
  ai: { severityScore: 55, reportLabel: "Rapport Impact" },
  evidence_sha256: "ab".repeat(32),
};

beforeEach(() => jest.useFakeTimers({ now: new Date("2026-11-08T10:00:00Z") }));
afterEach(() => jest.useRealTimers());

describe("Connexion", () => {
  test("déconnecté : seul l'écran de connexion est visible", () => {
    setup();
    expect(visible("login-screen")).toBe(true);
    expect(visible("portal-content")).toBe(false);
  });

  test("champs vides : message, aucune tentative de connexion", async () => {
    const ctx = setup();
    await ctx.actions.authenticateInsurer();
    expect(ctx.auth.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect($("login-status").textContent).toMatch(/email et votre mot de passe/);
  });

  test("identifiants refusés : message clair", async () => {
    const ctx = setup();
    ctx.auth.signInWithEmailAndPassword.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/invalid-credential" }));
    await signIn(ctx);
    expect($("login-status").textContent).toBe("Email ou mot de passe incorrect.");
    expect(visible("portal-content")).toBe(false);
  });

  test("connecté : portail et entreprise vérifiée affichés", async () => {
    const ctx = setup();
    await signIn(ctx);
    expect(ctx.auth.signInWithEmailAndPassword).toHaveBeenCalledWith(USER.email, "mot-de-passe");
    expect(visible("portal-content")).toBe(true);
    expect(visible("login-screen")).toBe(false);
    expect($("insurer-account").textContent).toBe(USER.email);
    expect($("company-name").textContent).toBe("ASSUREUR TEST SA (SIREN 123456789)");
    expect(visible("company-form")).toBe(false);
  });

  test("déconnexion : retour à l'écran de connexion", async () => {
    const ctx = setup({ preview: PREVIEW });
    await signIn(ctx);
    await search(ctx);
    await ctx.actions.logoutInsurer();
    expect(visible("login-screen")).toBe(true);
    expect(visible("case-preview")).toBe(false);
    expect($("input-case-code").value).toBe("");
  });
});

describe("Recherche du dossier", () => {
  test("code invalide", async () => {
    const ctx = setup({ preview: PREVIEW });
    await signIn(ctx);
    await search(ctx, "LIT-1234");
    expect($("search-status").textContent).toMatch(/Code invalide/);
    expect(visible("case-preview")).toBe(false);
  });

  test("dossier introuvable", async () => {
    const ctx = setup({ preview: PREVIEW });
    await signIn(ctx);
    await search(ctx, "LITIGE-ZZZZ-ZZZZ-ZZZZ-ZZZZ");
    expect($("search-status").textContent).toMatch(/introuvable/);
  });

  test("code expiré", async () => {
    const ctx = setup({ preview: { ...PREVIEW, expiresAt: Date.now() - 1 } });
    await signIn(ctx);
    await search(ctx);
    expect($("search-status").textContent).toMatch(/expiré/);
    expect(visible("case-preview")).toBe(false);
  });

  test("dossier trouvé : aperçu, trois offres HT/TTC, niveau conseillé présélectionné", async () => {
    const ctx = setup({ preview: PREVIEW });
    await signIn(ctx);
    await search(ctx, "litige-ab2c-d3ef-gh4j-k5lm");
    expect($("input-case-code").value).toBe(CODE);
    expect(visible("case-preview")).toBe(true);
    expect($("preview-severity").textContent).toBe("Choc modéré");
    expect($("preview-recommended").textContent).toBe("Rapport Approfondi");

    const cards = [...document.querySelectorAll("#report-options .report-card")];
    expect(cards.map((c) => c.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Rapport Standard49,99 € HT59,99 € TTC",
      "Rapport ApprofondiConseillé89,99 € HT107,99 € TTC",
      "Expertise complète199,99 € HT239,99 € TTC",
    ]);
    expect(document.querySelector(".report-card.selected").textContent).toMatch(/Approfondi/);
    expect($("btn-pay").textContent).toBe("Payer 107,99 € TTC avec Revolut");
    expect($("btn-pay").disabled).toBe(false);

    ctx.actions.selectReport("EXPERT");
    expect(document.querySelector(".report-card.selected").textContent).toMatch(/Expertise complète/);
    expect($("btn-pay").textContent).toBe("Payer 239,99 € TTC avec Revolut");
  });
});

describe("Entreprise (SIREN)", () => {
  test("sans entreprise vérifiée : paiement bloqué, puis débloqué après vérification", async () => {
    const ctx = setup({ profile: { registered: false }, preview: PREVIEW });
    await signIn(ctx);
    expect(visible("company-form")).toBe(true);
    await search(ctx);
    expect($("btn-pay").disabled).toBe(true);
    expect(visible("pay-needs-company")).toBe(true);

    $("company-siren").value = "12345";
    $("company-billing-email").value = "factures@assureur.fr";
    await ctx.actions.registerCompany();
    expect($("company-status").textContent).toMatch(/9 chiffres/);
    expect(ctx.callables.registerInsurerProfile).not.toHaveBeenCalled();

    $("company-siren").value = "123 456 789";
    await ctx.actions.registerCompany();
    await flush();
    expect(ctx.callables.registerInsurerProfile).toHaveBeenCalledWith({ siren: "123456789", billingEmail: "factures@assureur.fr" });
    expect(visible("company-form")).toBe(false);
    expect($("btn-pay").disabled).toBe(false);
  });
});

describe("Paiement et rapport", () => {
  test("le rapport ne s'affiche qu'après confirmation du serveur", async () => {
    const ctx = setup({ preview: PREVIEW, sealed: SEALED });
    await signIn(ctx);
    await search(ctx);
    ctx.actions.selectReport("EXPERT");

    await ctx.actions.payReport();
    await flush();
    expect(window.confirm.mock.calls[0][0]).toMatch(/199,99 € HT \+ TVA 20 % = 239,99 € TTC/);
    expect(window.confirm.mock.calls[0][0]).toMatch(/SIREN 123456789/);
    expect(ctx.authFetch).toHaveBeenCalledWith("createRevolutOrder", {
      method: "POST",
      body: { case_id: CODE, report_type: "EXPERT" },
    });
    expect(window.RevolutCheckout).toHaveBeenCalledWith("tok_123", "prod");
    expect($("btn-pay").disabled).toBe(true); // pas de double paiement

    // Revolut accepte, mais le serveur n'a pas encore reçu le webhook : rien n'est affiché
    ctx.popup().onSuccess();
    await jest.advanceTimersByTimeAsync(3000);
    expect(visible("report-view")).toBe(false);
    expect($("pay-status").textContent).toMatch(/Attente de la confirmation/);

    // Webhook reçu : le dossier devient lisible
    ctx.server.paid = true;
    await jest.advanceTimersByTimeAsync(3000);
    expect(visible("report-view")).toBe(true);
    expect(visible("case-preview")).toBe(false);
    const report = $("report-rows").textContent;
    expect(report).toMatch(/Expertise complète/);
    expect(report).toMatch(/4\.8 G/);
    expect(report).toContain("ab".repeat(32));
  });

  test("paiement refusé par l'utilisateur à la confirmation : aucune commande", async () => {
    const ctx = setup({ preview: PREVIEW });
    await signIn(ctx);
    await search(ctx);
    window.confirm.mockReturnValueOnce(false);
    await ctx.actions.payReport();
    expect(ctx.authFetch).not.toHaveBeenCalled();
  });

  test("paiement annulé dans Revolut : bouton réactivé, rien de débloqué", async () => {
    const ctx = setup({ preview: PREVIEW, sealed: SEALED });
    await signIn(ctx);
    await search(ctx);
    await ctx.actions.payReport();
    await flush();
    ctx.popup().onCancel();
    expect($("btn-pay").disabled).toBe(false);
    expect($("pay-status").textContent).toBe("Paiement annulé.");
    expect(visible("report-view")).toBe(false);
  });

  test("confirmation trop lente : message honnête, pas de faux succès", async () => {
    const ctx = setup({ preview: PREVIEW, sealed: SEALED });
    await signIn(ctx);
    await search(ctx);
    await ctx.actions.payReport();
    await flush();
    ctx.popup().onSuccess();
    await jest.advanceTimersByTimeAsync(20 * 3000);
    expect(visible("report-view")).toBe(false);
    expect($("pay-status").textContent).toMatch(/confirmation encore en attente/);
    expect($("btn-pay").disabled).toBe(false);
  });

  test("rapport déjà acheté : la recherche l'ouvre directement", async () => {
    const ctx = setup({ preview: PREVIEW, sealed: SEALED });
    ctx.server.paid = true;
    await signIn(ctx);
    await search(ctx);
    expect($("search-status").textContent).toMatch(/déjà acheté/);
    expect(visible("report-view")).toBe(true);
    expect(visible("case-preview")).toBe(false);
  });

  test("données piégées dans le dossier : affichées comme du texte", async () => {
    const ctx = setup({ preview: PREVIEW, sealed: { ...SEALED, dateLabel: '<img src=x onerror="alert(1)">' } });
    ctx.server.paid = true;
    await signIn(ctx);
    await search(ctx);
    expect($("report-rows").querySelector("img")).toBeNull();
    expect($("report-rows").textContent).toContain("<img src=x");
  });
});
