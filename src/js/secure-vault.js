/**
 * secure-vault.js — Chiffrement local des données sensibles (WebCrypto, aucune bibliothèque externe).
 *
 * - AES-GCM 256 bits, IV aléatoire de 96 bits à chaque chiffrement (authentifié : toute
 *   modification du texte chiffré est détectée).
 * - La clé est générée sur l'appareil, NON EXTRACTIBLE, et conservée dans IndexedDB :
 *   copier le localStorage ne suffit plus à lire les données, et aucun script ne peut
 *   exporter la clé (il peut seulement s'en servir tant que la page est ouverte).
 * - Une clé par usage (ex. "wallet") ; effacer la clé = effacer définitivement les données.
 *
 * Format stocké : "v3.<iv base64>.<données base64>"
 */

const DB_NAME = "mon50cc-vault";
const STORE = "keys";
const PREFIX = "v3.";

function b64(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function openDb(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const keyCache = new Map();

/** Clé AES-GCM non extractible propre à cet appareil et à cet usage (créée au premier appel). */
export async function getVaultKey(name, { idb = globalThis.indexedDB, subtle = globalThis.crypto.subtle } = {}) {
  if (keyCache.has(name)) return keyCache.get(name);
  const job = (async () => {
    const db = await openDb(idb);
    try {
      const existing = await idbRequest(db, "readonly", (s) => s.get(name));
      if (existing) return existing;
      const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await idbRequest(db, "readwrite", (s) => s.put(key, name));
      return key;
    } finally {
      db.close();
    }
  })();
  keyCache.set(name, job);
  job.catch(() => keyCache.delete(name));
  return job;
}

/** Supprime la clé : les données chiffrées avec elle deviennent définitivement illisibles. */
export async function destroyVaultKey(name, { idb = globalThis.indexedDB } = {}) {
  keyCache.delete(name);
  const db = await openDb(idb);
  try {
    await idbRequest(db, "readwrite", (s) => s.delete(name));
  } finally {
    db.close();
  }
}

export function isVaultCiphertext(value) {
  return typeof value === "string" && value.startsWith(PREFIX) && value.split(".").length === 3;
}

export async function encryptJSON(name, value, deps = {}) {
  const subtle = deps.subtle || globalThis.crypto.subtle;
  const key = await getVaultKey(name, deps);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return `${PREFIX}${b64(iv)}.${b64(ct)}`;
}

/** Déchiffre ; lève une erreur si la donnée a été modifiée ou si la clé a changé. */
export async function decryptJSON(name, payload, deps = {}) {
  if (!isVaultCiphertext(payload)) throw new Error("Format de coffre inconnu");
  const subtle = deps.subtle || globalThis.crypto.subtle;
  const [, ivB64, ctB64] = payload.split(".");
  const key = await getVaultKey(name, deps);
  const plain = await subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB64) }, key, unb64(ctB64));
  return JSON.parse(new TextDecoder().decode(plain));
}

if (typeof window !== "undefined") {
  window.SecureVault = { encryptJSON, decryptJSON, destroyVaultKey, isVaultCiphertext };
}
