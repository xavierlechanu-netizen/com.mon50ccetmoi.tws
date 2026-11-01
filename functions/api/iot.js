const {
    onRequest, onCall, HttpsError, admin, db, crypto,
    setCorsHeaders, verifyAuthToken
} = require("./shared");
const core = require("./blackbox-core");

/**
 * Onboarding FDO / Rendezvous matériel sécurisé par signature asymétrique ECDSA P-256
 * Conformité : OWASP ASVS v5.0.0-9.x / v5.0.0-11.x & Audit EXP-BB50-2026-REV3 (eIDAS / Art. 1366 C. Civ.)
 */
exports.iotFdoRendezvous = onRequest({ region: "europe-west1" }, async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const authUser = await verifyAuthToken(req);
    if (!authUser) {
        return res.status(401).json({ error: "Authentification requise pour l'onboarding IoT." });
    }

    const { hardware_id, signature, challenge } = req.body || {};
    if (!hardware_id || !signature) {
        return res.status(400).json({ error: "Voucher incomplet. hardware_id et signature requis." });
    }

    const parsed = core.parseSerial(String(hardware_id));
    if (!parsed) {
        return res.status(400).json({ error: "Identifiant matériel (numéro de série) invalide." });
    }

    try {
        const unitRef = db.collection("blackbox_units").doc(parsed.serial);
        const unitDoc = await unitRef.get();
        if (!unitDoc.exists) {
            return res.status(404).json({ error: "Unité matérielle introuvable dans le registre Francelog." });
        }

        const unitData = unitDoc.data();
        if (unitData.ownerUid && unitData.ownerUid !== authUser.uid) {
            console.warn(`[FDO] Refus d'enrôlement : ${parsed.serial} appartient à un autre utilisateur.`);
            return res.status(403).json({ error: "Ce boîtier est rattaché à un autre compte." });
        }

        if (!unitData.ecdsaPublicKey || !core.isValidEcdsaPublicKey(unitData.ecdsaPublicKey)) {
            console.warn(`[FDO] Clé publique ECDSA P-256 non provisionnée pour ${parsed.serial}.`);
            return res.status(503).json({
                error: "Clé publique matérielle ECDSA P-256 absente du registre pour cette unité."
            });
        }

        // Payload signé attendu : "<SERIAL>:<UID>" ou "<SERIAL>:<CHALLENGE>" ou "<SERIAL>"
        const candidates = [
            challenge ? `${parsed.serial}:${String(challenge)}` : null,
            `${parsed.serial}:${authUser.uid}`,
            parsed.serial
        ].filter(Boolean);

        const isSignatureValid = candidates.some((msg) =>
            core.verifyEcdsaP256Signature(msg, String(signature), unitData.ecdsaPublicKey)
        );

        if (!isSignatureValid) {
            console.warn(`[FDO] Signature ECDSA P-256 invalide pour ${parsed.serial} (UID: ${core.shortUid(authUser.uid)}).`);
            return res.status(403).json({ error: "Signature cryptographique matérielle ECDSA P-256 invalide." });
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        if (unitData.status === core.STATUSES.SOLD) {
            await unitRef.update({
                status: core.STATUSES.ACTIVE,
                activatedAt: now,
                updatedAt: now,
                updatedBy: authUser.uid
            });
        }

        const customToken = await admin.auth().createCustomToken(authUser.uid, {
            is_iot_device: true,
            blackbox_serial: parsed.serial,
            hw_revision: parsed.revision
        });

        console.log(`[FDO] Onboarding ECDSA P-256 validé pour ${parsed.serial} (UID: ${core.shortUid(authUser.uid)}).`);
        return res.status(200).json({
            success: true,
            serial: parsed.serial,
            customToken
        });
    } catch (err) {
        console.error("[FDO] Erreur lors de la vérification ECDSA :", err);
        return res.status(500).json({ error: "Erreur interne lors de la vérification cryptographique." });
    }
});

/**
 * Téléversement des trames télémétriques chiffrées (AES-256-GCM Zero-Knowledge)
 * Inclut :
 *  - Filtrage probant RGPD (±30 secondes autour de l'impact) en cas de rapport de choc
 *  - Vérification de la chaîne de hachage de Merkle SHA-256 (anti-troncature ISO/IEC 27037)
 *  - Vérification optionnelle de la signature matérielle ECDSA P-256 sur la racine de Merkle
 */
exports.uploadBlackboxTelemetry = onCall(
    { region: "europe-west1", timeoutSeconds: 60, memory: "256MiB" },
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Authentification requise.");
        }

        const uid = request.auth.uid;
        const {
            hardwareId,
            payloads,
            isCrashReport,
            impactTimestamp,
            merkleSeedHex,
            ecdsaSignature
        } = request.data || {};

        if (!Array.isArray(payloads) || payloads.length === 0) {
            throw new HttpsError("invalid-argument", "Le lot de trames est vide ou invalide.");
        }
        if (payloads.length > 5000) {
            throw new HttpsError("invalid-argument", "Taille de lot maximale dépassée (max 5000 trames).");
        }

        try {
            // 1. Filtrage probant RGPD Art. 5 (±30 secondes autour du choc)
            let finalFrames = payloads;
            let resolvedImpactTs = typeof impactTimestamp === "number" && impactTimestamp > 0 ? impactTimestamp : null;

            if (!resolvedImpactTs && isCrashReport) {
                const shockFrame = payloads.find((f) => f && (f.isShockFrame === true || (typeof f.gForce === "number" && f.gForce >= 3.0)));
                if (shockFrame && typeof shockFrame.timestamp === "number") {
                    resolvedImpactTs = shockFrame.timestamp;
                }
            }

            if (isCrashReport && resolvedImpactTs) {
                finalFrames = core.filterCrashWindowFrames(payloads, resolvedImpactTs, core.CRASH_WINDOW_SECONDS);
                if (finalFrames.length === 0) {
                    finalFrames = payloads.slice(-600); // Fallback de sécurité : max 600 trames (60s @ 10Hz)
                }
            }

            // 2. Vérification de la chaîne de hachage de Merkle SHA-256 si la graine est fournie
            let merkleVerification = null;
            if (typeof merkleSeedHex === "string" && /^[0-9a-fA-F]{64}$/.test(merkleSeedHex.trim())) {
                merkleVerification = core.verifyMerkleChain(finalFrames, merkleSeedHex.trim());
                if (!merkleVerification.valid) {
                    console.warn(`[Telemetry] ⚠️ Rupture de chaîne de Merkle détectée pour ${core.shortUid(uid)} : ${merkleVerification.reason}`);
                }
            }

            // 3. Vérification de la signature matérielle ECDSA P-256 si présente
            let ecdsaVerified = false;
            const parsedSerial = typeof hardwareId === "string" ? core.parseSerial(hardwareId) : null;
            if (ecdsaSignature && parsedSerial && merkleVerification && merkleVerification.finalHashHex) {
                const unitDoc = await db.collection("blackbox_units").doc(parsedSerial.serial).get();
                if (unitDoc.exists && unitDoc.data().ecdsaPublicKey) {
                    ecdsaVerified = core.verifyEcdsaP256Signature(
                        Buffer.from(merkleVerification.finalHashHex, "hex"),
                        String(ecdsaSignature),
                        unitDoc.data().ecdsaPublicKey
                    );
                }
            }

            const bucketName = "mon50ccetmoi-telemetry";
            const bucket = admin.storage().bucket(bucketName);
            const timestamp = Date.now();
            const randomSuffix = crypto.randomBytes(4).toString("hex");
            const fileName = `telemetry/${uid}/${timestamp}_${randomSuffix}.json`;
            const file = bucket.file(fileName);

            const safeHwId = typeof hardwareId === "string" ? hardwareId.substring(0, 64) : "UNKNOWN_HW";
            const sessionData = {
                uid,
                hardwareId: safeHwId,
                uploadedAt: new Date().toISOString(),
                isCrashReport: Boolean(isCrashReport),
                impactTimestamp: resolvedImpactTs,
                rgpdWindowSeconds: isCrashReport ? core.CRASH_WINDOW_SECONDS : null,
                merkleVerified: merkleVerification ? merkleVerification.valid : null,
                merkleRootHex: merkleVerification ? merkleVerification.finalHashHex : null,
                ecdsaVerified,
                frameCount: finalFrames.length,
                frames: finalFrames
            };

            await file.save(JSON.stringify(sessionData), {
                contentType: "application/json",
                metadata: {
                    uid,
                    hardwareId: safeHwId,
                    isCrashReport: String(Boolean(isCrashReport)),
                    frameCount: String(finalFrames.length)
                }
            });

            const docRef = await db.collection("telemetry_sessions").add({
                uid,
                hardwareId: safeHwId,
                isCrashReport: Boolean(isCrashReport),
                impactTimestamp: resolvedImpactTs,
                merkleVerified: merkleVerification ? merkleVerification.valid : null,
                merkleRootHex: merkleVerification ? merkleVerification.finalHashHex : null,
                ecdsaVerified,
                frameCount: finalFrames.length,
                storagePath: fileName,
                storageBucket: bucketName,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[Telemetry] Batch de ${finalFrames.length} trames stocké pour ${core.shortUid(uid)} (Session ${docRef.id}, Crash=${Boolean(isCrashReport)})`);

            return {
                success: true,
                sessionId: docRef.id,
                frameCount: finalFrames.length,
                merkleVerified: merkleVerification ? merkleVerification.valid : null,
                ecdsaVerified
            };
        } catch (error) {
            console.error("[Telemetry] Erreur upload télémétrie:", error);
            throw new HttpsError("internal", "Erreur lors du traitement de la télémétrie.");
        }
    }
);
