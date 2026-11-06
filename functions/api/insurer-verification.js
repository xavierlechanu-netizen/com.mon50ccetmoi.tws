/**
 * insurer-verification.js — Vérifie qu'un acheteur de rapport est bien un professionnel
 * de l'assurance, à partir de son SIREN (annuaire public des entreprises de l'État,
 * recherche-entreprises.api.gouv.fr : gratuit, sans clé, données INSEE).
 *
 * L'acheteur ne saisit que son SIREN : le nom, l'adresse et le code d'activité (NAF) viennent
 * de l'annuaire officiel, donc la facture porte des informations exactes.
 */
"use strict";

const DIRECTORY_URL = "https://recherche-entreprises.api.gouv.fr/search";

/** Codes d'activité (NAF) autorisés à acheter un rapport de sinistre. */
const ALLOWED_NAF = {
    "65.11Z": "Assurance vie",
    "65.12Z": "Autres assurances",
    "65.20Z": "Réassurance",
    "66.21Z": "Évaluation des risques et dommages (experts d'assurance)",
    "66.22Z": "Agents et courtiers d'assurances",
    "66.29Z": "Autres activités auxiliaires d'assurance",
    "69.10Z": "Activités juridiques (avocats)",
    "71.20B": "Analyses, essais et inspections techniques (experts automobiles)",
};

/** SIREN : 9 chiffres et clé de Luhn valide. */
function isValidSiren(siren) {
    const s = String(siren || "").replace(/\s/g, "");
    if (!/^\d{9}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        let d = Number(s[8 - i]);
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    }
    return sum % 10 === 0;
}

/** Numéro de TVA intracommunautaire français calculé à partir du SIREN (formule officielle). */
function frVatNumber(siren) {
    const n = Number(siren);
    const key = (12 + 3 * (n % 97)) % 97;
    return `FR${String(key).padStart(2, "0")}${siren}`;
}

class VerificationError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code; // INVALID_SIREN | NOT_FOUND | INACTIVE | NOT_INSURANCE | DIRECTORY_DOWN
    }
}

/**
 * Interroge l'annuaire et renvoie le profil de facturation vérifié.
 * @returns {Promise<{siren, name, naf, nafLabel, address, postalCode, city, vatNumber}>}
 */
async function verifyInsurer(sirenInput, fetchFn = globalThis.fetch) {
    const siren = String(sirenInput || "").replace(/\s/g, "");
    if (!isValidSiren(siren)) throw new VerificationError("INVALID_SIREN", "Numéro SIREN invalide (9 chiffres).");

    let data;
    try {
        const resp = await fetchFn(`${DIRECTORY_URL}?q=${siren}&page=1&per_page=1`, { headers: { Accept: "application/json" } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        data = await resp.json();
    } catch (e) {
        throw new VerificationError("DIRECTORY_DOWN", "Annuaire des entreprises momentanément indisponible. Réessayez dans un instant.");
    }

    const company = (data.results || []).find((r) => r.siren === siren);
    if (!company) throw new VerificationError("NOT_FOUND", "Aucune entreprise trouvée pour ce SIREN.");
    if (company.etat_administratif !== "A") throw new VerificationError("INACTIVE", "Cette entreprise n'est plus active.");

    const naf = company.activite_principale || (company.siege && company.siege.activite_principale);
    if (!ALLOWED_NAF[naf]) {
        throw new VerificationError(
            "NOT_INSURANCE",
            `Les rapports sont réservés aux assureurs, courtiers, experts et avocats (activité de cette entreprise : ${naf || "inconnue"}).`
        );
    }

    const siege = company.siege || {};
    return {
        siren,
        name: company.nom_complet || company.nom_raison_sociale || "",
        naf,
        nafLabel: ALLOWED_NAF[naf],
        address: siege.adresse || "",
        postalCode: siege.code_postal || "",
        city: siege.libelle_commune || "",
        vatNumber: siege.numero_tva_intra || frVatNumber(siren),
    };
}

module.exports = { ALLOWED_NAF, isValidSiren, frVatNumber, verifyInsurer, VerificationError };
