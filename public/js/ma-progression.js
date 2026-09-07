/**
 * ma-progression.js — Tableau de bord personnel "Ma Progression"
 * Agrège les données Firestore de l'utilisateur pour afficher :
 * - Score de conduite global (BVC Points)
 * - Progression sur les quiz Nexus Atlas
 * - Contrats de route signés
 * - Signalements de danger effectués
 * - Trajets enregistrés (boîte noire)
 * - Mode Entraîneur : bilan hebdomadaire pour les parents
 */

const PROGRESSION_GEMINI_ENDPOINT = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/askNexusAtlasGemini";

const ENTRAINEUR_SYSTEM_PROMPT = `
Tu es Nexus Atlas, assistant de sécurité routière pour l'application mon50ccetmoi.
Tu dois générer un BILAN HEBDOMADAIRE de conduite pour les parents d'un jeune conducteur de 50cc.

Les données fournies viennent de la boîte noire et de l'application. Tu dois :
1. Résumer les points positifs (équipement respecté, quiz réussis, signalements communautaires).
2. Identifier les axes d'amélioration avec des conseils bienveillants.
3. Donner un score global de sécurité sur 100.
4. Rappeler les règles prioritaires à travailler.

IMPORTANT :
- Sois bienveillant et pédagogique. Le but n'est pas de punir le conducteur.
- Rappelle que tu es une IA d'assistance et que le parent doit dialoguer avec son enfant.
- N'invente pas de données non fournies.

FORMAT JSON OBLIGATOIRE :
{
  "score_global": 75,
  "resume_positif": "HTML court avec les bons points",
  "axes_amelioration": "HTML court avec les points à améliorer",
  "conseil_semaine": "Un conseil personnalisé court et motivant"
}
`;

// --- Chargement des données utilisateur ---
async function loadUserProgression() {
  if (!window.auth || !window.auth.currentUser) return null;
  const uid = window.auth.currentUser.uid;

  try {
    const [userDoc, contratsSnap, signalementsSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('users').doc(uid).get(), // Contrats dans le doc user
      db.collection('hazards').where('uid', '==', uid).limit(50).get()
    ]);

    const userData = userDoc.exists ? userDoc.data() : {};
    const contratsSignes = userData.contrats_signes || {};
    const nbContratsActifs = Object.keys(contratsSignes).filter(id => {
      const data = contratsSignes[id];
      const signedAt = data.signed_at?.toMillis ? data.signed_at.toMillis() : 0;
      return Date.now() - signedAt < 30 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      uid,
      bvcPoints: userData.bvcPoints || 0,
      displayName: userData.displayName || 'Conducteur',
      vehicule: userData.vehicule || '50cc',
      contratsActifs: nbContratsActifs,
      signalementsTotal: signalementsSnap.size,
      membre_depuis: userData.created_at ? userData.created_at.toDate() : null,
    };
  } catch (e) {
    console.error('[Ma Progression] Erreur chargement:', e);
    return null;
  }
}

// --- Rendu Principal ---
async function renderProgression() {
  const container = document.getElementById('progression-container');
  if (!container) return;

  container.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Chargement de ta progression...</div>`;

  const data = await loadUserProgression();

  if (!data) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-user-lock"></i>
      <p>Connecte-toi pour voir ta progression.</p>
      <a href="login.html" class="btn-primary">Se connecter</a>
    </div>`;
    return;
  }

  // Calcul du score de sécurité (0-100)
  const securityScore = computeSecurityScore(data);

  container.innerHTML = `
    <!-- Score Hero -->
    <div class="score-hero">
      <div class="score-ring-container">
        <svg class="score-ring" viewBox="0 0 120 120">
          <circle class="ring-bg" cx="60" cy="60" r="52" />
          <circle class="ring-fill" cx="60" cy="60" r="52"
            stroke-dasharray="${2 * Math.PI * 52}"
            stroke-dashoffset="${2 * Math.PI * 52 * (1 - securityScore / 100)}"
            style="stroke: ${scoreColor(securityScore)};" />
        </svg>
        <div class="score-value">
          <span class="score-number">${securityScore}</span>
          <span class="score-label">/ 100</span>
        </div>
      </div>
      <div class="score-info">
        <h2 class="score-name">${data.displayName}</h2>
        <p class="score-vehicle"><i class="fa-solid fa-motorcycle"></i> ${data.vehicule}</p>
        <div class="score-badge" style="background: ${scoreColor(securityScore)}22; border-color: ${scoreColor(securityScore)};">
          <span style="color: ${scoreColor(securityScore)}">${scoreBadge(securityScore)}</span>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card gold">
        <div class="stat-icon"><i class="fa-solid fa-coins"></i></div>
        <div class="stat-value">${data.bvcPoints}</div>
        <div class="stat-label">BVC Points</div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-icon"><i class="fa-solid fa-pen-nib"></i></div>
        <div class="stat-value">${data.contratsActifs}</div>
        <div class="stat-label">Contrats signés</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="stat-value">${data.signalementsTotal}</div>
        <div class="stat-label">Dangers signalés</div>
      </div>
    </div>

    <!-- Barre de niveau BVC -->
    <div class="level-card">
      <div class="level-header">
        <span class="level-title">Niveau de Conducteur</span>
        <span class="level-badge">${getBvcLevel(data.bvcPoints).name}</span>
      </div>
      <div class="level-bar-bg">
        <div class="level-bar-fill" style="width: ${getBvcLevel(data.bvcPoints).progress}%; background: ${getBvcLevel(data.bvcPoints).color};"></div>
      </div>
      <div class="level-next">
        <span>Prochain niveau : <strong>${getBvcLevel(data.bvcPoints).next}</strong></span>
        <span>${data.bvcPoints} / ${getBvcLevel(data.bvcPoints).threshold} pts</span>
      </div>
    </div>

    <!-- Mode Entraîneur -->
    <div class="entraineur-card">
      <div class="entraineur-header">
        <div>
          <h3 class="entraineur-title"><i class="fa-solid fa-user-shield"></i> Mode Entraîneur</h3>
          <p class="entraineur-desc">Génère un bilan hebdomadaire IA pour les parents.</p>
        </div>
        <button class="btn-bilan" id="btn-bilan" onclick="genererBilanEntraineur()">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Générer le bilan
        </button>
      </div>
      <div id="bilan-content" class="bilan-content"></div>
    </div>

    <!-- Actions rapides -->
    <div class="quick-actions">
      <a href="code-de-la-route.html" class="quick-btn">
        <i class="fa-solid fa-microchip"></i>
        <span>Quiz Nexus Atlas</span>
      </a>
      <a href="contrat-de-route.html" class="quick-btn">
        <i class="fa-solid fa-pen-nib"></i>
        <span>Contrat de Route</span>
      </a>
      <a href="radar-danger.html" class="quick-btn">
        <i class="fa-solid fa-radar"></i>
        <span>Radar Danger</span>
      </a>
    </div>
  `;
}

async function genererBilanEntraineur() {
  const btn = document.getElementById('btn-bilan');
  const content = document.getElementById('bilan-content');
  if (!btn || !content) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyse en cours...';
  content.innerHTML = '';

  try {
    const data = await loadUserProgression();
    if (!data) throw new Error('No data');

    if (!window.auth || !window.auth.currentUser) throw new Error('Not auth');

    const idToken = await window.auth.currentUser.getIdToken(true);
    const dataStr = `Conducteur: ${data.displayName}. BVC Points: ${data.bvcPoints}. Contrats actifs ce mois: ${data.contratsActifs}/5. Dangers signalés: ${data.signalementsTotal}. Score de sécurité calculé: ${computeSecurityScore(data)}/100.`;

    const response = await fetch(PROGRESSION_GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({
        systemPrompt: ENTRAINEUR_SYSTEM_PROMPT,
        history: [{ role: 'user', parts: [{ text: dataStr }] }]
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const apiData = await response.json();
    let raw = apiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (raw.includes('```json')) raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    const bilan = JSON.parse(raw.trim());

    content.innerHTML = `
      <div class="bilan-score-line">
        <span>Score IA cette semaine :</span>
        <span class="bilan-score-val" style="color: ${scoreColor(bilan.score_global)}">${bilan.score_global}/100</span>
      </div>
      <div class="bilan-section green">
        <strong>✅ Points positifs</strong>
        <div>${bilan.resume_positif}</div>
      </div>
      <div class="bilan-section orange">
        <strong>💡 Axes d'amélioration</strong>
        <div>${bilan.axes_amelioration}</div>
      </div>
      <div class="bilan-section cyan">
        <strong>🎯 Conseil de la semaine</strong>
        <div>${bilan.conseil_semaine}</div>
      </div>
      <p class="bilan-disclaimer"><i class="fa-solid fa-scale-balanced"></i> Bilan généré par l'IA Nexus Atlas à titre d'assistance uniquement. Discutez-en ensemble !</p>
    `;
  } catch (e) {
    console.error('[Entraîneur] Erreur:', e);
    content.innerHTML = `<p class="error-text">Erreur lors de la génération du bilan. Réessaie dans un moment.</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Générer le bilan';
  }
}

// --- Fonctions utilitaires ---
function computeSecurityScore(data) {
  let score = 40; // Base
  score += Math.min(data.bvcPoints * 0.5, 30); // Max 30pts pour les BVC
  score += data.contratsActifs * 4; // 4pts par contrat actif (max 20)
  score += Math.min(data.signalementsTotal * 2, 10); // Max 10pts pour les signalements
  return Math.min(Math.round(score), 100);
}

function scoreColor(score) {
  if (score >= 80) return '#00e676';
  if (score >= 60) return '#ffb703';
  if (score >= 40) return '#ff9800';
  return '#ff0055';
}

function scoreBadge(score) {
  if (score >= 80) return '🏆 Conducteur Exemplaire';
  if (score >= 60) return '✅ Conducteur Prudent';
  if (score >= 40) return '⚠️ Conducteur en Progression';
  return '🔴 Conducteur à Risque';
}

function getBvcLevel(points) {
  const levels = [
    { name: 'Débutant', threshold: 50, color: '#aaa', next: 'Attentif' },
    { name: 'Attentif', threshold: 100, color: '#3399ff', next: 'Prudent' },
    { name: 'Prudent', threshold: 200, color: '#00e676', next: 'Confirmé' },
    { name: 'Confirmé', threshold: 500, color: '#ffb703', next: 'Expert' },
    { name: 'Expert', threshold: 1000, color: '#ff6600', next: 'Légende' },
    { name: 'Légende', threshold: 9999, color: '#e040fb', next: 'MAX' },
  ];
  const level = levels.find(l => points < l.threshold) || levels[levels.length - 1];
  const prev = levels[levels.indexOf(level) - 1];
  const prevThreshold = prev ? prev.threshold : 0;
  const progress = ((points - prevThreshold) / (level.threshold - prevThreshold)) * 100;
  return { ...level, progress: Math.min(Math.round(progress), 100) };
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  if (window.auth) {
    window.auth.onAuthStateChanged(user => {
      renderProgression();
    });
  } else {
    renderProgression();
  }
});
