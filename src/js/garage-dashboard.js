import { registerAction } from './actionRegistry.js';
import { comptes } from './comptes.js';
import { sovereignRequest } from './sovereign.js';
import { authFetch } from './api-client.js';
import { geocodeAddress } from './map-engine.js';
import { escapeHtml } from './html-escape.js';

/**
 * Tableau de bord du garage (serveur souverain, sovereign-core/server/garages.js, 25/11/2026).
 * - Compte pas encore certifié : paiement du droit d'entrée (50 € TTC, prix venu du serveur).
 * - Certifié : fiche publique (carte des pilotes), clients ajoutés avec le code que le pilote
 *   montre (son accord), interventions scellées dans leur carnet, rappels d'entretien au km.
 */

let state = { profile: null, clients: [], logs: [] };
// Version de la charte des garages partenaires (charte-garages.html), la même que le serveur (payments.js)
const CHARTE_GARAGES = "2026-11-25";

const $ = (id) => document.getElementById(id);

/**
 * Logique pure (testée par tests/predictive.test.js) : alertes d'entretien d'un client.
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

/** Alertes de tous les clients : km connu du client, interventions du garage (les plus récentes d'abord). */
function clientAlerts(clients, logs) {
  return clients.flatMap((c) => analyzeClientMaintenance(c.km || 0, logs
    .filter((l) => l.pilotUid === c.pilotUid)
    .map((l) => ({ category: l.category, km_at_service: l.km, clientName: c.username }))));
}

function showError(msg) {
  const box = $("garage-error");
  box.textContent = msg;
  box.hidden = !msg;
}

async function loadGarageData() {
  showError("");
  try {
    state = await sovereignRequest("/garage/dashboard", { method: "GET" });
  } catch (e) {
    if (e && e.status === 401) {
      window.location.href = "garage.html";
      return;
    }
    if (e && e.status === 403) {
      $("join-panel").hidden = false;
      $("garage-space").hidden = true;
      $("garage-name").textContent = "Votre compte n'est pas encore un garage certifié.";
      return;
    }
    showError("Espace garage indisponible pour le moment. Réessayez plus tard.");
    return;
  }
  $("join-panel").hidden = true;
  $("garage-space").hidden = false;
  render();
}

function render() {
  const { profile, clients, logs } = state;
  $("garage-name").textContent = profile ? `Bienvenue, ${profile.name}` : "Remplissez votre fiche pour apparaître sur la carte des pilotes.";
  $("profile-name").value = profile?.name || "";
  $("profile-address").value = profile?.address || "";
  $("profile-phone").value = profile?.phone || "";

  $("kpi-clients").textContent = clients.length;
  $("kpi-interventions").textContent = logs.length;

  const select = $("maint-client");
  select.replaceChildren(...clients.map((c) => {
    const o = document.createElement("option");
    o.value = c.pilotUid;
    o.textContent = [c.username, c.brand, c.model].filter(Boolean).join(" · ");
    return o;
  }));
  $("maint-form").hidden = clients.length === 0;

  renderLogs(logs);
  const alerts = clientAlerts(clients, logs);
  const container = $("predictive-alerts");
  container.replaceChildren();
  if (alerts.length === 0) {
    container.textContent = clients.length === 0
      ? "Ajoutez un client avec son code pour suivre l'entretien de son véhicule."
      : "Aucun entretien à prévoir pour vos clients.";
  }
  for (const a of alerts) {
    const div = document.createElement("div");
    div.className = `alert-item ${a.isCritical ? "critical" : ""}`;
    // eslint-disable-next-line no-restricted-syntax
    div.innerHTML = `<div class="alert-info">
        <div class="alert-title">${escapeHtml(a.partName)} <span style="color:var(--text-muted); font-weight:normal;">- ${escapeHtml(a.clientName)}</span></div>
        <div class="alert-reason"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(a.reason)}</div>
        <div class="alert-subtitle">CA estimé : ${a.price} €</div>
      </div>`;
    container.appendChild(div);
  }
  $("kpi-revenue").textContent = `${alerts.reduce((s, a) => s + a.price, 0)} €`;
}

function renderLogs(logs) {
  const tbody = $("logs-tbody");
  tbody.replaceChildren();
  if (logs.length === 0) {
    // eslint-disable-next-line no-restricted-syntax
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aucune intervention scellée pour le moment.</td></tr>`;
    return;
  }
  for (const log of logs.slice(0, 20)) {
    const tr = document.createElement("tr");
    // eslint-disable-next-line no-restricted-syntax
    tr.innerHTML = `
      <td>${escapeHtml(new Date(log.createdAt).toLocaleDateString("fr-FR"))}</td>
      <td><strong>${escapeHtml(log.clientName)}</strong></td>
      <td>${escapeHtml(log.category)}${log.description ? " - " + escapeHtml(log.description) : ""}</td>
      <td>${log.km === null ? "—" : escapeHtml(log.km.toLocaleString("fr-FR") + " km")}</td>`;
    tbody.appendChild(tr);
  }
}

/** Fiche publique : l'adresse est cherchée sur la carte IGN pour placer le garage. */
async function saveGarageProfile() {
  const address = $("profile-address").value.trim();
  let place;
  try {
    [place] = await geocodeAddress(address, { limit: 1 });
  } catch {
    place = null;
  }
  if (!place) {
    showError("Adresse introuvable sur la carte : précisez le numéro, la rue et la ville.");
    return;
  }
  // Le premier résultat peut être une commune voisine au nom proche : le garage confirme
  if (!confirm(`Adresse trouvée sur la carte : ${place.label || address}\n\nEst-ce bien l'adresse de votre garage ?`)) {
    showError("Précisez l'adresse (numéro, rue, code postal et ville), puis réessayez.");
    return;
  }
  try {
    const res = await sovereignRequest("/garage/profile", { method: "PATCH", body: {
      name: $("profile-name").value, address: place.label || address, phone: $("profile-phone").value.trim() || null,
      lat: place.lat, lng: place.lng,
    } });
    state.profile = res.profile;
    render();
    alert("Fiche enregistrée : votre garage apparaît sur la carte des pilotes.");
  } catch (e) {
    showError(e?.message || "Fiche non enregistrée.");
  }
}

async function addClientByCode() {
  const code = $("client-code").value.trim();
  try {
    await sovereignRequest("/garage/clients", { method: "POST", body: { code } });
    $("client-code").value = "";
    await loadGarageData();
  } catch (e) {
    showError(e?.message || "Code refusé.");
  }
}

async function submitMaintenance() {
  const km = $("maint-km").value.trim();
  const body = {
    pilotUid: $("maint-client").value,
    category: $("maint-category").value,
    description: $("maint-desc").value.trim(),
    km: km === "" ? null : Number(km),
  };
  if (!confirm("Sceller cette intervention dans le carnet du pilote ? Elle sera gardée 5 ans comme preuve : ni modifiable ni effaçable.")) return;
  try {
    await sovereignRequest("/garage/maintenance", { method: "POST", body });
    $("maint-desc").value = "";
    $("maint-km").value = "";
    await loadGarageData();
  } catch (e) {
    showError(e?.message || "Intervention non enregistrée.");
  }
}

/** Droit d'entrée : le montant affiché est celui de la commande créée par le serveur (catalogue). */
async function payGarageEntryFee() {
  if (!$("charte-ok").checked) {
    showError("Lisez et acceptez la charte des garages partenaires avant de payer.");
    return;
  }
  try {
    const orderData = await authFetch("createRevolutOrder", { method: "POST", body: { report_type: "GARAGE_FEE", charte: CHARTE_GARAGES } });
    const priceStr = Number.isFinite(orderData.amount) ? (orderData.amount / 100).toFixed(2).replace(".", ",") + " €" : null;
    if (!priceStr || !confirm(`Payer le droit d'entrée de ${priceStr} TTC pour devenir garage certifié ?`)) return;
    const instance = await window.RevolutCheckout(orderData.order_token, orderData.mode || "prod");
    instance.payWithPopup({
      onSuccess: () => {
        let attempts = 0;
        const timer = setInterval(async () => {
          attempts++;
          const data = await authFetch("checkPaymentStatus", { method: "GET", query: { case_id: orderData.case_id } }).catch(() => null);
          if (data && data.paid) {
            clearInterval(timer);
            alert("Paiement validé : votre espace garage est ouvert.");
            loadGarageData();
          } else if (attempts > 15) {
            clearInterval(timer);
            alert("Paiement en cours de confirmation par Revolut : rechargez la page dans quelques minutes.");
          }
        }, 2000);
      },
      onError: (message) => alert("Erreur lors du paiement : " + message),
      onCancel: () => {},
    });
  } catch (e) {
    showError(e?.message || "Paiement impossible pour le moment.");
  }
}

async function logoutGarage() {
  await comptes.seDeconnecter().catch(() => {});
  window.location.href = "garage.html";
}

registerAction('loadGarageData', loadGarageData);
registerAction('saveGarageProfile', saveGarageProfile);
registerAction('addClientByCode', addClientByCode);
registerAction('submitMaintenance', submitMaintenance);
registerAction('payGarageEntryFee', payGarageEntryFee);
registerAction('logoutGarage', logoutGarage);

if (typeof document !== 'undefined') {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadGarageData);
  else loadGarageData();
}
