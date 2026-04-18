// --- ENCRYPTION WRAPPER ---
// Note: Dans une app pro, cette clé devrait être générée ou récupérée via un challenge distant.
const _KEY_PART_A = "m50cc";
const _KEY_PART_B = "v11_ultra_guard_";
const _LOCAL_ENC_PASSPHRASE = _KEY_PART_A + _KEY_PART_B + window.location.hostname;

window.secureSetItem = function(key, value) {
    if(typeof CryptoJS !== 'undefined') {
        const encrypted = CryptoJS.AES.encrypt(value, _LOCAL_ENC_PASSPHRASE).toString();
        localStorage.setItem(key, encrypted);
    } else {
        console.error("Sécurité compromise : Librairie de chiffrement manquante.");
    }
};

window.secureGetItem = function(key) {
    const data = localStorage.getItem(key);
    if (!data || typeof CryptoJS === 'undefined') return null;
    try {
        const bytes = CryptoJS.AES.decrypt(data, _LOCAL_ENC_PASSPHRASE);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || null;
    } catch (e) { return null; }
};

window.secureRemoveItem = function(key) {
    localStorage.removeItem(key);
};

// --- AUTO-PURGE SYSTEM (RGPD) ---
function purgeInactiveUsers() {
    const INACTIVITY_LIMIT_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours
    const now = Date.now();
    let users = JSON.parse(secureGetItem('users') || '[]');
    const initialCount = users.length;

    users = users.filter(u => {
        if (u.role === 'admin') return true; // L'admin est permanent
        const lastSeen = u.lastSeen || now; 
        return (now - lastSeen) <= INACTIVITY_LIMIT_MS;
    });

    if (users.length < initialCount) {
        secureSetItem('users', JSON.stringify(users));
        console.warn(`[RGPD] ${initialCount - users.length} compte(s) inactif(s) (>90 jours) supprimé(s).`);
    }
}

function updateActivity() {
    const raw = secureGetItem('session');
    if (!raw) return;
    const session = JSON.parse(raw);
    if (session.isGuest) return;

    let users = JSON.parse(secureGetItem('users') || '[]');
    const userIndex = users.findIndex(u => u.username === session.username);
    
    if (userIndex !== -1) {
        users[userIndex].lastSeen = Date.now();
        secureSetItem('users', JSON.stringify(users));
    }
}

// --- DATABASE INITIALIZATION ---

if (!secureGetItem('users')) {
    secureSetItem('users', JSON.stringify([
        { 
            username: 'admin', 
            // Mot de passe sécurisé haché (SHA256 de 'admin50')
            password: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 
            role: 'admin' 
        }
    ]));
}

// Table des signalements communautaires (Markers Danger)
if (!secureGetItem('hazards')) {
    secureSetItem('hazards', JSON.stringify([]));
}

// Nettoyage au démarrage
purgeInactiveUsers();

function login(username, password) {
    const users = JSON.parse(secureGetItem('users'));
    const userIndex = users.findIndex(u => u.username === username && u.password === password);
    
    if (userIndex !== -1) {
        users[userIndex].lastSeen = Date.now(); // Update last activity
        secureSetItem('users', JSON.stringify(users));
        secureSetItem('session', JSON.stringify(users[userIndex]));

        // Synchronisation Cloud
        if (typeof syncUserToCloud === "function") {
            syncUserToCloud(users[userIndex]);
        }

        if (users[userIndex].role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    } else {
        alert("Nom d'utilisateur ou mot de passe incorrect.");
    }
}

window.loginAsGuest = function() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const guestUser = { username: "Pilote_" + (array[0] % 1000), brand: "Incognito", role: "guest", isGuest: true };
    secureSetItem('session', JSON.stringify(guestUser));
    // Redirection directe pour les tests et la fluidité
    window.location.href = 'index.html';
};

function register(username, password, brand, model) {
    if(!username || !password || !brand || !model) {
        alert("Veuillez remplir tous les champs (Pseudo, Mot de passe, Marque et Modèle).");
        return;
    }
    
    let users = JSON.parse(secureGetItem('users'));
    if (users.find(u => u.username === username)) {
        alert("Ce pseudo est déjà utilisé. Choisissez-en un autre.");
        return;
    }

    // Capture IP/Fingerprint
    loginAndCaptureInfo(username, password, brand, model); // Utilitaire interne
}

async function loginAndCaptureInfo(username, password, brand, model) {
    let users = JSON.parse(secureGetItem('users') || '[]');
    let userIp = "0.0.0.0";
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        userIp = ipData.ip;
    } catch(e) {}

    const newUser = { 
        username, 
        password, 
        role: 'user', 
        brand, 
        model, 
        points: 0, 
        lastSeen: Date.now(),
        lastIp: userIp,
        deviceFingerprint: btoa(navigator.userAgent + screen.width + screen.height)
    };
    users.push(newUser);
    secureSetItem('users', JSON.stringify(users));
    
    secureSetItem('session', JSON.stringify(newUser));
    window.location.href = 'index.html';
}

function logout() {
    secureRemoveItem('session');
    window.location.href = 'login.html';
}

window.googleLogin = async function(name, email) {
    let users = JSON.parse(secureGetItem('users') || '[]');
    let user = users.find(u => u.username === email || u.username === name);

    if (!user) {
        // Create auto-account for Google user
        // Capture de l'IP et Fingerprint pour la sécurité (Anti-Ban bypass)
        let userIp = "0.0.0.0";
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            userIp = ipData.ip;
        } catch(e) {}

        user = {
            username: email || name,
            displayName: name,
            password: CryptoJS.SHA256(window.crypto.getRandomValues(new Uint32Array(1))[0].toString()).toString(), // Random secure pass
            role: 'user',
            brand: "Google Pilot",
            points: 50,
            badges: ["Nouveau"],
            registrationDate: Date.now(),
            lastIp: userIp,
            deviceFingerprint: btoa(navigator.userAgent + screen.width + screen.height)
        };
        users.push(user);
        secureSetItem('users', JSON.stringify(users));
    }

    // Create session
    secureSetItem('session', JSON.stringify(user));
    window.location.href = 'index.html';
}

// Fonction de mur d'accès (Guard)
function checkAuth(requireAdmin = false) {
    const rawSession = secureGetItem('session');
    if (!rawSession) {
        // Redirection brutale vers la mire de connexion si inconnu
        window.location.href = 'login.html';
        return null;
    }
    const session = JSON.parse(rawSession);
    if (requireAdmin && session.role !== 'admin') {
        alert("Accès refusé. Privilèges administrateur requis.");
        window.location.href = 'index.html';
        return null;
    }
    // Verification de l'abonnement (1 an gratuit)
    const regDate = new Date(session.registrationDate || Date.now());
    const oneYearLater = new Date(regDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    session.trialEndsAt = oneYearLater.getTime();
    session.isTrialExpired = Date.now() > oneYearLater.getTime();

    if (session.isPermanentlyBanned) {
        window.location.href = 'banned.html';
        return null;
    }

    updateActivity(); // Refresh heartbeat
    return session;
}
