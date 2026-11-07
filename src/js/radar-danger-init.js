/**
 * radar-danger-init.js — Démarrage de la détection de chute sur la page radar.
 * Auparavant écrit en ligne dans radar-danger.html (incompatible avec une CSP stricte).
 *
 * Corrigé le 7/11/2026 : le bouton « SIMULER CRASH », prévu pour les tests, s'affichait
 * pour tout le monde en ligne. Il n'apparaît plus qu'en local (développement).
 */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.CrashDetector !== "function") return;
  const crashDetector = new window.CrashDetector({ gForceThreshold: 3.5 });

  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!isLocal) return;

  const simBtn = document.createElement("button");
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-car-burst";
  simBtn.append(icon, " SIMULER CRASH (test local)");
  simBtn.style.cssText = "position:fixed; bottom:20px; left:20px; z-index:99999; background:var(--neon-red); color:#fff; border:none; padding:10px 15px; border-radius:8px; font-weight:bold; cursor:pointer; font-family:var(--font-sans); box-shadow: 0 0 15px rgba(255,0,0,0.5);";
  simBtn.addEventListener("click", () => crashDetector.triggerCrashProtocol(4.8));
  document.body.appendChild(simBtn);
});
