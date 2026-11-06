/**
 * invoicing.js — Factures à émettre dans Kolecto (plateforme de facturation agréée DGFiP).
 *
 * Après chaque paiement confirmé, le serveur prépare une « facture à émettre » complète
 * (acheteur, lignes HT / TVA / TTC). Tant que l'accès à l'API Kolecto n'est pas ouvert,
 * ces factures sont exportées en CSV (functions/scripts/export-invoices-kolecto.js) puis
 * créées dans Kolecto, qui attribue le numéro officiel et transmet la facture électronique.
 */
"use strict";

const { computeAmounts } = require("./payments-catalog");

/**
 * @param {object} order   commande Revolut (revolut_orders)
 * @param {object} item    article du catalogue
 * @param {object} buyer   { type: "ENTREPRISE", name, siren, vatNumber, address, postalCode, city, email }
 *                         ou { type: "PARTICULIER", name, email }
 */
function buildInvoice(order, item, buyer) {
    // Le montant TTC encaissé fait foi ; HT et TVA en sont déduits (un article B2B « HT » donne le même résultat)
    const amounts = computeAmounts({ price_cents: order.amount_cents });
    return {
        status: "A_EMETTRE",
        target: "KOLECTO",
        revolut_order_id: order.revolut_order_id,
        case_id: order.case_id,
        category: order.category,
        report_type: order.report_type,
        currency: order.currency || "EUR",
        buyer,
        lines: [{
            label: item ? item.label : order.report_type,
            reference: order.case_id,
            quantity: 1,
            unit_price_ht_cents: amounts.ht_cents,
            vat_rate: amounts.vat_rate,
            total_ht_cents: amounts.ht_cents,
            total_vat_cents: amounts.vat_cents,
            total_ttc_cents: amounts.ttc_cents,
        }],
        totals: { ht_cents: amounts.ht_cents, vat_cents: amounts.vat_cents, ttc_cents: amounts.ttc_cents },
        payment: { method: "REVOLUT", reference: order.revolut_order_id, status: "PAYEE" },
    };
}

const euros = (cents) => (cents / 100).toFixed(2).replace(".", ",");
function csvCell(v) {
    const s = v === null || v === undefined ? "" : String(v);
    // Neutralise les formules (=, +, -, @) pour l'ouverture dans un tableur
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Export CSV (séparateur « ; », montants à la française) pour création des factures dans Kolecto. */
function invoicesToCsv(invoices) {
    const header = ["Date paiement", "Client", "SIREN", "N° TVA client", "Adresse", "Code postal", "Ville", "Email",
        "Désignation", "Référence dossier", "Quantité", "Prix unitaire HT", "Taux TVA", "Total HT", "TVA", "Total TTC",
        "Paiement", "Référence paiement"];
    const rows = invoices.flatMap((inv) => inv.lines.map((l) => [
        inv.paid_at || "", inv.buyer.name, inv.buyer.siren || "", inv.buyer.vatNumber || "", inv.buyer.address || "",
        inv.buyer.postalCode || "", inv.buyer.city || "", inv.buyer.email || "", l.label, l.reference, l.quantity,
        euros(l.unit_price_ht_cents), `${l.vat_rate} %`, euros(l.total_ht_cents), euros(l.total_vat_cents),
        euros(l.total_ttc_cents), "Revolut (payée)", inv.payment.reference,
    ]));
    return [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

module.exports = { buildInvoice, invoicesToCsv };
