const fs = require('fs');
const path = require('path');

// Réparation SÛRE du texte abîmé (UTF-8 lu comme Windows-1252) : voir scripts/fix-mojibake.js.
// L'ancienne liste supprimait aveuglément toute lettre « Â » (ex. « Âge » devenait « ge ») et
// cassait les textes abîmés deux fois. Désormais, une séquence n'est remplacée que si elle se
// décode en UTF-8 valide : les vrais accents ne sont jamais modifiés.
const { repair } = require("./fix-mojibake");

function sanitizeString(content) {
  return repair(content).text;
}

function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.js')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const sanitized = sanitizeString(original);
      if (original !== sanitized) {
        fs.writeFileSync(fullPath, sanitized, 'utf8');
        console.log(`Cleaned mojibake in: ${fullPath}`);
      }
    }
  }
}

// 1. Sanitize src/public/screens
const srcPublicScreens = path.join(__dirname, '..', 'src', 'public', 'screens');
const srcHtml = path.join(__dirname, '..', 'src');

console.log('Sanitizing screens in src/public/screens...');
processDirectory(srcPublicScreens);

// 2. (Retiré le 7/11/2026) La copie vers un dossier screens/ à la racine ne servait plus :
//    le site est publié depuis dist/, qui reprend src/public/screens.

console.log('Sanitizing src/ *.html files...');
const srcFiles = fs.readdirSync(srcHtml);
for (const f of srcFiles) {
  if (f.endsWith('.html')) {
    const p = path.join(srcHtml, f);
    const orig = fs.readFileSync(p, 'utf8');
    const san = sanitizeString(orig);
    if (orig !== san) {
      fs.writeFileSync(p, san, 'utf8');
      console.log(`Cleaned mojibake in: ${p}`);
    }
  }
}

console.log('Sanitizing src/js/...');
processDirectory(path.join(__dirname, '..', 'src', 'js'));

console.log('Sanitization complete.');
