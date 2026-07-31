/**
 * ORACLE VOICE ENGINE - Voice Recognition & Commands (PHASE SINGULARITY)
 * Permet au pilote de contrôler l'app sans lâcher le guidon.
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
        "Oracle Voice : Reconnaissance vocale non supportée par ce navigateur.",
      );
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    // Mapping des langues principales, mais on fallback sur n'importe quel dialecte du téléphone (les 7000+ supportés par l'OS)
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
    // Utilise la langue choisie dans l'app, SINON utilise le dialecte exact du téléphone (ex: fr-CA, ar-DZ, sw-KE)
    this.recognition.lang =
      langMap[window.currentLang] || navigator.language || "fr-FR";

    this.recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript
        .trim()
        .toLowerCase();

      this.processCommand(transcript);
    };

    this.recognition.onerror = (e) => {
      // Rate-limit les logs pour éviter le spam console
      const now = Date.now();
      if (now - this.lastErrorTime < 1000) {
        this.errorCount++;
        if (this.errorCount > 3) return; // Stopper le spam silencieusement
      } else {
        if (this.errorCount > 3) {
          console.warn(
            `Oracle Voice : ${this.errorCount} erreurs supprimées.`,
          );
        }
        this.errorCount = 0;
      }
      this.lastErrorTime = now;

      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        console.error(
          "Oracle Voice : Permission micro refusée. Arrêt de la reconnaissance.",
        );
        this.active = false; // STOP â€” ne pas relancer
        const overlay = document.getElementById("oracle-listening-overlay");
        if (overlay) overlay.classList.add("hidden");
        // Informer l'utilisateur une seule fois
        if (typeof speak === "function") {
          speak(
            "Permission micro refusée. Activez le micro dans les paramètres de l'application.",
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
        // Délai anti-spam : éviter les boucles trop rapides
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

    // Protection des performances : Désactiver en Mode Éco (Lite Mode)
    if (window.isLiteMode) {
      console.warn("Oracle Voice : Désactivé car le Mode Éco (Performances) est actif.");
      const overlay = document.getElementById("oracle-listening-overlay");
      if (overlay) overlay.classList.add("hidden");
      return;
    }

    // Demander la permission micro AVANT de lancer la reconnaissance
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Permission accordée â€” libérer le stream immédiatement
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (permErr) {
      console.error("Oracle Voice : Accès micro refusé :", permErr.message);
      if (typeof speak === "function") {
        speak(
          "Accès au micro refusé. Activez le micro dans les paramètres.",
        );
      }
      return; // Ne pas démarrer si le micro est bloqué
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
      speak("Reconnaissance vocale désactivée.");
    } else {
      if (window.isLiteMode) {
        speak("Impossible de lancer la reconnaissance vocale. Désactivez le Mode Éco dans les paramètres pour utiliser Oracle.");
        return;
      }
      this.start();
      speak("Reconnaissance vocale activée.");
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
      // Débridage total : si la langue n'est pas dans la liste, on capte le dialecte natif de l'utilisateur (Android/iOS)
      this.recognition.lang =
        langMap[window.currentLang] || navigator.language || "fr-FR";
    }

    if (wasActive) this.start();
  }

  async processCommand(text) {
    // 1. Détection du mot d'activation avec tolérance
    const activationRegex = /(oracle|ortacle|auracle|oncle|orale|mon\s?50|mon\s?cinquante|voiturette|voturette|vsp|ami|allô)/i;
    if (!activationRegex.test(text)) return;

    vibrate(100);

    // 2. Nettoyage de la commande en retirant le mot d'activation
    let commandText = text.replace(activationRegex, "").trim().toLowerCase();
    
    // Fonction utilitaire pour le dynamisme des réponses
    const reply = (responses) => {
        const msg = Array.isArray(responses) ? responses[Math.floor(Math.random() * responses.length)] : responses;
        speak(msg);
    };

    // Si la commande est vide (juste l'appel du nom)
    if (commandText.length < 3 || commandText.match(/^(es-tu là|tu m'entends|ça va|quoi de neuf)$/i)) {
        reply([
            "Oui, je vous écoute.", 
            "À vos ordres, pilote.", 
            "Système en ligne. Que puis-je faire pour vous ?", 
            "Je suis prêt. Quelle est la destination ?"
        ]);
        return;
    }

    // ── NOUVEAU : TENTATIVE VIA L'INTELLIGENCE ARTIFICIELLE GEMINI ──
    if (window.JarvisGemini && !window.isLiteMode) {
        try {
            const aiResponse = await window.JarvisGemini.ask(commandText);
            
            // L'IA a répondu avec succès
            if (aiResponse.reply) speak(aiResponse.reply);
            
            // Exécution de l'action déduite par l'IA
            switch (aiResponse.action) {
                case "NAVIGATE":
                    let dest = aiResponse.parameter;
                    if (dest) {
                        const input = document.getElementById("route-search");
                        if (input) {
                            input.value = dest;
                            if (typeof window.searchDestination === "function") {
                                window.searchDestination();
                                setTimeout(() => {
                                    if (typeof window.launchNativeGPS === "function") window.launchNativeGPS();
                                }, 2000);
                            }
                        }
                    }
                    break;
                case "SOS":
                    if (window.SOSEmergency) window.SOSEmergency.trigger();
                    else document.getElementById("tim-cook-sos-screen")?.classList.remove("hidden");
                    break;
                case "WEATHER":
                    if (typeof window.updateWeatherUI === "function") window.updateWeatherUI(true);
                    break;
                case "DANGER":
                case "RADAR":
                    if (typeof window.saveHazard === "function") window.saveHazard(aiResponse.action === "DANGER" ? "danger_immediat" : "radar", aiResponse.parameter);
                    break;
                case "DIAGNOSTIC":
                    const modal = document.getElementById("ai-diagnostic-modal");
                    if (modal) {
                        modal.classList.remove("hidden");
                        if (window.PredictiveMeca) window.PredictiveMeca.updateDashboardUI();
                    }
                    break;
                case "DAY_MODE":
                    document.body.classList.add("day-mode");
                    break;
                case "NIGHT_MODE":
                    document.body.classList.remove("day-mode");
                    break;
                case "MARKETPLACE":
                    if (aiResponse.parameter) window.location.href = "marketplace.html?q=" + encodeURIComponent(aiResponse.parameter);
                    break;
                case "MENU":
                    window.toggleMenu();
                    break;
                case "GHOST_MODE":
                    if (window.GhostRider && window.GhostRider.toggleGhostMode) window.GhostRider.toggleGhostMode(true);
                    break;
                case "CORTEGE":
                    if (window.CortegeMode && window.CortegeMode.start) window.CortegeMode.start();
                    break;
                case "LAWYER":
                    if (window.PocketLawyer && window.PocketLawyer.toggleLawyer) window.PocketLawyer.toggleLawyer();
                    break;
                case "LOCK":
                    if (window.SentinelV2 && window.SentinelV2.arm) window.SentinelV2.arm();
                    else if (window.Sentinel && window.Sentinel.arm) window.Sentinel.arm();
                    break;
            }
            // Si l'IA a géré la commande, on s'arrête ici
            return;
        } catch (error) {
            console.warn("Oracle Voice : Gemini indisponible, basculement sur le moteur local.");
            // Si l'API échoue (bloquée ou pas de réseau), on laisse le code ci-dessous prendre le relais (Fallback)
        }
    }

    // 3. Moteur de détection d'intentions (Regex NLP) - FALLBACK LOCAL
    
    // â”€â”€ Dangers & Alertes â”€â”€
    if (commandText.match(/(alerte rouge|danger immédiat|chauffard|accident)/i)) {
        if (typeof window.saveHazard === "function") {
            window.saveHazard("danger_immediat", commandText);
            reply(["Alerte rouge signalée au réseau. Ralentissez immédiatement.", "Danger extrême signalé. Soyez très prudent."]);
        }
    } 
    else if (commandText.match(/(danger|radar|police|contrôle)/i)) {
        if (typeof window.saveHazard === "function") {
            window.saveHazard("radar");
            reply(["C'est noté, j'ai signalé la zone à la communauté.", "Information transmise au réseau. Gardez l'œil ouvert."]);
        }
    }
    // â”€â”€ Vitesse & Dashboard â”€â”€
    else if (commandText.match(/(vitesse|vite|rapide)/i)) {
        const speed = document.getElementById("speed")?.textContent || "0";
        reply([`Vous roulez actuellement à ${speed} kilomètres-heure.`, `Vitesse enregistrée à ${speed} km/h.`]);
    }
    else if (commandText.match(/(kilométrage|distance|combien|parcouru)/i)) {
        const km = window.session?.totalDistance || 0;
        reply([`Vous avez parcouru ${km.toFixed(1)} kilomètres.`, `Le compteur affiche ${km.toFixed(1)} kilomètres pour cette session.`]);
    }
    // â”€â”€ Navigation Intelligente (Extraction) â”€â”€
    else if (commandText.match(/(emmène|amène|aller|navigue|itinéraire|route|guidage)/i)) {
        // Extraction intelligente de la destination
        let dest = commandText
            .replace(/.*(?:emmène(?:-moi)?|amène|aller|naviguer?|itinéraire|vers|à|au)\s+/i, "")
            .replace(/s'il te pla[iî]t/i, "")
            .trim();
            
        const nativeMaps = dest.match(/sur (google )?maps/i);
        const nativeWaze = dest.match(/sur waze/i);
        
        if (nativeMaps) dest = dest.replace(/sur (google )?maps/i, "").trim();
        if (nativeWaze) dest = dest.replace(/sur waze/i, "").trim();

        if (dest && dest.length > 2) {
            const input = document.getElementById("route-search");
            if (input) {
                input.value = dest;
                if (typeof window.searchDestination === "function") {
                    window.searchDestination();
                    
                    if (nativeMaps || nativeWaze) {
                        reply([
                            `Bien reçu. Calcul de la route vers ${dest} et basculement sur votre GPS natif.`,
                            `C'est parti pour ${dest}. Ouverture du GPS externe en cours.`
                        ]);
                        setTimeout(() => {
                            if (typeof window.launchNativeGPS === "function") window.launchNativeGPS();
                        }, 2000);
                    } else {
                         reply([
                             `Calcul de l'itinéraire optimal vers ${dest}.`,
                             `Je cherche la meilleure route pour aller à ${dest}.`
                         ]);
                    }
                }
            }
        } else {
            reply("Je n'ai pas bien compris la destination. Pouvez-vous répéter le nom de la ville ou de la rue ?");
        }
    }
    // â”€â”€ Menu & Thèmes â”€â”€
    else if (commandText.match(/(menu|ouvre|panneau)/i)) {
        window.toggleMenu();
        reply(["Menu ouvert.", "Voici vos options.", "J'ouvre le panneau de contrôle."]);
    }
    else if (commandText.match(/(mode jour|thème clair|il fait beau)/i)) {
        document.body.classList.add("day-mode");
        reply(["Passage en mode jour. Gardez vos lunettes de soleil à portée de main !", "Mode clair activé."]);
    } 
    else if (commandText.match(/(mode nuit|thème sombre|il fait nuit)/i)) {
        document.body.classList.remove("day-mode");
        reply(["Passage en mode nuit. Interface tactique restaurée.", "Mode sombre activé pour reposer vos yeux."]);
    }
    // â”€â”€ Localisation & Météo â”€â”€
    else if (commandText.match(/(où|position|localisation|suis-je)/i)) {
        const pos = window.currentPosition;
        if (pos) reply([`Vos coordonnées actuelles sont latitude ${pos.lat.toFixed(3)} et longitude ${pos.lng.toFixed(3)}.`, "Je vous ai localisé sur la grille. Tout est normal."]);
        else reply("Mes capteurs satellites cherchent encore votre position. Un instant.");
    }
    else if (commandText.match(/(météo|temps|pluie|pleut)/i)) {
        if (commandText.match(/(pleut|pluie)/i) && typeof window.updateWeatherUI === "function") {
            window.updateWeatherUI(true);
            reply("J'ai détecté de la pluie. J'adapte l'affichage et je modifie les paramètres de freinage virtuels.");
        } else {
            const temp = document.getElementById("weather-hud")?.textContent || "inconnue";
            reply([`Mes capteurs indiquent qu'il fait environ ${temp}.`, `La température extérieure est de ${temp}.`]);
        }
    }
    // â”€â”€ Mécanique & Diagnostic â”€â”€
    else if (commandText.match(/(diagnostic|état|santé|mécanique|panne|révision|cassé|bruit)/i)) {
        if (window.PredictiveMeca) {
            const score = Math.round(window.PredictiveMeca.getGlobalHealthScore());
            let message = `Votre machine est opérationnelle à ${score} %.`;
            if (score < 50) message += " Attention, une visite au garage s'impose.";
            else if (score < 85) message += " Pensez à faire une révision bientôt.";
            else message += " Le moteur tourne comme une horloge.";

            reply(message);
            const modal = document.getElementById("ai-diagnostic-modal");
            if (modal) {
                modal.classList.remove("hidden");
                window.PredictiveMeca.updateDashboardUI();
            }
        } else {
            reply("Mes modules de diagnostic sont temporairement indisponibles.");
        }
    }
    // â”€â”€ Urgences (SOS, Constat, Avocat) â”€â”€
    else if (commandText.match(/(mode constat|sos|secours|urgence|accrochage)/i)) {
        reply("Activation du protocole d'urgence. Restez calme, je m'occupe de tout.");
        if (window.SOSEmergency) window.SOSEmergency.trigger();
        else {
            const timCook = document.getElementById("tim-cook-sos-screen");
            if (timCook) timCook.classList.remove("hidden");
        }
    }
    else if (commandText.match(/(avocat|litige)/i)) {
        reply("J'invoque l'avocat de poche. Préparez-vous à exposer votre défense.");
        if (window.PocketLawyer && window.PocketLawyer.toggleLawyer) window.PocketLawyer.toggleLawyer();
    }
    // â”€â”€ Marketplace & Wallet â”€â”€
    else if (commandText.match(/(solde|points|bvc|combien j'ai)/i)) {
        const solde = window.session?.bvc_points || 0;
        reply([`Votre compte affiche ${solde} points BVC.`, `Vous avez ${solde} crédits BVC en banque.`]);
    }
    else if (commandText.match(/(cherche|trouver|acheter)/i)) {
        const query = commandText.replace(/.*(?:cherche|trouver(?: une pièce)?|acheter)\s+/i, "").trim();
        if (query && query.length > 2) {
            reply(`Recherche de "${query}" sur le marché clandestin. Un instant.`);
            window.location.href = "marketplace.html?q=" + encodeURIComponent(query);
        } else {
            reply("Que cherchez-vous exactement sur la Marketplace ?");
        }
    }
    // â”€â”€ Modes Spéciaux (Social, Ghost, Cortège) â”€â”€
    else if (commandText.match(/(équipe|autres|crew|radar)/i)) {
        if (window.SocialRadar) {
            const count = window.SocialRadar.getNearbyCrewCount ? window.SocialRadar.getNearbyCrewCount() : 0;
            reply(count > 0 ? `J'ai détecté ${count} alliés dans le secteur.` : "Radar balayé. Vous êtes seul dans la zone.");
            window.SocialRadar.toggleRadar();
        }
    }
    else if (commandText.match(/(mode cortège|convoi|balade)/i)) {
        reply("Système de convoi enclenché. Regroupement imminent.");
        if (window.CortegeMode && window.CortegeMode.start) window.CortegeMode.start();
    }
    else if (commandText.match(/(mode fantôme|ghost rider)/i)) {
        reply(["Mode furtif activé. Vous avez disparu des radars.", "Brouillage des signaux en cours. Mode Fantôme actif."]);
        if (window.GhostRider && window.GhostRider.toggleGhostMode) window.GhostRider.toggleGhostMode(true);
    }
    else if (commandText.match(/(verrouille|sécurité|alarme)/i)) {
        reply("Boucliers activés. Sentinelle en ligne.");
        if (window.SentinelV2 && window.SentinelV2.arm) window.SentinelV2.arm();
        else if (window.Sentinel && window.Sentinel.arm) window.Sentinel.arm();
    }
    // â”€â”€ Easter Eggs & Conversations â”€â”€
    else if (commandText.match(/(merci|t'es le meilleur|super)/i)) {
        reply(["C'est un plaisir de vous assister.", "À votre service.", "Je suis là pour ça !"]);
    }
    else if (commandText.match(/(blague|raconte|humour)/i)) {
        reply(["Pourquoi les scooters n'ont jamais faim ? Parce qu'ils ont toujours un plein !", "Désolé, ma carte mère manque d'humour aujourd'hui."]);
    }
    else if (commandText.match(/(aide|commande|que peux|que sais)/i)) {
        reply("Je peux lancer le GPS, activer le mode fantôme, analyser la mécanique, ou vous donner la météo. Parlez-moi naturellement !");
    }
    // â”€â”€ Fallback NLP â”€â”€
    else {
        reply([
            "Je n'ai pas saisi votre demande. Pouvez-vous reformuler ?", 
            "La transmission était floue, répétez s'il vous plaît.",
            "Je ne suis pas programmé pour ça... du moins pas encore."
        ]);
    }
  }
}

window.OracleVoice = new OracleVoice();
