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

// Plafonds et autorisations par motif (Positive Allowlist)
const REASON_RULES = {
    // ---- GAIN DE POINTS (AWARD) ----
    CODE_QUIZ_COMPLETED: {
        action: "AWARD",
        maxPerCall: 50,
        dailyCap: 200,
        description: "Quiz du Code de la Route complété"
    },
    RADAR_HAZARD_REPORTED: {
        action: "AWARD",
        maxPerCall: 25,
        dailyCap: 100,
        description: "Signalement de zone de danger validé"
    },
    ROUTER_CONTRAT_SIGNED: {
        action: "AWARD",
        maxPerCall: 50,
        dailyCap: 50,
        description: "Contrat de bonne conduite signé"
    },
    MAINTENANCE_LOGGED: {
        action: "AWARD",
        maxPerCall: 25,
        dailyCap: 50,
        description: "Entretien véhicule enregistré"
    },
    REFERRAL_BONUS: {
        action: "AWARD",
        maxPerCall: 100,
        dailyCap: 300,
        description: "Parrainage d'un nouveau pilote"
    },
    SAFE_RIDER_MILESTONE: {
        action: "AWARD",
        maxPerCall: 50,
        dailyCap: 150,
        description: "Palier de conduite prudente atteint"
    },
    CARBON_OFFSET: {
        action: "AWARD",
        maxPerCall: 30,
        dailyCap: 90,
        description: "Économie carbone validée"
    },
    ADMIN_GRANT: {
        action: "AWARD",
        maxPerCall: 1000,
        dailyCap: 5000,
        requiresAdmin: true,
        description: "Attribution manuelle administrateur"
    },

    // ---- DÉDUCTION DE POINTS (DEDUCT) ----
    MECA_WIZARD_DIAGNOSTIC: {
        action: "DEDUCT",
        maxPerCall: 200,
        description: "Diagnostic mécano virtuel"
    },
    POCKET_LAWYER_QUERY: {
        action: "DEDUCT",
        maxPerCall: 100,
        description: "Consultation juridique Pocket Lawyer"
    },
    MARKETPLACE_PURCHASE: {
        action: "DEDUCT",
        maxPerCall: 5000,
        description: "Achat sur la marketplace d'équipements"
    },
    EXCHANGE_PURCHASE: {
        action: "DEDUCT",
        maxPerCall: 5000,
        description: "Échange de points contre récompense"
    },
    WEB4_MINING_STAKE: {
        action: "DEDUCT",
        maxPerCall: 1000,
        description: "Stake Web4 de points"
    },
    GENERIC_SPEND: {
        action: "DEDUCT",
        maxPerCall: 1000,
        description: "Utilisation de points"
    }
};

/**
 * Callable Function : Exécution transactionnelle d'un mouvement de points
 */
exports.transactPoints = onCall(
    { region: "europe-west1" },
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Authentification requise pour mouvementer des points.");
        }

        const uid = request.auth.uid;
        const { action, reason, amount, metadata, idempotencyKey } = request.data || {};

        // 1. Validation de l'action
        if (action !== "AWARD" && action !== "DEDUCT") {
            throw new HttpsError("invalid-argument", "Action invalide : doit être 'AWARD' ou 'DEDUCT'.");
        }

        // 2. Validation du montant (entier strictement positif)
        const parsedAmount = Math.floor(Number(amount));
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new HttpsError("invalid-argument", "Le montant doit être un entier strictement positif.");
        }

        // 3. Validation du motif (Allowlist)
        const rule = REASON_RULES[reason];
        if (!rule) {
            console.warn(`[PointsLedger] Motif non reconnu pour ${maskUid(uid)} : ${reason}`);
            throw new HttpsError("invalid-argument", `Motif de transaction non autorisé : '${reason}'.`);
        }

        if (rule.action !== action) {
            throw new HttpsError("invalid-argument", `L'action '${action}' ne correspond pas au motif '${reason}'.`);
        }

        if (parsedAmount > rule.maxPerCall) {
            throw new HttpsError("out-of-range", `Le montant ${parsedAmount} dépasse le plafond unitaire (${rule.maxPerCall}) pour '${reason}'.`);
        }

        if (rule.requiresAdmin) {
            const isAdmin = request.auth.token && (request.auth.token.admin === true || request.auth.token.role === "admin");
            if (!isAdmin) {
                throw new HttpsError("permission-denied", "Privilèges administrateur requis pour cette transaction.");
            }
        }

        // 4. Clé d'idempotence (Anti-rejeu)
        const userRef = db.collection("users").doc(uid);
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const quotaRef = userRef.collection("daily_quotas").doc(todayStr);

        try {
            const result = await db.runTransaction(async (t) => {
                // Vérifier l'idempotence si une clé est fournie
                if (idempotencyKey && typeof idempotencyKey === "string") {
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
                            delta: existingDoc.delta
                        };
                    }
                }

                // Pour les gains, vérifier le plafond journalier anti-triche
                if (action === "AWARD" && rule.dailyCap) {
                    const quotaDoc = await t.get(quotaRef);
                    const quotaData = quotaDoc.exists ? quotaDoc.data() : {};
                    const currentDailyGain = quotaData[reason] || 0;

                    if (currentDailyGain + parsedAmount > rule.dailyCap) {
                        throw new HttpsError(
                            "resource-exhausted",
                            `Plafond journalier de ${rule.dailyCap} Pts atteint pour '${rule.description}'.`
                        );
                    }
                }

                // Lire le compte utilisateur
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

                let newBalance = 0;
                let delta = 0;

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

                // Maj du compte utilisateur
                t.update(userRef, {
                    braveCoins: newBalance,
                    bvc_points: newBalance, // Mirror de rétrocompatibilité
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // Maj du compteur de quota journalier
                if (action === "AWARD" && rule.dailyCap) {
                    t.set(quotaRef, {
                        [reason]: admin.firestore.FieldValue.increment(parsedAmount),
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }

                // Écriture du Grand Livre (Append-Only)
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
                    metadata: metadata || null,
                    idempotencyKey: idempotencyKey || null,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });

                return {
                    success: true,
                    balance: newBalance,
                    transactionId: ledgerRef.id,
                    delta: delta
                };
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
