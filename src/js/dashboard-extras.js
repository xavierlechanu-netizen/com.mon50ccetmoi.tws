/**
 * dashboard-extras.js — Animations et thème du tableau de bord.
 * Auparavant écrit en ligne dans dashboard.html (incompatible avec une CSP stricte).
 * (Un module s'exécute avant l'événement DOMContentLoaded : l'écouteur ci-dessous reste valable.)
 */
// --- ANIMATION FEU D'ARTIFICE (1er et 2 Janvier) ---
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

function checkNewYearFireworks() {
  const today = new Date();
  // getMonth() === 0 -> Janvier. getDate() <= 2 -> Le 1er ou le 2.
  if (today.getMonth() === 0 && (today.getDate() === 1 || today.getDate() === 2)) {
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

document.addEventListener('DOMContentLoaded', checkNewYearFireworks);
