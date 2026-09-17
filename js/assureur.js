// js/assureur.js
// Logique B2B : Recherche de dossier, paiement Revolut, et Déchiffrement Zero-Knowledge.

let currentReportData = null;
let currentReportId = null;
let decryptedTelemetry = null;

// ==========================================
// 1. RECHERCHE DE DOSSIER (FIREBASE)
// ==========================================
async function searchReport() {
  const hardwareId = document.getElementById("search-hw-id").value.trim();
  const optionsDiv = document.getElementById("report-options-container");
  const btnPay = document.getElementById("btn-pay");
  const statusMsg = document.getElementById("status-msg");

  if (!hardwareId) {
    statusMsg.innerHTML = '<span class="error">Veuillez entrer un ID de boîte noire.</span>';
    return;
  }

  statusMsg.innerHTML = '<span class="info"><i class="fa-solid fa-spinner fa-spin"></i> Recherche sécurisée en cours...</span>';
  
  try {
    // Dans une version finale, on ferait un getDoc sur Firebase :
    // const docRef = db.collection('blackbox_telemetry').doc(hardwareId);
    // const docSnap = await docRef.get();
    
    // Pour la démo, on simule la réponse chiffrée
    setTimeout(() => {
      // Simulation d'une trame AES-GCM (IV + Ciphertext) stockée en Base64
      // Contenu original : {"speed": 62, "gForce": 12.4, "lean": 85, "timestamp": "2026-08-08T18:42:00Z", "lat": 48.8566, "lng": 2.3522}
      currentReportData = {
        iv: "bW9uNTBjY2V0bW9pMTIzNDU=", // IV fixe pour la démo
        ciphertext: "dHVfYXMfZMOpY2hpZmZyw6lfYXZlY19zdWjZXM=" // Faux ciphertext
      };
      currentReportId = hardwareId;

      optionsDiv.style.display = "flex";
      btnPay.style.display = "block";
      statusMsg.innerHTML = '<span class="success">Dossier crypté trouvé. Authentification requise pour l\'ouverture.</span>';
    }, 1500);

  } catch (err) {
    console.error(err);
    statusMsg.innerHTML = '<span class="error">Erreur de connexion au registre distribué.</span>';
  }
}

function selectReportOption(element) {
  document.querySelectorAll('.report-card').forEach(c => c.classList.remove('selected'));
  element.classList.add('selected');
}

// ==========================================
// 2. PAIEMENT REVOLUT B2B
// ==========================================
function payReport() {
  const btnPay = document.getElementById("btn-pay");
  btnPay.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transaction B2B en cours...';
  btnPay.disabled = true;

  // Simulation d'un appel Revolut Pay Merchant API
  setTimeout(() => {
    btnPay.innerHTML = '<i class="fa-solid fa-check"></i> Accès Déverrouillé';
    btnPay.style.background = "#00ffcc";
    btnPay.style.color = "#000";
    
    // Afficher la modale de déchiffrement Zero-Knowledge
    document.getElementById("decryption-modal").style.display = "block";
    
  }, 2000);
}

// ==========================================
// 3. DÉCHIFFREMENT ZERO-KNOWLEDGE (WEB CRYPTO API)
// ==========================================
async function decryptTelemetry() {
  const keyInput = document.getElementById("master-key-input").value.trim();
  const expertDashboard = document.getElementById("expert-dashboard");
  const modal = document.getElementById("decryption-modal");
  const hashElement = document.getElementById("telemetry-hash");

  if (!keyInput) {
    alert("Vous devez fournir la Master Key de l'agence pour déchiffrer.");
    return;
  }

  // === SIMULATION WEB CRYPTO API ===
  // Dans un flux réel, nous utiliserions : 
  // crypto.subtle.importKey(...) puis crypto.subtle.decrypt({name: "AES-GCM", iv}, key, ciphertext)
  
  if (keyInput === "AXA-MASTER-KEY-2026") { // Clé de démo
    
    // Simulation de la donnée claire obtenue après déchiffrement
    decryptedTelemetry = {
      speed: 62,
      gForce: 12.4,
      lean: 85,
      timestamp: new Date().toLocaleString("fr-FR"),
      lat: 48.856613,
      lng: 2.352222,
      hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    };

    // Mise à jour de l'UI
    document.getElementById("telemetry-id").textContent = currentReportId;
    document.getElementById("telemetry-speed").textContent = decryptedTelemetry.speed + " km/h";
    document.getElementById("telemetry-g").textContent = decryptedTelemetry.gForce + " G";
    document.getElementById("telemetry-lean").textContent = decryptedTelemetry.lean + " °";
    
    document.getElementById("telemetry-time").textContent = " " + decryptedTelemetry.timestamp;
    document.getElementById("telemetry-gps").textContent = ` ${decryptedTelemetry.lat}, ${decryptedTelemetry.lng}`;
    
    // Animation matrix du hash
    hashElement.textContent = "Déchiffrement en cours...";
    setTimeout(() => {
      hashElement.style.color = "#00ffcc";
      hashElement.textContent = decryptedTelemetry.hash;
    }, 800);

    // Affichage
    modal.style.display = "none";
    expertDashboard.style.display = "block";

  } else {
    alert("Clé AES invalide. La signature MAC a rejeté le déchiffrement (Anti-Tamper).");
  }
}

// ==========================================
// 4. MODULE IA LITIGE (RECONSTITUTION)
// ==========================================
function runLitigationAI() {
  if (!decryptedTelemetry) {
    alert("Veuillez d'abord déchiffrer les données de télémétrie.");
    return;
  }

  const reportArea = document.getElementById("ai-report-area");
  const contentSpan = document.getElementById("ai-report-content");
  
  reportArea.style.display = "block";
  contentSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement par le modèle IA Litige en cours...';

  setTimeout(() => {
    let report = "";
    const s = decryptedTelemetry.speed;
    const g = decryptedTelemetry.gForce;
    const l = decryptedTelemetry.lean;

    // Arbre de décision heuristique (Simulation IA)
    if (g > 10 && s > 40 && l > 60) {
      report = `
        <strong style="color: #ff3333;">ALERTE CHOC MAJEUR</strong><br><br>
        <strong>Circonstances probables :</strong> Le deux-roues circulait à une vitesse relativement élevée (${s} km/h). 
        Le pic d'accélération de ${g}G indique un arrêt brutal (impact). L'inclinaison de ${l}° confirme que le véhicule est couché au sol suite à l'impact.<br><br>
        <strong>Reconstitution :</strong> Collision latérale ou frontale avec un obstacle solide (probablement un tiers impliqué).<br><br>
        <strong style="color: #b700ff;">Probabilité d'implication d'un tiers : 87%</strong>
      `;
    } else if (g <= 10 && l >= 80) {
      report = `
        <strong style="color: #ffaa00;">GLISSADE / PERTE D'ADHÉRENCE</strong><br><br>
        <strong>Circonstances probables :</strong> Vitesse mesurée de ${s} km/h avec un choc modéré de ${g}G. 
        L'inclinaison de ${l}° indique que le deux-roues s'est couché, mais l'absence de choc violent exclut un impact direct.<br><br>
        <strong>Reconstitution :</strong> Perte de contrôle isolée (chaussée glissante, freinage excessif) ayant entraîné une chute du véhicule.<br><br>
        <strong style="color: #b700ff;">Probabilité d'implication d'un tiers : 12% (Sinistre isolé présumé)</strong>
      `;
    } else {
      report = `
        <strong>INCIDENT MINEUR OU STATIONNEMENT</strong><br><br>
        <strong>Circonstances probables :</strong> L'analyse de la force (${g}G) et de l'inclinaison (${l}°) ne correspond pas à un accident de circulation classique à cette vitesse (${s} km/h).<br><br>
        <strong>Reconstitution :</strong> Chute à l'arrêt ou tentative de vol/vandalisme.<br><br>
        <strong style="color: #b700ff;">Recommandation d'expertise physique conseillée.</strong>
      `;
    }

    // Sécurité XSS : Assainissement du HTML de rapport (OWASP ASVS v5.0.0-1.3.1)
    contentSpan.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(report) : report;
  }, 2000);
}
