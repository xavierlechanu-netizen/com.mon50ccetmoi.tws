// --- MODERATION SYSTEM v1.0 ---
const BANNED_WORDS = [
    'merde', 'putain', 'connard', 'salope', 'encule', 'bite', 'couille', 'nique', 
    'fuck', 'shit', 'bitch', 'asshole', 'pussy', 'dick'
];

window.Moderation = {
    // Vérifie si le texte contient des mots interdits
    isProfane: function(text) {
        if (!text) return false;
        const low = text.toLowerCase();
        return BANNED_WORDS.some(word => low.includes(word));
    },

    // Nettoie le texte (remplace par des étoiles)
    clean: function(text) {
        if (!text) return "";
        let cleaned = text;
        BANNED_WORDS.forEach(word => {
            const regex = new RegExp(word, 'gi');
            cleaned = cleaned.replace(regex, '***');
        });
        return cleaned;
    },

    // Simulation de scan d'image (IA) - Note: Normalement via Google Vision API
    scanImage: async function(imageData) {
        return new Promise((resolve) => {
            console.log("[AI MODERATION] Scanning image for safety...");
            setTimeout(() => {
                // Simulation : On accepte tout ce qui n'est pas "vide" pour la démo
                // Dans le futur, on appellerait une API de reconnaissance d'image
                resolve({ safe: true, score: 0.99 });
            }, 1000);
        });
    }
};
