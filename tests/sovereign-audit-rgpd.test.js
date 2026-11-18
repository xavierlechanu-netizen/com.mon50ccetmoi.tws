/**
 * @jest-environment node
 *
 * RGPD et auditabilité du serveur souverain (17/11/2026) :
 *  - droits des personnes sur /api/v1/rgpd/account : accès et portabilité (GET), rectification et
 *    opposition au classement (PATCH), effacement (DELETE) ;
 *  - journal d'audit : qui a fait quoi et quand, sans email ni numéro ni IP, chaîné (toute
 *    modification se voit), lisible seulement par un administrateur ;
 *  - /.well-known/security.txt et en-têtes de sécurité vérifiables.
 * Même chose sur un vrai PostgreSQL : tests/sovereign-pg.test.js.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");
const audit = require("../sovereign-core/server/audit-log");

function invoke(app, method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const raw = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
    const req = { method, url, socket: { remoteAddress: "10.9.9.9" },
      headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
    const sent = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) { sent[k.toLowerCase()] = v; },
      end(payload) {
        const text = payload ? String(payload) : "";
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        resolve({ status: this.statusCode, body: parsed, text, headers: sent });
      },
    };
    app.handleRequest(req, res, raw).catch(reject);
  });
}

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

describe("Droits des personnes (RGPD) et journal d'audit — serveur souverain", () => {
  let wormDir;
  let app;
  const admin = bearer(signSovereignJwt({ uid: "admin-audit", role: "admin", username: "Admin" }));

  beforeEach(() => {
    wormDir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-audit-"));
    app = createSovereignApp({ wormDir });
  });
  afterEach(() => fs.rmSync(wormDir, { recursive: true, force: true }));

  async function register(email = "pilote@example.com", username = "PiloteRGPD") {
    const r = await invoke(app, "POST", "/api/v1/auth/register", { email, username, password: "MotDePasse2026!" });
    expect(r.status).toBe(201);
    return r.body;
  }

  test("accès et portabilité : export JSON complet, jamais mis en cache, noté au journal", async () => {
    const me = await register();
    await invoke(app, "POST", "/api/v1/hazards", { type: "pothole", lat: 45.04, lng: 3.88, description: "Nid de poule" }, bearer(me.token));
    const r = await invoke(app, "GET", "/api/v1/rgpd/account", null, bearer(me.token));
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["content-disposition"]).toMatch(/attachment/);
    expect(r.body.format).toBe("mon50ccetmoi-export-rgpd-v1");
    expect(r.body.account).toMatchObject({ uid: me.uid, email: "pilote@example.com", username: "PiloteRGPD", leaderboardVisible: true });
    expect(r.body.account.passwordHash).toBeUndefined(); // jamais l'empreinte du mot de passe
    expect(JSON.stringify(r.body)).not.toMatch(/scrypt\$/);
    expect(r.body.hazards).toHaveLength(1);
    expect(r.body.auditTrail.map((e) => e.action)).toEqual(["auth.register"]);

    const again = await invoke(app, "GET", "/api/v1/rgpd/account", null, bearer(me.token));
    expect(again.body.auditTrail.map((e) => e.action)).toEqual(["auth.register", "rgpd.export"]);
  });

  test("sans jeton de session (ou avec le jeton SOS) : rien n'est lisible", async () => {
    const me = await register();
    expect((await invoke(app, "GET", "/api/v1/rgpd/account")).status).toBe(401);
    expect((await invoke(app, "GET", "/api/v1/rgpd/account", null, bearer(me.sosToken))).status).toBe(401);
    expect((await invoke(app, "PATCH", "/api/v1/rgpd/account", { leaderboardVisible: false }, bearer(me.sosToken))).status).toBe(401);
  });

  test("rectification : le mot de passe actuel est exigé pour l'email et le pseudo, doublons refusés", async () => {
    const me = await register();
    await register("autre@example.com", "AutrePilote");
    const t = bearer(me.token);

    expect((await invoke(app, "PATCH", "/api/v1/rgpd/account", { username: "Nouveau" }, t)).status).toBe(403);
    expect((await invoke(app, "PATCH", "/api/v1/rgpd/account", { username: "Nouveau", currentPassword: "faux" }, t)).status).toBe(403);
    expect((await invoke(app, "PATCH", "/api/v1/rgpd/account", { username: "<b>x</b>", currentPassword: "MotDePasse2026!" }, t)).status).toBe(400);
    expect((await invoke(app, "PATCH", "/api/v1/rgpd/account", { username: "AutrePilote", currentPassword: "MotDePasse2026!" }, t)).status).toBe(409);
    expect((await invoke(app, "PATCH", "/api/v1/rgpd/account", {}, t)).status).toBe(400);

    const ok = await invoke(app, "PATCH", "/api/v1/rgpd/account",
      { username: "Nouveau", email: " Nouveau@Example.com ", currentPassword: "MotDePasse2026!" }, t);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ username: "Nouveau", email: "nouveau@example.com" });

    // L'ancien email ne connecte plus, le nouveau oui
    expect((await invoke(app, "POST", "/api/v1/auth/login", { email: "pilote@example.com", password: "MotDePasse2026!" })).status).toBe(401);
    expect((await invoke(app, "POST", "/api/v1/auth/login", { email: "nouveau@example.com", password: "MotDePasse2026!" })).status).toBe(200);
  });

  test("opposition : on peut sortir du classement des pilotes (et y revenir)", async () => {
    const me = await register();
    const award = await invoke(app, "POST", "/api/v1/points/transact", { action: "AWARD", reason: "RIDE_COMPLETED" }, bearer(me.token));
    expect(award.status).toBe(200);
    const top = async () => (await invoke(app, "GET", "/api/v1/leaderboard", null, bearer(me.token))).body.top.map((p) => p.username);
    const visibleBefore = await top();
    expect(visibleBefore).toContain("PiloteRGPD");

    const off = await invoke(app, "PATCH", "/api/v1/rgpd/account", { leaderboardVisible: false }, bearer(me.token));
    expect(off.status).toBe(200);
    expect(off.body.leaderboardVisible).toBe(false);
    expect(await top()).not.toContain("PiloteRGPD");
    expect((await invoke(app, "PATCH", "/api/v1/rgpd/account", { leaderboardVisible: "non" }, bearer(me.token))).status).toBe(400);

    await invoke(app, "PATCH", "/api/v1/rgpd/account", { leaderboardVisible: true }, bearer(me.token));
    expect(await top()).toEqual(visibleBefore);
  });

  test("effacement : identité et textes libres effacés, ancien jeton refusé, effacement noté", async () => {
    const me = await register();
    await invoke(app, "POST", "/api/v1/hazards", { type: "obstacle", lat: 45.04, lng: 3.88, description: "devant chez Paul Martin" }, bearer(me.token));
    const del = await invoke(app, "DELETE", "/api/v1/rgpd/account", null, bearer(me.token));
    expect(del.status).toBe(200);
    expect(del.body.message).toMatch(/5 ans/);

    expect((await invoke(app, "GET", "/api/v1/rgpd/account", null, bearer(me.token))).status).toBe(401);
    const near = await invoke(app, "GET", "/api/v1/hazards?lat=45.04&lng=3.88", null, admin);
    expect(near.body.hazards[0].description).toBe(""); // le danger reste, le texte libre est parti

    const log = await invoke(app, "GET", "/api/v1/admin/audit", null, admin);
    const actions = log.body.entries.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["auth.register", "rgpd.erase"]));
  });

  test("journal : minimal (ni email, ni pseudo, ni numéro, ni position, ni IP) et réservé aux administrateurs", async () => {
    const me = await register("secret.pilote@example.com", "PseudoTresReconnaissable");
    await invoke(app, "POST", "/api/v1/auth/login", { email: "secret.pilote@example.com", password: "mauvais-mot-de-passe" });
    await invoke(app, "POST", "/api/v1/auth/login", { email: "inconnu@example.com", password: "MotDePasse2026!" });
    await invoke(app, "POST", "/api/v1/auth/login", { email: "secret.pilote@example.com", password: "MotDePasse2026!" });

    expect((await invoke(app, "GET", "/api/v1/admin/audit", null, bearer(me.token))).status).toBe(403);
    expect((await invoke(app, "GET", "/api/v1/admin/audit")).status).toBe(403);

    const log = await invoke(app, "GET", "/api/v1/admin/audit", null, admin);
    expect(log.status).toBe(200);
    const text = JSON.stringify(log.body);
    for (const leak of ["secret.pilote", "inconnu@", "PseudoTresReconnaissable", "10.9.9.9", "MotDePasse", "@"]) {
      expect(text).not.toContain(leak);
    }
    expect(log.body.entries.map((e) => [e.action, e.outcome])).toEqual([
      ["auth.register", "success"],
      ["auth.login_failed", "denied"], // email inconnu : rien d'écrit
      ["auth.login", "success"],
      ["admin.audit_read", "success"], // la lecture du journal est elle-même notée
    ]);
    expect(log.body.entries[1].targetId).toBe(me.uid);
  });

  test("journal : la chaîne d'empreintes est vérifiable et révèle toute modification", async () => {
    await register();
    await register("b@example.com", "PiloteB");
    const verify = await invoke(app, "GET", "/api/v1/admin/audit/verify", null, admin);
    expect(verify.body).toMatchObject({ valid: true, count: 3 }); // 2 inscriptions + la lecture

    const entries = (await invoke(app, "GET", "/api/v1/admin/audit?limit=10", null, admin)).body.entries;
    expect(audit.verifyAuditChain(entries).valid).toBe(true);

    const altered = entries.map((e) => ({ ...e }));
    altered[1].action = "rgpd.export";
    expect(audit.verifyAuditChain(altered)).toMatchObject({ valid: false, brokenAtSeq: 2 });

    const removed = entries.filter((e) => e.seq !== 2);
    expect(audit.verifyAuditChain(removed)).toMatchObject({ valid: false, brokenAtSeq: 3 });

    const rehashed = entries.map((e) => ({ ...e }));
    rehashed[0].outcome = "failure";
    rehashed[0].hash = audit.computeEntryHash(rehashed[0]); // même en recalculant l'empreinte…
    expect(audit.verifyAuditChain(rehashed)).toMatchObject({ valid: false, brokenAtSeq: 2 }); // …la suivante ne suit plus
    expect(audit.verifyAuditChain(entries, { anchorHash: "f".repeat(64) }).valid).toBe(false);
  });

  test("journal : actions en liste fermée, détails filtrés (un email glissé par erreur est retiré)", () => {
    expect(() => audit.normalizeEvent({ action: "texte libre" })).toThrow(/inconnue/);
    expect(() => audit.normalizeEvent({ action: "auth.login", outcome: "peut-être" })).toThrow(/inconnu/);
    const e = audit.normalizeEvent({
      action: "rgpd.rectify", actorUid: "pilote@example.com", targetType: "user", targetId: "uid-1",
      details: { fields: ["email"], email: "pilote@example.com", phone: "06 12 34 56 78", n: 3, ok: true, "clé bizarre": 1 },
    });
    expect(e.actorUid).toBeNull();
    expect(e.details).toEqual({ fields: ["email"], n: 3, ok: true });
  });

  test("journal en mémoire : écritures figées, purge au-delà d'un an seulement", async () => {
    const { createMemoryStore } = require("../sovereign-core/server/store-memory");
    const store = createMemoryStore();
    const first = await store.appendAudit({ action: "auth.login", actorUid: "u1" });
    expect(first).toMatchObject({ seq: 1, prevHash: audit.GENESIS_HASH });
    expect(await store.purgeAudit(Date.now())).toBe(0);
    expect(await store.purgeAudit(Date.now() + 366 * 24 * 3600 * 1000)).toBe(1);
  });

  test("security.txt (RFC 9116) servi par l'API, identique à celui du site, pas expiré", async () => {
    const r = await invoke(app, "GET", "/.well-known/security.txt");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/^text\/plain/);
    expect(r.text).toMatch(/^Contact: mailto:contact@mon50ccetmoi\.com$/m);
    const site = fs.readFileSync(path.join(__dirname, "../src/public/.well-known/security.txt"), "utf8");
    expect(site.replace(/\r\n/g, "\n")).toBe(r.text);
    const expires = Date.parse(r.text.match(/^Expires: (.+)$/m)[1]);
    // Échoue un mois avant l'échéance : il faut alors repousser « Expires » (au plus un an) dans
    // src/public/.well-known/security.txt ET sovereign-core/server/index.js.
    expect(expires - Date.now()).toBeGreaterThan(30 * 24 * 3600 * 1000);
    expect(expires - Date.now()).toBeLessThan(366 * 24 * 3600 * 1000);
  });

  test("en-têtes de sécurité sur toutes les réponses de l'API", async () => {
    const r = await invoke(app, "GET", "/api/v1/health");
    expect(r.headers).toMatchObject({
      "strict-transport-security": expect.stringMatching(/max-age=\d{8}/),
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "strict-origin-when-cross-origin",
      "cache-control": "no-store",
    });
    expect(r.headers["content-security-policy"]).toMatch(/default-src 'self'/);
    expect(r.headers["content-security-policy"]).toMatch(/frame-ancestors 'self'/);
    expect(r.headers["access-control-allow-methods"]).toMatch(/PATCH/);
  });
});
