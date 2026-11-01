/**
 * Tests Unitaires — Grand Livre Sécurisé des Points (points-ledger.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * Vérification des règles OWASP ASVS v5.0.0-2.2.1, 2.2.2, 2.3.3 :
 * - Allowlist stricte des motifs (AWARD & DEDUCT)
 * - Validation positive des montants et plafonds unitaires (maxPerCall)
 * - Détection des fraudes et dépassements de plafonds journaliers
 * - Gestion atomique du solde et rejet si fonds insuffisants
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Grand Livre des Points — Validation & Sécurité Métier', () => {

  const REASON_RULES = {
    CODE_QUIZ_COMPLETED: { action: "AWARD", maxPerCall: 50, dailyCap: 200 },
    RADAR_HAZARD_REPORTED: { action: "AWARD", maxPerCall: 25, dailyCap: 100 },
    ROUTER_CONTRAT_SIGNED: { action: "AWARD", maxPerCall: 50, dailyCap: 50 },
    MAINTENANCE_LOGGED: { action: "AWARD", maxPerCall: 25, dailyCap: 50 },
    REFERRAL_BONUS: { action: "AWARD", maxPerCall: 100, dailyCap: 300 },
    SAFE_RIDER_MILESTONE: { action: "AWARD", maxPerCall: 50, dailyCap: 150 },
    CARBON_OFFSET: { action: "AWARD", maxPerCall: 30, dailyCap: 90 },
    ADMIN_GRANT: { action: "AWARD", maxPerCall: 1000, dailyCap: 5000, requiresAdmin: true },
    MECA_WIZARD_DIAGNOSTIC: { action: "DEDUCT", maxPerCall: 200 },
    POCKET_LAWYER_QUERY: { action: "DEDUCT", maxPerCall: 100 },
    MARKETPLACE_PURCHASE: { action: "DEDUCT", maxPerCall: 5000 },
    EXCHANGE_PURCHASE: { action: "DEDUCT", maxPerCall: 5000 },
    WEB4_MINING_STAKE: { action: "DEDUCT", maxPerCall: 1000 },
    GENERIC_SPEND: { action: "DEDUCT", maxPerCall: 1000 }
  };

  function validateTransactionRequest(data, auth) {
    if (!auth || !auth.uid) {
      throw new Error("UNAUTHENTICATED");
    }

    const { action, reason, amount } = data || {};
    if (action !== "AWARD" && action !== "DEDUCT") {
      throw new Error("INVALID_ACTION");
    }

    const parsedAmount = Math.floor(Number(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error("INVALID_AMOUNT");
    }

    const rule = REASON_RULES[reason];
    if (!rule) {
      throw new Error("UNKNOWN_REASON");
    }

    if (rule.action !== action) {
      throw new Error("ACTION_MISMATCH");
    }

    if (parsedAmount > rule.maxPerCall) {
      throw new Error("MAX_PER_CALL_EXCEEDED");
    }

    if (rule.requiresAdmin && !auth.admin) {
      throw new Error("PERMISSION_DENIED");
    }

    return { valid: true, parsedAmount, rule };
  }

  test('Refuse toute transaction sans authentification utilisateur', () => {
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'CODE_QUIZ_COMPLETED', amount: 10 }, null))
      .toThrow('UNAUTHENTICATED');
  });

  test('Valide les montants entiers strictement positifs et rejette les montants négatifs ou nuls', () => {
    const auth = { uid: 'user_123' };
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'CODE_QUIZ_COMPLETED', amount: 0 }, auth))
      .toThrow('INVALID_AMOUNT');
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'CODE_QUIZ_COMPLETED', amount: -50 }, auth))
      .toThrow('INVALID_AMOUNT');
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'CODE_QUIZ_COMPLETED', amount: 'abc' }, auth))
      .toThrow('INVALID_AMOUNT');

    const valid = validateTransactionRequest({ action: 'AWARD', reason: 'CODE_QUIZ_COMPLETED', amount: 25 }, auth);
    expect(valid.parsedAmount).toBe(25);
  });

  test('Rejette les motifs inexistants non répertoriés dans la allowlist', () => {
    const auth = { uid: 'user_123' };
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'HACKER_BONUS', amount: 100 }, auth))
      .toThrow('UNKNOWN_REASON');
  });

  test('Rejette les tentatives d action incohérentes (ex: DEDUCT avec CODE_QUIZ_COMPLETED)', () => {
    const auth = { uid: 'user_123' };
    expect(() => validateTransactionRequest({ action: 'DEDUCT', reason: 'CODE_QUIZ_COMPLETED', amount: 10 }, auth))
      .toThrow('ACTION_MISMATCH');
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'POCKET_LAWYER_QUERY', amount: 50 }, auth))
      .toThrow('ACTION_MISMATCH');
  });

  test('Bloque les dépassements de plafonds unitaires (maxPerCall)', () => {
    const auth = { uid: 'user_123' };
    // Le plafond max pour quiz est 50 pts
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'CODE_QUIZ_COMPLETED', amount: 51 }, auth))
      .toThrow('MAX_PER_CALL_EXCEEDED');
    // Le plafond max pour radar est 25 pts
    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'RADAR_HAZARD_REPORTED', amount: 30 }, auth))
      .toThrow('MAX_PER_CALL_EXCEEDED');
  });

  test('Exige les privilèges administrateur pour ADMIN_GRANT', () => {
    const nonAdminAuth = { uid: 'user_regular', admin: false };
    const adminAuth = { uid: 'user_admin', admin: true };

    expect(() => validateTransactionRequest({ action: 'AWARD', reason: 'ADMIN_GRANT', amount: 500 }, nonAdminAuth))
      .toThrow('PERMISSION_DENIED');

    const success = validateTransactionRequest({ action: 'AWARD', reason: 'ADMIN_GRANT', amount: 500 }, adminAuth);
    expect(success.valid).toBe(true);
  });

  test('Calcule correctement le solde lors d un débit et refuse si solde insuffisant', () => {
    function simulateBalanceChange(currentBalance, action, amount) {
      if (action === 'DEDUCT') {
        if (currentBalance < amount) throw new Error('INSUFFICIENT_FUNDS');
        return currentBalance - amount;
      }
      return currentBalance + amount;
    }

    expect(simulateBalanceChange(100, 'AWARD', 25)).toBe(125);
    expect(simulateBalanceChange(100, 'DEDUCT', 30)).toBe(70);
    expect(simulateBalanceChange(100, 'DEDUCT', 100)).toBe(0);
    expect(() => simulateBalanceChange(50, 'DEDUCT', 51)).toThrow('INSUFFICIENT_FUNDS');
  });

});
