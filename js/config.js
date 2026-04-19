/**
 * CONFIGURATION GLOBALE - mon50ccetmoi
 * Centralisation des clés et configurations sensibles.
 */
const CONFIG = {
    // Google Maps API Keys
    MAPS: {
        PC: (typeof SECRETS !== 'undefined') ? SECRETS.MAPS_PC : "REPLACE_WITH_YOUR_KEY",
        ANDROID: (typeof SECRETS !== 'undefined') ? SECRETS.MAPS_ANDROID : "REPLACE_WITH_YOUR_KEY"
    },
    
    // Auth Configuration
    AUTH: {
        GOOGLE_CLIENT_ID: "618915667828-ebv4uc1ehq7mhks9l1qajrtg7k833jab.apps.googleusercontent.com"
    },
    
    // App Versioning
    VERSION: "20.1-FINAL",

    // Firebase Cloud Database (Firestore)
    FIREBASE: {
        apiKey: (typeof SECRETS !== 'undefined' && SECRETS.FIREBASE_API_KEY) ? SECRETS.FIREBASE_API_KEY : "AIzaSy_PLACEHOLDER_KEY",
        authDomain: "mon50ccetmoi.firebaseapp.com",
        projectId: "mon50ccetmoi",
        storageBucket: "mon50ccetmoi.appspot.com",
        messagingSenderId: "618915667828",
        appId: "1:618915667828:web:7f6d4e21a3b5c0d9e1f2"
    }
};
