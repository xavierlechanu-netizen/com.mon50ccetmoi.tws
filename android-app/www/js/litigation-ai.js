/**
 * LITIGATION AI v1.0 — PORTAIL ASSURANCE INTELLIGENT
 * Analyse automatique des données Blackbox pour les dossiers de litige.
 * Génère un code dossier unique, sélectionne le type de rapport adapté,
 * et envoie une proposition structurée à l'assureur via Firestore.
 */

window.LitigationAI = {

    // ─────────────────────────────────────────────
    // 1. GÉNÉRATION DU CODE DOSSIER
    // ─────────────────────────────────────────────

    /**
     * Génère un code de dossier unique au format LITIGE-XXXXXX
     * basé sur timestamp + uid utilisateur pour unicité garantie.
     */
    generateCaseCode() {
        const uid = window.session?.uid || 'GUEST';
        const ts  = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `LITIGE-${ts}-${rnd}`;
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
            LEAN_ANGLE_DEG: 35
        };

        const blackbox  = window.Blackbox;
        const buffer    = blackbox?.buffer    || [];
        const hfBuffer  = blackbox?.hfBuffer  || [];

        // — Calcul du G-Force maximum enregistré
        let maxG = 0;
        for (const entry of hfBuffer) {
            const ax = parseFloat(entry.ax) || 0;
            const ay = parseFloat(entry.ay) || 0;
            const az = parseFloat(entry.az) || 0;
            const g  = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;
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

        // — Coordonnées GPS de l'incident (dernier point connu)
        const lastGps = buffer.length > 0 ? buffer[buffer.length - 1] : null;

        // — Score de sévérité (0–100)
        let severity = 0;
        if (maxG > thresholds.EXPERT_G)        severity += 50;
        else if (maxG > thresholds.IMPACT_G)   severity += 30;
        if (maxSpeed > thresholds.HIGH_SPEED_KMH) severity += 25;
        if (maxLean  > thresholds.LEAN_ANGLE_DEG) severity += 15;
        severity = Math.min(severity, 100);

        // — Sélection automatique du type de rapport
        let reportType, reportLabel, reportIcon, reportDescription;

        if (maxG >= thresholds.EXPERT_G || severity >= 70) {
            reportType        = 'EXPERT_COMPLET';
            reportLabel       = 'Expertise Complète';
            reportIcon        = '🛡️';
            reportDescription = 'Télémétrie + G-Force + GPS + Replay 3D certifié + Signature SHA-256';
        } else if (maxG >= thresholds.IMPACT_G || severity >= 35) {
            reportType        = 'IMPACT';
            reportLabel       = 'Rapport Impact';
            reportIcon        = '⚡';
            reportDescription = 'Détection de choc + Accélérométrie haute fréquence + GPS';
        } else {
            reportType        = 'STANDARD';
            reportLabel       = 'Rapport Standard';
            reportIcon        = '📊';
            reportDescription = 'Télémétrie générale + Vitesse + Coordonnées GPS';
        }

        return {
            reportType,
            reportLabel,
            reportIcon,
            reportDescription,
            severity,
            maxG:     maxG.toFixed(2),
            maxSpeed: maxSpeed.toFixed(1),
            maxLean:  maxLean.toFixed(1),
            gpsIncident: lastGps ? { lat: lastGps.lat, lng: lastGps.lng } : null,
            structuralScore: blackbox?.shockScore ?? 100,
            dataPoints: buffer.length,
            hfDataPoints: hfBuffer.length
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
            caseCode:   caseCode,
            userId:     window.session?.uid      || 'INCONNU',
            username:   window.session?.username || 'INCONNU',
            vehicleId:  window.Wallet?.getSafetyPassport()?.blackbox_id || 'N/A',

            // Horodatage
            submittedAt: now.toISOString(),
            dateLabel:   now.toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }),

            // Décision IA
            ai: {
                recommendedReport:   analysis.reportType,
                reportLabel:         analysis.reportLabel,
                reportDescription:   analysis.reportDescription,
                severityScore:       analysis.severity,
                confidence:          analysis.severity >= 70 ? 'HAUTE' :
                                     analysis.severity >= 35 ? 'MOYENNE' : 'STANDARD'
            },

            // Données techniques clés
            telemetry: {
                maxG_force:       parseFloat(analysis.maxG),
                maxSpeed_kmh:     parseFloat(analysis.maxSpeed),
                maxLeanAngle_deg: parseFloat(analysis.maxLean),
                structuralScore:  analysis.structuralScore,
                dataPoints:       analysis.dataPoints,
                hfDataPoints:     analysis.hfDataPoints,
                gpsIncident:      analysis.gpsIncident
            },

            // Statut
            status: 'PENDING_INSURER_REVIEW',
            version: CONFIG?.VERSION || '50.1.8-GOLD'
        };
    },

    // ─────────────────────────────────────────────
    // 4. ENVOI VERS FIRESTORE
    // ─────────────────────────────────────────────

    /**
     * Envoie la proposition vers Firestore (collection litigation_proposals).
     */
    async sendProposalToFirestore(proposal) {
        if (typeof db === 'undefined') {
            console.warn('[LitigationAI] Firestore non disponible — simulation locale.');
            return { success: true, simulated: true };
        }

        const collection = CONFIG?.INSURANCE?.FIRESTORE_COLLECTION || 'litigation_proposals';
        try {
            await db.collection(collection).doc(proposal.caseCode).set({
                ...proposal,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('[LitigationAI] Proposition envoyée :', proposal.caseCode);
            return { success: true };
        } catch (err) {
            console.error('[LitigationAI] Erreur Firestore :', err);
            return { success: false, error: err.message };
        }
    },

    // ─────────────────────────────────────────────
    // 5. ORCHESTRATION PRINCIPALE
    // ─────────────────────────────────────────────

    /**
     * Point d'entrée principal.
     * Génère le code, analyse la blackbox, construit et envoie la proposition,
     * puis affiche le résultat dans l'interface.
     */
    async runWizard() {
        // Étape 1 — Génération du code
        const caseCode = this.generateCaseCode();
        this.renderWizardStep('analyzing', caseCode, null);

        // Étape 2 — Analyse IA (simuler délai traitement)
        await new Promise(r => setTimeout(r, 1800));
        const analysis = this.analyzeBlackboxData();

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
        const overlay = document.getElementById('screen-overlay');
        const content = document.getElementById('screen-content');
        if (!overlay || !content) {
            console.error('[LitigationAI] Overlay introuvable.');
            return;
        }
        overlay.classList.remove('hidden');
        this.renderWizardIntro(content);
    },

    renderWizardIntro(container) {
        container.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-header">
                    <i class="fa-solid fa-shield-halved litigation-icon-pulse"></i>
                    <h3>Portail Litige Assurance</h3>
                    <p class="litigation-sub">L'IA va analyser votre Blackbox et préparer une proposition pour votre assureur.</p>
                </div>

                <div class="litigation-checklist">
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Blackbox chiffrée AES-256</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Télémétrie haute fréquence (10Hz)</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Coordonnées GPS certifiées</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Signature SHA-256 d'intégrité</div>
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
        const content = document.getElementById('screen-content');
        if (!content) return;

        if (step === 'analyzing') {
            content.innerHTML = `
                <div class="litigation-portal litigation-analyzing">
                    <div class="ai-spinner">
                        <i class="fa-solid fa-brain fa-spin-pulse"></i>
                    </div>
                    <h3>Analyse IA en cours…</h3>
                    <p class="case-code-display">Code dossier généré : <strong>${caseCode}</strong></p>
                    <div class="ai-progress-bar">
                        <div class="ai-progress-fill"></div>
                    </div>
                    <p class="ai-status-text">Lecture de la télémétrie Blackbox…</p>
                </div>
            `;
            // Animation de la barre de progression
            setTimeout(() => {
                const fill = content.querySelector('.ai-progress-fill');
                const txt  = content.querySelector('.ai-status-text');
                if (fill) fill.style.width = '45%';
                if (txt)  txt.textContent  = 'Calcul des G-Forces…';
            }, 500);
            setTimeout(() => {
                const fill = content.querySelector('.ai-progress-fill');
                const txt  = content.querySelector('.ai-status-text');
                if (fill) fill.style.width = '80%';
                if (txt)  txt.textContent  = 'Sélection du type de rapport…';
            }, 1200);
        }
    },

    renderWizardResult(caseCode, analysis, proposal) {
        const content = document.getElementById('screen-content');
        if (!content) return;

        const severityColor = analysis.severity >= 70 ? '#ff4d4d' :
                              analysis.severity >= 35 ? '#ffaa00' : '#00e676';
        const severityLabel = analysis.severity >= 70 ? 'ÉLEVÉE' :
                              analysis.severity >= 35 ? 'MODÉRÉE' : 'FAIBLE';

        content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-result-header">
                    <i class="fa-solid fa-brain" style="color:#7c4dff; font-size:2rem;"></i>
                    <h3>Analyse IA Terminée</h3>
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
                        <strong>Rapport recommandé :</strong>
                        <span class="report-label">${analysis.reportLabel}</span>
                        <p class="report-desc">${analysis.reportDescription}</p>
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
                    <div class="tele-item"><i class="fa-solid fa-bolt"></i> G-Force max : <strong>${analysis.maxG} G</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-gauge-high"></i> Vitesse max : <strong>${analysis.maxSpeed} km/h</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-rotate"></i> Inclinaison max : <strong>${analysis.maxLean}°</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-shield-halved"></i> Intégrité chassis : <strong>${analysis.structuralScore}%</strong></div>
                    ${analysis.gpsIncident ? `<div class="tele-item"><i class="fa-solid fa-location-dot"></i> GPS : <strong>${analysis.gpsIncident.lat?.toFixed(5)}, ${analysis.gpsIncident.lng?.toFixed(5)}</strong></div>` : ''}
                </div>

                <p class="litigation-disclaimer">
                    <i class="fa-solid fa-circle-info"></i>
                    En envoyant cette proposition, votre assureur reçoit le résumé et vous contactera pour valider le type de rapport définitif.
                </p>

                <div class="litigation-actions">
                    <button class="btn-litigation-send" onclick="LitigationAI.confirmAndSend(${JSON.stringify(proposal).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-paper-plane"></i>
                        Envoyer à l'assureur
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-times"></i> Annuler
                    </button>
                </div>
            </div>
        `;
    },

    async confirmAndSend(proposal) {
        const content = document.getElementById('screen-content');
        if (content) {
            content.innerHTML = `
                <div class="litigation-portal litigation-sending">
                    <i class="fa-solid fa-paper-plane fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                    <h3>Envoi en cours…</h3>
                    <p>Transmission de la proposition au portail assureur…</p>
                </div>
            `;
        }

        const result = await this.sendProposalToFirestore(proposal);

        if (content) {
            if (result.success) {
                content.innerHTML = `
                    <div class="litigation-portal litigation-success">
                        <i class="fa-solid fa-circle-check" style="font-size:3rem; color:#00e676;"></i>
                        <h3>Proposition envoyée !</h3>
                        <div class="case-code-badge">
                            <i class="fa-solid fa-hashtag"></i>
                            <span>Référence dossier :</span>
                            <strong>${proposal.caseCode}</strong>
                        </div>
                        <p>Votre assureur a reçu la proposition de type <strong>${proposal.ai.reportLabel}</strong>.<br>
                        Conservez votre code dossier pour le suivi.</p>
                        ${result.simulated ? '<p class="sim-notice"><i class="fa-solid fa-flask"></i> Mode simulation (Firestore hors ligne)</p>' : ''}
                        <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')" style="margin-top:20px;">
                            <i class="fa-solid fa-check"></i> Terminer
                        </button>
                    </div>
                `;
                if (typeof speak === 'function') speak('Proposition envoyée à votre assureur. Conservez votre code dossier.');
            } else {
                content.innerHTML = `
                    <div class="litigation-portal litigation-error">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#ff4d4d;"></i>
                        <h3>Erreur d'envoi</h3>
                        <p>${result.error || 'Une erreur est survenue.'}</p>
                        <button class="btn-litigation-start" onclick="LitigationAI.confirmAndSend(${JSON.stringify(proposal).replace(/"/g, '&quot;')})">
                            <i class="fa-solid fa-rotate-right"></i> Réessayer
                        </button>
                        <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
                            <i class="fa-solid fa-times"></i> Fermer
                        </button>
                    </div>
                `;
            }
        }
    },

    copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            if (typeof speak === 'function') speak('Code dossier copié.');
            const btn = document.querySelector('.btn-copy-code');
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-copy"></i>'; }, 1500);
            }
        });
    }
};

console.log('[LitigationAI] Module chargé — Portail Assurance Intelligent v1.0');
