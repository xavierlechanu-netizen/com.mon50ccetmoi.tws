/**
 * Nexus Atlas Chat Interface
 * Gère la fenêtre de discussion avec l'IA Gemini (Nexus Atlas 4.0).
 */

window.NexusAtlasChat = {
    modalId: "nexus-atlas-chat-modal",
    chatContainerId: "nexus-atlas-chat-messages",
    inputFieldId: "nexus-atlas-chat-input",

    open: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = "flex";
            
            // On affiche un message de bienvenue seulement s'il n'y a pas déjà de message
            const container = document.getElementById(this.chatContainerId);
            if (container && container.children.length === 0) {
                this.addMessage("Nexus Atlas", "Bonjour ! Je suis Nexus Atlas 4.0, votre copilote IA. Comment puis-je vous aider aujourd'hui ? (Mécanique, Itinéraire, Législation...)", "ai");
            }
            
            // Focus on input
            setTimeout(() => {
                const input = document.getElementById(this.inputFieldId);
                if (input) input.focus();
            }, 300);
        }
    },

    close: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = "none";
    },

    sendMessage: async function() {
        const input = document.getElementById(this.inputFieldId);
        const text = input.value.trim();
        if (!text) return;

        // Afficher message utilisateur
        this.addMessage("Vous", text, "user");
        input.value = "";

        // Afficher indicateur de frappe
        const typingId = this.addTypingIndicator();

        // 🛡️ Première barrière invisible : Détection de toxicité locale via Dictionnaire
        let isToxic = false;
        if (window.FrenchBadWords && Array.isArray(window.FrenchBadWords)) {
            const lowerText = text.toLowerCase();
            isToxic = window.FrenchBadWords.some(word => lowerText.includes(word.toLowerCase()));
        } else {
            // Fallback si le dictionnaire n'est pas chargé
            const toxicPatterns = /(connard|salop|pute|encul|fdp|gueule|tg\b|bâtard|merde|chier|tuer|suicide)/i;
            isToxic = toxicPatterns.test(text);
        }

        if (isToxic) {
            setTimeout(() => {
                this.removeElement(typingId);
                this.addMessage("Nexus Atlas (Modération)", "Je détecte une anomalie dans votre langage. Notre communauté repose sur le respect mutuel. Considérez ceci comme un avertissement subtil avant l'application stricte de nos CGU.", "ai");
            }, 1000);
            return; // Bloque l'envoi au serveur
        }

        try {
            if (!window.NexusAtlasGemini) throw new Error("Gemini non initialisé.");
            
            const response = await window.NexusAtlasGemini.ask(text);
            this.removeElement(typingId);

            // Afficher la réponse
            if (response.reply) {
                this.addMessage("Nexus Atlas", response.reply, "ai");
            }

            // Si Nexus Atlas doit déclencher une action visuelle (comme ouvrir le GPS ou lancer le mode avocat)
            if (response.action && response.action !== "NONE" && response.action !== "CHAT") {
                console.log("[NexusAtlasChat] Exécution de l'action :", response.action);
                if (window.OracleVoice && window.OracleVoice.executeAction) {
                    window.OracleVoice.executeAction(response.action, response.parameter);
                }
            }

        } catch (err) {
            console.error(err);
            this.removeElement(typingId);
            const userFriendlyMsg = err.message ? `Erreur IA : ${err.message}` : "Erreur de connexion au serveur IA. Veuillez vérifier votre réseau.";
            this.addMessage("Système", userFriendlyMsg, "error");
        }
    },

    handleEnter: function(event) {
        if (event.key === "Enter") {
            this.sendMessage();
        }
    },

    addMessage: function(sender, text, type) {
        const container = document.getElementById(this.chatContainerId);
        if (!container) return;

        const msgDiv = document.createElement("div");
        msgDiv.style.marginBottom = "15px";
        msgDiv.style.padding = "12px 15px";
        msgDiv.style.borderRadius = "12px";
        msgDiv.style.maxWidth = "85%";
        msgDiv.style.animation = "fadeInUp 0.3s ease-out";
        msgDiv.style.wordWrap = "break-word";
        msgDiv.style.lineHeight = "1.5";
        msgDiv.style.display = "inline-block";
        msgDiv.style.clear = "both";

        const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );

        const safeSender = escapeHTML(sender);
        const safeText = escapeHTML(text);

        if (type === "user") {
            msgDiv.style.background = "rgba(0, 242, 255, 0.15)";
            msgDiv.style.border = "1px solid rgba(0, 242, 255, 0.4)";
            msgDiv.style.float = "right";
            msgDiv.innerHTML = `<strong style="color: #00f2ff;">${safeSender}</strong><br/>${safeText}`;
        } else if (type === "ai") {
            msgDiv.style.background = "rgba(255, 255, 255, 0.05)";
            msgDiv.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            msgDiv.style.float = "left";
            
            // Formatage basique (gras) — appliqué APRÈS échappement pour éviter XSS
            let formattedText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            msgDiv.innerHTML = `<strong style="color: #ffd700;"><i class="fa-solid fa-microchip"></i> ${safeSender}</strong><br/>${formattedText}`;
        } else {
            msgDiv.style.background = "rgba(255, 0, 0, 0.1)";
            msgDiv.style.border = "1px solid rgba(255, 0, 0, 0.4)";
            msgDiv.style.float = "left";
            msgDiv.innerHTML = `<strong style="color: #ff4444;">${safeSender}</strong><br/>${safeText}`;
        }

        const wrapper = document.createElement("div");
        wrapper.style.width = "100%";
        wrapper.appendChild(msgDiv);

        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;
    },

    addTypingIndicator: function() {
        const container = document.getElementById(this.chatContainerId);
        if (!container) return null;

        const id = "typing-" + Date.now();
        const typingDiv = document.createElement("div");
        typingDiv.id = id;
        typingDiv.style.marginBottom = "15px";
        typingDiv.style.color = "#888";
        typingDiv.style.fontStyle = "italic";
        typingDiv.style.fontSize = "0.9rem";
        typingDiv.style.width = "100%";
        typingDiv.style.float = "left";
        typingDiv.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Nexus Atlas réfléchit...`;
        
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;
        return id;
    },

    removeElement: function(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
};
