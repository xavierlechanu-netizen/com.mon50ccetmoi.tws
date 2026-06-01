
        // SÃ©curitÃ© immÃ©diate : Redirection si banni dÃ©finitivement
        try {
            const rawSession = localStorage.getItem('session');
            if (rawSession) {
                // Si c'est du JSON en clair (ancien format)
                if (rawSession.startsWith('{')) {
                    const session = JSON.parse(rawSession);
                    if (session.isPermanentlyBanned) window.location.href = 'banned.html';
                } 
                // Si c'est chiffrÃ©, le checkAuth s'en occupera aprÃ¨s le chargement d'auth.js
            }
        } catch(e) { }
        try {
            window.session = (typeof checkAuth === "function") ? checkAuth(false) : { username: "Pilote", isGuest: true };
        } catch(e) {
            console.warn("Auth initialization failed, using guest mode.");
            window.session = { username: "Pilote", isGuest: true };
        }
    