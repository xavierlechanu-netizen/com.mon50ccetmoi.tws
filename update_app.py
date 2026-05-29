import re
import os

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "onclick=\"alert('Fonction Scan en cours de déploiement...')\"><i class=\"fa-solid fa-camera\"></i> Numériser Carte Grise", 
    "onclick=\"window.uploadDocument('carte_grise')\"><i class=\"fa-solid fa-camera\"></i> Numériser Carte Grise"
)
content = content.replace(
    "onclick=\"alert('Fonction Scan en cours de déploiement...')\"><i class=\"fa-solid fa-address-card\"></i> Numériser Permis AM", 
    "onclick=\"window.uploadDocument('permis_am')\"><i class=\"fa-solid fa-address-card\"></i> Numériser Permis AM"
)
content = content.replace(
    "onclick=\"alert('Fonction Scan en cours de déploiement...')\"><i class=\"fa-solid fa-shield-check\"></i> Attestation Assurance", 
    "onclick=\"window.uploadDocument('assurance')\"><i class=\"fa-solid fa-shield-check\"></i> Attestation Assurance"
)
content = content.replace(
    "<div class=\"menu-list\" style=\"margin-top:20px;\">", 
    "<div class=\"menu-list\" style=\"margin-top:20px;\">\n                <div id=\"ants-docs-container\" style=\"margin-bottom:15px;\"></div>"
)

# Append the upload logic at the end of the file
logic = """
window.uploadDocument = function(docType) {
    // Faux scan de sécurité avant ouverture
    if(window.Wallet && typeof window.Wallet.unlock === 'function') {
        window.Wallet.unlock(function() {
            triggerActualUpload(docType);
        });
    } else {
        triggerActualUpload(docType);
    }
}

function triggerActualUpload(docType) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64 = evt.target.result;
            if(window.Wallet) {
                window.Wallet.saveDoc(docType, base64);
                window.renderWalletDocs();
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

window.renderWalletDocs = function() {
    const container = document.getElementById('ants-docs-container');
    if(!container) return;
    if(!window.Wallet || !window.Wallet.docs) return;
    
    const docs = window.Wallet.docs;
    let html = '';
    
    for (const [type, doc] of Object.entries(docs)) {
        let label = 'Document';
        if(type === 'carte_grise') label = 'Certificat d\\'immatriculation';
        if(type === 'permis_am') label = 'Permis AM / BSR';
        if(type === 'assurance') label = 'Attestation d\\'Assurance';
        
        html += `
            <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border-left:3px solid #2ecc71; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; font-size:0.85rem;">\${label}</div>
                    <div style="font-size:0.6rem; color:#2ecc71;">\${doc.status} - \${new Date(doc.date).toLocaleDateString()}</div>
                </div>
                <button onclick="window.showWalletDoc('\${type}')" style="background:#2ecc71; color:white; border:none; border-radius:5px; padding:5px 10px; font-size:0.7rem;">VOIR</button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

window.showWalletDoc = function(type) {
    const doc = window.Wallet.docs[type];
    if(!doc) return;
    
    // Ouvre le document en plein écran avec un badge de sécurité
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.95)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    overlay.innerHTML = `
        <div style="position:absolute; top:20px; right:20px; background:rgba(46, 204, 113, 0.2); border:1px solid #2ecc71; color:#2ecc71; padding:5px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">
            <i class="fa-solid fa-shield-halved"></i> ANTS SECURE
        </div>
        <img src="\${doc.data}" style="max-width:90%; max-height:80vh; border-radius:10px; box-shadow:0 0 20px rgba(46,204,113,0.3);">
        <button onclick="this.parentElement.remove()" style="margin-top:20px; padding:10px 20px; background:#444; color:white; border:none; border-radius:8px; font-weight:bold;">FERMER</button>
    `;
    
    document.body.appendChild(overlay);
}

// Intercept page changes to render docs if we are on ants_wallet
const _originalShowPage = window.showPage;
window.showPage = function(page) {
    _originalShowPage(page);
    if(page === 'ants_wallet') {
        setTimeout(window.renderWalletDocs, 100);
    }
};
"""

content += "\n" + logic

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
