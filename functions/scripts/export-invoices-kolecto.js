/**
 * Export des factures à émettre vers un fichier CSV, pour les créer dans Kolecto.
 *
 * Usage (depuis le dossier functions, avec un accès administrateur au projet Firebase) :
 *   node scripts/export-invoices-kolecto.js            → crée factures-kolecto-AAAA-MM-JJ.csv
 *   node scripts/export-invoices-kolecto.js --marquer  → idem, puis marque les factures « EXPORTEE »
 *
 * Une fois l'accès à l'API Kolecto obtenu, ce script sera remplacé par un envoi automatique.
 */
"use strict";

const fs = require("fs");
const admin = require("firebase-admin");
const { invoicesToCsv } = require("../api/invoicing");

admin.initializeApp();
const db = admin.firestore();

(async () => {
    const snap = await db.collection("invoices_to_issue").where("status", "==", "A_EMETTRE").get();
    if (snap.empty) {
        console.log("Aucune facture à émettre.");
        return;
    }
    const invoices = snap.docs.map((d) => {
        const data = d.data();
        const paid = data.paid_at && data.paid_at.toDate ? data.paid_at.toDate() : null;
        return { ...data, paid_at: paid ? paid.toLocaleDateString("fr-FR") : "" };
    });
    const file = `factures-kolecto-${new Date().toISOString().slice(0, 10)}.csv`;
    fs.writeFileSync(file, "﻿" + invoicesToCsv(invoices), "utf8"); // BOM : accents corrects dans Excel
    console.log(`${invoices.length} facture(s) exportée(s) dans ${file}`);

    if (process.argv.includes("--marquer")) {
        const batch = db.batch();
        snap.docs.forEach((d) => batch.update(d.ref, { status: "EXPORTEE", exported_at: admin.firestore.FieldValue.serverTimestamp() }));
        await batch.commit();
        console.log("Factures marquées « EXPORTEE ».");
    }
})().catch((e) => {
    console.error("Export impossible :", e.message);
    process.exit(1);
});
