const {
    onRequest, onCall, HttpsError, admin, db,
    setCorsHeaders, verifyAuthToken
} = require("./shared");
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require("@simplewebauthn/server");

const RP_NAME = "mon50ccetmoi";
const EXPECTED_ORIGINS = ["https://mon50ccetmoi.com", "http://localhost:5000", "http://127.0.0.1:5000"];
const RP_IDS = ["mon50ccetmoi.com", "localhost", "127.0.0.1"];

exports.deleteUserAccount = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        setCorsHeaders(res);
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

        const authUser = await verifyAuthToken(req);
        if (!authUser) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).json({ error: "user_id is required" });
        }

        if (authUser.uid !== user_id) {
            console.warn(`[RGPD] Tentative de suppression du compte ${user_id} par ${authUser.uid} — REFUSÉ`);
            return res.status(403).json({ error: "Accès refusé : vous ne pouvez supprimer que votre propre compte." });
        }

        try {
            try {
                await admin.auth().deleteUser(user_id);
            } catch(e) {
                console.warn("[RGPD] Auth user not found or already deleted.");
            }

            const batch = db.batch();
            
            batch.delete(db.collection("users").doc(user_id));
            batch.delete(db.collection("fido_challenges").doc(user_id));
            batch.delete(db.collection("ants_wallet").doc(user_id));
            batch.delete(db.collection("rate_limits").doc(`gemini_${user_id}`));
            batch.delete(db.collection("rate_limits").doc(`payment_poll_${user_id}`));
            batch.delete(db.collection("gamification_stats").doc(user_id));
            batch.delete(db.collection("social_radar").doc(user_id));
            
            const fidoDocs = await db.collection("users").doc(user_id).collection("fido_credentials").get();
            fidoDocs.forEach(doc => batch.delete(doc.ref));
            
            await batch.commit();

            // Détacher les boîtiers matériels (RGPD Art. 17 : purge des PII mais conservation de la traçabilité produit)
            try {
                const unitsSnap = await db.collection("blackbox_units").where("ownerUid", "==", user_id).get();
                if (!unitsSnap.empty) {
                    const uBatch = db.batch();
                    unitsSnap.forEach(uDoc => {
                        uBatch.update(uDoc.ref, {
                            ownerUid: null,
                            saleOrderId: null,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        const hRef = uDoc.ref.collection("history").doc();
                        uBatch.set(hRef, {
                            action: "OWNER_DELETED_RGPD",
                            reason: "Purge compte RGPD Art. 17",
                            timestamp: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await uBatch.commit();
                }
            } catch (bbErr) {
                console.warn("[RGPD] Erreur détachement boîtier Blackbox:", bbErr.message);
            }

            const queries = [
                { coll: "revolut_orders", field: "user_id" },
                { coll: "payment_confirmations", field: "user_id" },
                { coll: "blackbox_sales", field: "userId" },
                { coll: "sos_alerts", field: "user_id" },
                { coll: "sms_outbox", field: "user_id" },
                { coll: "theft_alerts", field: "user_id" },
                { coll: "emergency_alerts", field: "userId" },
                { coll: "crash_reports", field: "userId" },
                { coll: "telemetry_sessions", field: "uid" },
                { coll: "blackbox_reports", field: "userId" },
                { coll: "balades", field: "userId" },
                { coll: "obd_sessions", field: "userId" },
                { coll: "roadbooks", field: "authorUid" },
                { coll: "community_roadbooks", field: "userId" },
                { coll: "guardian_sessions", field: "userId" },
                { coll: "cortege_sessions", field: "leaderId" },
                { coll: "convoys", field: "leaderUid" },
                { coll: "hazards", field: "authorUid" },
                { coll: "moods", field: "userId" },
                { coll: "pit_stops", field: "authorUid" },
                { coll: "garage_trades", field: "authorUid" },
                { coll: "exchange_listings", field: "userId" },
                { coll: "exchange_messages", field: "fromUid" },
                { coll: "litigation_proposals", field: "userId" },
                { coll: "maintenance_logs", field: "vehicleOwnerUid" },
                { coll: "battery_certificates", field: "userId" },
                { coll: "garage_evaluations", field: "userId" },
                { coll: "presence", field: "userId" },
            ];

            for (const q of queries) {
                let hasMore = true;
                while (hasMore) {
                    const snapshot = await db.collection(q.coll).where(q.field, "==", user_id).limit(500).get();
                    if (snapshot.empty) {
                        hasMore = false;
                    } else {
                        const qBatch = db.batch();
                        snapshot.forEach(doc => qBatch.delete(doc.ref));
                        await qBatch.commit();
                        if (snapshot.size < 500) hasMore = false;
                    }
                }
            }
            
            console.log(`[RGPD] Account wiped completely for user ${user_id}`);
            return res.status(200).json({ success: true, message: "Account completely wiped (RGPD)" });
        } catch(e) {
            console.error("[RGPD] Error wiping account", e);
            return res.status(500).json({ error: "Internal Error" });
        }
    }
);

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
    const { response, rpId, origin } = request.data;

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

    try {
        await admin.auth().getUser(uid);
    } catch (e) {
        throw new HttpsError('not-found', 'Utilisateur introuvable.');
    }

    const credsSnapshot = await db.collection("users").doc(uid).collection("fido_credentials").get();
    if (credsSnapshot.empty) {
        throw new HttpsError('not-found', 'No passkeys found for this user.');
    }

    const allowCredentials = credsSnapshot.docs.map(doc => ({
        id: Buffer.from(doc.data().credentialID, 'base64').toString('base64url'),
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

    try {
        await admin.auth().getUser(uid);
    } catch (e) {
        throw new HttpsError('not-found', 'Utilisateur introuvable.');
    }

    const challengeDoc = await db.collection("fido_challenges").doc(uid).get();
    if (!challengeDoc.exists) throw new HttpsError('failed-precondition', 'No challenge found.');
    const expectedChallenge = challengeDoc.data().challenge;

    const rawIdB64url = response.id;
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
        await credDoc.ref.update({ counter: verification.authenticationInfo.newCounter });
        await db.collection("fido_challenges").doc(uid).delete();

        const customToken = await admin.auth().createCustomToken(uid);
        return { success: true, customToken };
    }
    return { success: false };
});
