import { registerAction } from './actionRegistry.js';
import { pointsSouverains, messagePoints } from './points.js';

/**
 * Contrat de Route — Gamification de la sécurité routière
 * Le conducteur signe un engagement mensuel. S'il le tient (validé par Nexus Atlas)
 * → récompense en BVC Points + badge.
 */

const CONTRATS = [
  {
    id: "casque",
    icon: "fa-helmet-safety",
    label: "Port du casque homologué CE",
    description: "Je m'engage à toujours porter mon casque attaché ET mes gants homologués CE, même pour un trajet de 2 minutes.",
    loi: "Art. R431-1 du Code de la Route — Amende 135€ + perte de points.",
    bvcReward: 10
  },
  {
    id: "alcool",
    icon: "fa-wine-bottle",
    label: "Tolérance zéro alcool au guidon",
    description: "Je m'engage à ne jamais conduire après avoir consommé de l'alcool. Même une bière, c'est non.",
    loi: "Taux légal 50cc : 0,2 g/L de sang — Suspension de permis + 1500€ d'amende.",
    bvcReward: 15
  },
  {
    id: "angles-morts",
    icon: "fa-truck-moving",
    label: "Maîtriser les angles morts",
    description: "Je m'engage à ne JAMAIS dépasser un camion ou un bus par la droite, et à toujours rester visible.",
    loi: "Premier facteur de décès chez les cyclomotoristes (ONISR 2024).",
    bvcReward: 10
  },
  {
    id: "voies-interdites",
    icon: "fa-road-barrier",
    label: "Respecter les voies interdites",
    description: "Je m'engage à n'emprunter aucune autoroute, voie rapide ou rocade avec mon 50cc ou VSP.",
    loi: "Art. R421-2 — Interdit sur les voies à accès réglementé. Contravention de 4ème classe.",
    bvcReward: 10
  },
  {
    id: "vitesse",
    icon: "fa-gauge-max",
    label: "Adapter ma vitesse aux conditions",
    description: "Je m'engage à respecter les limitations et à réduire ma vitesse par temps de pluie, vent ou brouillard.",
    loi: "Art. R413-17 — Vitesse maximale 45 km/h pour un cyclomoteur. Adaptée aux conditions.",
    bvcReward: 8
  }
];

const signedContrats = new Set();
// Signatures gardées sur le téléphone (avant : profil Firestore) : { idDuContrat: date en ms }
const SIGNES_KEY = "contrats_signes";
const UN_MOIS_MS = 30 * 24 * 60 * 60 * 1000;

function lireSignatures() {
  try {
    return JSON.parse(localStorage.getItem(SIGNES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

async function loadSignedContrats() {
  // Renouvellement mensuel : une signature de plus de 30 jours ne compte plus
  const now = Date.now();
  for (const [id, signedAt] of Object.entries(lireSignatures())) {
    if (now - Number(signedAt) < UN_MOIS_MS) signedContrats.add(id);
  }
}

async function signerContrat(contratId) {
  if (!pointsSouverains || !pointsSouverains.possible()) {
    alert("Tu dois être connecté pour signer un Contrat de Route.");
    return;
  }

  if (signedContrats.has(contratId)) {
    showToast("✅ Tu as déjà signé ce contrat ce mois-ci !");
    return;
  }

  const contrat = CONTRATS.find(c => c.id === contratId);
  if (!contrat) return;

  // Animation de signature
  const card = document.getElementById(`card-${contratId}`);
  card.classList.add('signing');

  try {
    // 50 points sur le serveur du VPS, une seule fois par pilote (les signatures suivantes : 0)
    const { delta } = await pointsSouverains.mouvement({ action: "AWARD", reason: "ROUTER_CONTRAT_SIGNED", amount: 50 });
    localStorage.setItem(SIGNES_KEY, JSON.stringify({ ...lireSignatures(), [contratId]: Date.now() }));

    signedContrats.add(contratId);
    renderContrats();
    showToast(delta > 0
      ? `🏆 +${delta} points mon50cc ! Contrat signé : "${contrat.label}"`
      : `✅ Contrat signé : "${contrat.label}"`);

    // Animer le compteur de points
    updatePointsDisplay();

  } catch (e) {
    console.error("[Contrat de Route] Erreur signature :", e);
    card.classList.remove('signing');
    alert(`Signature non enregistrée : ${messagePoints(e)}`);
  }
}

function renderContrats() {
  const grid = document.getElementById('contrats-grid');
  if (!grid) return;

  // eslint-disable-next-line no-restricted-syntax
grid.innerHTML = CONTRATS.map(c => {
    const isSigned = signedContrats.has(c.id);
    return `
      <div class="contrat-card ${isSigned ? 'signed' : ''}" id="card-${c.id}">
        <div class="contrat-icon">
          <i class="fa-solid ${c.icon}"></i>
        </div>
        <div class="contrat-body">
          <h3 class="contrat-title">${c.label}</h3>
          <p class="contrat-desc">${c.description}</p>
          <p class="contrat-loi"><i class="fa-solid fa-scale-balanced"></i> ${c.loi}</p>
        </div>
        <div class="contrat-footer">
          ${isSigned
            ? `<div class="contrat-signed-badge"><i class="fa-solid fa-circle-check"></i> Signé ce mois-ci</div>`
            : `<button class="btn-signer" data-action="signerContrat('${c.id}')">
                <i class="fa-solid fa-pen-nib"></i> Signer
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

async function updatePointsDisplay() {
  if (!pointsSouverains || !pointsSouverains.possible()) return;
  try {
    const { balance } = await pointsSouverains.soldeEtHistorique(1);
    const el = document.getElementById('bvc-points-display');
    if (el) el.textContent = balance;
  } catch(e) { /* non bloquant */ }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// --- Initialisation ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadSignedContrats();
  renderContrats();
  updatePointsDisplay();
});

// --- Action Registry (ESM) ---
registerAction('loadSignedContrats', loadSignedContrats);
registerAction('signerContrat', signerContrat);
registerAction('renderContrats', renderContrats);
registerAction('updatePointsDisplay', updatePointsDisplay);
registerAction('showToast', showToast);
