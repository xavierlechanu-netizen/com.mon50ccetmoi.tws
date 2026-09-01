/**
 * Module de Sécurisation LocalStorage (Web Crypto API)
 * Protège contre la lecture en clair du profil utilisateur en cas de faille XSS simple.
 */

const ENCRYPTION_KEY_MATERIAL = "mon50cc_secure_session_key_v1";

async function getDerivedKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ENCRYPTION_KEY_MATERIAL),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("nexus_atlas_salt_2026"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Chiffre une valeur et la sauvegarde dans le localStorage
 */
window.secureSetItem = async function(key, value) {
  try {
    const cryptoKey = await getDerivedKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(value);

    const encryptedContent = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      encodedData
    );

    const encryptedBuffer = new Uint8Array(encryptedContent);
    const combined = new Uint8Array(iv.length + encryptedBuffer.length);
    combined.set(iv, 0);
    combined.set(encryptedBuffer, iv.length);

    // Convert to base64 for localStorage
    const base64String = btoa(String.fromCharCode.apply(null, combined));
    localStorage.setItem(key, base64String);
  } catch (error) {
    console.error("Erreur de chiffrement de session:", error);
    // Fallback en cas d'erreur de la Web Crypto API
    localStorage.setItem(key, btoa(value));
  }
};

/**
 * Récupère et déchiffre une valeur du localStorage
 */
window.secureGetItem = async function(key) {
  const item = localStorage.getItem(key);
  if (!item) return null;

  // Rétrocompatibilité : si l'item commence par '{', il n'est pas chiffré
  if (item.startsWith('{')) {
    return item;
  }

  try {
    const binaryString = atob(item);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    const cryptoKey = await getDerivedKey();

    const decryptedContent = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedContent);
  } catch (error) {
    console.warn("Erreur de déchiffrement, tentative fallback base64", error);
    try {
      return atob(item);
    } catch (fallbackError) {
      return null;
    }
  }
};
