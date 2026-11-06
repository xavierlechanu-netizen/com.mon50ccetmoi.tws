import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { IGNCarto, escapeHtml } from './ign-carto.js';

/**
 * LITIGATION AI v1.1 — PORTAIL ASSURANCE INTELLIGENT + IGN API CARTO v2.10.5
 * Analyse automatique des données Blackbox et qualification cadastrale/routière IGN
 * (Parcellaire Express PCI, Limites Administratives, GpU, BD TOPO, Nature MNHN)
 * pour les dossiers de litige.
 */

window.LitigationAI = {
  // ─────────────────────────────────────────────
  // 1. GÉNÉRATION DU CODE DOSSIER
  // ─────────────────────────────────────────────

  /**
   * Génère un code de dossier unique au format LITIGE-XXXXXX
   * basé sur timestamp + uid utilisateur pour unicité garantie.
   */
  /** Niveau de rapport de l'IA → code du catalogue de prix (functions/api/payments-catalog.js). */
  toCatalogType(aiType) {
    return { EXPERT_COMPLET: "EXPERT", IMPACT: "INTERMEDIAIRE", STANDARD: "SIMPLE" }[aiType] || "SIMPLE";
  },

  generateCaseCode() {
    // 16 caractères tirés au hasard par le générateur cryptographique du navigateur
    // (≈ 80 bits) : impossible à deviner, contrairement à l'ancien « heure + 3 caractères ».
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I, faciles à confondre
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    return `LITIGE-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12)}`;
  },

  // ─────────────────────────────────────────────
  // 2. ANALYSE IA DE LA BLACKBOX
  // ─────────────────────────────────────────────

  /**
   * Analyse les données de la Blackbox et retourne une évaluation IA :
   * - type de rapport recommandé
   * - score de sévérité
   * - résumé des facteurs clés
   */
  analyzeBlackboxData() {
    const thresholds = CONFIG?.INSURANCE?.AI_THRESHOLDS || {
      IMPACT_G: 3.5,
      EXPERT_G: 5.0,
      HIGH_SPEED_KMH: 60,
      LEAN_ANGLE_DEG: 35,
    };

    const blackbox = window.Blackbox;
    const buffer = blackbox?.buffer || [];
    const hfBuffer = blackbox?.hfBuffer || [];

    // — Calcul du G-Force maximum enregistré
    let maxG = 0;
    for (const entry of hfBuffer) {
      const ax = parseFloat(entry.ax) || 0;
      const ay = parseFloat(entry.ay) || 0;
      const az = parseFloat(entry.az) || 0;
      const g = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;
      if (g > maxG) maxG = g;
    }

    // — Vitesse max enregistrée
    let maxSpeed = 0;
    for (const entry of buffer) {
      const spd = parseFloat(entry.speed) || 0;
      if (spd > maxSpeed) maxSpeed = spd;
    }

    // — Angle d'inclinaison max
    let maxLean = 0;
    for (const entry of buffer) {
      const lean = Math.abs(parseFloat(entry.lean) || 0);
      if (lean > maxLean) maxLean = lean;
    }

    // — Coordonnées GPS de l'incident (dernier point connu ou position courante carte)
    const lastGps =
      buffer.length > 0
        ? buffer[buffer.length - 1]
        : window.appMap?.currentPos || null;

    // — Score de sévérité (0–100)
    let severity = 0;
    if (maxG > thresholds.EXPERT_G) severity += 50;
    else if (maxG > thresholds.IMPACT_G) severity += 30;
    if (maxSpeed > thresholds.HIGH_SPEED_KMH) severity += 25;
    if (maxLean > thresholds.LEAN_ANGLE_DEG) severity += 15;
    severity = Math.min(severity, 100);

    // — Sélection automatique du type de rapport
    let reportType, reportLabel, reportIcon, reportDescription;

    if (maxG >= thresholds.EXPERT_G || severity >= 70) {
      reportType = "EXPERT_COMPLET";
      reportLabel = "Expertise Complète";
      reportIcon = "🛡️";
      reportDescription =
        "Télémétrie + G-Force + GPS + Cadastre IGN PCI + Replay 3D certifié + Signature SHA-256";
    } else if (maxG >= thresholds.IMPACT_G || severity >= 35) {
      reportType = "IMPACT";
      reportLabel = "Rapport Impact";
      reportIcon = "⚡";
      reportDescription =
        "Détection de choc + Accélérométrie haute fréquence + GPS + Qualification Cadastrale IGN";
    } else {
      reportType = "STANDARD";
      reportLabel = "Rapport Standard";
      reportIcon = "📊";
      reportDescription =
        "Télémétrie générale + Vitesse + Coordonnées GPS + Commune IGN";
    }

    return {
      reportType,
      reportLabel,
      reportIcon,
      reportDescription,
      severity,
      maxG: maxG.toFixed(2),
      maxSpeed: maxSpeed.toFixed(1),
      maxLean: maxLean.toFixed(1),
      gpsIncident: lastGps ? { lat: lastGps.lat, lng: lastGps.lng } : null,
      ignCadastre: null,
      structuralScore: blackbox?.shockScore ?? 100,
      dataPoints: buffer.length,
      hfDataPoints: hfBuffer.length,
    };
  },

  // ─────────────────────────────────────────────
  // 3. CONSTRUCTION DE LA PROPOSITION
  // ─────────────────────────────────────────────

  /**
   * Construit un objet de proposition complet destiné à l'assureur.
   */
  buildInsuranceProposal(caseCode, analysis) {
    const now = new Date();
    return {
      // Identifiants
      caseCode: caseCode,
      userId: window.auth?.currentUser?.uid || window.session?.uid || "INCONNU",
      username: window.session?.username || "INCONNU",
      vehicleId: window.Wallet?.getSafetyPassport()?.blackbox_id || "N/A",

      // Horodatage
      submittedAt: now.toISOString(),
      dateLabel: now.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),

      // Décision IA
      ai: {
        recommendedReport: analysis.reportType,
        reportLabel: analysis.reportLabel,
        reportDescription: analysis.reportDescription,
        severityScore: analysis.severity,
        confidence:
          analysis.severity >= 70
            ? "HAUTE"
            : analysis.severity >= 35
              ? "MOYENNE"
              : "STANDARD",
      },

      // Données techniques clés + Qualification IGN API Carto v2.10.5
      telemetry: {
        maxG_force: parseFloat(analysis.maxG),
        maxSpeed_kmh: parseFloat(analysis.maxSpeed),
        maxLeanAngle_deg: parseFloat(analysis.maxLean),
        structuralScore: analysis.structuralScore,
        dataPoints: analysis.dataPoints,
        hfDataPoints: analysis.hfDataPoints,
        gpsIncident: analysis.gpsIncident,
        ignCadastre: analysis.ignCadastre || null,
      },

      // Statut
      status: "PENDING_INSURER_REVIEW",
      version: CONFIG?.VERSION || "50.1.8-GOLD",
    };
  },

  // ─────────────────────────────────────────────
  // 4. ENVOI VERS FIRESTORE
  // ─────────────────────────────────────────────

  /**
   * Envoie la proposition vers Firestore (collection litigation_proposals).
   */
  async sendProposalToFirestore(proposal) {
    if (typeof db === "undefined") {
      console.warn(
        "[LitigationAI] Firestore non disponible — simulation locale.",
      );
      return { success: true, simulated: true };
    }

    const collection =
      CONFIG?.INSURANCE?.FIRESTORE_COLLECTION || "litigation_proposals";
    try {
      await db
        .collection(collection)
        .doc(proposal.caseCode)
        .set({
          ...proposal,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

      // Aperçu sans données de conduite : c'est tout ce que l'assureur voit avant de payer
      const severity = Number(proposal.ai?.severityScore) || 0;
      await db.collection("litigation_previews").doc(proposal.caseCode).set({
        caseCode: proposal.caseCode,
        userId: proposal.userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: Date.now() + 72 * 3600 * 1000,
        recommendedReport: window.LitigationAI.toCatalogType(proposal.ai?.recommendedReport),
        reportLabel: proposal.ai?.reportLabel || "Rapport Standard",
        severityLabel: severity >= 70 ? "Choc important" : severity >= 40 ? "Choc modéré" : "Choc léger",
        dateLabel: proposal.dateLabel || "",
      });

      return { success: true };
    } catch (err) {
      console.error("[LitigationAI] Erreur Firestore :", err);
      return { success: false, error: err.message };
    }
  },

  // ─────────────────────────────────────────────
  // 5. ORCHESTRATION PRINCIPALE
  // ─────────────────────────────────────────────

  /**
   * Point d'entrée principal.
   * Génère le code, analyse la blackbox, interroge l'API Carto IGN (Cadastre PCI Express),
   * construit la proposition et affiche le résultat dans l'interface.
   */
  async runWizard() {
    // Étape 1 — Génération du code
    const caseCode = this.generateCaseCode();
    this.renderWizardStep("analyzing", caseCode, null);

    // Étape 2 — Analyse IA + Qualification Cadastrale IGN en parallèle
    const analysis = this.analyzeBlackboxData();
    const delayPromise = new Promise((r) => setTimeout(r, 1800));
    const ignPromise =
      analysis.gpsIncident && IGNCarto?.qualifyIncidentLocation
        ? IGNCarto.qualifyIncidentLocation(
            analysis.gpsIncident.lat,
            analysis.gpsIncident.lng,
          ).catch(() => null)
        : Promise.resolve(null);

    const [, ignResult] = await Promise.all([delayPromise, ignPromise]);
    if (ignResult) {
      analysis.ignCadastre = ignResult;
    }

    // Étape 3 — Construction de la proposition
    const proposal = this.buildInsuranceProposal(caseCode, analysis);

    // Étape 4 — Affichage du résultat + confirmation
    this.renderWizardResult(caseCode, analysis, proposal);
  },

  // ─────────────────────────────────────────────
  // 6. INTERFACE UTILISATEUR
  // ─────────────────────────────────────────────

  /**
   * Affiche le portail du wizard dans l'overlay existant.
   */
  openPortal() {
    const overlay = document.getElementById("screen-overlay");
    const content = document.getElementById("screen-content");
    if (!overlay || !content) {
      console.error("[LitigationAI] Overlay introuvable.");
      return;
    }
    overlay.classList.remove("hidden");
    this.renderWizardIntro(content);
  },

  renderWizardIntro(container) {
    // eslint-disable-next-line no-restricted-syntax
    container.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-header">
                    <i class="fa-solid fa-shield-halved litigation-icon-pulse"></i>
                    <h3>Portail Litige Assurance</h3>
                    <p class="litigation-sub">L'IA va analyser votre Blackbox, qualifier le lieu via l'API Carto IGN (Cadastre PCI Express) et préparer une proposition pour votre assureur.</p>
                </div>

                <div class="litigation-checklist">
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Blackbox chiffrée AES-256</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Télémétrie haute fréquence (10Hz)</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Coordonnées GPS &amp; Cadastre IGN PCI Express</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Signature SHA-256 d'intégrité</div>
                </div>

                <div class="litigation-actions">
                    <button class="btn-litigation-start" data-action="LitigationAI.runWizard()">
                        <i class="fa-solid fa-brain"></i>
                        Lancer l'analyse IA
                    </button>
                    <button class="btn-close-litigation" data-action="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-times"></i> Annuler
                    </button>
                </div>
            </div>
        `;
  },

  renderWizardStep(step, caseCode, analysis) {
    const content = document.getElementById("screen-content");
    if (!content) return;

    if (step === "analyzing") {
      // eslint-disable-next-line no-restricted-syntax
      content.innerHTML = `
                <div class="litigation-portal litigation-analyzing">
                    <div class="ai-spinner">
                        <i class="fa-solid fa-brain fa-spin-pulse"></i>
                    </div>
                    <h3>Analyse IA en cours…</h3>
                    <p class="case-code-display">Code dossier généré : <strong>${escapeHtml(caseCode)}</strong></p>
                    <div class="ai-progress-bar">
                        <div class="ai-progress-fill"></div>
                    </div>
                    <p class="ai-status-text">Lecture de la télémétrie Blackbox…</p>
                </div>
            `;
      // Animation de la barre de progression
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "45%";
        if (txt) txt.textContent = "Calcul des G-Forces & Interrogation Cadastre IGN…";
      }, 500);
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "80%";
        if (txt) txt.textContent = "Sélection du type de rapport…";
      }, 1200);
    }
  },

  renderWizardResult(caseCode, analysis, proposal) {
    const content = document.getElementById("screen-content");
    if (!content) return;

    const severityColor =
      analysis.severity >= 70
        ? "#ff4d4d"
        : analysis.severity >= 35
          ? "#ffaa00"
          : "#00e676";
    const severityLabel =
      analysis.severity >= 70
        ? "ÉLEVÉE"
        : analysis.severity >= 35
          ? "MODÉRÉE"
          : "FAIBLE";

    const ign = analysis.ignCadastre;
    const ignHtml =
      ign && ign.available
        ? `
          <div class="tele-item"><i class="fa-solid fa-city"></i> Commune IGN : <strong>${escapeHtml(ign.commune || "N/A")} (${escapeHtml(ign.codeInsee || "N/A")})</strong></div>
          <div class="tele-item"><i class="fa-solid fa-road"></i> Domaine (PCI) : <strong>${escapeHtml(ign.domainLabel)}</strong></div>
          ${ign.urbanZone ? `<div class="tele-item"><i class="fa-solid fa-building"></i> Zonage GpU : <strong>${escapeHtml(ign.urbanZone.typezone)}</strong></div>` : ""}
        `
        : "";

    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-result-header">
                    <i class="fa-solid fa-brain" style="color:#7c4dff; font-size:2rem;"></i>
                    <h3>Analyse IA Terminée</h3>
                </div>

                <div class="case-code-badge">
                    <i class="fa-solid fa-hashtag"></i>
                    <span>Code dossier :</span>
                    <strong id="case-code-value">${escapeHtml(caseCode)}</strong>
                    <button class="btn-copy-code" data-action="LitigationAI.copyCode('${escapeHtml(caseCode)}')" title="Copier">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>

                <div class="report-recommendation">
                    <div class="report-icon">${analysis.reportIcon}</div>
                    <div class="report-info">
                        <strong>Rapport recommandé :</strong>
                        <span class="report-label">${escapeHtml(analysis.reportLabel)}</span>
                        <p class="report-desc">${escapeHtml(analysis.reportDescription)}</p>
                    </div>
                </div>

                <div class="severity-block">
                    <span class="severity-title">Sévérité estimée :</span>
                    <div class="severity-bar-bg">
                        <div class="severity-bar-fill" style="width:${analysis.severity}%; background:${severityColor};"></div>
                    </div>
                    <span class="severity-score" style="color:${severityColor};">${analysis.severity}/100 — ${severityLabel}</span>
                </div>

                <div class="telemetry-summary">
                    <div class="tele-item"><i class="fa-solid fa-bolt"></i> G-Force max : <strong>${escapeHtml(analysis.maxG)} G</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-gauge-high"></i> Vitesse max : <strong>${escapeHtml(analysis.maxSpeed)} km/h</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-rotate"></i> Inclinaison max : <strong>${escapeHtml(analysis.maxLean)}°</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-shield-halved"></i> Intégrité chassis : <strong>${escapeHtml(analysis.structuralScore)}%</strong></div>
                    ${analysis.gpsIncident ? `<div class="tele-item"><i class="fa-solid fa-location-dot"></i> GPS : <strong>${Number(analysis.gpsIncident.lat).toFixed(5)}, ${Number(analysis.gpsIncident.lng).toFixed(5)}</strong></div>` : ""}
                    ${ignHtml}
                </div>

                <p class="litigation-disclaimer">
                    <i class="fa-solid fa-circle-info"></i>
                    En envoyant cette proposition, votre assureur reçoit le résumé et vous contactera pour valider le type de rapport définitif.
                </p>

                <!-- AVERTISSEMENT AI ACT (Obligatoire) -->
                <p class="litigation-ai-act-disclaimer" style="color: #ffaa00; font-weight: bold; margin-bottom: 15px; border: 1px solid #ffaa00; padding: 10px; border-radius: 8px;">
                    <i class="fa-solid fa-scale-balanced"></i>
                    ⚠️ GÉNÉRÉ PAR L'IA : Ce rapport est une proposition d'assistance. Une supervision et validation humaine par l'utilisateur sont obligatoires avant le traitement juridique.
                </p>

                <div class="litigation-actions">
                    ${
                      proposal.type === "EXPERT_COMPLET"
                        ? `
                    <button class="btn-litigation-start" data-action="if(window.CertifiedCamera) window.CertifiedCamera.open('${escapeHtml(caseCode)}'); else alert('Module de caméra non disponible');" style="background:#ffb703; color:#000; margin-bottom:10px;">
                        <i class="fa-solid fa-camera"></i>
                        Ajouter Preuve Photo (Horodatée)
                    </button>
                    `
                        : ""
                    }
                    <button class="btn-litigation-send" data-action='LitigationAI.confirmAndSend(' + JSON.stringify(proposal).replace(/"/g, "&quot;") + ')'>
                        <i class="fa-solid fa-paper-plane"></i>
                        Envoyer à l'assureur
                    </button>
                    <button class="btn-close-litigation" data-action="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-times"></i> Annuler
                    </button>
                </div>
            </div>
        `;
  },

  async confirmAndSend(proposal) {
    const content = document.getElementById("screen-content");
    if (!content) return;

    // Generate a secure dispute code
    const disputeCode =
      "LIT-" +
      Math.floor(1000 + Math.random() * 9000) +
      "-" +
      new Date().getFullYear();

    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-lock fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3>Verrouillage des données...</h3>
                <p>Création du coffre-fort numérique...</p>
            </div>
        `;

    // Simulate a small delay for cryptography feeling
    setTimeout(() => {
      // eslint-disable-next-line no-restricted-syntax
      content.innerHTML = `
                <div class="litigation-portal litigation-success" style="padding: 20px;">
                    <i class="fa-solid fa-vault" style="font-size:4rem; color:#00e676; margin-bottom: 20px;"></i>
                    <h3 style="color:#00e676; margin-bottom: 10px;">Coffre-Fort Sécurisé !</h3>
                    <p style="color:#aaa; margin-bottom: 20px;">Vos données certifiées sont cryptées et inaccessibles sans ce code.</p>
                    
                    <div style="background: rgba(0,0,0,0.5); padding: 20px; border-radius: 15px; border: 2px dashed #00e676; display: inline-block; margin-bottom: 20px;">
                        <span style="display: block; font-size: 1rem; color: #888; margin-bottom: 10px;">CODE LITIGE À TRANSMETTRE À VOTRE ASSUREUR :</span>
                        <strong style="font-size: 2.5rem; letter-spacing: 5px; color: #fff;">${escapeHtml(disputeCode)}</strong>
                    </div>

                    <p style="color:#ffaa00; font-weight: bold; margin-bottom: 30px;">
                        <i class="fa-solid fa-hand-holding-dollar"></i> 
                        Vous recevrez une prime de 10 points mon50cc dès que votre assureur débloquera ces données.
                    </p>

                    <button class="btn-litigation-start" data-action="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-check"></i> Terminer
                    </button>
                </div>
            `;
      if (typeof speak === "function")
        speak(
          "Coffre-fort créé. Transmettez ce code litige à votre assureur.",
        );
    }, 2000);
  },

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      if (typeof speak === "function") speak("Code dossier copié.");
      const btn = document.querySelector(".btn-copy-code");
      if (btn) {
        // eslint-disable-next-line no-restricted-syntax
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
          // eslint-disable-next-line no-restricted-syntax
          btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
        }, 1500);
      }
    });
  },
};
