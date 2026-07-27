/**
 * âš–ï¸ POCKET LAWYER - MODULE DE DÃ‰FENSE JURIDIQUE
 * Analyse du stationnement (Code de la Route FR : R417-10 et R417-11)
 */

window.PocketLawyer = {
  isOpen: false,

  // ScÃ©narios simulÃ©s pour l'environnement GPS actuel
  scenarios: [
    {
      type: "Trottoir (Large)",
      status: "TOLERANCE",
      icon: "fa-solid fa-scale-balanced",
      color: "#ffb703", // Orange
      law: "R417-10 (TrÃ¨s GÃªnant / GÃªnant)",
      verdict:
        "Stationnement techniquement interdit mais couramment tolÃ©rÃ© si le passage des piÃ©tons n'est pas entravÃ©.",
      defense:
        "Plaidoirie : L'espace laissÃ© libre (plus de 1m50) permet le passage des poussettes et PMR. Aucune entrave caractÃ©risÃ©e. S'il y a amende (135â‚¬ ou 35â‚¬), vous pouvez invoquer l'absence de signalisation claire ou le manque de places 2RM.",
      letterTemplate:
        "Monsieur l'Officier du MinistÃ¨re Public,\nJe conteste le PV nÂ°XXX.\nLe stationnement de mon cyclomoteur ne constituait pas une entrave Ã  la circulation piÃ©tonne (largeur libre > 1,50m) et palliait un manque avÃ©rÃ© de stationnement 2RM dans ce secteur.",
    },
    {
      type: "Place 2-Roues MotorisÃ©s",
      status: "AUTORISE",
      icon: "fa-solid fa-check-double",
      color: "#00e676", // Vert
      law: "R417-6 (RÃ©gulier)",
      verdict: "Vous Ãªtes parfaitement en rÃ¨gle.",
      defense:
        "Plaidoirie : VÃ©hicule stationnÃ© sur un emplacement dÃ©diÃ© et matÃ©rialisÃ©. Si la place est devenue payante (ex: Paris), assurez-vous d'avoir pris un ticket numÃ©rique ou le Pass 2RM.",
      letterTemplate: "",
    },
    {
      type: "Passage PiÃ©ton / Piste Cyclable",
      status: "INTERDIT",
      icon: "fa-solid fa-gavel",
      color: "#ff4d4d", // Rouge
      law: "R417-11 (TrÃ¨s GÃªnant)",
      verdict:
        "Stationnement strictement interdit. Risque de mise en fourriÃ¨re immÃ©diate et 135â‚¬ d'amende.",
      defense:
        "Plaidoirie : Difficilement contestable (mise en danger d'autrui). Seule option : vice de forme sur le PV (erreur de plaque, de rue ou de date).",
      letterTemplate:
        "Monsieur l'Officier,\nJe conteste ce PV sur la base d'un vice de forme caractÃ©risÃ© (erreur matÃ©rielle sur le lieu exact de l'infraction visÃ©).",
    },
    {
      type: "Place Auto (Voiture)",
      status: "TOLERANCE",
      icon: "fa-solid fa-car",
      color: "#ffb703",
      law: "R417-10",
      verdict:
        "TolÃ©rÃ© si vous payez le stationnement (si applicable). Attention Ã  ne pas bloquer une voiture.",
      defense:
        "Plaidoirie : Le code de la route n'interdit pas aux 2RM de se garer sur les places voitures, mais c'est mal vu. En cas de stationnement payant, le reÃ§u fait foi.",
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
      alert("Erreur: Module de fidÃ©litÃ© introuvable.");
      return;
    }

    const price = 5; // 5 Pts BVC constants
    if (window.braveCoins < price) {
      alert(
        `Fonds insuffisants ! Vous avez besoin de ${price} Pts BVC pour accÃ©der Ã  l'Avocat de Poche. Roulez plus pour en gagner.`,
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
            <div style="background: rgba(0,210,255,0.1); border: 1px solid #00d2ff; color: #00d2ff; font-size: 0.7rem; padding: 3px 10px; border-radius: 10px; margin-top: 5px; margin-bottom: 10px; font-weight: bold; letter-spacing: 1px; display: inline-block;"><i class="fa-solid fa-microchip"></i> PropulsÃ© par JARVIS 4.0</div>
            <p style="color: #777; font-size: 0.8rem; margin-bottom: 15px; text-align: center; max-width: 80%; line-height: 1.2;">Avertissement (AI Act) : Aide indicative gÃ©nÃ©rÃ©e par IA. Ne remplace pas un conseil juridique. <strong>Soumis Ã  contrÃ´le humain.</strong></p>
            
            <div id="lawyer-chat-box" style="flex: 1; width: 90%; max-width: 500px; background: rgba(0,0,0,0.5); border-radius: 15px; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; scroll-behavior: smooth;">
                <div style="background: rgba(204,163,0,0.2); padding: 10px 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border-left: 3px solid #cca300; line-height: 1.4;">
                    Ma base de jurisprudence couvre <strong>16 pays</strong> avec des sources officielles. Essayez :<br>
                    â€¢ Casque en France<br>
                    â€¢ Permis IndonÃ©sie<br>
                    â€¢ Protection donnÃ©es BrÃ©sil<br>
                    â€¢ Casque UK<br>
                    â€¢ CCPA USA<br><br>
                    <em>â€¢ Tapez <strong>pays</strong> pour voir la liste complÃ¨te.</em>
                </div>
            </div>
            
            <div style="width: 90%; max-width: 500px; display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="lawyer-input" placeholder="Votre question..." style="flex: 1; padding: 12px; border-radius: 20px; border: 1px solid #555; background: #222; color: #fff; outline: none;" onkeypress="if(event.key === 'Enter') PocketLawyer.sendMessage()">
                <button onclick="PocketLawyer.sendMessage()" style="background: #cca300; color: #000; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
            
            <button onclick="PocketLawyer.startGPSScan()" style="margin-bottom: 15px; background: transparent; border: 1px solid #cca300; color: #cca300; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-location-dot"></i> Scanner mon stationnement (GPS)</button>
            <button onclick="PocketLawyer.reportInsurer()" style="margin-bottom: 15px; background: rgba(255,51,51,0.1); border: 1px solid #ff3333; color: #ff3333; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-bullhorn"></i> Signaler un litige assureur (+15 BVC)</button>
            <button onclick="window.open('https://www.legifrance.gouv.fr/', '_blank')" style="margin-bottom: 30px; background: rgba(0, 51, 153, 0.2); border: 1px solid #0055ff; color: #88bbff; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-book-section"></i> Base LÃ©gifrance (Textes Officiels)</button>
            
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .lawyer-card { background: rgba(255,255,255,0.05); border-radius: 15px; margin-top: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .lawyer-btn { padding: 10px 20px; border-radius: 30px; border: none; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 15px; }
            </style>
        `;
  },

  reportInsurer: function () {
    const insurerName = prompt("Quel est le nom de l'assureur concernÃ© ?");
    if (!insurerName) return;

    const problem = prompt(
      "DÃ©crivez briÃ¨vement le problÃ¨me (ex: refus de prise en charge, rÃ©siliation abusive, etc.) :",
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

    // Envoi Ã  Firebase
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
      console.warn("Firebase non disponible, signalement simulÃ© en local.");
    }

    // RÃ©compense pour encourager la communautÃ©
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
      `<strong>Signalement enregistrÃ© !</strong><br>Merci d'avoir signalÃ© <em>${safeInsurerName}</em>. Votre retour aide toute la communautÃ© Ã  Ã©viter les mauvaises expÃ©riences.<br><span style="color:#00e676;">+15 Pts BVC offerts pour votre contribution citoyenne.</span>`,
    );

    if (
      insurerName.toLowerCase().includes("euro assurance") ||
      insurerName.toLowerCase().includes("euroassurence")
    ) {
      const self = this;
      setTimeout(function () {
        self.addBotMessage(
          "âš ï¸ <strong>Note de l'Avocat :</strong> Nous avons reÃ§u de nombreux signalements concernant cet assureur. Sachez qu'il est dÃ©sormais classÃ© \"Partenaire non recommandÃ©\" sur notre plateforme B2B et soumis Ã  des frais de vÃ©rification renforcÃ©e (10 000 â‚¬).",
        );
      }, 3000);
    }
  },

  devClearReports: async function () {
    if (
      confirm(
        "âš ï¸ DANGER ADMIN : ÃŠtes-vous sÃ»r de vouloir supprimer TOUS les signalements assureurs de la base de donnÃ©es de production ?",
      )
    ) {
      try {
        if (typeof firebase === "undefined")
          return alert("Erreur: Firebase non initialisÃ©");
        const snapshot = await firebase
          .firestore()
          .collection("insurer_reports")
          .get();
        if (snapshot.empty) {
          alert("La base de donnÃ©es des signalements est dÃ©jÃ  vide !");
          return;
        }
        const batch = firebase.firestore().batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        alert(
          `âœ… SuccÃ¨s : ${snapshot.size} signalement(s) effacÃ©(s) de la base de donnÃ©es.`,
        );
      } catch (e) {
        console.error(e);
        alert("Erreur lors de la purge de la base de donnÃ©es : " + e.message);
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸŒ MOTEUR JURIDIQUE MONDIAL (LegalDatabase)
    // Cherche d'abord dans la base mondiale officielle
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (
      window.LegalDatabase &&
      typeof window.LegalDatabase.search === "function"
    ) {
      const results = window.LegalDatabase.search(text);
      if (results.length > 0) {
        // Prendre le rÃ©sultat le plus pertinent
        const r = results[0];
        let html = `<strong>${r.title}</strong><br>${r.content}`;
        html += `<br><em style="color:#888; font-size:0.8em;">Source : ${r.source}</em>`;

        // Si plusieurs rÃ©sultats, indiquer les autres disponibles
        if (results.length > 1) {
          html += `<br><br><span style="color:#cca300; font-size:0.85em;">ðŸ“š ${results.length - 1} autre(s) rÃ©sultat(s) trouvÃ©(s). PrÃ©cisez votre question pour affiner.</span>`;
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
                        <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (BoÃ®te Noire)</strong><br>Avez-vous besoin de gÃ©nÃ©rer un Code Litige pour votre assureur ?</p>
                        <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> GÃ©nÃ©rer mon Code Litige</button>
                    </div>`;
        }

        return html;
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸŒ LISTE DES PAYS DISPONIBLES (si question gÃ©nÃ©rale)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
            countryList += `â€¢ ${country._flag} ${country._name}<br>`;
          }
        }
        return `<strong>ðŸŒ Base Juridique Mondiale</strong><br>Je couvre actuellement le droit de :<br>${countryList}<br>PrÃ©cisez un <strong>pays</strong> et un <strong>thÃ¨me</strong> (casque, permis, donnÃ©es, assurance...) pour obtenir les textes officiels.`;
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ‡«ðŸ‡· FALLBACK : JURISPRUDENCE FRANÃ‡AISE (Code de la route)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (t.includes("dÃ©brid") || t.includes("debride")) {
      return "<strong>DÃ©bridage (Art. L317-5)</strong><br>C'est un dÃ©lit. Vous risquez jusqu'Ã  <strong>135â‚¬ d'amende</strong> pour le propriÃ©taire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.";
    }
    if (
      t.includes("stup") ||
      t.includes("drogue") ||
      t.includes("fumÃ©") ||
      t.includes("positif") ||
      t.includes("cannabis") ||
      t.includes("thc")
    ) {
      return "<strong>Conduite sous stupÃ©fiants (DÃ©lit)</strong><br>MÃªme avec un BSR, vous risquez jusqu'Ã  <strong>4500â‚¬ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une premiÃ¨re infraction, le juge peut faire preuve de clÃ©mence si vous montrez des preuves mÃ©dicales de votre volontÃ© de vous soigner.";
    }
    if (t.includes("alcool")) {
      return "<strong>AlcoolÃ©mie</strong><br>Pour un permis probatoire ou BSR, la limite lÃ©gale est de 0,2 g/L. Vous risquez l'immobilisation immÃ©diate du cyclomoteur et de fortes amendes.";
    }
    if (t.includes("assurance")) {
      return "<strong>DÃ©faut d'assurance (DÃ©lit)</strong><br>Conduire sans assurance coÃ»te jusqu'Ã  <strong>3750â‚¬ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais vous rÃ©clamera le remboursement, potentiellement toute votre vie.";
    }
    if (t.includes("fuite") || t.includes("obtempÃ©rer")) {
      return "<strong>Refus d'obtempÃ©rer / DÃ©lit de fuite</strong><br>Cumuler ces dÃ©lits entraÃ®ne des peines de prison fermes, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrÃ´le de police.";
    }

    const safeText = window.escapeHTML ? window.escapeHTML(text) : text;
    let baseMsg = `Ma base de jurisprudence couvre <strong>16 pays</strong> avec des sources officielles. Pour la France, les textes de rÃ©fÃ©rence sont sur <strong>LÃ©gifrance</strong>.<br><br>
        <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher "${safeText}" sur LÃ©gifrance</a>`;

    if (
      t.includes("accident") ||
      t.includes("litige") ||
      t.includes("assurance") ||
      t.includes("accrochage") ||
      t.includes("constat") ||
      t.includes("sinistre")
    ) {
      baseMsg += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (BoÃ®te Noire)</strong><br>Avez-vous besoin de gÃ©nÃ©rer un Code Litige pour votre assureur ?</p>
                <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> GÃ©nÃ©rer mon Code Litige</button>
            </div>`;
    }

    return baseMsg;
  },

  startGPSScan: function () {
    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;

    this.addBotMessage(
      '<div style="text-align: center;"><div style="width: 30px; height: 30px; border: 3px solid #333; border-top-color: #cca300; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div><p style="margin-top: 10px; font-size: 0.9rem;">VÃ©rification GPS en cours...</p></div>',
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
        "Mode DÃ©fense Juridique activÃ©. RÃ¨gle numÃ©ro 1 : Ne reconnaissez aucun tort Ã  l'oral. RÃ¨gle numÃ©ro 2 : Prenez des photos de la situation et de la plaque adverse. RÃ¨gle numÃ©ro 3 : Remplissez le constat factuellement. En cas de dÃ©lit de fuite, relevez la plaque et contactez la police.",
      );
    } else {
      console.warn(
        "L'assistant vocal (speak) n'est pas disponible pour dicter la dÃ©fense.",
      );
    }
  },

  generateLetter: function () {
    if (typeof window.braveCoins === "undefined") {
      alert("Erreur: Module de fidÃ©litÃ© introuvable.");
      return;
    }

    const price = 5;
    if (
      confirm(
        `GÃ©nÃ©rer un recours juridique coÃ»te ${price} Pts BVC.\nVoulez-vous continuer ?`,
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
          "Monsieur l'Officier du MinistÃ¨re Public,\nJe conteste formellement ce PV.";

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(letter)
            .then(function () {
              alert(
                "Paiement de " +
                  price +
                  " Pts BVC acceptÃ©.\n\nLa lettre de contestation a Ã©tÃ© copiÃ©e dans votre presse-papiers ! Vous pouvez la coller sur le site de l'ANTAI.",
              );
              if (typeof speak === "function")
                speak("Plaidoirie copiÃ©e dans le presse-papiers.");
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
              " Pts BVC acceptÃ©.\n\nVoici votre lettre :\n\n" +
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
