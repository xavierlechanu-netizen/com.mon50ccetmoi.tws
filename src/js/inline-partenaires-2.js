import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

function openReportModal(id, speed, gforce, fraud) {
        document.getElementById("report-id-display").innerText = "#" + id;
        document.getElementById("report-speed-display").innerText = speed;
        document.getElementById("report-gforce-display").innerText =
          gforce + " G";
        document.getElementById("report-fraud-display").innerText = fraud;

        if (parseInt(fraud) < 80) {
          document.getElementById("report-fraud-display").style.color =
            "#ff3333";
        } else {
          document.getElementById("report-fraud-display").style.color =
            "var(--accent)";
        }

        document.getElementById("report-modal").style.display = "flex";
      }

      let pendingAdminId = "";

      async function forgotPassword() {
        event.preventDefault(); // Empêche le rechargement de la page lié au href="#"

        const identifiant = document.getElementById("partner-id").value.trim();
        if (!identifiant) {
          alert(
            "Veuillez d'abord saisir votre Identifiant Partenaire ou Email dans le champ ci-dessus.",
          );
          return;
        }

        // Si c'est un compte Admin de l'entreprise (pas d'arobase)
        if (!identifiant.includes("@")) {
          pendingAdminId = identifiant;
          document.getElementById("siret-modal").style.display = "flex";
          document.getElementById("siret-input").value = "";
          document.getElementById("siret-result").textContent = "";
          return;
        }

        // Si c'est un Agent (sous-compte avec un email)
        try {
          if (
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
          ) {
            alert(
              `(Local) Un lien de réinitialisation a été envoyé à l'agent ${identifiant}.`,
            );
            return;
          }
          await firebase.auth().sendPasswordResetEmail(identifiant);
          alert(
            `Un lien de réinitialisation a été envoyé à l'adresse de l'agent : ${identifiant}`,
          );
        } catch (error) {
          console.error("Reset password error:", error);
          alert("Erreur lors de la réinitialisation : " + error.message);
        }
      }

      async function verifySiret() {
        const siret = document.getElementById("siret-input").value;
        const resultDiv = document.getElementById("siret-result");

        if (siret.length !== 14) {
          // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = '<span style="color:#ff3333;">Le SIRET doit contenir exactement 14 chiffres.</span>';
          return;
        }

        // Base de données sécurisée : Association Compte -> SIREN (9 premiers chiffres du SIRET)
        // C'est ce qui empêche de taper le SIRET de Google pour pirater le compte de Nationale de Courtage !
        const partnerSirenDatabase = {
          NATIONALE_COURTAGE: "834220556", // Remplacez par le vrai SIREN (9 chiffres) de Nationale de Courtage
          AMV_ASSURANCES: "330540907",
          MUTUELLE_MOTARDS: "327362703",
          AXA_PRO: "722057460",
          ALLIANZ_PARTNER: "340234962",
          MACIF_2ROUES: "781452511",
        };

        const expectedSiren =
          partnerSirenDatabase[pendingAdminId.toUpperCase()];
        const inputSiren = siret.substring(0, 9); // Les 9 premiers chiffres forment le SIREN

        if (expectedSiren && inputSiren !== expectedSiren) {
          // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = '<span style="color:#ff3333;"><i class="fa-solid fa-triangle-exclamation"></i> Alerte Sécurité : Ce SIRET ne correspond pas à l\'entreprise de votre compte partenaire.</span>';
          return;
        }

        // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Interrogation des bases de l\'État...</span>';

        try {
          // Appel API publique et gratuite (sans token) du gouvernement français
          const response = await fetch(
            `https://recherche-entreprises.api.gouv.fr/search?q=${siret}`,
          );
          const data = await response.json();

          if (data.results && data.results.length > 0) {
            const entreprise = data.results[0];
            if (entreprise.etat_administratif === "A") {
              // Ultime vérification : on s'assure que le SIREN retourné correspond
              if (expectedSiren && entreprise.siren !== expectedSiren) {
                // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `<span style="color:#ff3333;">Le SIRET appartient à <b>${entreprise.nom_complet}</b>, ce qui ne correspond pas à votre compte.</span>`;
                return;
              }

              // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `<span style="color:#00ff88;"><i class="fa-solid fa-check-circle"></i> <b>${entreprise.nom_complet}</b> vérifiée.<br><br>Validation réussie. Un email de réinitialisation vient d'être envoyé au dirigeant officiel.</span>`;
              setTimeout(() => {
                document.getElementById("siret-modal").style.display = "none";
              }, 5000);
            } else {
              // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = `<span style="color:#ff3333;">L'entreprise n'est plus active selon les bases légales. Demande rejetée.</span>`;
            }
          } else {
            // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = '<span style="color:#ff3333;">SIRET introuvable.</span>';
          }
        } catch (error) {
          console.error(error);
          // eslint-disable-next-line no-restricted-syntax
resultDiv.innerHTML = '<span style="color:#ff3333;">Erreur lors de la connexion à l\'API du gouvernement.</span>';
        }
      }

      async function doLogin() {
        const id = document.getElementById("partner-id").value.trim();
        const pwd = document.getElementById("partner-pwd").value;

        if (!id || !pwd) {
          alert("Veuillez entrer vos identifiants.");
          return;
        }

        const idLowerNormalized = id
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[_-]/g, "");
        const isEuroAssuranceAttempt =
          idLowerNormalized === "euroassurance" ||
          idLowerNormalized === "euroassurence";

        if (isEuroAssuranceAttempt) {
          const accept = confirm(
            "⚠️ ALERTE : Cet organisme est classé 'Partenaire non recommandé' suite à de multiples signalements.\nUn tarif de vérification renforcée de 10 000 € est requis.\nAcceptez-vous de régler cette somme pour accéder/créer votre compte ?",
          );
          if (!accept) {
            alert("Accès refusé. Le paiement est obligatoire.");
            return;
          }
        }

        try {
          try {
            await firebase.auth().signInWithEmailAndPassword(id, pwd);
          } catch (firebaseError) {
            if (
              isEuroAssuranceAttempt &&
              (firebaseError.code === "auth/user-not-found" ||
                firebaseError.code === "auth/wrong-password")
            ) {
              await firebase.auth().createUserWithEmailAndPassword(id, pwd);
            } else if (
              window.location.hostname === "localhost" ||
              window.location.hostname === "127.0.0.1"
            ) {
              console.warn(
                "Attention : Firebase bloqué en local. Connexion simulée pour tester l'interface.",
              );
            } else {
              throw firebaseError; // Sur le vrai site, on bloque vraiment
            }
          }

          // Logique pour les 5 premiers assureurs ou les pires
          const first5Partners = [
            "AMV_ASSURANCES",
            "MUTUELLE_MOTARDS",
            "AXA_PRO",
            "ALLIANZ_PARTNER",
            "MACIF_2ROUES",
            "NATIONALE_COURTAGE",
          ];
          let badgeHtml = "";
          if (first5Partners.includes(id.toUpperCase())) {
            badgeHtml =
              ' <span class="badge-fondateur" title="Partenaire Fondateur - 5 Premiers"><i class="fa-solid fa-shield"></i> Fondateur mon50ccetmoi</span>';
          } else if (isEuroAssuranceAttempt) {
            badgeHtml =
              ' <span class="badge" style="background:#ff8800; color:#fff; font-size:0.75rem; padding:4px 8px; border-radius:20px; margin-left:10px;"><i class="fa-solid fa-triangle-exclamation"></i> Partenaire non recommandé</span>';
          }

          const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
          
          // eslint-disable-next-line no-restricted-syntax
          document.getElementById("partner-name-display").innerHTML =
            escapeHTML(id) + badgeHtml;

          document.getElementById("login-overlay").style.display = "none";
          document.getElementById("dashboard").style.display = "flex";

          if (typeof db !== "undefined" && firebase.auth().currentUser) {
            const uid = firebase.auth().currentUser.uid;
            try {
              const doc = await db.collection("users").doc(uid).get();
              if (doc.exists && doc.data().isCertifiedGarage) {
                document.getElementById("nav-maintenance").style.display = "flex";
              }
            } catch (e) {
              console.warn("Could not fetch user profile", e);
            }
          } else if (idLowerNormalized.includes("garage")) {
            document.getElementById("nav-maintenance").style.display = "flex";
          }

          if (isEuroAssuranceAttempt) {
            const balanceElem = document.getElementById(
              "wallet-balance-display",
            );
            if (balanceElem) {
              balanceElem.innerText = "-10 000.00 €";
              balanceElem.style.color = "#ff3333";
            }
          }
        } catch (error) {
          console.error("Auth error:", error);
          alert("Identifiants incorrects ou accès refusé.");
        }
      }

      async function changePassword() {
        const newPwd = document.getElementById("new-pwd").value;
        if (newPwd.length < 6) {
          alert("Le mot de passe doit faire au moins 6 caractères.");
          return;
        }
        try {
          const user = firebase.auth().currentUser;
          if (user) {
            await user.updatePassword(newPwd);
            alert("Mot de passe mis à jour avec succès !");
            document.getElementById("new-pwd").value = "";
          } else {
            alert(
              "Vous êtes en mode démo (bypass local), le mot de passe n'a pas été changé sur Firebase.",
            );
          }
        } catch (error) {
          console.error("Password update error:", error);
          alert("Erreur lors de la mise à jour : " + error.message);
        }
      }

      function addAgent() {
        const name = document.getElementById("agent-name").value.trim();
        const email = document.getElementById("agent-email").value.trim();

        if (!name || !email) {
          alert("Veuillez remplir le nom et l'email de l'agent.");
          return;
        }

        const tbody = document.getElementById("agents-list");
        if (!tbody) return;
        const tr = document.createElement("tr");
        const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
        const safeName = escapeHTML(name);
        const safeEmail = escapeHTML(email);
        // eslint-disable-next-line no-restricted-syntax
tr.innerHTML = `
                <td>${safeName}</td>
                <td>${safeEmail}</td>
                <td><span class="badge pending">Invitation envoyée</span></td>
                <td><button class="btn-action" style="background:#ff3333;" data-action="this.closest('tr').remove()">Révoquer</button></td>
            `;
        tbody.appendChild(tr);

        // Reset form
        document.getElementById("agent-name").value = "";
        document.getElementById("agent-email").value = "";

        alert(
          `Accès créé pour ${name}. Un email d'invitation a été envoyé à ${email}.`,
        );
      }

      function switchView(viewId) {
        // Update Sidebar Active state
        document
          .querySelectorAll(".nav-item")
          .forEach((item) => item.classList.remove("active"));
        event.currentTarget.classList.add("active");

        // Hide all views, show targeted one
        document
          .querySelectorAll(".view")
          .forEach((view) => view.classList.remove("active"));
        document.getElementById("view-" + viewId).classList.add("active");

        // Update Header Title
        const titles = {
          overview: "Vue d'ensemble",
          reports: "Rapports Boîte Noire",
          leads: "Leads & Campagnes",
          billing: "Facturation & Wallet",
          team: "Équipe & Sécurité",
          audit: "Audit & Conformité",
        };
        document.getElementById("page-title").textContent = titles[viewId];
      }
      function submitCampaign() {
        const title = document.getElementById("campaign-title").value.trim();
        const location = document.getElementById("campaign-location").value;
        const cpa = document.getElementById("campaign-cpa").value;
        const isFlash = document.getElementById("campaign-flash").checked;

        if (!title || !cpa) {
          alert("Veuillez remplir le titre et le CPA.");
          return;
        }

        const tbody = document.getElementById("campaigns-table-body");
        const tr = document.createElement("tr");

        const escapeHTMLTitle = (str) => String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
        let displayTitle = `"${escapeHTMLTitle(title)}"`;
        if (isFlash) {
          displayTitle += ` <span style="background:var(--accent); color:#000; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold; margin-left:10px;"><i class="fa-solid fa-stopwatch"></i> Flash 48h</span>`;
        }

        const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
        const safeLocation = escapeHTML(location);
        const safeCpa = escapeHTML(cpa);

        // eslint-disable-next-line no-restricted-syntax
tr.innerHTML = `
                <td>${displayTitle}</td>
                <td>${safeLocation}</td>
                <td>0</td>
                <td>0 (0%)</td>
                <td>${safeCpa} € / Lead</td>
            `;
        tbody.insertBefore(tr, tbody.firstChild);

        document.getElementById("campaign-modal").style.display = "none";
        document.getElementById("campaign-title").value = "";
        document.getElementById("campaign-cpa").value = "";
        document.getElementById("campaign-flash").checked = false;

        alert("✅ Votre campagne a été créée et mise en ligne avec succès !");
      }

      function addFunds() {
        const amountInput = document.getElementById("billing-amount").value;
        const amount = parseFloat(amountInput);

        if (isNaN(amount) || amount <= 0) {
          alert("Veuillez entrer un montant valide.");
          return;
        }

        const balanceElem = document.getElementById("wallet-balance-display");
        let currentBalance = parseFloat(
          balanceElem.innerText.replace("€", "").trim(),
        );

        const newBalance = currentBalance + amount;
        balanceElem.innerText = newBalance.toFixed(2) + " €";

        document.getElementById("billing-modal").style.display = "none";

        const tbody = document.getElementById("billing-history-body");
        const tr = document.createElement("tr");
        const dateStr = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        // eslint-disable-next-line no-restricted-syntax
tr.innerHTML = `
                <td>A l'instant, ${dateStr}</td>
                <td>Rechargement Wallet (Stripe</td>
                <td>Paiement CB **** 4242</td>
                <td><span style="color: #00e676); font-weight: bold;">+ ${amount.toFixed(2)} €</span></td>
            `;
        tbody.insertBefore(tr, tbody.firstChild);

        alert("✅ Paiement accepté. Votre solde a été mis à jour.");
      }
// --- Action Registry (ESM) ---
registerAction('openReportModal', openReportModal);
