/* --- J.A.R.V.I.S. 4.0 PROPRIETARY NEURAL ENGINE --- */

window.JarvisEngine = {
  context: {
    lastIntent: null,
    userMood: "neutral",
  },

  // RÃ©ponses dynamiques pour Ã©viter l'effet "robot"
  responses: {
    ack: [
      "Bien reÃ§u.",
      "Je m'en occupe.",
      "Analyse en cours.",
      "Compris, pilote.",
    ],
    search: [
      "Je lance la recherche.",
      "Recherche dans la base de donnÃ©es locale.",
      "Cartographie en cours.",
    ],
    error: [
      "Je n'ai pas compris cette instruction.",
      "Veuillez reformuler, pilote.",
      "Instruction non reconnue par mes protocoles.",
    ],
    jokes: [
      "Que fait un motard quand il a froid ? Il se rapproche du pot d'Ã©chappement.",
      "Pourquoi les motards sont-ils toujours heureux ? Parce qu'on ne peut pas pleurer avec un casque intÃ©gral.",
      "Quel est le comble pour un mÃ©canicien scooter ? C'est de perdre la boule !",
    ],
  },

  getRandomResponse: function (type) {
    const arr = this.responses[type] || this.responses.ack;
    return arr[Math.floor(Math.random() * arr.length)];
  },

  speak: function (text) {
    if (typeof window.speak === "function") {
      window.speak(text);
    } else if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.pitch = 0.9; // Voix lÃ©gÃ¨rement plus grave
      utterance.rate = 1.05; // Rythme naturel mais rÃ©actif
      window.speechSynthesis.speak(utterance);
    } else {
    }
  },

  processQuery: function (transcript) {
    const t = transcript.toLowerCase();

    // 1. DÃ©tection d'intentions complexes (Intent Parsing)

    // Appel d'Urgence / SOS
    if (
      this.matchAny(t, [
        "urgence",
        "accident grave",
        "secours",
        "police",
        "samu",
        "pompier",
        "pompiers",
        "aide-moi",
      ])
    ) {
      return {
        action: "EMERGENCY_CALL",
        reply: `Attention. Mode urgence activÃ©. Je prÃ©pare l'appel aux services de secours.`,
      };
    }
    // Comparaison Carburant
    else if (
      this.matchAny(t, ["essence", "carburant", "plein", "station", "sec"]) &&
      this.matchAny(t, ["moins cher", "prix", "compare", "oÃ¹"])
    ) {
      return {
        action: "COMPARE_GAS_PRICES",
        reply: `Analyse des prix du carburant dans un rayon de 3 kilomÃ¨tres en cours.`,
      };
    } else if (this.matchAny(t, ["essence", "station", "carburant", "sec"])) {
      return {
        action: "COMPARE_GAS_PRICES",
        reply: `${this.getRandomResponse("search")} J'affiche le radar communautaire des prix du carburant.`,
      };
    }
    // Navigation SpÃ©cifique
    else if (
      this.matchAny(t, [
        "emmÃ¨ne-moi",
        "itinÃ©raire vers",
        "aller Ã ",
        "guidage vers",
      ])
    ) {
      // Extraction basique de la destination
      let destination = "votre destination";
      const navKeywords = ["vers", "Ã  "];
      for (let kw of navKeywords) {
        if (t.includes(kw)) {
          destination = t.split(kw)[1].trim();
          break;
        }
      }
      return {
        action: "NAVIGATE_TO",
        payload: destination,
        reply: `Calcul de l'itinÃ©raire optimal vers ${destination}.`,
      };
    }
    // Maison
    else if (this.matchAny(t, ["maison", "domicile", "rentrer", "retour"])) {
      return {
        action: "GO_HOME",
        reply: `Calcul du trajet vers votre domicile. ${this.getRandomResponse("ack")}`,
      };
    }
    // Signalements (Dangers / Animaux / Police)
    else if (this.matchAny(t, ["accident", "danger", "obstacle", "travaux"])) {
      return {
        action: "REPORT_HAZARD",
        reply: `Danger signalÃ© Ã  la meute. Merci pour votre vigilance.`,
      };
    } else if (
      this.matchAny(t, ["animal", "animaux", "biche", "sanglier", "chien"])
    ) {
      return {
        action: "REPORT_ANIMAL",
        reply: `PrÃ©sence animale confirmÃ©e et partagÃ©e. Soyez prudent.`,
      };
    } else if (this.matchAny(t, ["radar", "flics", "contrÃ´le", "police"])) {
      return {
        action: "REPORT_POLICE",
        reply: `Zone de contrÃ´le signalÃ©e sur le radar communautaire.`,
      };
    }
    // Social
    else if (
      this.matchAny(t, [
        "meute",
        "amis",
        "social",
        "radar social",
        "pilotes",
        "motards",
      ])
    ) {
      return {
        action: "SOCIAL_RADAR",
        reply: `Activation du balayage social. Recherche de pilotes alliÃ©s dans le secteur.`,
      };
    }
    // Modes de conduite
    else if (
      this.matchAny(t, ["sensation", "virage", "sport", "attaque", "balade"])
    ) {
      return {
        action: "SENSATION_MODE",
        reply: `Mode sensation engagÃ©. Optimisation de l'itinÃ©raire pour le plaisir de conduite.`,
      };
    }
    // Diagnostic Moto
    else if (
      this.matchAny(t, [
        "diagnostic",
        "Ã©tat",
        "santÃ©",
        "mÃ©canique",
        "panne",
        "moteur",
      ])
    ) {
      return {
        action: "AI_DIAGNOSTIC",
        reply: `J'ouvre le panneau de tÃ©lÃ©mÃ©trie prÃ©dictive de votre engin.`,
      };
    }
    // MÃ©tÃ©o
    else if (
      this.matchAny(t, [
        "mÃ©tÃ©o",
        "temps",
        "pluie",
        "pleuvoir",
        "froid",
        "chaud",
      ])
    ) {
      return {
        action: "WEATHER_CHECK",
        reply: `Je vÃ©rifie les conditions mÃ©tÃ©orologiques sur votre parcours actuel.`,
      };
    }
    // Profil
    else if (
      this.matchAny(t, [
        "mon score",
        "mon profil",
        "mes points",
        "mes statistiques",
      ])
    ) {
      return {
        action: "OPEN_PROFILE",
        reply: `Affichage de vos statistiques et de votre profil de pilote.`,
      };
    }
    // Statistiques de l'application
    else if (
      this.matchAny(t, [
        "combien d'utilisateurs",
        "statistiques",
        "tÃ©lÃ©chargements",
        "audience",
        "pays",
      ])
    ) {
      return {
        action: "APP_STATS",
        reply: `D'aprÃ¨s mes derniÃ¨res analyses en date du 4 juillet 2026, l'application compte 4 installations uniques. 3 pilotes sont en France, et nous avons 1 pilote en IndonÃ©sie.`,
      };
    }
    // IdentitÃ© / Blague
    else if (this.matchAny(t, ["blague", "humour", "fais-moi rire"])) {
      return { action: "JOKE", reply: this.getRandomResponse("jokes") };
    } else if (
      this.matchAny(t, [
        "qui es-tu",
        "ton nom",
        "t'appelles",
        "que sais-tu faire",
      ])
    ) {
      return {
        action: "IDENTITY",
        reply: `Je suis Jarvis, l'intelligence artificielle de Mon 50cc et Moi. Je suis connectÃ© Ã  votre tÃ©lÃ©mÃ©trie, au rÃ©seau communautaire et prÃªt Ã  vous assister sur la route.`,
      };
    } else if (
      this.matchAny(t, [
        "drogue",
        "stupÃ©fiant",
        "stupÃ©fiants",
        "positif",
        "fumÃ©",
        "joint",
        "cannabis",
        "thc",
        "dÃ©pistage",
        "test",
      ])
    ) {
      return {
        action: "DRUGS_WARNING",
        reply: `Conduire sous l'emprise de stupÃ©fiants avec un BSR ou Permis AM est un dÃ©lit grave. Pour une premiÃ¨re infraction, vous risquez jusqu'Ã  4500 euros d'amende, 2 ans de prison, l'immobilisation ou la confiscation de votre scooter, et la suspension de votre permis AM. Bien qu'il n'y ait pas de perte de points sur le BSR, les sanctions pÃ©nales sont trÃ¨s lourdes.`,
      };
    } else {
      return { action: "UNKNOWN", reply: this.getRandomResponse("error") };
    }
  },

  matchAny: function (text, keywords) {
    return keywords.some((kw) => text.includes(kw));
  },

  executeAction: function (result) {
    // Retour visuel (si disponible dans le DOM)
    const jarvisFeedback = document.getElementById("jarvis-feedback-text");
    if (jarvisFeedback) {
      jarvisFeedback.innerText = result.reply;
      jarvisFeedback.classList.add("visible");
      setTimeout(() => jarvisFeedback.classList.remove("visible"), 5000);
    }

    if (result.reply) {
      this.speak(result.reply);
    }

    switch (result.action) {
      case "EMERGENCY_CALL":
        if (typeof window.triggerSOS === "function") window.triggerSOS();
        else alert("âš ï¸ URGENCE : Appeler le 112");
        break;
      case "COMPARE_GAS_PRICES":
        if (typeof window.CommunityGas === "object") {
          window.CommunityGas.compareAndShow();
        }
        break;
      case "NAVIGATE_TO":
        if (document.getElementById("route-search"))
          document.getElementById("route-search").value = result.payload;
        if (typeof window.searchDestination === "function")
          window.searchDestination();
        break;
      case "GO_HOME":
        if (document.getElementById("route-search"))
          document.getElementById("route-search").value = "Domicile";
        if (typeof window.searchDestination === "function")
          window.searchDestination();
        break;
      case "REPORT_HAZARD":
        if (typeof window.reportHazard === "function")
          window.reportHazard("danger");
        break;
      case "REPORT_ANIMAL":
        if (typeof window.reportHazard === "function")
          window.reportHazard("animal");
        break;
      case "REPORT_POLICE":
        if (typeof window.reportHazard === "function")
          window.reportHazard("police");
        break;
      case "SOCIAL_RADAR":
        if (typeof window.toggleSocialRadar === "function")
          window.toggleSocialRadar();
        break;
      case "SENSATION_MODE":
        if (typeof window.toggleSensationMode === "function")
          window.toggleSensationMode();
        break;
      case "AI_DIAGNOSTIC":
        const modal = document.getElementById("ai-diagnostic-modal");
        if (modal) {
          modal.classList.remove("hidden");
          if (window.PredictiveMeca) window.PredictiveMeca.updateDashboardUI();
        }
        break;
      case "WEATHER_CHECK":
        if (typeof window.showWeatherWidget === "function")
          window.showWeatherWidget();
        break;
      case "OPEN_PROFILE":
        if (typeof window.openProfile === "function") window.openProfile();
        else window.location.href = "/profil.html";
        break;
      case "DRUGS_WARNING":
        console.warn(
          "[J.A.R.V.I.S 4.0] PrÃ©vention stupÃ©fiants dÃ©clenchÃ©e.",
        );
        break;
    }
  },
};

window.initVoiceAI = function () {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("Reconnaissance vocale non supportÃ©e sur ce navigateur.");
    return;
  }

  window.voiceAI = new SpeechRecognition();
  window.voiceAI.continuous = true;
  window.voiceAI.interimResults = false;
  window.voiceAI.lang = "fr-FR";

  window.voiceAI.onstart = function () {
    const micIcon = document.getElementById("jarvis-mic-icon");
    if (micIcon) {
      micIcon.style.color = "#00d2ff"; // Couleur UI Gemini/IA
      micIcon.classList.add("fa-fade");
      micIcon.style.transform = "scale(1.2)";
    }
  };

  window.voiceAI.onresult = function (event) {
    const current = event.resultIndex;
    const transcript = event.results[current][0].transcript.toLowerCase();

    // Feedback utilisateur
    const jarvisFeedback = document.getElementById("jarvis-feedback-text");
    if (
      jarvisFeedback &&
      !transcript.includes("oracle") &&
      !transcript.includes("systÃ¨me") &&
      !transcript.includes("jarvis")
    ) {
      jarvisFeedback.innerText = "Vous : " + transcript;
      jarvisFeedback.classList.add("visible");
    }

    // Si le mot clÃ© de rÃ©veil est utilisÃ©
    if (
      transcript.includes("oracle") ||
      transcript.includes("systÃ¨me") ||
      transcript.includes("jarvis")
    ) {
      // Extraction de la commande aprÃ¨s le mot clÃ© pour plus de prÃ©cision
      let command = transcript;
      ["oracle", "systÃ¨me", "jarvis"].forEach((kw) => {
        if (transcript.includes(kw)) {
          command = transcript.split(kw)[1].trim() || transcript;
        }
      });

      // Si la commande est vide aprÃ¨s "jarvis"
      if (command.length < 2) {
        window.JarvisEngine.speak("Ã€ vos ordres, pilote.");
        return;
      }

      const result = window.JarvisEngine.processQuery(command);
      window.JarvisEngine.executeAction(result);
    }
  };

  window.voiceAI.onerror = function (event) {
    console.warn("[J.A.R.V.I.S 4.0] Erreur micro : ", event.error);
    const micIcon = document.getElementById("jarvis-mic-icon");
    if (micIcon) {
      micIcon.style.color = "#ff0055";
      micIcon.classList.remove("fa-fade");
      micIcon.style.transform = "scale(1)";
    }
  };

  window.voiceAI.onend = function () {
    const micIcon = document.getElementById("jarvis-mic-icon");
    if (micIcon) {
      micIcon.style.transform = "scale(1)";
      micIcon.classList.remove("fa-fade");
      micIcon.style.color = "";
    }

    setTimeout(() => {
      try {
        window.voiceAI.start();
      } catch (e) {}
    }, 1000);
  };

  try {
    window.voiceAI.start();
  } catch (e) {
    console.error("Impossible de dÃ©marrer l'IA vocale : ", e);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (
      localStorage.getItem("cnil_consent") === "true" &&
      localStorage.getItem("cnil_mic") !== "false"
    ) {
      window.initVoiceAI();
    }
  }, 5000);
});
