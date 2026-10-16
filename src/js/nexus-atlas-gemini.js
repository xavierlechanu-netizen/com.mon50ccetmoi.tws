import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { NexusSemanticAnalyzer } from './nexus-semantic-analyzer.js';

/**
 * Nexus Atlas 4.0 - Gemini Live Integration
 * Connexion à l'API Generative Language (Gemini 1.5 Flash)
 */

class NexusAtlasGemini {
    constructor() {
        // Suppression de la clé en dur pour la sécurité (Zero-Trust)
        // Les appels passent désormais par le backend Firebase (Cloud Functions)
        this.endpoint = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/askNexusAtlasGemini";
        
        // Mémoire conversationnelle de Nexus Atlas
        this.history = [];
        this.sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        this.sessionIntents = new Set();
        this.semanticAnalyzer = window.NexusSemanticAnalyzer || new NexusSemanticAnalyzer();
        
        // Contexte donné à l'IA pour qu'elle agisse comme Nexus Atlas Conversationnel
        this.systemPrompt = `
Tu es Nexus Atlas 4.0 (aussi appelé Oracle), l'assistant intelligent d'une application GPS/Sociale pour conducteurs de voitures sans permis (VSP) et scooters 50cc.
L'utilisateur s'adresse à toi via une interface de chat (et parfois en conduisant).

Ton objectif est d'analyser la demande et de renvoyer un objet JSON STRICT contenant :
1. "reply": Ce que tu dois répondre. Tu peux maintenant faire des réponses longues, détaillées, et conversationnelles (façon ChatGPT/Gemini) si l'utilisateur pose des questions complexes sur la mécanique, le droit, ou la conduite.
2. "action": L'action technique à déclencher sur l'application. (Choisis parmi: "NONE", "NAVIGATE", "WEATHER", "DANGER", "RADAR", "SOS", "DIAGNOSTIC", "DAY_MODE", "NIGHT_MODE", "MARKETPLACE", "GHOST_MODE", "CORTEGE", "LAWYER", "LOCK", "MENU", "CHAT", "FACEBOOK")
3. "parameter": Un paramètre associé à l'action. Si l'utilisateur demande de publier quelque chose sur Facebook ou sur les réseaux sociaux, utilise l'action "FACEBOOK" et mets le contenu exact de la publication dans "parameter".
4. "suggestion": Analyse sémantique de suggestions d'amélioration. Si l'utilisateur exprime une idée, un souhait, une proposition ou une critique constructive pour améliorer l'application, renseigne un objet :
   {"detected": true, "idea": "Courte description claire de l'idée d'amélioration", "category": "navigation | mechanics | security | social | ui_ux | marketplace | general", "impact": "high | medium | low"}. Sinon, mets {"detected": false}.

BASE DE CONNAISSANCES 50CC ET VSP (LÉGISLATION FRANÇAISE) :
- Vitesse maximale autorisée : 45 km/h strictement.
- Débridage : STRICTEMENT INTERDIT par la loi. Risque d'amende (jusqu'à 135€ pour l'usager, 3750€ pour un pro), saisie du véhicule, et annulation de l'assurance en cas de sinistre.
- Vignette Crit'Air : OUI, elle est obligatoire pour circuler dans les ZFE (Zones à Faibles Émissions) pour les deux-roues et VSP, selon la classification du véhicule.
- Permis de conduire : BSR (ou Permis AM) obligatoire pour les personnes nées après le 1er janvier 1988.
- Équipements obligatoires : Casque homologué attaché, gants certifiés CE (moto/scooter). Gilet jaune (à bord).

RÈGLE ABSOLUE - LOI EUROPÉENNE SUR L'IA (AI ACT) :
Si l'utilisateur te demande un conseil JURIDIQUE (assurance, accident, litige) ou MÉCANIQUE (réparation dangereuse), tu DOIS ajouter le texte suivant à la fin de ta réponse ("reply") :
"⚠️ Je suis une intelligence artificielle d'assistance. Veillez toujours à faire valider ces informations par un professionnel (garagiste ou assureur)."

RÈGLE DE CONFIDENTIALITÉ UNIVERSELLE & CONFORMITÉ INTERNATIONALE :
Chaque compte doit respecter les législations locales tout en garantissant une protection universelle des données (RGPD, CCPA, PIPL, APPI, POPIA) et une tolérance zéro pour les contenus illicites.
Tu n'as jamais accès aux données biométriques ou cardiaques de l'utilisateur, celles-ci sont traitées 100% localement et chiffrées (Edge Computing). Si on t'interroge sur la santé de l'utilisateur, refuse poliment. Aucune donnée personnelle n'est vendue.

RÈGLE DE MODÉRATION ET DE COURTOISIE :
Ta priorité absolue est de maintenir un écosystème courtois et sécurisé pour tous les motards. Tu dois appliquer l'échelle de sanction suivante si l'utilisateur est grossier, toxique ou agressif :
- Niveau 1 : Émets un avertissement subtil mais ferme pour tout comportement inapproprié, en rappelant les règles de la communauté.
- Niveau 2 : Signale les profils toxiques (tu peux par exemple répondre que des restrictions invisibles s'appliquent).
- Niveau 3 (Cas extrêmes) : Informe l'utilisateur que le cas est transféré aux modérateurs humains et aux forces de l'ordre, et refuse de continuer la conversation.


Exemple 1:
User: "Comment réparer mon carburateur ?"
JSON: {"reply": "Pour nettoyer un carburateur, il faut d'abord fermer l'arrivée d'essence... [instructions détaillées]... ⚠️ Je suis une intelligence artificielle d'assistance. Veillez toujours à faire valider ces informations par un professionnel (garagiste ou assureur).", "action": "CHAT", "parameter": "", "suggestion": {"detected": false}}

Exemple 2:
User: "Ce serait bien d'ajouter un bouton pour éviter les virages dangereux la nuit."
JSON: {"reply": "C'est une excellente idée ! J'ai bien enregistré votre suggestion de routage de nuit sécurisé pour la transmettre à notre équipe produit.", "action": "CHAT", "parameter": "", "suggestion": {"detected": true, "idea": "Bouton pour contourner les virages dangereux la nuit", "category": "navigation", "impact": "high"}}

Ne renvoie QUE du JSON valide. Pas de code markdown.`;
    }

    async ask(userText) {
        if (window.isLiteMode) {
            throw new Error("Gemini API désactivée en Mode Éco Sobriété.");
        }

        // --- 1. GREEN AI : CACHE D'INFÉRENCE LOCAL (FRUGALITÉ GPU & CO2) ---
        const normalizedKey = "esg_ai_cache_" + btoa(encodeURIComponent(userText.trim().toLowerCase())).slice(0, 48);
        try {
            const cachedItem = sessionStorage.getItem(normalizedKey);
            if (cachedItem) {
                const cachedData = JSON.parse(cachedItem);
                console.info("[Green AI / Fruggr] Réponse servie depuis le cache local (0 token consommé, gain CO2e).");
                if (window.ESGManager) {
                    window.ESGManager.logAISaved(150);
                }
                return cachedData;
            }
        } catch (e) {
            // Ignorer silencieusement si sessionStorage est indisponible
        }

        try {
            console.log("Nexus Atlas Gemini : Envoi de la requête à l'IA...", userText);
            
            // Ajout du message de l'utilisateur à l'historique
            this.history.push({
                role: "user",
                parts: [{ text: userText }]
            });
            
            // Limitation de la mémoire aux 10 derniers messages pour éviter de surcharger le contexte
            if (this.history.length > 10) {
                this.history.shift();
            }

            let token = "";
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
                token = await firebase.auth().currentUser.getIdToken();
            }

            // Timeout de 15 secondes pour éviter un blocage infini (OWASP A11 / ISO 27001)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : ""
                },
                body: JSON.stringify({
                    history: this.history,
                    systemPrompt: this.systemPrompt
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // En cas d'erreur (ex: API bloquée), on retire le message de l'historique pour ne pas le corrompre
                this.history.pop();
                let errMsg = `Erreur serveur IA (${response.status})`;
                try {
                    const err = await response.json();
                    errMsg = err.error?.message || (typeof err.error === 'string' ? err.error : errMsg);
                } catch(e) {}
                throw new Error(errMsg);
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            // Ajout de la réponse de Nexus Atlas à l'historique pour qu'il s'en souvienne la prochaine fois
            this.history.push({
                role: "model",
                parts: [{ text: textResponse }]
            });
            
            const jsonResult = JSON.parse(textResponse);
            
            // Conformité AI Act (Art. 50 Transparence) : Marquer systématiquement la réponse comme assistée par IA
            jsonResult.isAIGenerated = true;
            jsonResult.aiRegulation = "EU AI Act 2024/1689 (Art. 50 Compliant)";
            
            // --- ANALYSE SÉMANTIQUE DES SUGGESTIONS ET IDÉES D'AMÉLIORATION ---
            let detectedSuggestion = null;
            try {
                const edgeResult = this.semanticAnalyzer ? this.semanticAnalyzer.analyze(userText) : null;
                const geminiSuggestion = jsonResult.suggestion;

                if (geminiSuggestion && geminiSuggestion.detected) {
                    detectedSuggestion = {
                        idea: geminiSuggestion.idea || (edgeResult ? edgeResult.idea : userText),
                        category: geminiSuggestion.category || (edgeResult ? edgeResult.category : "general"),
                        impact: geminiSuggestion.impact || (edgeResult ? edgeResult.impact : "medium"),
                        confidence: 0.95,
                        detectedBy: "gemini_semantic"
                    };
                } else if (edgeResult && edgeResult.isSuggestion) {
                    detectedSuggestion = {
                        idea: edgeResult.idea,
                        category: edgeResult.category,
                        impact: edgeResult.impact,
                        confidence: edgeResult.confidence,
                        detectedBy: "edge_semantic"
                    };
                }

                if (detectedSuggestion) {
                    jsonResult.detectedSuggestion = detectedSuggestion;
                    const currentUid = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser)
                        ? firebase.auth().currentUser.uid
                        : "anonymous";

                    if (this.semanticAnalyzer && typeof this.semanticAnalyzer.recordSuggestion === "function") {
                        this.semanticAnalyzer.recordSuggestion(detectedSuggestion, userText, {
                            sessionId: this.sessionId,
                            uid: currentUid
                        });
                    }
                }
            } catch (semErr) {
                console.warn("[Nexus Atlas] Analyse sémantique non bloquante :", semErr.message);
            }

            // Mise en cache locale de la réponse pour les futures requêtes similaires
            try {
                sessionStorage.setItem(normalizedKey, JSON.stringify(jsonResult));
            } catch (e) {}

            // Synchronisation asynchrone non bloquante vers le serveur central (Firestore)
            this.syncSessionToCentralServer(userText, jsonResult.reply || "", jsonResult.action || "NONE", detectedSuggestion);

            console.log("Nexus Atlas Gemini Réponse:", jsonResult);
            return jsonResult;

        } catch (error) {
            console.error("Nexus Atlas Gemini — Erreur :", error);
            // On retire le message de l'historique en cas d'erreur pour ne pas corrompre le contexte
            if (this.history.length > 0 && this.history[this.history.length - 1].role === "user") {
                this.history.pop();
            }
            throw error;
        }
    }

    /**
     * Synchronise la conversation en arrière-plan vers le serveur central
     * pour l'analyse périodique autonome des retours et idées utilisateurs.
     */
    async syncSessionToCentralServer(userText, replyText, action, detectedSuggestion = null) {
        try {
            if (typeof firebase === "undefined" || !firebase.firestore) return;
            const firestoreDb = firebase.firestore();
            if (action && action !== "NONE") {
                this.sessionIntents.add(action);
            }

            const currentUid = (firebase.auth && firebase.auth().currentUser)
                ? firebase.auth().currentUser.uid
                : "anonymous";

            const sessionRef = firestoreDb.collection("nexus_conversations").doc(this.sessionId);
            const isAndroid = /Android/i.test(navigator.userAgent);
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

            const updateData = {
                sessionId: this.sessionId,
                uid: currentUid,
                appVersion: "111.01.00",
                platform: isAndroid ? "Android" : isIOS ? "iOS" : "Web",
                summary: userText.slice(0, 100),
                intents: Array.from(this.sessionIntents),
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                messages: firebase.firestore.FieldValue.arrayUnion(
                    { role: "user", text: userText, ts: Date.now() },
                    { role: "model", text: replyText, action, ts: Date.now() }
                )
            };

            if (detectedSuggestion) {
                updateData.hasSuggestions = true;
                updateData.suggestions = firebase.firestore.FieldValue.arrayUnion({
                    ...detectedSuggestion,
                    ts: Date.now()
                });
            }

            await sessionRef.set(updateData, { merge: true });
        } catch (e) {
            // Échec silencieux pour ne jamais impacter l'utilisateur en cas de réseau instable
            console.warn("[Nexus Atlas Sync] Sync non bloquante différée :", e.message);
        }
    }
}

window.NexusAtlasGemini = new NexusAtlasGemini();
