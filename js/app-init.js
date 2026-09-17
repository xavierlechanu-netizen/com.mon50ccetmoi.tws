/**
 * app-init.js — Scripts extraits de app.html (Phase 3 Refactorisation)
 * Sécurisé (Phase 3.5) : Isolation via IIFE, validation backend-first.
 */

(function () {
  'use strict';

  // =====================================================================
  // 1. MARKETPLACE ACCESS CHECK (Zero Trust)
  // =====================================================================
  window.openMarketplaceCheck = async function () {
    // Ne jamais faire confiance à window.session.uid. Utiliser l'état Firebase Auth vérifié.
    const user = typeof firebase !== 'undefined' ? firebase.auth().currentUser : null;
    if (!user) {
      alert("Vous devez être connecté.");
      return;
    }
    
    try {
      const doc = await firebase
        .firestore()
        .collection("users")
        .doc(user.uid)
        .get();
        
      let userPoints = doc.exists ? doc.data().bvcPoints || 0 : 0;

      if (userPoints >= 5) {
        window.location.href = "marketplace.html";
      } else {
        alert(
          "🔒 Accès restreint.\n\nIl vous faut au moins 5 points de bonne conduite pour débloquer la Marketplace.\nVous avez actuellement : " +
            userPoints +
            " point(s).\n\nContinuez à rouler prudemment !",
        );
      }
    } catch (e) {
      console.error(e);
      alert("Erreur de vérification des points. Veuillez vérifier votre connexion.");
    }
  };

  // =====================================================================
  // 2. REVOLUT SDK LAZY LOADER
  // =====================================================================
  window.loadRevolutSDK = function () {
    if (window._revolutLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://merchant.revolut.com/embed.js";
      s.async = true;
      s.onload = () => {
        window._revolutLoaded = true;
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  };

  // =====================================================================
  // 3. SESSION INIT (Removed for Zero Trust)
  // =====================================================================
  // window.session has been purged. All state must be verified via
  // firebase.auth().currentUser and Firestore. No client-side global state.

  // =====================================================================
  // 4. HUD GLITCH EFFECT
  // =====================================================================
  window.triggerHUDGlitch = function () {
    const hud = document.getElementById("obd-hud-screen");
    if (hud && !hud.classList.contains("hidden")) {
      hud.classList.add("hud-glitch-danger");
      setTimeout(() => {
        hud.classList.remove("hud-glitch-danger");
      }, 1500);
    }
  };
  // Chain glitch to fall alert (after 2s to let modules load)
  setTimeout(() => {
    if (window.triggerFallAlert) {
      const originalFall = window.triggerFallAlert;
      window.triggerFallAlert = function (isManual) {
        window.triggerHUDGlitch();
        originalFall(isManual);
      };
    }
  }, 2000);

  // =====================================================================
  // 5. OBD-II US REGION MASKING (Conformité matérielle)
  // =====================================================================
  document.addEventListener("DOMContentLoaded", () => {
    if (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone.startsWith("America/")
    ) {
      const obdBtn = document.getElementById("dock-btn-obd");
      if (obdBtn) {
        obdBtn.style.display = "none";
        console.log(
          "[Nexus Atlas Security] OBD-II module hidden for US region.",
        );
      }
    }
  });

  // =====================================================================
  // 6. INIT APEX SENTINEL + QUANTUM CANVAS + ANALYTICS
  // =====================================================================
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
      let particles = [];
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

      // PERFORMANCE : Pauser l'animation quand l'onglet n'est pas visible
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
          }
        } else {
          if (!animationId) draw();
        }
      });
    }
  });

  // =====================================================================
  // 7. SERVICE WORKER REGISTRATION
  // =====================================================================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js?v=1090000").then(
        (registration) => {
          console.log(
            "ServiceWorker registration successful with scope: ",
            registration.scope,
          );
        },
        (err) => {
          console.log("ServiceWorker registration failed: ", err);
        },
      );
    });
  }

  // =====================================================================
  // 8. BLACKBOX UI BINDING
  // =====================================================================
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.BlackBox) return;

    window.BlackBox.onConnectionChange = (connected) => {
      const btn = document.getElementById("bb-connect-btn");
      const exportBtn = document.getElementById("bb-export-btn");
      if (connected) {
        btn.innerHTML = '<i class="fa-solid fa-unlink"></i> Déconnecter';
        btn.style.background = "linear-gradient(135deg, #555, #333)";
        btn.onclick = () => window.BlackBox.disconnect();
        exportBtn.style.display = "block";
      } else {
        btn.innerHTML =
          '<i class="fa-brands fa-bluetooth"></i> Connecter';
        btn.style.background =
          "linear-gradient(135deg, #ff3333, #aa0000)";
        btn.onclick = () => window.BlackBox.connect();
        exportBtn.style.display = "none";
        document.getElementById("bb-batt").innerText = "-- mV";
        const tamperEl = document.getElementById("bb-tamper");
        if (tamperEl) {
          tamperEl.innerText = "Intact";
          tamperEl.style.color = "#fff";
        }
      }
    };

    window.BlackBox.onDiagnosticUpdate = (diag) => {
      document.getElementById("bb-batt").innerText = diag.battery_mv + " mV";
      const tamperEl = document.getElementById("bb-tamper");
      if (tamperEl) {
        if (diag.tamper_state === 1) {
          tamperEl.innerText = "EFFRACTION!";
          tamperEl.style.color = "#ff0055";
        } else {
          tamperEl.innerText = "Intact";
          tamperEl.style.color = "#fff";
        }
      }
    };

    window.BlackBox.onTelemetryData = (data) => {
      const panel = document.getElementById("blackbox-ui-panel");
      if (panel) {
        panel.style.boxShadow = "0 0 50px rgba(0, 255, 136, 0.5)";
        setTimeout(() => {
          panel.style.boxShadow = "0 0 30px rgba(255, 51, 51, 0.2)";
        }, 200);
      }
    };
  });
})();
