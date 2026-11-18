/**
 * @jest-environment node
 *
 * Outil Windows de saisie des clés (sovereign-core/deploy/windows/saisir-cles.ps1) :
 * il ne propose que des noms que set-secret.sh accepte, et il envoie la valeur par
 * l'entrée standard de ssh (jamais en argument de commande, ni dans un fichier).
 */
const fs = require("fs");
const path = require("path");

const DEPLOY = path.join(__dirname, "../sovereign-core/deploy");
const ps1 = fs.readFileSync(path.join(DEPLOY, "windows/saisir-cles.ps1"), "utf8");
const setSecret = fs.readFileSync(path.join(DEPLOY, "set-secret.sh"), "utf8");

const allowed = setSecret.match(/ALLOWED=\(([\s\S]*?)\)/)[1].split(/\s+/).filter(Boolean);
const catalogue = [...ps1.matchAll(/^\s{4}([A-Z0-9_]+)\s+=\s+@\(/gm)].map((m) => m[1]);

describe("Outil Windows de saisie des clés du VPS", () => {
  test("le catalogue correspond exactement aux noms acceptés par set-secret.sh", () => {
    expect(catalogue.sort()).toEqual([...allowed].sort());
  });

  test("la valeur part par l'entrée standard de ssh, pas en argument", () => {
    expect(ps1).toMatch(/RedirectStandardInput\s*=\s*\$true/);
    expect(ps1).toMatch(/StandardInput\.BaseStream\.Write/);
    // La ligne de commande ssh ne contient que le nom de la clé.
    expect(ps1).toMatch(/^\s*\$psi\.Arguments = ".*`"sudo \$outil \$nom`""$/m);
    expect(ps1).not.toMatch(/Set-Content|Out-File|WriteAllText/);
  });

  test("le lanceur .cmd lit le script en UTF-8 (accents corrects sous PowerShell 5.1)", () => {
    const cmd = fs.readFileSync(path.join(DEPLOY, "windows/saisir-cles.cmd"), "utf8");
    expect(cmd).toMatch(/ReadAllText\('%~dp0saisir-cles\.ps1', \[Text\.Encoding\]::UTF8\)/);
  });
});
