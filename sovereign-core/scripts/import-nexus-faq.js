#!/usr/bin/env node
/**
 * Réponses de Nexus Atlas écrites à l'avance (24/11/2026, relues par Xavier) : nexus-faq.json.
 * - « valide » : Nexus les répète tout de suite, sans IA.
 * - « a_verifier » : conseils d'entretien, gardés en brouillon jusqu'à validation par un garage partenaire
 *   (page admin-nexus.html) ; Nexus ne les répète pas avant.
 * Relançable sans doublon (une ligne par question). Sans --apply : compte seulement.
 *   docker compose -f docker-compose.vps.yml exec -T sovereign-api node scripts/import-nexus-faq.js [--apply]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { createPgStore } = require("../server/store-pg");
const { normalizeQuestion } = require("../server/nexus-brain");

const REVIEWER = "faq-2026-11-24";

async function main() {
    const faq = JSON.parse(fs.readFileSync(path.join(__dirname, "nexus-faq.json"), "utf8"));
    const apply = process.argv.includes("--apply");
    const norms = new Set(faq.map((e) => normalizeQuestion(e.q)));
    if (norms.size !== faq.length) throw new Error("deux questions identiques une fois normalisées");
    if (!apply) {
        console.log(`SIMULATION : ${faq.length} entrées (${faq.filter((e) => e.statut === "valide").length} validées, ${faq.filter((e) => e.statut === "a_verifier").length} à vérifier).`);
        return;
    }
    const store = createPgStore({ connectionString: process.env.DATABASE_URL });
    for (const e of faq) {
        const { id } = await store.recordNexusAnswer({ questionNorm: normalizeQuestion(e.q), question: e.q, answer: e.a });
        await store.updateNexusEntry(id, {
            status: e.statut, answer: e.a, reviewNote: e.note, ...(e.statut === "valide" ? { reviewedBy: REVIEWER } : {}),
        });
    }
    console.log(`COPIE : ${faq.length} entrées enregistrées.`);
    process.exit(0); // le pool de connexions ne se ferme pas tout seul
}

main().catch((e) => {
    console.error("Arrêt :", e.message);
    process.exit(1);
});
