let currentCaseId = null;
let currentReportType = 'EXPERT';
let currentPrice = 149.99;

function selectReport(type, price) {
    currentReportType = type;
    currentPrice = price;
    
    // UI Update
    document.querySelectorAll('.report-card').forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    document.getElementById('btn-price').textContent = price.toFixed(2) + '€';
}

async function searchCase() {
    const codeInput = document.getElementById('input-case-code').value.trim();
    const statusEl = document.getElementById('status-display');
    const optionsEl = document.getElementById('report-options');
    const payBtn = document.getElementById('btn-pay');
    
    if (!codeInput) {
        statusEl.innerHTML = '<span class="error">Veuillez entrer un code dossier.</span>';
        return;
    }
    
    statusEl.innerHTML = '<span style="color:#0056b3;"><i class="fa-solid fa-spinner fa-spin"></i> Recherche en cours...</span>';
    optionsEl.style.display = 'none';
    payBtn.style.display = 'none';
    
    try {
        const doc = await db.collection('litigation_proposals').doc(codeInput).get();
        if (!doc.exists) {
            statusEl.innerHTML = '<span class="error">Dossier introuvable ou expiré.</span>';
            return;
        }
        
        const data = doc.data();
        currentCaseId = codeInput;
        
        if (data.payment_status === 'PAID') {
            statusEl.innerHTML = '<span class="success"><i class="fa-solid fa-check"></i> Ce rapport a déjà été réglé et déverrouillé.</span>';
            return;
        }
        
        const div1 = document.createElement('div'); div1.textContent = codeInput;
        const div2 = document.createElement('div'); div2.textContent = data.username || 'N/A';
        statusEl.innerHTML = `<span style="color:#333;">Dossier <strong>${div1.innerHTML}</strong> trouvé. Pilote : ${div2.innerHTML}.<br>Veuillez choisir le niveau d'expertise souhaité :</span>`;
        optionsEl.style.display = 'flex';
        payBtn.style.display = 'block';
        
    } catch (err) {
        console.error(err);
        statusEl.innerHTML = '<span class="error">Erreur de connexion à la base de données.</span>';
    }
}

async function payReport() {
    const statusEl = document.getElementById('status-display');
    const payBtn = document.getElementById('btn-pay');
    
    if (!currentCaseId) return;
    
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Création de l\'ordre...';
    
    try {
        // Appeler Firebase Function pour créer l'ordre Revolut
        // NOTE: Assurez-vous que l'URL correspond à votre région / projet
        const functionUrl = 'https://europe-west1-mon50ccetmoi.cloudfunctions.net/createRevolutOrder'; 
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount_cents: Math.round(currentPrice * 100),
                currency: 'EUR',
                case_id: currentCaseId,
                report_type: currentReportType,
                user_id: 'ASSUREUR'
            })
        });
        
        if (!response.ok) throw new Error('Erreur de création de commande Revolut.');
        
        const orderData = await response.json();
        
        // Lancement de Revolut Checkout (Mode Sandbox ou Prod)
        // IMPORTANT: Mettre 'sandbox' pour les tests, 'prod' pour la production
        const instance = await RevolutCheckout(orderData.order_token, 'sandbox');
        
        instance.payWithPopup({
            onSuccess: () => {
                statusEl.innerHTML = '<span class="success"><i class="fa-solid fa-circle-check"></i> Paiement confirmé ! Le rapport est déverrouillé pour le client et votre agence.</span>';
                document.getElementById('report-options').style.display = 'none';
                showExpertTelemetry(currentCaseId, currentReportType);
            },
            onError: (err) => {
                statusEl.innerHTML = '<span class="error">Erreur lors du paiement : ' + err + '</span>';
                payBtn.disabled = false;
                payBtn.innerHTML = 'Réessayer le paiement ' + currentPrice.toFixed(2) + '€';
            },
            onCancel: () => {
                payBtn.disabled = false;
                payBtn.innerHTML = 'Payer par virement (Revolut) ' + currentPrice.toFixed(2) + '€';
            }
        });
        
    } catch (err) {
        console.error(err);
        statusEl.innerHTML = '<span class="error">' + err.message + '</span>';
        payBtn.disabled = false;
        payBtn.innerHTML = 'Payer par virement (Revolut) ' + currentPrice.toFixed(2) + '€';
    }
}

function showExpertTelemetry(caseId, reportType) {
    const dashboard = document.getElementById('expert-dashboard');
    if (!dashboard) return;
    
    // Génération de fausses données d'accident pour la démo
    // Dans une version finale, ces données proviendraient de db.collection('litigation_proposals')
    
    document.getElementById('telemetry-id').textContent = caseId;
    document.getElementById('telemetry-speed').textContent = (Math.random() * (60 - 30) + 30).toFixed(1) + ' km/h';
    document.getElementById('telemetry-g').textContent = (Math.random() * (8 - 3) + 3).toFixed(2) + ' G';
    document.getElementById('telemetry-lean').textContent = (Math.random() * 90).toFixed(1) + ' °';
    
    const now = new Date();
    document.getElementById('telemetry-time').textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    document.getElementById('telemetry-gps').textContent = (45.75 + Math.random()*0.1).toFixed(4) + ', ' + (4.85 + Math.random()*0.1).toFixed(4);
    
    // Faux hash cryptographique
    const rawData = caseId + now.toISOString() + "SECRET_KEY";
    const fakeHash = "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"; 
    document.getElementById('telemetry-hash').textContent = fakeHash;
    
    dashboard.style.display = 'block';
    
    // Faire scroller jusqu'au tableau de bord
    dashboard.scrollIntoView({ behavior: 'smooth' });
}
