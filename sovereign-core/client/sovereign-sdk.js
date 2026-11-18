/**
 * ============================================================================
 * sovereign-core/client/sovereign-sdk.js
 * ============================================================================
 * SDK Client Souverain — mon50ccetmoi.com
 * Remplace intégralement `firebase/app`, `firebase/auth`, `firebase/firestore`
 * et `firebase/functions` côté navigateur et application mobile Capacitor.
 *
 * Poids : < 3 Ko (Zéro dépendance externe, 100 % API Web Standards Fetch + WebSocket)
 * ============================================================================
 */

export class SovereignClient {
    /**
     * @param {{apiBaseUrl?: string, wsBaseUrl?: string}} [config]
     */
    constructor(config = {}) {
        this.apiBaseUrl = (config.apiBaseUrl || "https://api.mon50ccetmoi.com/api/v1").replace(/\/+$/, "");
        this.wsBaseUrl = config.wsBaseUrl || "wss://api.mon50ccetmoi.com/ws";
        this.token = null;
        // Jeton de renouvellement (30 jours glissants) : n'ouvre que POST /auth/refresh, voir refreshSession()
        this.refreshToken = null;
        // Jeton SOS (30 jours, renouvelable) : n'ouvre que l'alerte SOS, voir sendSos()
        this.sosToken = null;
        this.currentUser = null;
        this.authListeners = new Set();
        this._refreshing = null;
    }

    /** Date d'expiration d'un jeton (ms), ou 0 s'il est illisible. Le serveur reste seul juge. */
    static tokenExpiry(token) {
        try {
            const part = String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const claims = JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4)));
            return Number.isFinite(claims.exp) ? claims.exp * 1000 : 0;
        } catch {
            return 0;
        }
    }

    /** Vrai tant que le jeton de renouvellement n'a pas expiré : le pilote est connecté. */
    hasSession(now = Date.now()) {
        return Boolean(this.currentUser && this.refreshToken && SovereignClient.tokenExpiry(this.refreshToken) > now);
    }

    /** Ce qu'il faut garder pour retrouver la session à la page suivante (jamais le mot de passe). */
    sessionSnapshot() {
        if (!this.currentUser || !this.refreshToken) return null;
        return { token: this.token, refreshToken: this.refreshToken, user: { ...this.currentUser } };
    }

    /** Reprend une session gardée (sans réseau). Renvoie false si elle a expiré. */
    restoreSession(snapshot, now = Date.now()) {
        if (!snapshot || !snapshot.user || !snapshot.user.uid ||
            SovereignClient.tokenExpiry(snapshot.refreshToken) <= now) return false;
        this.token = snapshot.token || null;
        this.refreshToken = snapshot.refreshToken;
        this.currentUser = { ...snapshot.user };
        this._notifyAuthChange();
        return true;
    }

    _applySession(res) {
        this.token = res.token;
        this.refreshToken = res.refreshToken || null;
        this.sosToken = res.sosToken || null;
        this.currentUser = {
            uid: res.uid,
            email: res.email || null,
            username: res.username,
            role: res.role,
            braveCoins: res.braveCoins,
            createdAt: res.createdAt || null
        };
        this._notifyAuthChange();
        return this.currentUser;
    }

    /**
     * Nouveau jeton de session à partir du jeton de renouvellement. Un seul appel à la fois.
     * Refus du serveur (401 : compte supprimé, banni ou session expirée) : déconnexion.
     */
    async refreshSession() {
        if (!this.refreshToken) {
            const err = new Error("Aucune session à renouveler.");
            err.status = 401;
            throw err;
        }
        if (!this._refreshing) {
            this._refreshing = this.request("/auth/refresh", {
                method: "POST",
                headers: { Authorization: `Bearer ${this.refreshToken}` }
            }).then((res) => this._applySession(res), (e) => {
                if (e && e.status === 401) this.signOut();
                throw e;
            }).finally(() => {
                this._refreshing = null;
            });
        }
        return this._refreshing;
    }

    /** Jeton de session valable au moins une minute encore (renouvelé si besoin), comme Firebase. */
    async getIdToken(now = Date.now()) {
        if (this.token && SovereignClient.tokenExpiry(this.token) - now > 60 * 1000) return this.token;
        await this.refreshSession();
        return this.token;
    }

    /**
     * Abonne un écouteur aux changements d'état d'authentification
     * (Remplace `onAuthStateChanged` de Firebase Auth).
     */
    onAuthStateChanged(callback) {
        if (typeof callback === "function") {
            this.authListeners.add(callback);
            callback(this.currentUser);
        }
        return () => this.authListeners.delete(callback);
    }

    _notifyAuthChange() {
        for (const cb of this.authListeners) {
            try {
                cb(this.currentUser);
            } catch (e) {
                console.error("[SovereignSDK] Listener error:", e);
            }
        }
    }

    async request(endpoint, { method = "GET", body = null, headers = {} } = {}) {
        const reqHeaders = {
            "Content-Type": "application/json",
            ...headers
        };
        // Jeton de session expiré : renouvelé avant l'appel (sauf pour les routes de connexion elles-mêmes)
        if (this.refreshToken && !reqHeaders.Authorization && !endpoint.startsWith("/auth/")) {
            await this.getIdToken();
        }
        // Un en-tête Authorization fourni par l'appelant (jeton SOS) n'est jamais écrasé
        if (this.token && !reqHeaders.Authorization) {
            reqHeaders.Authorization = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
            method,
            headers: reqHeaders,
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = new Error(data.error || `Erreur HTTP ${response.status}`);
            err.status = response.status;
            throw err;
        }
        return data;
    }

    async register(email, username, password) {
        const res = await this.request("/auth/register", {
            method: "POST",
            body: { email, username, password }
        });
        return this._applySession(res);
    }

    async signInWithEmailAndPassword(email, password) {
        const res = await this.request("/auth/login", {
            method: "POST",
            body: { email, password }
        });
        return this._applySession(res);
    }

    signOut() {
        this.token = null;
        this.refreshToken = null;
        this.sosToken = null;
        this.currentUser = null;
        this._notifyAuthChange();
    }

    async uploadBlackboxTelemetry(telemetryPayload) {
        return await this.request("/telemetry/upload", {
            method: "POST",
            body: telemetryPayload
        });
    }

    /**
     * Alerte SOS : SMS réels aux anges gardiens (OVHcloud). Renvoie { sent, requested, invalid } ;
     * lève une erreur si aucun SMS n'est parti (l'appli doit alors proposer le 112 et le SMS manuel).
     * @param {{lat: number, lng: number, accuracy?: number, contacts: string[], kind?: "fall"|"manual"}} alerte
     */
    async sendSos(alerte) {
        return await this.request("/sos", { method: "POST", body: alerte, headers: this._sosAuth() });
    }

    /** Nouveau jeton SOS (30 jours) à partir du jeton SOS ou de session encore valide. */
    async renewSosToken() {
        const res = await this.request("/auth/sos-token", { method: "POST", headers: this._sosAuth() });
        this.sosToken = res.sosToken || null;
        return this.sosToken;
    }

    /** Le jeton SOS passe en premier : le jeton de session, lui, expire au bout d'une heure. */
    _sosAuth() {
        const bearer = this.sosToken || this.token;
        return bearer ? { Authorization: `Bearer ${bearer}` } : {};
    }

    /** Droit d'accès et portabilité (RGPD art. 15 et 20) : toutes les données du compte, en JSON. */
    async exportMyDataRgpd() {
        return await this.request("/rgpd/account", { method: "GET" });
    }

    /**
     * Rectification (art. 16) et opposition au classement (art. 21).
     * @param {{email?: string, username?: string, leaderboardVisible?: boolean, currentPassword?: string}} changes
     *   currentPassword est exigé pour changer d'email ou de pseudonyme.
     */
    async updateMyAccountRgpd(changes) {
        const res = await this.request("/rgpd/account", { method: "PATCH", body: changes });
        if (this.currentUser && res.username) this.currentUser = { ...this.currentUser, username: res.username };
        return res;
    }

    async deleteMyAccountRgpd() {
        const res = await this.request("/rgpd/account", { method: "DELETE" });
        this.signOut();
        return res;
    }
}

export default SovereignClient;

