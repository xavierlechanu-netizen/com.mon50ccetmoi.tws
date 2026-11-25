/**
 * @jest-environment node
 *
 * Paiements Revolut sur le serveur souverain (18/11/2026) : sovereign-core/server/payments.js,
 * revolut-merchant.js, routes de server/index.js, et branchement de l'appli (src/js/api-client.js).
 *
 * Revolut est SIMULÉ (aucune carte, aucun compte) : on vérifie surtout que
 * - le prix vient du catalogue, jamais de la demande ;
 * - rien n'est livré sans que Revolut lui-même dise « payé », au bon montant ;
 * - une commande n'est livrée qu'une fois (webhook rejoué, suivi répété) ;
 * - les points achetés ne comptent pas au classement ; une facture est préparée.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createRevolutClient, revolutClientFromEnv, API_BASES } = require("../sovereign-core/server/revolut-merchant");
const { openProductsFromEnv, GARAGE_CHARTER_VERSION } = require("../sovereign-core/server/payments");
const { computeAmounts, getCatalogItem } = require("../functions/api/payments-catalog");

const WEBHOOK_SECRET = "wsk_test_secret_paiements";
const PILOTE = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const GARAGE_DEJA = "44444444-4444-4444-8444-444444444444";

const token = (uid, role = "user") => signSovereignJwt({ uid, role, username: uid.slice(0, 8) });

/** API Merchant de Revolut simulée (même forme de réponses que la vraie). */
function fakeRevolutApi() {
  const orders = new Map();
  const calls = [];
  let n = 0;
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method, headers: init.headers, body });
    const u = new URL(url);
    if (init.method === "POST" && u.pathname.endsWith("/orders")) {
      n += 1;
      const o = { id: `ord-${String(n).padStart(6, "0")}`, token: `tok_public_${n}`, state: "pending",
        amount: body.amount, currency: body.currency, metadata: body.metadata };
      orders.set(o.id, o);
      return reply(201, o);
    }
    const m = u.pathname.match(/\/orders\/([^/]+)$/);
    if (init.method === "GET" && m) {
      const o = orders.get(decodeURIComponent(m[1]));
      return o ? reply(200, o) : reply(404, { message: "Not found" });
    }
    return reply(404, {});
  };
  return {
    orders, calls, fetchImpl,
    setState(id, state, extra = {}) { Object.assign(orders.get(id), { state, ...extra }); },
  };
}

function setup({ open = ["GARAGE_FEE", "POINTS_100"], withRevolut = true, mode = "prod" } = {}) {
  const api = fakeRevolutApi();
  const store = createMemoryStore({
    users: [
      { uid: PILOTE, email: "pilote@mon50cc.internal", username: "Pilote" },
      { uid: AUTRE, email: "autre@mon50cc.internal", username: "Autre" },
      { uid: ADMIN, email: "admin@exemple.fr", username: "Admin", role: "admin" },
      { uid: GARAGE_DEJA, email: "garage@exemple.fr", username: "GarageDeja", isCertifiedGarage: true },
    ],
  });
  const revolut = withRevolut ? createRevolutClient({ secretKey: "sk_test_simule", mode, fetchImpl: api.fetchImpl }) : null;
  const app = createSovereignApp({ store, revolut, paymentsOpenProducts: open, revolutWebhookSecret: WEBHOOK_SECRET, smsClient: null });
  return { app, store, api };
}

function call(app, method, url, { body, auth, headers = {}, raw } = {}) {
  return new Promise((resolve, reject) => {
    const buf = raw !== undefined ? Buffer.from(raw) : body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
    const h = { ...headers };
    if (auth) h.authorization = `Bearer ${auth}`;
    const req = { method, url, headers: h, socket: { remoteAddress: "10.9.9.9" } };
    const resHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) { resHeaders[k.toLowerCase()] = v; },
      end(p) {
        const text = p ? String(p) : "";
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        resolve({ status: this.statusCode, headers: resHeaders, body: parsed });
      },
    };
    app.handleRequest(req, res, buf).catch(reject);
  });
}

/** Webhook signé comme Revolut : HMAC-SHA256 de « v1.<horodatage>.<corps> ». */
function webhook(app, event, { secret = WEBHOOK_SECRET } = {}) {
  const raw = JSON.stringify(event);
  const ts = String(Date.now());
  const sig = "v1=" + crypto.createHmac("sha256", secret).update(`v1.${ts}.${raw}`).digest("hex");
  return call(app, "POST", "/api/v1/webhooks/revolut", {
    raw, headers: { "revolut-signature": sig, "revolut-request-timestamp": ts },
  });
}

// Droit d'entrée garage : la charte des garages partenaires est acceptée (sauf si le test dit le contraire)
const order = (app, product, uid = PILOTE, extra = {}) =>
  call(app, "POST", "/api/v1/payments/orders", { auth: token(uid), body: {
    report_type: product, ...(product === "GARAGE_FEE" ? { charte: GARAGE_CHARTER_VERSION } : {}), ...extra } });
const status = (app, caseId, uid = PILOTE) =>
  call(app, "GET", `/api/v1/payments/orders?case_id=${encodeURIComponent(caseId)}`, { auth: token(uid) });

describe("Réglages", () => {
  test("produits ouverts : AUCUN par défaut, même avec la clé ; seulement ce que le serveur sait livrer", () => {
    expect(openProductsFromEnv({})).toEqual([]);
    expect(openProductsFromEnv({ PAYMENTS_OPEN_PRODUCTS: "GARAGE_FEE" })).toEqual(["GARAGE_FEE"]);
    expect(openProductsFromEnv({ PAYMENTS_OPEN_PRODUCTS: "GARAGE_FEE, POINTS_250,SIMPLE,BLACKBOX_CARE_MONTHLY,INCONNU" }))
      .toEqual(["GARAGE_FEE", "POINTS_250"]);
    expect(openProductsFromEnv({ PAYMENTS_OPEN_PRODUCTS: "" })).toEqual([]);
  });

  test("clé Revolut absente : pas de client ; REVOLUT_ENV=sandbox : serveur de test de Revolut", () => {
    expect(revolutClientFromEnv({})).toBeNull();
    expect(revolutClientFromEnv({ REVOLUT_SECRET_KEY: "sk_x" }).mode).toBe("prod");
    expect(revolutClientFromEnv({ REVOLUT_SECRET_KEY: "sk_x", REVOLUT_ENV: "sandbox" }).mode).toBe("sandbox");
  });

  test("clé Revolut en place mais aucun produit ouvert : rien ne se vend, Revolut n'est pas appelé", async () => {
    const { app, api } = setup({ open: [] });
    const r = await order(app, "GARAGE_FEE");
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/pas en vente/);
    expect(api.calls).toHaveLength(0);
  });

  test("compose du VPS : produits fermés si .env ne dit rien", () => {
    const compose = fs.readFileSync(path.join(__dirname, "..", "sovereign-core", "docker-compose.vps.yml"), "utf8");
    expect(compose).toMatch(/PAYMENTS_OPEN_PRODUCTS: \$\{PAYMENTS_OPEN_PRODUCTS:-\}/);
    expect(compose).toMatch(/REVOLUT_SECRET_KEY: \$\{REVOLUT_SECRET_KEY:-\}/);
  });

  test("sans clé Revolut, la commande répond « pas encore ouvert »", async () => {
    const { app } = setup({ withRevolut: false });
    const r = await order(app, "GARAGE_FEE");
    expect(r.status).toBe(503);
    expect(r.body.error).toMatch(/pas encore ouvert/);
  });
});

describe("Commande", () => {
  test("pilote connecté obligatoire", async () => {
    const { app, api } = setup();
    expect((await call(app, "POST", "/api/v1/payments/orders", { body: { report_type: "GARAGE_FEE" } })).status).toBe(401);
    // Jeton SOS ou de renouvellement : refusés aussi
    const sos = signSovereignJwt({ uid: PILOTE, purpose: "sos" });
    expect((await call(app, "POST", "/api/v1/payments/orders", { auth: sos, body: { report_type: "GARAGE_FEE" } })).status).toBe(401);
    expect(api.calls).toHaveLength(0);
  });

  test("le prix vient du catalogue, jamais de la demande ; Revolut reçoit la bonne requête", async () => {
    const { app, api } = setup();
    const r = await order(app, "GARAGE_FEE", PILOTE, { amount: 1, price_cents: 1, case_id: "GARAGE-1763480000000" });
    expect(r.status).toBe(200);
    const expected = computeAmounts(getCatalogItem("GARAGE_FEE")).ttc_cents;
    expect(expected).toBe(5000);
    expect(r.body).toMatchObject({ amount: 5000, currency: "EUR", status: "PENDING", case_id: "GARAGE-1763480000000",
      mode: "prod", order_token: "tok_public_1" });

    const [c] = api.calls;
    expect(c.url).toBe(`${API_BASES.prod}/orders`);
    expect(c.method).toBe("POST");
    expect(c.headers.Authorization).toBe("Bearer sk_test_simule");
    expect(c.headers["Revolut-Api-Version"]).toBeTruthy();
    expect(c.body).toMatchObject({ amount: 5000, currency: "EUR", capture_mode: "automatic",
      merchant_order_ext_ref: "GARAGE-1763480000000" });
    expect(c.body.metadata).toMatchObject({ user_uid: PILOTE, product: "GARAGE_FEE", charte: GARAGE_CHARTER_VERSION });
  });

  test("droit d'entrée garage : refusé sans la charte acceptée, version gardée avec la commande", async () => {
    const { app, store, api } = setup();
    for (const charte of [undefined, "2020-01-01"]) {
      const r = await order(app, "GARAGE_FEE", PILOTE, { charte });
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(/charte des garages partenaires/);
    }
    expect(api.calls).toHaveLength(0); // rien n'est demandé à Revolut
    const ok = await order(app, "GARAGE_FEE");
    expect(ok.status).toBe(200);
    expect((await store.findPaymentOrder(ok.body.order_id)).charterVersion).toBe(GARAGE_CHARTER_VERSION);
    // Les points ne demandent pas de charte
    expect((await order(app, "POINTS_100")).status).toBe(200);
  });

  test("la charte publiée et le tableau de bord du garage portent la même version que le serveur", () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8");
    const [y, m, d] = GARAGE_CHARTER_VERSION.split("-").map(Number);
    const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    expect(read("charte-garages.html")).toContain(`Version du <strong>${d} ${mois[m - 1]} ${y}</strong>`);
    expect(read("js/garage-dashboard.js")).toContain(`const CHARTE_GARAGES = "${GARAGE_CHARTER_VERSION}"`);
  });

  test("mode sandbox : l'appli ouvre la fenêtre de paiement de test", async () => {
    const { app, api } = setup({ mode: "sandbox" });
    const r = await order(app, "GARAGE_FEE");
    expect(r.body.mode).toBe("sandbox");
    expect(api.calls[0].url).toBe(`${API_BASES.sandbox}/orders`);
  });

  test("produit fermé, inconnu, ou que ce serveur ne sait pas livrer : refusé", async () => {
    const { app, api } = setup();
    for (const p of ["POINTS_600", "SIMPLE", "BLACKBOX_CARE_MONTHLY", "INCONNU", ""]) {
      const r = await order(app, p);
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(/pas en vente/);
    }
    expect(api.calls).toHaveLength(0);
  });

  test("double clic : la même commande en attente est reprise, Revolut n'est appelé qu'une fois", async () => {
    const { app, api } = setup();
    const a = await order(app, "GARAGE_FEE");
    const b = await order(app, "GARAGE_FEE");
    expect(b.body.order_id).toBe(a.body.order_id);
    expect(b.body.reused).toBe(true);
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  test("garage déjà certifié : pas de second paiement", async () => {
    const { app } = setup();
    const r = await order(app, "GARAGE_FEE", GARAGE_DEJA);
    expect(r.status).toBe(409);
  });

  test("référence de dossier déjà prise par un autre : une nouvelle est donnée", async () => {
    const { app } = setup();
    const a = await order(app, "GARAGE_FEE", PILOTE, { case_id: "GARAGE-1" });
    const b = await order(app, "POINTS_100", AUTRE, { case_id: "GARAGE-1" });
    expect(a.body.case_id).toBe("GARAGE-1");
    expect(b.status).toBe(200);
    expect(b.body.case_id).not.toBe("GARAGE-1");
  });

  test("Revolut en panne : message clair, rien d'enregistré", async () => {
    const store = createMemoryStore({ users: [{ uid: PILOTE }] });
    const revolut = createRevolutClient({ secretKey: "sk", fetchImpl: async () => { throw new TypeError("fetch failed"); } });
    const app = createSovereignApp({ store, revolut, paymentsOpenProducts: ["GARAGE_FEE"], smsClient: null });
    const r = await order(app, "GARAGE_FEE");
    expect(r.status).toBe(502);
    expect(await store.listPaymentOrders()).toEqual([]);
  });
});

describe("Paiement confirmé : livré une seule fois, et seulement si Revolut le confirme", () => {
  test("webhook mal signé : refusé, rien de livré", async () => {
    const { app, api, store } = setup();
    const o = await order(app, "GARAGE_FEE");
    api.setState(o.body.order_id, "completed");
    const r = await webhook(app, { event: "ORDER_COMPLETED", order_id: o.body.order_id }, { secret: "wsk_pirate" });
    expect(r.status).toBe(401);
    expect((await store.findUserById(PILOTE)).isCertifiedGarage).toBeFalsy();
  });

  test("webhook bien signé mais Revolut dit « en attente » : rien de livré", async () => {
    const { app, store } = setup();
    const o = await order(app, "GARAGE_FEE");
    const r = await webhook(app, { event: "ORDER_COMPLETED", order_id: o.body.order_id });
    expect(r.status).toBe(200);
    expect(r.body.state).toBe("PENDING");
    expect((await store.findPaymentOrder(o.body.order_id)).status).toBe("PENDING");
    expect((await store.findUserById(PILOTE)).isCertifiedGarage).toBeFalsy();
  });

  test("montant payé différent chez Revolut : rien de livré", async () => {
    const { app, api, store } = setup();
    const o = await order(app, "GARAGE_FEE");
    api.setState(o.body.order_id, "completed", { amount: 1 });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await webhook(app, { event: "ORDER_COMPLETED", order_id: o.body.order_id });
    spy.mockRestore();
    expect((await store.findPaymentOrder(o.body.order_id)).status).toBe("PENDING");
    expect((await status(app, o.body.case_id)).body.paid).toBe(false);
  });

  test("droit d'entrée garage payé : garage certifié sur le serveur, facture, journal ; webhook rejoué sans effet", async () => {
    const { app, api, store } = setup();
    const o = await order(app, "GARAGE_FEE");
    api.setState(o.body.order_id, "completed");
    const r = await webhook(app, { event: "ORDER_COMPLETED", order_id: o.body.order_id });
    expect(r.status).toBe(200);
    expect(r.body.state).toBe("COMPLETED");
    expect((await store.findUserById(PILOTE)).isCertifiedGarage).toBe(true);

    const s = await status(app, o.body.case_id);
    expect(s.body).toMatchObject({ paid: true, status: "COMPLETED", report_type: "GARAGE_FEE" });
    expect(s.body.garage_activation).toBeUndefined();

    const invoices = await store.listInvoicesToIssue();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].totals).toEqual({ ht_cents: 4167, vat_cents: 833, ttc_cents: 5000 });
    expect(invoices[0].buyer).toEqual({ type: "PARTICULIER", name: "Pilote", email: "" }); // adresse interne non reprise

    // Revolut renvoie le même événement : rien de plus
    const again = await webhook(app, { event: "ORDER_COMPLETED", order_id: o.body.order_id });
    expect(again.body.alreadyProcessed).toBe(true);
    expect(await store.listInvoicesToIssue()).toHaveLength(1);

    const actions = (await store.listAudit({ limit: 100 })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["payment.order_created", "payment.completed"]));
    expect(actions.filter((a) => a === "payment.completed")).toHaveLength(1);
  });

  test("pack de points : livré par le suivi même sans webhook ; une seule fois ; hors classement", async () => {
    const { app, api, store } = setup();
    const o = await order(app, "POINTS_100");
    expect(o.body.amount).toBe(299);
    expect((await status(app, o.body.case_id)).body).toMatchObject({ paid: false, status: "PENDING" });

    api.setState(o.body.order_id, "completed");
    await new Promise((r) => setTimeout(r, 0));
    // Le suivi relit Revolut au plus toutes les 5 s : on recrée le service pour ne pas attendre
    const app2 = createSovereignApp({ store, revolut: createRevolutClient({ secretKey: "sk", fetchImpl: api.fetchImpl }),
      paymentsOpenProducts: ["POINTS_100"], smsClient: null });
    const s = await status(app2, o.body.case_id);
    expect(s.body).toMatchObject({ paid: true, points_credited: 100, balance: 100 });
    expect((await status(app2, o.body.case_id)).body.balance).toBe(100); // pas de second crédit
    await webhook(app2, { event: "ORDER_COMPLETED", order_id: o.body.order_id });
    expect((await store.findUserById(PILOTE)).braveCoins).toBe(100);

    // Classement : seuls les points gagnés comptent
    expect(await store.topPilots(10)).toEqual([]);
    const ledger = (await store.exportUserData(PILOTE)).pointsLedger;
    expect(ledger).toEqual([expect.objectContaining({ action: "PURCHASE", reason: "POINTS_PURCHASE", delta: 100 })]);
  });

  test("paiement refusé chez Revolut : commande « FAILED », rien de livré", async () => {
    const { app, api, store } = setup();
    const o = await order(app, "GARAGE_FEE");
    api.setState(o.body.order_id, "failed");
    await webhook(app, { event: "ORDER_PAYMENT_DECLINED", order_id: o.body.order_id });
    expect((await store.findPaymentOrder(o.body.order_id)).status).toBe("FAILED");
    expect((await store.findUserById(PILOTE)).isCertifiedGarage).toBeFalsy();
  });

  test("webhook d'une commande inconnue (ex. ancienne Cloud Function) : acquitté sans rien faire", async () => {
    const { app, api } = setup();
    const r = await webhook(app, { event: "ORDER_COMPLETED", order_id: "ancienne-commande-123" });
    expect(r.status).toBe(200);
    expect(r.body.ignored).toBe(true);
    expect(api.calls).toHaveLength(0);
  });

  test("le suivi d'une commande est réservé à son acheteur", async () => {
    const { app } = setup();
    const o = await order(app, "GARAGE_FEE");
    expect((await status(app, o.body.case_id, AUTRE)).status).toBe(404);
    expect((await status(app, "INCONNU-1234")).status).toBe(404);
    expect((await status(app, "<script>")).status).toBe(400);
  });
});

describe("Administrateur et RGPD", () => {
  test("liste des commandes (avec ce qu'il reste à faire) et factures en CSV : administrateurs seulement", async () => {
    const { app, api } = setup();
    const o = await order(app, "GARAGE_FEE");
    api.setState(o.body.order_id, "completed");
    await webhook(app, { event: "ORDER_COMPLETED", order_id: o.body.order_id });

    expect((await call(app, "GET", "/api/v1/admin/payments", { auth: token(PILOTE) })).status).toBe(403);
    const list = await call(app, "GET", "/api/v1/admin/payments", { auth: token(ADMIN, "admin") });
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ configured: true, mode: "prod", openProducts: ["GARAGE_FEE", "POINTS_100"] });
    expect(list.body.orders[0]).toMatchObject({ status: "COMPLETED", username: "Pilote", product: "GARAGE_FEE" });const csv = await call(app, "GET", "/api/v1/admin/payments/invoices.csv", { auth: token(ADMIN, "admin") });
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.body).toContain("Droit d'entrée Garage Partenaire Certifié");
    expect(csv.body).toContain("50,00");
  });

  test("l'export RGPD du pilote contient ses paiements", async () => {
    const { app } = setup();
    await order(app, "GARAGE_FEE");
    const r = await call(app, "GET", "/api/v1/rgpd/account", { auth: token(PILOTE) });
    expect(r.body.payments).toEqual([expect.objectContaining({ product: "GARAGE_FEE", amountCents: 5000, status: "PENDING" })]);
  });
});

describe("Appli : les paiements suivent l'interrupteur (src/js/api-client.js)", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "js", "api-client.js"), "utf8")
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "");
  // eslint-disable-next-line no-new-func
  const { sovereignPaymentRequest } = new Function("window", `${code}; return { sovereignPaymentRequest };`)({});

  test("mêmes noms que les anciennes Cloud Functions, routes du serveur souverain", () => {
    expect(sovereignPaymentRequest("createRevolutOrder", { body: { case_id: "GARAGE-1", report_type: "GARAGE_FEE" } }))
      .toEqual({ method: "POST", endpoint: "/payments/orders", body: { case_id: "GARAGE-1", report_type: "GARAGE_FEE" } });
    expect(sovereignPaymentRequest("checkPaymentStatus", { query: { case_id: "A B&c" } }))
      .toEqual({ method: "GET", endpoint: "/payments/orders?case_id=A%20B%26c" });
    expect(sovereignPaymentRequest("deleteUserAccount", {})).toBeNull();
    expect(sovereignPaymentRequest("constructor", {})).toBeNull();
  });

  test("interrupteur des paiements sur le VPS depuis le 24/11/2026 (Cloud Functions coupées)", () => {
    const config = fs.readFileSync(path.join(__dirname, "..", "src", "js", "config.js"), "utf8");
    expect(config).toMatch(/paiements:\s*"SOVEREIGN"/);
  });

  test("la fenêtre Revolut s'ouvre dans l'environnement annoncé par le serveur (sandbox ou prod)", () => {
    for (const f of ["garage-dashboard.js", "assureur.js", "blackbox-shop.js", "insurance-portal.js"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", "src", "js", f), "utf8");
      expect(src).not.toMatch(/RevolutCheckout\([^)]*,\s*"prod"\)/);
    }
  });

  test("garage : un seul prix, 50 € TTC, et le montant affiché au paiement est celui de la commande", () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8");
    for (const f of ["garage.html", "garage-dashboard.html", "js/garage-pro.js", "js/garage-dashboard.js"]) {
      expect([f, /19[,.]99|49[,.]99|à vie|Pionnier/i.test(read(f))]).toEqual([f, false]);
    }
    expect(read("garage.html")).toMatch(/50,00 € <span class="price-unit">TTC/);
    const src = read("js/garage-dashboard.js");
    const fn = src.slice(src.indexOf("async function payGarageEntryFee"), src.indexOf("async function logoutGarage"));
    expect(fn).toMatch(/orderData\.amount/);
    expect(computeAmounts(getCatalogItem("GARAGE_FEE")).ttc_cents).toBe(5000);
  });
});
