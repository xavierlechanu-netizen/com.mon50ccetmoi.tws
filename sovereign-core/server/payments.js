/**
 * payments.js — Paiements Revolut sur le serveur souverain (18/11/2026).
 *
 * Remplace les Cloud Functions createRevolutOrder, revolutWebhook et checkPaymentStatus
 * (functions/api/payments.js), coupées avec la facturation Google le 14/11/2026.
 *
 * Règles :
 * - le prix vient du catalogue (functions/api/payments-catalog.js), jamais de la demande ;
 * - seuls les produits que ce serveur sait livrer, et ouverts à la vente, sont acceptés
 *   (PAYMENTS_OPEN_PRODUCTS ; par défaut AUCUN : la vente s'ouvre sur décision de l'utilisateur) ;
 * - une commande n'est livrée qu'une fois, et seulement après avoir relu la commande CHEZ REVOLUT :
 *   état « completed », même montant, même devise. Un webhook bien signé ne suffit pas à lui seul ;
 * - si le webhook n'arrive pas, le suivi de la commande par l'appli relit Revolut et livre aussi.
 *
 * Livraison :
 * - points : grand livre du serveur, mouvement « PURCHASE » (les points achetés ne comptent pas
 *   dans le classement, qui ne compte que les points gagnés) ;
 * - garage : compte marqué « garage certifié » sur le serveur, qui ouvre l'espace garage (garages.js) ;
 * - GOLD : compte GOLD prolongé d'un an (premium_until), à partir de la fin de la période en cours ;
 * - une facture à émettre (invoicing.js, export CSV pour Kolecto).
 *
 * Testé : tests/sovereign-payments.test.js (mémoire, Revolut simulé) et tests/sovereign-pg.test.js.
 */
"use strict";

const crypto = require("crypto");
const { CATEGORIES, computeAmounts, getCatalogItem, isValidCaseId } = require("../../functions/api/payments-catalog");
const { buildInvoice } = require("../../functions/api/invoicing");
const { AUDIT_ACTIONS } = require("./audit-log");
const { ORDER_ID_RE } = require("./revolut-merchant");

// Ce que ce serveur sait livrer aujourd'hui (les autres produits restent refusés)
const DELIVERABLE_CATEGORIES = new Set([CATEGORIES.GARAGE, CATEGORIES.POINTS, CATEGORIES.GOLD]);
// Charte des garages partenaires (src/charte-garages.html) : acceptée avant le droit d'entrée,
// sa version est gardée avec la commande (migration 010). Nouvelle version : changer les deux.
const GARAGE_CHARTER_VERSION = "2026-11-25";
// Après paiement sur la page Revolut (Revolut Pay, carte, Apple Pay, Google Pay), le garage revient ici
const GARAGE_RETURN_PAGE = "https://mon50ccetmoi.com/garage-dashboard.html";
const GOLD_RETURN_PAGE = "https://mon50ccetmoi.com/app.html";
// Rien n'est en vente tant que l'utilisateur ne l'a pas décidé (PAYMENTS_OPEN_PRODUCTS sur le VPS),
// même si la clé Revolut est déjà en place. Premier produit prévu : GARAGE_FEE. Les packs de points
// attendent que l'appli lise le solde sur ce serveur (domaine « points » de CONFIG.BACKEND_MODE).
const DEFAULT_OPEN_PRODUCTS = [];
// Une commande en attente est reprise (double clic, fenêtre fermée) pendant 30 minutes
const REUSE_PENDING_MS = 30 * 60 * 1000;
// Relecture chez Revolut lors du suivi : au plus une fois toutes les 5 secondes par commande
const REMOTE_CHECK_EVERY_MS = 5000;
const FAILED_STATES = new Set(["FAILED", "CANCELLED", "DECLINED"]);

class PaymentError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

/** Produits ouverts à la vente : PAYMENTS_OPEN_PRODUCTS="GARAGE_FEE,POINTS_100", limités à ce qui se livre. */
function openProductsFromEnv(env = process.env) {
    const asked = env.PAYMENTS_OPEN_PRODUCTS !== undefined
        ? String(env.PAYMENTS_OPEN_PRODUCTS).split(",").map((s) => s.trim()).filter(Boolean)
        : DEFAULT_OPEN_PRODUCTS;
    return asked.filter((p) => {
        const item = getCatalogItem(p);
        return item && DELIVERABLE_CATEGORIES.has(item.category);
    });
}

/** Acheteur pour la facture : le pseudo, et l'email seulement s'il est réel. */
function invoiceBuyer(user) {
    const email = user && user.email && !/@mon50cc\.internal$/i.test(user.email) ? user.email : "";
    return { type: "PARTICULIER", name: (user && user.username) || "Client", email };
}

/**
 * @param {{store: object, revolut: object|null, audit: Function, openProducts?: string[], now?: () => number}} deps
 *   revolut : createRevolutClient(...) (revolut-merchant.js), ou null si la clé n'est pas en place
 */
function createPaymentsService({ store, revolut, audit, openProducts = DEFAULT_OPEN_PRODUCTS, now = () => Date.now() }) {
    const open = new Set(openProducts);
    const lastRemoteCheck = new Map();

    function publicOrder(order, extra = {}) {
        return {
            order_id: order.revolutOrderId,
            order_token: order.orderToken,
            amount: order.amountCents,
            currency: order.currency,
            status: order.status,
            case_id: order.caseId,
            mode: revolut ? revolut.mode : "prod",
            ...extra,
        };
    }

    /** Livre une commande payée (une seule fois). */
    async function fulfill(order) {
        const item = getCatalogItem(order.product);
        const user = await store.findUserById(order.uid);
        const invoice = buildInvoice({
            revolut_order_id: order.revolutOrderId, case_id: order.caseId, category: order.category,
            report_type: order.product, amount_cents: order.amountCents, currency: order.currency,
        }, item, invoiceBuyer(user));
        const result = await store.completePaymentOrder(order.revolutOrderId, {
            pointsToCredit: item && item.category === CATEGORIES.POINTS ? item.points || 0 : 0,
            certifyGarage: Boolean(item && item.category === CATEGORIES.GARAGE),
            goldDays: item && item.category === CATEGORIES.GOLD ? item.gold_days || 0 : 0,
            invoice,
        });
        if (result.processed) {
            console.log(`[Paiements] Commande ${order.revolutOrderId} payée et livrée (${order.product}).`);
            await audit({ action: AUDIT_ACTIONS.PAYMENT_COMPLETED, actorUid: order.uid, targetType: "payment_order",
                targetId: order.revolutOrderId, details: { product: order.product, amountCents: order.amountCents } });
        }
        return result;
    }

    /**
     * Relit la commande chez Revolut et la livre si elle est vraiment payée.
     * @returns {Promise<"COMPLETED"|"FAILED"|"PENDING">}
     */
    async function confirmWithRevolut(order) {
        const remote = await revolut.getOrder(order.revolutOrderId);
        if (remote.state === "COMPLETED") {
            if (remote.amount !== order.amountCents || (remote.currency || "EUR") !== order.currency) {
                console.error(`[Paiements] ALERTE : montant Revolut différent pour ${order.revolutOrderId} ` +
                    `(${remote.amount} ${remote.currency} au lieu de ${order.amountCents} ${order.currency}). Rien n'est livré.`);
                return "PENDING";
            }
            await fulfill(order);
            return "COMPLETED";
        }
        if (FAILED_STATES.has(remote.state)) {
            if (await store.failPaymentOrder(order.revolutOrderId)) {
                await audit({ action: AUDIT_ACTIONS.PAYMENT_FAILED, outcome: "failure", actorUid: order.uid,
                    targetType: "payment_order", targetId: order.revolutOrderId, details: { product: order.product } });
            }
            return "FAILED";
        }
        return "PENDING";
    }

    return {
        get configured() {
            return Boolean(revolut);
        },
        openProducts: [...open],

        /**
         * Nouvelle commande (ou reprise de celle en attente pour le même produit).
         * @param {{uid: string}} authUser
         * @param {{product?: string, report_type?: string, case_id?: string}} body
         */
        async createOrder(authUser, body = {}) {
            if (!revolut) throw new PaymentError(503, "Le paiement en ligne n'est pas encore ouvert sur ce serveur.");
            const product = String(body.product || body.report_type || "");
            const item = getCatalogItem(product);
            if (!item || !open.has(product)) throw new PaymentError(400, "Ce produit n'est pas en vente pour le moment.");

            const user = await store.findUserById(authUser.uid);
            if (!user) throw new PaymentError(401, "Compte introuvable. Reconnectez-vous.");
            if (user.isBanned) throw new PaymentError(403, "Ce compte est suspendu. Écrivez à contact@mon50ccetmoi.com.");
            if (item.category === CATEGORIES.GARAGE && user.isCertifiedGarage) {
                throw new PaymentError(409, "Votre garage est déjà certifié.");
            }
            const charterVersion = item.category === CATEGORIES.GARAGE ? GARAGE_CHARTER_VERSION : null;
            if (charterVersion && body.charte !== charterVersion) {
                throw new PaymentError(400, "Lisez et acceptez la charte des garages partenaires avant de payer.");
            }

            const pending = await store.findReusablePendingOrder(user.uid, product, now() - REUSE_PENDING_MS);
            if (pending) return publicOrder(pending, { reused: true });

            // Référence du dossier : celle de l'appli si elle est valable et libre, sinon une nouvelle
            let caseId = isValidCaseId(body.case_id) ? body.case_id : null;
            if (caseId) {
                const existing = await store.findPaymentOrderByCase(caseId);
                if (existing && existing.uid === user.uid && existing.status === "COMPLETED") {
                    throw new PaymentError(409, "Ce dossier a déjà été réglé.");
                }
                if (existing) caseId = null;
            }
            if (!caseId) caseId = `${item.category.slice(0, 4)}-${now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

            const amountCents = computeAmounts(item).ttc_cents;
            let remote;
            try {
                remote = await revolut.createOrder({
                    amountCents,
                    currency: "EUR",
                    description: `${item.label} — ${caseId}`,
                    reference: caseId,
                    metadata: { case_id: caseId, user_uid: user.uid, product, app: "mon50ccetmoi",
                        ...(charterVersion ? { charte: charterVersion } : {}) },
                    ...(item.category === CATEGORIES.GARAGE
                        ? { redirectUrl: `${GARAGE_RETURN_PAGE}?paiement=${encodeURIComponent(caseId)}` } : {}),
                    ...(item.category === CATEGORIES.GOLD
                        ? { redirectUrl: `${GOLD_RETURN_PAGE}?paiement=${encodeURIComponent(caseId)}` } : {}),
                });
            } catch (e) {
                console.error("[Paiements] Création de la commande Revolut impossible :", e.message);
                throw new PaymentError(502, "Le service de paiement ne répond pas. Réessayez dans un instant.");
            }
            const order = await store.createPaymentOrder({
                revolutOrderId: remote.id, caseId, uid: user.uid, product, category: item.category,
                amountCents, currency: "EUR", orderToken: remote.token, charterVersion,
            });
            await audit({ action: AUDIT_ACTIONS.PAYMENT_ORDER_CREATED, actorUid: user.uid, actorRole: user.role,
                targetType: "payment_order", targetId: remote.id,
                details: { product, amountCents, ...(charterVersion ? { charte: charterVersion } : {}) } });
            return publicOrder(order, { checkout_url: remote.checkoutUrl });
        },

        /** Suivi d'une commande par son acheteur (remplace checkPaymentStatus). */
        async orderStatus(authUser, caseId) {
            if (!isValidCaseId(caseId)) throw new PaymentError(400, "Référence de dossier invalide.");
            let order = await store.findPaymentOrderByCase(caseId);
            if (!order || order.uid !== authUser.uid) throw new PaymentError(404, "Commande introuvable.", { paid: false });

            if (order.status === "PENDING" && revolut) {
                const last = lastRemoteCheck.get(order.revolutOrderId) || 0;
                if (now() - last >= REMOTE_CHECK_EVERY_MS) {
                    lastRemoteCheck.set(order.revolutOrderId, now());
                    if (lastRemoteCheck.size > 10000) lastRemoteCheck.clear();
                    try {
                        await confirmWithRevolut(order);
                        order = await store.findPaymentOrderByCase(caseId);
                    } catch (e) {
                        console.warn("[Paiements] Relecture Revolut impossible :", e.message);
                    }
                }
            }
            const item = getCatalogItem(order.product);
            const paid = order.status === "COMPLETED";
            const user = paid && item && item.category === CATEGORIES.POINTS ? await store.findUserById(order.uid) : null;
            return {
                paid,
                status: order.status,
                case_id: order.caseId,
                report_type: order.product,
                category: order.category,
                ...(paid && item && item.category === CATEGORIES.POINTS
                    ? { points_credited: item.points, balance: user ? user.braveCoins : null } : {}),};
        },

        /**
         * Événement du webhook Revolut (signature DÉJÀ vérifiée par l'appelant).
         * @returns {Promise<{status: number, body: object}>}
         */
        async handleWebhookEvent(event) {
            const orderId = event && (event.order_id || event.id);
            const type = String((event && (event.event || event.type)) || "");
            if (!ORDER_ID_RE.test(String(orderId || ""))) return { status: 400, body: { error: "order_id manquant ou invalide." } };
            const order = await store.findPaymentOrder(orderId);
            // Commande inconnue (créée ailleurs, ex. ancienne Cloud Function) : acquittée sans rien faire
            if (!order) return { status: 200, body: { ignored: true } };
            if (order.status === "COMPLETED") return { status: 200, body: { alreadyProcessed: true } };

            if (type === "ORDER_COMPLETED" || type === "ORDER_PAYMENT_DECLINED" || type === "ORDER_PAYMENT_FAILED" ||
                type === "ORDER_CANCELLED" || type === "ORDER_AUTHORISED") {
                if (!revolut) return { status: 503, body: { error: "Paiements non configurés." } }; // Revolut réessaiera
                try {
                    const state = await confirmWithRevolut(order);
                    return { status: 200, body: { state } };
                } catch (e) {
                    console.error("[Paiements] Webhook : relecture Revolut impossible :", e.message);
                    return { status: 502, body: { error: "Revolut injoignable, réessayer plus tard." } };
                }
            }
            return { status: 200, body: { ignored: true } };
        },

        /** Administrateur : dernières commandes. */
        async listForAdmin(limit = 100) {
            return store.listPaymentOrders({ limit });
        },
    };
}

module.exports = { createPaymentsService, openProductsFromEnv, PaymentError, DEFAULT_OPEN_PRODUCTS, DELIVERABLE_CATEGORIES,
    GARAGE_CHARTER_VERSION };
