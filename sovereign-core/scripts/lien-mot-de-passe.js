/**
 * Mot de passe oublié : crée le lien à usage unique d'un pilote (valable 1 heure).
 *
 *   sudo docker compose -f docker-compose.vps.yml exec -T sovereign-api node scripts/lien-mot-de-passe.js PSEUDO
 *
 * Ce lien donne accès au compte : vérifier d'abord que la demande vient bien du pilote.
 */
"use strict";

const { Pool } = require("pg");
const { createPgStore } = require("../server/store-pg");
const { createResetLink } = require("../server/password-reset");
const { AUDIT_ACTIONS } = require("../server/audit-log");

(async () => {
    const identifier = process.argv[2];
    if (!identifier) {
        console.error("Usage : node scripts/lien-mot-de-passe.js <pseudo ou e-mail>");
        process.exit(2);
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const store = createPgStore({ pool });
        const link = await createResetLink(store, identifier);
        if (!link) {
            console.error("Aucun compte actif avec ce pseudo ou cet e-mail.");
            process.exitCode = 1;
            return;
        }
        await store.appendAudit({ action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_LINK, actorRole: "admin", targetType: "user", targetId: link.uid });
        console.log(`Pilote : ${link.username}\nValable jusqu'à : ${link.expiresAt} (UTC)\n${link.url}`);
    } finally {
        await pool.end();
    }
})().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
