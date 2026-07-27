/**
 * ORACLE VOICE ENGINE - Voice Recognition & Commands (PHASE SINGULARITY)
 * Permet au pilote de contrÃ´ler l'app sans lÃ¢cher le guidon.
 */
class OracleVoice {
  constructor() {
    this.recognition = null;
    this.active = false;
    this.errorCount = 0;
    this.lastErrorTime = 0;
    this.setupRecognition();
  }

  setupRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn(
        "Oracle Voice : Reconnaissance vocale non supportÃ©e par ce navigateur.",
      );
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    // Mapping des langues principales, mais on fallback sur n'importe quel dialecte du tÃ©lÃ©phone (les 7000+ supportÃ©s par l'OS)
    const langMap = {
      fr: "fr-FR",
      en: "en-US",
      es: "es-ES",
      it: "it-IT",
      nl: "nl-NL",
      pl: "pl-PL",
      pt: "pt-PT",
      de: "de-DE",
      zh: "zh-CN",
      ja: "ja-JP",
      ro: "ro-RO",
      hk: "zh-HK",
    };
    // Utilise la langue choisie dans l'app, SINON utilise le dialecte exact du tÃ©lÃ©phone (ex: fr-CA, ar-DZ, sw-KE)
    this.recognition.lang =
      langMap[window.currentLang] || navigator.language || "fr-FR";

    this.recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript
        .trim()
        .toLowerCase();

      this.processCommand(transcript);
    };

    this.recognition.onerror = (e) => {
      // Rate-limit les logs pour Ã©viter le spam console
      const now = Date.now();
      if (now - this.lastErrorTime < 1000) {
        this.errorCount++;
        if (this.errorCount > 3) return; // Stopper le spam silencieusement
      } else {
        if (this.errorCount > 3) {
          console.warn(
            `Oracle Voice : ${this.errorCount} erreurs supprimÃ©es.`,
          );
        }
        this.errorCount = 0;
      }
      this.lastErrorTime = now;

      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        console.error(
          "Oracle Voice : Permission micro refusÃ©e. ArrÃªt de la reconnaissance.",
        );
        this.active = false; // STOP â€” ne pas relancer
        const overlay = document.getElementById("oracle-listening-overlay");
        if (overlay) overlay.classList.add("hidden");
        // Informer l'utilisateur une seule fois
        if (typeof speak === "function") {
          speak(
            "Permission micro refusÃ©e. Activez le micro dans les paramÃ¨tres de l'application.",
          );
        }
        return;
      }
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("Oracle Voice Error:", e.error);
      }
    };

    this.recognition.onend = () => {
      if (this.active) {
        // DÃ©lai anti-spam : Ã©viter les boucles trop rapides
        setTimeout(() => {
          if (this.active) {
            try {
              this.recognition.start();
            } catch (e) {}
          }
        }, 300);
      }
    };
  }

  async start() {
    if (!this.recognition || this.active) return;

    // Demander la permission micro AVANT de lancer la reconnaissance
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Permission accordÃ©e â€” libÃ©rer le stream immÃ©diatement
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (permErr) {
      console.error("Oracle Voice : AccÃ¨s micro refusÃ© :", permErr.message);
      if (typeof speak === "function") {
        speak(
          "AccÃ¨s au micro refusÃ©. Activez le micro dans les paramÃ¨tres.",
        );
      }
      return; // Ne pas dÃ©marrer si le micro est bloquÃ©
    }

    this.active = true;
    this.errorCount = 0;
    try {
      this.recognition.start();
    } catch (e) {
      console.error("Start fail:", e);
    }

    const overlay = document.getElementById("oracle-listening-overlay");
    if (overlay) overlay.classList.remove("hidden");
  }

  stop() {
    this.active = false;
    if (this.recognition) this.recognition.stop();

    const overlay = document.getElementById("oracle-listening-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  toggle() {
    if (this.active) {
      this.stop();
      speak("Reconnaissance vocale dÃ©sactivÃ©e.");
    } else {
      this.start();
      speak("Reconnaissance vocale activÃ©e.");
    }
  }

  updateLanguage() {
    const wasActive = this.active;
    this.stop();

    const langMap = {
      fr: "fr-FR",
      en: "en-US",
      es: "es-ES",
      it: "it-IT",
      nl: "nl-NL",
      pl: "pl-PL",
      pt: "pt-PT",
      de: "de-DE",
      zh: "zh-CN",
      ja: "ja-JP",
      ro: "ro-RO",
      hu: "hu-HU",
      cs: "cs-CZ",
      el: "el-GR",
      no: "no-NO",
      fi: "fi-FI",
      da: "da-DK",
      sv: "sv-SE",
      hk: "zh-HK",
    };

    if (this.recognition) {
      // DÃ©bridage total : si la langue n'est pas dans la liste, on capte le dialecte natif de l'utilisateur (Android/iOS)
      this.recognition.lang =
        langMap[window.currentLang] || navigator.language || "fr-FR";
    }

    if (wasActive) this.start();
  }

  processCommand(text) {
    // Trigger principal : "Oracle", "mon 50", "ma voturette", "mon vsp", "ami"
    const triggered =
      text.includes("oracle") ||
      text.includes("mon 50") ||
      text.includes("mon50") ||
      text.includes("voturette") ||
      text.includes("vsp") ||
      text.includes("ami") ||
      text.includes("allÃ´");

    if (!triggered) return;

    vibrate(100);

    // â”€â”€ Dangers & Alertes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (
      text.includes("alerte rouge") ||
      text.includes("danger immÃ©diat") ||
      text.includes("chauffard")
    ) {
      let description = "";
      const triggers = ["alerte rouge", "danger immÃ©diat", "chauffard"];
      for (let t of triggers) {
        if (text.includes(t)) {
          description = text.substring(text.indexOf(t) + t.length).trim();
          break;
        }
      }
      if (typeof window.saveHazard === "function") {
        window.saveHazard("danger_immediat", description);
        speak(
          `Alerte rouge envoyÃ©e${description ? " pour " + description : ""}. Prudence.`,
        );
      } else {
        speak("Je n'ai pas pu signaler le danger.");
      }
    } else if (
      text.includes("danger") ||
      text.includes("radar") ||
      text.includes("police") ||
      text.includes("contrÃ´le")
    ) {
      if (typeof window.saveHazard === "function") {
        window.saveHazard("radar");
        speak("Danger signalÃ© Ã  la communautÃ©. Restez prudent.");
      } else {
        speak(
          "Je n'ai pas pu signaler le danger. La carte n'est pas encore chargÃ©e.",
        );
      }
    }
    // â”€â”€ Vitesse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("vitesse") ||
      text.includes("vite") ||
      text.includes("rapide")
    ) {
      const speed = document.getElementById("speed")?.textContent || "0";
      speak(`Vitesse actuelle : ${speed} km/h.`);
    }
    // â”€â”€ Navigation / Aller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("emmÃ¨ne") ||
      text.includes("amÃ¨ne") ||
      text.includes("aller Ã ") ||
      text.includes("navigue")
    ) {
      const dest = text
        .replace(/.*(?:emmÃ¨ne|amÃ¨ne|aller Ã |navigue(?:r)? vers?)\s+/i, "")
        .trim();
      if (dest) {
        const input = document.getElementById("route-search");
        if (input) {
          input.value = dest;
          if (typeof window.searchDestination === "function")
            window.searchDestination();
          speak(`Calcul de l'itinÃ©raire vers ${dest}.`);
        }
      }
    }
    // â”€â”€ Menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("menu") ||
      text.includes("ouvre") ||
      text.includes("panneau")
    ) {
      window.toggleMenu();
      speak("Ouverture du menu.");
    }
    // â”€â”€ KilomÃ©trage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("kilomÃ©trage") ||
      text.includes("distance") ||
      text.includes("combien") ||
      text.includes("parcouru")
    ) {
      const km = window.session?.totalDistance || 0;
      speak(`Vous avez parcouru ${km.toFixed(1)} kilomÃ¨tres au total.`);
    }
    // â”€â”€ Localisation / Position â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("oÃ¹") ||
      text.includes("position") ||
      text.includes("localisation") ||
      text.includes("suis-je")
    ) {
      const pos = window.currentPosition;
      if (pos) {
        speak(
          `Vous Ãªtes Ã  latitude ${pos.lat.toFixed(4)}, longitude ${pos.lng.toFixed(4)}.`,
        );
      } else {
        speak("Je n'ai pas encore de signal GPS.");
      }
    }
    // â”€â”€ MÃ©tÃ©o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("mÃ©tÃ©o") ||
      text.includes("temps") ||
      text.includes("pluie")
    ) {
      const temp = document.getElementById("weather-hud")?.textContent || "--";
      speak(`La tempÃ©rature affichÃ©e est de ${temp}.`);
    }
    // â”€â”€ Mode Constat / DÃ©fense Juridique â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("mode constat") ||
      text.includes("j'ai un accident") ||
      text.includes("urgence extrÃªme") ||
      text.includes("accrochage")
    ) {
      speak("Mode urgence activÃ©. Ne paniquez pas.");
      if (window.SOSEmergency) {
        window.SOSEmergency.trigger();
      } else {
        const timCook = document.getElementById("tim-cook-sos-screen");
        if (timCook) timCook.classList.remove("hidden");
      }
      if (window.PocketLawyer && window.PocketLawyer.startAudioDefense) {
        setTimeout(() => {
          window.PocketLawyer.startAudioDefense();
        }, 4000); // Attendre la fin du premier message audio
      }
    }
    // â”€â”€ SOS / Urgence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("sos") ||
      text.includes("secours") ||
      text.includes("urgence")
    ) {
      speak("Activation du protocole SOS. Restez immobile.");
      if (window.SOSEmergency) window.SOSEmergency.trigger();
      else {
        const timCook = document.getElementById("tim-cook-sos-screen");
        if (timCook) timCook.classList.remove("hidden");
      }
    }
    // â”€â”€ Premium / Mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (text.includes("mode jour") || text.includes("thÃ¨me clair")) {
      document.body.classList.add("day-mode");
      speak("Mode jour activÃ©. Conduisez prudemment avec ce soleil.");
    } else if (text.includes("mode nuit") || text.includes("thÃ¨me sombre")) {
      document.body.classList.remove("day-mode");
      speak("Mode nuit activÃ©. Interface tactique restaurÃ©e.");
    } else if (text.includes("mon xp") || text.includes("mon niveau")) {
      const xp = window.session?.xp || 0;
      speak(
        "Vous avez  points d'expÃ©rience. Continuez Ã  rouler pour passer au niveau supÃ©rieur !",
      );
    } else if (
      text.includes("il pleut") ||
      text.includes("mÃ©tÃ©o dÃ©taillÃ©e")
    ) {
      if (typeof window.updateWeatherUI === "function")
        window.updateWeatherUI(true);
      speak(
        "Pluie dÃ©tectÃ©e. J'adapte l'affichage et je modifie les paramÃ¨tres d'adhÃ©rence virtuels.",
      );
    }
    // â”€â”€ Diagnostic IA / MÃ©canique â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("diagnostic") ||
      text.includes("Ã©tat") ||
      text.includes("santÃ©") ||
      text.includes("mÃ©canique") ||
      text.includes("panne") ||
      text.includes("rÃ©vision")
    ) {
      if (window.PredictiveMeca) {
        const score = Math.round(window.PredictiveMeca.getGlobalHealthScore());
        let message = `Votre vÃ©hicule est opÃ©rationnel Ã  ${score} %.`;
        if (score < 50)
          message +=
            " Attention, maintenance urgente requise. J'affiche le diagnostic.";
        else if (score < 85)
          message += " Une rÃ©vision est conseillÃ©e. J'affiche le diagnostic.";
        else
          message += " Tout semble en parfait Ã©tat. J'affiche le diagnostic.";

        speak(message);

        const modal = document.getElementById("ai-diagnostic-modal");
        if (modal) {
          modal.classList.remove("hidden");
          window.PredictiveMeca.updateDashboardUI();
        }
      } else {
        speak("L'analyse prÃ©dictive est hors ligne.");
      }
    }
    // â”€â”€ Aide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("aide") ||
      text.includes("commande") ||
      text.includes("que peux") ||
      text.includes("que sais")
    ) {
      speak(
        "Je peux : Signaler un danger, Donner votre vitesse, Naviguer vers une destination, Ouvrir le menu, Donner votre kilomÃ©trage, et activer le SOS. Dites Oracle suivi de votre commande.",
      );
    }
    // â”€â”€ Salutation / Conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else if (
      text.includes("bonjour") ||
      text.includes("salut") ||
      text.includes("coucou") ||
      text.includes("comment")
    ) {
      const hour = new Date().getHours();
      const greet =
        hour < 12 ? "Bonjour" : hour < 18 ? "Bon aprÃ¨s-midi" : "Bonsoir";
      const name = window.session?.username
        ? `, ${window.session.username}`
        : "";
      speak(
        `${greet}${name}. Je suis Oracle, votre copilote intelligent. Dites oracle aide pour connaÃ®tre mes commandes.`,
      );
    }
    // â”€â”€ RÃ©ponse par dÃ©faut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    else {
      speak(
        "Je vous Ã©coute. Dites Oracle aide pour connaÃ®tre mes commandes disponibles.",
      );
    }
  }
}

window.OracleVoice = new OracleVoice();
