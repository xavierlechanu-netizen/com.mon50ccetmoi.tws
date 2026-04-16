// --- ENCRYPTION WRAPPER ---
const SECRET_KEY = "mon50cc_secret_guard_key_2026";

window.secureSetItem = function(key, value) {
    if(typeof CryptoJS === 'undefined') {
        localStorage.setItem(key, value);
        return;
    }
    const encrypted = CryptoJS.AES.encrypt(value, SECRET_KEY).toString();
    localStorage.setItem(key, encrypted);
};

window.secureGetItem = function(key) {
    const data = localStorage.getItem(key);
    if (!data) return null;
    if(typeof CryptoJS === 'undefined') return data;
    try {
        const bytes = CryptoJS.AES.decrypt(data, SECRET_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        // Si le décryptage échoue (ex: donnée en clair pre-encryption), ça renvoie vide
        return decrypted || null;
    } catch (e) {
        return null;
    }
};

window.secureRemoveItem = function(key) {
    localStorage.removeItem(key);
};

// --- MOCK DATABASE VIA LOCALSTORAGE ---

// Initialisation de la base si elle est vide ou corrompue/non-chiffrée
if (!secureGetItem('users')) {
    secureSetItem('users', JSON.stringify([
        { username: 'admin', password: 'password', role: 'admin' }, // Compte admin par défaut
        { username: 'roger_50cc', password: '123', role: 'user' }
    ]));
}

// Table des signalements communautaires (Markers Danger)
if (!secureGetItem('hazards')) {
    secureSetItem('hazards', JSON.stringify([]));
}

function login(username, password) {
    const users = JSON.parse(secureGetItem('users'));
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        secureSetItem('session', JSON.stringify(user));
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    } else {
        alert("Nom d'utilisateur ou mot de passe incorrect.");
    }
}

window.loginAsGuest = function() {
    const guestUser = { username: "Pilote_" + Math.floor(Math.random()*1000), brand: "Incognito", role: "guest", isGuest: true };
    secureSetItem('session', JSON.stringify(guestUser));
    // Redirection directe pour les tests et la fluidité
    window.location.href = 'index.html';
};

function register(username, password, brand) {
    if(!username || !password || !brand) {
        alert("Veuillez remplir tous les champs et choisir votre marque de 50cc.");
        return;
    }
    
    let users = JSON.parse(secureGetItem('users'));
    if (users.find(u => u.username === username)) {
        alert("Ce pseudo est déjà utilisé. Choisissez-en un autre.");
        return;
    }
    
    const newUser = { username, password, role: 'user', brand, points: 0 };
    users.push(newUser);
    secureSetItem('users', JSON.stringify(users));
    
    // Auto-connexion après inscription réussie
    secureSetItem('session', JSON.stringify(newUser));
    window.location.href = 'index.html';
}

function logout() {
    secureRemoveItem('session');
    window.location.href = 'login.html';
}

window.googleLogin = function(name, email) {
    let users = JSON.parse(secureGetItem('users') || '[]');
    let user = users.find(u => u.username === email || u.username === name);

    if (!user) {
        // Create auto-account for Google user
        user = {
            username: email || name,
            displayName: name,
            password: CryptoJS.SHA256(Math.random().toString()).toString(), // Random secure pass
            role: 'user',
            brand: "Google Pilot",
            points: 50,
            badges: ["Nouveau"]
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
    return session;
}
