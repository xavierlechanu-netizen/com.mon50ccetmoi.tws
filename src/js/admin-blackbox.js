/**
 * ADMIN BLACK BOX — CONTRÔLEUR JS (ESM)
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestionnaire du registre des Black Boxes (Francelog S.A. Linselles).
 * 
 * Spécifications :
 *  - Partenaire industriel : Francelog S.A. à Linselles (59)
 *  - Série commerciale : débute à A01 (BB50V1-A01...A99, B01...B99)
 *  - Le 00 est STRICTEMENT EXCLU de la numérotation (A00, B00 interdits)
 *  - Prototypes : P01 à P10 réservés (lettre P exclusive)
 *  - Chaque boîtier possède un Code Bluetooth unique (Passkey BLE 6 chiffres)
 *  - Livraison garantie en moins de 24h (< 24h)
 *  - Intégration unitaire manuelle ou générateur par lot
 *
 * Sécurité :
 *  - Zéro 'innerHTML' avec des variables dynamiques (OWASP ASVS v5.0.0-3.2.2)
 *  - Vérification d'authentification admin stricte
 *  - Appels aux Cloud Functions sécurisées onCall (transactions serveur)
 *  - Protection anti-injection formule dans l'export CSV
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db, firebase } from './config.js';
import * as core from './blackbox-core.js';

// État local de la console admin
const state = {
  registryData: null,
  units: [],
  selectedSerial: null,
  creationMode: "BATCH", // "BATCH" ou "SINGLE"
  filters: {
    type: "ALL",
    status: "ALL",
    search: ""
  },
  unassignedSales: []
};

// Initialisation au chargement du DOM
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Contrôle d'accès (Guard client, doublé de la vérification Cloud Functions serveur)
  if (typeof window.checkAuth === "function") {
    const session = await window.checkAuth(true);
    if (!session) return;
  }

  // 2. Initialiser la date du formulaire par défaut (aujourd'hui)
  const dateInput = document.getElementById("bb-batch-date");
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  // 3. Brancher les écouteurs d'événements
  setupEventListeners();

  // 4. Charger les données initiales
  await loadRegistryData();
  await loadUnits();
  await loadUnassignedSales();
});

/**
 * Configuration des écouteurs d'événements (UI & Modales)
 */
function setupEventListeners() {
  // Filtres & Recherche
  document.getElementById("bb-search-input")?.addEventListener("input", (e) => {
    state.filters.search = e.target.value.trim().toUpperCase();
    renderUnitsTable();
  });

  document.getElementById("bb-filter-type")?.addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    renderUnitsTable();
  });

  document.getElementById("bb-filter-status")?.addEventListener("change", (e) => {
    state.filters.status = e.target.value;
    renderUnitsTable();
  });

  document.getElementById("bb-btn-refresh")?.addEventListener("click", async () => {
    await loadRegistryData();
    await loadUnits();
    await loadUnassignedSales();
  });

  // Export CSV
  document.getElementById("bb-btn-export-csv")?.addEventListener("click", exportCSV);

  // Modale Intégration / Nouveau Lot
  document.getElementById("bb-btn-new-batch")?.addEventListener("click", openNewBatchModal);
  document.getElementById("bb-btn-close-batch-modal")?.addEventListener("click", closeNewBatchModal);
  document.getElementById("bb-btn-cancel-batch")?.addEventListener("click", closeNewBatchModal);

  // Onglets BATCH / SINGLE
  document.getElementById("bb-tab-mode-batch")?.addEventListener("click", () => switchCreationMode("BATCH"));
  document.getElementById("bb-tab-mode-single")?.addEventListener("click", () => switchCreationMode("SINGLE"));

  // Événements formulaire création
  document.getElementById("bb-batch-type")?.addEventListener("change", updateBatchFormPreview);
  document.getElementById("bb-batch-count")?.addEventListener("input", updateBatchFormPreview);
  document.getElementById("bb-batch-start-code")?.addEventListener("input", updateBatchFormPreview);
  document.getElementById("bb-single-code-input")?.addEventListener("input", updateBatchFormPreview);
  document.getElementById("bb-batch-proto-slot")?.addEventListener("change", updateBatchFormPreview);
  document.getElementById("bb-btn-single-gen-ble")?.addEventListener("click", () => {
    const bleInput = document.getElementById("bb-single-ble-input");
    if (bleInput) bleInput.value = core.generateBluetoothPasskey();
  });

  document.getElementById("bb-form-batch")?.addEventListener("submit", handleBatchSubmit);

  // Tiroir Détails
  document.getElementById("bb-btn-close-drawer")?.addEventListener("click", closeDrawer);
  document.getElementById("bb-btn-save-drawer-info")?.addEventListener("click", handleSaveDrawerInfo);
  document.getElementById("bb-btn-regen-ble")?.addEventListener("click", () => {
    const bleInput = document.getElementById("bb-drawer-ble");
    if (bleInput) bleInput.value = core.generateBluetoothPasskey();
  });
  document.getElementById("bb-btn-copy-ble")?.addEventListener("click", () => {
    const bleInput = document.getElementById("bb-drawer-ble");
    const val = bleInput?.value.trim();
    if (val) {
      navigator.clipboard?.writeText(val);
      alert(`Code Bluetooth ${val} copié dans le presse-papiers.`);
    }
  });

  // Modale Changement de Statut
  document.getElementById("bb-btn-close-status-modal")?.addEventListener("click", closeStatusModal);
  document.getElementById("bb-btn-cancel-status")?.addEventListener("click", closeStatusModal);
  document.getElementById("bb-form-status")?.addEventListener("submit", handleStatusSubmit);

  // Modale Attribution
  document.getElementById("bb-btn-close-assign-modal")?.addEventListener("click", closeAssignModal);
  document.getElementById("bb-btn-cancel-assign")?.addEventListener("click", closeAssignModal);
  document.getElementById("bb-assign-mode")?.addEventListener("change", (e) => {
    const isOrder = e.target.value === "ORDER";
    const groupOrder = document.getElementById("bb-group-assign-order");
    const groupManual = document.getElementById("bb-group-assign-manual");
    if (groupOrder) groupOrder.style.display = isOrder ? "block" : "none";
    if (groupManual) groupManual.style.display = isOrder ? "none" : "block";
  });
  document.getElementById("bb-form-assign")?.addEventListener("submit", handleAssignSubmit);
}

/**
 * Bascule entre l'intégration par lot et l'intégration unitaire
 */
function switchCreationMode(mode) {
  state.creationMode = mode;

  const btnBatch = document.getElementById("bb-tab-mode-batch");
  const btnSingle = document.getElementById("bb-tab-mode-single");
  const groupSingleCode = document.getElementById("bb-group-single-code");
  const groupSingleBle = document.getElementById("bb-group-single-ble");
  const groupSeriesCount = document.getElementById("bb-group-series-count");
  const typeSelect = document.getElementById("bb-batch-type");

  if (mode === "SINGLE") {
    btnSingle?.classList.add("active");
    btnBatch?.classList.remove("active");
    if (groupSingleCode) groupSingleCode.style.display = "block";
    if (groupSingleBle) groupSingleBle.style.display = "block";
    if (groupSeriesCount) groupSeriesCount.style.display = "none";

    const singleBleInput = document.getElementById("bb-single-ble-input");
    if (singleBleInput && !singleBleInput.value) {
      singleBleInput.value = core.generateBluetoothPasskey();
    }
  } else {
    btnBatch?.classList.add("active");
    btnSingle?.classList.remove("active");
    if (groupSingleCode) groupSingleCode.style.display = "none";
    if (groupSingleBle) groupSingleBle.style.display = "none";
    const isProto = typeSelect?.value === "PROTOTYPE";
    if (groupSeriesCount) groupSeriesCount.style.display = isProto ? "none" : "block";
  }

  updateBatchFormPreview();
}

/**
 * Charge les métadonnées et compteurs du registre (blackbox_registry/V1)
 */
async function loadRegistryData() {
  try {
    const doc = await db.collection("blackbox_registry").doc("V1").get();
    if (doc.exists) {
      state.registryData = doc.data();
    } else {
      state.registryData = {
        totalUnits: 0,
        prototypeUnits: 0,
        seriesUnits: 0,
        nextSeriesNumber: 1,
        prototypesAllocated: [],
        statusCounts: {}
      };
    }
    updateKPIs();
    renderProtoBar();
  } catch (error) {
    console.error("[BlackboxAdmin] Erreur chargement registre :", error);
  }
}

/**
 * Met à jour les cartes d'indicateurs clés
 */
function updateKPIs() {
  const reg = state.registryData || {};
  const counts = reg.statusCounts || {};

  const totalEl = document.getElementById("bb-kpi-total");
  const protoEl = document.getElementById("bb-kpi-proto");
  const stockEl = document.getElementById("bb-kpi-stock");
  const soldEl = document.getElementById("bb-kpi-sold");
  const rmaEl = document.getElementById("bb-kpi-rma");

  if (totalEl) totalEl.textContent = String(reg.totalUnits || 0);
  if (protoEl) protoEl.textContent = `${(reg.prototypesAllocated || []).length} / 10`;
  if (stockEl) stockEl.textContent = String(counts.IN_STOCK || 0);
  if (soldEl) soldEl.textContent = String((counts.SOLD || 0) + (counts.ACTIVE || 0));
  if (rmaEl) rmaEl.textContent = String((counts.RMA || 0) + (counts.STOLEN || 0));
}

/**
 * Affiche la barre des 10 prototypes officiels (P01 à P10)
 */
function renderProtoBar() {
  const grid = document.getElementById("bb-proto-grid");
  if (!grid) return;
  grid.textContent = "";

  const allocated = state.registryData?.prototypesAllocated || [];

  for (let i = 1; i <= 10; i++) {
    const isAlloc = allocated.includes(i);
    const padStr = i < 10 ? `0${i}` : String(i);
    const serial = `${core.SERIAL_PREFIX}V1-P${padStr}`;
    const unit = state.units.find(u => u.serial === serial);

    const card = document.createElement("div");
    card.className = `bb-proto-slot ${isAlloc ? 'allocated' : ''}`;
    card.title = isAlloc
      ? `${serial} (${unit?.status ? (core.STATUS_LABELS[unit.status] || unit.status) : 'Enregistré'}) - Code BLE: ${unit?.blePasskey || 'Non défini'}`
      : `${serial} (Disponible à la fabrication)`;

    const numSpan = document.createElement("span");
    numSpan.className = "bb-proto-num";
    numSpan.textContent = `P${padStr}`;
    card.appendChild(numSpan);

    const statusSpan = document.createElement("span");
    statusSpan.className = "bb-proto-status";
    if (isAlloc) {
      statusSpan.textContent = unit?.status ? (core.STATUS_LABELS[unit.status] || unit.status) : "Actif";
      statusSpan.style.color = "var(--bb-gold)";
    } else {
      statusSpan.textContent = "Libre";
      statusSpan.style.color = "#64748b";
    }
    card.appendChild(statusSpan);

    if (isAlloc) {
      card.addEventListener("click", () => openDrawer(serial));
    }

    grid.appendChild(card);
  }
}

/**
 * Charge la liste des unités physiques depuis Firestore
 */
async function loadUnits() {
  try {
    const snap = await db.collection("blackbox_units")
      .orderBy("createdAt", "desc")
      .limit(300)
      .get();

    state.units = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderUnitsTable();
    renderProtoBar();
  } catch (error) {
    console.error("[BlackboxAdmin] Erreur chargement unités :", error);
    const tbody = document.getElementById("bb-table-body");
    if (tbody) {
      tbody.textContent = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.style.textAlign = "center";
      td.style.color = "var(--bb-red)";
      td.textContent = "Erreur lors du chargement des unités. Consultez la console.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }
}

/**
 * Affiche la table des unités avec filtre et recherche
 */
function renderUnitsTable() {
  const tbody = document.getElementById("bb-table-body");
  if (!tbody) return;
  tbody.textContent = "";

  const filtered = state.units.filter(unit => {
    if (state.filters.type !== "ALL" && unit.type !== state.filters.type) return false;
    if (state.filters.status !== "ALL" && unit.status !== state.filters.status) return false;
    if (state.filters.search) {
      const q = state.filters.search;
      const serialMatch = unit.serial?.toUpperCase().includes(q);
      const codeMatch = unit.unitCode?.toUpperCase().includes(q);
      const bleMatch = unit.blePasskey?.includes(q);
      const batchMatch = unit.batchNumber?.toUpperCase().includes(q);
      const ownerMatch = unit.ownerUid?.toUpperCase().includes(q);
      if (!serialMatch && !codeMatch && !bleMatch && !batchMatch && !ownerMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.style.textAlign = "center";
    td.style.padding = "40px";
    td.style.color = "#94a3b8";
    td.textContent = "Aucun boîtier ne correspond aux critères de recherche.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach(unit => {
    const tr = document.createElement("tr");

    // 1. S/N
    const tdSerial = document.createElement("td");
    const tagSerial = document.createElement("span");
    tagSerial.className = "bb-serial-tag";
    tagSerial.textContent = unit.serial;
    tdSerial.appendChild(tagSerial);
    tr.appendChild(tdSerial);

    // 2. Code Bluetooth Unique (Passkey BLE 6 chiffres)
    const tdBle = document.createElement("td");
    const tagBle = document.createElement("span");
    tagBle.className = "bb-ble-tag";
    tagBle.title = "Cliquer pour copier le code Bluetooth";
    tagBle.style.cursor = "pointer";

    const bleIcon = document.createElement("i");
    bleIcon.className = "fa-brands fa-bluetooth-b";
    tagBle.appendChild(bleIcon);

    const bleCode = unit.blePasskey || "Non défini";
    tagBle.appendChild(document.createTextNode(" " + bleCode));

    tagBle.addEventListener("click", () => {
      if (unit.blePasskey) {
        navigator.clipboard?.writeText(unit.blePasskey);
        alert(`Code Bluetooth ${unit.blePasskey} copié dans le presse-papiers.`);
      }
    });

    tdBle.appendChild(tagBle);
    tr.appendChild(tdBle);

    // 3. Type
    const tdType = document.createElement("td");
    const isProto = unit.type === core.UNIT_TYPES.PROTOTYPE;
    const badgeType = document.createElement("span");
    badgeType.style.display = "inline-flex";
    badgeType.style.alignItems = "center";
    badgeType.style.gap = "4px";
    badgeType.style.fontSize = "0.75rem";
    badgeType.style.fontWeight = "600";
    badgeType.style.color = isProto ? "var(--bb-purple)" : "var(--bb-cyan)";
    badgeType.textContent = isProto ? "★ Prototype (P)" : `Série (${unit.unitCode || 'A01+'})`;
    tdType.appendChild(badgeType);
    tr.appendChild(tdType);

    // 4. Statut
    const tdStatus = document.createElement("td");
    const badgeCfg = core.STATUS_BADGES[unit.status] || { color: "#fff", bg: "rgba(255,255,255,0.1)", icon: "fa-cube" };
    const badgeStatus = document.createElement("span");
    badgeStatus.className = "bb-badge-status";
    badgeStatus.style.color = badgeCfg.color;
    badgeStatus.style.background = badgeCfg.bg;
    badgeStatus.style.border = `1px solid ${badgeCfg.color}40`;

    const statusIcon = document.createElement("i");
    statusIcon.className = `fa-solid ${badgeCfg.icon}`;
    badgeStatus.appendChild(statusIcon);

    const statusLabel = document.createElement("span");
    statusLabel.textContent = core.STATUS_LABELS[unit.status] || unit.status;
    badgeStatus.appendChild(statusLabel);

    tdStatus.appendChild(badgeStatus);
    tr.appendChild(tdStatus);

    // 5. Lot / Usine
    const tdMfg = document.createElement("td");
    const lotSpan = document.createElement("div");
    lotSpan.style.fontFamily = "'JetBrains Mono', monospace";
    lotSpan.style.fontSize = "0.78rem";
    lotSpan.textContent = unit.batchNumber || "-";
    const siteSpan = document.createElement("div");
    siteSpan.style.fontSize = "0.7rem";
    siteSpan.style.color = "#94a3b8";
    siteSpan.textContent = unit.manufacturingSite || core.DEFAULT_MANUFACTURING_SITE;
    tdMfg.appendChild(lotSpan);
    tdMfg.appendChild(siteSpan);
    tr.appendChild(tdMfg);

    // 6. Propriétaire
    const tdOwner = document.createElement("td");
    if (unit.ownerUid) {
      const ownerSpan = document.createElement("span");
      ownerSpan.style.fontFamily = "'JetBrains Mono', monospace";
      ownerSpan.style.fontSize = "0.75rem";
      ownerSpan.style.color = "var(--bb-gold)";
      ownerSpan.textContent = `UID: ${unit.ownerUid.substring(0, 8)}...`;
      tdOwner.appendChild(ownerSpan);
    } else {
      const noneSpan = document.createElement("span");
      noneSpan.style.color = "#64748b";
      noneSpan.textContent = "Non attribué";
      tdOwner.appendChild(noneSpan);
    }
    tr.appendChild(tdOwner);

    // 7. Garantie & Livraison
    const tdWarranty = document.createElement("td");
    const wSpan = document.createElement("div");
    wSpan.style.fontSize = "0.75rem";
    wSpan.style.fontWeight = "600";
    if (unit.warrantyType === core.WARRANTY_TYPES.LIFETIME) {
      wSpan.style.color = "var(--bb-purple)";
      wSpan.textContent = "À vie (Proto)";
    } else {
      wSpan.style.color = "#94a3b8";
      wSpan.textContent = "2 ans légale";
    }
    tdWarranty.appendChild(wSpan);

    const dlvSpan = document.createElement("div");
    dlvSpan.style.fontSize = "0.68rem";
    dlvSpan.style.color = "var(--bb-green)";
    dlvSpan.textContent = "< 24h garantie";
    tdWarranty.appendChild(dlvSpan);

    tr.appendChild(tdWarranty);

    // 8. Actions
    const tdActions = document.createElement("td");
    const actionGroup = document.createElement("div");
    actionGroup.className = "bb-action-btns";

    // Fiche / Détails
    const btnView = document.createElement("button");
    btnView.className = "bb-icon-btn";
    btnView.title = "Consulter la fiche & historique";
    const iconView = document.createElement("i");
    iconView.className = "fa-solid fa-eye";
    btnView.appendChild(iconView);
    btnView.addEventListener("click", () => openDrawer(unit.serial));
    actionGroup.appendChild(btnView);

    // Changer Statut (si transitions manuelles dispo)
    const allowed = core.manualTransitions(unit.status);
    if (allowed.length > 0) {
      const btnStatus = document.createElement("button");
      btnStatus.className = "bb-icon-btn";
      btnStatus.title = "Changer le statut";
      const iconStatus = document.createElement("i");
      iconStatus.className = "fa-solid fa-arrows-rotate";
      btnStatus.appendChild(iconStatus);
      btnStatus.addEventListener("click", () => openStatusModal(unit.serial, unit.status));
      actionGroup.appendChild(btnStatus);
    }

    // Attribuer à un client (si EN STOCK)
    if (unit.status === core.STATUSES.IN_STOCK) {
      const btnAssign = document.createElement("button");
      btnAssign.className = "bb-icon-btn";
      btnAssign.title = "Attribuer à une commande client (< 24h)";
      btnAssign.style.color = "var(--bb-green)";
      const iconAssign = document.createElement("i");
      iconAssign.className = "fa-solid fa-handshake";
      btnAssign.appendChild(iconAssign);
      btnAssign.addEventListener("click", () => openAssignModal(unit.serial));
      actionGroup.appendChild(btnAssign);
    }

    // Désattribuer (si VENDU ou ACTIF)
    if (unit.status === core.STATUSES.SOLD || unit.status === core.STATUSES.ACTIVE) {
      const btnUnassign = document.createElement("button");
      btnUnassign.className = "bb-icon-btn";
      btnUnassign.title = "Désattribuer / Retour en stock";
      btnUnassign.style.color = "var(--bb-red)";
      const iconUnassign = document.createElement("i");
      iconUnassign.className = "fa-solid fa-user-xmark";
      btnUnassign.appendChild(iconUnassign);
      btnUnassign.addEventListener("click", () => handleUnassign(unit.serial));
      actionGroup.appendChild(btnUnassign);
    }

    tdActions.appendChild(actionGroup);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

/**
 * Charge les commandes non attribuées depuis blackbox_sales
 */
async function loadUnassignedSales() {
  try {
    const snap = await db.collection("blackbox_sales")
      .where("assignedSerial", "==", null)
      .limit(50)
      .get();

    state.unassignedSales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn("[BlackboxAdmin] Impossible de charger les commandes ventes :", e);
  }
}

/**
 * Tiroir latéral : Ouverture et affichage de la fiche
 */
async function openDrawer(serial) {
  state.selectedSerial = serial;
  const unit = state.units.find(u => u.serial === serial);
  if (!unit) return;

  const drawer = document.getElementById("bb-drawer-details");
  document.getElementById("bb-drawer-serial").textContent = unit.serial;

  // Code Bluetooth
  const bleInput = document.getElementById("bb-drawer-ble");
  if (bleInput) {
    bleInput.value = unit.blePasskey || "";
  }

  // Statut partenaire Francelog
  const partnerStatusEl = document.getElementById("bb-drawer-partner-status");
  if (partnerStatusEl) {
    partnerStatusEl.textContent = unit.partnerStatus ||
      (unit.type === core.UNIT_TYPES.PROTOTYPE ? core.PARTNER_PROTOTYPE_STATUS : core.PARTNER_SERIES_STATUS);
  }

  document.getElementById("bb-drawer-mfg").textContent = `${unit.manufacturer || core.DEFAULT_MANUFACTURER} (${unit.manufacturingSite || core.DEFAULT_MANUFACTURING_SITE})`;
  document.getElementById("bb-drawer-batch").textContent = unit.batchNumber || "-";
  
  const mfgDateEl = document.getElementById("bb-drawer-mfg-date");
  if (mfgDateEl) {
    mfgDateEl.textContent = unit.manufacturedAt?.toDate ? unit.manufacturedAt.toDate().toLocaleDateString("fr-FR") : "-";
  }

  const macInput = document.getElementById("bb-drawer-mac");
  if (macInput) macInput.value = unit.bleMac || "";

  const fwInput = document.getElementById("bb-drawer-firmware");
  if (fwInput) fwInput.value = unit.firmwareVersion || "";

  const notesInput = document.getElementById("bb-drawer-notes");
  if (notesInput) notesInput.value = unit.notes || "";

  // Badge Statut
  const badgeContainer = document.getElementById("bb-drawer-badge");
  if (badgeContainer) {
    badgeContainer.textContent = "";
    const bCfg = core.STATUS_BADGES[unit.status] || { color: "#fff", bg: "rgba(255,255,255,0.1)", icon: "fa-cube" };
    const badge = document.createElement("span");
    badge.className = "bb-badge-status";
    badge.style.color = bCfg.color;
    badge.style.background = bCfg.bg;
    badge.style.border = `1px solid ${bCfg.color}40`;
    badge.textContent = core.STATUS_LABELS[unit.status] || unit.status;
    badgeContainer.appendChild(badge);
  }

  // Charger la frise historique
  await loadTimeline(serial);

  if (drawer) drawer.classList.add("active");
}

function closeDrawer() {
  document.getElementById("bb-drawer-details")?.classList.remove("active");
  state.selectedSerial = null;
}

/**
 * Charge l'historique immuable de l'unité
 */
async function loadTimeline(serial) {
  const ul = document.getElementById("bb-drawer-timeline");
  if (!ul) return;
  ul.textContent = "";

  try {
    const snap = await db.collection("blackbox_units").doc(serial)
      .collection("history")
      .orderBy("timestamp", "desc")
      .limit(30)
      .get();

    if (snap.empty) {
      const li = document.createElement("li");
      li.style.color = "#94a3b8";
      li.style.fontSize = "0.8rem";
      li.textContent = "Aucun événement enregistré.";
      ul.appendChild(li);
      return;
    }

    snap.docs.forEach(doc => {
      const h = doc.data();
      const li = document.createElement("li");
      li.className = "bb-timeline-item";

      const dot = document.createElement("div");
      dot.className = "bb-timeline-dot";
      li.appendChild(dot);

      const timeDiv = document.createElement("div");
      timeDiv.className = "bb-timeline-time";
      const dateStr = h.timestamp?.toDate ? h.timestamp.toDate().toLocaleString("fr-FR") : "Date inconnue";
      timeDiv.textContent = dateStr;
      li.appendChild(timeDiv);

      const actDiv = document.createElement("div");
      actDiv.className = "bb-timeline-action";
      actDiv.textContent = h.action || "Action";
      li.appendChild(actDiv);

      if (h.reason || h.changes) {
        const descDiv = document.createElement("div");
        descDiv.className = "bb-timeline-desc";
        descDiv.textContent = h.reason || (Array.isArray(h.changes) ? h.changes.join(", ") : "");
        li.appendChild(descDiv);
      }

      ul.appendChild(li);
    });
  } catch (e) {
    console.error("[BlackboxAdmin] Erreur timeline :", e);
  }
}

/**
 * Sauvegarder les informations du tiroir (Code BLE, MAC, firmware, notes)
 */
async function handleSaveDrawerInfo() {
  const serial = state.selectedSerial;
  if (!serial) return;

  const blePasskey = document.getElementById("bb-drawer-ble")?.value.trim();
  const bleMac = document.getElementById("bb-drawer-mac")?.value.trim();
  const firmwareVersion = document.getElementById("bb-drawer-firmware")?.value.trim();
  const notes = document.getElementById("bb-drawer-notes")?.value.trim();

  if (blePasskey && !core.isValidBluetoothPasskey(blePasskey)) {
    alert("Le code Bluetooth doit être un passkey de 6 chiffres décimaux (ex: 503050).");
    return;
  }

  try {
    const updateFn = firebase.functions("europe-west1").httpsCallable("adminUpdateBlackboxInfo");
    await updateFn({
      serial,
      blePasskey: blePasskey || undefined,
      bleMac: bleMac || null,
      firmwareVersion: firmwareVersion || "1.0.0",
      notes
    });

    alert("✅ Informations enregistrées.");
    await loadUnits();
    await loadTimeline(serial);
  } catch (err) {
    alert("❌ Erreur : " + err.message);
  }
}

/**
 * Modale Nouveau Lot / Intégration
 */
function openNewBatchModal() {
  const modal = document.getElementById("bb-modal-new-batch");
  const protoSlotSelect = document.getElementById("bb-batch-proto-slot");
  const nextNum = state.registryData?.nextSeriesNumber || 1;
  const nextCode = core.unitNumberToSeriesCode(nextNum);

  const startCodeInput = document.getElementById("bb-batch-start-code");
  if (startCodeInput) startCodeInput.value = nextCode;

  const singleCodeInput = document.getElementById("bb-single-code-input");
  if (singleCodeInput) singleCodeInput.value = nextCode;

  const singleBleInput = document.getElementById("bb-single-ble-input");
  if (singleBleInput) singleBleInput.value = core.generateBluetoothPasskey();

  // Remplir les prototypes libres
  if (protoSlotSelect) {
    protoSlotSelect.textContent = "";
    const allocated = state.registryData?.prototypesAllocated || [];
    let freeCount = 0;
    for (let i = 1; i <= 10; i++) {
      if (!allocated.includes(i)) {
        freeCount++;
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = `P${i < 10 ? '0' + i : i} (Disponible)`;
        protoSlotSelect.appendChild(opt);
      }
    }
    if (freeCount === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Tous les 10 prototypes Francelog sont attribués";
      protoSlotSelect.appendChild(opt);
    }
  }

  switchCreationMode(state.creationMode || "BATCH");
  if (modal) modal.classList.add("active");
}

function closeNewBatchModal() {
  document.getElementById("bb-modal-new-batch")?.classList.remove("active");
}

function updateBatchFormPreview() {
  const type = document.getElementById("bb-batch-type")?.value;
  const isProto = type === "PROTOTYPE";
  const isSingle = state.creationMode === "SINGLE";

  const groupProto = document.getElementById("bb-group-proto-slot");
  const groupSeries = document.getElementById("bb-group-series-count");
  const groupSingleCode = document.getElementById("bb-group-single-code");
  const groupSingleBle = document.getElementById("bb-group-single-ble");

  if (isProto) {
    if (groupProto) groupProto.style.display = "block";
    if (groupSeries) groupSeries.style.display = "none";
    if (groupSingleCode) groupSingleCode.style.display = "none";
    if (groupSingleBle) groupSingleBle.style.display = isSingle ? "block" : "none";
  } else {
    if (groupProto) groupProto.style.display = "none";
    if (groupSeries) groupSeries.style.display = isSingle ? "none" : "block";
    if (groupSingleCode) groupSingleCode.style.display = isSingle ? "block" : "none";
    if (groupSingleBle) groupSingleBle.style.display = isSingle ? "block" : "none";
  }

  const previewEl = document.getElementById("bb-batch-preview");
  if (!previewEl) return;

  if (isProto) {
    const slot = document.getElementById("bb-batch-proto-slot")?.value;
    if (slot) {
      previewEl.textContent = `Prototype : BB50V1-P${parseInt(slot) < 10 ? '0' + slot : slot} (Garantie à Vie Francelog · Livraison < 24h)`;
    } else {
      previewEl.textContent = "Tous les 10 prototypes Francelog sont déjà enregistrés.";
    }
  } else if (isSingle) {
    const rawCode = document.getElementById("bb-single-code-input")?.value.trim().toUpperCase() || "A01";
    const num = core.seriesCodeToUnitNumber(rawCode);
    if (num === null) {
      previewEl.textContent = `❌ Code '${rawCode}' invalide. La série commence à A01 et le 00 est exclu.`;
    } else {
      previewEl.textContent = `Unité Série : BB50V1-${rawCode} (Code Bluetooth unique · Livraison < 24h)`;
    }
  } else {
    const count = parseInt(document.getElementById("bb-batch-count")?.value || "1", 10);
    const startCode = document.getElementById("bb-batch-start-code")?.value.trim().toUpperCase() || "A01";
    const startNum = core.seriesCodeToUnitNumber(startCode) || (state.registryData?.nextSeriesNumber || 1);
    const endNum = startNum + count - 1;

    try {
      const sStart = core.formatSerial("V1", "SERIES", startNum);
      const sEnd = core.formatSerial("V1", "SERIES", endNum);
      previewEl.textContent = `Plage : ${sStart} → ${sEnd} (${count} boîtiers · codes Bluetooth uniques · 00 exclu)`;
    } catch (e) {
      previewEl.textContent = `Plage invalide : ${e.message}`;
    }
  }
}

async function handleBatchSubmit(e) {
  e.preventDefault();
  const type = document.getElementById("bb-batch-type")?.value;
  const batchNumber = document.getElementById("bb-batch-number")?.value.trim();
  const manufacturedAt = document.getElementById("bb-batch-date")?.value;
  const initialStatus = document.getElementById("bb-batch-status")?.value;
  const isSingle = state.creationMode === "SINGLE";

  const btnSubmit = document.getElementById("bb-btn-submit-batch");
  if (btnSubmit) btnSubmit.disabled = true;

  try {
    const registerFn = firebase.functions("europe-west1").httpsCallable("adminRegisterBlackboxUnits");
    const payload = {
      type,
      revision: "V1",
      batchNumber,
      manufacturedAt,
      initialStatus
    };

    if (type === "PROTOTYPE") {
      const slotVal = document.getElementById("bb-batch-proto-slot")?.value;
      if (!slotVal) throw new Error("Aucun emplacement prototype libre.");
      payload.unitNumber = parseInt(slotVal, 10);
      if (isSingle) {
        const ble = document.getElementById("bb-single-ble-input")?.value.trim();
        if (ble) payload.blePasskey = ble;
      }
    } else if (isSingle) {
      const rawCode = document.getElementById("bb-single-code-input")?.value.trim().toUpperCase();
      const num = core.seriesCodeToUnitNumber(rawCode);
      if (num === null) {
        throw new Error(`Code '${rawCode}' invalide. La série débute à A01 et le 00 est exclu.`);
      }
      payload.count = 1;
      payload.startCode = rawCode;

      const ble = document.getElementById("bb-single-ble-input")?.value.trim();
      if (ble) {
        if (!core.isValidBluetoothPasskey(ble)) {
          throw new Error("Le code Bluetooth doit comporter exactement 6 chiffres (passkey BLE).");
        }
        payload.blePasskey = ble;
      }
    } else {
      payload.count = parseInt(document.getElementById("bb-batch-count")?.value || "1", 10);
      const startCode = document.getElementById("bb-batch-start-code")?.value.trim().toUpperCase();
      if (startCode) payload.startCode = startCode;
    }

    const res = await registerFn(payload);
    alert(`✅ ${res.data.count} boîtier(s) enregistré(s) avec succès !`);
    closeNewBatchModal();
    await loadRegistryData();
    await loadUnits();
  } catch (err) {
    alert("❌ Erreur enregistrement : " + err.message);
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

/**
 * Modale Changement de Statut
 */
function openStatusModal(serial, currentStatus) {
  const modal = document.getElementById("bb-modal-status");
  document.getElementById("bb-status-serial").value = serial;
  document.getElementById("bb-status-serial-display").textContent = `${serial} (Actuel : ${core.STATUS_LABELS[currentStatus] || currentStatus})`;

  const select = document.getElementById("bb-status-select");
  if (select) {
    select.textContent = "";
    const allowed = core.manualTransitions(currentStatus);
    allowed.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = core.STATUS_LABELS[s] || s;
      select.appendChild(opt);
    });
  }

  const reasonInput = document.getElementById("bb-status-reason");
  if (reasonInput) reasonInput.value = "";

  if (modal) modal.classList.add("active");
}

function closeStatusModal() {
  document.getElementById("bb-modal-status")?.classList.remove("active");
}

async function handleStatusSubmit(e) {
  e.preventDefault();
  const serial = document.getElementById("bb-status-serial")?.value;
  const newStatus = document.getElementById("bb-status-select")?.value;
  const reason = document.getElementById("bb-status-reason")?.value.trim();

  if (!serial || !newStatus) return;

  try {
    const updateFn = firebase.functions("europe-west1").httpsCallable("adminUpdateBlackboxStatus");
    await updateFn({ serial, newStatus, reason });
    alert("✅ Statut mis à jour.");
    closeStatusModal();
    await loadRegistryData();
    await loadUnits();
  } catch (err) {
    alert("❌ Erreur : " + err.message);
  }
}

/**
 * Modale Attribution
 */
function openAssignModal(serial) {
  const modal = document.getElementById("bb-modal-assign");
  document.getElementById("bb-assign-serial").value = serial;
  document.getElementById("bb-assign-serial-display").textContent = `${serial} (Livraison express < 24h garantie)`;

  const selectOrder = document.getElementById("bb-assign-order-select");
  if (selectOrder) {
    selectOrder.textContent = "";
    if (state.unassignedSales.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Aucune commande client en attente (blackbox_sales)";
      selectOrder.appendChild(opt);
    } else {
      state.unassignedSales.forEach(order => {
        const opt = document.createElement("option");
        opt.value = order.id;
        opt.textContent = `Cmd ${order.id.slice(0, 8)}... - Client ${order.userId ? order.userId.slice(0, 6) + '...' : 'Inconnu'} (${order.type || 'UNIT'})`;
        selectOrder.appendChild(opt);
      });
    }
  }

  if (modal) modal.classList.add("active");
}

function closeAssignModal() {
  document.getElementById("bb-modal-assign")?.classList.remove("active");
}

async function handleAssignSubmit(e) {
  e.preventDefault();
  const serial = document.getElementById("bb-assign-serial")?.value;
  const mode = document.getElementById("bb-assign-mode")?.value;
  const notes = document.getElementById("bb-assign-notes")?.value.trim();

  const payload = { serial, notes };

  if (mode === "ORDER") {
    const orderId = document.getElementById("bb-assign-order-select")?.value;
    if (!orderId) {
      alert("Veuillez sélectionner une commande client.");
      return;
    }
    payload.saleOrderId = orderId;
  } else {
    const manualUid = document.getElementById("bb-assign-manual-uid")?.value.trim();
    if (!manualUid) {
      alert("Veuillez saisir un UID client.");
      return;
    }
    payload.ownerUid = manualUid;
  }

  try {
    const assignFn = firebase.functions("europe-west1").httpsCallable("adminAssignBlackbox");
    await assignFn(payload);
    alert(`✅ Boîtier ${serial} attribué au client avec succès. Livraison sous 24h garantie.`);
    closeAssignModal();
    await loadRegistryData();
    await loadUnits();
    await loadUnassignedSales();
  } catch (err) {
    alert("❌ Erreur attribution : " + err.message);
  }
}

/**
 * Désattribution / Retour en stock
 */
async function handleUnassign(serial) {
  const reason = prompt(`Motif de la désattribution pour le boîtier ${serial} (ex: Rétractation client, SAV) :`);
  if (!reason || reason.trim().length < 5) {
    alert("Un motif d'au moins 5 caractères est requis.");
    return;
  }

  try {
    const unassignFn = firebase.functions("europe-west1").httpsCallable("adminUnassignBlackbox");
    await unassignFn({ serial, reason: reason.trim() });
    alert(`✅ Boîtier ${serial} désattribué et remis en stock.`);
    await loadRegistryData();
    await loadUnits();
    await loadUnassignedSales();
  } catch (err) {
    alert("❌ Erreur désattribution : " + err.message);
  }
}

/**
 * Export CSV Sécurisé (anti-injection formules OWASP)
 */
function exportCSV() {
  if (state.units.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const headers = [
    "Numero_Serie",
    "Code_Bluetooth",
    "Type",
    "Code_Unite",
    "Numero_Unite",
    "Revision_Materielle",
    "Statut",
    "Fabricant",
    "Site_Fabrication",
    "Statut_Partenaire",
    "Garantie_Livraison",
    "Numero_Lot",
    "Date_Fabrication",
    "Adresse_MAC_BLE",
    "Version_Firmware",
    "Proprietaire_UID",
    "Commande_Vente_ID",
    "Type_Garantie",
    "Notes"
  ];

  const rows = state.units.map(u => {
    return [
      core.escapeCSVCell(u.serial),
      core.escapeCSVCell(u.blePasskey || ""),
      core.escapeCSVCell(u.type),
      core.escapeCSVCell(u.unitCode || ""),
      core.escapeCSVCell(u.unitNumber),
      core.escapeCSVCell(u.hwRevision),
      core.escapeCSVCell(u.status),
      core.escapeCSVCell(u.manufacturer || core.DEFAULT_MANUFACTURER),
      core.escapeCSVCell(u.manufacturingSite || core.DEFAULT_MANUFACTURING_SITE),
      core.escapeCSVCell(u.partnerStatus || core.PARTNER_SERIES_STATUS),
      core.escapeCSVCell(u.deliveryGuarantee || core.DELIVERY_GUARANTEE),
      core.escapeCSVCell(u.batchNumber || ""),
      core.escapeCSVCell(u.manufacturedAt?.toDate ? u.manufacturedAt.toDate().toISOString().slice(0, 10) : ""),
      core.escapeCSVCell(u.bleMac || ""),
      core.escapeCSVCell(u.firmwareVersion || ""),
      core.escapeCSVCell(u.ownerUid || ""),
      core.escapeCSVCell(u.saleOrderId || ""),
      core.escapeCSVCell(u.warrantyType || ""),
      core.escapeCSVCell(u.notes || "")
    ].join(",");
  });

  const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registre_blackbox_francelog_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
