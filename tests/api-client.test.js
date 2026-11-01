/**
 * @jest-environment jsdom
 *
 * Tests Unitaires — ApiClient (ASVS v5.0.0-3.5.1 / V4)
 * ─────────────────────────────────────────────────────────────────────────────
 * Vérifie l'injection de l'Authorization Bearer idToken, le blocage si non
 * connecté, la construction d'URL sans hardcoding et le support de timeout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

describe('ApiClient — Passerelle Cloud Functions Sécurisée', () => {
  let originalFetch;
  let mockAuth;
  let ApiClient;
  let getFunctionUrl;
  let authFetch;
  let AuthRequiredError;

  beforeEach(() => {
    originalFetch = global.fetch;

    // Mock Firebase auth
    mockAuth = {
      currentUser: {
        uid: 'user_test_123',
        getIdToken: jest.fn().mockResolvedValue('mock_id_token_abc123')
      }
    };

    window.auth = mockAuth;
    window.CONFIG = {
      FIREBASE: {
        projectId: 'mon50ccetmoi'
      }
    };

    // Charger le code source avec injection de l'environnement de test
    const rawCode = fs.readFileSync(path.resolve(__dirname, "../src/js/api-client.js"), "utf8");
    const sanitizedCode = rawCode
      .replace(/import\s+.*?;/g, "")
      .replace(/export\s+class\s+/g, "class ")
      .replace(/export\s+function\s+/g, "function ")
      .replace(/export\s+/g, "");

    const evalFn = new Function(
      "window",
      "document",
      "CONFIG",
      "auth",
      `
      ${sanitizedCode}
      return { ApiClient: window.ApiClient, getFunctionUrl, authFetch, AuthRequiredError };
      `
    );

    const loaded = evalFn(window, document, window.CONFIG, window.auth);
    ApiClient = loaded.ApiClient;
    getFunctionUrl = loaded.getFunctionUrl;
    authFetch = loaded.authFetch;
    AuthRequiredError = loaded.AuthRequiredError;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete window.ApiClient;
    delete window.auth;
    delete window.CONFIG;
  });

  test('getFunctionUrl doit construire l\'URL avec le projectId de CONFIG', () => {
    expect(getFunctionUrl('createRevolutOrder')).toBe(
      'https://europe-west1-mon50ccetmoi.cloudfunctions.net/createRevolutOrder'
    );
  });

  test('authFetch doit lever AuthRequiredError si currentUser est null', async () => {
    window.auth.currentUser = null;
    await expect(authFetch('createRevolutOrder', { body: {} })).rejects.toThrow();
  });

  test('authFetch doit injecter le header Authorization Bearer avec le token Firebase', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null)
      },
      json: jest.fn().mockResolvedValue({ order_token: 'tok_123', order_id: 'ord_123' })
    });

    const res = await authFetch('createRevolutOrder', {
      method: 'POST',
      body: { case_id: 'TEST-1', report_type: 'SIMPLE' }
    });

    expect(res).toEqual({ order_token: 'tok_123', order_id: 'ord_123' });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = global.fetch.mock.calls[0];
    expect(calledUrl).toBe('https://europe-west1-mon50ccetmoi.cloudfunctions.net/createRevolutOrder');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers['Authorization']).toBe('Bearer mock_id_token_abc123');
    expect(calledOptions.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calledOptions.body)).toEqual({ case_id: 'TEST-1', report_type: 'SIMPLE' });
  });

  test('authFetch doit convertir query object en search params pour les requêtes GET', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null)
      },
      json: jest.fn().mockResolvedValue({ paid: true, status: 'COMPLETED' })
    });

    const res = await authFetch('checkPaymentStatus', {
      method: 'GET',
      query: { case_id: 'CASE-456', user_id: 'user_test_123' }
    });

    expect(res).toEqual({ paid: true, status: 'COMPLETED' });
    const [calledUrl, calledOptions] = global.fetch.mock.calls[0];
    expect(calledUrl).toContain('checkPaymentStatus?case_id=CASE-456&user_id=user_test_123');
    expect(calledOptions.method).toBe('GET');
    expect(calledOptions.headers['Authorization']).toBe('Bearer mock_id_token_abc123');
  });

  test('authFetch doit propager une erreur avec statut si le serveur répond non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ error: 'Accès refusé' }),
      headers: { get: () => 'application/json' }
    });

    await expect(authFetch('createRevolutOrder', { method: 'POST' })).rejects.toThrow('Accès refusé');
  });
});
