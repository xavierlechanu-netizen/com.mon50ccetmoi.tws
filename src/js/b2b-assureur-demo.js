/**
 * b2b-assureur-demo.js — Page de DÉMONSTRATION du portail assureurs (données fictives).
 * Auparavant écrit en ligne dans b2b-assureur.html (incompatible avec une CSP stricte).
 */
// Remplace le contenu d'un bouton par une icône Font Awesome + un texte (sans innerHTML)
function setButtonContent(btn, iconClass, text, iconAfter = false) {
  const icon = document.createElement("i");
  icon.className = iconClass;
  const label = document.createTextNode(text);
  btn.replaceChildren(...(iconAfter ? [label, icon] : [icon, label]));
}

function verifyCrash() {
  const btn = document.getElementById('verifyBtn');
  const paywall = document.getElementById('paywallBlock');
  const result = document.getElementById('resultBlock');
  
  // Simuler la recherche sur la blockchain/Firebase
  setButtonContent(btn, "fa-solid fa-circle-notch fa-spin", " Localisation du contrat...");
  btn.style.opacity = '0.8';
  result.classList.remove('active');
  
  setTimeout(() => {
    setButtonContent(btn, "fa-solid fa-microchip", "Vérifier l’intégrité ", true);
    btn.style.opacity = '1';
    paywall.classList.add('active');
  }, 1200);
}

function unlockReport() {
  const paywall = document.getElementById('paywallBlock');
  const result = document.getElementById('resultBlock');
  const btn = paywall.querySelector('button');

  setButtonContent(btn, "fa-solid fa-circle-notch fa-spin", " Déchiffrement AES...");
  
  setTimeout(() => {
    paywall.classList.remove('active');
    result.classList.add('active');
  }, 1500);
}

window.verifyCrash = verifyCrash;
window.unlockReport = unlockReport;
