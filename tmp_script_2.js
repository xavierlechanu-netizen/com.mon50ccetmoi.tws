
        try {
            window.session = (typeof checkAuth === "function") ? checkAuth(false) : { username: "Pilote", isGuest: true };
        } catch(e) {}
    