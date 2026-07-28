/**
 * ⚖️ POCKET LAWYER - MODULE DE DÉFENSE JURIDIQUE
 * Analyse du stationnement (Code de la Route FR : R417-10 et R417-11)
 */

window.PocketLawyer = {
  isOpen: false,

  // Scénarios simulés pour l'environnement GPS actuel
  scenarios: [
    {
      type: "Trottoir (Large)",
      status: "TOLERANCE",
      icon: "fa-solid fa-scale-balanced",
      color: "#ffb703", // Orange
      law: "R417-10 (Très Gênant / Gênant)",
      verdict:
        "Stationnement techniquement interdit mais couramment toléré si le passage des piétons n'est pas entravé.",
      defense:
        "Plaidoirie : L'espace laissé libre (plus de 1m50) permet le passage des poussettes et PMR. Aucune entrave caractérisée. S'il y a amende (135€ ou 35€), vous pouvez invoquer l'absence de signalisation claire ou le manque de places 2RM.",
      letterTemplate:
        "Monsieur l'Officier du Ministère Public,\nJe conteste le PV n°XXX.\nLe stationnement de mon cyclomoteur ne constituait pas une entrave à la circulation piétonne (largeur libre > 1,50m) et palliait un manque avéré de stationnement 2RM dans ce secteur.",
    },
    {
      type: "Place 2-Roues Motorisés",
      status: "AUTORISE",
      icon: "fa-solid fa-check-double",
      color: "#00e676", // Vert
      law: "R417-6 (Régulier)",
      verdict: "Vous êtes parfaitement en règle.",
      defense:
        "Plaidoirie : Véhicule stationné sur un emplacement dédié et matérialisé. Si la place est devenue payante (ex: Paris), assurez-vous d'avoir pris un ticket numérique ou le Pass 2RM.",
      letterTemplate: "",
    },
    {
      type: "Passage Piéton / Piste Cyclable",
      status: "INTERDIT",
      icon: "fa-solid fa-gavel",
      color: "#ff4d4d", // Rouge
      law: "R417-11 (Très Gênant)",
      verdict:
        "Stationnement strictement interdit. Risque de mise en fourrière immédiate et 135€ d'amende.",
      defense:
        "Plaidoirie : Difficilement contestable (mise en danger d'autrui). Seule option : vice de forme sur le PV (erreur de plaque, de rue ou de date).",
      letterTemplate:
        "Monsieur l'Officier,\nJe conteste ce PV sur la base d'un vice de forme caractérisé (erreur matérielle sur le lieu exact de l'infraction visé).",
    },
    {
      type: "Place Auto (Voiture)",
      status: "TOLERANCE",
      icon: "fa-solid fa-car",
      color: "#ffb703",
      law: "R417-10",
      verdict:
        "Toléré si vous payez le stationnement (si applicable). Attention à ne pas bloquer une voiture.",
      defense:
        "Plaidoirie : Le code de la route n'interdit pas aux 2RM de se garer sur les places voitures, mais c'est mal vu. En cas de stationnement payant, le reçu fait foi.",
      letterTemplate: "",
    },
  ],

  toggleLawyer: function () {
    if (this.isOpen) {
      this.closeLawyer();
    } else {
      this.openLawyer();
    }
  },

  openLawyer: function () {
    if (typeof window.braveCoins === "undefined") {
      alert("Erreur: Module de fidélité introuvable.");
      return;
    }

    const price = 5; // 5 Pts BVC constants
    if (window.braveCoins < price) {
      alert(
        `Fonds insuffisants ! Vous avez besoin de ${price} Pts BVC pour accéder à l'Avocat de Poche. Roulez plus pour en gagner.`,
      );
      return;
    }

    this.isOpen = true;
    let overlay = document.getElementById("lawyer-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "lawyer-overlay";
      overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 15, 25, 0.95); z-index: 50000;
                display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
                padding-top: 50px; overflow-y: auto; color: #fff; font-family: 'Inter', sans-serif;
                backdrop-filter: blur(15px);
            `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = "flex";
    }

    overlay.innerHTML = `
            <button onclick="PocketLawyer.closeLawyer()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-scale-balanced fa-beat-fade" style="font-size: 3rem; color: #cca300; filter: drop-shadow(0 0 10px #cca300); margin-bottom: 5px;"></i>
            <h1 style="font-size: 1.5rem; margin: 0; text-transform: uppercase; color: #cca300;">Avocat de Poche</h1>
            <div style="background: rgba(0,210,255,0.1); border: 1px solid #00d2ff; color: #00d2ff; font-size: 0.7rem; padding: 3px 10px; border-radius: 10px; margin-top: 5px; margin-bottom: 10px; font-weight: bold; letter-spacing: 1px; display: inline-block;"><i class="fa-solid fa-microchip"></i> Propulsé par JARVIS 4.0</div>
            <p style="color: #777; font-size: 0.8rem; margin-bottom: 15px; text-align: center; max-width: 80%; line-height: 1.2;">Avertissement (AI Act) : Aide indicative générée par IA. Ne remplace pas un conseil juridique. <strong>Soumis à contrôle humain.</strong></p>
            
            <div id="lawyer-chat-box" style="flex: 1; width: 90%; max-width: 500px; background: rgba(0,0,0,0.5); border-radius: 15px; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; scroll-behavior: smooth;">
                <div style="background: rgba(204,163,0,0.2); padding: 10px 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border-left: 3px solid #cca300; line-height: 1.4;">
                    Ma base de jurisprudence couvre <strong>16 pays</strong> avec des sources officielles. Essayez :<br>
                    • Casque en France<br>
                    • Permis Indonésie<br>
                    • Protection données Brésil<br>
                    • Casque UK<br>
                    • CCPA USA<br><br>
                    <em>• Tapez <strong>pays</strong> pour voir la liste complète.</em>
                </div>
            </div>
            
            <div style="width: 90%; max-width: 500px; display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="lawyer-input" placeholder="Votre question..." style="flex: 1; padding: 12px; border-radius: 20px; border: 1px solid #555; background: #222; color: #fff; outline: none;" onkeypress="if(event.key === 'Enter') PocketLawyer.sendMessage()">
                <button onclick="PocketLawyer.sendMessage()" style="background: #cca300; color: #000; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
            
            <button onclick="PocketLawyer.startGPSScan()" style="margin-bottom: 15px; background: transparent; border: 1px solid #cca300; color: #cca300; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-location-dot"></i> Scanner mon stationnement (GPS)</button>
            <button onclick="PocketLawyer.reportInsurer()" style="margin-bottom: 15px; background: rgba(255,51,51,0.1); border: 1px solid #ff3333; color: #ff3333; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-bullhorn"></i> Signaler un litige assureur (+15 BVC)</button>
            <button onclick="window.open('https://www.legifrance.gouv.fr/', '_blank')" style="margin-bottom: 30px; background: rgba(0, 51, 153, 0.2); border: 1px solid #0055ff; color: #88bbff; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-book-section"></i> Base Légifrance (Textes Officiels)</button>
            
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .lawyer-card { background: rgba(255,255,255,0.05); border-radius: 15px; margin-top: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .lawyer-btn { padding: 10px 20px; border-radius: 30px; border: none; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 15px; }
            </style>
        `;
  },

  reportInsurer: function () {
    const insurerName = prompt("Quel est le nom de l'assureur concerné ?");
    if (!insurerName) return;

    const problem = prompt(
      "Décrivez brièvement le problème (ex: refus de prise en charge, résiliation abusive, etc.) :",
    );
    if (!problem) return;

    // Sanitization anti-XSS (A03 OWASP)
    const sanitize = (str) => {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    };
    const safeInsurerName = sanitize(insurerName);
    const safeProblem = sanitize(problem);

    // Envoi à Firebase
    try {
      if (typeof firebase !== "undefined") {
        firebase
          .firestore()
          .collection("insurer_reports")
          .add({
            insurer: insurerName.toUpperCase(),
            description: problem,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            user: window.session ? window.session.username : "Anonyme",
          });
      }
    } catch (e) {
      console.warn("Firebase non disponible, signalement simulé en local.");
    }

    // Récompense pour encourager la communauté
    let ptsAdded = false;
    if (typeof window.testAddPoints === "function") {
      window.testAddPoints(15);
      ptsAdded = true;
    } else {
      if (
        window.session &&
        window.session.uid &&
        typeof firebase !== "undefined"
      ) {
        firebase
          .firestore()
          .collection("users")
          .doc(window.session.uid)
          .set(
            {
              bvcPoints: firebase.firestore.FieldValue.increment(15),
            },
            { merge: true },
          )
          .catch(function (e) {
            console.error(e);
          });
      }
      ptsAdded = true;
    }

    this.addBotMessage(
      `<strong>Signalement enregistré !</strong><br>Merci d'avoir signalé <em>${safeInsurerName}</em>. Votre retour aide toute la communauté à éviter les mauvaises expériences.<br><span style="color:#00e676;">+15 Pts BVC offerts pour votre contribution citoyenne.</span>`,
    );

    if (
      insurerName.toLowerCase().includes("euro assurance") ||
      insurerName.toLowerCase().includes("euroassurence")
    ) {
      const self = this;
      setTimeout(function () {
        self.addBotMessage(
          "âš ï¸ <strong>Note de l'Avocat :</strong> Nous avons reçu de nombreux signalements concernant cet assureur. Sachez qu'il est désormais classé \"Partenaire non recommandé\" sur notre plateforme B2B et soumis à des frais de vérification renforcée (10 000 €).",
        );
      }, 3000);
    }
  },

  devClearReports: async function () {
    if (
      confirm(
        "âš ï¸ DANGER ADMIN : Êtes-vous sûr de vouloir supprimer TOUS les signalements assureurs de la base de données de production ?",
      )
    ) {
      try {
        if (typeof firebase === "undefined")
          return alert("Erreur: Firebase non initialisé");
        const snapshot = await firebase
          .firestore()
          .collection("insurer_reports")
          .get();
        if (snapshot.empty) {
          alert("La base de données des signalements est déjà vide !");
          return;
        }
        const batch = firebase.firestore().batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        alert(
          `✅ Succès : ${snapshot.size} signalement(s) effacé(s) de la base de données.`,
        );
      } catch (e) {
        console.error(e);
        alert("Erreur lors de la purge de la base de données : " + e.message);
      }
    }
  },

  sendMessage: function (text = null) {
    const input = document.getElementById("lawyer-input");
    if (!input && !text) return;
    const message = text || (input ? input.value.trim() : "");
    if (!message) return;

    if (!text && input) input.value = "";

    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;

    // Add user message
    const userMsg = document.createElement("div");
    userMsg.style =
      "background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: 15px; align-self: flex-end; max-width: 85%; color: #fff;";
    userMsg.textContent = message;
    chatBox.appendChild(userMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Add typing indicator
    const typingMsg = document.createElement("div");
    typingMsg.style =
      "color: #cca300; font-size: 0.9rem; align-self: flex-start; margin-top: 5px;";
    typingMsg.innerHTML =
      '<i class="fa-solid fa-ellipsis fa-fade"></i> Analyse en cours...';
    chatBox.appendChild(typingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
      if (chatBox.contains(typingMsg)) chatBox.removeChild(typingMsg);
      const reply = this.processChatQuery(message);
      this.addBotMessage(reply);
    }, 1000);
  },

  addBotMessage: function (htmlContent) {
    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;
    const botMsg = document.createElement("div");
    botMsg.style =
      "background: rgba(204,163,0,0.1); padding: 10px 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border-left: 3px solid #cca300; line-height: 1.4; color: #fff;";
    botMsg.innerHTML = htmlContent;
    chatBox.appendChild(botMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (typeof speak === "function") {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;
      speak(tempDiv.textContent || tempDiv.innerText || "");
    }
  },

  processChatQuery: function (text) {
    const t = text.toLowerCase();

    // ═══════════════════════════════════════════════════════
    // 🌍 MOTEUR JURIDIQUE MONDIAL (LegalDatabase)
    // Cherche d'abord dans la base mondiale officielle
    // ═══════════════════════════════════════════════════════
    if (
      window.LegalDatabase &&
      typeof window.LegalDatabase.search === "function"
    ) {
      const results = window.LegalDatabase.search(text);
      if (results.length > 0) {
        // Prendre le résultat le plus pertinent
        const r = results[0];
        let html = `<strong>${r.title}</strong><br>${r.content}`;
        html += `<br><em style="color:#888; font-size:0.8em;">Source : ${r.source}</em>`;

        // Si plusieurs résultats, indiquer les autres disponibles
        if (results.length > 1) {
          html += `<br><br><span style="color:#cca300; font-size:0.85em;">ðŸ“š ${results.length - 1} autre(s) résultat(s) trouvé(s). Précisez votre question pour affiner.</span>`;
        }

        // Suggestion automatique du Code Litige pour les cas pertinents
        if (
          t.includes("accident") ||
          t.includes("litige") ||
          t.includes("assurance") ||
          t.includes("accrochage") ||
          t.includes("constat") ||
          t.includes("sinistre")
        ) {
          html += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                        <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (Boîte Noire)</strong><br>Avez-vous besoin de générer un Code Litige pour votre assureur ?</p>
                        <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> Générer mon Code Litige</button>
                    </div>`;
        }

        return html;
      }
    }

    // ═══════════════════════════════════════════════════════
    // 🌍 LISTE DES PAYS DISPONIBLES (si question générale)
    // ═══════════════════════════════════════════════════════
    if (
      t.includes("pays") ||
      t.includes("monde") ||
      t.includes("mondial") ||
      t.includes("international") ||
      (t.includes("quel") && t.includes("droit"))
    ) {
      if (window.LegalDatabase) {
        let countryList = "";
        for (const [key, country] of Object.entries(window.LegalDatabase)) {
          if (
            typeof country === "object" &&
            country._flag &&
            key !== "search"
          ) {
            countryList += `• ${country._flag} ${country._name}<br>`;
          }
        }
        return `<strong>🌍 Base Juridique Mondiale</strong><br>Je couvre actuellement le droit de :<br>${countryList}<br>Précisez un <strong>pays</strong> et un <strong>thème</strong> (casque, permis, données, assurance...) pour obtenir les textes officiels.`;
      }
    }

    // ═══════════════════════════════════════════════════════
    // ðŸ‡«ðŸ‡· FALLBACK : JURISPRUDENCE FRANÇAISE (Code de la route)
    // ═══════════════════════════════════════════════════════
    if (t.includes("débrid") || t.includes("debride")) {
      return "<strong>Débridage (Art. L317-5)</strong><br>C'est un délit. Vous risquez jusqu'à <strong>135€ d'amende</strong> pour le propriétaire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.";
    }
    if (
      t.includes("stup") ||
      t.includes("drogue") ||
      t.includes("fumé") ||
      t.includes("positif") ||
      t.includes("cannabis") ||
      t.includes("thc")
    ) {
      return "<strong>Conduite sous stupéfiants (Délit)</strong><br>Même avec un BSR, vous risquez jusqu'à <strong>4500€ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une première infraction, le juge peut faire preuve de clémence si vous montrez des preuves médicales de votre volonté de vous soigner.";
    }
    if (t.includes("alcool")) {
      return "<strong>Alcoolémie</strong><br>Pour un permis probatoire ou BSR, la limite légale est de 0,2 g/L. Vous risquez l'immobilisation immédiate du cyclomoteur et de fortes amendes.";
    }
    if (t.includes("assurance")) {
      return "<strong>Défaut d'assurance (Délit)</strong><br>Conduire sans assurance coûte jusqu'à <strong>3750€ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais vous réclamera le remboursement, potentiellement toute votre vie.";
    }
    if (t.includes("fuite") || t.includes("obtempérer")) {
      return "<strong>Refus d'obtempérer / Délit de fuite</strong><br>Cumuler ces délits entraîne des peines de prison fermes, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrôle de police.";
    }

    const safeText = window.escapeHTML ? window.escapeHTML(text) : text;
    let baseMsg = `Ma base de jurisprudence couvre <strong>16 pays</strong> avec des sources officielles. Pour la France, les textes de référence sont sur <strong>Légifrance</strong>.<br><br>
        <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher "${safeText}" sur Légifrance</a>`;

    if (
      t.includes("accident") ||
      t.includes("litige") ||
      t.includes("assurance") ||
      t.includes("accrochage") ||
      t.includes("constat") ||
      t.includes("sinistre")
    ) {
      baseMsg += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (Boîte Noire)</strong><br>Avez-vous besoin de générer un Code Litige pour votre assureur ?</p>
                <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> Générer mon Code Litige</button>
            </div>`;
    }

    return baseMsg;
  },

  startGPSScan: function () {
    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;

    this.addBotMessage(
      '<div style="text-align: center;"><div style="width: 30px; height: 30px; border: 3px solid #333; border-top-color: #cca300; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div><p style="margin-top: 10px; font-size: 0.9rem;">Vérification GPS en cours...</p></div>',
    );

    setTimeout(() => {
      if (chatBox.lastChild) chatBox.removeChild(chatBox.lastChild); // Remove loading message

      const scenario =
        this.scenarios[Math.floor(Math.random() * this.scenarios.length)];
      this.currentScenarioTemplate = scenario.letterTemplate;

      let html = `
                <div class="lawyer-card" style="border: 1px solid ${scenario.color}; padding: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="${scenario.icon}" style="font-size: 2rem; color: ${scenario.color};"></i>
                        <div>
                            <h2 style="margin: 0; font-size: 1.2rem; color: ${scenario.color};">${scenario.status}</h2>
                            <p style="margin: 0; font-size: 0.8rem; color: #ccc;">${scenario.type}</p>
                        </div>
                    </div>
                    <p style="margin: 5px 0 10px 0; color: #ddd; font-size: 0.9rem;">${scenario.verdict}</p>
                    ${
                      scenario.letterTemplate
                        ? `
                        <button class="lawyer-btn" style="background: #cca300; color: #000; font-size: 0.9rem; padding: 8px 15px; width: 100%;" onclick="PocketLawyer.generateLetter()">
                            <i class="fa-solid fa-file-signature"></i> Recours (5 Pts)
                        </button>
                    `
                        : ""
                    }
                </div>
            `;
      this.addBotMessage(html);
    }, 2000);
  },

  closeLawyer: function () {
    this.isOpen = false;
    const overlay = document.getElementById("lawyer-overlay");
    if (overlay) overlay.style.display = "none";
  },

  startAudioDefense: function () {
    if (typeof speak === "function") {
      speak(
        "Mode Défense Juridique activé. Règle numéro 1 : Ne reconnaissez aucun tort à l'oral. Règle numéro 2 : Prenez des photos de la situation et de la plaque adverse. Règle numéro 3 : Remplissez le constat factuellement. En cas de délit de fuite, relevez la plaque et contactez la police.",
      );
    } else {
      console.warn(
        "L'assistant vocal (speak) n'est pas disponible pour dicter la défense.",
      );
    }
  },

  generateLetter: function () {
    if (typeof window.braveCoins === "undefined") {
      alert("Erreur: Module de fidélité introuvable.");
      return;
    }

    const price = 5;
    if (
      confirm(
        `Générer un recours juridique coûte ${price} Pts BVC.\nVoulez-vous continuer ?`,
      )
    ) {
      if (window.braveCoins >= price) {
        window.braveCoins -= price;
        localStorage.setItem("braveCoins", window.braveCoins.toString());

        const balanceEl = document.getElementById("crypto-balance");
        if (balanceEl)
          balanceEl.innerText = Math.floor(window.braveCoins) + " Pts BVC";

        const letter =
          this.currentScenarioTemplate ||
          "Monsieur l'Officier du Ministère Public,\nJe conteste formellement ce PV.";

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(letter)
            .then(function () {
              alert(
                "Paiement de " +
                  price +
                  " Pts BVC accepté.\n\nLa lettre de contestation a été copiée dans votre presse-papiers ! Vous pouvez la coller sur le site de l'ANTAI.",
              );
              if (typeof speak === "function")
                speak("Plaidoirie copiée dans le presse-papiers.");
            })
            .catch(function () {
              alert(
                "Erreur lors de la copie. Voici votre lettre :\n\n" + letter,
              );
            });
        } else {
          // Fallback pour WebView Capacitor / HTTP
          alert(
            "Paiement de " +
              price +
              " Pts BVC accepté.\n\nVoici votre lettre :\n\n" +
              letter,
          );
        }
      } else {
        alert(
          `Fonds insuffisants ! Vous avez besoin de ${price} Pts BVC. Roulez plus pour gagner des Pts BVC.`,
        );
      }
    }
  },
};
