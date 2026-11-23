/**
 * Jour J des points (sur le PC) : export des soldes et des points gagnés depuis Firestore.
 *
 *   node functions/scripts/export-points-firestore.js C:\chemin\cle-compte-de-service.json > points.json
 *
 * La clé du compte de service se crée dans la console Firebase › Paramètres du projet › Comptes de
 * service › « Générer une nouvelle clé privée ». Elle donne tous les droits sur le projet : la supprimer
 * du PC juste après, et la révoquer dans la console (sovereign-core/deploy/README.md, étape 14).
 *
 * N'exporte QUE des nombres, rangés par identifiant Firebase : solde (users/{uid}.braveCoins) et points
 * gagnés (leaderboard/{uid}.points, ce qui compte au classement). Aucun email, aucun pseudo.
 * Import sur le VPS : sovereign-core/scripts/import-firebase-points.js.
 */
"use strict";

const EXPORT_FORMAT = "mon50cc-points-firebase-v1";

/** Nombre entier ≥ 0 (les anciennes fiches ont parfois du texte ou rien). */
function entierPositif(v) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Fichier d'export (fonction pure, testée).
 * @param {{users: {id: string, data: object}[], leaderboard: {id: string, data: object}[]}} docs
 */
function buildPointsExport({ users = [], leaderboard = [] }, now = new Date()) {
    const earned = new Map(leaderboard.map((d) => [d.id, entierPositif(d.data && d.data.points)]));
    const rows = new Map();
    for (const d of users) {
        const data = d.data || {};
        // Même ordre que l'ancienne fonction transactPoints : braveCoins, puis bvc_points, puis points
        const balance = entierPositif(data.braveCoins !== undefined ? data.braveCoins
            : (data.bvc_points !== undefined ? data.bvc_points : data.points));
        rows.set(d.id, { firebaseUid: d.id, balance, earned: earned.get(d.id) || 0 });
    }
    // Points gagnés d'un compte sans fiche « users » (rare) : gardés, solde inconnu = 0
    for (const [id, e] of earned) if (!rows.has(id)) rows.set(id, { firebaseUid: id, balance: 0, earned: e });
    const list = [...rows.values()].filter((r) => r.balance > 0 || r.earned > 0)
        .sort((a, b) => a.firebaseUid.localeCompare(b.firebaseUid));
    return { format: EXPORT_FORMAT, generatedAt: now.toISOString(), users: list };
}

async function main(argv) {
    const keyPath = argv[2];
    if (!keyPath) {
        console.error("Usage : node functions/scripts/export-points-firestore.js <cle-compte-de-service.json> > points.json");
        process.exit(2);
    }
    // firebase-admin est installé dans functions/ (npm ci --prefix functions)
    const admin = require("firebase-admin");
    const path = require("path");
    admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyPath))) });
    const db = admin.firestore();
    // .select : seuls ces champs quittent Firestore
    const [usersSnap, leaderSnap] = await Promise.all([
        db.collection("users").select("braveCoins", "bvc_points", "points").get(),
        db.collection("leaderboard").select("points").get(),
    ]);
    const toDocs = (snap) => snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    const out = buildPointsExport({ users: toDocs(usersSnap), leaderboard: toDocs(leaderSnap) });
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    console.error(`${out.users.length} pilote(s) avec des points, sur ${usersSnap.size} fiche(s).`);
}

if (require.main === module) {
    main(process.argv).catch((e) => {
        console.error("Export interrompu :", e.message);
        process.exit(1);
    });
}

module.exports = { buildPointsExport, EXPORT_FORMAT };
