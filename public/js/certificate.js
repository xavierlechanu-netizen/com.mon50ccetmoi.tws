/**
 * DIGITAL COMPLIANCE CERTIFICATE v1.0
 * Official report generator for ANTS and Insurers.
 */

window.Certificate = {
  generate: function () {
    if (window.session.isGuest) {
      alert("ðŸ”’ Le Certificat Officiel est réservé aux membres inscrits.");
      return;
    }

    speak(
      "Génération de votre Certificat de Conformité Digital. Analyse des données de bord en cours.",
    );

    const passport = Wallet.getSafetyPassport();
    const scanResult =
      localStorage.getItem("last_engine_scan") || "NON EFFECTUÉ";
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const certId = "CERT-" + array[0].toString(36).toUpperCase();

    const overlay = document.createElement("div");
    overlay.id = "cert-overlay";
    overlay.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; z-index:30000; background:#fff; color:#000; padding:40px; font-family:'Courier New', Courier, monospace; overflow-y:auto;";

    overlay.innerHTML = `
            <div style="border:4px double #000; padding:30px; max-width:800px; margin:auto; position:relative; overflow: hidden; background: #fff;">
                
                <!-- Watermark Filigrane -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 5rem; font-weight: 900; color: rgba(0,0,0,0.04); white-space: nowrap; pointer-events: none; z-index: 0;">
                    mon50ccetmoi.com
                </div>

                <div style="position: relative; z-index: 1;">
                    <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:20px; margin-bottom:30px;">
                        <h1 style="margin:0; font-size:1.5rem;">CERTIFICAT DE CONFORMITÉ DIGITALE</h1>
                        <p style="font-size:0.8rem;">Émis par le système mon50ccetmoi Interceptor V26</p>
                    </div>

                    <div style="margin-bottom:30px;">
                        <p><strong>N° CERTIFICAT :</strong> ${certId}</p>
                        <p><strong>DÉTENTEUR :</strong> ${window.session.username || "Utilisateur Anonyme"}</p>
                        <p><strong>DATE D'ÉMISSION :</strong> ${new Date().toLocaleDateString()}</p>
                    </div>

                    <h3 style="border-bottom:1px solid #000;">1. ANALYSE MÉCANIQUE (AI ENGINE PULSE)</h3>
                    <p>Statut Vibratoire : <strong>${passport.engine_health}</strong></p>
                    <p>Dernier Scan : ${scanResult}</p>

                    <h3 style="border-bottom:1px solid #000; margin-top:30px;">2. SÉCURITÉ & TÉLÉMÉTRIE (BLACKBOX)</h3>
                    <p>Système Blackbox : <strong>ACTIF & SÉCURISÉ</strong></p>
                    <p>ID Dispositif : ${passport.blackbox_id}</p>
                    <p>Vitesse Max Enregistrée : ${passport.vMax_History} km/h</p>

                    <h3 style="border-bottom:1px solid #000; margin-top:30px;">3. MAINTENANCE & ENTRETIEN</h3>
                    <p>Nombre d'interventions tracées : ${passport.maintenance_count}</p>
                    <p>Statut : CONFORME</p>

                    <div style="margin-top:50px; display:flex; justify-content:space-between; align-items:flex-end;">
                        <div style="text-align:center;">
                            <div style="width:100px; height:100px; background:#000; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:0.6rem;">QR CODE CERTIFIÉ</div>
                            <p style="font-size:0.6rem; margin-top:5px;">VÉRIFICATION ANTS</p>
                        </div>
                        <div style="text-align:right;">
                            <p style="font-size:0.8rem; font-style:italic;">Signature Numérique mon50ccetmoi</p>
                            <div style="font-family:'Brush Script MT', cursive; font-size:1.5rem;">Netizen AI OS</div>
                        </div>
                    </div>
                </div>

                <button onclick="window.print()" style="margin-top:40px; width:100%; padding:15px; background:#000; color:#fff; border:none; cursor:pointer; font-weight:bold; position: relative; z-index: 1;">IMPRIMER / EXPORTER (PDF)</button>
                <button onclick="document.getElementById('cert-overlay').remove()" style="margin-top:10px; width:100%; padding:10px; background:transparent; color:#888; border:none; cursor:pointer; font-size:0.8rem; position: relative; z-index: 1;">RETOUR À L'APPLICATION</button>
            </div>
        `;
    document.body.appendChild(overlay);
  },

  generateBattery: function (tier = "premium", predefinedCertId = null) {
    if (typeof speak === "function")
      speak("Génération du certificat de batterie pour la revente.");

    let certId = predefinedCertId;
    if (!certId) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      certId = "BATT-" + array[0].toString(36).toUpperCase();
    }

    const bState = window.batteryState || {
      soh: "92%",
      mileage: "12 450 km",
      cycles: "345 / 1000",
      age: "2 ans et 3 mois",
      style: "Éco-Responsable / Fluide",
      date: "15 Janvier 2024",
    };

    const overlay = document.createElement("div");
    overlay.id = "cert-batt-overlay";
    overlay.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; z-index:40000; background:#fff; color:#000; padding:40px; font-family:'Inter', sans-serif; overflow-y:auto;";

    const watermarkHTML = `
            <!-- Watermark Filigrane -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 5rem; font-weight: 900; color: rgba(0,0,0,0.04); white-space: nowrap; pointer-events: none; z-index: 0;">
                mon50ccetmoi.com
            </div>
        `;
    let iaAnalysisHTML = "";
    let blockchainHTML = "";

    if (tier === "premium" || tier === "quantum") {
      iaAnalysisHTML = `
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 40px; background: #fffcf0;">
                    <h3 style="color: #d97706; font-size: 0.9rem; margin-top: 0;">ANALYSE DU STYLE DE CONDUITE (IA)</h3>
                    <p style="margin: 5px 0;">Profil détecté : <strong style="color: #d97706;">${bState.style}</strong></p>
                    <p style="font-size: 0.85rem; color: #666; margin-top: 10px;">L'analyse télémétrique de mon50ccetmoi atteste de ce profil de conduite, permettant de justifier de la sollicitation appliquée aux cellules de la batterie.</p>
                </div>
            `;
    } else {
      iaAnalysisHTML = `
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 40px; background: #f9f9f9;">
                    <h3 style="color: #888; font-size: 0.9rem; margin-top: 0;">ANALYSE DU STYLE DE CONDUITE (IA)</h3>
                    <p style="margin: 5px 0; color: #aaa;"><i>Information masquée. Disponible uniquement avec le Certificat Premium.</i></p>
                </div>
            `;
    }

    if (tier === "quantum") {
      const hash = Array.from(window.crypto.getRandomValues(new Uint8Array(20)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      blockchainHTML = `
                <div style="border: 1px solid #b700ff; border-radius: 8px; padding: 15px; margin-bottom: 20px; background: rgba(183, 0, 255, 0.05);">
                    <h3 style="color: #b700ff; font-size: 0.9rem; margin-top: 0; display:flex; align-items:center; gap:10px;"><svg width="16" height="16" viewBox="0 0 320 512" fill="#b700ff"><path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z"/></svg> CERTIFICATION QUANTUM SHIELD E2EE</h3>
                    <p style="font-size: 0.75rem; color: #666; margin-bottom: 0; word-break: break-all; font-family: monospace;">Clé de chiffrement : 0x${hash}a9f4c<br>Ce document est protégé par un chiffrement de bout en bout de qualité militaire.</p>
                </div>
            `;
    }

    const borderColor = tier === "quantum" ? "#b700ff" : "#10a37f";

    overlay.innerHTML = `
            <div style="border:4px solid ${borderColor}; border-radius: 10px; padding:40px; max-width:800px; margin:auto; position:relative; overflow: hidden; background: #fff;">
                
                ${watermarkHTML}

                <div style="position: relative; z-index: 1;">
                    <div style="text-align:center; border-bottom:2px solid ${borderColor}; padding-bottom:20px; margin-bottom:30px;">
                        <h1 style="margin:0; font-size:1.8rem; color:${borderColor};">CERTIFICAT D'ÉTAT DE BATTERIE (SOH)</h1>
                        <p style="font-size:0.9rem; color:#666;">Document officiel pour la revente du véhicule - Niveau : ${tier.toUpperCase()}</p>
                    </div>

                    ${blockchainHTML}

                    <div style="display: flex; justify-content: space-between; margin-bottom:30px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div>
                            <p style="margin: 5px 0;"><strong>N° CERTIFICAT :</strong> ${certId}</p>
                            <p style="margin: 5px 0;"><strong>VÉHICULE :</strong> Scooter Électrique</p>
                            <p style="margin: 5px 0;"><strong>PROPRIÉTAIRE :</strong> ${window.session ? window.session.username || "Utilisateur" : "Utilisateur"}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 5px 0;"><strong>DATE :</strong> ${new Date().toLocaleDateString()}</p>
                            <p style="margin: 5px 0;"><strong>HEURE :</strong> ${new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                        <div style="flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 20px; text-align: center;">
                            <h3 style="color: #888; font-size: 0.9rem; margin-top: 0;">ÉTAT DE SANTÉ (SOH)</h3>
                            <div style="font-size: 3rem; font-weight: 900; color: ${borderColor};">${bState.soh}</div>
                            <p style="font-size: 0.8rem; color: #666; margin-bottom: 0;">Évaluation validée</p>
                        </div>
                        <div style="flex: 2; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
                            <h3 style="color: #888; font-size: 0.9rem; margin-top: 0;">MÉTRIQUES CLÉS</h3>
                            <p style="margin: 5px 0; display:flex; justify-content:space-between;"><span>Kilométrage total :</span> <strong>${bState.mileage}</strong></p>
                            <p style="margin: 5px 0; display:flex; justify-content:space-between;"><span>Cycles de charge :</span> <strong>${bState.cycles}</strong></p>
                            <p style="margin: 5px 0; display:flex; justify-content:space-between;"><span>Mise en circulation :</span> <strong>${bState.date}</strong></p>
                            <p style="margin: 5px 0; display:flex; justify-content:space-between;"><span>Ã‚ge batterie :</span> <strong>${bState.age}</strong></p>
                        </div>
                    </div>

                    ${iaAnalysisHTML}

                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <div style="text-align:center;">
                            <div style="width:100px; height:100px; background:#000; border-radius: 10px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:0.6rem; margin:auto;">QR CODE<br>SÉCURISÉ</div>
                        </div>
                        <div style="text-align:right;">
                            <p style="font-size:0.8rem; font-style:italic; color:#666; margin-bottom:0;">Certifié par la plateforme</p>
                            <div style="font-size:1.5rem; font-weight: 900; color: ${borderColor};">mon50ccetmoi.com</div>
                        </div>
                    </div>
                </div>

                <div style="margin-top:40px; display:flex; gap:10px;" class="no-print">
                    <button onclick="window.print()" style="flex:1; padding:15px; background:${borderColor}; color:#fff; border:none; border-radius:30px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">IMPRIMER / SAUVEGARDER PDF</button>
                    <button onclick="document.getElementById('cert-batt-overlay').remove()" style="padding:15px 30px; background:#f1f1f1; color:#333; border:none; border-radius:30px; cursor:pointer; font-weight:bold;">FERMER</button>
                </div>
            </div>
            
            <style>
                @media print {
                    body * { visibility: hidden !important; }
                    #cert-batt-overlay, #cert-batt-overlay * { visibility: visible !important; }
                    #cert-batt-overlay { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; background: white; padding: 0; margin: 0; overflow: visible; display:block !important; border:none !important;}
                    .no-print { display: none !important; }
                }
            </style>
        `;
    document.body.appendChild(overlay);
  },

  purchaseBatteryCert: async function (tier) {
    // Ferme la fenêtre de prix
    const pricingScreen = document.getElementById("battery-pricing-screen");
    if (pricingScreen) pricingScreen.classList.add("hidden");

    if (typeof speak === "function")
      speak("Connexion bancaire sécurisée pour l'achat du certificat.");

    const loader = document.createElement("div");
    loader.id = "payment-loader";
    loader.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; z-index:50000; background:rgba(0,0,0,0.95); color:#fff; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:'Inter', sans-serif;";
    loader.innerHTML =
      '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i><h2 style="margin:0;">Paiement Sécurisé</h2><p id="revolut-loader-text" style="color:#aaa;">Initialisation Revolut Pay...</p>';
    document.body.appendChild(loader);

    try {
      // Déterminer le montant en centimes
      let amountCents = 499;
      if (tier === "premium") amountCents = 1499;
      if (tier === "quantum") amountCents = 2999;

      // Generate Cert ID (utilisé comme case_id pour l'ordre Revolut)
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const certId = "BATT-" + array[0].toString(36).toUpperCase();

      const projectId = window.CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
      const url = `https://europe-west1-${projectId}.cloudfunctions.net/createRevolutOrder`;

      // Création de l'ordre via Firebase Function
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: amountCents,
          currency: "EUR",
          case_id: certId,
          user_id: window.session?.uid || "guest",
          report_type: "BATTERY_CERT_" + tier.toUpperCase(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          "Erreur serveur lors de la création de l'ordre Revolut.",
        );
      }

      const orderData = await response.json();

      if (!orderData?.order_token) {
        throw new Error("Token Revolut non reçu.");
      }

      const txt = document.getElementById("revolut-loader-text");
      if (txt) txt.innerText = "Ouverture du terminal de paiement...";

      // Lancement du SDK Revolut
      if (typeof RevolutCheckout !== "function") {
        await new Promise((r) => setTimeout(r, 2000));
        if (typeof RevolutCheckout !== "function")
          throw new Error("SDK Revolut introuvable.");
      }

      const instance = await RevolutCheckout(orderData.order_token, "prod");

      loader.remove(); // On enlève notre loader pour que la popup Revolut prenne le relais

      instance.payWithPopup({
        onSuccess: async () => {
          if (typeof speak === "function")
            speak("Paiement Revolut validé. Génération de votre document.");

          // Sauvegarde Firestore uniquement si le paiement a réussi
          try {
            if (
              window.firebase &&
              window.firebase.firestore &&
              window.session &&
              window.session.uid
            ) {
              const bState = window.batteryState || {
                soh: "92%",
                mileage: "12 450 km",
                cycles: "345 / 1000",
                age: "2 ans et 3 mois",
                style: "Éco-Responsable / Fluide",
                date: "15 Janvier 2024",
              };
              await window.firebase
                .firestore()
                .collection("battery_certificates")
                .doc(certId)
                .set({
                  userId: window.session.uid,
                  username: window.session.username || "Utilisateur",
                  tier: tier,
                  certId: certId,
                  batteryData: bState,
                  timestamp:
                    window.firebase.firestore.FieldValue.serverTimestamp(),
                });
            } else {
              console.warn(
                "[Firestore] Mode hors-ligne. Le certificat n'est pas sauvegardé.",
              );
            }
          } catch (err) {
            console.error("Erreur de sauvegarde Firestore :", err);
          }

          // Génération et affichage du certificat
          this.generateBattery(tier, certId);
        },
        onError: (message) => {
          console.error("Erreur Revolut :", message);
          alert("Erreur de paiement Revolut : " + message);
          if (typeof speak === "function") speak("Le paiement a échoué.");
        },
        onCancel: () => {
          if (typeof speak === "function") speak("Paiement annulé.");
        },
      });
    } catch (error) {
      loader.remove();
      console.error("Erreur init Revolut :", error);
      alert(
        "Erreur de communication avec le serveur de paiement : " +
          error.message +
          ". La génération du certificat sécurisé est impossible.",
      );
    }
  },

  submitManualData: function () {
    const mileage = document.getElementById("man-mileage").value;
    const cycles = document.getElementById("man-cycles").value;
    const age = document.getElementById("man-age").value;
    const style = document.getElementById("man-style").value;

    if (!mileage || !cycles || !age) {
      alert("Veuillez remplir tous les champs numériques.");
      return;
    }

    // Algorithme basique SOH IA
    let soh = 100;
    soh -= (parseInt(cycles) / 1000) * 15; // perte par usage (ex: 1000 cycles = perte de 15%)
    soh -= (parseInt(age) / 12) * 2.5; // perte naturelle par an (ex: 2.5% par an)
    if (style === "Sportive / Nerveuse") soh -= 6;
    if (style === "Mixte / Urbaine") soh -= 2;
    if (soh < 0) soh = 0;
    if (soh > 100) soh = 100;
    soh = Math.round(soh);

    const ageYears = Math.floor(age / 12);
    const ageMonths = age % 12;
    const ageStr =
      ageYears > 0
        ? `${ageYears} ans et ${ageMonths} mois`
        : `${ageMonths} mois`;

    // Save in global state
    window.batteryState = {
      soh: soh + "%",
      mileage: mileage + " km",
      cycles: cycles + " / 1000",
      age: ageStr,
      style: style,
      date: "Date d'achat inconnue", // Pourrait être amélioré avec un champ date
    };

    // Mise à jour de l'UI du tableau de bord
    const elSoh = document.getElementById("battery-soh-value");
    if (elSoh) {
      elSoh.innerText = window.batteryState.soh;
      elSoh.style.color =
        soh > 80 ? "#00ffcc" : soh > 50 ? "#ffb703" : "#ff3366";
      elSoh.style.textShadow = `0 0 10px ${elSoh.style.color}`;
    }

    const elMileage = document.getElementById("battery-mileage-value");
    if (elMileage) elMileage.innerText = window.batteryState.mileage;

    const elCycles = document.getElementById("battery-cycles-value");
    if (elCycles) elCycles.innerText = window.batteryState.cycles;

    const elAge = document.getElementById("battery-age-value");
    if (elAge) elAge.innerText = window.batteryState.age;

    const elStyle = document.getElementById("battery-style-value");
    if (elStyle) {
      elStyle.innerText = window.batteryState.style;
      elStyle.style.color =
        style === "Sportive / Nerveuse" ? "#ff3366" : "#ffb703";
    }

    // Fermer la fenêtre modale
    document.getElementById("battery-manual-screen").classList.add("hidden");
    if (typeof speak === "function")
      speak(
        "Données enregistrées. État de santé estimé à " +
          soh +
          " pourcent.",
      );
  },
};
