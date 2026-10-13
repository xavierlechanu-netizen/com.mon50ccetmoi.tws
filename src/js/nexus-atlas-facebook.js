import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * Nexus Atlas — Module Facebook Publishing
 * Permet à Nexus Atlas de publier sur la Page Facebook via commande chat/voix.
 * Accès restreint aux admins (vérifié côté serveur via Cloud Function).
 */

window.NexusAtlasFacebook = {
    endpoint: "https://europe-west1-mon50ccetmoi.cloudfunctions.net/publishToFacebook",

    /**
     * Publie un message sur la Page Facebook mon50ccetmoi.
     * @param {string} message - Le texte du post
     * @param {object} options - { link?, imageUrl?, hashtags? }
     * @returns {Promise<object>} - { success, postId }
     */
    publishToFacebook: async function (message, options = {}) {
        if (!message || message.trim().length < 5) {
            throw new Error("Le message doit contenir au moins 5 caractères.");
        }

        // Vérification auth locale (la vraie vérification est côté serveur)
        const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
        if (!user) {
            throw new Error("Vous devez être connecté pour publier sur Facebook.");
        }

        const token = await user.getIdToken();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: message.trim(),
                    link: options.link || null,
                    imageUrl: options.imageUrl || null,
                    hashtags: options.hashtags || ["mon50ccetmoi", "securiteroutiere", "50cc"]
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `Erreur HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log("[NexusAtlas Facebook] ✅ Publication réussie :", data.postId);
            return data;

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === "AbortError") {
                throw new Error("Délai d'attente dépassé pour la publication Facebook.", { cause: error });
            }
            throw error;
        }
    },

    previewEndpoint: "https://europe-west1-mon50ccetmoi.cloudfunctions.net/previewFacebookDailyPost",

    /**
     * Prévisualise le post quotidien automatique (texte + visuel) SANS le publier.
     * Réservé aux admins (vérifié côté serveur).
     * @returns {Promise<object>} - { message, headline, theme, image (data URL), stats, activityIndex, contentSource }
     */
    previewDailyPost: async function () {
        const user = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
        if (!user) throw new Error("Vous devez être connecté pour prévisualiser la publication.");

        const token = await user.getIdToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        try {
            const response = await fetch(this.previewEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: "{}",
                signal: controller.signal
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Erreur HTTP ${response.status}`);
            console.log(`[NexusAtlas Facebook] Prévisualisation prête (source: ${data.contentSource}, format: ${data.format})`);
            return data;
        } catch (error) {
            if (error.name === "AbortError") throw new Error("Délai dépassé pour la prévisualisation.", { cause: error });
            console.error("[NexusAtlas Facebook] Échec prévisualisation :", error.message);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /**
     * Affiche la prévisualisation façon post Facebook dans un conteneur.
     * Sécurité : contenu IA inséré via textContent uniquement (OWASP A03).
     * @param {HTMLElement} container
     * @param {object} data - Réponse de previewDailyPost()
     */
    renderPreview: function (container, data) {
        if (!container || !data) return;
        container.replaceChildren();

        const card = document.createElement("article");
        card.style.cssText = "max-width:500px;background:#18191a;color:#e4e6eb;border-radius:12px;font-family:Inter,system-ui,sans-serif;overflow:hidden;border:1px solid #3a3b3c";

        const header = document.createElement("header");
        header.style.cssText = "display:flex;align-items:center;gap:10px;padding:12px 16px";
        const avatar = document.createElement("div");
        avatar.style.cssText = "width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#00f2ff,#b700ff)";
        const meta = document.createElement("div");
        const page = document.createElement("strong");
        page.textContent = "mon50ccetmoi";
        const sub = document.createElement("div");
        sub.style.cssText = "font-size:12px;color:#b0b3b8";
        sub.textContent = `Prévisualisation · ${data.dateKey || ""} · 🌐`;
        meta.append(page, sub);
        header.append(avatar, meta);

        const body = document.createElement("p");
        body.style.cssText = "white-space:pre-line;padding:0 16px 12px;margin:0;font-size:15px;line-height:1.4";
        body.textContent = data.message || "";

        card.append(header, body);

        if (data.image && data.image.startsWith("data:image/png;base64,")) {
            const img = document.createElement("img");
            img.src = data.image;
            img.alt = `Carte de télémétrie Nexus Atlas — ${data.headline || ""}`;
            img.style.cssText = "display:block;width:100%;height:auto";
            card.append(img);
        }

        const footer = document.createElement("footer");
        footer.style.cssText = "padding:10px 16px;font-size:12px;color:#b0b3b8;border-top:1px solid #3a3b3c";
        footer.textContent = `Thème : ${data.theme} · Indice : ${data.activityIndex ? data.activityIndex.score : "?"}/100 · Texte : ${data.contentSource === "gemini" ? "Gemini" : "repli éditorial"} · Contenu IA soumis à contrôle humain`;
        card.append(footer);

        container.append(card);
    }
};

// Enregistrement dans l'Action Registry pour la commande vocale et le chat
registerAction('publishToFacebook', (message, options) =>
    window.NexusAtlasFacebook.publishToFacebook(message, options)
);
registerAction('previewFacebookDailyPost', () =>
    window.NexusAtlasFacebook.previewDailyPost()
);
