/**
 * Simulateur Cerveau IA - Nexus Atlas (Oracle Code de la Route)
 * v2.0 — Connecté à Gemini | Météo contextuelle | Oracle Voice (Web Speech API)
 */

// Fonction pour récupérer la vigilance météo depuis la Cloud Function existante
async function fetchMeteoContext() {
  try {
    const token = window.auth && window.auth.currentUser
      ? await window.auth.currentUser.getIdToken()
      : null;
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const response = await fetch(
      "https://europe-west1-mon50ccetmoi.cloudfunctions.net/getVigilanceMeteo",
      { headers }
    );
    if (!response.ok) return null;
    const data = await response.json();
    // Extraire le niveau d'alerte max (1=Vert, 2=Jaune, 3=Orange, 4=Rouge)
    let maxLevel = 1;
    let hazardTypes = [];
    if (data && data.product && data.product.periods) {
      const period = data.product.periods[0];
      if (period && period.timelaps) {
        for (const timelap of period.timelaps) {
          if (timelap.max_color_id > maxLevel) maxLevel = timelap.max_color_id;
          if (timelap.phenomenon_items) {
            for (const ph of timelap.phenomenon_items) {
              if (ph.phenomenon_max_color_id >= 2) {
                hazardTypes.push(ph.phenomenon_name);
              }
            }
          }
        }
      }
    }
    const meteoLabels = { 1: 'verte (pas de risque)', 2: 'jaune (vigilance)', 3: 'orange (alerte forte)', 4: 'rouge (alerte maximale)' };
    return {
      level: maxLevel,
      label: meteoLabels[maxLevel] || 'inconnue',
      hazards: [...new Set(hazardTypes)].join(', ') || 'aucun'
    };
  } catch (e) {
    console.warn('[Nexus Atlas] Météo non disponible:', e.message);
    return null;
  }
}

function buildSystemPrompt(meteo, profile) {
  let meteoSection = '';
  if (meteo) {
    meteoSection = `
CONTEXTE MÉTÉO DU JOUR (Météo-France) :
- Niveau de vigilance national : ${meteo.label}
- Risques signalés : ${meteo.hazards}
- INSTRUCTION : Adapte tes questions de mise en situation à ce contexte. Si la vigilance est jaune ou plus, pose AU MOINS UNE question sur la conduite par temps difficile (pluie, verglas, vent fort, brouillard). Si elle est verte, tu peux poser des questions plus générales.
`;
  }

  let profileSection = '';
  if (profile && profile.bvcPoints !== undefined) {
    profileSection = `
PROFIL DE L'UTILISATEUR :
- Score BVC (Bonne Volonté Communautaire) : ${profile.bvcPoints}
- INSTRUCTION : Adapte la difficulté. Si le score est faible, pose des questions fondamentales. Si le score est élevé, pose des questions plus pointues (ex: ZFE, législation pointue).
`;
  }

  return `
Tu es Nexus Atlas, l'assistant et coach de sécurité routière expert et bienveillant pour les conducteurs de 50cc et de véhicules sans permis (VSP). 
Ton objectif est de valider leurs connaissances du code de la route par des questions basées sur la législation française et de les guider avec patience et encouragements, en soulignant les erreurs sans jamais les blâmer.

TRANSPARENCE IA (LÉGISLATION) :
- Précise toujours que tu es une intelligence artificielle agissant à titre d'assistance.
- Rappelle à l'utilisateur que seul le Code de la Route officiel et les décisions de justice font foi en cas de litige.

LES RÈGLES MAJEURES À MAÎTRISER ET À ENSEIGNER :
1. Les angles morts (en particulier ceux des poids lourds et bus : le danger n°1).
2. L'interdiction absolue de circuler sur les voies express, rocades, et autoroutes.
3. Le port obligatoire de l'équipement homologué CE (Casque attaché et Gants) même pour des petits trajets.
4. Les règles d'alcoolémie strictes (0,2 g/L, soit tolérance zéro pour les jeunes conducteurs).
5. Le partage de la route avec les usagers vulnérables (piétons, trottinettes).
6. La conduite par temps difficile (pluie, verglas, vent, brouillard) : distances de sécurité, vitesse adaptée, visibilité réduite.
7. Les règles de circulation en ZFE (Zones à Faibles Émissions) et la vignette Crit'Air pour les 50cc.
${meteoSection}
${profileSection}
INSTRUCTIONS DE COMPORTEMENT :
- Si l'utilisateur propose une action dangereuse, corrige-le doucement en lui expliquant *pourquoi* c'est dangereux.
- Pose des questions de mise en situation concrètes une par une.
- Félicite-le chaleureusement quand il donne la bonne réponse.
- Au bout de 3 ou 4 questions d'évaluation, termine l'examen.

FORMAT DE RÉPONSE OBLIGATOIRE (JSON STRICT) :
Tu dois IMPÉRATIVEMENT renvoyer un objet JSON valide ayant exactement cette structure :
{
  "reply": "Ta réponse texte au candidat en HTML (utilise <strong>, <br> pour la mise en forme)",
  "score_update": 1,
  "is_finished": false
}
score_update = 1 si bonne réponse, 0 sinon. is_finished = true quand l'examen est fini (après 3-4 questions).
NE RENVOIE RIEN D'AUTRE QUE CE JSON.
`;
}

class NexusAtlasAI {
  constructor() {
    this.name = "Nexus Atlas";
    this.state = "INIT"; // INIT, EXAM, RESULT
    this.score = 0;
    this.history = [];
    this.meteoContext = null;
    this.systemPrompt = null;

    // Cloud Function Endpoint
    this.endpoint = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/askNexusAtlasGemini";
  }

  async initialize() {
    this.meteoContext = await fetchMeteoContext();
    let profile = null;
    try {
      if (typeof window.secureGetItem === 'function') {
        const sessionStr = await window.secureGetItem('session');
        if (sessionStr) profile = JSON.parse(sessionStr);
      }
    } catch(e) {}
    this.systemPrompt = buildSystemPrompt(this.meteoContext, profile);
    return this.meteoContext;
  }

  async processInput(userInput) {
    if (this.state === "INIT") {
      this.state = "EXAM";
      this.history.push({
        role: "user",
        parts: [{ text: "Bonjour Nexus Atlas. Je suis prêt pour mon examen de sécurité routière 50cc. Pose-moi la première situation." }]
      });
      return await this.callGeminiAPI();
    }

    if (this.state === "EXAM") {
      this.history.push({
        role: "user",
        parts: [{ text: userInput }]
      });
      return await this.callGeminiAPI();
    }

    return "L'examen est terminé. Retourne à la base.";
  }

  async callGeminiAPI() {
    try {
      if (!window.auth || !window.auth.currentUser) {
        return "Erreur : Tu dois être connecté pour discuter avec Nexus Atlas.";
      }

      // Cache IA (Green AI - économie GPU)
      const historyStr = JSON.stringify(this.history.map(h => h.parts[0].text));
      let hash = 0;
      for (let i = 0; i < historyStr.length; i++) hash = Math.imul(31, hash) + historyStr.charCodeAt(i) | 0;
      const cacheKey = 'nexus_cache_' + hash;
      
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        console.log("[Nexus Atlas] Using cached response (Green AI)");
        this.history.push({ role: "model", parts: [{ text: cached }] });
        return this.handleGeminiParsed(cached);
      }

      const idToken = await window.auth.currentUser.getIdToken(true);

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          history: this.history,
          systemPrompt: this.systemPrompt || buildSystemPrompt(null, null)
        })
      });

      if (response.status === 429) {
        return "Oups ! L'IA a besoin de souffler un instant (limite de requêtes atteinte). Attends 1 minute et réessaie !";
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        let rawText = data.candidates[0].content.parts[0].text;
        
        sessionStorage.setItem(cacheKey, rawText); // Sauvegarde en cache

        this.history.push({
          role: "model",
          parts: [{ text: rawText }]
        });

        return this.handleGeminiParsed(rawText);
      } else {
        return "Désolé, je n'ai pas pu formuler une réponse. Peux-tu reformuler ?";
      }

    } catch (error) {
      console.error("[Nexus Atlas] Gemini API Error:", error);
      return "Une erreur de communication est survenue. Veuillez réessayer.";
    }
  }

  handleGeminiParsed(rawText) {
    if (rawText.includes('```json')) {
      rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    }

    try {
      const parsed = JSON.parse(rawText.trim());

      if (parsed.score_update > 0) {
        this.score += parsed.score_update;
      }

      let responseTxt = parsed.reply;

      if (parsed.score_update > 0) {
        responseTxt += `<br><span class="score-update">+${parsed.score_update} Point (Score: ${this.score})</span>`;
      }

      if (parsed.is_finished) {
        this.state = "RESULT";
        setTimeout(() => finalizeExam(this.score, Math.max(3, this.score)), 3000);
        responseTxt += `<br><br><em>Analyse des résultats en cours...</em>`;
      }

      if (window.nexusVoiceEnabled) {
        speakText(parsed.reply.replace(/<[^>]*>/g, ''));
      }

      return responseTxt;

    } catch (parseError) {
      console.error("[Nexus Atlas] Erreur parsing JSON Gemini :", rawText);
      return "Erreur d'analyse. Mais continuons — reformule ta réponse !";
    }
  }
}

// -------------------------------------------------------------
// ORACLE VOICE — Web Speech API
// -------------------------------------------------------------

window.nexusVoiceEnabled = false;
let speechSynth = window.speechSynthesis;
let currentUtterance = null;

function speakText(text) {
  if (!speechSynth) return;
  if (currentUtterance) speechSynth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 1.0;
  utterance.pitch = 0.85; // Voix légèrement grave pour Nexus Atlas
  // Choisir une voix française si disponible
  const voices = speechSynth.getVoices();
  const frVoice = voices.find(v => v.lang.startsWith('fr'));
  if (frVoice) utterance.voice = frVoice;
  currentUtterance = utterance;
  speechSynth.speak(utterance);
}

function toggleVoice(btn) {
  window.nexusVoiceEnabled = !window.nexusVoiceEnabled;
  if (!window.nexusVoiceEnabled && speechSynth) speechSynth.cancel();
  btn.innerHTML = window.nexusVoiceEnabled
    ? '<i class="fa-solid fa-volume-high"></i>'
    : '<i class="fa-solid fa-volume-xmark"></i>';
  btn.title = window.nexusVoiceEnabled ? 'Désactiver la voix' : 'Activer la voix IA';
  btn.classList.toggle('voice-active', window.nexusVoiceEnabled);
}

// Reconnaissance vocale (input voix utilisateur)
let recognition = null;
let isListening = false;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;
  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    stopListening();
    // Soumettre automatiquement
    chatForm.dispatchEvent(new Event('submit'));
  };
  recognition.onerror = (event) => {
    console.warn('[Oracle Voice] Erreur reconnaissance :', event.error);
    stopListening();
  };
  recognition.onend = () => stopListening();
  return true;
}

function startListening(btn) {
  if (!recognition && !initSpeechRecognition()) {
    alert('La reconnaissance vocale n\'est pas supportée sur ce navigateur.');
    return;
  }
  isListening = true;
  btn.classList.add('mic-active');
  btn.innerHTML = '<i class="fa-solid fa-waveform-lines fa-beat"></i>';
  recognition.start();
}

function stopListening() {
  isListening = false;
  const btn = document.getElementById('btn-mic');
  if (btn) {
    btn.classList.remove('mic-active');
    btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
  }
  if (recognition) try { recognition.stop(); } catch(e) {}
}

function toggleMic(btn) {
  if (isListening) {
    stopListening();
  } else {
    startListening(btn);
  }
}

// -------------------------------------------------------------
// UI CONTROLLER
// -------------------------------------------------------------

const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const typingIndicator = document.getElementById('typing-indicator');

const atlas = new NexusAtlasAI();

document.addEventListener("DOMContentLoaded", async () => {
  // Charger les voix en avance (async browser behavior)
  if (speechSynth && speechSynth.onvoiceschanged !== undefined) {
    speechSynth.onvoiceschanged = () => speechSynth.getVoices();
  }

  // Message d'accueil immédiat
  setTimeout(() => {
    addMessage("nexus", "Initialisation de Nexus Atlas en cours...<br><small style='color: rgba(0,240,255,0.5)'>🌦️ Chargement du contexte météo national...</small>");
  }, 300);

  // Initialisation asynchrone (météo)
  const meteo = await atlas.initialize();

  // Remplacer le message de chargement par le vrai message d'accueil
  chatContainer.innerHTML = '';
  
  let meteoInfo = '';
  if (meteo && meteo.level >= 2) {
    meteoInfo = `<br><br><span style="color: var(--nexus-gold)"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Alerte météo ${meteo.label} aujourd'hui</strong> — Risques : ${meteo.hazards}. Mon examen prendra en compte ces conditions !</span>`;
  }

  setTimeout(() => {
    addMessage("nexus", `Salut ! Je suis <strong>Nexus Atlas</strong>, ton coach IA de sécurité routière propulsé par Gemini. Mon but : m'assurer que tu roules en 50cc ou VSP en toute sécurité.${meteoInfo}<br><br>👇 Tape <strong>OUI</strong> (ou parle via le micro) pour commencer l'examen !`);
  }, 100);
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  chatInput.value = "";
  chatInput.disabled = true;

  typingIndicator.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Nexus Atlas réfléchit...';
  typingIndicator.style.display = 'flex';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const aiResponse = await atlas.processInput(text);

  typingIndicator.style.display = 'none';
  addMessage("nexus", aiResponse);

  chatInput.disabled = false;
  chatInput.focus();
});

function addMessage(sender, htmlContent) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  // Sécurité XSS : Assainissement avec DOMPurify si dispo, sinon on utilise textContent pour le user
  if (sender === "user") {
    div.innerHTML = `<div class="bubble"></div>`;
    div.querySelector('.bubble').textContent = htmlContent;
  } else {
    const cleanHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(htmlContent) : htmlContent;
    div.innerHTML = `<div class="bubble">${cleanHtml}</div>`;
  }
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function finalizeExam(score, max) {
  const resultScreen = document.getElementById('exam-result');
  const title = document.getElementById('result-title');
  const desc = document.getElementById('result-desc');
  const reward = document.getElementById('reward-box');

  resultScreen.style.display = "flex";

  if (score >= max) {
    title.textContent = "SUPER !";
    title.className = "result-title pass";
    desc.textContent = "Tu as un excellent jugement ! Tu connais parfaitement les règles de sécurité essentielles pour toi et les autres.";
    reward.style.display = "block";

    try {
      if (typeof window.secureGetItem === 'function') {
        const sessionStr = await window.secureGetItem('session');
        if (sessionStr && typeof db !== 'undefined') {
          const profile = JSON.parse(sessionStr);
          if (profile.uid) {
            await db.collection("users").doc(profile.uid).update({
              bvcPoints: firebase.firestore.FieldValue.increment(5)
            });
          }
        }
      }
    } catch (e) {
      console.warn("[Nexus Atlas] DB Update failed", e);
    }

  } else {
    title.textContent = "PRESQUE ÇA !";
    title.className = "result-title fail";
    title.style.color = "var(--nexus-gold)";
    desc.textContent = `Tu as eu ${score}/${max}. Il te manque encore quelques réflexes. Relis les explications et retente ta chance !`;
  }

  // Lire le résultat à voix haute si activé
  if (window.nexusVoiceEnabled) {
    speakText(score >= max
      ? "Félicitations ! Excellent résultat, tu es prêt à rouler prudemment."
      : `Presque ! Tu as eu ${score} sur ${max}. Continue à t'entraîner !`
    );
  }
}
