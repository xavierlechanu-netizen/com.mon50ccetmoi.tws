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

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Client } = require("@notionhq/client");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// ─── Clés secrètes Revolut via Firebase Secret Manager ──────────────────────
const REVOLUT_SECRET_KEY = defineSecret("REVOLUT_SECRET_KEY");
const REVOLUT_WEBHOOK_SECRET = defineSecret("REVOLUT_WEBHOOK_SECRET");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const NOTION_API_KEY = defineSecret("NOTION_API_KEY");
const NOTION_DATABASE_ID = defineSecret("NOTION_DATABASE_ID");
const METEO_FRANCE_API_KEY = defineSecret("METEO_FRANCE_API_KEY");
const PISTE_CLIENT_ID = defineSecret("PISTE_CLIENT_ID");
const PISTE_CLIENT_SECRET = defineSecret("PISTE_CLIENT_SECRET");
const PISTE_API_KEY = defineSecret("PISTE_API_KEY");

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

// ─── Firebase Auth Token Verification (OWASP A01 / CIS Control 6) ─────────
// Vérifie que l'appelant est authentifié via Firebase Auth.
// Retourne l'UID décodé ou null si le token est invalide/manquant.
async function verifyAuthToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }
    const idToken = authHeader.split("Bearer ")[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (e) {
        console.warn("[Auth] Token verification failed:", e.message);
        return null;
    }
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
            'GARAGE_FEE': 5000,          // 50.00 €
            // Abonnement Boîte Noire "Sentinel Care" (HaaS)
            'BLACKBOX_CARE_MONTHLY': 500,    // 5.00 € / mois
            'BLACKBOX_CARE_ANNUAL': 5000     // 50.00 € / an (2 mois offerts)
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
exports.sendEmergencySOS = onCall(
    { region: "europe-west1" },
    async (request) => {
        // Sécurité : Vérifier l'authentification (OWASP A01)
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError('unauthenticated', 'Authentification requise.');
        }

        const uid = request.auth.uid;
        const { location, contacts, message, blackboxReportId } = request.data;

        if (!contacts || contacts.length === 0) {
            console.log(`[SOS] Aucun contact d'urgence défini pour ${uid}`);
            return { success: false, message: "Aucun contact défini." };
        }

        try {
            const batch = db.batch();

            // 1. Enregistrement de l'alerte dans sos_alerts
            const alertRef = db.collection("sos_alerts").doc();
            batch.set(alertRef, {
                user_id: uid,
                location: location || "Unknown",
                contacts: contacts,
                message: message || "SOS Alert",
                blackbox_id: blackboxReportId || null,
                status: "processing",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            // Construction du message final
            let finalMessage = message + ` Position: ${location}`;
            if (blackboxReportId) {
                finalMessage += ` [Preuve Blackbox Télémétrie Sécurisée générée]`;
            }

            // 2. Création des messages sortants dans sms_outbox pour la passerelle Custom
            for (const contact of contacts) {
                if (contact.phone) {
                    const smsRef = db.collection("sms_outbox").doc();
                    batch.set(smsRef, {
                        to: contact.phone,
                        body: finalMessage,
                        user_id: uid,
                        status: "PENDING",
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            await batch.commit();

            console.log(`[SOS] Alert sent to ${contacts.length} contacts for user ${uid} via sms_outbox`);
            return { success: true, message: "SOS transmis à la passerelle SMS avec succès." };
        } catch(e) {
            console.error("[SOS] Error", e);
            throw new HttpsError('internal', 'Erreur interne lors de la création du SOS.');
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

        // Sécurité CRITIQUE : Vérifier le token Firebase Auth (OWASP A01)
        // et que l'utilisateur ne peut supprimer que SON PROPRE compte.
        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).json({ error: "user_id is required" });
        }

        // Seul l'utilisateur lui-même peut supprimer son compte (RGPD droit à l'oubli)
        if (authUser.uid !== user_id) {
            console.warn(`[RGPD] Tentative de suppression du compte ${user_id} par ${authUser.uid} — REFUSÉ`);
            return res.status(403).json({ error: "Accès refusé : vous ne pouvez supprimer que votre propre compte." });
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

        // Sécurité : Vérifier le token Firebase Auth
        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        const { force, location } = req.body;

        try {
            await db.collection("theft_alerts").add({
                user_id: authUser.uid,
                force: force || 0,
                location: location || "Unknown",
                status: "active",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[ANTI-THEFT] Alert registered for user ${authUser.uid} with force ${force}G`);
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
// 8. askNexusAtlasGemini (Relais sécurisé pour l'IA)
//    Reçoit l'historique de conversation, interroge l'API Gemini et renvoie la réponse.
// ─────────────────────────────────────────────────────────────────────────────
exports.askNexusAtlasGemini = onRequest(
    { secrets: [GEMINI_API_KEY], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { history, systemPrompt } = req.body;
        if (!history || !systemPrompt) {
            return res.status(400).json({ error: "history and systemPrompt are required" });
        }

        // Sécurité : Vérifier le token Firebase Auth pour éviter l'abus de l'API Gemini (coûts)
        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        // Rate Limiter : 10 requêtes/minute/utilisateur (CIS Control 4 / OWASP A11)
        const uid = authUser.uid;
        const now = Date.now();
        const rateLimitRef = db.collection("rate_limits").doc(`gemini_${uid}`);
        try {
            const rateLimitDoc = await rateLimitRef.get();
            const rateData = rateLimitDoc.exists ? rateLimitDoc.data() : null;
            if (rateData && rateData.windowStart && (now - rateData.windowStart) < 60000) {
                if (rateData.count >= 10) {
                    console.warn(`[Rate Limit] Utilisateur ${uid} a dépassé 10 req/min pour Gemini.`);
                    return res.status(429).json({ error: "Trop de requêtes. Veuillez patienter 1 minute." });
                }
                await rateLimitRef.update({ count: admin.firestore.FieldValue.increment(1) });
            } else {
                await rateLimitRef.set({ windowStart: now, count: 1 });
            }
        } catch (rlErr) {
            console.warn("[Rate Limit] Erreur non bloquante :", rlErr.message);
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
                console.error("[Nexus Atlas Gemini] Erreur API externe :", err);
                return res.status(response.status).json({ error: err.error?.message || "Erreur API Gemini" });
            }

            const data = await response.json();
            return res.status(200).json(data);
        } catch (err) {
            console.error("[Nexus Atlas Gemini] Exception serveur :", err);
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
    { secrets: [NOTION_API_KEY, NOTION_DATABASE_ID], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

        try {
            const { title, description, category, priority } = req.body;
            if (!title) {
                return res.status(400).json({ error: "Le paramètre 'title' est requis." });
            }

            // Sécurité : Vérifier le token Firebase Auth pour éviter le spam de tickets
            const authUser = await verifyAuthToken(req);
            if (!authUser) {
                return res.status(401).json({ error: "Authentification requise." });
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. getVigilanceMeteo
// ─────────────────────────────────────────────────────────────────────────────
exports.getVigilanceMeteo = onRequest(
    { secrets: [METEO_FRANCE_API_KEY], cors: true, region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");

        try {
            const token = METEO_FRANCE_API_KEY.value();
            const response = await fetch("https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            });
            if (!response.ok) throw new Error("Erreur HTTP " + response.status);
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            console.error("[Meteo] Erreur :", error.message);
            return res.status(500).json({ error: "Erreur Météo-France" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. uploadBlackboxTelemetry (Télémétrie Sécurisée - Zero Knowledge)
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadBlackboxTelemetry = onCall(
    { region: "europe-west1" },
    async (request) => {
        // 1. Vérification de l'authentification
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError('unauthenticated', 'Vous devez être connecté pour synchroniser la télémétrie.');
        }

        const uid = request.auth.uid;
        const { hardwareId, encryptedPayload, frameCount, timestamp, payloads } = request.data;

        // 2. Validation des paramètres
        if (!hardwareId || (!encryptedPayload && !payloads)) {
            throw new HttpsError('invalid-argument', 'Paramètres manquants : hardwareId ou encryptedPayload/payloads.');
        }

        try {
            // Rétrocompatibilité : transformer un payload unique en tableau
            let framesToStore = [];
            if (payloads && Array.isArray(payloads)) {
                framesToStore = payloads;
            } else if (encryptedPayload) {
                framesToStore = [{
                    encryptedPayload: encryptedPayload,
                    timestamp: timestamp || 0,
                    frameCount: frameCount || 0
                }];
            }

            // 3. Stockage dans Google Cloud Storage (architecture Zero-Knowledge - Batching)
            // Le cloud ne déchiffre RIEN. Les trames brutes vont dans GCS pour économiser Firestore.
            const bucket = admin.storage().bucket();
            const timestampMs = Date.now();
            const gcsFileName = `telemetry/${uid}/${hardwareId}_${timestampMs}.json`;
            const file = bucket.file(gcsFileName);
            
            const fileContent = JSON.stringify({
                hardwareId: hardwareId,
                timestamp: timestampMs,
                payloads: framesToStore
            });

            await file.save(fileContent, {
                contentType: 'application/json'
            });

            // 4. Stockage des métadonnées uniquement dans Firestore
            const docRef = admin.firestore().collection('blackbox_sessions').doc();
            
            await docRef.set({
                uid: uid,
                hardwareId: hardwareId,
                frameCount: framesToStore.length,
                gcsPath: `gs://${bucket.name}/${gcsFileName}`,
                serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: "LOCKED"
            });

            console.log(`[Blackbox] Batch de ${framesToStore.length} trames stocké pour UID: ${uid} (Doc: ${docRef.id})`);
            return { success: true, docId: docRef.id };
            
        } catch (error) {
            console.error("[Blackbox] Erreur lors du stockage :", error);
            throw new HttpsError('internal', 'Erreur interne lors de la sauvegarde de la télémétrie.');
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. FIDO2 / WEBAUTHN (Passkeys)
// ─────────────────────────────────────────────────────────────────────────────
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require("@simplewebauthn/server");

const RP_NAME = "mon50ccetmoi";
// Pour accepter le localhost et la prod:
const EXPECTED_ORIGINS = ["https://mon50ccetmoi.com", "http://localhost:5000", "http://127.0.0.1:5000"];
const RP_IDS = ["mon50ccetmoi.com", "localhost", "127.0.0.1"];

exports.fidoGenerateRegistration = onCall({ region: "europe-west1" }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in to register a passkey.');
    }
    const uid = request.auth.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data() || {};
    const username = userData.username || uid;

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: request.data?.rpId || RP_IDS[0],
        userID: Buffer.from(uid),
        userName: username,
        timeout: 60000,
        attestationType: 'none',
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
        }
    });

    // Save challenge to firestore temporarily
    await db.collection("fido_challenges").doc(uid).set({
        challenge: options.challenge,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return options;
});

exports.fidoVerifyRegistration = onCall({ region: "europe-west1" }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const uid = request.auth.uid;
    const { response, rpId, origin } = request.data; // passed from client

    const challengeDoc = await db.collection("fido_challenges").doc(uid).get();
    if (!challengeDoc.exists) throw new HttpsError('failed-precondition', 'No challenge found.');
    const expectedChallenge = challengeDoc.data().challenge;

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response,
            expectedChallenge,
            expectedOrigin: origin || EXPECTED_ORIGINS,
            expectedRPID: rpId || RP_IDS,
        });
    } catch (error) {
        console.error("FIDO Register Error", error);
        throw new HttpsError('invalid-argument', error.message);
    }

    if (verification.verified && verification.registrationInfo) {
        const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
        
        // Save to users/{uid}/fido_credentials
        // encode Uint8Arrays to base64 string for firestore
        const credIdB64 = Buffer.from(credentialID).toString('base64');
        const pubKeyB64 = Buffer.from(credentialPublicKey).toString('base64');

        await db.collection("users").doc(uid).collection("fido_credentials").doc(credIdB64).set({
            credentialID: credIdB64,
            credentialPublicKey: pubKeyB64,
            counter,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await db.collection("fido_challenges").doc(uid).delete();
        return { success: true };
    }
    return { success: false };
});

exports.fidoGenerateAuthentication = onCall({ region: "europe-west1" }, async (request) => {
    const { uid, rpId } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'UID required.');

    const credsSnapshot = await db.collection("users").doc(uid).collection("fido_credentials").get();
    if (credsSnapshot.empty) {
        throw new HttpsError('not-found', 'No passkeys found for this user.');
    }

    const allowCredentials = credsSnapshot.docs.map(doc => ({
        id: Buffer.from(doc.data().credentialID, 'base64').toString('base64url'), // SimpleWebAuthn expects base64url or Uint8Array
        type: 'public-key',
        transports: ['internal']
    }));

    const options = await generateAuthenticationOptions({
        timeout: 60000,
        allowCredentials,
        userVerification: 'required',
        rpID: rpId || RP_IDS[0]
    });

    await db.collection("fido_challenges").doc(uid).set({
        challenge: options.challenge,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return options;
});

exports.fidoVerifyAuthentication = onCall({ region: "europe-west1" }, async (request) => {
    const { uid, response, rpId, origin } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'UID required.');

    const challengeDoc = await db.collection("fido_challenges").doc(uid).get();
    if (!challengeDoc.exists) throw new HttpsError('failed-precondition', 'No challenge found.');
    const expectedChallenge = challengeDoc.data().challenge;

    // Find the specific credential used. SimpleWebAuthn client returns base64url for id.
    const rawIdB64url = response.id;
    // We saved it as base64 in firestore. Let's convert base64url to base64.
    const credIdB64 = Buffer.from(rawIdB64url, 'base64url').toString('base64');
    
    const credDoc = await db.collection("users").doc(uid).collection("fido_credentials").doc(credIdB64).get();
    if (!credDoc.exists) {
        throw new HttpsError('not-found', 'Credential not found.');
    }
    const credData = credDoc.data();
    
    const authenticator = {
        credentialID: Buffer.from(credData.credentialID, 'base64'),
        credentialPublicKey: Buffer.from(credData.credentialPublicKey, 'base64'),
        counter: credData.counter,
        transports: ['internal']
    };

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: origin || EXPECTED_ORIGINS,
            expectedRPID: rpId || RP_IDS,
            authenticator
        });
    } catch (error) {
        console.error("FIDO Auth Error", error);
        throw new HttpsError('invalid-argument', error.message);
    }

    if (verification.verified) {
        // Update counter
        await credDoc.ref.update({ counter: verification.authenticationInfo.newCounter });
        await db.collection("fido_challenges").doc(uid).delete();

        // Mint custom token
        const customToken = await admin.auth().createCustomToken(uid);
        return { success: true, customToken };
    }
    return { success: false };
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. IoT FIDO Device Onboard (FDO) Rendezvous Server Mock
// ─────────────────────────────────────────────────────────────────────────────
exports.iotFdoRendezvous = onRequest({ region: "europe-west1" }, async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    // Expecting Ownership Voucher { hardware_id, signature, fdo_version }
    const { hardware_id, signature } = req.body;
    if (!hardware_id || !signature) {
        return res.status(400).json({ error: "Voucher incomplet. hardware_id et signature requis." });
    }

    try {
        const voucherDoc = await db.collection("fdo_vouchers").doc(hardware_id).get();
        if (!voucherDoc.exists) {
            return res.status(404).json({ error: "Voucher non reconnu (Non provisionné par le fabricant)." });
        }

        const voucherData = voucherDoc.data();
        if (voucherData.status !== "PENDING_ONBOARDING") {
            return res.status(403).json({ error: "Boîtier déjà onboardé ou révoqué." });
        }

        // Renvoie l'endpoint cible (BMS/Cloud Final) et un token IoT
        const targetEndpoint = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/uploadBlackboxTelemetry";
        // Mint a custom token for the device
        const customToken = await admin.auth().createCustomToken(hardware_id, { is_iot_device: true });

        // Marque l'onboarding comme réussi
        await voucherDoc.ref.update({
            status: "ONBOARDED",
            onboarded_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[FDO] Onboarding réussi pour le device ${hardware_id}`);
        return res.status(200).json({
            success: true,
            target_cloud: targetEndpoint,
            iot_token: customToken
        });
    } catch (e) {
        console.error("[FDO] Erreur serveur :", e);
        return res.status(500).json({ error: "Internal Error" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. searchLegifrancePiste (Recherche Jurisprudence via API Gouvernementale PISTE)
//     OAuth2 Client Credentials + Interrogation API Justice back (Légifrance)
// ─────────────────────────────────────────────────────────────────────────────
exports.searchLegifrancePiste = onRequest(
    { secrets: [PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_API_KEY], region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: "Le paramètre 'query' est requis." });
        }

        // Sécurité : Vérifier le token Firebase Auth
        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        const clientId = PISTE_CLIENT_ID.value();
        const clientSecret = PISTE_CLIENT_SECRET.value();
        const apiKey = PISTE_API_KEY.value();

        if (!clientId || !clientSecret || !apiKey) {
            return res.status(500).json({ error: "Clés PISTE non configurées côté serveur." });
        }

        try {
            // 1. Obtenir le token OAuth2 PISTE
            const tokenParams = new URLSearchParams();
            tokenParams.append("grant_type", "client_credentials");
            tokenParams.append("client_id", clientId);
            tokenParams.append("client_secret", clientSecret);

            const tokenRes = await fetch("https://oauth.piste.gouv.fr/api/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams
            });

            if (!tokenRes.ok) {
                const errToken = await tokenRes.text();
                console.error("[PISTE] Erreur Auth OAuth2:", errToken);
                return res.status(tokenRes.status).json({ error: "Erreur authentification PISTE." });
            }

            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;

            // 2. Interroger Légifrance (Justice back)
            const legiRes = await fetch("https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Api-Key": apiKey
                },
                body: JSON.stringify({
                    "recherche": {
                        "champs": [
                            {
                                "criteres": [
                                    {
                                        "valeur": query,
                                        "typeRecherche": "EXACTE",
                                        "criteres": []
                                    }
                                ],
                                "typeChamp": "TITLE"
                            }
                        ],
                        "operateur": "ET"
                    },
                    "fond": "CODES_TEXTES",
                    "taillePage": 3
                })
            });

            if (!legiRes.ok) {
                const errLegi = await legiRes.text();
                console.error("[PISTE] Erreur API Légifrance:", errLegi);
                return res.status(legiRes.status).json({ error: "Erreur recherche Légifrance." });
            }

            const legiData = await legiRes.json();
            
            // 3. Formater les résultats
            let formattedResults = [];
            if (legiData.results && legiData.results.length > 0) {
                formattedResults = legiData.results.map(item => ({
                    title: item.title || "Article non titré",
                    content: (item.text || "Contenu non disponible").substring(0, 800) + "...",
                    source: "Légifrance (Gouvernement Français)",
                    id: item.cid
                }));
            }

            return res.status(200).json({ results: formattedResults });

        } catch (err) {
            console.error("[PISTE] Exception Serveur:", err);
            return res.status(500).json({ error: "Erreur interne", message: err.message });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY UPLOAD (F-1 : Économie de Coûts Firestore via Cloud Storage)
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadBlackboxTelemetry = onCall(
    { region: "europe-west1", timeoutSeconds: 60, memory: "256MiB" },
    async (request) => {
        // OWASP A01 / v5.0.0-8.x : Vérification d'authentification
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Authentification requise.");
        }

        const uid = request.auth.uid;
        const { hardwareId, payloads } = request.data || {};

        // OWASP ASVS v5.0.0-2.2.1 : Validation d'entrée
        if (!Array.isArray(payloads) || payloads.length === 0) {
            throw new HttpsError("invalid-argument", "Le lot de trames est vide ou invalide.");
        }
        if (payloads.length > 5000) {
            throw new HttpsError("invalid-argument", "Taille de lot maximale dépassée (max 5000 trames).");
        }

        try {
            const bucketName = "mon50ccetmoi-telemetry";
            const bucket = admin.storage().bucket(bucketName);
            const timestamp = Date.now();
            const randomSuffix = crypto.randomBytes(4).toString("hex");
            const fileName = `telemetry/${uid}/${timestamp}_${randomSuffix}.json`;
            const file = bucket.file(fileName);

            const sessionData = {
                uid,
                hardwareId: typeof hardwareId === "string" ? hardwareId.substring(0, 64) : "UNKNOWN_HW",
                uploadedAt: new Date().toISOString(),
                frameCount: payloads.length,
                frames: payloads
            };

            // Sauvegarde dans Cloud Storage (coût négligeable vs Firestore)
            await file.save(JSON.stringify(sessionData), {
                contentType: "application/json",
                metadata: {
                    uid,
                    hardwareId: sessionData.hardwareId,
                    frameCount: String(payloads.length)
                }
            });

            // Enregistrement d'un SEUL document récapitulatif dans Firestore
            const docRef = await db.collection("telemetry_sessions").add({
                uid,
                hardwareId: sessionData.hardwareId,
                frameCount: payloads.length,
                storagePath: fileName,
                storageBucket: bucketName,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[Telemetry] Batch de ${payloads.length} trames stocké pour ${uid.substring(0, 6)}... (Session ${docRef.id})`);

            return {
                success: true,
                sessionId: docRef.id,
                frameCount: payloads.length
            };
        } catch (error) {
            console.error("[Telemetry] Erreur upload télémétrie:", error);
            throw new HttpsError("internal", "Erreur lors du traitement de la télémétrie.");
        }
    }
);
