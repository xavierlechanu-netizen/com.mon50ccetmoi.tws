const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://fifty-cc.preview.emergentagent.com';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_URL}/api`;
  }

  private async request(endpoint: string, options: RequestInit = {}, token?: string) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Erreur réseau' }));
      throw new Error(this.formatError(error.detail));
    }

    return response.json();
  }

  private formatError(detail: any): string {
    if (detail == null) return 'Une erreur est survenue';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map(e => e?.msg || JSON.stringify(e)).join(' ');
    }
    if (detail?.msg) return detail.msg;
    return String(detail);
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async getMe(token: string) {
    return this.request('/auth/me', {}, token);
  }

  // Signals
  async getSignals() {
    return this.request('/signals');
  }

  async createSignal(lat: number, lng: number, type: string, token: string, description?: string) {
    return this.request('/signals', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, type, description }),
    }, token);
  }

  async voteSignal(signalId: string, voteType: 'up' | 'down', token: string) {
    return this.request(`/signals/${signalId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType }),
    }, token);
  }

  async deleteSignal(signalId: string, token: string) {
    return this.request(`/signals/${signalId}`, {
      method: 'DELETE',
    }, token);
  }

  // Vehicle endpoints
  async getBrands() {
    return this.request('/vehicles/brands');
  }

  async getMyVehicle(token: string) {
    return this.request('/vehicles/my', {}, token);
  }

  async createVehicle(vehicleData: any, token: string) {
    return this.request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    }, token);
  }

  async updateVehicle(vehicleData: any, token: string) {
    return this.request('/vehicles', {
      method: 'PATCH',
      body: JSON.stringify(vehicleData),
    }, token);
  }

  async getMaintenanceTips(token: string) {
    return this.request('/vehicles/maintenance-tips', {}, token);
  }

  async getCommonProblems(token: string) {
    return this.request('/vehicles/common-problems', {}, token);
  }

  async askMechanic(question: string, category: string | null, token: string) {
    return this.request('/vehicles/ask-mechanic', {
      method: 'POST',
      body: JSON.stringify({ question, category }),
    }, token);
  }

  async getChatHistory(token: string, limit: number = 10) {
    return this.request(`/vehicles/chat-history?limit=${limit}`, {}, token);
  }

  async addMaintenanceLog(logData: any, token: string) {
    return this.request('/vehicles/maintenance-log', {
      method: 'POST',
      body: JSON.stringify(logData),
    }, token);
  }

  async getMaintenanceLogs(token: string, limit: number = 20) {
    return this.request(`/vehicles/maintenance-log?limit=${limit}`, {}, token);
  }
}

export const apiService = new ApiService();
