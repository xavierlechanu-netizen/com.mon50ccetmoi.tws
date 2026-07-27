/**
 * AR Navigation Module (v85.0)
 * GÃ¨re l'affichage vidÃ©o de la camÃ©ra et la superposition holographique
 */
class ARNavigationManager {
  constructor() {
    this.isActive = false;
    this.videoStream = null;
    this.videoEl = null;
    this.arrowEl = null;
    this.targetHeading = 0; // The direction we want to point to (e.g., North = 0)
    this.currentHeading = 0;
    this.init();
  }

  init() {
    // Create the video overlay if it doesn't exist
    this.videoEl = document.getElementById("ar-overlay");
    if (!this.videoEl) {
      this.videoEl = document.createElement("video");
      this.videoEl.id = "ar-overlay";
      this.videoEl.autoplay = true;
      this.videoEl.playsInline = true;
      this.videoEl.muted = true;
      this.videoEl.style = `
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                object-fit: cover;
                z-index: 0; /* Behind the map */
                display: none;
            `;
      document.body.prepend(this.videoEl);
    }

    // Create the 3D Holographic Arrow
    this.arrowEl = document.getElementById("ar-hologram-arrow");
    if (!this.arrowEl) {
      this.arrowEl = document.createElement("div");
      this.arrowEl.id = "ar-hologram-arrow";
      this.arrowEl.innerHTML = '<i class="fa-solid fa-location-arrow"></i>';
      this.arrowEl.style = `
                position: fixed;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%) rotateX(60deg) translateZ(100px);
                font-size: 8rem;
                color: rgba(0, 242, 255, 0.8);
                filter: drop-shadow(0 0 20px #00f2ff);
                z-index: 50; /* Above the map, below HUD */
                pointer-events: none;
                display: none;
                transition: transform 0.1s ease-out;
            `;
      document.body.appendChild(this.arrowEl);
    }

    // Listen for orientation to adjust the arrow
    window.addEventListener(
      "deviceorientation",
      this.handleOrientation.bind(this),
    );
  }

  async toggleAR() {
    if (this.isActive) {
      this.stopAR();
    } else {
      await this.startAR();
    }
  }

  async startAR() {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      this.videoEl.srcObject = this.videoStream;
      this.videoEl.style.display = "block";
      this.arrowEl.style.display = "block";

      // Make map transparent
      const mapEl = document.getElementById("map");
      if (mapEl) {
        mapEl.style.backgroundColor = "rgba(6, 9, 19, 0.4)";
        mapEl.style.backdropFilter = "blur(2px)";
      }

      document.body.classList.add("ar-mode-active");
      this.isActive = true;

      if (typeof speak === "function") {
        speak(
          "SystÃ¨me optique enclenchÃ©. Affichage tÃªte haute opÃ©rationnel. Attention, ce mode consomme beaucoup d'Ã©nergie, veuillez brancher le tÃ©lÃ©phone si possible.",
        );
      }
      if (
        window.NeuralHUD &&
        typeof window.NeuralHUD.logToConsole === "function"
      ) {
        window.NeuralHUD.logToConsole("AR_SYSTEM: ENGAGED - HUD ACTIVE");
      }
    } catch (err) {
      console.error("Impossible de dÃ©marrer la camÃ©ra AR:", err);
      alert("AccÃ¨s Ã  la camÃ©ra refusÃ© ou non disponible.");
    }
  }

  stopAR() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
    }
    this.videoEl.srcObject = null;
    this.videoEl.style.display = "none";
    this.arrowEl.style.display = "none";

    // Restore map
    const mapEl = document.getElementById("map");
    if (mapEl) {
      mapEl.style.backgroundColor = "#060913";
      mapEl.style.backdropFilter = "none";
    }

    document.body.classList.remove("ar-mode-active");
    this.isActive = false;

    if (typeof speak === "function")
      speak(
        "Affichage tÃªte haute dÃ©sactivÃ©. Retour Ã  la navigation standard.",
      );
    if (
      window.NeuralHUD &&
      typeof window.NeuralHUD.logToConsole === "function"
    ) {
      window.NeuralHUD.logToConsole("AR_SYSTEM: OFFLINE");
    }
  }

  setTargetHeading(heading) {
    this.targetHeading = heading;
  }

  handleOrientation(event) {
    if (!this.isActive) return;

    // Obtain current compass heading (alpha is between 0 and 360)
    // Note: webkitCompassHeading is for iOS, event.alpha for Android/Standard
    let compass = event.webkitCompassHeading;
    if (compass === undefined) {
      compass = 360 - event.alpha;
    }

    this.currentHeading = compass;

    // Calculate the difference to point the arrow towards the target
    let diff = this.targetHeading - this.currentHeading;

    // Normalize diff to -180 to 180
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    // Apply to hologram with 3D perspective
    if (this.arrowEl) {
      this.arrowEl.style.transform = `translate(-50%, -50%) rotateX(60deg) rotateZ(${diff}deg) translateZ(100px)`;
    }
  }
}

// Global Init
window.arNavigationManager = new ARNavigationManager();

// Test Function
window.testARNavigation = function (targetHeadingDeg = 45) {
  if (!window.arNavigationManager.isActive) {
    window.arNavigationManager.startAR().then(() => {
      window.arNavigationManager.setTargetHeading(targetHeadingDeg);
    });
  } else {
    window.arNavigationManager.setTargetHeading(targetHeadingDeg);
  }
};
