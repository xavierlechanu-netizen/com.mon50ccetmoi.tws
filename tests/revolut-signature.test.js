/**
 * Tests Unitaires — Signature Webhook Revolut
 * ─────────────────────────────────────────────────────────────────────────────
 * Conformité : Spécification Revolut Merchant API v1
 * Vérification HMAC-SHA256, tolérance temporelle et comparaison en temps constant.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const { verifyRevolutSignature } = require('../functions/api/revolut-signature');

describe('Vérification de Signature Webhook Revolut (Merchant API)', () => {

  const secret = 'wsk_test_secret_1234567890abcdef';
  const now = 1715269527223;
  const payloadObj = { order_id: 'ord_12345', event: 'ORDER_COMPLETED' };
  const rawBody = JSON.stringify(payloadObj);

  function makeSignature(body, timestamp, signingSecret) {
    const payloadToSign = `v1.${timestamp}.${body}`;
    const hash = crypto.createHmac('sha256', signingSecret).update(payloadToSign).digest('hex');
    return `v1=${hash}`;
  }

  test('Doit valider une signature conforme et dans la fenêtre temporelle', () => {
    const timestamp = String(now);
    const signature = makeSignature(rawBody, timestamp, secret);

    const res = verifyRevolutSignature(rawBody, timestamp, signature, secret, { now });
    expect(res.valid).toBe(true);
  });

  test('Doit supporter un Buffer en entrée pour le corps brut (rawBody)', () => {
    const timestamp = String(now);
    const bodyBuf = Buffer.from(rawBody, 'utf8');
    const signature = makeSignature(rawBody, timestamp, secret);

    const res = verifyRevolutSignature(bodyBuf, timestamp, signature, secret, { now });
    expect(res.valid).toBe(true);
  });

  test('Doit rejeter une signature forgée ou calculée avec un mauvais secret', () => {
    const timestamp = String(now);
    const badSig = makeSignature(rawBody, timestamp, 'wrong_secret');

    const res = verifyRevolutSignature(rawBody, timestamp, badSig, secret, { now });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('signature_mismatch');
  });

  test('Doit rejeter un timestamp hors de la fenêtre de tolérance (anti-rejeu)', () => {
    const oldTimestamp = String(now - 10 * 60 * 1000); // 10 minutes dans le passé (> 5 min)
    const signature = makeSignature(rawBody, oldTimestamp, secret);

    const res = verifyRevolutSignature(rawBody, oldTimestamp, signature, secret, { now });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('timestamp_out_of_window');
  });

  test('Doit supporter les signatures multiples lors de la rotation de secrets', () => {
    const timestamp = String(now);
    const validSig = makeSignature(rawBody, timestamp, secret);
    const otherSig = 'v1=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    const headerVal = `${otherSig}, ${validSig}`;

    const res = verifyRevolutSignature(rawBody, timestamp, headerVal, secret, { now });
    expect(res.valid).toBe(true);
  });

  test('Doit rejeter si les paramètres requis sont manquants', () => {
    expect(verifyRevolutSignature(rawBody, String(now), 'v1=abc', '').valid).toBe(false);
    expect(verifyRevolutSignature(null, String(now), 'v1=abc', secret).valid).toBe(false);
    expect(verifyRevolutSignature(rawBody, '', 'v1=abc', secret).valid).toBe(false);
    expect(verifyRevolutSignature(rawBody, String(now), '', secret).valid).toBe(false);
  });
});
