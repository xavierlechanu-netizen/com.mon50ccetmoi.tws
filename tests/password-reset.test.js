/**
 * @jest-environment node
 *
 * Mot de passe oublié (23/11/2026) : lien à usage unique, 1 heure, règle des nouveaux mots de passe,
 * anciennes sessions coupées, anciens mots de passe toujours acceptés à la connexion.
 */
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { hashPassword } = require("../sovereign-core/server/crypto-auth");
const { createResetLink, newPasswordError } = require("../sovereign-core/server/password-reset");

const UID = "00000000-0000-4000-8000-0000000000a1";
const BANNED = "00000000-0000-4000-8000-0000000000a2";
const EMAIL = "pilote@mon50cc.internal";
const OLD = "ancien12"; // trop simple pour la nouvelle règle : doit rester accepté à la connexion
const NEW = "Abcdefgh!?";

let app, baseUrl, store;
const post = async (route, body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${baseUrl}${route}`, { method: "POST", headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const tokenOf = (link) => link.url.split("#token=")[1];

beforeAll(async () => {
  store = createMemoryStore({ users: [
    { uid: UID, email: EMAIL, username: "Pilote", passwordHash: hashPassword(OLD) },
    { uid: BANNED, email: "banni@mon50cc.internal", username: "Banni", passwordHash: "!", isBanned: true },
  ] });
  app = createSovereignApp({ store, smsClient: null, authMaxAttempts: 100 });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});
afterAll(() => new Promise((resolve) => app.server.close(resolve)));

describe("Règle des nouveaux mots de passe", () => {
  test.each([
    ["Abcdefgh!?", true],
    ["Aéèàùîôç!?", true], // les accents comptent comme des minuscules
    ["abcdefgh!?", false], // pas de majuscule
    ["Abcdefg!?", false], // 6 minuscules
    ["Abcdefgh!", false], // 1 caractère spécial
    ["Abcdefgh1 ", false], // ni chiffre ni espace ne comptent comme spéciaux
    [`A${"b".repeat(260)}!?`, false], // au-delà de la limite du hachage
    [null, false],
  ])("%s", (password, ok) => {
    expect(newPasswordError(password) === null).toBe(ok);
  });
});

describe("Lien de mot de passe oublié", () => {
  test("compte inconnu ou banni : pas de lien", async () => {
    expect(await createResetLink(store, "personne")).toBeNull();
    expect(await createResetLink(store, "Banni")).toBeNull();
    expect(await createResetLink(store, "")).toBeNull();
  });

  test("un mot de passe refusé ne fait pas perdre le lien ; il sert ensuite une seule fois", async () => {
    const token = tokenOf(await createResetLink(store, "PILOTE"));
    expect((await post("/auth/reset-password", { token, password: "trop simple" })).status).toBe(400);
    expect((await post("/auth/reset-password", { token, password: NEW })).status).toBe(200);
    expect((await post("/auth/reset-password", { token, password: "Zyxwvuts!?" })).status).toBe(400);
    expect((await post("/auth/login", { email: EMAIL, password: NEW })).status).toBe(200);
    expect((await post("/auth/login", { email: EMAIL, password: OLD })).status).toBe(401);
  });

  test("un nouveau lien annule le précédent ; un lien expiré ou inventé est refusé", async () => {
    const first = tokenOf(await createResetLink(store, EMAIL));
    const second = tokenOf(await createResetLink(store, EMAIL));
    expect((await post("/auth/reset-password", { token: first, password: NEW })).status).toBe(400);
    expect((await post("/auth/reset-password", { token: "f".repeat(64), password: NEW })).status).toBe(400);
    expect((await post("/auth/reset-password", { token: { $ne: 1 }, password: NEW })).status).toBe(400);
    expect(second).not.toBe(first);
    const expired = tokenOf(await createResetLink(store, EMAIL, Date.now() - 2 * 3600 * 1000));
    expect((await post("/auth/reset-password", { token: expired, password: NEW })).status).toBe(400);
  });

  test("les anciennes sessions ne se renouvellent plus, une nouvelle connexion oui", async () => {
    const before = (await post("/auth/login", { email: EMAIL, password: NEW })).body;
    await new Promise((resolve) => setTimeout(resolve, 1100)); // les jetons sont datés à la seconde
    const token = tokenOf(await createResetLink(store, EMAIL));
    expect((await post("/auth/reset-password", { token, password: "Nouveauxx!?" })).status).toBe(200);
    expect((await post("/auth/refresh", {}, before.refreshToken)).status).toBe(401);
    expect((await post("/auth/sos-token", {}, before.sosToken)).status).toBe(401);
    const after = (await post("/auth/login", { email: EMAIL, password: "Nouveauxx!?" })).body;
    expect((await post("/auth/refresh", {}, after.refreshToken)).status).toBe(200);
  });
});
