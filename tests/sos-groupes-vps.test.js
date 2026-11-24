/**
 * @jest-environment node
 *
 * SOS communautaire et groupes de balade (cortège, convoi) sur le serveur souverain (24/11/2026) :
 * en mémoire seulement (live.js), réservés aux pilotes connectés.
 */
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createLive } = require("../sovereign-core/server/live");

const A = "00000000-0000-4000-8000-0000000000e1";
const B = "00000000-0000-4000-8000-0000000000e2";
const C = "00000000-0000-4000-8000-0000000000e3";
const PUY = { lat: 45.043, lng: 3.885 };
const LYON = { lat: 45.764, lng: 4.835 };
let app, baseUrl, clock;

const call = async (method, path, uid, body) => {
  const headers = { "Content-Type": "application/json" };
  if (uid) headers.Authorization = `Bearer ${signSovereignJwt({ uid, role: "user", username: uid })}`;
  const r = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeAll(async () => {
  clock = { t: Date.UTC(2026, 10, 24, 12) };
  const store = createMemoryStore({ users: [{ uid: A }, { uid: B }, { uid: C }] });
  app = createSovereignApp({ store, smsClient: null, live: createLive({ now: () => clock.t }) });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});
afterAll(() => new Promise((resolve) => app.server.close(resolve)));

test("SOS : lancé, vu à 10 km seulement, aide annoncée, clos par son auteur", async () => {
  expect((await call("POST", "/sos-communaute", null, { type: "Crevaison", ...PUY })).status).toBe(401);
  expect((await call("POST", "/sos-communaute", A, { type: "<script>", ...PUY })).status).toBe(400);

  const sos = await call("POST", "/sos-communaute", A, { type: "Crevaison", ...PUY });
  expect(sos.status).toBe(201);
  expect((await call("POST", "/sos-communaute", A, { type: "Crevaison", ...PUY })).status).toBe(429);

  const proche = await call("GET", `/sos-communaute?lat=${PUY.lat + 0.02}&lng=${PUY.lng}`, B);
  expect(proche.body.alerts).toEqual([expect.objectContaining({ id: sos.body.id, type: "Crevaison", author: A, mine: false })]);
  expect(proche.body.alerts[0].helpers).toBeUndefined();
  expect((await call("GET", `/sos-communaute?lat=${LYON.lat}&lng=${LYON.lng}`, C)).body.alerts).toEqual([]);

  expect((await call("POST", `/sos-communaute/${sos.body.id}/aide`, B)).status).toBe(200);
  expect((await call("POST", `/sos-communaute/${sos.body.id}/aide`, A)).status).toBe(404); // pas soi-même
  const mienne = await call("GET", `/sos-communaute?lat=${LYON.lat}&lng=${LYON.lng}`, A);
  expect(mienne.body.alerts[0]).toMatchObject({ mine: true, helpers: [B] });

  expect((await call("POST", `/sos-communaute/${sos.body.id}/fin`, B)).status).toBe(404); // pas l'auteur
  expect((await call("POST", `/sos-communaute/${sos.body.id}/fin`, A)).status).toBe(200);
  expect((await call("GET", `/sos-communaute?lat=${PUY.lat}&lng=${PUY.lng}`, B)).body.alerts).toEqual([]);
});

test("SOS : s'éteint seul au bout d'une heure", async () => {
  const sos = await call("POST", "/sos-communaute", C, { type: "Panne d'essence", ...LYON });
  expect(sos.status).toBe(201);
  clock.t += 61 * 60 * 1000;
  expect((await call("GET", `/sos-communaute?lat=${LYON.lat}&lng=${LYON.lng}`, B)).body.alerts).toEqual([]);
});

test("groupe : créé, rejoint en envoyant sa position, signaux de la liste seulement, quitté", async () => {
  const g = await call("POST", "/groupes", A);
  expect(g.status).toBe(201);
  expect(g.body.code).toMatch(/^[A-Z2-9]{4}$/);
  const url = `/groupes/${g.body.code}`;

  expect((await call("POST", "/groupes/ZZZZ", A, PUY)).status).toBe(404);
  expect((await call("POST", url, B, { ...PUY, signal: "constructor" })).status).toBe(400);
  expect((await call("POST", url, A, PUY)).body.members).toHaveLength(1);
  const r = await call("POST", url, B, { ...PUY, signal: "Besoin d'essence" });
  expect(r.body.members).toEqual(expect.arrayContaining([
    expect.objectContaining({ uid: B, signal: expect.objectContaining({ icon: "⛽", text: "Besoin d'essence" }) }),
    expect.objectContaining({ uid: A, signal: null }),
  ]));

  // Sans position depuis plus de 2 minutes : plus affiché
  clock.t += 3 * 60 * 1000;
  expect((await call("POST", url, A, PUY)).body.members.map((m) => m.uid)).toEqual([A]);

  expect((await call("DELETE", url, B)).status).toBe(200);
  clock.t += 13 * 60 * 60 * 1000; // groupe terminé au bout de 12 h
  expect((await call("POST", url, A, PUY)).status).toBe(404);
});

test("groupe : 20 pilotes au plus", () => {
  const live = createLive();
  const code = live.createGroup();
  for (let i = 0; i < 20; i++) expect(live.updateMember({ code, uid: `u${i}`, name: "p", ...PUY }).members).toBeDefined();
  expect(live.updateMember({ code, uid: "u20", name: "p", ...PUY })).toEqual({ error: "complet" });
  expect(live.updateMember({ code, uid: "u3", name: "p", ...PUY }).members).toHaveLength(20); // un membre déjà là continue
});
