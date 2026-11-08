// Portail assureur (assureur.html) : connexion, recherche d'un dossier par son code, vérification
// de l'entreprise par SIREN, paiement Revolut et lecture du rapport scellé.
//
// Rien n'est simulé : le rapport n'est lisible qu'une fois le paiement confirmé par le serveur
// (webhook Revolut → unlocked_for), et les règles Firestore refusent la lecture avant.
// Remplace une ancienne page de démonstration (faux dossier chiffré, « paiement » validé au bout
// de 2 s, clé de démo écrite dans le code), retirée le 8/11/2026.
import { db, auth, firebase } from "./config.js";
import { registerAction } from "./actionRegistry.js";
import { authFetch } from "./api-client.js";
import {
  OFFERS,
  offerByCode,
  ttcCents,
  formatEuros,
  normalizeCaseCode,
  isPreviewExpired,
  hasPaidAccess,
  sealedReportRows,
} from "./insurer-reports.js";

const $ = (id) => document.getElementById(id);

const state = {
  company: null, // { name, siren } une fois l'entreprise vérifiée
  caseCode: null,
  preview: null,
  selected: null, // code de l'offre choisie
  paying: false,
};

function show(id, visible) {
  const el = $(id);
  if (el) el.hidden = !visible;
}

/** Message d'état : kind = "info" | "success" | "error". Texte brut uniquement. */
function setStatus(id, text, kind = "info") {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.className = `status-msg ${text ? kind : ""}`.trim();
}

function functions() {
  return firebase.app().functions("europe-west1");
}

// ──────────────────────────────────────────────
// 1. Connexion
// ──────────────────────────────────────────────

const LOGIN_ERRORS = {
  "auth/invalid-email": "Adresse email invalide.",
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Email ou mot de passe incorrect.",
  "auth/user-disabled": "Ce compte est désactivé. Écrivez à contact@mon50ccetmoi.com.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
  "auth/network-request-failed": "Connexion impossible : vérifiez votre réseau.",
};

async function authenticateInsurer() {
  const email = $("insurer-email").value.trim();
  const password = $("insurer-password").value;
  if (!email || !password) {
    setStatus("login-status", "Saisissez votre email et votre mot de passe.", "error");
    return;
  }
  setStatus("login-status", "Connexion…");
  try {
    await auth.signInWithEmailAndPassword(email, password);
    $("insurer-password").value = "";
    setStatus("login-status", "");
    // La suite est gérée par onAuthStateChanged
  } catch (err) {
    setStatus("login-status", LOGIN_ERRORS[err?.code] || "Connexion impossible. Réessayez.", "error");
  }
}

async function logoutInsurer() {
  await auth.signOut();
}

function resetPortal() {
  state.company = null;
  state.caseCode = null;
  state.preview = null;
  state.selected = null;
  $("input-case-code").value = "";
  setStatus("search-status", "");
  setStatus("pay-status", "");
  show("case-preview", false);
  show("report-view", false);
}

async function onSignedIn(user) {
  $("insurer-account").textContent = user.email || "compte connecté";
  show("login-screen", false);
  show("portal-content", true);
  await loadCompany();
}

// ──────────────────────────────────────────────
// 2. Entreprise (SIREN) : obligatoire pour acheter, elle figure sur la facture
// ──────────────────────────────────────────────

function renderCompany() {
  const c = state.company;
  $("company-name").textContent = c ? `${c.name} (SIREN ${c.siren})` : "non enregistrée";
  show("company-form", !c);
  updatePayButton();
}

async function loadCompany() {
  try {
    const res = await functions().httpsCallable("getInsurerProfile")();
    state.company = res.data && res.data.registered ? res.data : null;
  } catch (err) {
    console.warn("[Assureur] Profil entreprise indisponible :", err);
    state.company = null;
  }
  renderCompany();
}

async function registerCompany() {
  const siren = $("company-siren").value.replace(/\s+/g, "");
  const billingEmail = $("company-billing-email").value.trim();
  if (!/^\d{9}$/.test(siren)) {
    setStatus("company-status", "Le SIREN compte 9 chiffres.", "error");
    return;
  }
  if (!billingEmail) {
    setStatus("company-status", "Indiquez l'adresse email où recevoir les factures.", "error");
    return;
  }
  setStatus("company-status", "Vérification dans l'annuaire officiel des entreprises…");
  try {
    const res = await functions().httpsCallable("registerInsurerProfile")({ siren, billingEmail });
    state.company = res.data;
    setStatus("company-status", `Entreprise vérifiée : ${res.data.name}.`, "success");
    renderCompany();
  } catch (err) {
    setStatus("company-status", err?.message || "Vérification de l'entreprise impossible.", "error");
  }
}

// ──────────────────────────────────────────────
// 3. Recherche du dossier
// ──────────────────────────────────────────────

/** Lit le dossier complet si cet assureur l'a déjà payé, sinon null (lecture refusée avant). */
async function readPaidCase(code) {
  try {
    const doc = await db.collection("litigation_proposals").doc(code).get();
    if (doc.exists && hasPaidAccess(doc.data(), auth.currentUser?.uid)) return doc.data();
  } catch (e) {
    // Refus des règles Firestore : rapport pas encore payé par ce compte
  }
  return null;
}

async function searchCase() {
  const code = normalizeCaseCode($("input-case-code").value);
  show("case-preview", false);
  show("report-view", false);
  setStatus("pay-status", "");
  if (!code) {
    setStatus("search-status", "Code invalide. Format attendu : LITIGE-XXXX-XXXX-XXXX-XXXX.", "error");
    return;
  }
  $("input-case-code").value = code;
  setStatus("search-status", "Recherche du dossier…");

  const paid = await readPaidCase(code);
  if (paid) {
    setStatus("search-status", "Vous avez déjà acheté ce rapport.", "success");
    renderReport(paid);
    return;
  }

  let preview;
  try {
    const doc = await db.collection("litigation_previews").doc(code).get();
    preview = doc.exists ? doc.data() : null;
  } catch (err) {
    console.error("[Assureur] Lecture du dossier :", err);
    setStatus("search-status", "Erreur de connexion à la base. Réessayez.", "error");
    return;
  }
  if (!preview) {
    setStatus("search-status", "Dossier introuvable. Vérifiez le code transmis par le conducteur.", "error");
    return;
  }
  if (isPreviewExpired(preview)) {
    setStatus("search-status", "Code expiré (valable 72 h). Le conducteur doit en générer un nouveau depuis son application.", "error");
    return;
  }

  state.caseCode = code;
  state.preview = preview;
  state.selected = offerByCode(preview.recommendedReport) ? preview.recommendedReport : "SIMPLE";
  setStatus("search-status", "Dossier trouvé.", "success");
  renderPreview();
}

function renderPreview() {
  const p = state.preview;
  $("preview-date").textContent = p.dateLabel || "—";
  $("preview-severity").textContent = p.severityLabel || "—";
  $("preview-recommended").textContent = offerByCode(p.recommendedReport)?.label || "—";
  renderOffers();
  show("case-preview", true);
}

function renderOffers() {
  const list = $("report-options");
  list.replaceChildren();
  for (const offer of OFFERS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "report-card";
    card.setAttribute("data-action", `selectReport('${offer.code}')`);
    card.setAttribute("aria-pressed", String(offer.code === state.selected));
    if (offer.code === state.selected) card.classList.add("selected");

    const info = document.createElement("span");
    info.className = "report-info";
    const title = document.createElement("strong");
    title.textContent = offer.label;
    info.appendChild(title);
    if (offer.code === state.preview?.recommendedReport) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Conseillé";
      info.appendChild(badge);
    }

    const price = document.createElement("span");
    price.className = "report-price";
    const ht = document.createElement("span");
    ht.textContent = `${formatEuros(offer.htCents)} € HT`;
    const ttc = document.createElement("small");
    ttc.textContent = `${formatEuros(ttcCents(offer.htCents))} € TTC`;
    price.append(ht, ttc);

    card.append(info, price);
    list.appendChild(card);
  }
  updatePayButton();
}

function selectReport(code) {
  if (!offerByCode(code) || state.paying) return;
  state.selected = code;
  renderOffers();
}

function updatePayButton() {
  const btn = $("btn-pay");
  if (!btn) return;
  const offer = offerByCode(state.selected);
  btn.textContent = offer
    ? `Payer ${formatEuros(ttcCents(offer.htCents))} € TTC avec Revolut`
    : "Payer avec Revolut";
  btn.disabled = state.paying || !offer || !state.company;
  show("pay-needs-company", !state.company);
}

// ──────────────────────────────────────────────
// 4. Paiement Revolut, puis attente de la confirmation du serveur
// ──────────────────────────────────────────────

async function waitForRevolutSdk() {
  for (let i = 0; i < 10 && typeof window.RevolutCheckout !== "function"; i++) {
    await new Promise((r) => setTimeout(r, 300));
  }
  if (typeof window.RevolutCheckout !== "function") {
    throw new Error("Module de paiement Revolut non chargé. Vérifiez votre connexion.");
  }
}

async function payReport() {
  const offer = offerByCode(state.selected);
  if (!offer || !state.caseCode || state.paying) return;
  if (!state.company) {
    setStatus("pay-status", "Enregistrez d'abord le SIREN de votre entreprise : il figure sur la facture.", "error");
    return;
  }
  const code = state.caseCode;
  const ttc = ttcCents(offer.htCents);
  const ok = window.confirm(
    `${offer.label} — dossier ${code}\n\n` +
      `${formatEuros(offer.htCents)} € HT + TVA 20 % = ${formatEuros(ttc)} € TTC\n` +
      `Facturé à : ${state.company.name} (SIREN ${state.company.siren})\n\n` +
      "Le rapport sera accessible dès la confirmation du paiement par Revolut.",
  );
  if (!ok) return;

  state.paying = true;
  updatePayButton();
  setStatus("pay-status", "Création de la commande…");
  try {
    const order = await authFetch("createRevolutOrder", {
      method: "POST",
      body: { case_id: code, report_type: offer.code },
    });
    if (!order?.order_token) throw new Error("Commande Revolut non créée. Réessayez.");
    await waitForRevolutSdk();
    const checkout = await window.RevolutCheckout(order.order_token, "prod");
    setStatus("pay-status", "Paiement en cours dans la fenêtre Revolut…");
    checkout.payWithPopup({
      onSuccess: () => waitForUnlock(code),
      onError: (message) => endPayment(`Paiement refusé : ${message || "erreur Revolut"}.`, "error"),
      onCancel: () => endPayment("Paiement annulé.", "info"),
    });
  } catch (err) {
    if (err?.status === 409) {
      // Déjà acheté par ce compte : on ouvre directement le rapport
      endPayment("");
      await searchCase();
      return;
    }
    if (err?.details?.code === "INSURER_PROFILE_REQUIRED") {
      state.company = null;
      renderCompany();
    }
    endPayment(err?.message || "Paiement impossible. Réessayez.", "error");
  }
}

function endPayment(message, kind) {
  state.paying = false;
  updatePayButton();
  setStatus("pay-status", message, kind);
}

/** Le serveur débloque le rapport à réception du webhook Revolut : on relit le dossier. */
async function waitForUnlock(code, attempts = 20) {
  setStatus("pay-status", "Paiement accepté. Attente de la confirmation du serveur…");
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const paid = await readPaidCase(code);
    if (paid) {
      endPayment("Paiement confirmé.", "success");
      renderReport(paid);
      return;
    }
  }
  endPayment(
    "Paiement accepté, confirmation encore en attente. Recherchez à nouveau le dossier dans quelques minutes ; " +
      "en cas de problème, écrivez à contact@mon50ccetmoi.com avec le code du dossier.",
    "info",
  );
}

// ──────────────────────────────────────────────
// 5. Rapport scellé (texte brut uniquement)
// ──────────────────────────────────────────────

function renderReport(data) {
  const tbody = $("report-rows");
  tbody.replaceChildren();
  for (const [label, value] of sealedReportRows(data, auth.currentUser?.uid)) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    const td = document.createElement("td");
    td.textContent = String(value);
    tr.append(th, td);
    tbody.appendChild(tr);
  }
  show("case-preview", false);
  show("report-view", true);
}

// ──────────────────────────────────────────────

registerAction("authenticateInsurer", authenticateInsurer);
registerAction("logoutInsurer", logoutInsurer);
registerAction("registerCompany", registerCompany);
registerAction("searchCase", searchCase);
registerAction("selectReport", selectReport);
registerAction("payReport", payReport);

auth.onAuthStateChanged((user) => {
  if (user) {
    onSignedIn(user);
  } else {
    resetPortal();
    show("portal-content", false);
    show("login-screen", true);
  }
});
