/**
 * Régularisation des achats Boîte Noire payés avant le 7 novembre 2026.
 *
 * Avant cette date : le boîtier n'accordait pas l'année d'abonnement promise par les CGV,
 * et un abonnement payé (mensuel ou annuel) n'activait rien et était compté comme un
 * boîtier vendu. Ce script accorde à chaque client ce qu'il a payé, à partir de la date
 * d'achat, et corrige le compteur de boîtiers vendus.
 *
 * Usage (depuis le dossier functions, avec un accès administrateur au projet Firebase) :
 *   node scripts/regularize-blackbox-care.js              → affiche ce qui serait fait (n'écrit rien)
 *   node scripts/regularize-blackbox-care.js --appliquer  → applique
 *
 * Sans danger si on le relance : les commandes déjà régularisées sont ignorées.
 */
"use strict";

const admin = require("firebase-admin");
const { planRegularization } = require("../api/blackbox-subscription");

admin.initializeApp();
const db = admin.firestore();
const APPLY = process.argv.includes("--appliquer");
const BLACKBOX_TYPES = ["BLACKBOX_UNIT", "BLACKBOX_DUO", "BLACKBOX_PACK_SUB", "BLACKBOX_CARE_MONTHLY", "BLACKBOX_CARE_ANNUAL"];
const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

async function main() {
    // 1. Paiements Boîte Noire réussis
    const snap = await db.collection("revolut_orders").where("status", "==", "COMPLETED").get();
    const orders = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => BLACKBOX_TYPES.includes(o.report_type))
        .map((o) => ({
            orderId: o.id,
            userId: o.user_id,
            reportType: o.report_type,
            paidAtMs: toMs(o.completed_at) ?? toMs(o.created_at) ?? Date.now(),
            caseId: o.case_id,
        }));

    // 2. Commandes déjà traitées par la nouvelle version (careMonthsGranted renseigné)
    const already = new Set();
    for (const o of orders) {
        const sale = await db.collection("blackbox_sales").doc(o.orderId).get();
        if (sale.exists && sale.data().careMonthsGranted) already.add(o.orderId);
    }

    // 3. Abonnements actuels des clients concernés
    const currentEnds = {};
    for (const uid of new Set(orders.map((o) => o.userId).filter(Boolean))) {
        const u = await db.collection("users").doc(uid).get();
        currentEnds[uid] = u.exists ? toMs(u.data().blackboxCare?.ends_at) : null;
    }

    const plan = planRegularization(orders, already, currentEnds);
    console.log(`${orders.length} paiement(s) Boîte Noire, ${already.size} déjà traité(s), ${plan.orders.length} à régulariser.`);
    for (const p of plan.orders) {
        console.log(`  ${p.orderId}  ${p.reportType.padEnd(22)} client ${String(p.userId).slice(0, 6)}…  +${p.monthsGranted} mois → fin ${day(p.endsAtMs)}`);
    }
    console.log(`Compteur de boîtiers vendus à corriger : -${plan.boxesWronglyCounted}`);

    if (!APPLY) {
        console.log("\nAucune écriture (mode aperçu). Relancer avec --appliquer pour appliquer.");
        return;
    }

    const caseIds = Object.fromEntries(orders.map((o) => [o.orderId, o.caseId]));
    for (const p of plan.orders) {
        const fix = {
            type: p.saleType,
            quantity: p.hardwareUnits,
            careMonthsGranted: p.monthsGranted,
            careEndsAt: admin.firestore.Timestamp.fromMillis(p.endsAtMs),
            regularizedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const batch = db.batch();
        batch.set(db.collection("blackbox_sales").doc(p.orderId), fix, { merge: true });
        if (caseIds[p.orderId]) batch.set(db.collection("blackbox_sales").doc(caseIds[p.orderId]), fix, { merge: true });
        await batch.commit();
    }
    for (const [uid, u] of Object.entries(plan.users)) {
        await db.collection("users").doc(uid).set({
            blackboxCare: {
                status: u.endsAtMs > Date.now() ? "ACTIVE" : "EXPIRED",
                plan: u.plan,
                starts_at: admin.firestore.Timestamp.fromMillis(u.startsAtMs),
                ends_at: admin.firestore.Timestamp.fromMillis(u.endsAtMs),
                last_order_id: u.lastOrderId,
                regularized: true,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            },
        }, { merge: true });
    }
    if (plan.boxesWronglyCounted > 0) {
        await db.collection("stats").doc("blackbox_sales").set({
            count: admin.firestore.FieldValue.increment(-plan.boxesWronglyCounted),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    console.log(`\nAppliqué : ${plan.orders.length} commande(s), ${Object.keys(plan.users).length} client(s).`);
}

main().then(() => process.exit(0)).catch((e) => {
    console.error("Échec :", e.message);
    process.exit(1);
});
