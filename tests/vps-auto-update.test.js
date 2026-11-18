/**
 * @jest-environment node
 *
 * Mise à jour automatique du site sur le VPS (sovereign-core/deploy/auto-update.sh), sur de vrais
 * dépôts git jetables : rien de nouveau → rien ne bouge ; du nouveau → avance rapide et
 * publication ; modifications locales ou historique divergent → refus, rien de publié.
 * La publication est remplacée par un petit script qui laisse une trace. Ignoré sans bash ou git.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "../sovereign-core/deploy/auto-update.sh");
const ok = (cmd) => spawnSync(cmd, ["--version"]).status === 0;
const describeIf = ok("bash") && ok("git") ? describe : describe.skip;

describeIf("Mise à jour automatique du site (auto-update.sh)", () => {
  let dir, origin, vps, trace;
  const sh = (cwd, cmd) => {
    const r = spawnSync("bash", ["-c", cmd], { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd}\n${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = (repo, file, content, msg) =>
    sh(repo, `mkdir -p "$(dirname '${file}')" && printf '%s' '${content}' > '${file}' && git add -A && git commit -q -m '${msg}'`);
  const run = () => spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      // Barres obliques partout : bash de Git pour Windows ne lance pas un chemin « C:\… ».
      AUTO_UPDATE_REPO: vps.replace(/\\/g, "/"),
      AUTO_UPDATE_PUBLISH_CMD: path.join(dir, "publier.sh").replace(/\\/g, "/"),
      AUTO_UPDATE_LOCK: path.join(dir, "verrou").replace(/\\/g, "/"),
    },
  });
  const published = () => (fs.existsSync(trace) ? fs.readFileSync(trace, "utf8").split("\n").filter(Boolean).length : 0);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-auto-"));
    origin = path.join(dir, "origine");
    vps = path.join(dir, "vps");
    trace = path.join(dir, "publications.txt");
    fs.writeFileSync(path.join(dir, "publier.sh"), `#!/usr/bin/env bash\necho publié >> '${trace.replace(/\\/g, "/")}'\n`, { mode: 0o755 });
    fs.mkdirSync(origin);
    sh(origin, "git init -q -b main && git config user.email t@t && git config user.name t");
    commit(origin, "src/index.html", "v1", "premier");
    sh(dir, `git clone -q origine vps && cd vps && git config user.email t@t && git config user.name t`);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("rien de nouveau sur main : ne publie rien et n'écrit rien", () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toBe("");
    expect(published()).toBe(0);
  });

  test("du nouveau : avance le dépôt du VPS et republie le site une fois", () => {
    commit(origin, "src/index.html", "v2", "nouvelle page");
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Mise à jour .* : nouvelle page/);
    expect(fs.readFileSync(path.join(vps, "src/index.html"), "utf8")).toBe("v2");
    expect(published()).toBe(1);
    expect(run().status).toBe(0); // second passage : plus rien de nouveau
    expect(published()).toBe(1);
  });

  test("code de l'API changé : le signale (reconstruction manuelle)", () => {
    commit(origin, "sovereign-core/server/index.js", "x", "serveur");
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/code de l'API a changé/);
  });

  test("modifications locales sur le VPS : refuse, sans rien publier", () => {
    commit(origin, "src/index.html", "v2", "nouvelle page");
    fs.writeFileSync(path.join(vps, "src/index.html"), "bricolé à la main");
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/modifications locales/);
    expect(published()).toBe(0);
  });

  test("historique divergent : refuse, sans rien publier", () => {
    commit(vps, "src/autre.html", "local", "commit local");
    commit(origin, "src/index.html", "v2", "nouvelle page");
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/divergé/);
    expect(published()).toBe(0);
  });

  test("publication échouée : le dit dans le journal", () => {
    fs.writeFileSync(path.join(dir, "publier.sh"), "#!/usr/bin/env bash\nexit 3\n", { mode: 0o755 });
    commit(origin, "src/index.html", "v2", "nouvelle page");
    const r = run();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/publication du site échouée/);
  });
});
