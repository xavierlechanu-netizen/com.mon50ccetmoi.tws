/**
 * @jest-environment node
 *
 * Profil repris de Firebase (23/11/2026) : dans l'export RGPD, effacé avec le compte.
 */
const { createMemoryStore } = require("../sovereign-core/server/store-memory");

const UID = "00000000-0000-4000-8000-0000000000c1";
const PROFIL = { brand: "Peugeot", model: "Kisbee", department: "43", ghostMode: true, registeredAt: "2026-01-02T03:04:05.000Z" };

test("profil : relu, exporté, puis effacé avec le compte", async () => {
  const store = createMemoryStore({ users: [{ uid: UID }] });
  expect(await store.getProfile(UID)).toBeNull();
  await store.saveProfile(UID, PROFIL);
  expect(await store.getProfile(UID)).toEqual(PROFIL);
  expect((await store.exportUserData(UID)).profile).toEqual(PROFIL);
  await store.anonymizeUser(UID);
  expect(await store.getProfile(UID)).toBeNull();
});
