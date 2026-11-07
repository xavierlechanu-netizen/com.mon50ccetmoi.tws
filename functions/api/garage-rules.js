/**
 * garage-rules.js — Règles de notation des garages (logique pure, testée dans
 * tests/garage-ratings.test.js). La fonction rateGarage (garages.js) s'en sert.
 *
 * Un membre = un vote par garage. Revoter remplace l'ancienne note.
 * La moyenne est calculée ici, jamais par le navigateur.
 */

const { RuleError } = require("./points-rules");

// Identifiants produits par map-engine.js : "osm-node-123" ou "48.85,2.35".
// Pas de "/" (chemin Firestore) ni de "__" (réservé par Firestore).
const PLACE_ID_RE = /^[A-Za-z0-9.,:_-]{1,128}$/;
const MAX_NAME_LENGTH = 120;
// Version des agrégats calculés par le serveur. Les anciens documents,
// écrits directement par le navigateur, ne sont pas fiables : on repart de zéro.
const AGGREGATE_VERSION = 2;

function validateGarageVote(data) {
    const { placeId, name, score } = data || {};
    if (typeof placeId !== "string" || !PLACE_ID_RE.test(placeId) || placeId.includes("__")) {
        throw new RuleError("invalid-argument", "Garage inconnu.");
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new RuleError("invalid-argument", "La note doit être un nombre entier de 1 à 5.");
    }
    const safeName = typeof name === "string"
        // eslint-disable-next-line no-control-regex
        ? name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME_LENGTH)
        : "";
    return { placeId, name: safeName, score };
}

/**
 * Nouvel agrégat après un vote.
 * @param {object|null} current  agrégat actuel (ignoré s'il n'est pas à la bonne version)
 * @param {number|null} previousScore  ancienne note de ce membre, ou null
 * @param {number} score  nouvelle note
 */
function applyGarageVote(current, previousScore, score) {
    const trusted = current && current.v === AGGREGATE_VERSION;
    let count = trusted ? current.count || 0 : 0;
    let totalScore = trusted ? current.totalScore || 0 : 0;

    if (trusted && Number.isInteger(previousScore)) {
        totalScore += score - previousScore;
    } else {
        count += 1;
        totalScore += score;
    }
    return {
        v: AGGREGATE_VERSION,
        count,
        totalScore,
        avgRating: Math.round((totalScore / count) * 10) / 10,
    };
}

function voteDocId(placeId, uid) {
    return `${placeId}__${uid}`;
}

module.exports = {
    AGGREGATE_VERSION,
    MAX_NAME_LENGTH,
    validateGarageVote,
    applyGarageVote,
    voteDocId,
};
