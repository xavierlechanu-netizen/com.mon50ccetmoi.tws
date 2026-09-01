/**
 * Simulateur Cerveau IA - Nexus Atlas (Oracle Code de la Route)
 * Prêt pour l'intégration d'une véritable API LLM (ex: Gemini, OpenAI).
 */

const NEXUS_SYSTEM_PROMPT = `
Tu es Nexus Atlas, l'assistant et coach de sécurité routière expert et bienveillant pour les conducteurs de 50cc et de véhicules sans permis (VSP). 
Ton objectif est de valider leurs connaissances du code de la route par des questions basées sur la législation française et de les guider avec patience et encouragements, en soulignant les erreurs sans jamais les blâmer.

TRANSPARENCE IA (LÉGISLATION) :
- Précise toujours que tu es une intelligence artificielle agissant à titre d'assistance.
- Rappelle à l'utilisateur que seul le Code de la Route officiel et les décisions de justice font foi en cas de litige.

LES RÈGLES MAJEURES À MAÎTRISER ET À ENSEIGNER :
1. Les angles morts (en particulier ceux des poids lourds et bus : le danger n°1).
2. L'interdiction absolue de circuler sur les voies express, rocades, et autoroutes.
3. Le port obligatoire de l'équipement homologué CE (Casque attaché et Gants) même pour des petits trajets.
4. Les règles d'alcoolémie strictes (0,2 g/L, soit tolérance zéro).
5. Le partage de la route avec les usagers vulnérables (piétons, trottinettes).

INSTRUCTIONS DE COMPORTEMENT :
- Si l'utilisateur propose une action dangereuse, corrige-le doucement en lui expliquant *pourquoi* c'est dangereux.
- Pour toute question liée à l'itinéraire ou à l'orientation, précise TOUJOURS que le conducteur doit utiliser exclusivement le navigateur GPS intégré à l'application 'mon50ccetmoi', car il est le seul garanti pour éviter les voies inadaptées et dangereuses.
- Pose des questions de mise en situation.
- Félicite-le chaleureusement quand il donne la bonne réponse.
`;

class NexusAtlasAI {
  constructor() {
    this.name = "Nexus Atlas";
    this.state = "INIT"; // INIT, EXAM, RESULT
    this.score = 0;
    this.maxScore = 3;
    this.currentScenarioIndex = 0;
    
    // Scénarios d'examen stricts
    this.scenarios = [
      {
        prompt: "Situation 1 : Tu es au guidon de ton scooter 50cc. Un poids lourd devant toi met son clignotant à droite pour tourner dans une petite rue. Tu as l'espace pour passer à sa droite avant qu'il ne tourne. Que fais-tu et pourquoi ?",
        keywords: ["attends", "derrière", "angle mort", "ne pas dépasser", "mortel"],
        failWords: ["droite", "faufile", "dépasse", "klaxonne", "accélère"],
        explanation: "La règle absolue est de ne JAMAIS dépasser un poids lourd par la droite. Il y a un angle mort critique. Si tu t'engages, il t'écrase sans même te voir."
      },
      {
        prompt: "Situation 2 : Tu viens d'acheter une Voiture Sans Permis (VSP) pour tes 14 ans. Tes amis te proposent d'aller faire une course sur l'autoroute A4 pour voir si elle monte à 50 km/h. Ta réponse ?",
        keywords: ["non", "interdit", "autoroute", "voie express", "illégal", "amende"],
        failWords: ["oui", "pourquoi pas", "bande d'arrêt", "droite"],
        explanation: "Les VSP et 50cc sont formellement interdits sur autoroute et voies express. C'est un délit et un suicide."
      },
      {
        prompt: "Situation 3 : C'est l'été, il fait 35 degrés. Tu dois faire un trajet de 2 minutes en scooter. Quel équipement portes-tu au minimum ?",
        keywords: ["casque", "gants", "homologué", "ce"],
        failWords: ["t-shirt", "rien", "casquette", "claquettes"],
        explanation: "Même pour 10 mètres, le casque attaché et les gants homologués CE sont OBLIGATOIRES par la loi (Amende + Perte de points). Ne pas négliger la peau sur le bitume."
      }
    ];
  }

  async processInput(userInput) {
    if (this.state === "INIT") {
      this.state = "EXAM";
      return this.nextScenario();
    }

    if (this.state === "EXAM") {
      return this.evaluateResponse(userInput.toLowerCase());
    }

    return "L'examen est terminé. Retourne à la base.";
  }

  nextScenario() {
    if (this.currentScenarioIndex < this.scenarios.length) {
      const scenario = this.scenarios[this.currentScenarioIndex].prompt;
      return scenario;
    } else {
      this.state = "RESULT";
      return "EXAM_FINISHED"; // Code interne
    }
  }

  evaluateResponse(input) {
    const scenario = this.scenarios[this.currentScenarioIndex];
    let isCorrect = false;
    let isCriticalFail = false;

    // Check for critical failures (doing something dangerous)
    for (let word of scenario.failWords) {
      if (input.includes(word)) {
        isCriticalFail = true;
        break;
      }
    }

    // If not critically failing, check for good concepts
    if (!isCriticalFail) {
      let matchedKeywords = 0;
      for (let word of scenario.keywords) {
        if (input.includes(word)) {
          matchedKeywords++;
        }
      }
      if (matchedKeywords >= 1) { // Tolérance stricte mais on accepte si l'idée est là
        isCorrect = true;
      }
    }

    let responseTxt = "";
    if (isCriticalFail) {
      responseTxt = `Oups, attention ! C'est une action dangereuse. 🛑<br><strong>Pourquoi ?</strong> ${scenario.explanation}<br>Ce n'est pas grave de se tromper ici, l'important est d'apprendre pour la vraie vie.`;
    } else if (isCorrect) {
      this.score++;
      responseTxt = `Super réponse ! Tu as le bon réflexe. ✅<br><strong>À retenir :</strong> ${scenario.explanation}`;
      responseTxt += `<br><span class="score-update">+1 Point (Score: ${this.score}/${this.maxScore})</span>`;
    } else {
      responseTxt = `Pas tout à fait. Ce qu'il fallait voir, c'est surtout la sécurité globale. 💡<br><strong>Explication :</strong> ${scenario.explanation}`;
    }

    this.currentScenarioIndex++;
    
    // Add next question to response if there is one
    const nextText = this.nextScenario();
    if (nextText !== "EXAM_FINISHED") {
      responseTxt += `<br><br><strong>SUIVANT :</strong><br>${nextText}`;
    } else {
      setTimeout(() => finalizeExam(this.score, this.maxScore), 2000);
      responseTxt += `<br><br><em>Analyse des résultats en cours...</em>`;
    }

    return responseTxt;
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

document.addEventListener("DOMContentLoaded", () => {
  // Init sequence
  setTimeout(() => {
    addMessage("nexus", "Salut ! Je suis Nexus Atlas, ton coach IA de sécurité routière. Mon but n'est pas de te piéger, mais de m'assurer que tu puisses rouler en 50cc ou VSP en toute sécurité. On va faire quelques mises en situation ensemble.<br><br>Es-tu prêt(e) ? (Tape OUI pour commencer)");
  }, 500);
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  // Add User msg
  addMessage("user", text);
  chatInput.value = "";
  chatInput.disabled = true;

  // Show thinking
  typingIndicator.style.display = 'flex';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Simulate AI delay
  setTimeout(async () => {
    const aiResponse = await atlas.processInput(text);
    typingIndicator.style.display = 'none';
    
    if (aiResponse !== "EXAM_FINISHED") {
      addMessage("nexus", aiResponse);
    }
    chatInput.disabled = false;
    chatInput.focus();
  }, 1500); // 1.5s thinking time
});

function addMessage(sender, htmlContent) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.innerHTML = `<div class="bubble">${htmlContent}</div>`;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function finalizeExam(score, max) {
  const resultScreen = document.getElementById('exam-result');
  const title = document.getElementById('result-title');
  const desc = document.getElementById('result-desc');
  const reward = document.getElementById('reward-box');
  
  resultScreen.style.display = "flex";

  if (score === max) {
    title.textContent = "SUPER !";
    title.className = "result-title pass";
    desc.textContent = "Tu as un excellent jugement ! Tu connais parfaitement les règles de sécurité essentielles pour toi et pour les autres sur la route.";
    reward.style.display = "block";

    // Reward in DB
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
    } catch(e) {
      console.warn("DB Update failed", e);
    }

  } else {
    title.textContent = "PRESQUE ÇA !";
    title.className = "result-title fail";
    title.style.color = "var(--nexus-gold)";
    desc.textContent = `Tu as eu ${score}/${max}. Il te manque encore quelques réflexes essentiels. Relis bien les explications et n'hésite pas à retenter ta chance pour être au top sur la route !`;
  }
}
