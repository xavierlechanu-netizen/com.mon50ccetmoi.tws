"use strict";

/** Erreur métier du stockage, indépendante de la base utilisée (mémoire ou PostgreSQL). */
class StoreError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code; // EMAIL_TAKEN | USERNAME_TAKEN | UNIT_EXISTS | OWNER_NOT_FOUND
    }
}

module.exports = { StoreError };
