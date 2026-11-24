/**
 * @jest-environment node
 *
 * Profil du pilote sur le serveur souverain (24/11/2026) : lu et corrigé par le seul pilote,
 * champs vérifiés, date d'inscription (offre Fondateur) jamais modifiable depuis l'appli.
 */
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");

const A = "00000000-0000-4000-8000-0000000000d1";
const B = "00000000-0000-4000-8000-0000000000d2";
let app, baseUrl, store;
const call = async (method, uid, body) => {
  const headers = { "Content-Type": "application/json" };
  if (uid) headers.Authorization = `Bearer ${signSovereignJwt({ uid, role: "user", username: uid })}`;
  const r = await fetch(`${baseUrl}/profile`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeAll(async () => {
  store = createMemoryStore({ users: [{ uid: A }, { uid: B }] });
  app = createSovereignApp({ store, smsClient: null });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});
afterAll(() => new Promise((resolve) => app.server.close(resolve)));

test("lu et corrigé par le seul pilote, sans toucher à la date d'inscription", async () => {
  await store.saveProfile(A, { brand: "Peugeot", model: "Kisbee", department: "43", ghostMode: false, registeredAt: "2026-01-02T03:04:05.000Z" });
  expect((await call("GET", null)).status).toBe(401);
  expect((await call("GET", B)).body.profile).toEqual(expect.objectContaining({ brand: null, ghostMode: false }));
  const r = await call("PATCH", A, { model: " Tweet ", ghostMode: true, department: "2A" });
  expect(r.status).toBe(200);
  expect(await store.getProfile(A)).toEqual({ brand: "Peugeot", model: "Tweet", department: "2A", ghostMode: true, registeredAt: "2026-01-02T03:04:05.000Z" });
  expect(await store.getProfile(B)).toBeNull();
});

test.each([
  [{ registeredAt: "2020-01-01T00:00:00.000Z" }],
  [{ brand: "<img src=x>" }],
  [{ model: "x".repeat(61) }],
  [{ department: "Inconnu" }],
  [{ ghostMode: "oui" }],
  [{}],
  [[1]],
])("refusé : %j", async (body) => {
  expect((await call("PATCH", A, body)).status).toBe(400);
  expect((await store.getProfile(A)).registeredAt).toBe("2026-01-02T03:04:05.000Z");
});

