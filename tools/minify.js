/**
 * ⚡ Ultra-Fast Zero-Dependency Minifier
 * Compresses CSS and JS for production to improve load times.
 * Run with: node tools/minify.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const cssPath = path.join(rootDir, 'public', 'css', 'style.css');
const cssMinPath = path.join(rootDir, 'public', 'css', 'style.min.css');

console.log('🚀 Démarrage de la minification...');

// ─── 1. Minify CSS ────────────────────────────────────────────────────────────
if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, 'utf8');
    const originalSize = (css.length / 1024).toFixed(1);

    // Regex-based CSS Minification
    css = css.replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
             .replace(/\s+/g, ' ')             // Replace multiple whitespace with single space
             .replace(/\s*{\s*/g, '{')         // Remove space around {
             .replace(/\s*}\s*/g, '}')         // Remove space around }
             .replace(/\s*:\s*/g, ':')         // Remove space around :
             .replace(/\s*;\s*/g, ';')         // Remove space around ;
             .replace(/\s*,\s*/g, ',')         // Remove space around ,
             .trim();

    fs.writeFileSync(cssMinPath, css);
    const newSize = (css.length / 1024).toFixed(1);
    
    console.log(`✅ CSS Minifié : style.css (${originalSize} KB) ➔ style.min.css (${newSize} KB)`);
    console.log(`📉 Réduction : ${((1 - newSize/originalSize) * 100).toFixed(0)}%`);
} else {
    console.warn(`❌ Fichier non trouvé : ${cssPath}`);
}

// Note: For JS minification, we recommend adding 'terser' via npm in the future.
// Regex JS minification is dangerous for production code.
console.log('\n💡 Astuce : Pour utiliser le CSS minifié, mettez à jour la balise <link> dans index.html');
console.log('🏁 Terminé.');
