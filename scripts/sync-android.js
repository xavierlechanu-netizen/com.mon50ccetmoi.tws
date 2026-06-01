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
const foldersToCopy = ['js', 'css', 'assets'];
foldersToCopy.forEach(folder => {
    const srcPath = path.join(srcDir, folder);
    const destPath = path.join(destDir, folder);
    if (fs.existsSync(srcPath)) {
        copyFolderSync(srcPath, destPath);
        console.log(`-> Dossier ${folder}/ copié !`);
    }
});

console.log("Synchronisation terminée avec succès !");
