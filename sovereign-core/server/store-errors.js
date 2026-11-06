"use strict";

/** Erreur métier du stockage, indépendante de la base utilisée (mémoire ou PostgreSQL). */
class StoreError extends Error {
    constructor(code, message) {
        super(message);
        // EMAIL_TAKEN | USERNAME_TAKEN | UNIT_EXISTS | OWNER_NOT_FOUND | USER_NOT_FOUND | BANNED
        // | PROOF_FAILED | CAP_REACHED | INSUFFICIENT_FUNDS
        this.code = code;
    }
}

module.exports = { StoreError };
