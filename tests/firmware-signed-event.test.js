/**
 * @jest-environment node
 *
 * De bout en bout : le vrai code C du stockage de la boîte noire
 * (hardware/firmware/components/blackbox/blackbox_storage.c), compilé sur la
 * machine de test (banc tests/firmware-host : Flash NOR simulée, crypto OpenSSL),
 * produit des accidents figés et signés ; le code du serveur doit les accepter
 * tels quels et refuser la moindre retouche.
 *
 * Passé (et signalé) si gcc ou les en-têtes OpenSSL manquent.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const blackboxCore = require("../functions/api/blackbox-core");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");

const HOST = path.join(__dirname, "firmware-host");
const FW = path.join(__dirname, "..", "hardware", "firmware", "components", "blackbox");

function buildAndRun() {
    const bin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bb-host-")), "bb_host");
    try {
        execFileSync("gcc", [
            "-std=c11", "-O1", "-Wall", "-Wextra", "-Werror",
            "-Wno-deprecated-declarations", "-Wno-unused-parameter",
            "-I", path.join(HOST, "stubs"), "-I", FW,
            path.join(HOST, "host_main.c"), path.join(HOST, "host_impl.c"), path.join(FW, "blackbox_storage.c"),
            "-lcrypto", "-o", bin
        ], { stdio: "pipe" });
    } catch (e) {
        const msg = String(e.stderr || e.message);
        if (/ENOENT|openssl\/.*No such file|cannot find -lcrypto/.test(msg)) return { skipped: msg.split("\n")[0] };
        throw new Error("Compilation du firmware sur le banc hôte impossible :\n" + msg, { cause: e });
    }
    const exec = (args) => JSON.parse(execFileSync(bin, args, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8"));
    // Clé injectée d'avance (chemin de chargement d'une clé existante) ; le mode usine est testé sans argument
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const factoryPub = publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("hex");
    const factoryPriv = Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url").toString("hex").padStart(64, "0");
    return { factoryPub, result: exec([factoryPriv, factoryPub]), unprovisioned: exec([]) };
}

const run = buildAndRun();
const describeIfBuilt = run.skipped ? describe.skip : describe;
if (run.skipped) {
    console.warn("[firmware-signed-event] banc hôte non compilé :", run.skipped);
}

function verifyEvent(ev, publicKey) {
    const frames = blackboxCore.normalizeTelemetryFrames(ev.frames.map((raw) => ({ raw })));
    const chain = blackboxCore.verifyMerkleChain(frames, ev.seed);
    const sigOk = blackboxCore.verifyEcdsaP256Signature(Buffer.from(ev.root, "hex"), ev.sig, publicKey);
    return { frames, chain, sigOk };
}

function invokeRequest(app, method, url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = {
            method, url,
            socket: { remoteAddress: "10.0.0.1" },
            headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
        };
        const res = {
            statusCode: 200,
            setHeader() {},
            end(payload) { resolve({ status: this.statusCode, body: payload ? JSON.parse(payload) : null }); }
        };
        app.handleRequest(req, res, Buffer.from(JSON.stringify(body), "utf8")).catch(reject);
    });
}

describeIfBuilt("Boîte noire : accident figé et signé par le firmware, vérifié par le serveur", () => {
    const r = run.result;

    test("le boîtier signe avec SA clé d'usine (celle enregistrée côté serveur), pas une clé improvisée", () => {
        expect(r.provisioned).toBe(1);
        expect(r.publicKey).toBe(run.factoryPub);
    });

    test("boîtier neuf (mode usine) : clé et code d'appairage fabriqués dans la puce, accidents signés", () => {
        const u = run.unprovisioned;
        expect(u.provisioned).toBe(0);
        expect(u.publicKey).toMatch(/^04[0-9a-f]{128}$/);
        expect(u.factoryPinOk).toBe(1);
        const { chain, sigOk } = verifyEvent(u.event1, u.publicKey);
        expect(chain.valid && chain.finalHashHex === u.event1.root).toBe(true);
        expect(sigOk).toBe(true);
    });

    test("preuve de possession : le boîtier signe le défi du serveur, puis ferme ce chemin une fois numéroté", () => {
        const u = run.unprovisioned;
        expect(u.factoryNoSerial).toBe(1);
        const msg = Buffer.from(`mon50cc-factory-pop:${u.popChallenge}:${u.publicKey}`, "utf8");
        expect(blackboxCore.verifyEcdsaP256Signature(msg, u.popSig, u.publicKey)).toBe(true);
        // Une autre clé ou un autre défi ne passent pas
        expect(blackboxCore.verifyEcdsaP256Signature(Buffer.from(`mon50cc-factory-pop:${"00".repeat(32)}:${u.publicKey}`), u.popSig, u.publicKey)).toBe(false);
        expect(u.popClosedAfterSerial).toBe(1);
    });

    test("numéro de série : format vérifié (P01 à P10, pas de P en série, pas de 00), écrit une seule fois", () => {
        const u = run.unprovisioned;
        expect(u.serialBadRefused).toBe(1);
        expect(u.serialSetOk).toBe(1);
        expect(u.serial).toBe("BB50V1-A01");
        expect(u.serialWriteOnce).toBe(1);
    });

    test("batterie retirée (garage agréé) juste après un choc : accident signé au redémarrage, clé intacte", () => {
        expect(r.swapStillSigns).toBe(1);
        expect(r.swapEvent).toMatchObject({ impactSeq: r.swapImpact, endSeq: r.swapImpact + 50, unreadable: 0 });
        const { chain, sigOk } = verifyEvent(r.swapEvent, r.publicKey);
        expect(chain.valid && chain.finalHashHex === r.swapEvent.root).toBe(true);
        expect(sigOk).toBe(true);
    });

    test("au choc, la fenêtre [-30 s ; +30 s] est figée puis scellée 30 s après", () => {
        expect(r.pendingAfterShock).toBe(1);
        expect(r.pendingBeforeEnd).toBe(1);
        expect(r.pendingAfterEnd).toBe(0);
        expect(r.event1).toMatchObject({ startSeq: 400, impactSeq: 700, endSeq: 1000, ack: 255, unreadable: 0 });
        expect(r.event1.frames).toHaveLength(601);
    });

    test("le serveur recalcule la chaîne et vérifie la signature du boîtier", () => {
        const { frames, chain, sigOk } = verifyEvent(r.event1, r.publicKey);
        expect(chain.valid).toBe(true);
        expect(chain.finalHashHex).toBe(r.event1.root);
        expect(sigOk).toBe(true);
        const impact = frames.find((f) => f.seqId === 700);
        expect(impact.isShockFrame).toBe(true);
        expect(impact.gForce).toBe(4.5);
        expect(frames.map((f) => f.seqId)).toEqual(Array.from({ length: 601 }, (_, i) => 400 + i));
    });

    test("une trame retouchée (force G) casse la preuve", () => {
        const frames = r.event1.frames.slice();
        const b = Buffer.from(frames[300], "hex");
        b.writeUInt16LE(12, 22);   // 4,5 G → 1,2 G
        frames[300] = b.toString("hex");
        const chain = blackboxCore.verifyMerkleChain(blackboxCore.normalizeTelemetryFrames(frames.map((raw) => ({ raw }))), r.event1.seed);
        const sameRoot = chain.valid && chain.finalHashHex === r.event1.root;
        expect(sameRoot).toBe(false);
    });

    test("l'accident figé survit à 3 tours d'anneau ; l'anneau reste lisible et ménage la Flash", () => {
        expect(r.event1AfterRing.root).toBe(r.event1.root);
        expect(r.event1AfterRing.unreadable).toBe(0);
        expect(r.ringUnreadable).toBe(0);
        expect(r.ringChecked).toBe(6636);
        expect(r.overwrittenReadRefused).toBe(1);
        expect(r.maxSectorErases).toBeLessThanOrEqual(5);   // avant : le même secteur 10 fois par seconde
        expect(r.headerSectorErases).toBeLessThan(20);      // avant : ~460 pour ce trajet
        expect(r.flashViolations).toBe(0);                   // jamais d'écriture sur une zone non effacée
    });

    test("redémarrage brutal : les trames écrites après la dernière synchro sont reprises", () => {
        expect(r.rebootCountAfter).toBe(r.rebootCountBefore);
        expect(r.rebootHashSame).toBe(1);
    });

    test("coupure d'alimentation 5 s après un choc : l'accident est signé tout de suite", () => {
        expect(r.powerCutSealed).toBe(1);
        const { chain, sigOk } = verifyEvent(r.event2, r.publicKey);
        expect(chain.valid && chain.finalHashHex === r.event2.root).toBe(true);
        expect(sigOk).toBe(true);
        expect(r.event2.endSeq - r.event2.impactSeq).toBe(50);
    });

    test("deux accidents en attente : un troisième ne les écrase pas ; après acquittement la place se libère", () => {
        expect(r.thirdKeptOld).toBe(1);
        expect(r.ackOk).toBe(1);
        expect(r.ackByte).toBe(0);
        expect(r.oldestUnackedAfterAck).toBe(r.event2.slot);
        expect(r.slotReusedImpact).toBe(r.fourthImpact);
    });

    test("boîtier ouvert : l'accident en cours est signé, la clé de signature détruite, les trajets effacés, les accidents gardés", () => {
        expect(r.tamperWipeOk).toBe(1);
        expect(r.tamperRingGone).toBe(1);
        expect(r.tamperEvent).toMatchObject({ impactSeq: r.tamperFifthImpact, unreadable: 0 });
        const { chain, sigOk } = verifyEvent(r.tamperEvent, r.publicKey);
        expect(chain.valid && chain.finalHashHex === r.tamperEvent.root).toBe(true);
        expect(sigOk).toBe(true);
        // Après redémarrage : plus aucune signature possible, mais l'accident reste récupérable
        expect(r.afterTamperCanSign).toBe(0);
        expect(r.afterTamperPubKnown).toBe(1);
        expect(r.tamperEventAfterReboot.root).toBe(r.tamperEvent.root);
        expect(r.tamperEventAfterReboot.unreadable).toBe(0);
    });

    test("envoi au serveur souverain : accepté tel quel, refusé si une trame est retouchée", async () => {
        const ownerUid = "pilote-fw-01";
        const wormDir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-fw-worm-"));
        try {
            const app = createSovereignApp({
                wormDir,
                blackboxUnits: [{ serial: "BB50V1-P07", ecdsaPublicKey: r.publicKey, ownerUid }],
                users: [{ uid: ownerUid }]
            });
            const jwt = signSovereignJwt({ uid: ownerUid, role: "user", username: "Pilote" });
            const impactFrame = blackboxCore.decodeRawFrame(r.event1.frames[300]);
            const body = {
                hardwareId: "BB50V1-P07",
                payloads: r.event1.frames.map((raw) => ({ raw })),
                merkleSeedHex: r.event1.seed,
                ecdsaSignature: r.event1.sig,
                isCrashReport: true,
                impactTimestamp: impactFrame.timestamp
            };
            const ok = await invokeRequest(app, "POST", "/api/v1/telemetry/upload", body, { Authorization: `Bearer ${jwt}` });
            expect(ok.status).toBe(201);
            expect(ok.body.ecdsaVerified).toBe(true);
            expect(ok.body.frameCount).toBe(601);

            const tampered = r.event1.frames.slice();
            const b = Buffer.from(tampered[300], "hex");
            b.writeInt32LE(b.readInt32LE(4) + 1000, 4);   // position GPS déplacée
            tampered[300] = b.toString("hex");
            const ko = await invokeRequest(app, "POST", "/api/v1/telemetry/upload",
                { ...body, payloads: tampered.map((raw) => ({ raw })) }, { Authorization: `Bearer ${jwt}` });
            expect(ko.status).toBe(422);
        } finally {
            fs.rmSync(wormDir, { recursive: true, force: true });
        }
    });
});
