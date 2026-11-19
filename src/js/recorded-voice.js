/**
 * Voix enregistrée de Nexus Atlas (19/11/2026) : des phrases lues par de vraies personnes (d'abord
 * Xavier, puis des habitants), au lieu de la voix de synthèse du téléphone (souvent celle de Google
 * sur Android).
 *
 * Les enregistrements sont servis par le site lui-même (VPS OVHcloud), dans src/public/voix/<voix>/ :
 *   manifest.json  { "voice": "xavier", "phrases": [{ "id": "001", "text": "…", "file": "001.m4a" }] }
 * Pour ajouter une phrase : le fichier audio + une ligne dans manifest.json. Aucun code à changer.
 *
 * Quand Nexus Atlas doit dire une phrase en français, on cherche un enregistrement du même texte
 * (sans tenir compte des majuscules, de la ponctuation ni des espaces). Trouvé : il est joué.
 * Sinon, ou s'il ne peut pas être joué : voix du téléphone, comme avant.
 * Phrases qui changent (pseudo, distance, nom de rue) : voix du téléphone, en attendant Piper.
 *
 * Droits : l'accord de la personne qui prête sa voix (docs/voix-nexus-atlas/LETTRE_CESSION_DROITS_VOIX.md)
 * est signé avant de mettre ses enregistrements ici.
 *
 * Aucun import : testé directement (tests/recorded-voice.test.js). Branchement : voice-engine.js.
 */

export const RECORDED_VOICE_BASE = "/voix/xavier/";

/** Texte comparable : minuscules, apostrophes droites, sans ponctuation ni espaces en trop. */
export function normalizeVoiceText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[.,;:!?…«»"()  -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Table texte normalisé → adresse du fichier, à partir du manifest. */
export function indexManifest(manifest, base = RECORDED_VOICE_BASE) {
  const index = new Map();
  const phrases = manifest && Array.isArray(manifest.phrases) ? manifest.phrases : [];
  for (const p of phrases) {
    if (!p || typeof p.text !== "string" || typeof p.file !== "string") continue;
    // Un nom de fichier simple seulement : jamais de chemin ni d'adresse extérieure
    if (!/^[A-Za-z0-9_-]{1,64}\.(m4a|mp3|ogg|opus|wav)$/.test(p.file)) continue;
    const key = normalizeVoiceText(p.text);
    if (key) index.set(key, base + p.file);
  }
  return index;
}

/**
 * @param {{fetchImpl?: Function, AudioCtor?: Function, base?: string}} deps
 */
export function createRecordedVoice({ fetchImpl = (u) => fetch(u), AudioCtor = typeof Audio !== "undefined" ? Audio : null,
  base = RECORDED_VOICE_BASE } = {}) {
  let indexPromise = null;
  let current = null;

  function load() {
    if (!indexPromise) {
      indexPromise = Promise.resolve()
        .then(() => fetchImpl(`${base}manifest.json`))
        .then((r) => (r && r.ok ? r.json() : null))
        .then((m) => indexManifest(m, base))
        .catch(() => new Map()); // pas de manifest, hors ligne : voix du téléphone
    }
    return indexPromise;
  }

  return {
    load,

    /** Adresse de l'enregistrement de cette phrase, ou null. */
    async find(text) {
      return (await load()).get(normalizeVoiceText(text)) || null;
    },

    /** Vrai pendant qu'un enregistrement joue (le guidage attend la fin avant la phrase suivante). */
    isPlaying() {
      return !!current && !current.paused && !current.ended;
    },

    /** Coupe l'enregistrement en cours (une nouvelle phrase arrive). */
    stop() {
      if (current) {
        try {
          current.pause();
        } catch {
          /* déjà arrêté */
        }
        current = null;
      }
    },

    /**
     * Joue l'enregistrement de la phrase s'il existe. Vrai s'il a pu démarrer ; faux sinon (la voix
     * du téléphone prend alors le relais).
     * @param {() => boolean} [outdated]  vrai si une phrase plus récente est arrivée entre-temps : on ne joue rien
     */
    async play(text, outdated = () => false) {
      if (!AudioCtor) return false;
      const url = await this.find(text);
      if (!url || outdated()) return false;
      this.stop();
      try {
        const audio = new AudioCtor(url);
        current = audio;
        await audio.play();
        return true;
      } catch {
        current = null;
        return false;
      }
    },
  };
}
