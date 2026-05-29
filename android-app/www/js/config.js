/**
 * CONFIGURATION GLOBALE - mon50ccetmoi
 * Centralisation des clés et configurations sensibles.
 */
const CONFIG = {
    // Google Maps API Keys
    MAPS: {
        PC: "AIzaSyCN_fevTiG8AvWPuDS2Kc_WpwlYfDy4k4M",
        ANDROID: "AIzaSyCN_fevTiG8AvWPuDS2Kc_WpwlYfDy4k4M",
        MAP_ID: "" // Laisser vide si non configuré sur Google Cloud
    },

    // Auth Configuration
    AUTH: {
        GOOGLE_CLIENT_ID: "618915667828-ebv4uc1ehq7mhks9l1qajrtg7k833jab.apps.googleusercontent.com"
    },

    // App Versioning
    VERSION: "50.1.8-GOLD",

    // Firebase Cloud Database (Firestore)
    FIREBASE: {
        apiKey: "AIzaSyBufZ5hmzEoDoOZ9YofpHvL3HJDbuEOc7I",
        authDomain: "mon50ccetmoi.firebaseapp.com",
        projectId: "mon50ccetmoi",
        storageBucket: "mon50ccetmoi.appspot.com",
        messagingSenderId: "618915667828",
        appId: "1:618915667828:web:7f6d4e21a3b5c0d9e1f2"
    },

    // ─────────────────────────────────────────────────────
    // REVOLUT BUSINESS — Paiements Merchant
    // Clé publique Merchant (pk_...) — sans danger côté client
    // La clé secrète (sk_...) ne va JAMAIS ici — Firebase Functions uniquement
    // ─────────────────────────────────────────────────────
    REVOLUT: {
        PUBLIC_KEY: "pk_kkwSOEhfQdseB6OVcsYEIpdAwxNxY0JvSUtgtQlLuNlFpNED", // Clé Merchant publique
        PAYMENT_LINK: "",      // Laisser vide — on utilise le SDK embarqué
        MERCHANT_ID: "",       // Rempli automatiquement par l'API
        CURRENCY: "EUR",
        AMOUNT_CENTS: 4999,    // 49,99 €
        SUCCESS_REDIRECT: "https://mon50ccetmoi.com/?payment=success",
        FAIL_REDIRECT:    "https://mon50ccetmoi.com/?payment=failed"
    },

    // ─────────────────────────────────────────────────────
    // PORTAIL ASSURANCE — Paramètres IA litige
    // ─────────────────────────────────────────────────────
    INSURANCE: {
        FIRESTORE_COLLECTION: "litigation_proposals", // Collection Firestore des propositions
        REPORT_PRICE_EUR: 49.99,
        // Seuils IA pour la sélection automatique du type de rapport
        AI_THRESHOLDS: {
            IMPACT_G: 3.5,          // Au-dessus → Rapport Impact
            EXPERT_G: 5.0,          // Au-dessus → Rapport Expertise Complète
            HIGH_SPEED_KMH: 60,     // Vitesse considérée élevée pour le contexte 50cc
            LEAN_ANGLE_DEG: 35      // Angle d'inclinaison critique
        }
    }
};
