const {
    onRequest, admin, db, REVOLUT_SECRET_KEY, REVOLUT_WEBHOOK_SECRET,
    REVOLUT_API_BASE, REVOLUT_API_VERSION, setCorsHeaders, verifyAuthToken, crypto
} = require("./shared");
const { verifyRevolutSignature } = require("./revolut-signature");

async function createPennylaneInvoice(orderData, userEmail, userName) {
    const apiKey = null; // PENNYLANE_API_KEY.value(); désactivé temporairement
    if (!apiKey) {
        console.warn("[Pennylane] Clé API non configurée. Impossible de générer la facture.");
        return;
    }
    
    try {
        console.log(`[Pennylane] Création facture pour l'ordre ${orderData.revolut_order_id}`);
        const invoicePayload = {
            create_customer: {
                name: userName || "Client Inconnu",
                emails: userEmail ? [userEmail] : []
            },
            date: new Date().toISOString().split('T')[0],
            deadline: new Date().toISOString().split('T')[0],
            line_items: [
                {
                    label: `Prestation mon50ccetmoi — ${orderData.report_type || "Standard"}`,
                    price: orderData.amount_cents / 100, // Conversion centimes -> euros
                    vat_rate: "20.00", // TVA standard FR 20%
                    quantity: 1
                }
            ]
        };

        const response = await fetch("https://app.pennylane.com/api/v1/customer_invoices", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(invoicePayload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error("[Pennylane] Erreur API création facture :", response.status, errBody);
        } else {
            const invoice = await response.json();
            console.log(`[Pennylane] ✅ Facture créée avec succès. ID : ${invoice.invoice?.id || invoice.id}`);
            
            if (invoice.invoice && invoice.invoice.id) {
                await db.collection("revolut_orders").doc(orderData.revolut_order_id).update({
                    pennylane_invoice_id: invoice.invoice.id,
                    pennylane_invoice_pdf: invoice.invoice.pdf_url || null
                });
            }
        }
    } catch (e) {
        console.error("[Pennylane] Exception lors de la génération de la facture :", e);
    }
}

exports.createRevolutOrder = onRequest(
    { secrets: [REVOLUT_SECRET_KEY], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST")   return res.status(405).json({ error: "Method Not Allowed" });

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise pour créer un ordre de paiement." });
        }

        let { amount_cents, currency, case_id, report_type } = req.body;
        const user_id = authUser.uid;

        const prices = {
            'SIMPLE': 4990,
            'INTERMEDIAIRE': 8999,
            'EXPERT': 19999,
            'DIAGNOSTIC_IA': 499,
            'BATTERY_CERT_BASIQUE': 499,
            'BATTERY_CERT_PREMIUM': 1499,
            'BATTERY_CERT_QUANTUM': 2999,
            'GARAGE_FEE': 5000,
            'BLACKBOX_CARE_MONTHLY': 500,
            'BLACKBOX_CARE_ANNUAL': 5000,
            'BLACKBOX_UNIT': 8999,
            'BLACKBOX_DUO': 16198
        };

        if (!report_type || !prices[report_type]) {
            report_type = 'SIMPLE';
        }
        
        amount_cents = prices[report_type];

        // Tarification dynamique pour le matériel Black Box (Offre lancement : 10 prototypes garantis à vie)
        if (report_type === 'BLACKBOX_UNIT') {
            try {
                const statDoc = await db.collection("stats").doc("blackbox_sales").get();
                const count = statDoc.exists ? (statDoc.data().count || 0) : 0;
                if (count < 10) {
                    amount_cents = 4999; // 49,99 € pour les 10 premiers prototypes
                }
            } catch (e) {
                console.warn("[Revolut] Avertissement calcul prix prototype:", e.message);
            }
        }

        currency = "EUR";

        if (!case_id) {
            return res.status(400).json({ error: "Paramètre manquant : case_id" });
        }

        const secretKey = REVOLUT_SECRET_KEY.value();
        if (!secretKey) {
            return res.status(500).json({ error: "Clé secrète Revolut non configurée." });
        }

        try {
            const revolutResponse = await fetch(`${REVOLUT_API_BASE}/orders`, {
                method:  "POST",
                headers: {
                    "Authorization":      `Bearer ${secretKey}`,
                    "Revolut-Api-Version": REVOLUT_API_VERSION,
                    "Content-Type":        "application/json"
                },
                body: JSON.stringify({
                    amount:        amount_cents,
                    currency:      currency,
                    capture_mode:  "automatic",
                    merchant_order_ext_ref: case_id,
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

            return res.status(200).json({
                order_id:    order.id,
                order_token: order.token,
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

exports.revolutWebhook = onRequest(
    { secrets: [REVOLUT_WEBHOOK_SECRET], region: "europe-west1" },
    async (req, res) => {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        const signature = req.headers["revolut-signature"];
        const timestampHeader = req.headers["revolut-request-timestamp"];
        const webhookSecret = REVOLUT_WEBHOOK_SECRET.value();
        if (!webhookSecret) {
            console.error("[Revolut Webhook] CRITIQUE : REVOLUT_WEBHOOK_SECRET non configuré. Requête rejetée.");
            return res.status(500).send("Webhook secret not configured");
        }
        if (!signature) {
            console.error("[Revolut Webhook] Header Revolut-Signature manquant. Requête rejetée.");
            return res.status(401).send("Signature manquante");
        }

        const rawBody = req.rawBody || JSON.stringify(req.body);
        const verif = verifyRevolutSignature(rawBody, timestampHeader, signature, webhookSecret);
        if (!verif.valid) {
            console.error("[Revolut Webhook] Signature invalide :", verif.reason);
            return res.status(401).send("Signature invalide");
        }

        const event = req.body;
        console.log("[Revolut Webhook] Événement reçu :", JSON.stringify(event));

        const orderId  = event.order_id  || event.id;
        const eventType = event.event    || event.type;

        if (!orderId) {
            return res.status(400).send("order_id manquant");
        }

        try {
            const orderDoc = await db.collection("revolut_orders").doc(orderId).get();

            if (!orderDoc.exists) {
                console.warn("[Revolut Webhook] Ordre inconnu :", orderId);
                return res.status(404).send("Ordre non trouvé");
            }

            const orderData = orderDoc.data();
            const caseId    = orderData.case_id;

            if (eventType === "ORDER_COMPLETED" || event.state === "COMPLETED") {
                const batch = db.batch();

                batch.update(db.collection("revolut_orders").doc(orderId), {
                    status:       "COMPLETED",
                    completed_at: admin.firestore.FieldValue.serverTimestamp()
                });

                if (orderData.report_type === "BLACKBOX_UNIT" || orderData.report_type === "BLACKBOX_DUO") {
                    const isDuo = orderData.report_type === "BLACKBOX_DUO";
                    const quantity = isDuo ? 2 : 1;
                    const userId = orderData.user_id;

                    const saleDocRef = db.collection("blackbox_sales").doc(orderId);
                    batch.set(saleDocRef, {
                        orderId: orderId,
                        revolut_order_id: orderId,
                        caseId: caseId,
                        userId: userId,
                        type: isDuo ? "DUO" : "UNIT",
                        amount: orderData.amount_cents / 100,
                        amount_cents: orderData.amount_cents,
                        currency: orderData.currency || "EUR",
                        quantity: quantity,
                        lifetimeWarranty: !isDuo && (orderData.amount_cents === 4999),
                        status: "PAID",
                        assignedSerial: null,
                        assignedAt: null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    const statsRef = db.collection("stats").doc("blackbox_sales");
                    batch.set(statsRef, {
                        count: admin.firestore.FieldValue.increment(quantity),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    console.log(`[Revolut Webhook] 📦 Vente Blackbox confirmée (${quantity} boîtier(s)) pour ${userId}`);

                } else if (orderData.report_type === "GARAGE_FEE") {
                    const userId = orderData.user_id;
                    if (userId && userId !== "unknown") {
                        batch.set(db.collection("users").doc(userId), {
                            isCertifiedGarage: true,
                            certified_at: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        
                        batch.set(db.collection("garage_partners").doc(userId), {
                            revolut_order_id: orderId,
                            user_id: userId,
                            certified_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                } else {
                    const litigationRef = db.collection("litigation_proposals").doc(caseId);
                    batch.update(litigationRef, {
                        payment_status:   "PAID",
                        payment_method:   "REVOLUT",
                        revolut_order_id: orderId,
                        report_unlocked:  true,
                        unlocked_at:      admin.firestore.FieldValue.serverTimestamp()
                    });
                }

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

                try {
                    let userEmail = "";
                    let userName = "";
                    if (orderData.user_id && orderData.user_id !== "unknown") {
                        const userDoc = await db.collection("users").doc(orderData.user_id).get();
                        if (userDoc.exists) {
                            userEmail = userDoc.data().email || "";
                            userName = userDoc.data().displayName || "";
                        }
                    }
                    createPennylaneInvoice(orderData, userEmail, userName);
                } catch (e) {
                    console.error("[Revolut Webhook] Erreur déclenchement Pennylane :", e);
                }

            } else if (eventType === "ORDER_PAYMENT_DECLINED" || event.state === "FAILED") {
                await db.collection("revolut_orders").doc(orderId).update({
                    status:    "FAILED",
                    failed_at: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`[Revolut Webhook] ❌ Paiement refusé pour ordre : ${orderId}`);
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error("[Revolut Webhook] Error processing event :", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

exports.checkPaymentStatus = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");

        const { case_id, user_id } = req.query;
        if (!case_id || !user_id) return res.status(400).json({ error: "case_id et user_id requis" });

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }
        if (authUser.uid !== user_id) {
            console.warn(`[Sec] IDOR attempt blocked: auth=${authUser.uid}, requested=${user_id}`);
            return res.status(403).json({ error: "Accès refusé : token invalide pour cet utilisateur." });
        }

        const now = Date.now();
        const rateLimitRef = db.collection("rate_limits").doc(`payment_poll_${user_id}`);
        try {
            const rateLimitDoc = await rateLimitRef.get();
            const rateData = rateLimitDoc.exists ? rateLimitDoc.data() : null;
            if (rateData && rateData.windowStart && (now - rateData.windowStart) < 60000) {
                if (rateData.count >= 20) {
                    return res.status(429).json({ error: "Trop de requêtes. Veuillez patienter." });
                }
                await rateLimitRef.update({ count: admin.firestore.FieldValue.increment(1) });
            } else {
                await rateLimitRef.set({ windowStart: now, count: 1 });
            }
        } catch (rlErr) {
            console.warn("[Rate Limit] Erreur non bloquante :", rlErr.message);
        }

        try {
            const doc = await db.collection("payment_confirmations").doc(case_id).get();

            if (!doc.exists) {
                return res.status(200).json({ paid: false, status: "PENDING" });
            }

            const data = doc.data();
            
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
            return res.status(500).json({ error: "Erreur interne lors de la vérification du paiement." });
        }
    }
);
