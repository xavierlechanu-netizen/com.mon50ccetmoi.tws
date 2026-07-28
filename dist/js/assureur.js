
// Ajout pour la sécurité XSS
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, function(s) {
    const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return entityMap[s];
  });
}

﻿let currentCaseId = null;
let currentReportType = "EXPERT";
let currentPrice = 199.99;
let isEuroAssurance = false;

async function authenticateInsurer() {
  const user = document.getElementById("insurer-username").value.trim();
  const pass = document.getElementById("insurer-password").value;
  const errorEl = document.getElementById("login-error");

  if (!user || !pass) {
    errorEl.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Veuillez saisir votre identifiant et mot de passe.';
    errorEl.style.display = "block";
    return;
  }

  const userLowerNormalized = user
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
  const isEuroAssuranceAttempt =
    userLowerNormalized === "euroassurance" ||
    userLowerNormalized === "euroassurence";

  if (isEuroAssuranceAttempt) {
    const accept = confirm(
      "âš ï¸ ALERTE : Cet organisme est classé 'Partenaire non recommandé' suite à de multiples signalements.\nPour créer un compte ou vous connecter, un tarif de vérification renforcée de 10 000 € est exigé.\n\nAcceptez-vous de payer ces 10 000 € ?",
    );
    if (!accept) {
      errorEl.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> <strong>Accès refusé :</strong> Frais de vérification renforcée de 10 000 € requis pour cet organisme.';
      errorEl.style.display = "block";
      return;
    }
    isEuroAssurance = true;
  }

  try {
    try {
      await firebase.auth().signInWithEmailAndPassword(user, pass);
    } catch (firebaseError) {
      if (
        isEuroAssuranceAttempt &&
        (firebaseError.code === "auth/user-not-found" ||
          firebaseError.code === "auth/wrong-password")
      ) {
        // S'ils ont payé les 10 000€ et que le compte n'existe pas, on le crée
        await firebase.auth().createUserWithEmailAndPassword(user, pass);
      } else {
        throw firebaseError;
      }
    }

    // Succès de l'authentification ou création
    errorEl.style.display = "none";
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("portal-content").style.display = "block";

    if (isEuroAssurance) {
      const portalTitle = document.querySelector("#portal-content h1");
      if (portalTitle) {
        portalTitle.innerHTML +=
          ' <span style="font-size:0.4em; background:#ff8800; color:#fff; padding:5px 10px; border-radius:10px; vertical-align:middle;" title="Partenaire non recommandé - Signalements multiples"><i class="fa-solid fa-triangle-exclamation"></i> Partenaire non recommandé</span>';
      }
    }

    // Feedback vocal (si supporté par l'app principale)
    if (typeof speak === "function") {
      speak("Connexion experte établie. Bienvenue sur le portail.");
    }
  } catch (error) {
    errorEl.innerHTML =
      '<i class="fa-solid fa-shield-cat"></i> <strong>Accès refusé :</strong> Identifiants invalides ou compte inexistant.';
    errorEl.style.display = "block";
    console.error("Auth error:", error);
  }
}

function selectReport(type, price) {
  currentReportType = type;
  currentPrice = price;

  // UI Update
  document
    .querySelectorAll(".report-card")
    .forEach((card) => card.classList.remove("selected"));
  event.currentTarget.classList.add("selected");

  document.getElementById("btn-price").textContent = price.toFixed(2) + "€";
}

async function searchCase() {
  const rawInput = document.getElementById("input-case-code").value.trim();
  const codeInput = rawInput.toUpperCase();
  const statusEl = document.getElementById("status-display");
  const optionsEl = document.getElementById("report-options");
  const payBtn = document.getElementById("btn-pay");

  if (!codeInput) {
    statusEl.innerHTML =
      '<span class="error">Veuillez entrer un code dossier.</span>';
    return;
  }

  statusEl.innerHTML =
    '<span style="color:#0056b3;"><i class="fa-solid fa-spinner fa-spin"></i> Recherche en cours...</span>';
  optionsEl.style.display = "none";
  payBtn.style.display = "none";

  try {
    // Mode DÉMO : Code de test pour les assureurs
    if (codeInput === "LIT-TEST-2026") {
      currentCaseId = codeInput;
      statusEl.innerHTML = `<span style="color:#333;">Dossier <strong>${escapeHTML(codeInput)}</strong> trouvé. Pilote : Pilote Démo.<br>Veuillez choisir le niveau d'expertise souhaité :</span>`;
      optionsEl.style.display = "flex";
      payBtn.style.display = "block";

      if (isEuroAssurance) {
        const reportCards = document.querySelectorAll(".report-card");
        if (reportCards.length >= 3) {
          reportCards[0].style.display = "none";
          reportCards[1].style.display = "none";
          selectReport("EXPERT", 199.99); // Force selection of the most expensive
        }
      }
      return;
    }

    const doc = await db
      .collection("litigation_proposals")
      .doc(codeInput)
      .get();
    if (!doc.exists) {
      statusEl.innerHTML =
        '<span class="error">Dossier introuvable ou expiré.</span>';
      return;
    }

    const data = doc.data();
    currentCaseId = codeInput;

    if (data.payment_status === "PAID") {
      statusEl.innerHTML =
        '<span class="success"><i class="fa-solid fa-check"></i> Ce rapport a déjà été réglé et déverrouillé. Accès autorisé.</span>';
      showExpertTelemetry(currentCaseId, data.report_type || "EXPERT");
      return;
    }

    const div1 = document.createElement("div");
    div1.textContent = codeInput;
    const div2 = document.createElement("div");
    div2.textContent = data.username || "N/A";
    statusEl.innerHTML = `<span style="color:#333;">Dossier <strong>${div1.innerHTML}</strong> trouvé. Pilote : ${div2.innerHTML}.<br>Veuillez choisir le niveau d'expertise souhaité :</span>`;
    optionsEl.style.display = "flex";
    payBtn.style.display = "block";

    if (isEuroAssurance) {
      const reportCards = document.querySelectorAll(".report-card");
      if (reportCards.length >= 3) {
        reportCards[0].style.display = "none"; // Cache Rapport Simple
        reportCards[1].style.display = "none"; // Cache Rapport Intermédiaire
        selectReport("EXPERT", 199.99); // Force l'expertise la plus chère
      }
    }
  } catch (err) {
    console.error(err);
    statusEl.innerHTML =
      '<span class="error">Erreur technique : ' + err.message + "</span>";
  }
}

async function payReport() {
  const statusEl = document.getElementById("status-display");
  const payBtn = document.getElementById("btn-pay");

  if (!currentCaseId) return;

  payBtn.disabled = true;
  payBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Création de l\'ordre...';

  try {
    // Appeler Firebase Function pour créer l'ordre Revolut
    // NOTE: Assurez-vous que l'URL correspond à votre région / projet
    const functionUrl =
      "https://europe-west1-mon50ccetmoi.cloudfunctions.net/createRevolutOrder";

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: Math.round(currentPrice * 100),
        currency: "EUR",
        case_id: currentCaseId,
        report_type: currentReportType,
        user_id: "ASSUREUR",
      }),
    });

    if (!response.ok)
      throw new Error("Erreur de création de commande Revolut.");

    const orderData = await response.json();

    // Lancement de Revolut Checkout (Mode Production)
    const instance = await RevolutCheckout(orderData.order_token, "prod");

    instance.payWithPopup({
      onSuccess: () => {
        statusEl.innerHTML =
          '<span class="success"><i class="fa-solid fa-circle-check"></i> Paiement confirmé ! Le rapport est déverrouillé pour le client et votre agence.</span>';
        document.getElementById("report-options").style.display = "none";
        showExpertTelemetry(currentCaseId, currentReportType);
      },
      onError: (err) => {
        const safeErr = String(err).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        statusEl.innerHTML =
          '<span class="error">Erreur lors du paiement : ' +
          safeErr +
          "</span>";
        payBtn.disabled = false;
        payBtn.innerHTML =
          "Réessayer le paiement " + currentPrice.toFixed(2) + "€";
      },
      onCancel: () => {
        payBtn.disabled = false;
        payBtn.innerHTML =
          "Payer par virement (Revolut) " + currentPrice.toFixed(2) + "€";
      },
    });
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = '<span class="error">' + err.message + "</span>";
    payBtn.disabled = false;
    payBtn.innerHTML =
      "Payer par virement (Revolut) " + currentPrice.toFixed(2) + "€";
  }
}

function showExpertTelemetry(caseId, reportType = "EXPERT") {
  const dashboard = document.getElementById("expert-dashboard");
  if (!dashboard) return;

  // Mettre à jour le titre avec le type de rapport
  const titleEl = document.querySelector("#expert-dashboard h3");
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> TÉLÉMÉTRIE BLACKBOX : <span id="telemetry-id">${caseId}</span> <span style="font-size:0.6em; background:#ffb703; color:#000; padding:2px 8px; border-radius:10px; margin-left:10px; vertical-align:middle;">RAPPORT ${reportType}</span>`;
  }

  // Génération de fausses données d'accident pour la démo
  // Dans une version finale, ces données proviendraient de db.collection('litigation_proposals')

  document.getElementById("telemetry-id").textContent = caseId;
  document.getElementById("telemetry-speed").textContent =
    (Math.random() * (60 - 30) + 30).toFixed(1) + " km/h";
  document.getElementById("telemetry-g").textContent =
    (Math.random() * (8 - 3) + 3).toFixed(2) + " G";
  document.getElementById("telemetry-lean").textContent =
    (Math.random() * 90).toFixed(1) + " °";

  const now = new Date();
  document.getElementById("telemetry-time").textContent =
    now.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  document.getElementById("telemetry-gps").textContent =
    (45.75 + Math.random() * 0.1).toFixed(4) +
    ", " +
    (4.85 + Math.random() * 0.1).toFixed(4);

  // Faux hash cryptographique
  const rawData = caseId + now.toISOString() + "SECRET_KEY";
  const fakeHash =
    "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4";
  document.getElementById("telemetry-hash").textContent = fakeHash;

  dashboard.style.display = "block";

  // Faire scroller jusqu'au tableau de bord
  dashboard.scrollIntoView({ behavior: "smooth" });
}
