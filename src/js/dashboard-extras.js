/**
 * dashboard-extras.js — Animations et thème du tableau de bord.
 * Auparavant écrit en ligne dans dashboard.html (incompatible avec une CSP stricte).
 * (Un module s'exécute avant l'événement DOMContentLoaded : l'écouteur ci-dessous reste valable.)
 */
import { seasonOf } from './season-theme.js';
import { registerAction } from './actionRegistry.js';
import { sovereignRequest } from './sovereign.js';

const PINK_KEY = 'unlockedTheme_Pink'; // lu aussi par season-theme.js (couleur du trajet)

// --- ANIMATION FEU D'ARTIFICE (Nouvel An et 14 Juillet) ---
function createFirework() {
  const firework = document.createElement('div');
  firework.style.position = 'fixed';
  firework.style.left = Math.random() * 100 + 'vw';
  firework.style.top = Math.random() * 100 + 'vh';
  firework.style.width = '5px';
  firework.style.height = '5px';
  firework.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
  firework.style.borderRadius = '50%';
  firework.style.boxShadow = `0 0 10px 5px hsl(${Math.random() * 360}, 100%, 50%)`;
  firework.style.zIndex = '9999';
  firework.style.pointerEvents = 'none';
  
  // Animation CSS inline simple
  firework.animate([
    { transform: 'scale(1) translateY(0)', opacity: 1 },
    { transform: 'scale(20) translateY(-50px)', opacity: 0 }
  ], {
    duration: 1000 + Math.random() * 1000,
    easing: 'ease-out'
  });

  document.body.appendChild(firework);
  setTimeout(() => firework.remove(), 2000);
}

function showSeason() {
  const season = seasonOf();
  if (!season) return;
  const banner = document.getElementById('season-banner');
  if (banner) {
    banner.textContent = season.message;
    banner.hidden = false;
  }
  if (season.fireworks && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    // Lancer quelques feux d'artifice au chargement
    let count = 0;
    const interval = setInterval(() => {
      createFirework();
      createFirework();
      count++;
      if(count > 15) clearInterval(interval); // Arrêter après 15 rafales
    }, 400);
  }
}

// Remplace le contenu d'un bouton par une icône Font Awesome + un texte (sans innerHTML)
function setButtonContent(btn, iconClass, text, iconAfter = false) {
  const icon = document.createElement("i");
  icon.className = iconClass;
  const label = document.createTextNode(text);
  btn.replaceChildren(...(iconAfter ? [label, icon] : [icon, label]));
}

function pinkUnlocked() {
  try { return localStorage.getItem(PINK_KEY) === 'true'; } catch { return false; }
}

function showPinkOwned() {
  const btn = document.getElementById('btn-buy-pink');
  if (!btn) return;
  btn.style.background = 'rgba(0, 230, 118, 0.2)';
  btn.style.color = 'var(--neon-green)';
  setButtonContent(btn, "fa-solid fa-check", " Débloqué à vie !");
  btn.disabled = true;
}

function rememberPink() {
  try { localStorage.setItem(PINK_KEY, 'true'); } catch { /* stockage local indisponible : le serveur le sait */ }
  showPinkOwned();
}

/** Thème Rose : 550 points, achat sur le serveur (shop.js), 1 € reversé à une association contre le cancer du sein par mon50ccetmoi. */
async function buyPinkTheme() {
  if (!confirm("Débloquer le thème GPS Rose pour 550 points ?\n\nPour chaque thème débloqué, 1 € est reversé à une association de lutte contre le cancer du sein par mon50ccetmoi.")) return;
  try {
    await sovereignRequest('/shop/buy', { method: 'POST', body: { item: "THEME_PINK" } });
    rememberPink();
    if (window.BVCManager && typeof window.BVCManager.sync === 'function') window.BVCManager.sync();
  } catch (e) {
    alert(e?.message || "Achat impossible pour le moment.");
  }
}
registerAction('buyPinkTheme', buyPinkTheme);

// Vérifier si déjà débloqué au chargement
document.addEventListener('DOMContentLoaded', () => {
  // 1. Fête du jour : message, et feu d'artifice le cas échéant
  showSeason();

  // 2. Thème Rose : déjà débloqué sur ce téléphone, ou acheté sur un autre (le serveur fait foi)
  if (pinkUnlocked()) showPinkOwned();
  sovereignRequest('/shop', { method: 'GET' })
    .then(({ items }) => { if (items.some((i) => i.id === "THEME_PINK" && i.owned)) rememberPink(); })
    .catch(() => { /* pas connecté ou serveur muet : l'état local reste */ });
});
