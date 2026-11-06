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
    .replace(/CREATE INDEX IF NOT EXISTS idx_hazards_geo[^;]*;/, "");
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
      { serial: "BB50V1-P06", ecdsaPublicKey: pubHex, ownerUid: crypto.randomUUID() }, { Authorization: `Bearer ${adminJwt}` });
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
});
