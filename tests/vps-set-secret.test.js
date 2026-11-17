/**
 * @jest-environment node
 *
 * Saisie d'une clé secrète dans .env sans éditeur (sovereign-core/deploy/set-secret.sh) :
 * la valeur n'est jamais affichée, seuls les noms prévus sont acceptés, les autres lignes
 * du fichier ne bougent pas. Ignoré si bash n'est pas disponible.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "../sovereign-core/deploy/set-secret.sh");
const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;
const describeIfBash = hasBash ? describe : describe.skip;

describeIfBash("Saisie des clés secrètes du VPS (set-secret.sh)", () => {
  let dir, envFile;
  const run = (args, input) => spawnSync("bash", [SCRIPT, ...args], {
    input, encoding: "utf8", env: { ...process.env, ENV_FILE: envFile },
  });
  const env = () => fs.readFileSync(envFile, "utf8");

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-secret-"));
    envFile = path.join(dir, ".env");
    fs.writeFileSync(envFile, "DB_PASSWORD=garde-moi\nWORM_S3_ACCESS_KEY_ID=\nWORM_S3_BUCKET=mon50cc-preuves\n");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("remplace la valeur vide, sans l'afficher, sans toucher au reste", () => {
    const r = run(["WORM_S3_ACCESS_KEY_ID"], "AKIA1234SECRETVALUE\r\n");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/WORM_S3_ACCESS_KEY_ID enregistrée .*\(19 caractères\)/);
    expect(r.stdout + r.stderr).not.toContain("AKIA1234SECRETVALUE");
    expect(env()).toBe("DB_PASSWORD=garde-moi\nWORM_S3_ACCESS_KEY_ID=AKIA1234SECRETVALUE\nWORM_S3_BUCKET=mon50cc-preuves\n");
  });

  test("ajoute la ligne si elle n'existe pas encore, et remplace une ancienne valeur", () => {
    expect(run(["METEO_FRANCE_API_KEY"], "cle-meteo-123\n").status).toBe(0);
    expect(env()).toMatch(/\nMETEO_FRANCE_API_KEY=cle-meteo-123\n$/);
    expect(run(["METEO_FRANCE_API_KEY"], "nouvelle-cle\n").status).toBe(0);
    expect(env().match(/METEO_FRANCE_API_KEY=/g)).toHaveLength(1);
    expect(env()).toContain("METEO_FRANCE_API_KEY=nouvelle-cle\n");
  });

  test("refuse un nom non prévu (impossible d'écraser le mot de passe de la base)", () => {
    const r = run(["DB_PASSWORD"], "pirate\n");
    expect(r.status).not.toBe(0);
    expect(env()).toContain("DB_PASSWORD=garde-moi\n");
  });

  test("refuse une valeur vide ou qui casserait le fichier", () => {
    for (const bad of ["\n", "avec espace\n", "a$b\n", "a#b\n", "\"x\"\n"]) {
      const r = run(["WORM_S3_ACCESS_KEY_ID"], bad);
      expect(r.status).not.toBe(0);
    }
    expect(env()).toContain("WORM_S3_ACCESS_KEY_ID=\n");
  });

  test("sans nom : affiche la liste des noms acceptés", () => {
    const r = run([], "");
    expect(r.status).not.toBe(0);
    expect(r.stdout).toMatch(/WORM_S3_SECRET_ACCESS_KEY/);
  });
});
