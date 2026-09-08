/**
 * assistant-sinistre.js — Assistant Sinistre IA (Nexus Atlas)
 * Guide l'utilisateur étape par étape après un choc ou accident.
 * S'active automatiquement sur l'événement "crashDetected" ou manuellement.
 * Intègre Gemini pour un accompagnement personnalisé.
 */

const SINISTRE_ENDPOINT = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/askNexusAtlasGemini";

const SINISTRE_SYSTEM_PROMPT = `
Tu es Nexus Atlas, l'assistant de sécurité d'urgence de l'application mon50ccetmoi.
Un conducteur de 50cc vient de subir ou de signaler un accident. Tu dois l'assister calmement et efficacement.

PRIORITÉ ABSOLUE :
1. D'abord vérifier que l'utilisateur n'est pas blessé (appel des secours si nécessaire).
2. Sécuriser la scène (triangle de signalisation, feux de détresse).
3. Constater les dégâts et rassembler les preuves.
4. Préparer le constat amiable.

INSTRUCTIONS CRITIQUES :
- Parle avec calme et empathie. L'utilisateur est peut-être en état de choc.
- Ne pose qu'UNE SEULE question ou instruction à la fois.
- Rappelle-lui de NE PAS DÉPLACER le véhicule avant la fin du constat.
- Mentionne systématiquement que les données de la boîte noire mon50ccetmoi constituent une preuve légale.
- Transparence IA : rappelle que tu es une IA d'assistance, et que les décisions légales doivent être validées par un humain.

FORMAT DE RÉPONSE (JSON STRICT) :
{
  "message": "Texte HTML de ta réponse (empathique, clair, courts paragraphes)",
  "step": "SECURITE | CONSTAT | PREUVES | ASSURANCE | TERMINE",
  "action_label": "Texte du bouton d'action (optionnel, null si pas d'action)",
  "action_type": "CALL_15 | CALL_18 | CALL_ASSURANCE | TAKE_PHOTO | OPEN_CONSTAT | SHARE_TELEMETRY | NEXT | null"
}
`;

class AssistantSinistreIA {
  constructor() {
    this.history = [];
    this.currentStep = 'START';
    this.crashData = null;
  }

  async start(crashData) {
    this.crashData = crashData;
    this.history = [];

    let context = "Un conducteur de 50cc me signale un incident ou accident.";
    if (crashData) {
      context += ` Données boîte noire : vitesse ${crashData.speedAtImpact || '?'} km/h, force d'impact ${crashData.gForce || '?'}G.`;
      if (crashData.gForce >= 4) {
        context = "⚠️ ALERTE CRITIQUE : " + context + " L'impact est sévère. Priorise l'appel des secours.";
      }
    }

    this.history.push({
      role: "user",
      parts: [{ text: context + " Commence l'assistance." }]
    });

    return await this.callGemini();
  }

  async next(userMessage) {
    this.history.push({
      role: "user",
      parts: [{ text: userMessage }]
    });
    return await this.callGemini();
  }

  async callGemini() {
    try {
      if (!window.auth || !window.auth.currentUser) {
        return {
          message: "Tu dois être connecté pour utiliser l'assistant. Appelle le <strong>15 (SAMU)</strong> ou le <strong>18 (Pompiers)</strong> si tu es blessé.",
          step: "SECURITE",
          action_label: "Appeler le 15",
          action_type: "CALL_15"
        };
      }

      const idToken = await window.auth.currentUser.getIdToken(true);

      const response = await fetch(SINISTRE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          history: this.history,
          systemPrompt: SINISTRE_SYSTEM_PROMPT
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.candidates?.[0]?.content) throw new Error('No content');

      let raw = data.candidates[0].content.parts[0].text;
      this.history.push({ role: "model", parts: [{ text: raw }] });

      if (raw.includes('```json')) raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      const parsed = JSON.parse(raw.trim());
      this.currentStep = parsed.step || this.currentStep;
      return parsed;

    } catch (e) {
      console.error('[Assistant Sinistre] Erreur Gemini:', e);
      return {
        message: "Une erreur s'est produite. Si tu es blessé, appelle immédiatement le <strong>15 (SAMU)</strong> ou le <strong>18 (Pompiers)</strong>.",
        step: "SECURITE",
        action_label: "Appeler le 15",
        action_type: "CALL_15"
      };
    }
  }
}

// --- UI CONTROLLER ---
let assistantInstance = null;

function openAssistantSinistre(crashData = null) {
  let modal = document.getElementById('sinistre-modal');
  if (modal) modal.remove();

  assistantInstance = new AssistantSinistreIA();
  modal = createModal();
  document.body.appendChild(modal);

  // Lancer l'assistant
  showThinking();
  assistantInstance.start(crashData).then(response => {
    renderResponse(response);
  });
}

function createModal() {
  const modal = document.createElement('div');
  modal.id = 'sinistre-modal';
  modal.innerHTML = `
    <div class="sinistre-overlay" id="sinistre-overlay">
      <div class="sinistre-panel">
        <div class="sinistre-header">
          <div class="sinistre-header-left">
            <div class="sinistre-avatar">🚨</div>
            <div>
              <div class="sinistre-title">Assistant Sinistre</div>
              <div class="sinistre-subtitle">Nexus Atlas — IA d'assistance · pas de décision légale automatique</div>
            </div>
          </div>
          <button class="sinistre-close" onclick="closeAssistantSinistre()">✕</button>
        </div>

        <div class="sinistre-progress" id="sinistre-progress">
          <div class="step active" data-step="SECURITE">🛡️ Sécurité</div>
          <div class="step" data-step="CONSTAT">📋 Constat</div>
          <div class="step" data-step="PREUVES">📸 Preuves</div>
          <div class="step" data-step="ASSURANCE">🏥 Assurance</div>
        </div>

        <div class="sinistre-messages" id="sinistre-messages"></div>

        <div class="sinistre-footer">
          <div class="sinistre-action" id="sinistre-action" style="display:none"></div>
          <div class="sinistre-input-row">
            <input type="text" id="sinistre-input" class="sinistre-input" placeholder="Réponds à Nexus Atlas..." />
            <button class="sinistre-send" onclick="sendSinistreMessage()">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  injectSinistreStyles();

  // Fermer sur entrée
  setTimeout(() => {
    const input = document.getElementById('sinistre-input');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') sendSinistreMessage(); });
  }, 100);

  return modal;
}

function renderResponse(response) {
  const messages = document.getElementById('sinistre-messages');
  if (!messages) return;

  // Retirer l'indicateur de chargement
  const thinking = messages.querySelector('.thinking');
  if (thinking) thinking.remove();

  // Ajouter le message IA
  const msgDiv = document.createElement('div');
  msgDiv.className = 'sinistre-msg nexus';
  // Le HTML vient de Gemini via notre Cloud Function authentifiée
  msgDiv.innerHTML = `<div class="sinistre-bubble">${response.message}</div>`;
  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;

  // Mettre à jour la barre de progression
  updateProgressBar(response.step);

  // Afficher l'action principale
  const actionDiv = document.getElementById('sinistre-action');
  if (response.action_label && response.action_type) {
    actionDiv.style.display = 'block';
    actionDiv.innerHTML = `
      <button class="btn-sinistre-action" onclick="executeSinistreAction('${response.action_type}')">
        ${getActionIcon(response.action_type)} ${response.action_label}
      </button>
    `;
  } else {
    actionDiv.style.display = 'none';
  }

  // Terminer si l'étape est TERMINE
  if (response.step === 'TERMINE') {
    document.getElementById('sinistre-input').disabled = true;
    document.querySelector('.sinistre-send').disabled = true;
  }
}

function showThinking() {
  const messages = document.getElementById('sinistre-messages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = 'sinistre-msg nexus thinking';
  div.innerHTML = '<div class="sinistre-bubble"><i class="fa-solid fa-circle-notch fa-spin"></i> Nexus Atlas analyse la situation...</div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

async function sendSinistreMessage() {
  const input = document.getElementById('sinistre-input');
  if (!input || !input.value.trim() || !assistantInstance) return;

  const text = input.value.trim();
  input.value = '';

  // Message utilisateur
  const messages = document.getElementById('sinistre-messages');
  const userDiv = document.createElement('div');
  userDiv.className = 'sinistre-msg user';
  userDiv.innerHTML = `<div class="sinistre-bubble">${text}</div>`;
  messages.appendChild(userDiv);

  showThinking();

  const response = await assistantInstance.next(text);
  renderResponse(response);
}

async function executeSinistreAction(type) {
  switch(type) {
    case 'CALL_15': window.location.href = 'tel:15'; break;
    case 'CALL_18': window.location.href = 'tel:18'; break;
    case 'CALL_ASSURANCE': window.location.href = 'tel:3960'; break; // Numéro exemple
    case 'TAKE_PHOTO':
      // Ouvrir la caméra native
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
      input.onchange = e => {
        if (e.target.files[0]) {
          showThinking();
          assistantInstance.next("J'ai pris les photos des dégâts.").then(renderResponse);
        }
      };
      input.click();
      break;
    case 'SHARE_TELEMETRY':
      showThinking();
      assistantInstance.next("J'ai partagé les données de télémétrie de la boîte noire avec mon assurance.").then(renderResponse);
      break;
    case 'OPEN_CONSTAT':
      // Rediriger vers le PDF constat si disponible
      alert("Fonctionnalité : Ouverture du constat amiable pré-rempli avec les données télémétriques.");
      break;
    case 'NEXT':
      showThinking();
      assistantInstance.next("Étape suivante.").then(renderResponse);
      break;
  }
}

function updateProgressBar(step) {
  document.querySelectorAll('#sinistre-progress .step').forEach(el => {
    el.classList.remove('active', 'done');
    const steps = ['SECURITE', 'CONSTAT', 'PREUVES', 'ASSURANCE', 'TERMINE'];
    const currentIdx = steps.indexOf(step);
    const elIdx = steps.indexOf(el.dataset.step);
    if (elIdx < currentIdx) el.classList.add('done');
    if (elIdx === currentIdx) el.classList.add('active');
  });
}

function getActionIcon(type) {
  const icons = {
    CALL_15: '📞',
    CALL_18: '🚒',
    CALL_ASSURANCE: '🏥',
    TAKE_PHOTO: '📸',
    SHARE_TELEMETRY: '📡',
    OPEN_CONSTAT: '📋',
    NEXT: '➡️'
  };
  return icons[type] || '▶️';
}

function closeAssistantSinistre() {
  const modal = document.getElementById('sinistre-modal');
  if (modal) modal.remove();
  assistantInstance = null;
}

function injectSinistreStyles() {
  if (document.getElementById('sinistre-styles')) return;
  const style = document.createElement('style');
  style.id = 'sinistre-styles';
  style.textContent = `
    #sinistre-modal { position: fixed; inset: 0; z-index: 99999; }
    .sinistre-overlay {
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(8px);
      display: flex; align-items: flex-end; justify-content: center;
      padding: 20px;
    }
    .sinistre-panel {
      width: 100%; max-width: 560px;
      background: #0d0d18;
      border: 1px solid rgba(255,0,85,0.4);
      border-radius: 24px 24px 16px 16px;
      display: flex; flex-direction: column;
      max-height: 85vh;
      box-shadow: 0 0 60px rgba(255,0,85,0.15);
      animation: slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes slideUp { from { transform: translateY(100px); opacity:0; } to { transform: translateY(0); opacity:1; } }
    .sinistre-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,0,85,0.2);
    }
    .sinistre-header-left { display: flex; align-items: center; gap: 12px; }
    .sinistre-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,0,85,0.15);
      border: 2px solid rgba(255,0,85,0.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{box-shadow:0 0 8px rgba(255,0,85,0.4)} 50%{box-shadow:0 0 20px rgba(255,0,85,0.7)} }
    .sinistre-title { font-family:'Outfit',sans-serif; font-size:1rem; font-weight:700; color:#ff3366; }
    .sinistre-subtitle { font-size:0.7rem; color:rgba(255,255,255,0.35); }
    .sinistre-close {
      background: transparent; border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.5); width:32px; height:32px;
      border-radius: 50%; cursor:pointer; transition:all .2s;
    }
    .sinistre-close:hover { background: rgba(255,255,255,0.1); color:#fff; }
    .sinistre-progress {
      display: flex; justify-content: space-around;
      padding: 10px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(0,0,0,0.3);
    }
    .sinistre-progress .step {
      font-size: 0.7rem; color: rgba(255,255,255,0.3);
      padding: 4px 8px; border-radius: 20px;
      transition: all .3s;
    }
    .sinistre-progress .step.active { color: #ff3366; background: rgba(255,51,102,0.1); }
    .sinistre-progress .step.done { color: #00e676; }
    .sinistre-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .sinistre-msg { display: flex; }
    .sinistre-msg.nexus { justify-content: flex-start; }
    .sinistre-msg.user { justify-content: flex-end; }
    .sinistre-bubble {
      max-width: 85%; padding: 12px 16px;
      font-family: 'Inter', sans-serif; font-size: 0.88rem;
      line-height: 1.6; border-radius: 12px;
    }
    .sinistre-msg.nexus .sinistre-bubble {
      background: rgba(255,51,102,0.08);
      border: 1px solid rgba(255,51,102,0.2);
      color: #eee;
      border-radius: 4px 12px 12px 12px;
    }
    .sinistre-msg.user .sinistre-bubble {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      color: #eee;
      border-radius: 12px 4px 12px 12px;
    }
    .sinistre-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); }
    .sinistre-action { margin-bottom: 10px; }
    .btn-sinistre-action {
      width: 100%; padding: 12px;
      background: linear-gradient(135deg, rgba(255,0,85,0.2), rgba(255,0,85,0.05));
      border: 1px solid rgba(255,0,85,0.5);
      color: #ff3366; font-family:'Inter',sans-serif; font-weight:700;
      border-radius: 12px; cursor: pointer; font-size: 0.9rem;
      transition: all .2s;
    }
    .btn-sinistre-action:hover { background: rgba(255,0,85,0.25); }
    .sinistre-input-row { display: flex; gap: 8px; }
    .sinistre-input {
      flex:1; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; padding: 10px 16px;
      color: #fff; font-family:'Inter',sans-serif; font-size:0.9rem;
      outline: none;
    }
    .sinistre-input:focus { border-color: rgba(255,0,85,0.5); }
    .sinistre-send {
      width:40px; height:40px; border-radius:50%;
      background: #ff0055; border:none;
      color:#fff; cursor:pointer; font-size:0.9rem;
      transition: all .2s;
    }
    .sinistre-send:hover { transform:scale(1.1); }
  `;
  document.head.appendChild(style);
}

// --- Écoute de l'event crashDetected (déclenché par anti-theft.js / guardian-angel.js) ---
window.addEventListener('crashDetected', (e) => {
  const crashData = e.detail;
  // Délai de 3 secondes pour laisser l'UI se stabiliser
  setTimeout(() => openAssistantSinistre(crashData), 3000);
});

// Export global
window.openAssistantSinistre = openAssistantSinistre;
window.closeAssistantSinistre = closeAssistantSinistre;
window.sendSinistreMessage = sendSinistreMessage;
window.executeSinistreAction = executeSinistreAction;
