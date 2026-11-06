/**
 * @jest-environment node
 *
 * Horodatage gratuit des rapports (functions/api/timestamping.js).
 * La réponse de référence est un vrai jeton FreeTSA du 6 novembre 2026, vérifié avec OpenSSL.
 */
const fs = require("fs");
const path = require("path");
const t = require("../functions/api/timestamping");

const HASH = "fb8cba40dac071f184f0178a9022a5483910fcff5f33d84b67548d0e7d2a4b91";
const REAL_RESPONSE = fs.readFileSync(path.join(__dirname, "fixtures/freetsa-response.tsr"));

const okFetch = (body) => async () => ({ ok: true, status: 200, arrayBuffer: async () => body });
const failFetch = (status) => async () => ({ ok: false, status, arrayBuffer: async () => new ArrayBuffer(0) });

describe("Horodatage RFC 3161 et OpenTimestamps", () => {
  test("requête RFC 3161 : séquence DER, version 1, empreinte SHA-256, certificat demandé", () => {
    const req = t.buildTimeStampReq(HASH, Buffer.from("0102030405060708", "hex"));
    expect(req[0]).toBe(0x30);
    expect(req.includes(Buffer.from(HASH, "hex"))).toBe(true);
    expect(req.includes(Buffer.from("608648016503040201", "hex"))).toBe(true); // OID SHA-256
    expect(req.subarray(-3)).toEqual(Buffer.from([0x01, 0x01, 0xff])); // certReq = TRUE
    expect(() => t.buildTimeStampReq("pas-une-empreinte")).toThrow();
  });

  test("lecture d'un vrai jeton FreeTSA : accordé, date 2026-11-06 18:09:30 UTC", () => {
    const r = t.parseTimeStampResp(REAL_RESPONSE);
    expect(r.granted).toBe(true);
    expect(r.status).toBe(0);
    expect(r.genTime).toBe("2026-11-06T18:09:30Z");
    expect(REAL_RESPONSE.includes(Buffer.from(HASH, "hex"))).toBe(true); // le jeton porte bien notre empreinte
  });

  test("réponse refusée ou tronquée : erreur, jamais un faux succès", async () => {
    const rejected = Buffer.from("30053003020102", "hex"); // statut PKI 2 = rejeté
    expect(t.parseTimeStampResp(rejected).granted).toBe(false);
    await expect(t.requestRfc3161(HASH, okFetch(rejected))).rejects.toThrow("refusé");
    const truncated = REAL_RESPONSE.subarray(0, 10); // vrai jeton coupé en cours de route
    expect(() => t.parseTimeStampResp(truncated)).toThrow("tronquée");
  });

  test("OpenTimestamps : envoie les 32 octets de l'empreinte, essaie le calendrier suivant en cas d'échec", async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push(url);
      if (calls.length === 1) return { ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) };
      expect(init.body.length).toBe(32);
      return { ok: true, status: 200, arrayBuffer: async () => Buffer.from("f0ab", "hex") };
    };
    const r = await t.requestOpenTimestamps(HASH, fetchFn);
    expect(r.status).toBe("EN_ATTENTE_BITCOIN");
    expect(calls[0]).not.toBe(calls[1]);
    expect(calls[1]).toMatch(/\/digest$/);
  });

  test("les deux horodatages sont indépendants : l'échec de l'un n'empêche pas l'autre", async () => {
    const fetchFn = async (url) => (url.includes("freetsa")
      ? { ok: true, status: 200, arrayBuffer: async () => REAL_RESPONSE }
      : failFetch(503)());
    const r = await t.timestampEvidence(HASH, fetchFn);
    expect(r.level).toBe("NON_QUALIFIE");
    expect(r.rfc3161.genTime).toBe("2026-11-06T18:09:30Z");
    expect(r.opentimestamps.error).toMatch(/503/);
  });
});
