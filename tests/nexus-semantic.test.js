/**
 * Unit Tests for Nexus Atlas Semantic Analyzer
 * Vérifie la détection proactive et autonome des suggestions et idées d'amélioration
 */

const fs = require('fs');
const path = require('path');

describe('Nexus Atlas Semantic Analyzer (AI Act Art. 50 & Amélioration Continue)', () => {
    let NexusSemanticAnalyzer;

    beforeEach(() => {
        window.localStorage.clear();
        jest.restoreAllMocks();
        jest.spyOn(Storage.prototype, 'setItem');

        // Charger le module
        const code = fs.readFileSync(path.resolve(__dirname, '../src/js/nexus-semantic-analyzer.js'), 'utf8');
        const cleanedCode = code.replace(/export default.*;|export\s*\{[^}]*\};?/g, '');
        eval(cleanedCode);
        NexusSemanticAnalyzer = window.NexusSemanticAnalyzer.constructor;
    });

    test('Détecte une suggestion d\'itinéraire avec catégorie navigation', () => {
        const analyzer = new NexusSemanticAnalyzer();
        const res = analyzer.analyze("Ce serait bien d'ajouter une option pour contourner les virages dangereux sur l'itinéraire.");

        expect(res.isSuggestion).toBe(true);
        expect(res.category).toBe('navigation');
        expect(res.confidence).toBeGreaterThanOrEqual(0.65);
        expect(res.idea).toContain('contourner');
    });

    test('Détecte une idée mécanique avec mot-clé "il faudrait"', () => {
        const analyzer = new NexusSemanticAnalyzer();
        const res = analyzer.analyze("Il faudrait ajouter un rappel automatique pour la vidange d'huile et le contrôle de la batterie.");

        expect(res.isSuggestion).toBe(true);
        expect(res.category).toBe('mechanics');
        expect(res.idea).toBeDefined();
    });

    test('Détecte une suggestion UI/UX avec "pourquoi pas"', () => {
        const analyzer = new NexusSemanticAnalyzer();
        const res = analyzer.analyze("Pourquoi pas un mode nuit avec une police plus grande pour l'affichage ?");

        expect(res.isSuggestion).toBe(true);
        expect(res.category).toBe('ui_ux');
    });

    test('Détecte une suggestion de sécurité avec impact élevé', () => {
        const analyzer = new NexusSemanticAnalyzer();
        const res = analyzer.analyze("J'aimerais bien qu'on puisse déclencher une alerte d'urgence SOS si le casque n'est pas détecté.");

        expect(res.isSuggestion).toBe(true);
        expect(res.category).toBe('security');
        expect(res.impact).toBe('high');
    });

    test('Ignore les questions courantes et messages sans intention de suggestion', () => {
        const analyzer = new NexusSemanticAnalyzer();
        const res1 = analyzer.analyze("Bonjour Nexus Atlas, quelle est la vitesse maximale d'un 50cc ?");
        const res2 = analyzer.analyze("Comment régler mon carburateur ?");
        const res3 = analyzer.analyze("Merci pour l'info.");

        expect(res1.isSuggestion).toBe(false);
        expect(res2.isSuggestion).toBe(false);
        expect(res3.isSuggestion).toBe(false);
    });

    test('Enregistre la suggestion dans le stockage local pour la Boîte à Idées Admin', async () => {
        const analyzer = new NexusSemanticAnalyzer();
        const suggestion = {
            idea: "Ajout d'un bouton d'essence urgente",
            category: "navigation",
            impact: "medium",
            confidence: 0.85
        };

        await analyzer.recordSuggestion(suggestion, "Il faudrait rajouter un bouton essence rapide.", {
            sessionId: "sess_123",
            uid: "user_pilot_456"
        });

        expect(Storage.prototype.setItem).toHaveBeenCalledWith(
            "suggestions",
            expect.stringContaining("Ajout d'un bouton d'essence urgente")
        );
    });
});
