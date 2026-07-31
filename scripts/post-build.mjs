import fs from 'fs';
import path from 'path';

const distDir = path.resolve('./dist');
const appHtmlPath = path.join(distDir, 'app.html');
const bundlePath = path.join(distDir, 'js', 'mon50cc-bundle.js');

if (!fs.existsSync(appHtmlPath)) {
    console.error('Erreur : dist/app.html introuvable. Avez-vous lancé npm run build ?');
    process.exit(1);
}

let htmlContent = fs.readFileSync(appHtmlPath, 'utf8').replace(/^\uFEFF/, ''); // Retirer le BOM UTF-8

// Regex pour trouver tous les scripts pointant vers le dossier js/ local
// Gère tous les attributs possibles (defer, charset, async) dans n'importe quel ordre
const scriptRegex = /<script\s+(?:(?:defer|async|charset="[^"]*")\s+)*src="js\/([^"]+)"(?:\s+(?:defer|async|charset="[^"]*"))*\s*><\/script>/g;
let match;
const scriptsToBundle = [];
let bundledContent = '';
let htmlContentModified = htmlContent;

// Liste d'exclusion pour les scripts d'initialisation critiques
const excludedScripts = [
    'infallible.js',
    'config.js',
    'error-tracking.js',
    'oracle-voice.js'
];

while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const fullTag = match[0];
    const scriptName = match[1];
    
    // Ignorer les scripts avec paramètres d'URL (ex: config.js?v=...) ou dans la liste d'exclusion
    const cleanName = scriptName.split('?')[0];
    
    if (excludedScripts.includes(cleanName)) {
        continue;
    }

    const scriptPath = path.join(distDir, 'js', cleanName);
    
    if (fs.existsSync(scriptPath)) {
        if (!scriptsToBundle.some(s => s.name === cleanName)) {
            scriptsToBundle.push({ tag: fullTag, path: scriptPath, name: cleanName });
        }
    }
}

if (scriptsToBundle.length === 0) {
    console.log('Aucun script local trouvé à regrouper.');
    process.exit(0);
}

console.log(`Regroupement de ${scriptsToBundle.length} scripts en un seul bundle...`);

for (let i = 0; i < scriptsToBundle.length; i++) {
    const scriptInfo = scriptsToBundle[i];
    
    // Lire le contenu et l'ajouter au bundle avec un saut de ligne
    let content = fs.readFileSync(scriptInfo.path, 'utf8');
    content = content.replace(/\uFEFF/g, ''); // Retirer tous les BOM UTF-8
    bundledContent += `\n/* --- ${scriptInfo.name} --- */\n` + content + '\n';
    
    // Retirer la balise script du HTML
    if (i === 0) {
        // Remplacer la première balise par la balise du bundle avec defer
        htmlContentModified = htmlContentModified.replace(scriptInfo.tag, '<script defer src="js/mon50cc-bundle.js" charset="utf-8"></script>');
    } else {
        // Supprimer les autres balises
        htmlContentModified = htmlContentModified.replace(scriptInfo.tag, '');
    }
}

// Retirer les lignes vides causées par la suppression des balises
htmlContentModified = htmlContentModified.replace(/^\s*[\r\n]/gm, '\n');

// Ajouter l'en-tête du bundle
bundledContent = '/** MON50CCETMOI MASTER BUNDLE — UTF-8 **/\n' + bundledContent;

// Sauvegarder le bundle (sans BOM)
fs.writeFileSync(bundlePath, bundledContent, 'utf8');
console.log(`✅ Bundle généré : ${bundlePath} (${(bundledContent.length / 1024).toFixed(2)} KB)`);

// Sauvegarder le HTML modifié
fs.writeFileSync(appHtmlPath, htmlContentModified, 'utf8');
console.log('✅ dist/app.html mis à jour pour pointer vers le bundle.');
