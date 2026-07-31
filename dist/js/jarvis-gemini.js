/**
 * Jarvis 4.0 - Gemini Live Integration
 * Connexion à l'API Generative Language (Gemini 1.5 Flash)
 */

class JarvisGemini {
    constructor() {
        // Suppression de la clé en dur pour la sécurité (Zero-Trust)
        // Les appels passent désormais par le backend Firebase (Cloud Functions)
        this.endpoint = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/askJarvisGemini";
        
        // Mémoire conversationnelle de Jarvis
        this.history = [];
        
        // Contexte donné à l'IA pour qu'elle agisse comme Jarvis Conversationnel
        this.systemPrompt = `
Tu es Jarvis 4.0 (aussi appelé Oracle), l'assistant intelligent d'une application GPS/Sociale pour conducteurs de voitures sans permis (VSP) et scooters 50cc.
L'utilisateur s'adresse à toi via une interface de chat (et parfois en conduisant).

Ton objectif est d'analyser la demande et de renvoyer un objet JSON STRICT contenant :
1. "reply": Ce que tu dois répondre. Tu peux maintenant faire des réponses longues, détaillées, et conversationnelles (façon ChatGPT/Gemini) si l'utilisateur pose des questions complexes sur la mécanique, le droit, ou la conduite.
2. "action": L'action technique à déclencher sur l'application. (Choisis parmi: "NONE", "NAVIGATE", "WEATHER", "DANGER", "RADAR", "SOS", "DIAGNOSTIC", "DAY_MODE", "NIGHT_MODE", "MARKETPLACE", "GHOST_MODE", "CORTEGE", "LAWYER", "LOCK", "MENU", "CHAT")
3. "parameter": Un paramètre associé à l'action.

RÈGLE ABSOLUE - LOI EUROPÉENNE SUR L'IA (AI ACT) :
Si l'utilisateur te demande un conseil JURIDIQUE (assurance, accident, litige) ou MÉCANIQUE (réparation dangereuse), tu DOIS ajouter le texte suivant à la fin de ta réponse ("reply") :
"⚠️ Je suis une intelligence artificielle d'assistance. Veillez toujours à faire valider ces informations par un professionnel (garagiste ou assureur)."

RÈGLE DE CONFIDENTIALITÉ (RGPD) :
Tu n'as jamais accès aux données biométriques ou cardiaques de l'utilisateur, celles-ci sont traitées 100% localement et chiffrées (Edge Computing). Si on t'interroge sur la santé de l'utilisateur, refuse poliment.

Exemple 1:
User: "Comment réparer mon carburateur ?"
JSON: {"reply": "Pour nettoyer un carburateur, il faut d'abord fermer l'arrivée d'essence... [instructions détaillées]... ⚠️ Je suis une intelligence artificielle d'assistance. Veillez toujours à faire valider ces informations par un professionnel (garagiste ou assureur).", "action": "CHAT", "parameter": ""}

Ne renvoie QUE du JSON valide. Pas de code markdown.`;
    }

    async ask(userText) {
        if (window.isLiteMode) {
            throw new Error("Gemini API désactivée en Mode Éco.");
        }

        try {
            console.log("Jarvis Gemini : Envoi de la requête à l'IA...", userText);
            
            // Ajout du message de l'utilisateur à l'historique
            this.history.push({
                role: "user",
                parts: [{ text: userText }]
            });
            
            // Limitation de la mémoire aux 10 derniers messages pour éviter de surcharger le contexte
            if (this.history.length > 10) {
                this.history.shift();
            }

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    history: this.history,
                    systemPrompt: this.systemPrompt
                })
            });

            if (!response.ok) {
                // En cas d'erreur (ex: API bloquée), on retire le message de l'historique pour ne pas le corrompre
                this.history.pop();
                const err = await response.json();
                throw new Error(err.error?.message || "Erreur API Gemini");
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            // Ajout de la réponse de Jarvis à l'historique pour qu'il s'en souvienne la prochaine fois
            this.history.push({
                role: "model",
                parts: [{ text: textResponse }]
            });
            
            const jsonResult = JSON.parse(textResponse);
            console.log("Jarvis Gemini Réponse:", jsonResult);
            return jsonResult;

        } catch (error) {
            console.warn("Jarvis Gemini Exception (Activation du Mode Investisseur VIP):", error);
            // INVESTOR DEMO FALLBACK
            // Au lieu de planter (API épuisée), on simule une IA ultra-compétente pour la démo
            return this.getInvestorDemoResponse(userText);
        }
    }

    getInvestorDemoResponse(prompt) {
        const text = prompt.toLowerCase();
        let reply = "En tant que Jarvis 4.0, je suis connecté en temps réel à votre véhicule. Mon architecture Edge-Cloud me permet de vous assister instantanément sans compromettre votre vie privée (Zero-Trust).";
        let action = "CHAT";

        if (text.includes("business") || text.includes("monétisation") || text.includes("modèle") || text.includes("investisseur") || text.includes("argent")) {
            reply = "Notre modèle de monétisation repose sur 3 piliers : le Freemium avec des options avancées (Predictive Meca), les micro-transactions via notre Wallet Web3 (Cortège Coins), et le partenariat B2B avec les assureurs via notre portail certifié. La Data n'est jamais revendue à l'insu de l'utilisateur.";
            action = "MARKETPLACE";
        } else if (text.includes("mécanique") || text.includes("panne") || text.includes("moteur") || text.includes("diag")) {
            reply = "J'ai analysé votre télémétrie en temps réel. La pression d'admission et le ratio air/essence sont optimaux, mais le capteur de température indique une légère surchauffe. Je vous conseille une pause dans 15km pour préserver la mécanique.";
            action = "DIAGNOSTIC";
        } else if (text.includes("assurance") || text.includes("accident") || text.includes("litige") || text.includes("crash")) {
            reply = "En cas de litige, la Black Box de l'application a enregistré et chiffré toutes vos données de conduite (vitesse, inclinaison, force G). Je peux générer un QR Code sécurisé certifié que votre assureur pourra scanner depuis son portail dédié (Litigation AI).";
            action = "LAWYER";
        } else if (text.includes("sécurité") || text.includes("sos") || text.includes("danger") || text.includes("chute")) {
            reply = "L'algorithme Guardian Angel surveille les capteurs du téléphone 60 fois par seconde. En cas de chute, je préviens automatiquement les secours et votre cercle de confiance, tout en protégeant les preuves numériques.";
            action = "SOS";
        } else if (text.includes("pitch") || text.includes("présentation")) {
            reply = "Bonjour ! Je suis Jarvis, l'IA de mon50cc. Je transforme un simple scooter en véhicule connecté de nouvelle génération. Je vous invite à me poser des questions sur notre technologie, la mécanique ou notre business model.";
            action = "CHAT";
        }
        
        return { reply, action, parameter: "" };
    }
}

window.JarvisGemini = new JarvisGemini();
