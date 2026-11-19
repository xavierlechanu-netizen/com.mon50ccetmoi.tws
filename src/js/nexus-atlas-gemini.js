import { NexusSemanticAnalyzer } from './nexus-semantic-analyzer.js';
import { sovereignSession } from './sovereign.js';
import { createNexusBrainLocal } from './nexus-brain-local.js';

/**
 * Nexus Atlas — point d'entrée unique de ses réponses (chat, voix, lecteur de documents).
 *
 * 19/11/2026 : plus de Gemini (Google). Le nom « NexusAtlasGemini » est gardé pour ne rien casser
 * ailleurs. Cerveau mixte (nexus-brain-local.js) : Nexus Atlas répond d'abord (urgences, commandes,
 * Légifrance) ; sinon le serveur du VPS (réponses apprises, puis Mistral 7B, libre, sur le VPS).
 * Jamais Mistral pour une urgence. Plus de copie des conversations dans Firestore.
 */

class NexusAtlasGemini {
    constructor() {
        this.sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        this.semanticAnalyzer = window.NexusSemanticAnalyzer || new NexusSemanticAnalyzer();
        this.brain = createNexusBrainLocal({ ...this.brainDeps(), localEngine: window.NexusAtlasEngine || null });
    }

    /**
     * @param {string} userText
     * @param {{document?: boolean}} [opts] document : lecture d'un document (lecteur d'assurance)
     * @returns {Promise<{reply: string, action: string, parameter?: string, source: string, detectedSuggestion?: object}>}
     */
    async ask(userText, opts = {}) {
        // Les commandes intégrées se chargent après ce module : on les reprend au moment de la question
        if (window.NexusAtlasEngine) this.brain = createNexusBrainLocal({ ...this.brainDeps(), localEngine: window.NexusAtlasEngine });
        const result = await this.brain.ask(userText, { driving: window.isRiding === true, document: opts.document === true });

        // Idées d'amélioration repérées dans la question (analyse locale, sur le téléphone)
        if (!opts.document && result.source !== "urgence") {
            try {
                const found = this.semanticAnalyzer ? this.semanticAnalyzer.analyze(userText) : null;
                if (found && found.isSuggestion) {
                    result.detectedSuggestion = { idea: found.idea, category: found.category, impact: found.impact,
                        confidence: found.confidence, detectedBy: "edge_semantic" };
                    if (typeof this.semanticAnalyzer.recordSuggestion === "function") {
                        this.semanticAnalyzer.recordSuggestion(result.detectedSuggestion, userText, { sessionId: this.sessionId });
                    }
                }
            } catch (e) {
                console.warn("[Nexus Atlas] Analyse des idées non bloquante :", e.message);
            }
        }
        // Transparence (AI Act, art. 50) : la réponse dit si elle vient d'une IA
        result.isAIGenerated = result.source === "mistral" || result.source === "appris";
        return result;
    }

    brainDeps() {
        return {
            loadLegal: async () => {
                if (!window.LegalDatabase) await import('./legal-database.js');
                return window.LegalDatabase || null;
            },
            askServer: async ({ question, driving }) => {
                const session = sovereignSession;
                if (!session || !session.hasAccount()) throw new Error("Pas de session sur le serveur du VPS.");
                return session.client.request("/nexus/ask", { method: "POST", body: { question, driving } });
            },
        };
    }
}

window.NexusAtlasGemini = new NexusAtlasGemini();
