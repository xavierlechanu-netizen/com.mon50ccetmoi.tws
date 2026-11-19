/**
 * Voix enregistrée de Nexus Atlas (src/js/recorded-voice.js) : les phrases lues par de vraies
 * personnes sont jouées à la place de la voix de synthèse du téléphone.
 */
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "..", "src", "js", "recorded-voice.js"), "utf8").replace(/^export /gm, "");
const R = new Function(`${code}; return { normalizeVoiceText, indexManifest, createRecordedVoice, RECORDED_VOICE_BASE };`)();

const MANIFEST = {
  voice: "xavier",
  phrases: [
    { id: "009", text: "Vous êtes arrivé à destination. Bonne journée !", file: "009.m4a" },
    { id: "010", text: "Recalcul de l’itinéraire en cours.", file: "010.m4a" },
    { id: "666", text: "Piège", file: "../../secret.m4a" },
    { id: "667", text: "Ailleurs", file: "https://exemple.com/x.m4a" },
  ],
};

const okFetch = (m = MANIFEST) => jest.fn(async () => ({ ok: true, json: async () => m }));

function fakeAudio({ fail = false } = {}) {
  const made = [];
  function AudioCtor(url) {
    this.url = url;
    this.paused = false;
    this.play = jest.fn(async () => { if (fail) throw new Error("NotAllowedError"); });
    this.pause = jest.fn(() => { this.paused = true; });
    made.push(this);
  }
  AudioCtor.made = made;
  return AudioCtor;
}

describe("Comparaison des phrases", () => {
  test("majuscules, ponctuation, apostrophes et espaces ne comptent pas", () => {
    expect(R.normalizeVoiceText("Recalcul de l’itinéraire  en cours."))
      .toBe(R.normalizeVoiceText("recalcul de l'itinéraire en cours"));
    expect(R.normalizeVoiceText("Bonne journée !")).toBe("bonne journée");
    expect(R.normalizeVoiceText(null)).toBe("");
  });

  test("seuls des noms de fichiers simples, servis par le site", () => {
    const index = R.indexManifest(MANIFEST);
    expect([...index.values()]).toEqual(["/voix/xavier/009.m4a", "/voix/xavier/010.m4a"]);
    expect(R.indexManifest(null).size).toBe(0);
    expect(R.indexManifest({ phrases: "rien" }).size).toBe(0);
  });
});

describe("Lecture", () => {
  test("phrase enregistrée : le fichier est joué", async () => {
    const AudioCtor = fakeAudio();
    const v = R.createRecordedVoice({ fetchImpl: okFetch(), AudioCtor });
    expect(await v.play("Recalcul de l'itinéraire en cours")).toBe(true);
    expect(AudioCtor.made[0].url).toBe("/voix/xavier/010.m4a");
    expect(AudioCtor.made[0].play).toHaveBeenCalled();
  });

  test("phrase non enregistrée (ou qui change, comme une distance) : voix du téléphone", async () => {
    const AudioCtor = fakeAudio();
    const v = R.createRecordedVoice({ fetchImpl: okFetch(), AudioCtor });
    expect(await v.play("Dans quatre cents mètres, tournez à droite.")).toBe(false);
    expect(AudioCtor.made).toHaveLength(0);
  });

  test("lecture refusée par le navigateur : voix du téléphone", async () => {
    const v = R.createRecordedVoice({ fetchImpl: okFetch(), AudioCtor: fakeAudio({ fail: true }) });
    expect(await v.play("Vous êtes arrivé à destination. Bonne journée !")).toBe(false);
  });

  test("pas de manifeste, ou hors ligne : voix du téléphone, sans erreur", async () => {
    const offline = R.createRecordedVoice({ fetchImpl: async () => { throw new TypeError("offline"); }, AudioCtor: fakeAudio() });
    expect(await offline.play("Recalcul de l'itinéraire en cours.")).toBe(false);
    const missing = R.createRecordedVoice({ fetchImpl: async () => ({ ok: false }), AudioCtor: fakeAudio() });
    expect(await missing.play("Recalcul de l'itinéraire en cours.")).toBe(false);
  });

  test("le manifeste n'est lu qu'une fois ; une nouvelle phrase coupe la précédente", async () => {
    const fetchImpl = okFetch();
    const AudioCtor = fakeAudio();
    const v = R.createRecordedVoice({ fetchImpl, AudioCtor });
    await v.play("Recalcul de l'itinéraire en cours.");
    await v.play("Vous êtes arrivé à destination. Bonne journée !");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(AudioCtor.made[0].pause).toHaveBeenCalled();
  });

  test("« en train de parler » tant que l'enregistrement joue (le guidage attend)", async () => {
    const AudioCtor = fakeAudio();
    const v = R.createRecordedVoice({ fetchImpl: okFetch(), AudioCtor });
    expect(v.isPlaying()).toBe(false);
    await v.play("Recalcul de l'itinéraire en cours.");
    expect(v.isPlaying()).toBe(true);
    AudioCtor.made[0].ended = true;
    expect(v.isPlaying()).toBe(false);
    await v.play("Recalcul de l'itinéraire en cours.");
    v.stop();
    expect(v.isPlaying()).toBe(false);
  });

  test("une phrase plus récente est arrivée pendant la recherche : rien n'est joué", async () => {
    const AudioCtor = fakeAudio();
    const v = R.createRecordedVoice({ fetchImpl: okFetch(), AudioCtor });
    expect(await v.play("Recalcul de l'itinéraire en cours.", () => true)).toBe(false);
    expect(AudioCtor.made).toHaveLength(0);
  });
});

describe("Branchement", () => {
  test("voice-engine.js joue l'enregistrement d'abord, en français seulement", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "js", "voice-engine.js"), "utf8");
    expect(src).toMatch(/import \{ createRecordedVoice \} from '\.\/recorded-voice\.js';/);
    expect(src).toMatch(/if \(targetLang === "fr"\) \{/);
    expect(src).toMatch(/await recordedVoice\.play\(finalMsg, outdated\)\) \|\| outdated\(\)\) return;/);
  });

  test("le guidage n'enchaîne pas pendant un enregistrement (isVoiceBusy)", () => {
    const engine = fs.readFileSync(path.join(__dirname, "..", "src", "js", "voice-engine.js"), "utf8");
    expect(engine).toMatch(/export function isVoiceBusy\(\)[\s\S]{0,200}recordedVoice\.isPlaying\(\)/);
    const guidance = fs.readFileSync(path.join(__dirname, "..", "src", "js", "route-guidance.js"), "utf8");
    expect(guidance).toMatch(/import \{ speak, isVoiceBusy \} from "\.\/voice-engine\.js";/);
    expect(guidance).toMatch(/const isSpeaking = \(\) => isVoiceBusy\(\);/);
  });

  test("manifeste valide, chaque fichier cité existe", () => {
    const dir = path.join(__dirname, "..", "src", "public", "voix", "xavier");
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    expect(Array.isArray(m.phrases)).toBe(true);
    for (const p of m.phrases) {
      expect(fs.existsSync(path.join(dir, p.file))).toBe(true);
      expect(p.text.length).toBeGreaterThan(2);
    }
    expect(R.indexManifest(m).size).toBe(m.phrases.length);
  });

  test("chaque phrase enregistrée est encore dite mot pour mot par l'appli (sinon elle ne serait jamais jouée)", () => {
    const spoken = new Set();
    const STR = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith(".js")) {
          for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
            for (const s of line.matchAll(STR)) {
              const text = s[1] ?? s[2] ?? s[3];
              if (!text.includes("${")) spoken.add(R.normalizeVoiceText(text.replace(/\\'/g, "'")));
            }
          }
        }
      }
    };
    walk(path.join(__dirname, "..", "src", "js"));
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "public", "voix", "xavier", "manifest.json"), "utf8"));
    const silent = m.phrases.filter((p) => !spoken.has(R.normalizeVoiceText(p.text))).map((p) => `${p.id} ${p.text}`);
    expect(silent).toEqual([]);
  });
});
