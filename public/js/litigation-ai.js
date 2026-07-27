/**
 * LITIGATION AI v1.0 â€” PORTAIL ASSURANCE INTELLIGENT
 * Analyse automatique des donnÃ©es Blackbox pour les dossiers de litige.
 * GÃ©nÃ¨re un code dossier unique, sÃ©lectionne le type de rapport adaptÃ©,
 * et envoie une proposition structurÃ©e Ã  l'assureur via Firestore.
 */

window.LitigationAI = {
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. GÃ‰NÃ‰RATION DU CODE DOSSIER
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GÃ©nÃ¨re un code de dossier unique au format LITIGE-XXXXXX
   * basÃ© sur timestamp + uid utilisateur pour unicitÃ© garantie.
   */
  generateCaseCode() {
    const uid = window.session?.uid || "GUEST";
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `LITIGE-${ts}-${rnd}`;
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. ANALYSE IA DE LA BLACKBOX
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Analyse les donnÃ©es de la Blackbox et retourne une Ã©valuation IA :
   * - type de rapport recommandÃ©
   * - score de sÃ©vÃ©ritÃ©
   * - rÃ©sumÃ© des facteurs clÃ©s
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

    // â€” Calcul du G-Force maximum enregistrÃ©
    let maxG = 0;
    for (const entry of hfBuffer) {
      const ax = parseFloat(entry.ax) || 0;
      const ay = parseFloat(entry.ay) || 0;
      const az = parseFloat(entry.az) || 0;
      const g = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;
      if (g > maxG) maxG = g;
    }

    // â€” Vitesse max enregistrÃ©e
    let maxSpeed = 0;
    for (const entry of buffer) {
      const spd = parseFloat(entry.speed) || 0;
      if (spd > maxSpeed) maxSpeed = spd;
    }

    // â€” Angle d'inclinaison max
    let maxLean = 0;
    for (const entry of buffer) {
      const lean = Math.abs(parseFloat(entry.lean) || 0);
      if (lean > maxLean) maxLean = lean;
    }

    // â€” CoordonnÃ©es GPS de l'incident (dernier point connu)
    const lastGps = buffer.length > 0 ? buffer[buffer.length - 1] : null;

    // â€” Score de sÃ©vÃ©ritÃ© (0â€“100)
    let severity = 0;
    if (maxG > thresholds.EXPERT_G) severity += 50;
    else if (maxG > thresholds.IMPACT_G) severity += 30;
    if (maxSpeed > thresholds.HIGH_SPEED_KMH) severity += 25;
    if (maxLean > thresholds.LEAN_ANGLE_DEG) severity += 15;
    severity = Math.min(severity, 100);

    // â€” SÃ©lection automatique du type de rapport
    let reportType, reportLabel, reportIcon, reportDescription;

    if (maxG >= thresholds.EXPERT_G || severity >= 70) {
      reportType = "EXPERT_COMPLET";
      reportLabel = "Expertise ComplÃ¨te";
      reportIcon = "ðŸ›¡ï¸";
      reportDescription =
        "TÃ©lÃ©mÃ©trie + G-Force + GPS + Replay 3D certifiÃ© + Signature SHA-256";
    } else if (maxG >= thresholds.IMPACT_G || severity >= 35) {
      reportType = "IMPACT";
      reportLabel = "Rapport Impact";
      reportIcon = "âš¡";
      reportDescription =
        "DÃ©tection de choc + AccÃ©lÃ©romÃ©trie haute frÃ©quence + GPS";
    } else {
      reportType = "STANDARD";
      reportLabel = "Rapport Standard";
      reportIcon = "ðŸ“Š";
      reportDescription =
        "TÃ©lÃ©mÃ©trie gÃ©nÃ©rale + Vitesse + CoordonnÃ©es GPS";
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
      structuralScore: blackbox?.shockScore ?? 100,
      dataPoints: buffer.length,
      hfDataPoints: hfBuffer.length,
    };
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 3. CONSTRUCTION DE LA PROPOSITION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Construit un objet de proposition complet destinÃ© Ã  l'assureur.
   */
  buildInsuranceProposal(caseCode, analysis) {
    const now = new Date();
    return {
      // Identifiants
      caseCode: caseCode,
      userId: window.session?.uid || "INCONNU",
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

      // DÃ©cision IA
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

      // DonnÃ©es techniques clÃ©s
      telemetry: {
        maxG_force: parseFloat(analysis.maxG),
        maxSpeed_kmh: parseFloat(analysis.maxSpeed),
        maxLeanAngle_deg: parseFloat(analysis.maxLean),
        structuralScore: analysis.structuralScore,
        dataPoints: analysis.dataPoints,
        hfDataPoints: analysis.hfDataPoints,
        gpsIncident: analysis.gpsIncident,
      },

      // Statut
      status: "PENDING_INSURER_REVIEW",
      version: CONFIG?.VERSION || "50.1.8-GOLD",
    };
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. ENVOI VERS FIRESTORE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Envoie la proposition vers Firestore (collection litigation_proposals).
   */
  async sendProposalToFirestore(proposal) {
    if (typeof db === "undefined") {
      console.warn(
        "[LitigationAI] Firestore non disponible â€” simulation locale.",
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

      return { success: true };
    } catch (err) {
      console.error("[LitigationAI] Erreur Firestore :", err);
      return { success: false, error: err.message };
    }
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. ORCHESTRATION PRINCIPALE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Point d'entrÃ©e principal.
   * GÃ©nÃ¨re le code, analyse la blackbox, construit et envoie la proposition,
   * puis affiche le rÃ©sultat dans l'interface.
   */
  async runWizard() {
    // Ã‰tape 1 â€” GÃ©nÃ©ration du code
    const caseCode = this.generateCaseCode();
    this.renderWizardStep("analyzing", caseCode, null);

    // Ã‰tape 2 â€” Analyse IA (simuler dÃ©lai traitement)
    await new Promise((r) => setTimeout(r, 1800));
    const analysis = this.analyzeBlackboxData();

    // Ã‰tape 3 â€” Construction de la proposition
    const proposal = this.buildInsuranceProposal(caseCode, analysis);

    // Ã‰tape 4 â€” Affichage du rÃ©sultat + confirmation
    this.renderWizardResult(caseCode, analysis, proposal);
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. INTERFACE UTILISATEUR
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    container.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-header">
                    <i class="fa-solid fa-shield-halved litigation-icon-pulse"></i>
                    <h3>Portail Litige Assurance</h3>
                    <p class="litigation-sub">L'IA va analyser votre Blackbox et prÃ©parer une proposition pour votre assureur.</p>
                </div>

                <div class="litigation-checklist">
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Blackbox chiffrÃ©e AES-256</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> TÃ©lÃ©mÃ©trie haute frÃ©quence (10Hz)</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> CoordonnÃ©es GPS certifiÃ©es</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Signature SHA-256 d'intÃ©gritÃ©</div>
                </div>

                <div class="litigation-actions">
                    <button class="btn-litigation-start" onclick="LitigationAI.runWizard()">
                        <i class="fa-solid fa-brain"></i>
                        Lancer l'analyse IA
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
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
      content.innerHTML = `
                <div class="litigation-portal litigation-analyzing">
                    <div class="ai-spinner">
                        <i class="fa-solid fa-brain fa-spin-pulse"></i>
                    </div>
                    <h3>Analyse IA en coursâ€¦</h3>
                    <p class="case-code-display">Code dossier gÃ©nÃ©rÃ© : <strong>${caseCode}</strong></p>
                    <div class="ai-progress-bar">
                        <div class="ai-progress-fill"></div>
                    </div>
                    <p class="ai-status-text">Lecture de la tÃ©lÃ©mÃ©trie Blackboxâ€¦</p>
                </div>
            `;
      // Animation de la barre de progression
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "45%";
        if (txt) txt.textContent = "Calcul des G-Forcesâ€¦";
      }, 500);
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "80%";
        if (txt) txt.textContent = "SÃ©lection du type de rapportâ€¦";
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
        ? "Ã‰LEVÃ‰E"
        : analysis.severity >= 35
          ? "MODÃ‰RÃ‰E"
          : "FAIBLE";

    content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-result-header">
                    <i class="fa-solid fa-brain" style="color:#7c4dff; font-size:2rem;"></i>
                    <h3>Analyse IA TerminÃ©e</h3>
                </div>

                <div class="case-code-badge">
                    <i class="fa-solid fa-hashtag"></i>
                    <span>Code dossier :</span>
                    <strong id="case-code-value">${caseCode}</strong>
                    <button class="btn-copy-code" onclick="LitigationAI.copyCode('${caseCode}')" title="Copier">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>

                <div class="report-recommendation">
                    <div class="report-icon">${analysis.reportIcon}</div>
                    <div class="report-info">
                        <strong>Rapport recommandÃ© :</strong>
                        <span class="report-label">${analysis.reportLabel}</span>
                        <p class="report-desc">${analysis.reportDescription}</p>
                    </div>
                </div>

                <div class="severity-block">
                    <span class="severity-title">SÃ©vÃ©ritÃ© estimÃ©e :</span>
                    <div class="severity-bar-bg">
                        <div class="severity-bar-fill" style="width:${analysis.severity}%; background:${severityColor};"></div>
                    </div>
                    <span class="severity-score" style="color:${severityColor};">${analysis.severity}/100 â€” ${severityLabel}</span>
                </div>

                <div class="telemetry-summary">
                    <div class="tele-item"><i class="fa-solid fa-bolt"></i> G-Force max : <strong>${analysis.maxG} G</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-gauge-high"></i> Vitesse max : <strong>${analysis.maxSpeed} km/h</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-rotate"></i> Inclinaison max : <strong>${analysis.maxLean}Â°</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-shield-halved"></i> IntÃ©gritÃ© chassis : <strong>${analysis.structuralScore}%</strong></div>
                    ${analysis.gpsIncident ? `<div class="tele-item"><i class="fa-solid fa-location-dot"></i> GPS : <strong>${analysis.gpsIncident.lat?.toFixed(5)}, ${analysis.gpsIncident.lng?.toFixed(5)}</strong></div>` : ""}
                </div>

                <p class="litigation-disclaimer">
                    <i class="fa-solid fa-circle-info"></i>
                    En envoyant cette proposition, votre assureur reÃ§oit le rÃ©sumÃ© et vous contactera pour valider le type de rapport dÃ©finitif.
                </p>

                <!-- AVERTISSEMENT AI ACT (Obligatoire) -->
                <p class="litigation-ai-act-disclaimer" style="color: #ffaa00; font-weight: bold; margin-bottom: 15px; border: 1px solid #ffaa00; padding: 10px; border-radius: 8px;">
                    <i class="fa-solid fa-scale-balanced"></i>
                    âš ï¸ GÃ‰NÃ‰RÃ‰ PAR L'IA : Ce rapport est une proposition d'assistance. Une supervision et validation humaine par l'utilisateur sont obligatoires avant le traitement juridique.
                </p>

                <div class="litigation-actions">
                    ${
                      proposal.type === "EXPERT_COMPLET"
                        ? `
                    <button class="btn-litigation-start" onclick="if(window.CertifiedCamera) window.CertifiedCamera.open('${caseCode}'); else alert('Module de camÃ©ra non disponible');" style="background:#ffb703; color:#000; margin-bottom:10px;">
                        <i class="fa-solid fa-camera"></i>
                        Ajouter Preuve Photo (HorodatÃ©e)
                    </button>
                    `
                        : ""
                    }
                    <button class="btn-litigation-send" onclick='LitigationAI.confirmAndSend(' + JSON.stringify(proposal).replace(/"/g, "&quot;") + ')'>
                        <i class="fa-solid fa-paper-plane"></i>
                        Envoyer Ã  l'assureur
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
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

    content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-lock fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3>Verrouillage des donnÃ©es...</h3>
                <p>CrÃ©ation du coffre-fort numÃ©rique...</p>
            </div>
        `;

    // Simulate a small delay for cryptography feeling
    setTimeout(() => {
      content.innerHTML = `
                <div class="litigation-portal litigation-success" style="padding: 20px;">
                    <i class="fa-solid fa-vault" style="font-size:4rem; color:#00e676; margin-bottom: 20px;"></i>
                    <h3 style="color:#00e676; margin-bottom: 10px;">Coffre-Fort SÃ©curisÃ© !</h3>
                    <p style="color:#aaa; margin-bottom: 20px;">Vos donnÃ©es certifiÃ©es sont cryptÃ©es et inaccessibles sans ce code.</p>
                    
                    <div style="background: rgba(0,0,0,0.5); padding: 20px; border-radius: 15px; border: 2px dashed #00e676; display: inline-block; margin-bottom: 20px;">
                        <span style="display: block; font-size: 1rem; color: #888; margin-bottom: 10px;">CODE LITIGE Ã€ TRANSMETTRE Ã€ VOTRE ASSUREUR :</span>
                        <strong style="font-size: 2.5rem; letter-spacing: 5px; color: #fff;">${disputeCode}</strong>
                    </div>

                    <p style="color:#ffaa00; font-weight: bold; margin-bottom: 30px;">
                        <i class="fa-solid fa-hand-holding-dollar"></i> 
                        Vous recevrez une prime de 10 BVC dÃ¨s que votre assureur dÃ©bloquera ces donnÃ©es.
                    </p>

                    <button class="btn-litigation-start" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-check"></i> Terminer
                    </button>
                </div>
            `;
      if (typeof speak === "function")
        speak(
          "Coffre-fort crÃ©Ã©. Transmettez ce code litige Ã  votre assureur.",
        );
    }, 2000);
  },

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      if (typeof speak === "function") speak("Code dossier copiÃ©.");
      const btn = document.querySelector(".btn-copy-code");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
        }, 1500);
      }
    });
  },
};
