/**
 * @jest-environment node
 *
 * Scripts du VPS (sovereign-core/deploy/*.sh) lancés avec « set -o pipefail » :
 * aucun « commande | grep -q ». grep -q s'arrête au premier résultat, la commande reçoit
 * SIGPIPE en écrivant la suite, pipefail rend le tuyau « en échec » et le test se trompe
 * au hasard. Vu le 17/11/2026 sur le VPS : check.sh annonçait « connexion SSH par mot de
 * passe encore possible » 2 fois sur 3 alors qu'elle était coupée (sshd -T | grep -qi …).
 * La bonne forme : garder la sortie dans une variable, puis grep -q … <<<"$variable".
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEPLOY = path.join(__dirname, "../sovereign-core/deploy");
const scripts = fs.readdirSync(DEPLOY).filter((f) => f.endsWith(".sh"));

describe("Scripts du VPS : pas de « | grep -q » avec pipefail", () => {
  test.each(scripts)("%s", (name) => {
    const source = fs.readFileSync(path.join(DEPLOY, name), "utf8");
    if (!/pipefail/.test(source)) return;
    const fautifs = source
      .split("\n")
      .map((ligne, i) => ({ n: i + 1, code: ligne.replace(/(^|\s)#.*$/, "") }))
      .filter(({ code }) => /\|\s*grep\s+-[A-Za-z]*q/.test(code))
      .map(({ n, code }) => `${name}:${n}: ${code.trim()}`);
    expect(fautifs).toEqual([]);
  });
});

const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;
(hasBash ? describe : describe.skip)("Pourquoi : démonstration du défaut", () => {
  // Une commande qui écrit beaucoup (comme sshd -T), dont la ligne cherchée arrive tôt.
  const bavarde = "{ echo 'passwordauthentication no'; for i in $(seq 1 20000); do echo \"ligne $i\"; done; }";

  test("« commande | grep -q » avec pipefail peut répondre « absent » alors que la ligne est là", () => {
    const r = spawnSync("bash", ["-c", `set -o pipefail; ${bavarde} | grep -qi '^passwordauthentication no'`]);
    expect(r.status).not.toBe(0);
  });

  test("la forme retenue (variable puis <<<) répond toujours « présent »", () => {
    const r = spawnSync("bash", ["-c", `set -o pipefail; v="$(${bavarde})"; grep -qi '^passwordauthentication no' <<<"$v"`]);
    expect(r.status).toBe(0);
  });
});
