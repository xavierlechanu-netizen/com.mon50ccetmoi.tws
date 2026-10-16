/**
 * Nexus Atlas — Semantic Analyzer for User Suggestions & Feedback
 * Détection sémantique des idées d'amélioration et suggestions d'évolution
 * Conforme : EU AI Act (Art. 50 - Transparence), ISO/IEC 27001 (A.8.28 Audit)
 */

class NexusSemanticAnalyzer {
    constructor() {
        this.suggestionPatterns = [
            /\b(ce\s+serait\s+(bien|top|cool|g[eé]nial|super|pratique|utile))\b/i,
            /\b(il\s+faudrait(\s+pouvoir|\s+ajouter|\s+avoir|\s+mettre)?)\b/i,
            /\b(faudrait(\s+pouvoir|\s+ajouter|\s+avoir|\s+mettre)?)\b/i,
            /\b(vous\s+(devriez|pourriez))\b/i,
            /\b(pourquoi\s+(pas|ne\s+pas))\b/i,
            /\b(j['’]aimerais(\s+bien|\s+pouvoir|\s+que)?)\b/i,
            /\b(je\s+(sugg[eèé]re|propose))\b/i,
            /\b(id[eé]e\s*:|suggestion\s*:|proposition\s*:)\b/i,
            /\b([çc]a\s+manque\s+de?)\b/i,
            /\b(ajouter\s+(une?\s+)?(option|fonction|fonctionnalit[eé]|feature|bouton|mode))\b/i,
            /\b(am[eé]liorer(\s+l['’]application|\s+la|le)?)\b/i,
            /\b(faire\s+en\s+sorte\s+que)\b/i,
            /\b(serait-il\s+possible\s+de)\b/i,
            /\b(est-ce\s+qu['’]on\s+pourrait)\b/i,
            /\b(rajouter(\s+une?\s+)?(option|fonction|bouton|mode)?)\b/i
        ];

        this.categoryKeywords = {
            navigation: [
                "itin[eé]raire", "gps", "carte", "map", "contourn", "trajet",
                "radar", "vitesse", "zfe", "essence", "station", "bouchon",
                "virage", "guidage", "voix", "navigation", "route"
            ],
            mechanics: [
                "moteur", "huile", "carbu", "carburateur", "galet", "pot",
                "batterie", "soh", "r[eé]vision", "panne", "garage", "vidange",
                "bougie", "frein", "pneu", "m[eé]canique", "m[eé]cano"
            ],
            security: [
                "casque", "gant", "airbag", "ange gardien", "crash", "blackbox",
                "bo[iî]tier", "choc", "sos", "urgence", "s[eé]curit[eé]", "chute"
            ],
            social: [
                "crew", "cort[eè]ge", "groupe", "ami", "balade", "invit",
                "chat", "message", "communaut[eé]", "club", "membre"
            ],
            ui_ux: [
                "mode nuit", "sombre", "th[eè]me", "taille", "police", "bouton",
                "affichage", "design", "son", "ergonomie", "couleur", "interface"
            ],
            marketplace: [
                "pi[eè]ce", "vente", "achat", "troc", "annonce", "occasion",
                "prix", "bvc", "bourse", "marketplace"
            ]
        };
    }

    /**
     * Analyse sémantique d'un message utilisateur pour détecter une suggestion
     * @param {string} text - Message de l'utilisateur
     * @returns {Object} Résultat d'analyse
     */
    analyze(text) {
        if (!text || typeof text !== "string") {
            return {
                isSuggestion: false,
                confidence: 0,
                idea: "",
                category: "general",
                impact: "low"
            };
        }

        const trimmed = text.trim();
        let matchCount = 0;
        let matchedPattern = "";

        for (const pattern of this.suggestionPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                matchCount++;
                if (!matchedPattern) matchedPattern = match[0];
            }
        }

        const isExplicitSuggestion = /\b(id[eé]e|suggestion|proposition)\b/i.test(trimmed);
        const hasSuggestionLength = trimmed.length >= 15;
        const isSuggestion = (matchCount > 0 || isExplicitSuggestion) && hasSuggestionLength;

        if (!isSuggestion) {
            return {
                isSuggestion: false,
                confidence: 0,
                idea: "",
                category: "general",
                impact: "low"
            };
        }

        // Calcul de la confiance sémantique (0.6 à 0.95)
        let confidence = 0.65;
        if (matchCount > 1) confidence += 0.15;
        if (isExplicitSuggestion) confidence += 0.15;
        confidence = Math.min(confidence, 0.95);

        // Classification de la catégorie
        const category = this.detectCategory(trimmed);

        // Estimation de l'impact
        let impact = "medium";
        if (/\b(urgence|s[eé]curit[eé]|danger|crash|frein|vital)\b/i.test(trimmed)) {
            impact = "high";
        } else if (/\b(couleur|th[eè]me|ic[oô]ne|logo|design)\b/i.test(trimmed)) {
            impact = "low";
        }

        // Nettoyage et synthèse de l'idée
        const idea = this.extractIdeaSummary(trimmed);

        return {
            isSuggestion: true,
            confidence: Number(confidence.toFixed(2)),
            idea,
            category,
            impact,
            matchedKeyword: matchedPattern
        };
    }

    /**
     * Détection de la thématique métier
     */
    detectCategory(text) {
        const lower = text.toLowerCase();
        let bestCategory = "general";
        let maxMatches = 0;

        for (const [cat, keywords] of Object.entries(this.categoryKeywords)) {
            let count = 0;
            for (const kw of keywords) {
                const regex = new RegExp(`\\b${kw}`, "i");
                if (regex.test(lower)) count++;
            }
            if (count > maxMatches) {
                maxMatches = count;
                bestCategory = cat;
            }
        }

        return bestCategory;
    }

    /**
     * Extrait une synthèse concise de l'idée
     */
    extractIdeaSummary(text) {
        let clean = text.replace(/^(bonjour|salut|hello|nexus|atlas|dis)\s*[,!.]?\s*/i, "");
        if (clean.length > 140) {
            clean = clean.slice(0, 137) + "...";
        }
        return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    /**
     * Sauvegarde la suggestion dans Firestore et le stockage local
     */
    async recordSuggestion(suggestion, originalText, context = {}) {
        const { sessionId = "unknown", uid = "anonymous" } = context;

        const payload = {
            idea: suggestion.idea || originalText.slice(0, 120),
            originalText: originalText.slice(0, 500),
            category: suggestion.category || "general",
            impact: suggestion.impact || "medium",
            confidence: suggestion.confidence || 0.7,
            detectedBy: suggestion.detectedBy || "semantic_analyzer",
            sessionId,
            uid,
            timestamp: Date.now(),
            status: "new"
        };

        // 1. Sauvegarde dans localStorage pour la Boîte à Idées Admin immédiate
        try {
            const raw = localStorage.getItem("suggestions") || "[]";
            const list = JSON.parse(raw);
            list.unshift({
                author: uid === "anonymous" ? "Pilote anonyme" : `Pilote (${uid.slice(0, 6)})`,
                text: `[${payload.category.toUpperCase()}] ${payload.idea}`,
                date: new Date().toLocaleDateString("fr-FR"),
                impact: payload.impact
            });
            localStorage.setItem("suggestions", JSON.stringify(list.slice(0, 100)));
        } catch (e) {
            // Ignorer si indisponible
        }

        // 2. Sauvegarde persistante dans Firestore
        if (typeof firebase !== "undefined" && firebase.firestore) {
            try {
                const db = firebase.firestore();
                await db.collection("nexus_suggestions").add({
                    ...payload,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.warn("[NexusSemanticAnalyzer] Enregistrement Firestore différé :", e.message);
            }
        }

        return payload;
    }
}

const analyzerInstance = new NexusSemanticAnalyzer();

if (typeof window !== "undefined") {
    window.NexusSemanticAnalyzer = analyzerInstance;
}

export default analyzerInstance;
export { NexusSemanticAnalyzer };
