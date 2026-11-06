import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

// INIT APEX SENTINEL
      window.addEventListener("load", () => {
        if (window.QuantumCrypto) window.QuantumCrypto.init();
        if (window.ZeroTrust) window.ZeroTrust.init();

        // Firebase Analytics — Track user engagement
        try {
          if (typeof firebase !== "undefined" && firebase.analytics) {
            window.mon50Analytics = firebase.analytics();
            if (
              window.mon50Analytics &&
              typeof window.mon50Analytics.logEvent === "function"
            ) {
              window.mon50Analytics.logEvent("app_open", {
                version: "110.00.00",
              });
            }
            console.log("mon50cc : Firebase Analytics initialisé.");
          }
        } catch (e) {
          console.warn("Analytics init skipped:", e.message);
        }

        // WebGL / Canvas Holographic Effect (Simplified for performance)
        const canvas = document.getElementById("quantum-bg");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const particles = [];
          let animationId = null;
          for (let i = 0; i < 50; i++) {
            particles.push({
              x: Math.random() * canvas.width,
              y: Math.random() * canvas.height,
              vx: (Math.random() - 0.5) * 0.5,
              vy: (Math.random() - 0.5) * 0.5,
            });
          }
          function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "rgba(0, 255, 204, 0.5)";
            particles.forEach((p) => {
              p.x += p.vx;
              p.y += p.vy;
              if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
              if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
              ctx.fill();
            });
            animationId = requestAnimationFrame(draw);
          }
          draw();

          // PERFORMANCE : Pauser l'animation quand l'onglet n'est pas visible (batterie)
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
              if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
            } else {
              if (!animationId) draw();
            }
          });
        }
      });