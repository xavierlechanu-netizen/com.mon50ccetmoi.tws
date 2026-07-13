const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..');
const destDir = path.join(__dirname, '..', 'android-app', 'www');

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    
    fs.readdirSync(from).forEach(element => {
        const fromPath = path.join(from, element);
        const toPath = path.join(to, element);
        
        if (fs.lstatSync(fromPath).isFile()) {
            fs.copyFileSync(fromPath, toPath);
        } else {
            copyFolderSync(fromPath, toPath);
        }
    });
}

console.log("Synchronisation de l'application Web vers Android WWW...");

// Copier index.html
if (fs.existsSync(path.join(srcDir, 'index.html'))) {
    fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(destDir, 'index.html'));
    console.log("-> index.html copié !");
}

// Copier les dossiers JS, CSS et Assets
const foldersToCopy = [
    { src: path.join(srcDir, 'public', 'js'), dest: path.join(destDir, 'js') },
    { src: path.join(srcDir, 'public', 'css'), dest: path.join(destDir, 'css') },
    { src: path.join(srcDir, 'assets'), dest: path.join(destDir, 'assets') }
];
foldersToCopy.forEach(mapping => {
    if (fs.existsSync(mapping.src)) {
        copyFolderSync(mapping.src, mapping.dest);
        console.log(`-> Dossier copié vers ${mapping.dest} !`);
    }
});

console.log("Synchronisation terminée avec succès !");
