const fs = require('fs');

const content = fs.readFileSync('js/app.js', 'utf8');
const lines = content.split(/\r?\n/);

const files = {
    'js/app-core.js': [],
    'js/app-map.js': [],
    'js/app-ui.js': [],
    'js/app-garage.js': [],
    'js/app-wallet.js': [],
    'js/app-features.js': []
};

let currentFile = 'js/app-core.js';

for(let i=0; i<lines.length; i++) {
    const l = lines[i];
    
    // Switch to map
    if (l.includes('// --- 3. ROUTAGE ---')) currentFile = 'js/app-map.js';
    
    // Switch to features (Weather, Gamification, Roadbooks)
    if (l.includes('// --- 7. SERVICES (Météo, Boussole, Garage) ---')) currentFile = 'js/app-features.js';
    
    // Switch to ui (System Startup, showPage)
    if (l.includes('// --- SYSTEM STARTUP ---')) currentFile = 'js/app-ui.js';
    
    // Switch to features (Offline, shadow mode, sonar)
    if (l.includes('// --- OFFLINE MANAGEMENT ---')) currentFile = 'js/app-features.js';
    
    // Switch to wallet
    if (l.includes('// F10 : ROADBOOKS COMMUNAUTAIRES (100% GRATUIT)')) currentFile = 'js/app-wallet.js';
    
    // Switch to garage
    if (l.includes('// F11 : MÃ‰CANO Ã€ LA DEMANDE (Garages Partenaires CertifiÃ©s)')) currentFile = 'js/app-garage.js';
    
    files[currentFile].push(l);
}

for (const [filename, fileLines] of Object.entries(files)) {
    fs.writeFileSync(filename, fileLines.join('\n'), 'utf8');
    console.log(`Wrote ${filename} (${fileLines.length} lines)`);
}
