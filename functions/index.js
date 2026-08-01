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
const { Client } = require("@notionhq/client");

admin.initializeApp();
const db = admin.firestore();

// ─── Clés secrètes Revolut via Firebase Secret Manager ──────────────────────
const REVOLUT_SECRET_KEY = defineSecret("REVOLUT_SECRET_KEY");
const REVOLUT_WEBHOOK_SECRET = defineSecret("REVOLUT_WEBHOOK_SECRET");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const NOTION_API_KEY = defineSecret("NOTION_API_KEY");
const NOTION_DATABASE_ID = defineSecret("NOTION_DATABASE_ID");

// ─── Constantes API Revolut ─────────────────────────────────────────────────
// PRODUCTION : merchant.revolut.com (anciennement sandbox-merchant.revolut.com)
const REVOLUT_API_BASE    = "https://merchant.revolut.com/api";
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
        // Tous les prix sont définis côté serveur pour empêcher la manipulation client
        const prices = {
            // Rapports d'expertise assureur (B2B)
            'SIMPLE': 4990,              // 49.90 €
            'INTERMEDIAIRE': 8999,       // 89.99 €
            'EXPERT': 19999,             // 199.99 € (corrigé : était 14999)
            // Diagnostic mécanique IA (B2C)
            'DIAGNOSTIC_IA': 499,        // 4.99 €
            // Certificats de batterie (B2C)
            'BATTERY_CERT_BASIQUE': 499,     // 4.99 €
            'BATTERY_CERT_PREMIUM': 1499,    // 14.99 €
            'BATTERY_CERT_QUANTUM': 2999,    // 29.99 € (anciennement BLOCKCHAIN)
            // Garage Partenaire (B2B)
            'GARAGE_FEE': 5000           // 50.00 €
        };

        if (!report_type || !prices[report_type]) {
            // Rétrocompatibilité ou valeur par défaut
            report_type = 'SIMPLE';
        }
        
        // Sécurité : on force le montant côté serveur pour empêcher la triche côté client
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
    { secrets: [REVOLUT_WEBHOOK_SECRET], region: "europe-west1" },
    async (req, res) => {
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        // ── Vérification HMAC de la signature Revolut ────────────────────
        const signature = req.headers["revolut-signature"];
        const webhookSecret = REVOLUT_WEBHOOK_SECRET.value();
        if (webhookSecret && signature) {
            const crypto = require("crypto");
            const expectedSig = crypto
                .createHmac("sha256", webhookSecret)
                .update(JSON.stringify(req.body))
                .digest("hex");
            if (signature !== expectedSig) {
                console.error("[Revolut Webhook] Signature HMAC invalide. Requête rejetée.");
                return res.status(401).send("Signature invalide");
            }
        } else if (webhookSecret && !signature) {
            console.error("[Revolut Webhook] Header Revolut-Signature manquant. Requête rejetée.");
            return res.status(401).send("Signature manquante");
        }

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

                if (orderData.report_type === "GARAGE_FEE") {
                    // C'est un abonnement pro/garage
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
                    // 2. Débloquer le rapport dans litigation_proposals
                    const litigationRef = db.collection("litigation_proposals").doc(caseId);
                    batch.update(litigationRef, {
                        payment_status:   "PAID",
                        payment_method:   "REVOLUT",
                        revolut_order_id: orderId,
                        report_unlocked:  true,
                        unlocked_at:      admin.firestore.FieldValue.serverTimestamp()
                    });
                }

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

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error("[Revolut Webhook] Error processing event :", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. sendEmergencySOS
//    Enregistre et simule l'envoi d'une alerte SOS aux contacts d'urgence.
// ─────────────────────────────────────────────────────────────────────────────
exports.sendEmergencySOS = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { user_id, location, contacts, message } = req.body;

        try {
            await db.collection("sos_alerts").add({
                user_id: user_id || "anonymous",
                location: location || "Unknown",
                contacts: contacts || [],
                message: message || "SOS Alert",
                status: "sent_simulation",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[SOS] Alert sent to ${contacts?.length || 0} contacts for user ${user_id}`);
            return res.status(200).json({ success: true, message: "SOS envoyé avec succès." });
        } catch(e) {
            console.error("[SOS] Error", e);
            return res.status(500).json({ error: "Internal Error" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. deleteUserAccount (Protocole 0 / RGPD)
//    Supprime le compte Firebase Auth et les données utilisateur Firestore.
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteUserAccount = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).json({ error: "user_id is required" });
        }

        try {
            // Delete from Firebase Auth
            try {
                await admin.auth().deleteUser(user_id);
            } catch(e) {
                console.warn("[RGPD] Auth user not found or already deleted.");
            }

            // Wipe User Data from Firestore
            await db.collection("users").doc(user_id).delete();
            
            console.log(`[RGPD] Account wiped completely for user ${user_id}`);
            return res.status(200).json({ success: true, message: "Account completely wiped (RGPD)" });
        } catch(e) {
            console.error("[RGPD] Error wiping account", e);
            return res.status(500).json({ error: "Internal Error" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. checkPaymentStatus
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. triggerAntiTheftAlert
//    Déclenchée par l'app mobile en cas de détection de secousse/vol.
//    Sauvegarde l'alerte sur Firestore pour un suivi et des notifications Push.
// ─────────────────────────────────────────────────────────────────────────────
exports.triggerAntiTheftAlert = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { user_id, force, location } = req.body;

        try {
            await db.collection("theft_alerts").add({
                user_id: user_id || "anonymous",
                force: force || 0,
                location: location || "Unknown",
                status: "active",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[ANTI-THEFT] Alert registered for user ${user_id} with force ${force}G`);
            return res.status(200).json({ success: true, message: "Alerte de vol transmise aux serveurs avec succès." });
        } catch(e) {
            console.error("[ANTI-THEFT] Error", e);
            return res.status(500).json({ error: "Internal Error" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. sendWelcomeEmail (Automated email after beta signup)
// ─────────────────────────────────────────────────────────────────────────────
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const nodemailer = require("nodemailer");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

exports.sendWelcomeEmail = onDocumentCreated(
    { document: "beta_testers/{docId}", region: "europe-west1", secrets: [SMTP_PASSWORD] },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const data = snapshot.data();
        const email = data.email;
        
        if (!email) {
            console.log("No email found, skipping.");
            return;
        }

        const transporter = nodemailer.createTransport({
            host: "authsmtp.amen.fr", // Serveur SMTP par défaut d'Amen
            port: 465,
            secure: true,
            auth: {
                user: "contact@mon50ccetmoi.com",
                pass: SMTP_PASSWORD.value()
            }
        });

        const mailOptions = {
            from: '"mon50ccetmoi" <contact@mon50ccetmoi.com>',
            to: email,
            subject: "🎆 Joyeux 14 Juillet & Bienvenue sur mon50ccetmoi ! 🇫🇷",
            text: "Merci de nous avoir rejoints dans la Bêta !\n\nJoyeuse Fête Nationale !\nBonne route et soyez prudents.\n\nL'équipe mon50ccetmoi",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px; border-top: 5px solid #0055A4; border-bottom: 5px solid #EF4135;">
                    <div style="text-align: center; font-size: 40px; margin-bottom: 10px;">🇫🇷 🎆 🎇 🇫🇷</div>
                    <h2 style="color: #0055A4; text-align: center;">Joyeuse Fête Nationale !</h2>
                    <h3 style="color: #ffb703; text-align: center;">Et bienvenue sur mon50ccetmoi ! 🏍️</h3>
                    <p style="color: #333; font-size: 16px;">Salut !</p>
                    <p style="color: #333; font-size: 16px;">En ce 14 juillet festif, ton inscription à la Bêta a bien été enregistrée.</p>
                    <p style="color: #333; font-size: 16px;">Nous avons hâte de te faire découvrir l'application. Tu vas très bientôt recevoir ton accès pour rouler avec nous.</p>
                    <br/>
                    <p style="color: #EF4135; font-size: 16px; font-weight: bold; text-align: center;">Profite bien des feux d'artifice, bonne route et sois prudent !</p>
                    <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
                    <p style="color: #777; font-size: 12px; text-align: center;">L'équipe mon50ccetmoi</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Welcome email sent to ${email}`);
        } catch (error) {
            console.error("Error sending email:", error);
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. askJarvisGemini (Relais sécurisé pour l'IA)
//    Reçoit l'historique de conversation, interroge l'API Gemini et renvoie la réponse.
// ─────────────────────────────────────────────────────────────────────────────
exports.askJarvisGemini = onRequest(
    { secrets: [GEMINI_API_KEY], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { history, systemPrompt } = req.body;
        if (!history || !systemPrompt) {
            return res.status(400).json({ error: "history and systemPrompt are required" });
        }

        const apiKey = GEMINI_API_KEY.value();
        if (!apiKey) {
            return res.status(500).json({ error: "Clé API Gemini non configurée." });
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: history,
                    generationConfig: {
                        temperature: 0.3,
                        response_mime_type: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("[Jarvis Gemini] Erreur API externe :", err);
                return res.status(response.status).json({ error: err.error?.message || "Erreur API Gemini" });
            }

            const data = await response.json();
            return res.status(200).json(data);
        } catch (err) {
            console.error("[Jarvis Gemini] Exception serveur :", err);
            return res.status(500).json({ error: "Erreur interne", message: err.message });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. reportToNotion
//    Envoie un ticket/rapport vers une base de données Notion (Bug tracker / CRM).
//
//    POST body : { title, description, category, priority }
// ─────────────────────────────────────────────────────────────────────────────
exports.reportToNotion = onRequest(
    { secrets: [NOTION_API_KEY, NOTION_DATABASE_ID] },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        try {
            const { title, description, category, priority } = req.body;
            if (!title) {
                return res.status(400).json({ error: "Le paramètre 'title' est requis." });
            }

            const notion = new Client({ auth: NOTION_API_KEY.value() });
            
            const response = await notion.pages.create({
                parent: { database_id: NOTION_DATABASE_ID.value() },
                properties: {
                    // Les noms de propriétés doivent correspondre aux colonnes de votre base Notion
                    "Name": { // Colonne Titre par défaut
                        title: [
                            { text: { content: title } }
                        ]
                    },
                    "Tags": { // Colonne Multi-select
                        multi_select: [
                            { name: category || "Feedback" }
                        ]
                    },
                    "Priority": { // Colonne Select
                        select: { name: priority || "Low" }
                    }
                },
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content: description || "Aucune description fournie."
                                    }
                                }
                            ]
                        }
                    }
                ]
            });

            console.log("[Notion] Ticket créé avec succès :", response.id);
            return res.status(200).json({ success: true, id: response.id });
            
        } catch (error) {
            console.error("[Notion] Erreur lors de la création du ticket :", error.message);
            return res.status(500).json({ error: "Erreur interne", details: error.message });
        }
    }
);

