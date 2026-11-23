/**
 * Jour J des points : reprise des soldes et des points gagnés de Firebase dans PostgreSQL (VPS).
 *
 * 1. Sur le PC : node functions/scripts/export-points-firestore.js <clé.json> > points.json
 * 2. Copier points.json sur le VPS, puis (depuis sovereign-core/) :
 *      docker compose -f docker-compose.vps.yml exec -T sovereign-api \
 *        node scripts/import-firebase-points.js - < points.json            → simulation (rien n'est écrit)
 *      ... node scripts/import-firebase-points.js - --apply < points.json  → import réel
 *
 * Les comptes doivent déjà être importés (scripts/import-firebase-users.js) : le lien se fait par
 * l'identifiant Firebase. Pour chaque pilote, le grand livre reçoit :
 *   - AWARD  « IMPORT_FIREBASE » : les points gagnés (ils comptent au classement, comme avant) ;
 *   - DEDUCT « IMPORT_FIREBASE » : ce qui avait été dépensé (gagnés − solde), s'il y en a ;
 *   - PURCHASE « IMPORT_FIREBASE » : ce que le solde a EN PLUS des points gagnés (points achetés ou
 *     donnés), hors classement comme avant.
 * Le solde final vaut le solde Firebase, ajouté à ce que le compte aurait déjà sur le serveur.
 * Relancer ne recompte rien : un compte déjà repris est ignoré (clé « import-firebase:points »).
 */
"use strict";

const fs = require("fs");

const EXPORT_FORMAT = "mon50cc-points-firebase-v1";
const MARKER = "import-firebase:points";
const REASON = "IMPORT_FIREBASE";

const entier = (v) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Prépare la reprise (fonction pure, testée).
 * @param {{format: string, users: {firebaseUid: string, balance: number, earned: number}[]}} exportData
 * @param {{uid: string, firebaseUid: string, braveCoins: number, imported: boolean}[]} accounts
 *   comptes du serveur qui ont un identifiant Firebase
 */
function planPointsImport(exportData, accounts = []) {
    if (!exportData || exportData.format !== EXPORT_FORMAT || !Array.isArray(exportData.users)) {
        throw new Error("Fichier inattendu : il faut points.json, fait par functions/scripts/export-points-firestore.js.");
    }
    const byFirebase = new Map(accounts.filter((a) => a.firebaseUid).map((a) => [a.firebaseUid, a]));
    const report = { total: 0, toImport: 0, alreadyImported: 0, unknown: [], pointsBalance: 0, pointsEarned: 0 };
    const plans = [];
    for (const u of exportData.users) {
        report.total++;
        const account = byFirebase.get(String(u.firebaseUid || ""));
        // Compte pas (encore) importé, ou effacé à la demande du pilote : rien à reprendre ici
        if (!account) { report.unknown.push(String(u.firebaseUid || "(sans identifiant)")); continue; }
        if (account.imported) { report.alreadyImported++; continue; }
        const balance = entier(u.balance);
        const earned = entier(u.earned);
        if (balance === 0 && earned === 0) continue;

        const start = entier(account.braveCoins);
        const entries = [];
        let running = start;
        const push = (action, delta, description, key) => {
            const before = running;
            running += delta;
            entries.push({ action, delta, amount: Math.abs(delta), before, after: running, description, key });
        };
        if (earned > 0) push("AWARD", earned, "Points gagnés sur l'ancienne plateforme (repris)", MARKER);
        if (earned > balance) {
            push("DEDUCT", balance - earned, "Points déjà dépensés sur l'ancienne plateforme (repris)", `${MARKER}:depenses`);
        } else if (balance > earned) {
            push("PURCHASE", balance - earned, "Solde hors classement de l'ancienne plateforme (repris)",
                earned > 0 ? `${MARKER}:hors-classement` : MARKER);
        }
        plans.push({ uid: account.uid, firebaseUid: account.firebaseUid, finalBalance: running, entries });
        report.toImport++;
        report.pointsBalance += balance;
        report.pointsEarned += earned;
    }
    return { plans, report };
}

/**
 * Reprise réelle, en une seule transaction (tout ou rien).
 * @param {import("pg").Pool} pool
 * @param {object} exportData
 * @param {{apply?: boolean}} [opts] sans apply : simulation, la transaction est annulée
 */
async function importPoints(pool, exportData, { apply = false } = {}) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Comptes verrouillés : aucun mouvement de points pendant la reprise
        const { rows } = await client.query(
            `SELECT u.uid, u.firebase_uid, u.brave_coins,
                    EXISTS (SELECT 1 FROM points_ledger l WHERE l.user_uid = u.uid AND l.idempotency_key = $1) AS imported
               FROM users u WHERE u.firebase_uid IS NOT NULL AND u.deleted_at IS NULL FOR UPDATE OF u`,
            [MARKER]
        );
        const { plans, report } = planPointsImport(exportData, rows.map((r) => ({
            uid: r.uid, firebaseUid: r.firebase_uid, braveCoins: r.brave_coins, imported: r.imported,
        })));
        for (const p of plans) {
            for (const e of p.entries) {
                // clock_timestamp() et non NOW() (heure du début de la transaction) : sinon les lignes d'un
                // même pilote ont la même heure, et l'historique les montre dans le désordre
                await client.query(
                    `INSERT INTO points_ledger (user_uid, action, reason, description, delta, amount, balance_before,
                                                balance_after, idempotency_key, metadata, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, clock_timestamp())`,
                    [p.uid, e.action, REASON, e.description, e.delta, e.amount, e.before, e.after, e.key,
                        JSON.stringify({ source: "firebase", firebaseUid: p.firebaseUid })]
                );
            }
            await client.query("UPDATE users SET brave_coins = $2, updated_at = NOW() WHERE uid = $1", [p.uid, p.finalBalance]);
        }
        await client.query(apply ? "COMMIT" : "ROLLBACK");
        return report;
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

function printReport(report, apply) {
    const lines = [
        apply ? "REPRISE DES POINTS EFFECTUÉE" : "SIMULATION (rien n'a été écrit ; relancer avec --apply pour reprendre les points)",
        `  Pilotes dans le fichier         : ${report.total}`,
        `  ${apply ? "Repris" : "À reprendre"}                     : ${report.toImport}`,
        `    soldes repris (total)         : ${report.pointsBalance} Pts`,
        `    points gagnés (classement)    : ${report.pointsEarned} Pts`,
        `  Déjà repris (ignorés)           : ${report.alreadyImported}`,
        `  Compte absent du serveur        : ${report.unknown.length}`,
    ];
    if (report.unknown.length) {
        lines.push("", "COMPTES ABSENTS DU SERVEUR : leurs points ne sont PAS repris.",
            "  Importer d'abord les comptes (scripts/import-firebase-users.js), puis relancer.",
            "  Un compte effacé à la demande du pilote reste absent : c'est normal.");
        for (const id of report.unknown) lines.push(`  - ${id}`);
    }
    console.log(lines.join("\n"));
}

async function main(argv) {
    const args = argv.slice(2);
    const apply = args.includes("--apply");
    const file = args.find((a) => a !== "--apply");
    if (!file) {
        console.error("Usage : node scripts/import-firebase-points.js <points.json | -> [--apply]");
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
        printReport(await importPoints(pool, exportData, { apply }), apply);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    main(process.argv).catch((e) => {
        console.error("Reprise interrompue, rien n'a été écrit :", e.message);
        process.exit(1);
    });
}

module.exports = { planPointsImport, importPoints, EXPORT_FORMAT, MARKER };
