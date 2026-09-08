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

let signedContrats = new Set();
let userProfile = null;

async function loadSignedContrats() {
  if (!window.auth || !window.auth.currentUser) return;
  const uid = window.auth.currentUser.uid;
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists && doc.data().contrats_signes) {
      const signesData = doc.data().contrats_signes;
      // Vérifier si les contrats ont expiré (renouvellement mensuel)
      const now = Date.now();
      for (const [id, data] of Object.entries(signesData)) {
        const signedAt = data.signed_at?.toMillis ? data.signed_at.toMillis() : 0;
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
        if (now - signedAt < oneMonth) {
          signedContrats.add(id);
        }
      }
    }
    userProfile = doc.exists ? doc.data() : {};
  } catch (e) {
    console.warn("[Contrat de Route] Erreur chargement :", e);
  }
}

async function signerContrat(contratId) {
  if (!window.auth || !window.auth.currentUser) {
    alert("Tu dois être connecté pour signer un Contrat de Route.");
    return;
  }

  if (signedContrats.has(contratId)) {
    showToast("✅ Tu as déjà signé ce contrat ce mois-ci !");
    return;
  }

  const contrat = CONTRATS.find(c => c.id === contratId);
  if (!contrat) return;

  const uid = window.auth.currentUser.uid;

  // Animation de signature
  const card = document.getElementById(`card-${contratId}`);
  card.classList.add('signing');

  try {
    // Atomic write dans Firestore
    const updateData = {
      [`contrats_signes.${contratId}`]: {
        signed_at: firebase.firestore.FieldValue.serverTimestamp(),
        label: contrat.label
      },
      bvcPoints: firebase.firestore.FieldValue.increment(contrat.bvcReward)
    };
    await db.collection("users").doc(uid).update(updateData);

    signedContrats.add(contratId);
    renderContrats();
    showToast(`🏆 +${contrat.bvcReward} BVC Points ! Contrat signé : "${contrat.label}"`);

    // Animer le compteur de points
    updatePointsDisplay();

  } catch (e) {
    console.error("[Contrat de Route] Erreur signature :", e);
    card.classList.remove('signing');
    alert("Erreur lors de la signature. Réessaie.");
  }
}

function renderContrats() {
  const grid = document.getElementById('contrats-grid');
  if (!grid) return;

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
            : `<button class="btn-signer" onclick="signerContrat('${c.id}')">
                <i class="fa-solid fa-pen-nib"></i> Signer (+${c.bvcReward} BVC)
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

async function updatePointsDisplay() {
  if (!window.auth || !window.auth.currentUser) return;
  try {
    const doc = await db.collection("users").doc(window.auth.currentUser.uid).get();
    const pts = doc.exists ? (doc.data().bvcPoints || 0) : 0;
    const el = document.getElementById('bvc-points-display');
    if (el) el.textContent = pts;
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
  // Attendre que Firebase Auth soit prêt
  if (window.auth) {
    window.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await loadSignedContrats();
        updatePointsDisplay();
        renderContrats();
      } else {
        // Mode démo sans compte
        renderContrats();
      }
    });
  } else {
    // Affichage sans auth (aperçu)
    renderContrats();
  }
});
