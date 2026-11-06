/**
 * @jest-environment node
 *
 * Phase 2 (audit 2026-11, C3) : coffre local chiffré AES-GCM avec clé non extractible.
 */
const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");

function loadVault() {
  const src = fs.readFileSync(path.resolve(__dirname, "../src/js/secure-vault.js"), "utf8")
    .replace(/^export (const|function|async function) /gm, "$1 ");
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn { getVaultKey, destroyVaultKey, encryptJSON, decryptJSON, isVaultCiphertext };`)();
}

/** IndexedDB minimal en mémoire (une base, un magasin) pour Node. */
function memoryIdb() {
  const data = new Map();
  const req = (fn) => {
    const r = {};
    setTimeout(() => { try { r.result = fn(); r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } });
    return r;
  };
  const db = {
    transaction: () => ({ objectStore: () => ({
      get: (k) => req(() => data.get(k)),
      put: (v, k) => req(() => { data.set(k, v); }),
      delete: (k) => req(() => { data.delete(k); }),
    }) }),
    close() {},
  };
  return { data, open: () => req(() => db) };
}

describe("SecureVault (WebCrypto)", () => {
  let V;
  let deps;

  beforeAll(() => {
    if (!globalThis.crypto) globalThis.crypto = webcrypto;
    if (typeof globalThis.btoa === "undefined") {
      globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
      globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
    }
  });

  beforeEach(() => {
    V = loadVault(); // cache de clés neuf à chaque test
    deps = { idb: memoryIdb(), subtle: webcrypto.subtle };
  });

  test("aller-retour : les documents reviennent identiques, le texte chiffré ne les contient pas", async () => {
    const docs = { permis_am: { data: "AM-123456", date: "2026-11-06" } };
    const enc = await V.encryptJSON("wallet", docs, deps);
    expect(V.isVaultCiphertext(enc)).toBe(true);
    expect(enc).not.toContain("AM-123456");
    expect(await V.decryptJSON("wallet", enc, deps)).toEqual(docs);
  });

  test("la clé n'est pas exportable et ne dépend d'aucune donnée du localStorage", async () => {
    const key = await V.getVaultKey("wallet", deps);
    expect(key.extractable).toBe(false);
    await expect(webcrypto.subtle.exportKey("raw", key)).rejects.toThrow();
    expect(deps.idb.data.get("wallet")).toBe(key);
  });

  test("deux chiffrements du même contenu diffèrent (IV aléatoire)", async () => {
    const a = await V.encryptJSON("wallet", { x: 1 }, deps);
    const b = await V.encryptJSON("wallet", { x: 1 }, deps);
    expect(a).not.toBe(b);
  });

  test("une donnée modifiée est rejetée (AES-GCM authentifié)", async () => {
    const enc = await V.encryptJSON("wallet", { solde: 10 }, deps);
    const [p, iv, ct] = enc.split(".");
    const bytes = Buffer.from(ct, "base64");
    bytes[0] ^= 0xff;
    const tampered = `${p}.${iv}.${bytes.toString("base64")}`;
    await expect(V.decryptJSON("wallet", tampered, deps)).rejects.toThrow();
  });

  test("sur un autre appareil (autre clé), les données volées sont illisibles", async () => {
    const enc = await V.encryptJSON("wallet", { secret: true }, deps);
    const V2 = loadVault();
    const otherDevice = { idb: memoryIdb(), subtle: webcrypto.subtle };
    await expect(V2.decryptJSON("wallet", enc, otherDevice)).rejects.toThrow();
  });

  test("détruire la clé rend les données définitivement illisibles", async () => {
    const enc = await V.encryptJSON("wallet", { a: 1 }, deps);
    await V.destroyVaultKey("wallet", deps);
    await expect(V.decryptJSON("wallet", enc, deps)).rejects.toThrow();
  });

  test("l'ancien format CryptoJS n'est pas pris pour un coffre v3", () => {
    expect(V.isVaultCiphertext("U2FsdGVkX19abc")).toBe(false);
  });
});
