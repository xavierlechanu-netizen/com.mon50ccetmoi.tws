/**
 * @jest-environment node
 *
 * Boutique des points (sovereign-core/server/shop.js, 25/11/2026) : thème Rose à 550 points, avec
 * 1 € versé à Ruban Rose par thème débloqué ; voix à 1000 points, pas encore en vente.
 * Le prix vient du serveur, un article ne se paie qu'une fois, l'appli ne peut pas imiter l'achat.
 */
const fs = require("fs");
const path = require("path");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { SHOP_ITEMS } = require("../sovereign-core/server/shop");

const RICHE = "11111111-1111-4111-8111-111111111111";
const PAUVRE = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

function setup() {
  const store = createMemoryStore({ users: [
    { uid: RICHE, username: "Riche", braveCoins: 2000 },
    { uid: PAUVRE, username: "Pauvre", braveCoins: 100 },
    { uid: ADMIN, username: "Admin", role: "admin" },
  ] });
  return { app: createSovereignApp({ store, smsClient: null }), store };
}

function call(app, method, url, { body, uid, role = "user" } = {}) {
  return new Promise((resolve, reject) => {
    const headers = uid ? { authorization: `Bearer ${signSovereignJwt({ uid, role, username: "x" })}` } : {};
    const req = { method, url, headers, socket: { remoteAddress: "10.9.9.9" } };
    const res = { statusCode: 200, setHeader() {}, end(p) { resolve({ status: this.statusCode, body: p ? JSON.parse(String(p)) : null }); } };
    app.handleRequest(req, res, body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0)).catch(reject);
  });
}

describe("Boutique des points", () => {
  test("prix : thème Rose 550 points (don de 1 € à Ruban Rose), voix 1000 points pas encore en vente", () => {
    expect(SHOP_ITEMS.THEME_PINK).toMatchObject({ price: 550, available: true, donation: { association: "Ruban Rose", euros: 1 } });
    expect(SHOP_ITEMS.VOICE_CYBERPUNK).toMatchObject({ price: 1000, available: false });
    expect(SHOP_ITEMS.VOICE_RALLYE).toMatchObject({ price: 1000, available: false });
  });

  test("achat du thème : 550 points retirés une seule fois, l'achat suit le compte", async () => {
    const { app, store } = setup();
    expect((await call(app, "POST", "/api/v1/shop/buy", { body: { item: "THEME_PINK" } })).status).toBe(401);
    const a = await call(app, "POST", "/api/v1/shop/buy", { uid: RICHE, body: { item: "THEME_PINK", price: 1 } });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ owned: true, alreadyOwned: false, balance: 1450 });
    const b = await call(app, "POST", "/api/v1/shop/buy", { uid: RICHE, body: { item: "THEME_PINK" } });
    expect(b.body).toMatchObject({ owned: true, alreadyOwned: true, balance: 1450 });
    expect((await store.findUserById(RICHE)).braveCoins).toBe(1450);
    const cat = await call(app, "GET", "/api/v1/shop", { uid: RICHE });
    expect(cat.body.items.find((i) => i.id === "THEME_PINK").owned).toBe(true);
  });

  test("solde insuffisant, article inconnu ou voix pas encore disponible : rien n'est retiré", async () => {
    const { app, store } = setup();
    expect((await call(app, "POST", "/api/v1/shop/buy", { uid: PAUVRE, body: { item: "THEME_PINK" } })).status).toBe(402);
    expect((await call(app, "POST", "/api/v1/shop/buy", { uid: RICHE, body: { item: "THEME_OR" } })).status).toBe(404);
    expect((await call(app, "POST", "/api/v1/shop/buy", { uid: RICHE, body: { item: "VOICE_RALLYE" } })).status).toBe(400);
    expect((await store.findUserById(PAUVRE)).braveCoins).toBe(100);
    expect((await store.findUserById(RICHE)).braveCoins).toBe(2000);
  });

  test("l'appli ne peut pas imiter un achat par /points/transact (thème pour 1 point)", async () => {
    const { app } = setup();
    const r = await call(app, "POST", "/api/v1/points/transact", { uid: RICHE,
      body: { action: "DEDUCT", reason: "SHOP_PURCHASE", amount: 1, idempotencyKey: "shop:THEME_PINK" } });
    expect(r.status).toBe(403);
    expect((await call(app, "GET", "/api/v1/shop", { uid: RICHE })).body.items.find((i) => i.id === "THEME_PINK").owned).toBe(false);
  });

  test("administrateur : total des dons dus à Ruban Rose", async () => {
    const { app } = setup();
    await call(app, "POST", "/api/v1/shop/buy", { uid: RICHE, body: { item: "THEME_PINK" } });
    const r = await call(app, "GET", "/api/v1/admin/payments", { uid: ADMIN, role: "admin" });
    expect(r.body.dons).toEqual([{ article: "THEME_PINK", association: "Ruban Rose", achats: 1, euros: 1 }]);
  });

  test("les écrans affichent les prix du serveur et le don", () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, "../src", f), "utf8");
    const dash = read("dashboard.html");
    expect(dash).toMatch(/550 points/);
    expect(dash).toMatch(/1 € reversé à l'association Ruban Rose/);
    expect(dash).not.toMatch(/Octobre Rose/);
    const shopPage = read("marketplace.html");
    expect((shopPage.match(/price-main">1 000 points/g) || []).length).toBe(2);
    // Règle : article avec don à une association = 550 points
    for (const it of Object.values(SHOP_ITEMS)) if (it.donation) expect(it.price).toBe(550);
    expect(read("js/dashboard-extras.js")).toMatch(/item: "THEME_PINK"/);
  });
});
