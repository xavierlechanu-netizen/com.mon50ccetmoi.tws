const {
    onRequest, admin, db, REVOLUT_SECRET_KEY, REVOLUT_WEBHOOK_SECRET,
    REVOLUT_API_BASE, REVOLUT_API_VERSION, setCorsHeaders, verifyAuthToken, crypto
} = require("./shared");
const { verifyRevolutSignature } = require("./revolut-signature");
const { CATALOG, CATEGORIES, computeAmounts, getCatalogItem, isValidCaseId } = require("./payments-catalog");
const { planBlackboxPurchase } = require("./blackbox-subscription");

const { buildInvoice } = require("./invoicing");

/** Acheteur à facturer : l'entreprise vérifiée par SIREN, sinon le particulier. */
async function loadInvoiceBuyer(order) {
    const profile = await db.collection("insurer_profiles").doc(order.user_id).get();
    if (order.category === CATEGORIES.LITIGATION && profile.exists && profile.data().verified === true) {
        const p = profile.data();
        return {
            type: "ENTREPRISE", name: p.name, siren: p.siren, vatNumber: p.vatNumber,
            address: p.address, postalCode: p.postalCode, city: p.city, email: p.billingEmail || "",
        };
    }
    const user = await db.collection("users").doc(order.user_id).get();
    const u = user.exists ? user.data() : {};
    return { type: "PARTICULIER", name: u.displayName || u.username || "Client", email: u.email || "" };
}

const { evidenceHash } = require("./evidence-seal");
const { timestampEvidence } = require("./timestamping");

/**
 * Identifiant du document de confirmation de paiement.
 * Rapport de sinistre : un par dossier ET par acheteur (plusieurs assureurs peuvent l'acheter).
 * Autres produits : un par dossier, comme avant.
 */
function confirmationId(category, caseId, userId) {
    return category === CATEGORIES.LITIGATION ? `${caseId}__${userId}` : caseId;
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

        // Montant réellement encaissé : TTC (rapports assureurs affichés HT → HT + TVA 20 %)
        const amount_cents = computeAmounts(catalogItem).ttc_cents;
        const currency = "EUR";

        // Détermination et vérification de la propriété du dossier selon la catégorie
        let case_id = requestedCaseId;

        if (catalogItem.category === CATEGORIES.LITIGATION) {
            if (!isValidCaseId(case_id)) {
                return res.status(400).json({ error: "case_id invalide pour le rapport de sinistre." });
            }
            // Le numéro de dossier (impossible à deviner) est transmis par le pilote à son assureur :
            // le posséder vaut accord du pilote. Celui qui paie obtient l'accès aux données complètes.
            const litigationDoc = await db.collection("litigation_proposals").doc(case_id).get();
            if (!litigationDoc.exists) {
                return res.status(404).json({ error: "Dossier de litige introuvable." });
            }
            // Tout acheteur autre que le pilote doit être un professionnel vérifié par son SIREN
            // (assureur, courtier, expert, avocat) : c'est aussi lui qui figurera sur la facture.
            if (litigationDoc.data().userId !== user_id) {
                const profile = await db.collection("insurer_profiles").doc(user_id).get();
                if (!profile.exists || profile.data().verified !== true) {
                    return res.status(403).json({
                        error: "Achat réservé aux professionnels de l'assurance : renseignez d'abord le SIREN de votre entreprise.",
                        code: "INSURER_PROFILE_REQUIRED"
                    });
                }
            }
        } else {
            // Pour les autres catégories (POINTS, BATTERY_CERT, GARAGE, BLACKBOX), si case_id absent ou non conforme, on le génère côté serveur
            if (!isValidCaseId(case_id)) {
                const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
                case_id = `${catalogItem.category.substring(0, 4)}-${Date.now()}-${randomHex}`;
            }
        }

        // Vérification si le dossier est déjà payé (par CET acheteur pour un rapport de sinistre :
        // dans un accident à deux véhicules, chaque assureur peut acheter le rapport)
        const existingConfirmation = await db.collection("payment_confirmations")
            .doc(confirmationId(catalogItem.category, case_id, user_id)).get();
        if (existingConfirmation.exists) {
            return res.status(409).json({
                error: catalogItem.category === CATEGORIES.LITIGATION
                    ? "Vous avez déjà acheté ce rapport."
                    : "Ce dossier a déjà été réglé avec succès."
            });
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
                amount_cents: amount_cents, // TTC encaissé
                ...(() => {
                    const a = computeAmounts({ price_cents: amount_cents }); // décomposition du TTC encaissé
                    return { amount_ht_cents: a.ht_cents, vat_cents: a.vat_cents, vat_rate: a.vat_rate };
                })(),
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
            let newlySealed = null; // { caseId, hash } : rapport scellé par ce paiement, à horodater

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

                    // Lecture du dossier de sinistre avant toute écriture (règle des transactions Firestore)
                    let litigationSnap = null;
                    if (category === CATEGORIES.LITIGATION) {
                        litigationSnap = await tx.get(db.collection("litigation_proposals").doc(caseId));
                    }
                    // Abonnement Boîte Noire+ en cours (pour le prolonger plutôt que l'écraser)
                    const isBlackboxPurchase = category === CATEGORIES.BLACKBOX_HW || category === CATEGORIES.BLACKBOX_SUB;
                    const hasUser = userId && userId !== "unknown";
                    let currentCareEndsAt = null;
                    if (isBlackboxPurchase && hasUser) {
                        const userSnap = await tx.get(db.collection("users").doc(userId));
                        const endsAt = userSnap.exists ? userSnap.data()?.blackboxCare?.ends_at : null;
                        currentCareEndsAt = endsAt?.toMillis ? endsAt.toMillis() : null;
                    }

                    // 1. Mettre à jour l'ordre
                    tx.update(orderRef, {
                        status: "COMPLETED",
                        completed_at: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 2. Traitement selon la catégorie stricte (fermeture faille C4)
                    if (isBlackboxPurchase) {
                        const isDuo = orderData.report_type === "BLACKBOX_DUO";
                        const isPackSub = orderData.report_type === "BLACKBOX_PACK_SUB";
                        // Boîtiers réellement vendus (0 pour un simple abonnement) et abonnement accordé
                        const plan = planBlackboxPurchase(orderData.report_type, currentCareEndsAt, Date.now());
                        const quantity = plan ? plan.hardwareUnits : (isDuo ? 2 : 1);

                        const saleData = {
                            orderId: orderId,
                            revolut_order_id: orderId,
                            caseId: caseId,
                            userId: userId,
                            type: plan ? plan.saleType : (isPackSub ? "PACK_SUBSCRIPTION" : (isDuo ? "DUO" : "UNIT")),
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

                        if (plan) {
                            saleData.careMonthsGranted = plan.subscription.monthsGranted;
                            saleData.careEndsAt = admin.firestore.Timestamp.fromMillis(plan.subscription.endsAtMs);
                        }

                        tx.set(db.collection("blackbox_sales").doc(orderId), saleData);
                        tx.set(db.collection("blackbox_sales").doc(caseId), saleData);

                        // Abonnement Boîte Noire+ : 1 an offert par boîtier (promesse des CGV),
                        // 1 ou 12 mois pour un abonnement payé, prolongé s'il court encore.
                        if (plan && hasUser) {
                            tx.set(db.collection("users").doc(userId), {
                                blackboxCare: {
                                    status: "ACTIVE",
                                    plan: plan.subscription.plan,
                                    starts_at: admin.firestore.Timestamp.fromMillis(plan.subscription.startsAtMs),
                                    ends_at: admin.firestore.Timestamp.fromMillis(plan.subscription.endsAtMs),
                                    last_order_id: orderId,
                                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                                }
                            }, { merge: true });
                        }

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
                        if (litigationSnap && litigationSnap.exists) {
                            const caseData = litigationSnap.data();
                            const currentHash = evidenceHash(caseData);
                            const update = {
                                payment_status: "PAID",
                                payment_method: "REVOLUT",
                                revolut_order_id: orderId,
                                report_unlocked: true,
                                unlocked_at: admin.firestore.FieldValue.serverTimestamp(),
                                // Seuls les payeurs (avec le pilote et l'admin) peuvent lire les données complètes
                                unlocked_for: admin.firestore.FieldValue.arrayUnion(userId),
                                // Niveau acheté par chaque assureur (plusieurs achats possibles)
                                [`paid_tiers.${userId}`]: orderData.report_type,
                            };
                            if (!caseData.evidence_sha256) {
                                // Premier paiement : le sceau est posé une fois pour toutes
                                Object.assign(update, {
                                    evidence_sha256: currentHash,
                                    sealed_at: admin.firestore.FieldValue.serverTimestamp(),
                                    sealed_by: "mon50ccetmoi-server",
                                    qualified_timestamp: null // horodatage qualifié eIDAS : à brancher
                                });
                                newlySealed = { caseId, hash: currentHash };
                            } else if (caseData.evidence_sha256 !== currentHash) {
                                // Les données ont changé depuis le premier paiement : alerte d'intégrité
                                update.integrity_alert = true;
                                console.error(`[Revolut Webhook] ALERTE INTÉGRITÉ : le dossier ${caseId} ne correspond plus à son sceau.`);
                            }
                            tx.update(litigationRef, update);
                        } else {
                            console.error(`[Revolut Webhook] Dossier de sinistre ${caseId} introuvable pour l'ordre ${orderId}`);
                        }
                    }

                    // 3. Enregistrement unique de confirmation de paiement (une par acheteur pour un sinistre)
                    tx.set(db.collection("payment_confirmations").doc(confirmationId(category, caseId, userId)), {
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

            // Facture à émettre dans Kolecto (une par commande, jamais en double)
            if (result.processed && orderDataForInvoice) {
                try {
                    const buyer = await loadInvoiceBuyer(orderDataForInvoice);
                    const invoice = buildInvoice(orderDataForInvoice, getCatalogItem(orderDataForInvoice.report_type), buyer);
                    await db.collection("invoices_to_issue").doc(orderId).set({
                        ...invoice,
                        paid_at: admin.firestore.FieldValue.serverTimestamp(),
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    console.error("[Revolut Webhook] Préparation de la facture impossible :", e.message);
                }
            }

            // Horodatage gratuit (non qualifié) de l'empreinte, hors transaction : un service
            // d'horodatage lent ou indisponible ne doit jamais bloquer ni annuler le paiement.
            if (result.processed && newlySealed) {
                try {
                    const stamps = await timestampEvidence(newlySealed.hash);
                    await db.collection("litigation_proposals").doc(newlySealed.caseId).update({ free_timestamps: stamps });
                    console.log(`[Revolut Webhook] Rapport ${newlySealed.caseId} horodaté (FreeTSA : ${stamps.rfc3161.genTime || "échec"}, OpenTimestamps : ${stamps.opentimestamps.status || "échec"})`);
                } catch (e) {
                    console.error("[Revolut Webhook] Horodatage impossible :", e.message);
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
            // Rapport de sinistre : confirmation propre à l'acheteur ; autres produits : une par dossier
            let doc = await db.collection("payment_confirmations")
                .doc(confirmationId(CATEGORIES.LITIGATION, case_id, user_id)).get();
            if (!doc.exists) {
                doc = await db.collection("payment_confirmations").doc(case_id).get();
            }

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
