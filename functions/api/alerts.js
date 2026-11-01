const {
    onRequest, onCall, HttpsError, admin, db,
    setCorsHeaders, verifyAuthToken, maskUid
} = require("./shared");

const MAX_SOS_CONTACTS = 5;
const PHONE_REGEX = /^\+?[\d\s()-]{6,20}$/;

exports.sendEmergencySOS = onCall(
    { region: "europe-west1" },
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Authentification requise.");
        }

        const uid = request.auth.uid;
        const { location, contacts, message, blackboxReportId } = request.data || {};

        if (!Array.isArray(contacts) || contacts.length === 0) {
            console.log(`[SOS] Aucun contact d'urgence défini pour ${maskUid(uid)}`);
            return { success: false, message: "Aucun contact défini." };
        }

        // Protection anti-amplification SMS (OWASP ASVS v5.0.0-2.4.1)
        const safeContacts = contacts
            .slice(0, MAX_SOS_CONTACTS)
            .filter((c) => c && typeof c.phone === "string" && PHONE_REGEX.test(c.phone.trim()));

        if (safeContacts.length === 0) {
            throw new HttpsError("invalid-argument", "Aucun numéro de téléphone valide fourni.");
        }

        const safeLocation = typeof location === "string" ? location.substring(0, 150) : "Unknown";
        const safeMessage = typeof message === "string" && message.trim().length > 0
            ? message.substring(0, 300)
            : "SOS Alert";
        const safeReportId = typeof blackboxReportId === "string" ? blackboxReportId.substring(0, 100) : null;

        // Rate-limiting transactionnel (max 3 SOS par fenêtre de 10 minutes)
        const SOS_WINDOW_MS = 10 * 60 * 1000;
        const SOS_MAX_CALLS = 3;
        const rateLimitRef = db.collection("rate_limits").doc(`sos_${uid}`);

        try {
            await db.runTransaction(async (tx) => {
                const rlDoc = await tx.get(rateLimitRef);
                const now = Date.now();
                if (rlDoc.exists) {
                    const data = rlDoc.data();
                    const windowStart = data.windowStart || 0;
                    const count = data.count || 0;
                    if (now - windowStart < SOS_WINDOW_MS && count >= SOS_MAX_CALLS) {
                        throw new HttpsError("resource-exhausted", "Trop d'alertes SOS rapprochées. Veuillez patienter.");
                    }
                    if (now - windowStart >= SOS_WINDOW_MS) {
                        tx.set(rateLimitRef, { windowStart: now, count: 1 });
                    } else {
                        tx.update(rateLimitRef, { count: admin.firestore.FieldValue.increment(1) });
                    }
                } else {
                    tx.set(rateLimitRef, { windowStart: now, count: 1 });
                }
            });

            const batch = db.batch();

            const alertRef = db.collection("sos_alerts").doc();
            batch.set(alertRef, {
                user_id: uid,
                authorUid: uid,
                location: safeLocation,
                contacts: safeContacts,
                message: safeMessage,
                blackbox_id: safeReportId,
                status: "processing",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            let finalMessage = `${safeMessage} Position: ${safeLocation}`;
            if (safeReportId) {
                finalMessage += " [Preuve Blackbox Télémétrie Sécurisée générée]";
            }

            for (const contact of safeContacts) {
                const smsRef = db.collection("sms_outbox").doc();
                batch.set(smsRef, {
                    to: contact.phone.trim(),
                    body: finalMessage,
                    user_id: uid,
                    status: "PENDING",
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            await batch.commit();

            console.log(`[SOS] Alert sent to ${safeContacts.length} contacts for user ${maskUid(uid)} via sms_outbox`);
            return { success: true, message: "SOS transmis à la passerelle SMS avec succès." };
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            console.error("[SOS] Error", e);
            throw new HttpsError("internal", "Erreur interne lors de la création du SOS.");
        }
    }
);

exports.triggerAntiTheftAlert = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        const { force, location } = req.body || {};
        const safeForce = typeof force === "number" && Number.isFinite(force) ? Math.min(Math.max(force, 0), 100) : 0;
        const safeLocation = typeof location === "string" ? location.substring(0, 150) : "Unknown";

        try {
            await db.collection("theft_alerts").add({
                user_id: authUser.uid,
                force: safeForce,
                location: safeLocation,
                status: "active",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[ANTI-THEFT] Alert registered for user ${maskUid(authUser.uid)} with force ${safeForce}G`);
            return res.status(200).json({ success: true, message: "Alerte de vol transmise aux serveurs avec succès." });
        } catch (e) {
            console.error("[ANTI-THEFT] Error", e);
            return res.status(500).json({ error: "Internal Error" });
        }
    }
);

exports.createHazardReport = onCall(
    { region: "europe-west1" },
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Authentification requise.");
        }

        const uid = request.auth.uid;
        const { type, lat, lng, description } = request.data || {};

        if (!type || lat === undefined || lng === undefined) {
            throw new HttpsError("invalid-argument", "Type, latitude et longitude requis.");
        }
        const allowedTypes = ["pothole", "accident", "police", "roadwork", "obstacle", "weather", "other"];
        if (!allowedTypes.includes(type)) {
            throw new HttpsError("invalid-argument", "Type de danger non reconnu.");
        }
        if (typeof lat !== "number" || typeof lng !== "number" ||
            !Number.isFinite(lat) || !Number.isFinite(lng) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new HttpsError("invalid-argument", "Coordonnées GPS invalides.");
        }

        const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
        const RATE_LIMIT_MAX = 5;
        const rateLimitRef = db.collection("rate_limits").doc(`hazard_${uid}`);

        try {
            // Vérification et incrémentation atomiques (OWASP ASVS v5.0.0-2.3.3 & 2.4.1)
            await db.runTransaction(async (tx) => {
                const rateLimitDoc = await tx.get(rateLimitRef);
                const now = Date.now();

                if (rateLimitDoc.exists) {
                    const data = rateLimitDoc.data();
                    const windowStart = data.windowStart || 0;
                    const count = data.count || 0;

                    if (now - windowStart < RATE_LIMIT_WINDOW_MS && count >= RATE_LIMIT_MAX) {
                        throw new HttpsError(
                            "resource-exhausted",
                            `Limite atteinte : maximum ${RATE_LIMIT_MAX} signalements par ${RATE_LIMIT_WINDOW_MS / 60000} minutes.`
                        );
                    }

                    if (now - windowStart >= RATE_LIMIT_WINDOW_MS) {
                        tx.set(rateLimitRef, { windowStart: now, count: 1 });
                    } else {
                        tx.update(rateLimitRef, { count: admin.firestore.FieldValue.increment(1) });
                    }
                } else {
                    tx.set(rateLimitRef, { windowStart: now, count: 1 });
                }
            });

            const hazardData = {
                type,
                lat,
                lng,
                description: typeof description === "string" ? description.substring(0, 500) : "",
                userId: uid,
                authorUid: uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                votes: 0,
                active: true
            };

            const docRef = await db.collection("hazards").add(hazardData);
            console.log(`[Hazard] Signalement ${type} créé par ${maskUid(uid)} (${docRef.id})`);

            return { success: true, hazardId: docRef.id };
        } catch (error) {
            if (error instanceof HttpsError) throw error;
            console.error("[Hazard] Erreur création signalement:", error);
            throw new HttpsError("internal", "Erreur lors de la création du signalement.");
        }
    }
);
