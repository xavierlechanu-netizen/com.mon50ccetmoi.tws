const {
    onRequest, admin, db, REVOLUT_SECRET_KEY, REVOLUT_WEBHOOK_SECRET,
    REVOLUT_API_BASE, REVOLUT_API_VERSION, setCorsHeaders, verifyAuthToken, crypto
} = require("./shared");
const { verifyRevolutSignature } = require("./revolut-signature");
const { CATALOG, CATEGORIES, getCatalogItem, isValidCaseId } = require("./payments-catalog");

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
                    price: orderData.amount_cents / 100,
                    vat_rate: "20.00",
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
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise pour créer un ordre de paiement." });
        }

        const { case_id: requestedCaseId, report_type } = req.body || {};
        const user_id = authUser.uid;

        // Validation stricte du catalogue (fermeture faille C4)
        const catalogItem = getCatalogItem(report_type);
        if (!catalogItem) {
            return res.status(400).json({ error: "Type de rapport ou produit invalide." });
        }

        let amount_cents = catalogItem.price_cents;
        const currency = "EUR";

        // Détermination et vérification de la propriété du dossier selon la catégorie
        let case_id = requestedCaseId;

        if (catalogItem.category === CATEGORIES.LITIGATION) {
            if (!isValidCaseId(case_id)) {
                return res.status(400).json({ error: "case_id invalide pour le rapport de sinistre." });
            }
            // Vérifier dans Firestore que le dossier appartient bien à l'utilisateur appelant
            const litigationDoc = await db.collection("litigation_proposals").doc(case_id).get();
            if (!litigationDoc.exists) {
                return res.status(404).json({ error: "Dossier de litige introuvable." });
            }
            if (litigationDoc.data().userId !== user_id) {
                console.warn(`[Sec] IDOR blocked in createRevolutOrder: auth=${user_id}, case_owner=${litigationDoc.data().userId}`);
                return res.status(403).json({ error: "Accès refusé : vous n'êtes pas le propriétaire de ce dossier." });
            }
        } else {
            // Pour les autres catégories (POINTS, BATTERY_CERT, GARAGE, BLACKBOX), si case_id absent ou non conforme, on le génère côté serveur
            if (!isValidCaseId(case_id)) {
                const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
                case_id = `${catalogItem.category.substring(0, 4)}-${Date.now()}-${randomHex}`;
            }
        }

        // Vérification si le dossier est déjà payé
        const existingConfirmation = await db.collection("payment_confirmations").doc(case_id).get();
        if (existingConfirmation.exists) {
            return res.status(409).json({ error: "Ce dossier a déjà été réglé avec succès." });
        }

        // Tarification dynamique pour le matériel Black Box (Offre lancement : 10 prototypes garantis à vie)
        if (report_type === 'BLACKBOX_UNIT') {
            try {
                const statDoc = await db.collection("stats").doc("blackbox_sales").get();
                const count = statDoc.exists ? (statDoc.data().count || 0) : 0;
                if (count < 10) {
                    amount_cents = 4999;
                }
            } catch (e) {
                console.warn("[Revolut] Avertissement calcul prix prototype:", e.message);
            }
        }

        const secretKey = REVOLUT_SECRET_KEY.value();
        if (!secretKey) {
            console.error("[Revolut] CRITIQUE : REVOLUT_SECRET_KEY non configuré.");
            return res.status(500).json({ error: "Service de paiement indisponible." });
        }

        const orderDescription = `${catalogItem.label} — ${case_id}`;

        try {
            // Anti double-clic : vérifier si un ordre PENDING récent existe déjà pour ce dossier
            const existingOrderSnap = await db.collection("revolut_orders")
                .where("case_id", "==", case_id)
                .where("user_id", "==", user_id)
                .where("status", "==", "PENDING")
                .limit(1)
                .get();

            if (!existingOrderSnap.empty) {
                const existingOrder = existingOrderSnap.docs[0].data();
                if (existingOrder.order_token && existingOrder.revolut_order_id) {
                    return res.status(200).json({
                        order_id: existingOrder.revolut_order_id,
                        order_token: existingOrder.order_token,
                        amount: existingOrder.amount_cents,
                        currency: existingOrder.currency || "EUR",
                        status: "PENDING",
                        case_id: case_id
                    });
                }
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const revolutResponse = await fetch(`${REVOLUT_API_BASE}/orders`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${secretKey}`,
                    "Revolut-Api-Version": REVOLUT_API_VERSION,
                    "Content-Type": "application/json"
                },
                signal: controller.signal,
                body: JSON.stringify({
                    amount: amount_cents,
                    currency: currency,
                    capture_mode: "automatic",
                    merchant_order_ext_ref: case_id,
                    description: orderDescription,
                    metadata: {
                        user_id: user_id,
                        case_id: case_id,
                        report_type: report_type,
                        app: "mon50ccetmoi"
                    }
                })
            });
            clearTimeout(timeout);

            if (!revolutResponse.ok) {
                const errBody = await revolutResponse.text();
                console.error("[Revolut] Erreur création ordre API :", revolutResponse.status, errBody);
                return res.status(502).json({ error: "Le service Revolut n'a pas pu créer la transaction." });
            }

            const order = await revolutResponse.json();

            await db.collection("revolut_orders").doc(order.id).set({
                revolut_order_id: order.id,
                order_token: order.token || null,
                case_id: case_id,
                user_id: user_id,
                report_type: report_type,
                category: catalogItem.category,
                amount_cents: amount_cents,
                currency: currency,
                status: order.state,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[Revolut] Ordre créé : ${order.id} — Catégorie : ${catalogItem.category} — Dossier : ${case_id}`);

            return res.status(200).json({
                order_id: order.id,
                order_token: order.token,
                amount: order.order_amount,
                currency: order.currency,
                status: order.state,
                case_id: case_id
            });

        } catch (err) {
            console.error("[Revolut] Exception createRevolutOrder :", err);
            return res.status(500).json({ error: "Erreur interne lors de l'initialisation du paiement." });
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
        const orderId = event.order_id || event.id;
        const eventType = event.event || event.type;

        if (!orderId) {
            return res.status(400).send("order_id manquant");
        }

        console.log(`[Revolut Webhook] Événement reçu : type=${eventType}, orderId=${orderId}`);

        try {
            let orderDataForInvoice = null;

            // Exécution atomique et idempotente dans une transaction Firestore (ASVS v5.0.0-2.3.3 / C3)
            const result = await db.runTransaction(async (tx) => {
                const orderRef = db.collection("revolut_orders").doc(orderId);
                const orderDoc = await tx.get(orderRef);

                if (!orderDoc.exists) {
                    console.warn(`[Revolut Webhook] Ordre introuvable dans revolut_orders : ${orderId}`);
                    return { notFound: true };
                }

                const orderData = orderDoc.data();
                orderDataForInvoice = orderData;

                // IDEMPOTENCE STRICTE : si déjà COMPLETED, on acquitte immédiatement sans réexécuter
                if (orderData.status === "COMPLETED") {
                    console.log(`[Revolut Webhook] Ordre ${orderId} déjà validé (idempotence). Aucun retraitement.`);
                    return { alreadyProcessed: true };
                }

                if (eventType === "ORDER_COMPLETED" || event.state === "COMPLETED") {
                    const caseId = orderData.case_id;
                    const userId = orderData.user_id;
                    const catalogItem = getCatalogItem(orderData.report_type);
                    const category = catalogItem?.category || orderData.category || "UNKNOWN";

                    // 1. Mettre à jour l'ordre
                    tx.update(orderRef, {
                        status: "COMPLETED",
                        completed_at: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 2. Traitement selon la catégorie stricte (fermeture faille C4)
                    if (category === CATEGORIES.BLACKBOX_HW || category === CATEGORIES.BLACKBOX_SUB) {
                        const isDuo = orderData.report_type === "BLACKBOX_DUO";
                        const isPackSub = orderData.report_type === "BLACKBOX_PACK_SUB";
                        const quantity = isDuo ? 2 : 1;

                        const saleData = {
                            orderId: orderId,
                            revolut_order_id: orderId,
                            caseId: caseId,
                            userId: userId,
                            type: isPackSub ? "PACK_SUBSCRIPTION" : (isDuo ? "DUO" : "UNIT"),
                            amount: orderData.amount_cents / 100,
                            amount_cents: orderData.amount_cents,
                            currency: orderData.currency || "EUR",
                            quantity: quantity,
                            lifetimeWarranty: !isDuo && !isPackSub && (orderData.amount_cents === 4999),
                            commitmentMonths: isPackSub ? 24 : 0,
                            securityDeposit: isPackSub ? 49.99 : 0,
                            monthlyFee: isPackSub ? 4.99 : 0,
                            status: "PAID",
                            assignedSerial: null,
                            assignedAt: null,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        };

                        tx.set(db.collection("blackbox_sales").doc(orderId), saleData);
                        tx.set(db.collection("blackbox_sales").doc(caseId), saleData);

                        if (isPackSub && userId && userId !== "unknown") {
                            tx.set(db.collection("users").doc(userId), {
                                isPremium: true,
                                premiumPlan: "BOITE_NOIRE_PLUS_24M",
                                premiumSince: admin.firestore.FieldValue.serverTimestamp(),
                                subscription: {
                                    status: "ACTIVE",
                                    type: "PACK_SUBSCRIPTION_24M",
                                    commitment_months: 24,
                                    security_deposit_cents: 4999,
                                    monthly_fee_cents: 499,
                                    start_date: admin.firestore.FieldValue.serverTimestamp()
                                }
                            }, { merge: true });
                        }

                        const statsRef = db.collection("stats").doc("blackbox_sales");
                        tx.set(statsRef, {
                            count: admin.firestore.FieldValue.increment(quantity),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                    } else if (category === CATEGORIES.GARAGE) {
                        if (userId && userId !== "unknown") {
                            tx.set(db.collection("users").doc(userId), {
                                isCertifiedGarage: true,
                                certified_at: admin.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
                            
                            tx.set(db.collection("garage_partners").doc(userId), {
                                revolut_order_id: orderId,
                                user_id: userId,
                                certified_at: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }

                    } else if (category === CATEGORIES.POINTS) {
                        const pointsToAdd = catalogItem?.points || 0;
                        if (userId && userId !== "unknown" && pointsToAdd > 0) {
                            const userRef = db.collection("users").doc(userId);
                            tx.set(userRef, {
                                braveCoins: admin.firestore.FieldValue.increment(pointsToAdd),
                                bvc_points: admin.firestore.FieldValue.increment(pointsToAdd),
                                points: admin.firestore.FieldValue.increment(pointsToAdd),
                                lastPointsPurchase: {
                                    pack: orderData.report_type,
                                    points: pointsToAdd,
                                    amount_cents: orderData.amount_cents,
                                    order_id: orderId,
                                    purchased_at: admin.firestore.FieldValue.serverTimestamp()
                                }
                            }, { merge: true });

                            const txRef = db.collection("points_transactions").doc(orderId);
                            tx.set(txRef, {
                                order_id: orderId,
                                case_id: caseId,
                                user_id: userId,
                                pack: orderData.report_type,
                                points: pointsToAdd,
                                amount_cents: orderData.amount_cents,
                                currency: orderData.currency || "EUR",
                                status: "COMPLETED",
                                type: "RECHARGE_REVOLUT",
                                created_at: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }

                    } else if (category === CATEGORIES.BATTERY_CERT) {
                        // Émission officielle du certificat côté serveur
                        const tier = orderData.report_type.replace("BATTERY_CERT_", "").toLowerCase();
                        const certRef = db.collection("battery_certificates").doc(caseId);
                        tx.set(certRef, {
                            certId: caseId,
                            userId: userId,
                            tier: tier,
                            revolut_order_id: orderId,
                            status: "ISSUED",
                            issuedAt: admin.firestore.FieldValue.serverTimestamp(),
                            isShared: false
                        });

                    } else if (category === CATEGORIES.LITIGATION) {
                        // Déblocage du rapport d'accident
                        const litigationRef = db.collection("litigation_proposals").doc(caseId);
                        tx.update(litigationRef, {
                            payment_status: "PAID",
                            payment_method: "REVOLUT",
                            revolut_order_id: orderId,
                            report_unlocked: true,
                            unlocked_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    // 3. Enregistrement unique de confirmation de paiement
                    tx.set(db.collection("payment_confirmations").doc(caseId), {
                        case_id: caseId,
                        revolut_order_id: orderId,
                        user_id: userId,
                        report_type: orderData.report_type,
                        category: category,
                        amount_cents: orderData.amount_cents,
                        currency: orderData.currency,
                        confirmed_at: admin.firestore.FieldValue.serverTimestamp(),
                        source: "REVOLUT_WEBHOOK"
                    });

                    return { success: true, processed: true };

                } else if (eventType === "ORDER_PAYMENT_DECLINED" || event.state === "FAILED") {
                    tx.update(orderRef, {
                        status: "FAILED",
                        failed_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                    return { failed: true };
                }

                return { ignored: true };
            });

            if (result.notFound) {
                return res.status(404).send("Ordre non trouvé");
            }

            // Facturation Pennylane après transaction réussie
            if (result.processed && orderDataForInvoice) {
                try {
                    let userEmail = "";
                    let userName = "";
                    if (orderDataForInvoice.user_id && orderDataForInvoice.user_id !== "unknown") {
                        const userDoc = await db.collection("users").doc(orderDataForInvoice.user_id).get();
                        if (userDoc.exists) {
                            userEmail = userDoc.data().email || "";
                            userName = userDoc.data().displayName || "";
                        }
                    }
                    createPennylaneInvoice(orderDataForInvoice, userEmail, userName);
                } catch (e) {
                    console.error("[Revolut Webhook] Erreur Pennylane post-transaction :", e);
                }
            }

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("[Revolut Webhook] Exception lors du traitement :", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

exports.checkPaymentStatus = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");

        const { case_id } = req.query;
        if (!case_id) return res.status(400).json({ error: "case_id requis" });

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }
        const user_id = authUser.uid;

        // Rate limiting transactionnel
        const now = Date.now();
        const rateLimitRef = db.collection("rate_limits").doc(`payment_poll_${user_id}`);
        try {
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(rateLimitRef);
                const rateData = snap.exists ? snap.data() : null;
                if (rateData && rateData.windowStart && (now - rateData.windowStart) < 60000) {
                    if (rateData.count >= 30) {
                        throw new Error("RATE_LIMIT_EXCEEDED");
                    }
                    tx.update(rateLimitRef, { count: admin.firestore.FieldValue.increment(1) });
                } else {
                    tx.set(rateLimitRef, { windowStart: now, count: 1 });
                }
            });
        } catch (rlErr) {
            if (rlErr.message === "RATE_LIMIT_EXCEEDED") {
                return res.status(429).json({ error: "Trop de requêtes. Veuillez patienter." });
            }
            console.warn("[Rate Limit] Avertissement :", rlErr.message);
        }

        try {
            const doc = await db.collection("payment_confirmations").doc(case_id).get();

            if (!doc.exists) {
                return res.status(200).json({ paid: false, status: "PENDING" });
            }

            const data = doc.data();
            
            if (data.user_id !== user_id) {
                console.warn(`[Sec] IDOR checkPaymentStatus blocked: auth=${user_id}, doc_user=${data.user_id}`);
                return res.status(403).json({ error: "Accès refusé" });
            }

            return res.status(200).json({
                paid: true,
                status: "COMPLETED",
                revolut_order_id: data.revolut_order_id,
                report_type: data.report_type,
                category: data.category || "UNKNOWN",
                confirmed_at: data.confirmed_at?.toDate?.()?.toISOString() || null
            });

        } catch (err) {
            console.error("[checkPaymentStatus] Erreur :", err);
            return res.status(500).json({ error: "Erreur interne lors de la vérification du paiement." });
        }
    }
);
