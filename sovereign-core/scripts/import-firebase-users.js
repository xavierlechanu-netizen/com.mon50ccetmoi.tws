/**
 * Jour J : import des comptes Firebase Authentication dans PostgreSQL (VPS OVHcloud).
 *
 * 1. Sur le PC : npx firebase auth:export comptes.json --format=json --project mon50ccetmoi
 * 2. Copier comptes.json sur le VPS, puis (depuis sovereign-core/) :
 *      docker compose -f docker-compose.vps.yml exec -T sovereign-api \
 *        node scripts/import-firebase-users.js - < comptes.json            → simulation (rien n'est écrit)
 *      ... node scripts/import-firebase-users.js - --apply < comptes.json  → import réel
 * 3. Effacer comptes.json partout (il contient les empreintes des mots de passe).
 *
 * Les mots de passe ne sont jamais connus : seule leur empreinte Firebase est copiée. Elle est
 * vérifiée grâce aux paramètres FIREBASE_SCRYPT_* du .env, puis convertie au format du serveur à
 * la première connexion (voir server/crypto-auth.js).
 * Le script peut être relancé sans risque : un compte déjà importé (même email ou même identifiant
 * Firebase) est ignoré.
 */
"use strict";

const fs = require("fs");
const { firebaseStoredHash } = require("../server/crypto-auth");

const NO_PASSWORD = "!"; // aucune connexion possible tant qu'un mot de passe n'est pas défini

function baseUsername(u, email) {
    const fromName = String(u.displayName || "").normalize("NFC").replace(/\s+/g, " ").trim();
    const raw = fromName.length >= 2 ? fromName : email.split("@")[0];
    const cut = raw.slice(0, 60).trim();
    return cut.length >= 2 ? cut : "pilote";
}

/**
 * Prépare l'import (fonction pure, testée) : une ligne par compte à créer et le bilan.
 * @param {{users?: object[]}} exportData contenu de `firebase auth:export --format=json`
 * @param {{emails?: Set<string>, firebaseUids?: Set<string>, usernames?: Set<string>}} [existing]
 */
function planImport(exportData, existing = {}) {
    const emails = new Set(existing.emails || []);
    const firebaseUids = new Set(existing.firebaseUids || []);
    const usernames = new Set(existing.usernames || []);
    const report = { total: 0, toImport: 0, withPassword: 0, withoutPassword: 0,
        alreadyImported: 0, skippedNoEmail: [], skippedDisabled: [], skippedInvalid: [] };
    const rows = [];

    const users = exportData && Array.isArray(exportData.users) ? exportData.users : null;
    if (!users) throw new Error("Fichier inattendu : il faut l'export de « firebase auth:export --format=json ».");

    for (const u of users) {
        report.total++;
        const firebaseUid = String(u.localId || "");
        const email = String(u.email || "").trim().toLowerCase();
        if (!firebaseUid || firebaseUid.length > 128) { report.skippedInvalid.push(firebaseUid || "(sans identifiant)"); continue; }
        if (!email) { report.skippedNoEmail.push(firebaseUid); continue; }
        if (email.length > 255 || !email.includes("@")) { report.skippedInvalid.push(firebaseUid); continue; }
        if (u.disabled) { report.skippedDisabled.push(firebaseUid); continue; }
        if (emails.has(email) || firebaseUids.has(firebaseUid)) { report.alreadyImported++; continue; }

        let passwordHash = NO_PASSWORD;
        if (u.passwordHash && u.salt) {
            passwordHash = firebaseStoredHash(u.salt, u.passwordHash);
            report.withPassword++;
        } else {
            report.withoutPassword++; // connexion Google uniquement : devra choisir un mot de passe
        }

        const base = baseUsername(u, email);
        let username = base;
        for (let i = 2; usernames.has(username); i++) username = `${base}-${i}`;

        const createdMs = Number(u.createdAt);
        rows.push({
            firebaseUid,
            email,
            username,
            passwordHash,
            createdAt: Number.isFinite(createdMs) && createdMs > 0 ? new Date(createdMs).toISOString() : null
        });
        emails.add(email);
        firebaseUids.add(firebaseUid);
        usernames.add(username);
        report.toImport++;
    }
    return { rows, report };
}

/**
 * Import réel, en une seule transaction (tout ou rien).
 * @param {import("pg").Pool} pool
 * @param {object} exportData
 * @param {{apply?: boolean}} [opts] sans apply : simulation, la transaction est annulée
 */
async function importUsers(pool, exportData, { apply = false } = {}) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Personne ne crée de compte pendant l'import (noms et emails restent uniques).
        await client.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
        const { rows: current } = await client.query("SELECT email, username, firebase_uid FROM users");
        const plan = planImport(exportData, {
            emails: current.map((r) => r.email),
            usernames: current.map((r) => r.username),
            firebaseUids: current.filter((r) => r.firebase_uid).map((r) => r.firebase_uid)
        });
        for (const r of plan.rows) {
            await client.query(
                `INSERT INTO users (email, username, password_hash, firebase_uid, created_at)
                 VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))`,
                [r.email, r.username, r.passwordHash, r.firebaseUid, r.createdAt]
            );
        }
        await client.query(apply ? "COMMIT" : "ROLLBACK");
        return plan.report;
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

function printReport(report, apply) {
    const lines = [
        apply ? "IMPORT EFFECTUÉ" : "SIMULATION (rien n'a été écrit ; relancer avec --apply pour importer)",
        `  Comptes dans le fichier        : ${report.total}`,
        `  ${apply ? "Importés" : "À importer"}                     : ${report.toImport}`,
        `    dont avec mot de passe       : ${report.withPassword}`,
        `    dont connexion Google seule  : ${report.withoutPassword} (devront choisir un mot de passe)`,
        `  Déjà importés (ignorés)        : ${report.alreadyImported}`,
        `  Sans email (ignorés)           : ${report.skippedNoEmail.length}`,
        `  Désactivés (ignorés)           : ${report.skippedDisabled.length}`,
        `  Invalides (ignorés)            : ${report.skippedInvalid.length}`
    ];
    const ignored = [...report.skippedNoEmail, ...report.skippedDisabled, ...report.skippedInvalid];
    if (ignored.length) lines.push(`  Identifiants Firebase ignorés  : ${ignored.join(", ")}`);
    console.log(lines.join("\n"));
}

async function main(argv) {
    const args = argv.slice(2);
    const apply = args.includes("--apply");
    const file = args.find((a) => a !== "--apply");
    if (!file) {
        console.error("Usage : node scripts/import-firebase-users.js <comptes.json | -> [--apply]");
        process.exit(2);
    }
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL manquant : lancer le script dans le conteneur de l'API (voir l'en-tête).");
        process.exit(2);
    }
    const exportData = JSON.parse(fs.readFileSync(file === "-" ? 0 : file, "utf8"));
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
        printReport(await importUsers(pool, exportData, { apply }), apply);
        if (!process.env.FIREBASE_SCRYPT_SIGNER_KEY) {
            console.log("\nATTENTION : FIREBASE_SCRYPT_SIGNER_KEY absent du .env : les comptes importés ne pourront pas se connecter.");
        }
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main(process.argv).catch((e) => {
        console.error("Import interrompu, rien n'a été écrit :", e.message);
        process.exit(1);
    });
}

module.exports = { planImport, importUsers };
