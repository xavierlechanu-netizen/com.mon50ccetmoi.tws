/**
 * insurers.js — Inscription d'un professionnel acheteur de rapports (assureur, courtier,
 * expert, avocat) à partir de son SIREN, vérifié dans l'annuaire public des entreprises.
 */
"use strict";

const { onCall, HttpsError, admin, db, maskUid } = require("./shared");
const { verifyInsurer, VerificationError } = require("./insurer-verification");

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

exports.registerInsurerProfile = onCall({ region: "europe-west1" }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError("unauthenticated", "Connectez-vous pour enregistrer votre entreprise.");
    }
    const uid = request.auth.uid;
    const { siren, billingEmail } = request.data || {};
    if (typeof billingEmail !== "string" || !EMAIL_RE.test(billingEmail.trim())) {
        throw new HttpsError("invalid-argument", "Adresse email de facturation invalide.");
    }

    let company;
    try {
        company = await verifyInsurer(siren);
    } catch (e) {
        if (e instanceof VerificationError) {
            const code = e.code === "DIRECTORY_DOWN" ? "unavailable"
                : e.code === "NOT_INSURANCE" ? "permission-denied" : "invalid-argument";
            throw new HttpsError(code, e.message);
        }
        throw e;
    }

    const profile = {
        ...company,
        billingEmail: billingEmail.trim().toLowerCase(),
        verified: true,
        verifiedSource: "recherche-entreprises.api.gouv.fr",
        verified_at: admin.firestore.FieldValue.serverTimestamp(),
        uid,
    };
    await db.collection("insurer_profiles").doc(uid).set(profile, { merge: true });
    console.log(`[Insurers] Professionnel vérifié pour ${maskUid(uid)} : ${company.name} (${company.naf})`);

    return {
        name: company.name,
        siren: company.siren,
        naf: company.naf,
        nafLabel: company.nafLabel,
        address: company.address,
        vatNumber: company.vatNumber,
    };
});

/** Profil de l'acheteur connecté (pour pré-remplir le portail). */
exports.getInsurerProfile = onCall({ region: "europe-west1" }, async (request) => {
    if (!request.auth || !request.auth.uid) throw new HttpsError("unauthenticated", "Connexion requise.");
    const doc = await db.collection("insurer_profiles").doc(request.auth.uid).get();
    if (!doc.exists) return { registered: false };
    const p = doc.data();
    return { registered: p.verified === true, name: p.name, siren: p.siren, nafLabel: p.nafLabel, billingEmail: p.billingEmail };
});
