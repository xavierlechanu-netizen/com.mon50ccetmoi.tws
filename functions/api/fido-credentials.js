/**
 * Clés d'accès (passkeys / FIDO2) : conversion entre SimpleWebAuthn (v11 et plus) et Firestore.
 *
 * Document users/{uid}/fido_credentials/{identifiant} :
 *   { credentialID: base64, credentialPublicKey: base64, counter: number }
 * Les champs sont inchangés depuis la v10, pour que les clés déjà enregistrées restent valables.
 *
 * Corrigé le 8/11/2026 :
 * - auth.js lisait encore registrationInfo.credentialID / credentialPublicKey et passait
 *   `authenticator` à verifyAuthenticationResponse : noms supprimés en v11. Enregistrer une clé
 *   d'accès plantait et la connexion par clé d'accès échouait toujours.
 * - L'identifiant du document était l'identifiant de la clé en base64, qui contient souvent « / »
 *   (environ une clé de 32 octets sur deux) : Firestore refuse ces identifiants. Les nouveaux
 *   documents utilisent le base64url (jamais de « / ») ; les anciens restent lus.
 */

const toBytes = (id) => Buffer.from(String(id), "base64url");

/** Identifiant du document pour une clé (identifiant envoyé par le navigateur, en base64url). */
function credentialDocId(responseId) {
  return toBytes(responseId).toString("base64url");
}

/**
 * Identifiants à essayer pour retrouver une clé : le format actuel, puis l'ancien (base64), qui
 * n'a pu être enregistré que s'il ne contenait pas « / ».
 */
function credentialDocIdsToTry(responseId) {
  const current = credentialDocId(responseId);
  const legacy = toBytes(responseId).toString("base64");
  return legacy !== current && !legacy.includes("/") ? [current, legacy] : [current];
}

/** registrationInfo renvoyé par verifyRegistrationResponse → { docId, data } à enregistrer. */
function storedCredentialFromRegistration(registrationInfo) {
  const credential = registrationInfo && registrationInfo.credential;
  if (!credential || !credential.id || !credential.publicKey) {
    throw new Error("Réponse d'enregistrement FIDO2 incomplète.");
  }
  return {
    docId: credentialDocId(credential.id),
    data: {
      credentialID: toBytes(credential.id).toString("base64"),
      credentialPublicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: Number(credential.counter) || 0,
    },
  };
}

/** Document Firestore → paramètre `credential` de verifyAuthenticationResponse. */
function credentialForVerification(stored) {
  return {
    id: Buffer.from(stored.credentialID, "base64").toString("base64url"),
    publicKey: new Uint8Array(Buffer.from(stored.credentialPublicKey, "base64")),
    counter: Number(stored.counter) || 0,
    transports: ["internal"],
  };
}

module.exports = {
  credentialDocId,
  credentialDocIdsToTry,
  storedCredentialFromRegistration,
  credentialForVerification,
};
