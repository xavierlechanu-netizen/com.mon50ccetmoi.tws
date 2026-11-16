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
        // Jeton SOS (30 jours, renouvelable) : n'ouvre que l'alerte SOS, voir sendSos()
        this.sosToken = null;
        this.currentUser = null;
        this.authListeners = new Set();
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
        this.token = res.token;
        this.sosToken = res.sosToken || null;
        this.currentUser = { uid: res.uid, username: res.username, role: res.role };
        this._notifyAuthChange();
        return this.currentUser;
    }

    async signInWithEmailAndPassword(email, password) {
        const res = await this.request("/auth/login", {
            method: "POST",
            body: { email, password }
        });
        this.token = res.token;
        this.sosToken = res.sosToken || null;
        this.currentUser = {
            uid: res.uid,
            username: res.username,
            role: res.role,
            braveCoins: res.braveCoins
        };
        this._notifyAuthChange();
        return this.currentUser;
    }

    signOut() {
        this.token = null;
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

    async deleteMyAccountRgpd() {
        const res = await this.request("/rgpd/account", { method: "DELETE" });
        this.signOut();
        return res;
    }
}

export default SovereignClient;

