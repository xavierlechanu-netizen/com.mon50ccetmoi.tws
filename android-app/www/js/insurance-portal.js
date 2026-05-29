/**
 * PORTAIL ASSURANCE mon50ccetmoi
 * Paiements via Revolut Merchant API (SDK RevolutCheckout embarqué)
 * Flow : client → Firebase Function (création ordre) → Revolut → webhook → Firestore
 */
window.InsurancePortal = {
    // Clé publique Merchant (config.js) — utilisée côté client uniquement
    get revolutPublicKey() {
        return CONFIG?.REVOLUT?.PUBLIC_KEY || '';
    },

    // URL de la Firebase Cloud Function (region europe-west1)
    get functionBaseUrl() {
        const projectId = CONFIG?.FIREBASE?.projectId || 'mon50ccetmoi';
        return `https://europe-west1-${projectId}.cloudfunctions.net`;
    },

    balance: 500.00, // Option 2: Portefeuille virtuel (Acompte)
    transactions: [], // Historique des transactions
    cases: {}, // Liste des dossiers en attente ou débloqués

    init() {
        console.log("mon50cc Insurance Portal (Revolut Edition) : [ INITIALIZED ]");
    },

    notify(message) {
        speak(message);
        console.log("[Portal Notification]", message);
        // On pourrait ajouter un toast UI ici si besoin
    },


    // Affiche l'interface du portail pro
    showPortal(caseId) {
        const overlay = document.getElementById('screen-overlay');
        const content = document.getElementById('screen-content');
        if (!overlay || !content) return;

        overlay.classList.remove('hidden');
        this.renderPortal(content, caseId);
    },

    renderPortal(container, caseId) {
        const isUnlocked = this.cases[caseId]?.unlocked;
        const status = this.cases[caseId]?.status || 'pending_payment';

        container.innerHTML = `
            <div class="insurance-portal-container">
                <h3><i class="fa-solid fa-building-shield"></i> Portail Pro Assurance</h3>
                <div class="wallet-status">
                    <span>Votre Solde :</span>
                    <strong id="portal-balance">${this.balance.toFixed(2)} €</strong>
                </div>

                <div class="case-header">
                    <h4>Dossier : <span class="case-id">${caseId}</span></h4>
                    <p class="case-status status-${status}">${this.getStatusLabel(status)}</p>
                </div>

                ${isUnlocked ? this.renderUnlockedView(caseId) : this.renderPaymentOptions(caseId)}

                ${this.renderTransactionHistory()}

                <button onclick="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-close-portal">

                    <i class="fa-solid fa-times"></i> Fermer le Portail
                </button>
            </div>
        `;
    },

    renderPaymentOptions(caseId) {
        return `
            <div class="payment-selection" style="text-align:center; padding: 20px;">
                <i class="fa-solid fa-hourglass-half fa-spin" style="font-size:3rem; color:#00d2ff; margin-bottom:20px;"></i>
                <h3 style="color:#fff; font-size:1.4rem;">En attente de l'Assurance</h3>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Veuillez transmettre ce code de dossier à votre assureur :
                </p>
                <div class="case-code-badge" style="justify-content:center; margin: 20px 0;">
                    <i class="fa-solid fa-hashtag"></i>
                    <strong style="font-size:1.3rem;">${caseId}</strong>
                </div>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Votre assureur pourra déverrouiller le rapport depuis le <strong>Portail Expert</strong>.<br>
                    Le rapport sera disponible ici automatiquement dès validation du paiement.
                </p>
                <button onclick="InsurancePortal.pollPaymentConfirmation('${caseId}')" class="btn-litigation-start" style="margin-top:20px;">
                    <i class="fa-solid fa-rotate"></i> Rafraîchir le statut
                </button>
            </div>
        `;
    },

    renderUnlockedView(caseId) {
        return `
            <div class="unlocked-view">
                <p class="success-msg"><i class="fa-solid fa-circle-check"></i> Rapport débloqué avec succès.</p>
                <button onclick="window.BlackBoxInsurance.generateReport()" class="btn-download-report">
                    <i class="fa-solid fa-file-pdf"></i> Télécharger le Rapport Certifié
                </button>
                <button onclick="window.BlackBoxReplay.replay()" class="btn-replay-report">
                    <i class="fa-solid fa-play"></i> Rejouer le Trajet en 3D
                </button>
            </div>
        `;
    },

    getStatusLabel(status) {
        const labels = {
            'pending_payment': 'En attente de paiement',
            'waiting_for_funds': 'Virement en cours (Attente réception)',
            'pending_verification': 'Vérification de la preuve en cours',
            'unlocked': 'Accès Autorisé'
        };
        return labels[status] || status;
    },


    // ──────────────────────────────────────────────────
    // OPTION 1 : Paiement Revolut Merchant (flow complet)
    // 1. Appel Firebase Function → création ordre Revolut (clé secrète serveur)
    // 2. Récupération du order_token
    // 3. RevolutCheckout(token).payWithPopup()
    // 4. Webhook Revolut → Firebase → déblocage rapport
    // ──────────────────────────────────────────────────
    async payInstant(caseId) {
        const pubKey = this.revolutPublicKey;
        if (!pubKey) {
            alert('⚠️ Clé publique Revolut manquante dans config.js');
            return;
        }

        // Étape 1 : Afficher le spinner de chargement
        this.cases[caseId] = { status: 'waiting_for_funds', unlocked: false };
        this.renderRevolutLoadingModal(caseId);

        try {
            // Étape 2 : Créer l'ordre côté serveur via Firebase Function
            speak('Initialisation du paiement sécurisé Revolut.');
            const orderData = await this.createOrderViaFunction(caseId);

            if (!orderData?.order_token) {
                throw new Error('Token de paiement Revolut non reçu.');
            }

            // Étape 3 : Lancer le checkout Revolut avec le token
            await this.launchRevolutCheckout(caseId, orderData);

        } catch (err) {
            console.error('[Revolut] Erreur paiement :', err);
            this.renderRevolutErrorModal(caseId, err.message);
        }
    },

    // ─ Appel Firebase Function : création de l'ordre Revolut ────────────
    async createOrderViaFunction(caseId) {
        const url = `${this.functionBaseUrl}/createRevolutOrder`;
        const reportType = window.LitigationAI?.lastAnalysis?.reportType || 'STANDARD';

        const response = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount_cents: CONFIG?.REVOLUT?.AMOUNT_CENTS || 4999,
                currency:     CONFIG?.REVOLUT?.CURRENCY     || 'EUR',
                case_id:      caseId,
                user_id:      window.session?.uid || 'guest',
                report_type:  reportType
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(err.error || `Erreur serveur (${response.status})`);
        }

        return await response.json();
    },

    // ─ Lance RevolutCheckout avec le token reçu ───────────────────
    async launchRevolutCheckout(caseId, orderData) {
        if (typeof RevolutCheckout !== 'function') {
            // SDK pas encore chargé (async) — attendre 2s et réessayer
            await new Promise(r => setTimeout(r, 2000));
            if (typeof RevolutCheckout !== 'function') {
                throw new Error('SDK Revolut non chargé. Vérifiez votre connexion.');
            }
        }

        const instance = await RevolutCheckout(orderData.order_token, 'sandbox');
        // Pour les tests production, utiliser : RevolutCheckout(token, 'prod')

        instance.payWithPopup({
            onSuccess: () => {
                speak('Paiement Revolut confirmé. Vérification en cours.');
                this.renderRevolutPendingConfirmation(caseId, orderData.order_id);
                // Le webhook Revolut va débloquer le rapport dans Firestore.
                // On poll Firebase toutes les 3s pour détecter la confirmation.
                this.pollPaymentConfirmation(caseId);
            },
            onError: (message) => {
                console.error('[Revolut] Erreur checkout :', message);
                this.renderRevolutErrorModal(caseId, message);
            },
            onCancel: () => {
                speak('Paiement annulé.');
                this.cases[caseId] = { status: 'pending_payment', unlocked: false };
                this.showPortal(caseId);
            }
        });
    },

    // ─ Poll Firestore pour détecter la confirmation webhook ────────
    async pollPaymentConfirmation(caseId, attempts = 0) {
        if (attempts > 20) { // Timeout après ~60s
            this.renderRevolutErrorModal(caseId, 'Délai de confirmation dépassé. Contactez le support.');
            return;
        }

        await new Promise(r => setTimeout(r, 3000));

        try {
            // Vérifier dans Firestore si le webhook a confirmé le paiement
            if (typeof db !== 'undefined') {
                const doc = await db.collection('payment_confirmations').doc(caseId).get();
                if (doc.exists) {
                    this.unlockCase(caseId, 'revolut_webhook');
                    this.renderRevolutSuccess(caseId);
                    speak('Rapport débloqué avec succès. Bonne route.');
                    return;
                }
            } else {
                // Fallback : vérifier via la Cloud Function
                const url = `${this.functionBaseUrl}/checkPaymentStatus?case_id=${caseId}&user_id=${window.session?.uid || ''}`;
                const resp = await fetch(url);
                const data = await resp.json();
                if (data.paid) {
                    this.unlockCase(caseId, 'revolut_webhook');
                    this.renderRevolutSuccess(caseId);
                    speak('Rapport débloqué avec succès.');
                    return;
                }
            }
        } catch (e) {
            console.warn('[Revolut Poll] Erreur :', e);
        }

        // Continuer à poller
        this.pollPaymentConfirmation(caseId, attempts + 1);
    },

    // ─ Modals UI ─────────────────────────────────────────────────
    renderRevolutSuccess(caseId) {
        const content = document.getElementById('screen-content');
        if (!content) return;
        content.innerHTML = `
            <div class="litigation-portal" style="animation: portal-fade-in 0.5s ease-out;">
                <div class="litigation-analyzing" style="text-align:center; padding: 40px 20px;">
                    <div class="revolut-logo-ring" style="border-color: #00ff00; box-shadow: 0 0 30px rgba(0,255,0,0.5);">
                        <i class="fa-solid fa-unlock" style="color:#00ff00; font-size:2rem; animation: pulse-halo 2s infinite;"></i>
                    </div>
                    <h3 style="color:#00ff00; font-size:1.5rem; margin-top:20px;">Paiement Validé</h3>
                    <p style="color:#fff; font-size:0.9rem; margin-top:10px;">Le webhook Revolut a confirmé la transaction.</p>
                    <p style="color:#00d2ff; font-size:1rem; margin-top:5px; font-weight:bold;">Rapport Déverrouillé</p>
                </div>
            </div>`;
        
        // Après 3 secondes, on affiche le portail complet
        setTimeout(() => {
            this.showPortal(caseId);
        }, 3000);
    },

    renderRevolutLoadingModal(caseId) {
        const content = document.getElementById('screen-content');
        if (!content) return;
        const price = (CONFIG?.REVOLUT?.AMOUNT_CENTS || 4999) / 100;
        content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-analyzing">
                    <div class="revolut-pay-header">
                        <div class="revolut-logo-ring">
                            <i class="fa-solid fa-lock" style="color:#7c4dff; font-size:1.8rem;"></i>
                        </div>
                        <h3>Paiement Sécurisé</h3>
                        <p style="color:#aaa; font-size:0.82rem;">Préparation du checkout <strong style="color:#fff;">Revolut</strong>…</p>
                    </div>
                    <div class="revolut-amount-badge">
                        <span class="revolut-amount-value">${price.toFixed(2)} €</span>
                        <span class="revolut-amount-label">Rapport Assurance certifié — ${caseId}</span>
                    </div>
                    <div class="ai-progress-bar" style="margin-top:20px;">
                        <div class="ai-progress-fill revolut-progress" style="width:30%;"></div>
                    </div>
                    <p class="ai-status-text" id="revolut-status-txt">Création de l'ordre de paiement…</p>
                </div>
            </div>`;
        // Animation de la barre
        setTimeout(() => {
            const fill = content.querySelector('.revolut-progress');
            const txt  = content.querySelector('#revolut-status-txt');
            if (fill) fill.style.width = '70%';
            if (txt)  txt.textContent  = 'Connexion à Revolut Merchant…';
        }, 800);
        setTimeout(() => {
            const fill = content.querySelector('.revolut-progress');
            const txt  = content.querySelector('#revolut-status-txt');
            if (fill) fill.style.width = '90%';
            if (txt)  txt.textContent  = 'Ouverture du checkout…';
        }, 1800);
    },

    renderRevolutPendingConfirmation(caseId, orderId) {
        const content = document.getElementById('screen-content');
        if (!content) return;
        content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-satellite-dish fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3 style="margin-top:15px;">Confirmation en cours…</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">
                    Votre paiement a été soumis. En attente de la confirmation Revolut.
                </p>
                <div class="case-code-badge" style="margin-top:20px;">
                    <i class="fa-solid fa-hashtag"></i>
                    <span>Dossier :</span>
                    <strong>${caseId}</strong>
                </div>
                <div class="case-code-badge">
                    <i class="fa-brands fa-revolut" style="color:#7c4dff;"></i>
                    <span>Ordre Revolut :</span>
                    <strong style="font-size:0.7rem;">${orderId}</strong>
                </div>
                <p style="font-size:0.7rem; color:#555; margin-top:15px;">
                    <i class="fa-solid fa-clock"></i> Vérification automatique toutes les 3 secondes…
                </p>
            </div>`;
    },

    renderRevolutErrorModal(caseId, message) {
        const content = document.getElementById('screen-content');
        if (!content) return;
        content.innerHTML = `
            <div class="litigation-portal litigation-error">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#ff4d4d;"></i>
                <h3>Erreur de paiement</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">${message || 'Une erreur est survenue.'}</p>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn-litigation-start" onclick="InsurancePortal.payInstant('${caseId}')" style="flex:1;">
                        <i class="fa-solid fa-rotate-right"></i> Réessayer
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')" style="flex:1;">
                        <i class="fa-solid fa-times"></i> Fermer
                    </button>
                </div>
            </div>`;
    },

    // DOSSIER LITIGE IA — Lance l'analyse Blackbox intelligente
    openLitigationWizard(caseId) {
        if (typeof window.LitigationAI === 'undefined') {
            alert('Module LitigationAI non chargé. Vérifiez que litigation-ai.js est inclus dans la page.');
            return;
        }
        window.LitigationAI.openPortal();
    },

    // OPTION 2 : Portefeuille
    payWithWallet(caseId) {
        if (this.balance >= 49.99) {
            this.balance -= 49.99;
            this.unlockCase(caseId, 'wallet_debit');
            this.showPortal(caseId); // Refresh
            speak("Débit effectué sur votre compte pro. Rapport accessible.");
        } else {
            alert("Solde insuffisant sur votre portefeuille virtuel.");
            speak("Solde insuffisant.");
        }
    },

    // OPTION 3 : Preuve de virement
    uploadProof(caseId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.cases[caseId] = { status: 'pending_verification', unlocked: false };
                this.showPortal(caseId);
                speak("Preuve de virement reçue. Notre système vérifie le document.");
                
                // Simulation de validation automatique après 5s
                setTimeout(() => {
                    this.unlockCase(caseId, 'proof_validated');
                    if (document.getElementById('screen-overlay').classList.contains('hidden') === false) {
                        this.showPortal(caseId);
                    }
                    speak("Justificatif validé. Le rapport est maintenant débloqué.");
                }, 5000);
            }
        };
        input.click();
    },

    renderTransactionHistory() {
        if (this.transactions.length === 0) return '';
        
        return `
            <div class="transaction-history">
                <h5><i class="fa-solid fa-clock-rotate-left"></i> Historique des Transactions</h5>
                <div class="transaction-list">
                    ${this.transactions.map(t => `
                        <div class="transaction-item">
                            <span>${new Date(t.date).toLocaleTimeString()} - ${t.caseId}</span>
                            <span class="t-amount">-${t.amount}€</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    unlockCase(caseId, method) {
        const amount = 49.99;
        this.cases[caseId] = { 
            status: 'unlocked', 
            unlocked: true, 
            method: method,
            timestamp: Date.now() 
        };
        
        this.transactions.unshift({
            date: Date.now(),
            caseId: caseId,
            amount: amount,
            method: method
        });

        this.notify(`Transaction confirmée pour le dossier ${caseId}.`);
    }
};

