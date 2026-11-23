/**
 * @jest-environment node
 *
 * Badges personnels et trajets déclarés (23/11/2026) : lus par le seul pilote, jamais écrits par l'appli,
 * inclus dans l'export RGPD, effacés avec le compte.
 */
const fs = require("fs");
const path = require("path");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");

const A = "00000000-0000-4000-8000-0000000000f1";
const B = "00000000-0000-4000-8000-0000000000f2";
const BADGE = { code: "bruges-aurec-2025", emoji: "🛵", title: "Bruges–Aurec 2025",
  trip: { route: "Bruges → Reims → Aurec-sur-Loire", date: "Juillet 2025", distance: "850 km", duration: "48 h" } };

let app, baseUrl, store;
const token = (uid) => signSovereignJwt({ uid, role: "user", username: uid });
const call = async (method, uid, route = "/achievements") => {
  const r = await fetch(`${baseUrl}${route}`, { method, headers: uid ? { Authorization: `Bearer ${token(uid)}` } : {} });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeAll(async () => {
  store = createMemoryStore({ users: [{ uid: A }, { uid: B }] });
  app = createSovereignApp({ store, smsClient: null });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});
afterAll(() => new Promise((resolve) => app.server.close(resolve)));

describe("Badges et trajets déclarés", () => {
  test("seul le pilote voit les siens ; sans session : 401", async () => {
    expect(await store.grantAchievement({ uid: A, ...BADGE })).toBe(true);
    const mine = await call("GET", A);
    expect(mine.status).toBe(200);
    expect(mine.body.achievements).toEqual([expect.objectContaining({ ...BADGE, grantedAt: expect.any(String) })]);
    expect((await call("GET", B)).body.achievements).toEqual([]);
    expect((await call("GET", null)).status).toBe(401);
  });

  test("l'appli ne peut pas s'attribuer un badge", async () => {
    expect((await call("POST", B)).status).toBe(404);
    expect((await call("GET", B)).body.achievements).toEqual([]);
  });

  test("donner deux fois le même badge ne le double pas", async () => {
    expect(await store.grantAchievement({ uid: A, ...BADGE })).toBe(false);
    expect(await store.listAchievements(A)).toHaveLength(1);
  });

  test("dans l'export RGPD, puis effacé avec le compte", async () => {
    expect((await store.exportUserData(A)).achievements).toEqual([expect.objectContaining({ code: BADGE.code, trip: BADGE.trip })]);
    await store.anonymizeUser(A);
    expect(await store.listAchievements(A)).toEqual([]);
  });

  test("le tableau de bord affiche en texte seul et ne mêle pas ce trajet aux km mesurés", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/js/inline-dashboard-2.js"), "utf8");
    const part = src.slice(src.indexOf("function renderAchievements"), src.indexOf("// ─── Animate BVC Score Ring"));
    expect(part).toMatch(/textContent/);
    expect(part).not.toMatch(/innerHTML/);
    expect(part).not.toMatch(/stats|dataset\.count/);
  });
});
