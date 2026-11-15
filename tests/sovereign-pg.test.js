/**
 * @jest-environment node
 *
 * Phase 3 : le serveur souverain sur une VRAIE base PostgreSQL (portable, démarrée pour le test)
 * avec le schéma de production (sovereign-core/db/schema.sql). Seule PostGIS est retirée,
 * l'extension n'étant pas fournie par la version portable.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { Pool } = require("pg");

const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createPgStore } = require("../sovereign-core/server/store-pg");
const blackboxCore = require("../functions/api/blackbox-core");

const PORT = 54330 + Math.floor(Math.random() * 500);
let pgProcess;
let pool;
let wormDir;

function schemaWithoutPostgis() {
  return fs.readFileSync(path.join(__dirname, "../sovereign-core/db/schema.sql"), "utf8")
    .replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/, "")
    .replace(/GEOGRAPHY\(POINT, 4326\)/g, "TEXT")
    .replace(/-- \[POSTGIS-DEBUT\][\s\S]*?-- \[POSTGIS-FIN\]/, "");
}

function startPostgres() {
  return new Promise((resolve, reject) => {
    pgProcess = spawn(process.execPath, [path.join(__dirname, "helpers/start-pg.mjs"), String(PORT)], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    let out = "";
    pgProcess.stdout.on("data", (d) => {
      out += d;
      if (out.includes("READY")) resolve();
      if (out.includes("FAILED")) reject(new Error(out));
    });
    pgProcess.on("exit", (c) => reject(new Error(`PostgreSQL arrêté (code ${c}) : ${out}`)));
  });
}

function call(app, method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const raw = body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
    const req = { method, url, socket: { remoteAddress: "10.1.1.1" },
      headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
    const res = { statusCode: 200, setHeader() {}, end(p) { resolve({ status: this.statusCode, body: p ? JSON.parse(p) : null }); } };
    app.handleRequest(req, res, raw).catch(reject);
  });
}

beforeAll(async () => {
  await startPostgres();
  pool = new Pool({ host: "127.0.0.1", port: PORT, user: "postgres", password: "test", database: "mon50cc_test" });
  await pool.query(schemaWithoutPostgis());
  wormDir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-worm-pg-"));
}, 180000);

afterAll(async () => {
  if (pool) await pool.end();
  if (pgProcess) {
    await new Promise((r) => { pgProcess.once("exit", r); pgProcess.stdin.end("stop"); setTimeout(r, 15000); });
  }
  if (wormDir) fs.rmSync(wormDir, { recursive: true, force: true });
}, 30000);

describe("Serveur souverain sur PostgreSQL", () => {
  let app;
  beforeAll(() => {
    app = createSovereignApp({ store: createPgStore({ pool }), wormDir });
  });

  test("inscription, connexion et doublons (email ou pseudo déjà pris → 409)", async () => {
    const reg = await call(app, "POST", "/api/v1/auth/register", { email: "Pilote@Example.com", username: "PilotePG", password: "MotDePasse2026!" });
    expect(reg.status).toBe(201);
    expect(reg.body.uid).toMatch(/^[0-9a-f-]{36}$/);

    const { rows } = await pool.query("SELECT email, username, password_hash FROM users WHERE uid = $1", [reg.body.uid]);
    expect(rows[0].email).toBe("pilote@example.com");
    expect(rows[0].password_hash.startsWith("scrypt$")).toBe(true); // jamais le mot de passe en clair

    const login = await call(app, "POST", "/api/v1/auth/login", { email: "pilote@example.com", password: "MotDePasse2026!" });
    expect(login.status).toBe(200);
    const bad = await call(app, "POST", "/api/v1/auth/login", { email: "pilote@example.com", password: "faux" });
    expect(bad.status).toBe(401);

    expect((await call(app, "POST", "/api/v1/auth/register", { email: "pilote@example.com", username: "Autre", password: "MotDePasse2026!" })).status).toBe(409);
    expect((await call(app, "POST", "/api/v1/auth/register", { email: "autre@example.com", username: "PilotePG", password: "MotDePasse2026!" })).status).toBe(409);
  });

  test("boîtier + télémétrie signée : enregistrée en base, puis immuable", async () => {
    const reg = await call(app, "POST", "/api/v1/auth/register", { email: "rider@example.com", username: "RiderPG", password: "MotDePasse2026!" });
    const userJwt = reg.body.token;
    const adminJwt = signSovereignJwt({ uid: crypto.randomUUID(), role: "admin", username: "Admin" });

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pubHex = publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("hex");
    const prov = await call(app, "POST", "/api/v1/admin/blackbox/units",
      { serial: "BB50V1-P05", ecdsaPublicKey: pubHex, ownerUid: reg.body.uid }, { Authorization: `Bearer ${adminJwt}` });
    expect(prov.status).toBe(201);
    expect(prov.body.status).toBe("ACTIVE");

    // Propriétaire inexistant → refusé proprement
    const ghost = await call(app, "POST", "/api/v1/admin/blackbox/units",
      { serial: "BB50V1-P06", ecdsaPublicKey: crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("hex"), ownerUid: crypto.randomUUID() }, { Authorization: `Bearer ${adminJwt}` });
    expect(ghost.status).toBe(400);

    const seed = "c".repeat(64);
    const h1 = blackboxCore.computeMerkleStep(seed, "p1");
    const frames = [
      { seqId: 1, timestamp: 1730000100, prevHashHex: seed.slice(0, 32), payload: "p1", gForce: 1.1 },
      { seqId: 2, timestamp: 1730000101, prevHashHex: h1.slice(0, 32), payload: "p2", gForce: 4.4 },
    ];
    const root = blackboxCore.verifyMerkleChain(frames, seed).finalHashHex;
    const sig = crypto.sign("sha256", Buffer.from(root, "hex"), privateKey).toString("hex");
    const up = await call(app, "POST", "/api/v1/telemetry/upload",
      { hardwareId: "BB50V1-P05", payloads: frames, isCrashReport: true, impactTimestamp: 1730000101, merkleSeedHex: seed, ecdsaSignature: sig },
      { Authorization: `Bearer ${userJwt}` });
    expect(up.status).toBe(201);
    expect(up.body.ecdsaVerified).toBe(true);

    const { rows } = await pool.query("SELECT * FROM telemetry_sessions WHERE session_id = $1", [up.body.sessionId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].frame_count).toBe(2);
    expect(rows[0].merkle_root_hex).toBe(root);

    // Trigger d'immuabilité : aucune modification ni suppression possible, même en SQL direct
    await expect(pool.query("UPDATE telemetry_sessions SET frame_count = 1 WHERE session_id = $1", [up.body.sessionId]))
      .rejects.toThrow(/IMMUABLE|immuable|INTÉGRITÉ/i);
    await expect(pool.query("DELETE FROM telemetry_sessions WHERE session_id = $1", [up.body.sessionId]))
      .rejects.toThrow(/INTÉGRITÉ/i);
  });

  test("dangers : signalement, recherche autour d'un point (triée par distance), données invalides refusées", async () => {
    const a = await call(app, "POST", "/api/v1/auth/register", { email: "danger@example.com", username: "DangerPG", password: "MotDePasse2026!" });
    const auth = { Authorization: `Bearer ${a.body.token}` };
    const post = (h) => call(app, "POST", "/api/v1/hazards", h, auth);
    expect((await post({ type: "pothole", lat: 48.8566, lng: 2.3522, description: "Nid de poule" })).status).toBe(201);
    expect((await post({ type: "police", lat: 48.8656, lng: 2.3522 })).status).toBe(201); // ≈ 1 km au nord
    expect((await post({ type: "accident", lat: 45.764, lng: 4.8357 })).status).toBe(201); // Lyon
    expect((await post({ type: "ovni", lat: 48.85, lng: 2.35 })).status).toBe(400);
    expect((await post({ type: "pothole", lat: 123, lng: 2.35 })).status).toBe(400);

    const near = await call(app, "GET", "/api/v1/hazards?lat=48.8566&lng=2.3522&radiusKm=5", null, auth);
    expect(near.status).toBe(200);
    expect(near.body.hazards.map((h) => h.type)).toEqual(["pothole", "police"]); // Lyon exclu, plus proche d'abord
    expect(near.body.hazards[1].distanceM).toBeGreaterThan(900);
    expect(near.body.hazards[1].distanceM).toBeLessThan(1100);
    expect((await call(app, "GET", "/api/v1/hazards?lat=48.85&lng=2.35")).status).toBe(401);
  });

  test("points : preuve exigée, gain unique par danger, plafonds, solde, classement, grand livre immuable", async () => {
    const a = await call(app, "POST", "/api/v1/auth/register", { email: "points@example.com", username: "PointsPG", password: "MotDePasse2026!" });
    const b = await call(app, "POST", "/api/v1/auth/register", { email: "triche@example.com", username: "TrichePG", password: "MotDePasse2026!" });
    const authA = { Authorization: `Bearer ${a.body.token}` };
    const authB = { Authorization: `Bearer ${b.body.token}` };
    const tx = (auth, data) => call(app, "POST", "/api/v1/points/transact", data, auth);

    const hz = await call(app, "POST", "/api/v1/hazards", { type: "roadwork", lat: 43.6, lng: 1.44 }, authA);
    const award = { action: "AWARD", reason: "RADAR_HAZARD_REPORTED", amount: 9999, metadata: { hazardId: hz.body.hazardId } };
    const r1 = await tx(authA, award);
    expect(r1.status).toBe(200);
    expect(r1.body.delta).toBe(25); // le serveur fixe le montant
    expect((await tx(authA, award)).body.delta).toBe(0); // même danger : pas de second gain
    expect((await tx(authB, award)).status).toBe(422); // le danger d'un autre ne rapporte rien

    for (let i = 0; i < 3; i++) expect((await tx(authA, { action: "AWARD", reason: "RIDE_COMPLETED" })).status).toBe(200);
    expect((await tx(authA, { action: "AWARD", reason: "RIDE_COMPLETED" })).status).toBe(429); // 3 trajets / jour
    expect((await tx(authA, { action: "AWARD", reason: "ADMIN_GRANT", amount: 500 })).status).toBe(403);

    const spend = await tx(authA, { action: "DEDUCT", reason: "POCKET_LAWYER_QUERY", amount: 5 });
    expect(spend.body.balance).toBe(25 + 36 - 5);
    expect((await tx(authA, { action: "DEDUCT", reason: "POCKET_LAWYER_QUERY", amount: 100 })).status).toBe(402);

    const top = await call(app, "GET", "/api/v1/leaderboard", null, authA);
    expect(top.body.top[0]).toEqual({ username: "PointsPG", points: 61 }); // points gagnés, dépenses non déduites

    await expect(pool.query("UPDATE points_ledger SET delta = 1000")).rejects.toThrow(/INTÉGRITÉ/i);
    const { rows } = await pool.query("SELECT brave_coins FROM users WHERE uid = $1", [a.body.uid]);
    expect(rows[0].brave_coins).toBe(56);
  });

  test("RGPD : le compte est anonymisé, les preuves restent, l'ancien jeton ne sert plus", async () => {
    const reg = await call(app, "POST", "/api/v1/auth/register", { email: "efface@example.com", username: "EffacePG", password: "MotDePasse2026!" });
    const uid = reg.body.uid;
    const jwt = reg.body.token;
    await pool.query(
      `INSERT INTO telemetry_sessions (user_uid, hardware_id, frame_count, worm_storage_path, worm_sha256_hex)
       VALUES ($1, 'BB50V1-P07', 3, 'worm://x/y.json', $2)`, [uid, "d".repeat(64)]);

    const del = await call(app, "DELETE", "/api/v1/rgpd/account", null, { Authorization: `Bearer ${jwt}` });
    expect(del.status).toBe(200);

    const { rows } = await pool.query("SELECT email, username, password_hash, deleted_at FROM users WHERE uid = $1", [uid]);
    expect(rows[0].email).not.toContain("efface");
    expect(rows[0].username).not.toContain("EffacePG");
    expect(rows[0].password_hash).toBe("!");
    expect(rows[0].deleted_at).not.toBeNull();

    const kept = await pool.query("SELECT count(*)::int AS n FROM telemetry_sessions WHERE user_uid = $1", [uid]);
    expect(kept.rows[0].n).toBe(1); // preuve conservée, rattachée à un identifiant devenu anonyme

    expect((await call(app, "POST", "/api/v1/auth/login", { email: "efface@example.com", password: "MotDePasse2026!" })).status).toBe(401);
    const up = await call(app, "POST", "/api/v1/telemetry/upload", { hardwareId: "BB50V1-P05", payloads: [{ timestamp: 1 }] }, { Authorization: `Bearer ${jwt}` });
    expect(up.status).toBe(401);

    // L'email libéré peut servir à un nouveau compte
    expect((await call(app, "POST", "/api/v1/auth/register", { email: "efface@example.com", username: "Nouveau", password: "MotDePasse2026!" })).status).toBe(201);
  });

  test("usine : numéro attribué sous verrou, une clé = un numéro, lien numéro ↔ clé définitif en SQL", async () => {
    const factory = { Authorization: `Bearer ${signSovereignJwt({ uid: "usine-pg", role: "factory", username: "Usine" })}` };
    const dev = () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("hex");
      return { pub, pop: (c) => crypto.sign("sha256", Buffer.from(`mon50cc-factory-pop:${c}:${pub}`), privateKey).toString("hex") };
    };
    const reg = async (d) => {
      const ch = await call(app, "POST", "/api/v1/factory/challenge", {}, factory);
      return call(app, "POST", "/api/v1/factory/units",
        { ecdsaPublicKey: d.pub, challengeToken: ch.body.challengeToken, popSignature: d.pop(ch.body.challenge) }, factory);
    };
    const a = dev(), b = dev();
    // Deux postes en même temps : jamais le même numéro
    const [ra, rb] = await Promise.all([reg(a), reg(b)]);
    expect(new Set([ra.body.serial, rb.body.serial]).size).toBe(2);
    expect((await reg(a)).body).toMatchObject({ serial: ra.body.serial, created: false });

    await expect(pool.query("UPDATE blackbox_units SET ecdsa_public_key = $1 WHERE serial = $2", [b.pub, ra.body.serial]))
      .rejects.toThrow(/définitif/);
    await expect(pool.query("UPDATE blackbox_units SET serial = 'BB50V1-Z98' WHERE serial = $1", [ra.body.serial]))
      .rejects.toThrow(/définitif|INTÉGRITÉ|violates/i);
    await expect(pool.query("INSERT INTO blackbox_units (serial, ecdsa_public_key) VALUES ('BB50V1-Z97', $1)", [a.pub.toUpperCase()]))
      .rejects.toThrow(/uq_blackbox_units_pubkey|duplicate/);
    // Le statut (stock, vendu, activé…) reste modifiable : seul le lien est figé
    await pool.query("UPDATE blackbox_units SET status = 'SOLD' WHERE serial = $1", [ra.body.serial]);
  });
});
