/**
 * @jest-environment node
 *
 * Outil d'usine tools/mise_en_service.py contre le vrai serveur souverain (démarré ici),
 * avec un boîtier simulé qui signe comme le firmware. Passé si python3 + cryptography manquent.
 */
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");

const hasPython = spawnSync("python3", ["-c", "import cryptography"]).status === 0;
const d = hasPython ? describe : describe.skip;

d("Outil de mise en service en usine", () => {
    let app;
    let base;
    beforeAll(async () => {
        app = createSovereignApp();
        await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
        base = `http://127.0.0.1:${app.server.address().port}`;
    });
    afterAll(() => new Promise((r) => app.server.close(r)));

    const run = (types) => new Promise((resolve, reject) => {
        const token = signSovereignJwt({ uid: "usine-poste-1", role: "factory", username: "Poste 1" });
        const { spawn } = require("child_process");
        const p = spawn("python3", [path.join(__dirname, "fixtures", "fake_boitier.py"), path.join(__dirname, "..", "tools"), base, token, types]);
        let out = "", err = "";
        p.stdout.on("data", (c) => { out += c; });
        p.stderr.on("data", (c) => { err += c; });
        p.on("close", (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err))));
    });

    test("trois boîtiers neufs : numéros A01, A02, P01, écrits dans chaque boîtier et liés à sa clé", async () => {
        const res = await run("SERIES,SERIES,PROTOTYPE");
        expect(res.map((r) => r.serial)).toEqual(["BB50V1-A01", "BB50V1-A02", "BB50V1-P01"]);
        for (const r of res) {
            expect(r.deviceSerial).toBe(r.serial);
            expect((await app.store.getBlackboxUnit(r.serial)).ecdsaPublicKey).toBe(r.pub);
        }
    });

    test("le script est valide pour Python (compilation)", () => {
        expect(() => execFileSync("python3", ["-m", "py_compile", path.join(__dirname, "..", "tools", "mise_en_service.py")])).not.toThrow();
    });
});
