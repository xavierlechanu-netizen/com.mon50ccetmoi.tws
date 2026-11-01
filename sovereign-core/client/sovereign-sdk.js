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
        if (this.token) {
            reqHeaders.Authorization = `Bearer ${this.token}`;
        }

        const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
            method,
            headers: reqHeaders,
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Erreur HTTP ${response.status}`);
        }
        return data;
    }

    async register(email, username, password) {
        const res = await this.request("/auth/register", {
            method: "POST",
            body: { email, username, password }
        });
        this.token = res.token;
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
        this.currentUser = null;
        this._notifyAuthChange();
    }

    async uploadBlackboxTelemetry(telemetryPayload) {
        return await this.request("/telemetry/upload", {
            method: "POST",
            body: telemetryPayload
        });
    }

    async deleteMyAccountRgpd() {
        const res = await this.request("/rgpd/account", { method: "DELETE" });
        this.signOut();
        return res;
    }
}

export default SovereignClient;

