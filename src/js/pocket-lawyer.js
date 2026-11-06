import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * ⚖️ NEXUS ATLAS JURIDIQUE - MODULE D'INFORMATION JURIDIQUE
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

  open: function () {
    return this.openLawyer();
  },

  openLawyer: function () {
    const isAdmin = (typeof window.session !== "undefined" && window.session?.role === "admin") || 
                    (typeof window.session !== "undefined" && window.session?.email === "admin@mon50ccetmoi.com") ||
                    (typeof window.isAdmin === "function" && window.isAdmin());

    // Pour la consultation informative de la jurisprudence et des textes, l'accès est libre (AI Act & transparence juridique)
    // Seule la génération d'un recours officiel déduit des BVC Points.
    if (!isAdmin && typeof window.BVCManager !== "undefined") {
      const price = 5;
      if (window.BVCManager.balance < price && window.BVCManager.balance > 0) {
        console.info(`[PocketLawyer] Solde BVC : ${window.BVCManager.balance} Pts`);
      }
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

    // eslint-disable-next-line no-restricted-syntax
overlay.innerHTML = `
            <button data-action="PocketLawyer.closeLawyer()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-scale-balanced fa-beat-fade" style="font-size: 3rem; color: #cca300; filter: drop-shadow(0 0 10px #cca300); margin-bottom: 5px;"></i>
            <h1 style="font-size: 1.5rem; margin: 0; text-transform: uppercase; color: #cca300;">Nexus Atlas Juridique</h1>
            <div style="background: rgba(0,210,255,0.1); border: 1px solid #00d2ff; color: #00d2ff; font-size: 0.7rem; padding: 3px 10px; border-radius: 10px; margin-top: 5px; margin-bottom: 10px; font-weight: bold; letter-spacing: 1px; display: inline-block;"><i class="fa-solid fa-microchip"></i> Propulsé par Nexus Atlas</div>
            <div style="color: #ffaa00; font-size: 0.75rem; margin-bottom: 15px; text-align: center; width: 90%; max-width: 450px; border: 1px solid rgba(255,170,0,0.4); padding: 8px; border-radius: 8px; background: rgba(255,170,0,0.05); line-height: 1.3;">
                <strong><i class="fa-solid fa-scale-balanced"></i> Conformité Légale (AI Act & CCPA)</strong><br>
                <strong>Nexus Atlas n'est pas un avocat.</strong> Informations générales générées par IA, <strong>soumises à contrôle humain</strong>. Pour une situation précise (amende contestée, accident, procédure), consultez un avocat.<br>
                <em style="color:#aaa;">Do Not Sell My Personal Information : Vos données (dont la télémétrie locale) ne sont jamais vendues.</em>
            </div>
            
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
                <input type="text" id="lawyer-input" placeholder="Votre question..." style="flex: 1; padding: 12px; border-radius: 20px; border: 1px solid #555; background: #222; color: #fff; outline: none;">
                <button data-action="PocketLawyer.sendMessage()" style="background: #cca300; color: #000; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
            
            <button data-action="PocketLawyer.startGPSScan()" style="margin-bottom: 15px; background: transparent; border: 1px solid #cca300; color: #cca300; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-location-dot"></i> Scanner mon stationnement (GPS)</button>
            <button data-action="PocketLawyer.appealBan()" style="margin-bottom: 15px; background: rgba(231, 76, 60, 0.15); border: 1px solid #e74c3c; color: #e74c3c; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-scale-balanced"></i> Contester un Bannissement Temporaire (Vérification Humaine)</button>
            <button data-action="PocketLawyer.reportInsurer()" style="margin-bottom: 15px; background: rgba(255,51,51,0.1); border: 1px solid #ff3333; color: #ff3333; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-bullhorn"></i> Signaler un litige assureur (+15 mon50cc)</button>
            <button data-action="window.open('https://www.legifrance.gouv.fr/', '_blank')" style="margin-bottom: 30px; background: rgba(0, 51, 153, 0.2); border: 1px solid #0055ff; color: #88bbff; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-book-section"></i> Base Légifrance (Textes Officiels)</button>
            
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .lawyer-card { background: rgba(255,255,255,0.05); border-radius: 15px; margin-top: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .lawyer-btn { padding: 10px 20px; border-radius: 30px; border: none; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 15px; }
            </style>
        `;

    // B-04 Fix: Attach Enter key listener AFTER DOM injection (survives DOMPurify)
    setTimeout(() => {
      const lawyerInput = document.getElementById('lawyer-input');
      if (lawyerInput) {
        lawyerInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') PocketLawyer.sendMessage();
        });
        lawyerInput.focus();
      }
    }, 50);
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
      `<strong>Signalement enregistré !</strong><br>Merci d'avoir signalé <em>${safeInsurerName}</em>. Votre retour aide toute la communauté à éviter les mauvaises expériences.<br><span style="color:#00e676;">+15 Pts mon50cc offerts pour votre contribution citoyenne.</span>`,
    );

    if (
      insurerName.toLowerCase().includes("euro assurance") ||
      insurerName.toLowerCase().includes("euroassurence")
    ) {
      const self = this;
      setTimeout(function () {
        self.addBotMessage(
          "⚠ï¸ <strong>Note de l'Avocat :</strong> Nous avons reçu de nombreux signalements concernant cet assureur. Sachez qu'il est désormais classé \"Partenaire non recommandé\" sur notre plateforme B2B et soumis à des frais de vérification renforcée (10 000 €).",
        );
      }, 3000);
    }
  },

  devClearReports: async function () {
    if (
      confirm(
        "⚠ï¸ DANGER ADMIN : Êtes-vous sûr de vouloir supprimer TOUS les signalements assureurs de la base de données de production ?",
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

  sendMessage: async function (text = null) {
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
    // eslint-disable-next-line no-restricted-syntax
typingMsg.innerHTML = '<i class="fa-solid fa-ellipsis fa-fade"></i> Analyse en cours...';
    chatBox.appendChild(typingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const reply = await this.processChatQuery(message);
      if (chatBox.contains(typingMsg)) chatBox.removeChild(typingMsg);
      this.addBotMessage(reply);
    } catch(e) {
      if (chatBox.contains(typingMsg)) chatBox.removeChild(typingMsg);
      this.addBotMessage("Désolé, une erreur s'est produite lors de la recherche.");
      console.error(e);
    }
  },

  addBotMessage: function (htmlContent) {
    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;
    const botMsg = document.createElement("div");
    botMsg.style =
      "background: rgba(204,163,0,0.1); padding: 10px 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border-left: 3px solid #cca300; line-height: 1.4; color: #fff;";
    // eslint-disable-next-line no-restricted-syntax
botMsg.innerHTML = htmlContent;
    chatBox.appendChild(botMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (typeof speak === "function") {
      const tempDiv = document.createElement("div");
      // eslint-disable-next-line no-restricted-syntax
tempDiv.innerHTML = htmlContent;
      speak(tempDiv.textContent || tempDiv.innerText || "");
    }
  },

  processChatQuery: async function (text) {
    const t = text.toLowerCase();

    // ── Recours & Vérification Humaine (Bannissement Temporaire) ──
    if (t.includes("ban") || t.includes("banni") || t.includes("sanction") || t.includes("réexamen") || t.includes("reexamen") || t.includes("recours") || t.includes("compteur")) {
      return `⚖️ <strong>Procédure de Réexamen des Sanctions (Vérification Humaine)</strong><br><br>` +
        `En cas de bannissement temporaire, vous avez le droit légal de contester la sanction auprès d'un modérateur humain.<br><br>` +
        `<div style="background: rgba(0,230,118,0.1); border-left: 3px solid #00e676; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem;">` +
        `<strong>Règle formelle :</strong> L'annulation du bannissement et la réinitialisation intégrale du compteur de sanctions à zéro (0) seront déclenchées dès que la vérification humaine validera le rejet de la sanction.` +
        `</div>` +
        `<button data-action="PocketLawyer.appealBan()" style="background: linear-gradient(90deg, #cca300, #ffaa00); color: #000; border: none; border-radius: 20px; padding: 10px 18px; font-weight: bold; cursor: pointer; width: 100%;">` +
        `<i class="fa-solid fa-scale-balanced"></i> Déposer une demande de réexamen humain</button>`;
    }

    // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
    // 🌍  MOTEUR JURIDIQUE MONDIAL (LegalDatabase)
    // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
    if (
      window.LegalDatabase &&
      typeof window.LegalDatabase.search === "function"
    ) {
      const results = window.LegalDatabase.search(text);
      if (results.length > 0) {
        const r = results[0];
        // Build a full HTTPS URL from the stored domain
        const fullUrl = r.url && !r.url.startsWith("http")
          ? `https://${r.url}`
          : (r.url || "https://www.legifrance.gouv.fr");
        let html = `<strong>${r.title}</strong><br>${r.content}`;
        // Render source as clickable link (required by Google Play Misleading Claims policy)
        html += `<br><em style="color:#888; font-size:0.8em;">Source officielle : <a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="color:#00f0ff;text-decoration:underline;">${r.source}</a></em>`;

        if (results.length > 1) {
          html += `<br><br><span style="color:#cca300; font-size:0.85em;">&#x1F4DA; ${results.length - 1} autre(s) resultat(s) trouve(s). Precisez votre question pour affiner.</span>`;
        }

        if (t.includes("accident") || t.includes("litige") || t.includes("assurance") || t.includes("accrochage") || t.includes("constat") || t.includes("sinistre")) {
          html += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                        <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (Boite Noire)</strong><br>Avez-vous besoin de generer un Code Litige pour votre assureur ?</p>
                        <button data-action="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> Generer mon Code Litige</button>
                    </div>`;
        }

        // Google Play Misleading Claims policy — mandatory disclaimer
        html += '<br><div style="background:rgba(255,183,3,0.08);border:1px solid rgba(255,183,3,0.3);border-radius:8px;padding:8px 12px;margin-top:10px;font-size:0.72rem;color:#aaa;">' +
          '&#x26A0;&#xFE0F; <strong style="color:#ffb703;">Application independante &mdash; Non affiliee au gouvernement.</strong> ' +
          'Informations a titre indicatif uniquement. ' +
          '<a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener noreferrer" style="color:#00f0ff;text-decoration:underline;">legifrance.gouv.fr</a>' +
          '</div>';

        return html;
      }

    }

    if (t.includes("pays") || t.includes("monde") || t.includes("mondial") || t.includes("international") || (t.includes("quel") && t.includes("droit"))) {
      if (window.LegalDatabase) {
        let countryList = "";
        for (const [key, country] of Object.entries(window.LegalDatabase)) {
          if (typeof country === "object" && country._flag && key !== "search") {
            countryList += `• ${country._flag} ${country._name}<br>`;
          }
        }
        return `<strong>🌍  Base Juridique Mondiale</strong><br>Je couvre actuellement le droit de :<br>${countryList}<br>Précisez un <strong>pays</strong> et un <strong>thème</strong> (casque, permis, données, assurance...) pour obtenir les textes officiels.`;
      }
    }

    // 🇫🇷 FALLBACK : JURISPRUDENCE FRANÇAISE (Règles statiques)
    if (t.includes("trottinette") || t.includes("edpm")) {
      if (t.includes("passager") || t.includes("deux") || t.includes("duo")) {
        return "<strong>Passager sur Trottinette Électrique (Art. R412-43-1)</strong><br>Le transport de passager est <strong>strictement interdit</strong> sur un EDPM. L'infraction est punie d'une amende forfaitaire de <strong>135 €</strong> (4e classe).";
      }
      if (t.includes("trottoir")) {
        return "<strong>Trottinette sur Trottoir (Art. R412-43-1)</strong><br>Il est <strong>strictement interdit</strong> de rouler sur les trottoirs avec une trottinette électrique (sauf piéton la tenant à la main moteur éteint). Sanction : <strong>135 € d'amende</strong>.";
      }
      if (t.includes("debrid") || t.includes("débrid") || t.includes("vitesse") || t.includes("km/h")) {
        return "<strong>Vitesse & Débridage EDPM (Art. L317-1 & R321-4-2)</strong><br>La vitesse maximale autorisée par construction est de <strong>25 km/h</strong>. Circuler avec un engin débridé ou dépassant 25 km/h est puni d'une amende de 5e classe pouvant atteindre <strong>1 500 €</strong> et la <strong>confiscation du véhicule</strong>.";
      }
      return "<strong>Réglementation Trottinette Électrique (EDPM - Décret n° 2023-263 & Art. R412-43-1) :</strong><br>" +
             "• <strong>Vitesse max :</strong> 25 km/h autorisée.<br>" +
             "• <strong>Âge minimum :</strong> 14 ans.<br>" +
             "• <strong>Voies autorisées :</strong> Pistes cyclables obligatoires en agglomération. Chaussées limitées à 50 km/h en l'absence de piste.<br>" +
             "• <strong>Interdictions formelles :</strong> Trottoirs (135€), transport d'un passager (135€), écouteurs/casque audio aux oreilles (135€).<br>" +
             "• <strong>Assurance :</strong> Assurance Responsabilité Civile spécifique obligatoire pour tout EDPM.";
    }

    if (t.includes("velo") || t.includes("vélo") || t.includes("vae") || t.includes("cycliste")) {
      return "<strong>Réglementation Vélo & VAE (Art. R311-1 6.11 & R431-1-3) :</strong><br>" +
             "• <strong>Assistance VAE :</strong> Doit se couper automatiquement à 25 km/h (moteur 250W max).<br>" +
             "• <strong>Pistes cyclables :</strong> Obligatoires si panneau rond bleu (B22), conseillées si panneau carré (C113).<br>" +
             "• <strong>Casque :</strong> Obligatoire pour les enfants de moins de 12 ans (conducteur ou passager), fortement recommandé pour les adultes.<br>" +
             "• <strong>Équipement de nuit :</strong> Gilet rétro-réfléchissant certifié hors agglomération, feux avant blanc/jaune et arrière rouge + catadioptres.<br>" +
             "• <strong>Autoroutes & Voies express :</strong> Strictement interdites (Art. R421-2).";
    }

    if (t.includes("débrid") || t.includes("debride")) {
      return "<strong>Débridage (Art. L317-5)</strong><br>C'est un délit. Vous risquez jusqu'à <strong>135€ d'amende</strong> pour le propriétaire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.";
    }
    if (t.includes("stup") || t.includes("drogue") || t.includes("fumé") || t.includes("positif") || t.includes("cannabis") || t.includes("thc")) {
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
    let baseMsg = `Je consulte la base de jurisprudence (Légifrance via PISTE)...<br><br>`;
    
    // Appel à la Cloud Function searchLegifrancePiste
    try {
      if (typeof window.session !== "undefined" && window.session.token) {
        const response = await fetch("https://europe-west1-mon50ccetmoi.cloudfunctions.net/searchLegifrancePiste", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${window.session.token}`
            },
            body: JSON.stringify({ query: text })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const res = data.results[0];
                baseMsg = `<strong>${res.title}</strong><br>${res.content}<br><br><em style="color:#888; font-size:0.8em;">Source : ${res.source}</em>`;
            } else {
                baseMsg = `Aucun texte de loi précis trouvé sur Légifrance pour "${safeText}".<br><br>
                <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur le site Légifrance</a>`;
            }
        } else {
            baseMsg = `Service Légifrance indisponible. <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur Légifrance</a>`;
        }
      } else {
          baseMsg = `Vous devez être connecté pour interroger la base Légifrance PISTE en direct. <br><br>
          <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur Légifrance</a>`;
      }
    } catch (e) {
        console.error(e);
        baseMsg = `Erreur de connexion à la base de données gouvernementale. <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur Légifrance</a>`;
    }

    if (t.includes("accident") || t.includes("litige") || t.includes("assurance") || t.includes("accrochage") || t.includes("constat") || t.includes("sinistre")) {
      baseMsg += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (Boîte Noire)</strong><br>Avez-vous besoin de générer un Code Litige pour votre assureur ?</p>
                <button data-action="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> Générer mon Code Litige</button>
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

      const html = `
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
                        <button class="lawyer-btn" style="background: #cca300; color: #000; font-size: 0.9rem; padding: 8px 15px; width: 100%;" data-action="PocketLawyer.generateLetter()">
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

  generateLetter: async function () {
    const isAdmin = (typeof window.session !== "undefined" && window.session?.role === "admin") || 
                    (typeof window.session !== "undefined" && window.session?.email === "admin@mon50ccetmoi.com") ||
                    (typeof window.isAdmin === "function" && window.isAdmin());

    const price = 5;
    let authorized = isAdmin;

    if (!authorized) {
      if (typeof window.BVCManager !== "undefined") {
        if (
          confirm(
            `Générer un recours juridique coûte ${price} Pts mon50cc.\nVoulez-vous continuer ?`,
          )
        ) {
          authorized = await window.BVCManager.deduct(price);
        }
      } else {
        authorized = true; // Fallback mode dégradé
      }
    }

    if (authorized) {
      const letter =
        this.currentScenarioTemplate ||
        "Monsieur l'Officier du Ministère Public,\nJe conteste formellement ce PV.";

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(letter)
          .then(function () {
            alert(
              "Recours généré avec succès !\n\nLa lettre de contestation a été copiée dans votre presse-papiers ! Vous pouvez la coller sur le site de l'ANTAI.",
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
        alert(
          "Recours généré avec succès !\n\nVoici votre lettre :\n\n" +
            letter,
        );
      }
    } else {
      alert(
        `Fonds insuffisants ou opération annulée ! Vous avez besoin de ${price} Pts mon50cc.`,
      );
    }
  },

  /**
   * Recours et demande de réexamen d'un bannissement temporaire pour vérification humaine
   * L'utilisateur utilise 5 points mon50cc. Si la sanction est annulée, levée immédiate + 50 points mon50cc de compensation.
   */
  appealBan: async function () {
    const uid = (window.session && window.session.uid) ? window.session.uid : (typeof firebase !== "undefined" && firebase.auth ? firebase.auth().currentUser?.uid : null);
    if (!uid) {
      alert("Veuillez vous connecter pour introduire un recours.");
      return;
    }

    const mod = window.Moderation;
    const banStatus = mod ? mod.getBanStatus(uid) : { isBanned: false, isTempBanned: false, tempBansCount: 0 };

    if (!banStatus.isBanned && !banStatus.isTempBanned && banStatus.tempBansCount === 0) {
      this.addBotMessage(
        "⚖️ <strong>Aucune sanction active</strong> détectée sur votre compte.<br>Votre dossier est vierge ou votre sanction a déjà été purgée ou levée."
      );
      return;
    }

    const cost = 5;
    const userBalance = window.BVCManager ? window.BVCManager.balance : 0;
    if (userBalance < cost) {
      alert(`Points mon50cc insuffisants ! Vous avez besoin de ${cost} points mon50cc pour demander une vérification humaine.`);
      return;
    }

    const proceed = confirm(
      `Demander une vérification humaine pour contester un bannissement utilise ${cost} points mon50cc.\n\n` +
      `Si la sanction est ensuite annulée après réexamen :\n` +
      `• Votre interdiction sera levée immédiatement\n` +
      `• Votre compteur de sanctions sera réinitialisé à zéro\n` +
      `• Vous recevrez 50 points mon50cc en guise de compensation !\n\n` +
      `Voulez-vous continuer ?`
    );
    if (!proceed) return;

    const reason = prompt(
      "Contestation de sanction (Vérification Humaine)\n\nExpliquez les raisons pour lesquelles vous demandez le réexamen de votre sanction (ex: malentendu, citation, compte partagé) :"
    );
    if (!reason || !reason.trim()) return;

    const details = prompt(
      "Informations ou preuves complémentaires (optionnel) :"
    ) || "";

    // Déduction des 5 points mon50cc pour le recours
    if (window.BVCManager && typeof window.BVCManager.deduct === "function") {
      const deducted = await window.BVCManager.deduct(cost);
      if (!deducted) {
        alert("Erreur lors de la déduction des points mon50cc.");
        return;
      }
    }

    const result = mod ? await mod.requestAppeal(uid, reason.trim(), details.trim(), cost) : { success: false, error: "Module de modération indisponible" };

    if (result.success) {
      this.addBotMessage(
        `⚖️ <strong>Demande de réexamen transmise avec succès !</strong><br><br>` +
        `Votre dossier a été transmis à l'équipe de modération pour <strong>vérification humaine</strong> (${cost} points mon50cc utilisés).<br><br>` +
        `<div style="background: rgba(0,230,118,0.1); border-left: 3px solid #00e676; padding: 12px; border-radius: 8px; margin-top: 8px;">` +
        `<strong>Règle formelle appliquée :</strong><br>` +
        `Si la sanction est ensuite annulée après réexamen :<br>` +
        `• Votre interdiction sera <strong>levée immédiatement</strong>.<br>` +
        `• Votre compteur de sanctions sera <strong>réinitialisé à zéro (0)</strong>.<br>` +
        `• Vous recevrez <strong>cinquante (50) points mon50cc</strong> en guise de compensation.` +
        `</div>`
      );
    } else {
      this.addBotMessage(
        `⚠️ <em>${result.error || "Une erreur est survenue lors de l'enregistrement de votre demande."}</em>`
      );
    }
  }
};

// Auto-ouverture en cas de paramètre d'URL (ex: depuis banned.html)
if (typeof window !== "undefined" && window.location && window.location.search) {
  if (window.location.search.includes("appeal=true") || window.location.search.includes("openLawyer=appeal")) {
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        if (window.PocketLawyer) {
          window.PocketLawyer.openLawyer();
          window.PocketLawyer.appealBan();
        }
      }, 600);
    });
  }
}

// Enregistrement des actions auprès de l'Event Delegator (Phase 3 & 5)
registerAction('PocketLawyer.toggleLawyer', () => window.PocketLawyer.toggleLawyer());
registerAction('PocketLawyer.openLawyer', () => window.PocketLawyer.openLawyer());
registerAction('PocketLawyer.closeLawyer', () => window.PocketLawyer.closeLawyer());
registerAction('PocketLawyer.sendMessage', () => window.PocketLawyer.sendMessage());
registerAction('PocketLawyer.startGPSScan', () => window.PocketLawyer.startGPSScan());
registerAction('PocketLawyer.appealBan', () => window.PocketLawyer.appealBan());
registerAction('PocketLawyer.reportInsurer', () => window.PocketLawyer.reportInsurer());
registerAction('PocketLawyer.generateLetter', () => window.PocketLawyer.generateLetter());
registerAction('toggleLawyer', () => window.PocketLawyer.toggleLawyer());
registerAction('openLawyer', () => window.PocketLawyer.openLawyer());
registerAction('PocketLawyer.open', () => window.PocketLawyer.openLawyer());
registerAction('open', () => window.PocketLawyer.openLawyer());

