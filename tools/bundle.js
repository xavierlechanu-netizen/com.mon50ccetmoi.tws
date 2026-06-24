const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const jsDir = path.join(rootDir, 'public', 'js');
const outputFile = path.join(jsDir, 'app-bundle.min.js');

console.log('🚀 Démarrage du bundling JS...');

const scripts = [
    'app-core.js',
    'app-map.js',
    'app-ui.js',
    'app-features.js',
    'app-wallet.js',
    'app-garage.js',
    'crypto-native.js',
    'i18n.js',
    'auth.js',
    'database.js',
    'moderation.js',
    'moderation-bot.js',
    'sentinel-v2.js',
    'arbitre-bot.js',
    'guardian-angel.js',
    'blackbox.js',
    'ghost-rider-v2.js',
    'hardware.js',
    'habits.js',
    'insurance-portal.js',
    'litigation-ai.js',
    'certified-camera.js',
    'engine-pulse.js',
    'neural-hud.js',
    'neural-sync.js',
    'wallet.js',
    'certificate.js',
    'predictive-meca.js',
    'meca-wizard.js',
    'anti-theft.js',
    'chronos.js',
    'telemetry.js',
    'obd-bluetooth.js',
    'ar-navigation.js'
];

let bundleCode = '/** MON50CCETMOI MASTER BUNDLE **/\n\n';
let totalSize = 0;

for (const script of scripts) {
    const filePath = path.join(jsDir, script);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        totalSize += Buffer.byteLength(content, 'utf8');
        bundleCode += `\n/*************************************************\n`;
        bundleCode += ` * ${script}\n`;
        bundleCode += ` *************************************************/\n`;
        bundleCode += content + '\n\n';
    } else {
        console.warn(`⚠️ Fichier non trouvé: ${script}`);
    }
}

fs.writeFileSync(outputFile, bundleCode);
const finalSize = (Buffer.byteLength(bundleCode, 'utf8') / 1024).toFixed(2);
console.log(`✅ JS Bundle créé avec succès : app-bundle.min.js (${finalSize} KB)`);
