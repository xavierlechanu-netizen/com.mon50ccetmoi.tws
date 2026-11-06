/**
 * ============================================================================
 * points-ledger.js — Grand Livre Sécurisé des Points (BVC / BraveCoins)
 * ============================================================================
 * Respect strict de l'OWASP ASVS v5.0.0 :
 *   - v5.0.0-2.2.1 / 2.2.2 : Validation d'entrée côté serveur (allowlist, plafonds)
 *   - v5.0.0-2.3.3 : Atomicité des transactions financières/points (runTransaction)
 *   - v5.0.0-2.4.1 : Contrôles anti-automatisation / limitation de débit
 *   - v5.0.0-15.x  : Principe de moindre privilège
 * ============================================================================
 */

const {
    onCall, HttpsError, admin, db, maskUid
} = require("./shared");

// Barème, preuves et plafonds : voir points-rules.js (testé dans tests/points-ledger.test.js)
const { RuleError, planTransaction, checkHazardProof, checkDailyCaps } = require("./points-rules");

exports.transactPoints = onCall(
    { region: "europe-west1" },
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Authentification requise pour mouvementer des points.");
        }

        const uid = request.auth.uid;
        const data = request.data || {};
        const isAdmin = !!(request.auth.token && (request.auth.token.admin === true || request.auth.token.role === "admin"));

        // 1. Validation et barème décidés par le serveur (points-rules.js)
        let plan;
        try {
            plan = planTransaction(data, { isAdmin });
        } catch (e) {
            if (e instanceof RuleError) {
                console.warn(`[PointsLedger] Demande refusée pour ${maskUid(uid)} (${data.reason}) : ${e.message}`);
                throw new HttpsError(e.code, e.message);
            }
            throw e;
        }
        const { action, reason, metadata } = data;
        const { rule, amount: parsedAmount } = plan;
        // Une clé imposée par le serveur (danger, palier, gain unique) prime sur celle de l'application
        const idempotencyKey = plan.forcedIdempotencyKey || (typeof data.idempotencyKey === "string" ? data.idempotencyKey : null);

        const userRef = db.collection("users").doc(uid);
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const quotaRef = userRef.collection("daily_quotas").doc(todayStr);

        try {
            const result = await db.runTransaction(async (t) => {
                // 2. Anti-rejeu : une même preuve ne rapporte qu'une fois
                if (idempotencyKey) {
                    const existingLedgerSnap = await t.get(
                        db.collection("points_ledger")
                            .where("userId", "==", uid)
                            .where("idempotencyKey", "==", idempotencyKey)
                            .limit(1)
                    );
                    if (!existingLedgerSnap.empty) {
                        const existingDoc = existingLedgerSnap.docs[0].data();
                        return {
                            success: true,
                            idempotent: true,
                            balance: existingDoc.balanceAfter,
                            transactionId: existingLedgerSnap.docs[0].id,
                            delta: 0
                        };
                    }
                }

                // 3. Preuve : le danger signalé doit exister et appartenir à l'utilisateur
                if (plan.needsHazardCheck) {
                    const hazardSnap = await t.get(db.collection("hazards").doc(metadata.hazardId));
                    const proof = checkHazardProof(hazardSnap.exists ? hazardSnap.data() : null, uid);
                    if (!proof.ok) throw new HttpsError("failed-precondition", proof.reason);
                }

                // 4. Plafonds journaliers (par motif + global des gains non vérifiables)
                if (action === "AWARD") {
                    const quotaDoc = await t.get(quotaRef);
                    const caps = checkDailyCaps(plan, reason, quotaDoc.exists ? quotaDoc.data() : {});
                    if (!caps.ok) throw new HttpsError("resource-exhausted", caps.reason);
                }

                const userDoc = await t.get(userRef);
                if (!userDoc.exists) {
                    throw new HttpsError("not-found", "Profil utilisateur introuvable.");
                }
                const userData = userDoc.data();
                if (userData.isBanned) {
                    throw new HttpsError("permission-denied", "Compte suspendu. Transactions bloquées.");
                }

                const currentBalance = (userData.braveCoins !== undefined)
                    ? userData.braveCoins
                    : ((userData.bvc_points !== undefined) ? userData.bvc_points : (userData.points || 0));

                let newBalance;
                let delta;
                if (action === "DEDUCT") {
                    if (currentBalance < parsedAmount) {
                        throw new HttpsError(
                            "failed-precondition",
                            `Solde insuffisant : Vous avez ${Math.floor(currentBalance)} Pts mon50cc, il en faut ${parsedAmount}.`
                        );
                    }
                    newBalance = currentBalance - parsedAmount;
                    delta = -parsedAmount;
                } else {
                    newBalance = currentBalance + parsedAmount;
                    delta = parsedAmount;
                }

                t.update(userRef, {
                    braveCoins: newBalance,
                    bvc_points: newBalance, // Mirror de rétrocompatibilité
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });

                if (action === "AWARD") {
                    // Classement public : seulement le pseudo et les points GAGNÉS (pas achetés, pas dépensés)
                    t.set(db.collection("leaderboard").doc(uid), {
                        username: userData.username || "Pilote",
                        department: userData.department || null,
                        points: admin.firestore.FieldValue.increment(parsedAmount),
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    const inc = admin.firestore.FieldValue.increment(parsedAmount);
                    t.set(quotaRef, {
                        [reason]: inc,
                        ...(plan.unverified ? { __unverified: inc } : {}),
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }

                // Grand livre (append-only)
                const ledgerRef = db.collection("points_ledger").doc();
                t.set(ledgerRef, {
                    userId: uid,
                    action: action,
                    reason: reason,
                    description: rule.description,
                    delta: delta,
                    amount: parsedAmount,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    verified: action === "AWARD" ? !plan.unverified : null,
                    metadata: metadata || null,
                    idempotencyKey: idempotencyKey,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });

                return { success: true, balance: newBalance, transactionId: ledgerRef.id, delta: delta };
            });

            console.log(`[PointsLedger] ${action} ${parsedAmount} Pts pour ${maskUid(uid)} (${reason}) -> Solde: ${result.balance}`);
            return result;
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            console.error(`[PointsLedger] Erreur transaction pour ${maskUid(uid)} :`, e);
            throw new HttpsError("internal", "Échec de l'enregistrement de la transaction de points.");
        }
    }
);

/**
 * Callable Function : Consultation de l'historique personnel du grand livre
 */
exports.getPointsHistory = onCall(
    { region: "europe-west1" },
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Authentification requise.");
        }

        const uid = request.auth.uid;
        const limit = Math.min(Number(request.data?.limit) || 30, 50);

        try {
            const snap = await db.collection("points_ledger")
                .where("userId", "==", uid)
                .orderBy("created_at", "desc")
                .limit(limit)
                .get();

            const history = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at ? doc.data().created_at.toDate().toISOString() : null
            }));

            return { success: true, history };
        } catch (e) {
            console.error(`[PointsLedger] Erreur historique pour ${maskUid(uid)} :`, e);
            throw new HttpsError("internal", "Impossible de récupérer l'historique des points.");
        }
    }
);
