/**
 * fix-mojibake.js — Répare le texte UTF-8 qui a été lu comme Windows-1252 puis réenregistré
 * (« é » devenu « Ã© », parfois deux fois : « ÃƒÂ© »).
 *
 * Méthode sûre : chaque séquence suspecte est reconvertie en octets Windows-1252 puis décodée
 * en UTF-8 STRICT. Si le décodage échoue, la séquence est laissée intacte : un vrai accent
 * (« àé ») n'est jamais modifié. On répète jusqu'à 3 fois pour les textes abîmés plusieurs fois.
 *
 * Usage : node scripts/fix-mojibake.js [--write] fichier1 fichier2 …
 */
"use strict";

const fs = require("fs");

// Caractères Windows-1252 des octets 0x80–0x9F (les autres octets ≥ 0xA0 = même code Unicode)
const CP1252_HIGH = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86,
    "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8A, "‹": 0x8B, "Œ": 0x8C,
    "Ž": 0x8E, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
    "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9A, "›": 0x9B,
    "œ": 0x9C, "ž": 0x9E, "Ÿ": 0x9F,
};

function toCp1252Byte(ch) {
    if (CP1252_HIGH[ch] !== undefined) return CP1252_HIGH[ch];
    const c = ch.codePointAt(0);
    if (c >= 0x80 && c <= 0xFF) return c; // Latin-1 (dont 0x81, 0x8D, 0x8F, 0x90, 0x9D non définis en 1252)
    return null;
}

// Une séquence suspecte commence par un octet de tête UTF-8 lu en 1252 (Ã, Â, â, Å, Ä, Ë, Ð, Ñ…)
const CANDIDATE = new RegExp(
    "[\\u00C2-\\u00F4][" +
    "\\u0080-\\u00BF\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152" +
    "\\u017D\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178" +
    "]{1,3}", "g");

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

function repairOnce(text) {
    let changes = 0;
    const out = text.replace(CANDIDATE, (seq) => {
        const chars = Array.from(seq);
        const bytes = chars.map(toCp1252Byte);
        if (bytes.includes(null)) return seq;
        // On essaie la séquence entière, puis des préfixes plus courts (le reste sera traité au passage suivant)
        for (let len = chars.length; len >= 2; len--) {
            let decoded;
            try {
                decoded = strictUtf8.decode(Uint8Array.from(bytes.slice(0, len)));
            } catch (e) {
                continue; // pas un texte abîmé sur cette longueur
            }
            if (/[\u0080-\u009F]/.test(decoded)) continue;
            changes++;
            return decoded + chars.slice(len).join("");
        }
        return seq; // aucun décodage valide : on ne touche à rien
    });
    return { out, changes };
}

// Texte abîmé deux fois dont l'octet intermédiaire « Â » a été perdu : « Ãƒ¡ » = « Ã¡ » = « á ».
// L'octet de tête est toujours C3 (Ãƒ = C3 83 lu en 1252) ; la lettre suivante donne le 2e octet.
const DOUBLE_WITH_LOSS = /Ãƒ([\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ])/g;

function repairDoubleWithLoss(text) {
    let changes = 0;
    const out = text.replace(DOUBLE_WITH_LOSS, (seq, ch) => {
        const b = toCp1252Byte(ch);
        try {
            const decoded = strictUtf8.decode(Uint8Array.from([0xC3, b]));
            changes++;
            return decoded;
        } catch (e) {
            return seq;
        }
    });
    return { out, changes };
}

function repair(text) {
    let total = 0;
    // Tiret long « — » (E2 80 94) dont le dernier octet a été remplacé par un guillemet droit
    let current = text.replace(/â€" /g, () => { total++; return "— "; });
    // Flèche « → » (E2 86 92) mal réparée lors d'un ancien passage : « ←’ » (vu dans app-core.js, nov. 2026)
    current = current.replace(/←’/g, () => { total++; return "→"; });
    for (let pass = 0; pass < 5; pass++) {
        const a = repairOnce(current);
        const b = repairDoubleWithLoss(a.out);
        if (!a.changes && !b.changes) break;
        total += a.changes + b.changes;
        current = b.out;
    }
    return { text: current, changes: total };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const write = args.includes("--write");
    for (const file of args.filter((a) => a !== "--write")) {
        const before = fs.readFileSync(file, "utf8");
        const { text, changes } = repair(before);
        console.log(`${changes.toString().padStart(4)}  ${file}`);
        if (write && changes) fs.writeFileSync(file, text, "utf8");
    }
}

module.exports = { repair };
