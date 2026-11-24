/**
 * dashboard-extras.js — Animations et thème du tableau de bord.
 * Auparavant écrit en ligne dans dashboard.html (incompatible avec une CSP stricte).
 * (Un module s'exécute avant l'événement DOMContentLoaded : l'écouteur ci-dessous reste valable.)
 */
import { seasonOf } from './season-theme.js';

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

// Vérifier si déjà débloqué au chargement
document.addEventListener('DOMContentLoaded', () => {
  // 1. Fête du jour : message, et feu d'artifice le cas échéant
  showSeason();

  // 2. Déblocage du thème Rose
  if (localStorage.getItem('unlockedTheme_Pink') === 'true') {
    const btn = document.getElementById('btn-buy-pink');
    if(btn) {
      btn.style.background = 'rgba(0, 230, 118, 0.2)';
      btn.style.color = 'var(--neon-green)';
      setButtonContent(btn, "fa-solid fa-check", " Débloqué à vie !");
      btn.disabled = true;
    }
  }
});
