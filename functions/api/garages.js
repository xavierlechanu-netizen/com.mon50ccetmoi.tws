/**
 * garages.js — Notation communautaire des garages.
 *
 * Avant : le navigateur calculait la moyenne et écrivait lui-même dans
 * garage_evaluations. Le 2ᵉ votant était refusé par les règles, et le 1er
 * pouvait écrire n'importe quel total (badge Pro à 1000 avis).
 * Maintenant : seul le serveur écrit. Les votes individuels vont dans
 * garage_votes (illisible pour les clients), l'agrégat public dans
 * garage_evaluations, sans la liste des votants.
 */

const { onCall, HttpsError, admin, db, maskUid } = require("./shared");
const { RuleError } = require("./points-rules");
const { validateGarageVote, applyGarageVote, voteDocId } = require("./garage-rules");

exports.rateGarage = onCall(
    { region: "europe-west1" },
    async (request) => {
        if (!request.auth || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Vous devez être membre pour évaluer un garage.");
        }
        const uid = request.auth.uid;

        let vote;
        try {
            vote = validateGarageVote(request.data);
        } catch (e) {
            if (e instanceof RuleError) throw new HttpsError(e.code, e.message);
            throw e;
        }

        const aggRef = db.collection("garage_evaluations").doc(vote.placeId);
        const voteRef = db.collection("garage_votes").doc(voteDocId(vote.placeId, uid));

        const result = await db.runTransaction(async (tx) => {
            const [aggSnap, voteSnap] = await Promise.all([tx.get(aggRef), tx.get(voteRef)]);
            const previousScore = voteSnap.exists ? voteSnap.data().score : null;
            const agg = applyGarageVote(aggSnap.exists ? aggSnap.data() : null, previousScore, vote.score);
            const now = admin.firestore.FieldValue.serverTimestamp();

            tx.set(voteRef, { placeId: vote.placeId, uid, score: vote.score, votedAt: now });
            tx.set(aggRef, {
                placeId: vote.placeId,
                name: vote.name || (aggSnap.exists && aggSnap.data().name) || "",
                ...agg,
                updatedAt: now,
            });
            return { ...agg, updated: previousScore !== null };
        });

        console.log(`[Garages] Vote ${vote.score}/5 de ${maskUid(uid)} pour ${vote.placeId}`);
        return {
            count: result.count,
            avgRating: result.avgRating,
            yourScore: vote.score,
            updated: result.updated,
        };
    }
);
