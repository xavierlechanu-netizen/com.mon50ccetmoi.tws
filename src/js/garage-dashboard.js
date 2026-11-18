import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { comptes, onAuthChange } from './comptes.js';

/**
 * Logique du Tableau de Bord Garage Pro
 */

let currentUser = null;

// Sécurité XSS : Échapper les données Firestore avant injection DOM (OWASP ASVS v5.0.0-3.2.2)
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

if (typeof document !== 'undefined') {
  document.addEventListener("DOMContentLoaded", async () => {
    // H-3 FIX : Vérification Firebase Auth server-side (OWASP ASVS v5.0.0-2.2.2)
    // Le localStorage est un CACHE, PAS un contrôle de sécurité.
    
    // Étape 1 : Vérifier que Firebase Auth est chargé et que l'utilisateur est connecté
    if (typeof firebase !== "undefined" && firebase.auth) {
      onAuthChange(async (firebaseUser) => {
        if (!firebaseUser) {
          // Pas connecté Firebase → redirection
          window.location.href = "garage.html";
          return;
        }

        // Étape 2 : Charger le profil depuis Firestore (source de vérité serveur)
        try {
          const userDoc = await firebase.firestore().collection("users").doc(firebaseUser.uid).get();
          if (!userDoc.exists || !userDoc.data().isCertifiedGarage) {
            alert("Accès refusé. Réservé aux Garages Pros certifiés.");
            window.location.href = "app.html";
            return;
          }

          currentUser = userDoc.data();
          currentUser.uid = firebaseUser.uid;

          document.getElementById("garage-name").textContent = `Bienvenue, ${currentUser.username || 'Garage Partenaire'}`;

          if (typeof db !== "undefined") {
            loadGarageData();
          } else {
            setTimeout(loadGarageData, 500);
          }
        } catch (e) {
          console.error("[Garage Dashboard] Erreur vérification profil:", e);
          window.location.href = "garage.html";
        }
      });
    } else {
      // Firebase non chargé — fallback sécurisé → redirection
      console.error("[Garage Dashboard] Firebase Auth non disponible.");
      window.location.href = "garage.html";
    }
  });
}

function logoutGarage() {
  if (window.auth) {
    // Firebase et serveur souverain (comptes.js)
    comptes.seDeconnecter().then(() => {
      localStorage.removeItem("session");
      window.location.href = "garage.html";
    });
  } else {
    localStorage.removeItem("session");
    window.location.href = "garage.html";
  }
}

/**
 * Charge les données du Garage
 */
async function loadGarageData() {
  try {
    const logsSnapshot = await db.collection("maintenance_logs")
      .where("garageUid", "==", currentUser.uid)
      .orderBy("timestamp", "desc")
      .get();
      
    const logs = [];
    logsSnapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));

    const clientUids = [...new Set(logs.map(log => log.vehicleOwnerUid))];
    
    document.getElementById("kpi-clients").textContent = clientUids.length;
    document.getElementById("kpi-interventions").textContent = logs.length;

    renderLogs(logs);
    runPredictiveEngine(clientUids, logs);

  } catch (error) {
    console.error("Erreur chargement données garage:", error);
      const alertsEl = document.getElementById("predictive-alerts");
      if (alertsEl) {
        // eslint-disable-next-line no-restricted-syntax
        alertsEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Erreur d'index Firestore. Utilisez le bouton "Générer Démo".</div>`;
      }
  }
}

function renderLogs(logs) {
  const tbody = document.getElementById("logs-tbody");
  // eslint-disable-next-line no-restricted-syntax
tbody.innerHTML = "";

  if (logs.length === 0) {
    // eslint-disable-next-line no-restricted-syntax
tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aucune intervention scellée pour le moment.</td></tr>`;
    return;
  }

  logs.slice(0, 10).forEach(log => {
    const date = log.timestamp ? new Date(log.timestamp).toLocaleDateString('fr-FR') : 'N/A';
    const tr = document.createElement("tr");
    // eslint-disable-next-line no-restricted-syntax
tr.innerHTML = `
      <td>${escapeHtml(date)}</td>
      <td><strong>${escapeHtml(log.clientName || 'Client Inconnu')}</strong><br><span style="font-size:0.75rem; color:#888;">${escapeHtml(log.vehicleModel || 'Scooter 50cc')}</span></td>
      <td>${escapeHtml(log.category)} - ${escapeHtml(log.description)}</td>
      <td>
        ${log.certified ? '<span class="badge-certified"><i class="fa-solid fa-lock"></i> Scellé</span>' : 'Brouillon'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Logique pure (Testable) : Analyse les logs d'un client et retourne les alertes.
 */
function analyzeClientMaintenance(currentKm, clientLogs) {
  const alerts = [];
  
  // -- Règle 1: Courroie (tous les 10 000 km, alerte à 9 000 km)
  const lastCourroie = clientLogs.find(l => l.category && l.category.toLowerCase().includes('courroie'));
  if (lastCourroie && lastCourroie.km_at_service) {
    const kmSince = currentKm - lastCourroie.km_at_service;
    if (kmSince > 9000) {
      alerts.push({
        partName: "Courroie de transmission",
        reason: `Remplacée il y a ${kmSince} km (limite: 10 000 km)`,
        isCritical: kmSince > 10000,
        price: 120,
        clientName: lastCourroie.clientName
      });
    }
  }

  // -- Règle 2: Pneus (tous les 8 000 km, alerte à 7 500)
  const lastPneus = clientLogs.find(l => l.category && l.category.toLowerCase().includes('pneu'));
  if (lastPneus && lastPneus.km_at_service) {
    const kmSince = currentKm - lastPneus.km_at_service;
    if (kmSince > 7500) {
      alerts.push({
        partName: "Usure des pneus",
        reason: `Changés il y a ${kmSince} km`,
        isCritical: kmSince > 8000,
        price: 90,
        clientName: lastPneus.clientName
      });
    }
  }
  
  // -- Règle 3: Révision générale (tous les 5 000 km, alerte à 4 500)
  const lastRevision = clientLogs.find(l => l.category && (l.category.toLowerCase().includes('révision') || l.category.toLowerCase().includes('vidange')));
  if (lastRevision && lastRevision.km_at_service) {
    const kmSince = currentKm - lastRevision.km_at_service;
    if (kmSince > 4500) {
      alerts.push({
        partName: "Révision générale",
        reason: `Dernière révision il y a ${kmSince} km`,
        isCritical: false,
        price: 75,
        clientName: lastRevision.clientName
      });
    }
  }

  return alerts;
}

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyzeClientMaintenance };
}

/**
 * MOTEUR D'ANALYSE DE MAINTENANCE (Appel UI)
 */
async function runPredictiveEngine(clientUids, logs) {
  const alertContainer = document.getElementById("predictive-alerts");
  // eslint-disable-next-line no-restricted-syntax
alertContainer.innerHTML = "";

  if (clientUids.length === 0) {
    // eslint-disable-next-line no-restricted-syntax
alertContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Aucune donnée suffisante pour générer des prédictions. Utilisez le bouton "Générer Démo".</div>`;
    return;
  }

  let potentialRevenue = 0;
  let allAlerts = [];

  for (const uid of clientUids) {
    try {
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) continue;
      
      const userData = userDoc.data();
      const currentKm = (userData.stats && userData.stats.km) ? userData.stats.km : 0;
      const clientLogs = logs.filter(l => l.vehicleOwnerUid === uid);
      
      const clientAlerts = analyzeClientMaintenance(currentKm, clientLogs);
      
      clientAlerts.forEach(alert => {
        alert.clientName = userData.username || alert.clientName || "Client";
        allAlerts.push(alert);
      });

    } catch (e) {
      console.warn("Erreur analyse pour client " + uid, e);
    }
  }

  if (allAlerts.length === 0) {
    // eslint-disable-next-line no-restricted-syntax
alertContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-shield-check"></i> Les véhicules de vos clients sont en parfaite santé.</div>`;
  } else {
    allAlerts.forEach(alert => {
      createAlertDOM(alertContainer, alert.clientName, alert.partName, alert.reason, alert.isCritical, alert.price);
      potentialRevenue += alert.price;
    });
  }

  document.getElementById("kpi-revenue").textContent = `${potentialRevenue} €`;
}

function createAlertDOM(container, clientName, partName, reason, isCritical, price) {
  const div = document.createElement("div");
  div.className = `alert-item ${isCritical ? 'critical' : ''}`;
  // eslint-disable-next-line no-restricted-syntax
div.innerHTML = `
    <div class="alert-info">
      <div class="alert-title">${escapeHtml(partName)} <span style="color:var(--text-muted); font-weight:normal;">- ${escapeHtml(clientName)}</span></div>
      <div class="alert-reason"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(reason)}</div>
      <div class="alert-subtitle">CA Est. : ${price} €</div>
    </div>
    <button class="btn-push" data-action="sendPromoPush(this)">
      <i class="fa-solid fa-paper-plane"></i> Envoyer Promo Push
    </button>
  `;
  container.appendChild(div);
}

function sendPromoPush(btn) {
  const originalHtml = btn.innerHTML;
  // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
  btn.disabled = true;

  setTimeout(() => {
    // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-check"></i> Envoyé';
    btn.style.background = 'var(--neon-green)';
    btn.style.color = '#000';
    
    const toast = document.getElementById("toast");
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }, 1000);
}

async function generateDemoData() {
  if (!confirm("Voulez-vous générer des données de test pour l'algorithme ?")) return;

  try {
    const demoClientId = "demo_client_" + Date.now();
    
    await db.collection("users").doc(demoClientId).set({
      username: "Léo (Démo)",
      isCertifiedGarage: false,
      stats: { km: 12500 }
    });

    await db.collection("maintenance_logs").add({
      garageUid: currentUser.uid,
      vehicleOwnerUid: demoClientId,
      clientName: "Léo (Démo)",
      vehicleModel: "Ligier JS50",
      category: "Courroie & Galets",
      description: "Remplacement préventif",
      km_at_service: 3000, 
      certified: true,
      timestamp: Date.now() - (6 * 30 * 24 * 60 * 60 * 1000)
    });

    await db.collection("maintenance_logs").add({
      garageUid: currentUser.uid,
      vehicleOwnerUid: demoClientId,
      clientName: "Léo (Démo)",
      vehicleModel: "Ligier JS50",
      category: "Pneus Avant",
      description: "Pneus Michelin City Grip",
      km_at_service: 5000, 
      certified: true,
      timestamp: Date.now() - (4 * 30 * 24 * 60 * 60 * 1000)
    });

    alert("Données générées ! Rechargez la page.");
    window.location.reload();

  } catch(e) {
    console.error("Erreur génération démo:", e);
    alert("Erreur lors de la génération. Avez-vous les droits Firestore ?");
  }
}

// --- Action Registry (ESM) ---
registerAction('escapeHtml', escapeHtml);
registerAction('logoutGarage', logoutGarage);
registerAction('loadGarageData', loadGarageData);
registerAction('renderLogs', renderLogs);
registerAction('analyzeClientMaintenance', analyzeClientMaintenance);
registerAction('runPredictiveEngine', runPredictiveEngine);
registerAction('createAlertDOM', createAlertDOM);
registerAction('sendPromoPush', sendPromoPush);
registerAction('generateDemoData', generateDemoData);
