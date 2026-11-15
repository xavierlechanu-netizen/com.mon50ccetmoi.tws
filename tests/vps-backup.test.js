/**
 * @jest-environment node
 *
 * Sauvegarde / restauration du VPS (sovereign-core/deploy/backup.sh et restore.sh)
 * sur un VRAI PostgreSQL 16 local, avec le schéma de production (sans PostGIS).
 * Docker n'est pas utilisé : les commandes pg_dump / pg_restore sont remplacées
 * par les points d'entrée PG_*_CMD prévus pour les tests.
 * Ignoré si PostgreSQL 16 (serveur + outils) n'est pas installé sur la machine.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DEPLOY = path.join(ROOT, "sovereign-core/deploy");
const S3 = require("../sovereign-core/scripts/backup-s3");

function findPgBin() {
  const base = "/usr/lib/postgresql";
  if (!fs.existsSync(base)) return null;
  for (const v of fs.readdirSync(base).sort().reverse()) {
    const bin = path.join(base, v, "bin");
    if (["initdb", "pg_ctl", "pg_dump", "pg_restore", "psql"].every((t) => fs.existsSync(path.join(bin, t)))) return bin;
  }
  return null;
}

const PG_BIN = findPgBin();
const describeIfPg = PG_BIN && process.platform === "linux" ? describe : describe.skip;

function schemaWithoutPostgis() {
  return fs.readFileSync(path.join(ROOT, "sovereign-core/db/schema.sql"), "utf8")
    .replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/, "")
    .replace(/GEOGRAPHY\(POINT, 4326\)/g, "TEXT")
    .replace(/-- \[POSTGIS-DEBUT\][\s\S]*?-- \[POSTGIS-FIN\]/, "");
}

describeIfPg("Sauvegarde et restauration de la base (VPS)", () => {
  const PASS = "phrase-de-test-suffisamment-longue-123";
  let tmp, dataDir, sockDir, backupDir, envFile, port, conn;

  const pg = (tool) => path.join(PG_BIN, tool);
  const psql = (sql) =>
    execFileSync(pg("psql"), [...conn, "-d", "mon50ccetmoi", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const connStr = () => `-h ${sockDir} -p ${port} -U postgres`;
  const run = (script, args, extraEnv) =>
    spawnSync("bash", [path.join(DEPLOY, script), ...args], {
      encoding: "utf8",
      env: { ...process.env, ENV_FILE: envFile, BACKUP_DIR: backupDir, ...extraEnv },
    });
  const dumpEnv = () => ({
    PG_DUMP_CMD: `${pg("pg_dump")} ${connStr()} -d mon50ccetmoi -Fc`,
    PG_LIST_CMD: `${pg("pg_restore")} --list`,
  });
  const restoreEnv = () => ({
    PG_RESTORE_CMD: `${pg("pg_restore")} ${connStr()} -d mon50ccetmoi --clean --if-exists --no-owner --single-transaction --exit-on-error`,
  });

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-vps-"));
    dataDir = path.join(tmp, "data");
    sockDir = path.join(tmp, "sock");
    backupDir = path.join(tmp, "backups");
    fs.mkdirSync(sockDir);
    port = 55000 + Math.floor(Math.random() * 2000);
    conn = ["-h", sockDir, "-p", String(port), "-U", "postgres"];
    const asUser = process.getuid && process.getuid() === 0 ? ["-u", "postgres"] : null;
    if (asUser) {
      // PostgreSQL refuse de tourner en root : on lui donne le dossier.
      execFileSync("chown", ["-R", "postgres", tmp]);
      execFileSync("chmod", ["755", tmp]);
    }
    // stdio « ignore » + journal dans un fichier : sinon le serveur PostgreSQL lancé en
    // arrière-plan garde le tube de sortie ouvert et execFileSync ne rend jamais la main.
    const opts = { stdio: "ignore" };
    const as = (cmd, args) =>
      (asUser ? execFileSync("runuser", [...asUser, "--", cmd, ...args], opts) : execFileSync(cmd, args, opts));
    as(pg("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust", "-E", "UTF8"]);
    as(pg("pg_ctl"), ["-D", dataDir, "-l", path.join(tmp, "pg.log"),
      "-o", `-p ${port} -k ${sockDir} -c listen_addresses=''`, "-w", "start"]);
    execFileSync(pg("psql"), [...conn, "-d", "postgres", "-c", "CREATE DATABASE mon50ccetmoi"]);
    const schemaFile = path.join(tmp, "schema.sql");
    fs.writeFileSync(schemaFile, schemaWithoutPostgis());
    execFileSync(pg("psql"), [...conn, "-d", "mon50ccetmoi", "-v", "ON_ERROR_STOP=1", "-q", "-f", schemaFile],
      { env: { ...process.env, PGOPTIONS: "--client-min-messages=warning" } });

    envFile = path.join(tmp, ".env");
    fs.writeFileSync(envFile, [
      "DB_USER=postgres",
      `BACKUP_PASSPHRASE=${PASS}   # commentaire de fin de ligne`,
      "BACKUP_S3_BUCKET=",
      "",
    ].join("\n"));
    if (asUser) execFileSync("chown", ["-R", "postgres", tmp]);
  }, 60000);

  afterAll(() => {
    if (!tmp) return;
    const stop = [pg("pg_ctl"), "-D", dataDir, "-m", "fast", "stop"];
    if (process.getuid && process.getuid() === 0) spawnSync("runuser", ["-u", "postgres", "--", ...stop]);
    else spawnSync(stop[0], stop.slice(1));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test("la sauvegarde est chiffrée, relue, puis restaure exactement l'état sauvegardé (tables immuables comprises)", () => {
    psql(`INSERT INTO users (email, username, password_hash) VALUES ('alice@exemple.fr', 'alice', 'h')`);
    psql(`INSERT INTO points_ledger (user_uid, action, reason, description, delta, amount, balance_before, balance_after)
          SELECT uid, 'AWARD', 'TEST', 'avant sauvegarde', 10, 10, 0, 10 FROM users WHERE username = 'alice'`);

    const b = run("backup.sh", [], dumpEnv());
    expect(b.stderr).toBe("");
    expect(b.status).toBe(0);
    expect(b.stdout).toMatch(/OK : \d+ tables/);
    expect(b.stdout).toMatch(/reste seulement sur ce serveur/);

    const files = fs.readdirSync(backupDir).filter((f) => S3.NAME_RE.test(f));
    expect(files).toHaveLength(1);
    const file = path.join(backupDir, files[0]);
    expect(fs.statSync(file).mode & 0o077).toBe(0); // lisible par le propriétaire seulement
    const raw = fs.readFileSync(file);
    expect(raw.subarray(0, 8).toString()).toBe("Salted__");
    expect(raw.includes(Buffer.from("alice@exemple.fr"))).toBe(false);

    // Après la sauvegarde : un nouvel utilisateur et une nouvelle écriture dans le grand livre immuable.
    psql(`INSERT INTO users (email, username, password_hash) VALUES ('bob@exemple.fr', 'bob', 'h')`);
    psql(`INSERT INTO points_ledger (user_uid, action, reason, description, delta, amount, balance_before, balance_after)
          SELECT uid, 'AWARD', 'TEST', 'après sauvegarde', 5, 5, 0, 5 FROM users WHERE username = 'bob'`);
    expect(psql("SELECT count(*) FROM users")).toBe("2");

    const sansConfirmation = run("restore.sh", [file], restoreEnv());
    expect(sansConfirmation.status).not.toBe(0);
    expect(sansConfirmation.stderr).toMatch(/--yes/);
    expect(psql("SELECT count(*) FROM users")).toBe("2");

    const r = run("restore.sh", [file, "--yes"], restoreEnv());
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(psql("SELECT string_agg(username, ',' ORDER BY username) FROM users")).toBe("alice");
    expect(psql("SELECT string_agg(description, ',') FROM points_ledger")).toBe("avant sauvegarde");
    // L'immuabilité est rétablie après restauration.
    expect(() => psql("DELETE FROM points_ledger")).toThrow(/IMMUABLE|immuable|INTÉGRITÉ/i);
  }, 60000);

  test("une mauvaise phrase de chiffrement est refusée sans toucher à la base", () => {
    const file = path.join(backupDir, fs.readdirSync(backupDir).find((f) => S3.NAME_RE.test(f)));
    const badEnv = path.join(tmp, ".env.bad");
    fs.writeFileSync(badEnv, "DB_USER=postgres\nBACKUP_PASSPHRASE=une-autre-phrase-bien-longue-456\n");
    const r = spawnSync("bash", [path.join(DEPLOY, "restore.sh"), file, "--yes"], {
      encoding: "utf8",
      env: { ...process.env, ENV_FILE: badEnv, ...restoreEnv() },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/déchiffrement impossible/);
    expect(psql("SELECT count(*) FROM users")).toBe("1");
  }, 30000);

  test("pas de sauvegarde sans phrase de chiffrement suffisante", () => {
    const weak = path.join(tmp, ".env.weak");
    fs.writeFileSync(weak, "DB_USER=postgres\nBACKUP_PASSPHRASE=court\n");
    const r = spawnSync("bash", [path.join(DEPLOY, "backup.sh")], {
      encoding: "utf8",
      env: { ...process.env, ENV_FILE: weak, BACKUP_DIR: backupDir, ...dumpEnv() },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/BACKUP_PASSPHRASE/);
  });
});

describe("Envoi des sauvegardes vers l'Object Storage (backup-s3.js)", () => {
  const cfg = { bucket: "mon50cc-sauvegardes" };
  const day = 86400 * 1000;
  const now = new Date("2026-12-31T12:00:00Z");

  function fakeS3(objects) {
    const deleted = [];
    return {
      deleted,
      async send(cmd) {
        const name = cmd.constructor.name;
        if (name === "ListObjectsV2Command") {
          return { Contents: objects.map((o) => ({ Key: S3.PREFIX + o.name, Size: 1, LastModified: o.date })), IsTruncated: false };
        }
        if (name === "DeleteObjectCommand") { deleted.push(cmd.input.Key); return {}; }
        throw new Error("commande inattendue " + name);
      },
    };
  }

  test("prune supprime les sauvegardes trop vieilles mais garde toujours la plus récente", async () => {
    const s3 = fakeS3([
      { name: "mon50cc-20261101-033000.dump.enc", date: new Date(now - 60 * day) },
      { name: "mon50cc-20261215-033000.dump.enc", date: new Date(now - 16 * day) },
      { name: "mon50cc-20261230-033000.dump.enc", date: new Date(now - 1 * day) },
      { name: "autre-fichier.txt", date: new Date(now - 90 * day) },
    ]);
    const removed = await S3.prune(s3, cfg, 30, now);
    expect(removed).toEqual(["mon50cc-20261101-033000.dump.enc"]);
    expect(s3.deleted).toEqual(["postgres/mon50cc-20261101-033000.dump.enc"]);

    const seule = fakeS3([{ name: "mon50cc-20260101-033000.dump.enc", date: new Date(now - 300 * day) }]);
    expect(await S3.prune(seule, cfg, 30, now)).toEqual([]);
  });

  test("refuse les noms qui ne viennent pas de backup.sh (pas de chemin, pas de ../)", async () => {
    await expect(S3.get(fakeS3([]), cfg, "../../etc/passwd", "/tmp/x")).rejects.toThrow(/invalide/);
    await expect(S3.prune(fakeS3([]), cfg, 0, now)).rejects.toThrow(/invalide/);
    expect(() => S3.configFromEnv({ BACKUP_S3_BUCKET: "b" })).toThrow(/manquant/);
  });
});

describe("Création du fichier .env du VPS (make-env.sh)", () => {
  const crypto = require("crypto");
  const { loadJwtKeys } = require("../sovereign-core/server/crypto-auth");

  test("secrets neufs, chacun sur une ligne, clés JWT utilisables, fichier lisible par son seul propriétaire", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-env-"));
    try {
      const envFile = path.join(dir, ".env");
      const run = () => spawnSync("bash", [path.join(DEPLOY, "make-env.sh")], { encoding: "utf8", env: { ...process.env, ENV_FILE: envFile } });
      const r = run();
      expect(r.status).toBe(0);
      // Droits Unix (600) : sans objet sous Windows, qui ne les gère pas.
      if (process.platform !== "win32") expect(fs.statSync(envFile).mode & 0o077).toBe(0);

      const text = fs.readFileSync(envFile, "utf8");
      expect(text).not.toMatch(/^-----/m); // aucune clé coupée sur plusieurs lignes
      const get = (n) => {
        const lines = text.split("\n").filter((l) => l.startsWith(n + "="));
        expect(lines).toHaveLength(1);
        return lines[0].slice(n.length + 1).replace(/^'|'$/g, "");
      };
      expect(get("DB_PASSWORD")).toMatch(/^[0-9a-f]{48}$/);
      expect(get("BACKUP_PASSPHRASE").length).toBeGreaterThanOrEqual(40);
      expect(r.stdout).toContain(get("BACKUP_PASSPHRASE"));

      // Ce que Docker Compose passe à l'API (guillemets simples = texte brut) est accepté par l'API.
      const keys = loadJwtKeys({ SOVEREIGN_JWT_PRIVATE_KEY: get("SOVEREIGN_JWT_PRIVATE_KEY"), SOVEREIGN_JWT_PUBLIC_KEY: get("SOVEREIGN_JWT_PUBLIC_KEY") });
      const sig = crypto.sign("sha256", Buffer.from("test"), keys.privateKey);
      expect(crypto.verify("sha256", Buffer.from("test"), keys.publicKey, sig)).toBe(true);

      // Jamais d'écrasement d'un .env existant (il contient les vrais secrets).
      const again = run();
      expect(again.status).not.toBe(0);
      expect(fs.readFileSync(envFile, "utf8")).toBe(text);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
