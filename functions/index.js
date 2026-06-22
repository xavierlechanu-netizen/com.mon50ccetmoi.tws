/**
 * FIREBASE CLOUD FUNCTIONS — mon50ccetmoi
 * ─────────────────────────────────────────────────────────────────────────────
 * Revolut Merchant API — Création d'ordres de paiement côté serveur.
 *
 * ⚠️  La clé secrète Revolut (sk_...) ne doit JAMAIS être dans le code client.
 *     Elle est stockée dans Firebase Secret Manager :
 *
 *     Déploiement initial :
 *       firebase functions:secrets:set REVOLUT_SECRET_KEY
 *       (copier-coller votre sk_... quand demandé)
 *
 *     Puis déployer :
 *       firebase deploy --only functions
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ─── Clé secrète Revolut via Firebase Secret Manager ───────────────────────
const REVOLUT_SECRET_KEY = defineSecret("REVOLUT_SECRET_KEY");

// ─── Constantes API Revolut ─────────────────────────────────────────────────
const REVOLUT_API_BASE    = "https://sandbox-merchant.revolut.com/api";
const REVOLUT_API_VERSION = "2026-04-20";

// ─────────────────────────────────────────────────────────────────────────────
// CORS helper (compatible PWA + Android WebView)
// ─────────────────────────────────────────────────────────────────────────────
function setCorsHeaders(res) {
    res.set("Access-Control-Allow-Origin",  "https://mon50ccetmoi.com");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. createRevolutOrder
//    Crée un ordre de paiement Revolut et retourne le token au client.
//
//    POST body : { amount_cents, currency, case_id, user_id, report_type }
//    Response  : { order_id, order_token, amount, currency, status }
// ─────────────────────────────────────────────────────────────────────────────
exports.createRevolutOrder = onRequest(
    { secrets: [REVOLUT_SECRET_KEY], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST")   return res.status(405).json({ error: "Method Not Allowed" });

        let { amount_cents, currency, case_id, user_id, report_type } = req.body;

        // Validation & Sécurité des montants
        const prices = {
            'SIMPLE': 4990,
            'INTERMEDIAIRE': 8999,
            'EXPERT': 14999
        };

        if (!report_type || !prices[report_type]) {
            // Rétrocompatibilité ou valeur par défaut
            report_type = 'SIMPLE';
        }
        
        // Sécurité : on force le montant côté serveur pour éviter la triche côté client
        amount_cents = prices[report_type];
        currency = "EUR";

        if (!case_id) {
            return res.status(400).json({ error: "Paramètre manquant : case_id" });
        }

        const secretKey = REVOLUT_SECRET_KEY.value();
        if (!secretKey) {
            return res.status(500).json({ error: "Clé secrète Revolut non configurée." });
        }

        try {
            // ── Appel API Revolut : Création de l'ordre ──────────────────────
            const revolutResponse = await fetch(`${REVOLUT_API_BASE}/orders`, {
                method:  "POST",
                headers: {
                    "Authorization":      `Bearer ${secretKey}`,
                    "Revolut-Api-Version": REVOLUT_API_VERSION,
                    "Content-Type":        "application/json"
                },
                body: JSON.stringify({
                    amount:        amount_cents,          // en centimes (4999 = 49,99 €)
                    currency:      currency,              // "EUR"
                    capture_mode:  "automatic",
                    merchant_order_ext_ref: case_id,     // votre référence interne
                    description:   `Rapport Assurance — ${report_type || "Standard"} — ${case_id}`,
                    metadata: {
                        user_id:     user_id   || "unknown",
                        case_id:     case_id,
                        report_type: report_type || "STANDARD",
                        app:         "mon50ccetmoi"
                    }
                })
            });

            if (!revolutResponse.ok) {
                const errBody = await revolutResponse.text();
                console.error("[Revolut] Erreur création ordre :", revolutResponse.status, errBody);
                return res.status(revolutResponse.status).json({
                    error: "Erreur Revolut Merchant API",
                    details: errBody
                });
            }

            const order = await revolutResponse.json();

            // ── Sauvegarder l'ordre en Firestore pour audit ──────────────────
            await db.collection("revolut_orders").doc(order.id).set({
                revolut_order_id: order.id,
                case_id:          case_id,
                user_id:          user_id || "unknown",
                report_type:      report_type || "STANDARD",
                amount_cents:     amount_cents,
                currency:         currency,
                status:           order.state,
                created_at:       admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[Revolut] Ordre créé : ${order.id} — Dossier : ${case_id}`);

            // ── Retourner le token au client ─────────────────────────────────
            return res.status(200).json({
                order_id:    order.id,
                order_token: order.token,   // utilisé par RevolutCheckout(token) côté client
                amount:      order.order_amount,
                currency:    order.currency,
                status:      order.state
            });

        } catch (err) {
            console.error("[Revolut] Exception :", err);
            return res.status(500).json({ error: "Erreur serveur interne", message: err.message });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. revolutWebhook
//    Reçoit les notifications Revolut (paiement confirmé, échoué, etc.)
//    et met à jour Firestore + débloque le rapport.
//
//    ⚙️  À configurer dans votre dashboard Revolut Business :
//        Webhooks > Add endpoint > https://<region>-mon50ccetmoi.cloudfunctions.net/revolutWebhook
//        Événements : ORDER_COMPLETED, ORDER_PAYMENT_DECLINED
// ─────────────────────────────────────────────────────────────────────────────
exports.revolutWebhook = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        const event = req.body;
        console.log("[Revolut Webhook] Événement reçu :", JSON.stringify(event));

        const orderId  = event.order_id  || event.id;
        const eventType = event.event    || event.type;

        if (!orderId) {
            return res.status(400).send("order_id manquant");
        }

        try {
            // ── Récupérer le dossier associé ─────────────────────────────────
            const orderDoc = await db.collection("revolut_orders").doc(orderId).get();

            if (!orderDoc.exists) {
                console.warn("[Revolut Webhook] Ordre inconnu :", orderId);
                return res.status(404).send("Ordre non trouvé");
            }

            const orderData = orderDoc.data();
            const caseId    = orderData.case_id;

            // ── Traitement selon le type d'événement ─────────────────────────
            if (eventType === "ORDER_COMPLETED" || event.state === "COMPLETED") {
                // Paiement réussi → débloquer le rapport dans Firestore
                const batch = db.batch();

                // 1. Mettre à jour l'ordre
                batch.update(db.collection("revolut_orders").doc(orderId), {
                    status:       "COMPLETED",
                    completed_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // 2. Débloquer le rapport dans litigation_proposals
                const litigationRef = db.collection("litigation_proposals").doc(caseId);
                batch.update(litigationRef, {
                    payment_status:   "PAID",
                    payment_method:   "REVOLUT",
                    revolut_order_id: orderId,
                    report_unlocked:  true,
                    unlocked_at:      admin.firestore.FieldValue.serverTimestamp()
                });

                // 3. Enregistrer dans blackbox_reports comme preuve de paiement
                batch.set(db.collection("payment_confirmations").doc(caseId), {
                    case_id:          caseId,
                    revolut_order_id: orderId,
                    user_id:          orderData.user_id,
                    report_type:      orderData.report_type,
                    amount_cents:     orderData.amount_cents,
                    currency:         orderData.currency,
                    confirmed_at:     admin.firestore.FieldValue.serverTimestamp(),
                    source:           "REVOLUT_WEBHOOK"
                });

                await batch.commit();
                console.log(`[Revolut Webhook] ✅ Rapport débloqué pour dossier : ${caseId}`);

            } else if (eventType === "ORDER_PAYMENT_DECLINED" || event.state === "FAILED") {
                await db.collection("revolut_orders").doc(orderId).update({
                    status:    "FAILED",
                    failed_at: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`[Revolut Webhook] ❌ Paiement refusé pour ordre : ${orderId}`);
            }

            return res.status(200).send("OK");

        } catch (err) {
            console.error("[Revolut Webhook] Erreur :", err);
            return res.status(500).send("Erreur serveur");
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. checkPaymentStatus
//    Vérifié par le client pour savoir si un paiement est confirmé.
//    Le client poll cette fonction après avoir redirigé l'utilisateur
//    vers le checkout Revolut.
//
//    GET ?case_id=LITIGE-XXX&user_id=uid
// ─────────────────────────────────────────────────────────────────────────────
exports.checkPaymentStatus = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");

        const { case_id, user_id } = req.query;
        if (!case_id) return res.status(400).json({ error: "case_id requis" });

        try {
            const doc = await db.collection("payment_confirmations").doc(case_id).get();

            if (!doc.exists) {
                return res.status(200).json({ paid: false, status: "PENDING" });
            }

            const data = doc.data();
            
            // SECURITY CHECK: Verify the requester owns this payment confirmation
            if (data.user_id !== user_id) {
                return res.status(403).json({ error: "Accès refusé" });
            }

            return res.status(200).json({
                paid:             true,
                status:           "COMPLETED",
                revolut_order_id: data.revolut_order_id,
                report_type:      data.report_type,
                confirmed_at:     data.confirmed_at?.toDate?.()?.toISOString() || null
            });

        } catch (err) {
            console.error("[checkPaymentStatus] Erreur :", err);
            return res.status(500).json({ error: err.message });
        }
    }
);
