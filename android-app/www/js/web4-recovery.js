/* --- WEB 4 RECOVERY SYSTEM (ANTI-RESET) --- */

window.generateRecoveryKey = function() {
    // Collect local wealth
    const bvc = parseFloat(localStorage.getItem('braveCoins') || '0').toFixed(2);
    const cee = parseInt(localStorage.getItem('ceeCertificates') || '0');
    
    // Create a payload
    const payload = `W4|${bvc}|${cee}|${new Date().getTime()}`;
    
    // Obfuscate (Simple Base64 for UI purposes, enough to deter casual tampering)
    const encoded = btoa(payload);
    
    // Add prefix
    const finalKey = `GHOST-${encoded}`;
    
    const keyDisplay = document.getElementById('web4-key-display');
    if(keyDisplay) {
        keyDisplay.innerText = finalKey;
        document.getElementById('web4-backup-modal').classList.remove('hidden');
    }
    
    if(typeof speak === 'function') speak('Clé de sauvegarde Web 4 générée. Conservez-la en lieu sûr.');
};

window.closeBackupModal = function() {
    document.getElementById('web4-backup-modal').classList.add('hidden');
};

window.openRestoreModal = function() {
    document.getElementById('web4-restore-modal').classList.remove('hidden');
};

window.closeRestoreModal = function() {
    document.getElementById('web4-restore-modal').classList.add('hidden');
};

window.restoreAccount = function() {
    const inputKey = document.getElementById('web4-restore-input').value.trim();
    if(!inputKey.startsWith('GHOST-')) {
        alert("Clé invalide. Une clé Web4 commence par GHOST-");
        return;
    }
    
    try {
        const encoded = inputKey.replace('GHOST-', '');
        const decoded = atob(encoded);
        const parts = decoded.split('|');
        
        if(parts[0] !== 'W4') throw new Error("Format Invalide");
        
        const bvc = parseFloat(parts[1]);
        const cee = parseInt(parts[2]);
        
        // Restore to localStorage
        localStorage.setItem('braveCoins', bvc.toString());
        localStorage.setItem('ceeCertificates', cee.toString());
        
        // Update variables
        window.braveCoins = bvc;
        window.ceeCertificates = cee;
        
        // Update UI
        const balanceDisplay = document.getElementById('crypto-balance');
        if(balanceDisplay) balanceDisplay.innerText = bvc.toFixed(2) + ' BVC';
        
        alert(`Compte restauré avec succès !\nSolde : ${bvc.toFixed(2)} BVC\nCertificats : ${cee} CEE`);
        window.closeRestoreModal();
        if(typeof speak === 'function') speak('Restauration du compte terminée. Bienvenue à nouveau, Pilote.');
        
    } catch(err) {
        alert("Échec de la restauration : Clé corrompue ou invalide.");
    }
};
