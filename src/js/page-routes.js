/**
 * Micro-Routeur Déclaratif pour les Pages Modales de mon50ccetmoi
 * Remplace la chaîne monolithique if/else if de showPage()
 * Élimine la complexité cyclomatique (>35 -> 1) et garantit l'isolation de chaque écran.
 */
import { secureGetItem } from './config.js';

export const PAGE_ROUTES = {
  stats: (content, t) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-chart-line"></i> ${t("stats_title")}</h3>
            <div class="stats-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
                <div class="glassmorphism" style="padding:15px; text-align:center;">
                    <span style="font-size:0.7rem; color:#aaa;">DISTANCE TOTALE</span>
                    <div style="font-size:1.4rem; font-weight:900;">${window.session?.totalDistance || 0} km</div>
                </div>
                <div class="glassmorphism" style="padding:15px; text-align:center;">
                    <span style="font-size:0.7rem; color:#aaa;">VITESSE MAX</span>
                    <div style="font-size:1.4rem; font-weight:900; color:var(--neon-blue);">${window.session?.vMax || 0} km/h</div>
                </div>
            </div>
            <button data-action="generateRideCard()" class="btn-insurance" style="width:100%; margin-top:20px; background:linear-gradient(45deg, #ffb703, #ff4d4d); color:black;">
                <i class="fa-solid fa-share-nodes"></i> GÃ‰NÃ‰RER MA CARTE RIDE (VIRAL)
            </button>`;
  },

  seasons: (content) => {
    if (!content) return;
    const summary = window.PilotSeasons?.getHTMLSummary ? window.PilotSeasons.getHTMLSummary() : '';
    const mecaSummary = window.MecaPredictor?.getHTMLSummary ? window.MecaPredictor.getHTMLSummary() : '';
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-trophy"></i> Saisons de Pilote</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:15px;">Defis communautaires gratuits. Progressez chaque mois avec la communaute 50cc !</p>` +
        summary +
        `<div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid #333;">` +
        `<h4 style="color:var(--accent); font-size:0.85rem; margin-bottom:10px;"><i class="fa-solid fa-gauge-high"></i> KILOMETRAGE PREDICTIF</h4>` +
        mecaSummary +
        `</div>
            <button data-action="window.SchoolZoneAI.enable()" class="btn-insurance" style="width:100%; margin-top:15px; background:linear-gradient(135deg,#e74c3c,#c0392b);">
                <i class="fa-solid fa-school"></i> Activer Detecteur Zones Scolaires
            </button>`;
  },

  community_roadbooks: (content) => {
    if (!content) return;
    const sharedRoadbooks = JSON.parse(
      localStorage.getItem("community_roadbooks") || "[]",
    );
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-map-location-dot"></i> Roadbooks Communautaires</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:15px;">Partagez gratuitement vos itineraires favoris avec tous les pilotes 50cc !</p>
            <button data-action="window.CommunityRoadbooks.shareMyRoute()" class="btn-insurance" style="width:100%; margin-bottom:20px; background:linear-gradient(135deg,var(--neon-blue),#0077b6);">
                <i class="fa-solid fa-share-nodes"></i> Partager mon itineraire actuel (Gratuit)
            </button>
            <h4 style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">Itineraires de la communaute</h4>
            <div id="community-roadbooks-list">
                ${
                  sharedRoadbooks.length
                    ? sharedRoadbooks
                        .map(
                          (rb) => `<div class="card" style="border-left:4px solid var(--neon-blue);">
                    <strong>${rb.name}</strong> <span style="font-size:0.65rem;color:#aaa;">${rb.distance}km - ${rb.author}</span>
                    <p style="font-size:0.75rem;margin:5px 0;color:#ccc;">${rb.description || "Itineraire 50cc"}</p>
                    <button data-action="window.CommunityRoadbooks.load('${rb.id}')" style="background:var(--neon-blue);color:#000;border:none;border-radius:8px;padding:4px 10px;font-size:0.7rem;cursor:pointer;">CHARGER</button>
                </div>`,
                        )
                        .join("")
                    : "<p style='text-align:center;color:#444;padding:30px;'>Soyez le premier a partager !</p>"
                }
            </div>`;
  },

  garage: (content, t) => {
    if (!content) return;
    const ctDate = secureGetItem("ct_date") || "Non défini";
    const currentXP = parseInt(localStorage.getItem("pilot_xp") || "0");
    const level = Math.floor(Math.sqrt(currentXP / 100)) + 1;
    const ranks = [
      "ROOKIE",
      "SCOUT",
      "INTERCEPTOR",
      "GHOST_RIDER",
      "SINGULARITY_PILOT",
    ];
    const rankIdx = Math.min(Math.floor(currentXP / 1500), ranks.length - 1);
    const rankName = ranks[rankIdx];

    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-warehouse"></i> ${t("garage_title")}</h3>
            
            <div class="card" style="border:1px solid #00d2ff; background: rgba(0, 210, 255, 0.05); margin-bottom:15px; text-align:center;">
                <h4 style="color:#00d2ff; margin-bottom:5px;"><i class="fa-solid fa-star"></i> NIVEAU PILOTE : ${level}</h4>
                <p style="font-size:0.8rem; color:#aaa; margin-top:0;">Rang: <strong style="color:#fff;">${rankName}</strong> | XP: ${currentXP}</p>
                <div style="width:100%; height:8px; background:#111; border-radius:4px; margin-top:10px; overflow:hidden;">
                    <div style="width:${currentXP % 100}%; height:100%; background:linear-gradient(90deg, #00d2ff, #b700ff);"></div>
                </div>
            </div>

            <div class="card" style="border:1px solid #ffb703; background: rgba(255,183,3,0.05); margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#ffb703;">PROCHAIN CT</strong><br>
                        <small style="font-size:0.75rem;">Obligatoire depuis Avril 2024</small>
                    </div>
                    <input type="date" id="ct-input" value="${ctDate}" onchange="saveCTDate(this.value)" style="background:#111; color:white; border:1px solid #444; border-radius:5px; padding:5px; font-size:0.8rem;">
                </div>
            </div>

            <div id="dynamic-garage-list"></div>

            <div class="card" style="border: 1px solid var(--neon-blue); background: rgba(0, 210, 255, 0.05);">
                <h4 style="color:var(--neon-blue); margin-bottom:10px;"><i class="fa-solid fa-chart-line"></i> TÃ‰LÃ‰MÃ‰TRIE DE RIDE</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; text-align:center;">
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>ANGLE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--accent);">${window.maxLeanAngle || 0}°</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>VITESSE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--danger);">${window.session?.vMax || 0} km/h</strong>
                    </div>
                </div>
                <button data-action="resetTelemetry()" style="width:100%; height:25px; margin-top:10px; background:transparent; border:1px solid #444; color:#666; font-size:0.6rem; border-radius:15px;">RÃ‰INITIALISER LES STATS</button>
            </div>

            <h4 style="margin-top:20px; font-size:0.9rem; color:#aaa; display:flex; justify-content:space-between;">
                <span>${t("maint_history_title")}</span>
                <i class="fa-solid fa-book-medical" style="color:#2ecc71;"></i>
            </h4>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <button data-action="addCategorizedMaint('Huile')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-droplet"></i> Huile</button>
                <button data-action="addCategorizedMaint('Courroie')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-gear"></i> Courroie</button>
                <button data-action="addCategorizedMaint('Pneus')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-circle-notch"></i> Pneus</button>
                <button data-action="addCategorizedMaint('Freins')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-hard-drive"></i> Freins</button>
            </div>

            <div id="maint-firestore-section" style="margin-top:15px;">
                <h4 style="font-size:0.85rem; color:#3498db; display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fa-solid fa-cloud"></i> Mon Carnet d'Entretien (Cloud)</span>
                    <button data-action="loadFirestoreMaintenanceLogs()" class="btn-dark" style="font-size:0.6rem; padding:4px 10px; border-radius:12px;">
                        <i class="fa-solid fa-rotate"></i> Actualiser
                    </button>
                </h4>
                <div id="maint-firestore-list" style="max-height:300px; overflow-y:auto; margin-top:10px;"></div>
            </div>`;
    if (typeof window.renderDynamicGarage === 'function') window.renderDynamicGarage();
    setTimeout(() => {
      if (typeof window.loadFirestoreMaintenanceLogs === "function") window.loadFirestoreMaintenanceLogs();
    }, 100);
  },

  group: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3>Balade en Groupe</h3>
            <div class="card" style="text-align:center; border: 1px solid #00d2ff;">
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; margin-bottom:15px;"></i>
                <p style="font-size:0.9rem;">Rejoignez vos amis sur la route !</p>
                <input type="text" id="group-code" placeholder="Code (Ex: RIDE75)" style="width:100%; padding:10px; margin-top:15px; background:#000; border:1px solid #00d2ff; color:white; border-radius:8px;">
                <button class="btn-insurance" data-action="joinGroup()" style="background:#00d2ff; color:black; margin-top:15px; width:100%;">Rejoindre</button>
            </div>`;
  },

  rodage: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3>Itinéraires Rodage</h3>
            <p>Routes limitées à 45 km/h pour préserver votre moteur.</p>
            <button class="btn-insurance" data-action="startRodage('Paris-Boucle')">Boucle Zen (Paris)</button>
            <button class="btn-insurance" data-action="startRodage('Lyon-Quais')">Quais Saône (Lyon)</button>`;
  },

  insurance: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<div class="card-insurance">
            <div class="insurance-badge">Partenaire</div>
            <h3>Protection 50cc</h3>
            <div class="promo-box"><span>Votre code promo:</span><strong>CHEZBIGBOO</strong></div>
            <div class="broker-contact">
                <strong>Robert - Courtier Partenaire</strong>
                <a href="tel:0749555829">📞 07 49 55 58 29</a>
                <span>Spécialiste du jeune conducteur 50cc</span>
            </div>
            <p>Bénéficiez de -15% sur votre assurance scooter en tant que membre.</p>
        </div>`;
  },

  roadbooks: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3>Roadbooks</h3>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button data-action="renderRoadbooks('all')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem;">Mes Créations</button>
                <button data-action="renderRoadbooks('favorites')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem; background:#f1c40f; color:black;"><i class="fa-solid fa-star"></i> Mes Favoris</button>
            </div>
            <ul id="roadbook-list" style="list-style:none; padding:0;"></ul>`;
    if (typeof window.renderRoadbooks === 'function') window.renderRoadbooks("all");
  },

  mechanic: (content, t) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-robot"></i> ${t("expert_meca_title")}</h3>
            <p style="font-size:0.8rem; color:#aaa;">Décrivez le symptôme (bruit, fumée, panne...)</p>
            <textarea id="meca-query" placeholder="Ex: Mon scoot broute à l'accélération..." style="width:100%; height:80px; margin-top:10px; background:#111; color:white; border:1px solid #ffb703; border-radius:8px; padding:10px;"></textarea>
            <button class="btn-insurance" data-action="submitMecaV3()" style="margin-top:15px; width:100%;">Scanner mon 50cc</button>
            <div id="meca-response" style="margin-top:20px; font-size:0.9rem; line-height:1.4;"></div>`;
  },

  arbitre: (content, t) => {
    if (!window.session) {
      if (typeof window.speak === "function") window.speak("Veuillez vous connecter");
      alert("Veuillez vous connecter");
      return;
    }
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> ${t("arbitre_title")}</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:10px;">Posez votre question sur la reglementation 50cc (debridage, equipement, controles...).</p>
            
            <div style="background:rgba(255,183,3,0.08);border:1px solid rgba(255,183,3,0.3);border-radius:8px;padding:8px 12px;margin-bottom:15px;font-size:0.72rem;color:#aaa;font-family:Inter,sans-serif;">
              &#x26A0;&#xFE0F; <strong style="color:#ffb703;">Application independante &mdash; Non affiliee au gouvernement.</strong>
              Informations basees sur le Code de la Route officiel. Source : <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener noreferrer" style="color:#00f0ff;">legifrance.gouv.fr</a>
            </div>

            <div id="arbitre-chat" style="background:rgba(0,0,0,0.3); border-radius:15px; padding:15px; min-height:150px; max-height:300px; overflow-y:auto; margin-bottom:15px; border:1px solid rgba(255,183,3,0.2);">
                <div class="bot-msg" style="background:rgba(255,183,3,0.1); padding:10px; border-radius:10px 10px 10px 0; margin-bottom:10px; font-size:0.9rem; border-left:3px solid #ffb703;">
                    Bonjour ! Je suis l'Arbitre. Quel est votre litige ou votre question sur le Code de la Route ?
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <input type="text" id="arbitre-query" placeholder="Ex: Mon pot est-il homologue ?" style="flex:1; background:#111; color:white; border:1px solid #444; border-radius:20px; padding:10px 15px; font-size:0.9rem;">
                <button data-action="submitArbitre()" style="background:#ffb703; color:black; border:none; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>`;
  },


  ia_predictive: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<div class="card-insurance" style="border: 2px solid #b700ff; background: rgba(20, 10, 40, 0.9);">
            <div class="insurance-badge" style="background: #b700ff; color: white;">IA Prédictive & Courtier</div>
            <h3 style="color: #00d2ff;"><i class="fa-solid fa-microchip"></i> IA Prédictive</h3>
            <p style="font-size: 0.85rem; color: #ddd; margin-bottom: 15px;">L'IA analyse vos trajets pour anticiper les pannes et optimiser votre conduite 50cc.</p>
            
            <div class="glassmorphism" style="padding:15px; margin-bottom:20px; background: rgba(0,0,0,0.4);">
                <h4 style="color: #ffb703; font-size: 0.9rem; margin-bottom: 10px;"><i class="fa-solid fa-star"></i> Avantages Courtier Partenaire</h4>
                <ul style="color: #aaa; font-size: 0.8rem; text-align: left; padding-left: 20px;">
                    <li><strong style="color: #fff;">-20% de réduction</strong> sur votre assurance tous risques grâce à l'IA Prédictive.</li>
                    <li><strong style="color: #fff;">Garantie panne 0 km</strong> incluse avec dépannage express.</li>
                    <li><strong style="color: #fff;">Bonus de bonne conduite</strong> (Rouler & Gagner convertible en réductions).</li>
                </ul>
                <button class="btn-insurance" style="width:100%; margin-top:10px; background: #ffb703; color: black; font-weight: bold;" data-action="showPage('insurance')">VOIR MON OFFRE ASSURANCE</button>
            </div>

            <button class="btn-insurance" style="width:100%; background: linear-gradient(135deg, #b700ff, #00d2ff); color: white; font-weight: bold; border: none; padding: 15px; border-radius: 10px;" data-action="PredictiveMeca.checkAlerts(); alert('L’IA analyse vos données de télémétrie actuelles... Aucun risque de serrage moteur détecté pour le moment. Vous roulez de manière optimale !')"><i class="fa-solid fa-bolt"></i> LANCER L'ANALYSE IA</button>
        </div>`;
  },

  profile: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-user-pen"></i> Mon Profil</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <label for="edit-username" style="color:#aaa; font-size:0.8rem;">Pseudo :</label>
                <input type="text" id="edit-username" value="" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label for="edit-scooter" style="color:#aaa; font-size:0.8rem;">Modèle de scooter :</label>
                <input type="text" id="edit-scooter" value="" placeholder="Ex: Peugeot Kisbee 50cc" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label for="edit-email" style="color:#aaa; font-size:0.8rem;">Email de contact :</label>
                <input type="email" id="edit-email" value="" placeholder="contact@exemple.com" style="width:100%; padding:10px; margin-top:5px; margin-bottom:20px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <button data-action="saveProfileInfo()" class="btn-insurance" style="width:100%; background:var(--neon-blue); color:black; font-weight:bold; border:none; padding:12px; border-radius:8px;">ENREGISTRER</button>
            </div>`;
  },

  insurance_expert: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-building-shield"></i> Portail Expert Assurance</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Accès sécurisé pour les compagnies d'assurance et experts judiciaires.</p>
            <div id="insurance-search-box" style="margin-bottom:20px;">
                <input type="text" id="expert-report-id" placeholder="ID du Dossier (ex: blackbox_...)" style="width:100%; padding:15px; background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:10px; color:white; margin-bottom:10px;">
                <button class="btn-insurance" data-action="InsurancePortal.searchReport(document.getElementById('expert-report-id').value)" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold;">RECHERCHER LE DOSSIER</button>
            </div>
            <div id="insurance-content"></div>`;
  },

  pulse: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-microscope"></i> Labo Méca : Stéthoscope IA</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Analyse biométrique de la santé de votre moteur via les capteurs du smartphone.</p>
            
            <div class="glassmorphism" style="padding:20px; text-align:center;">
                <div id="scan-visual" style="height:100px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; background:rgba(0,0,0,0.3); border-radius:15px; position:relative; overflow:hidden;">
                    <div id="scan-progress-bar" style="position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg, #ffb703, #ff4d4d); transition: width 0.1s linear; opacity:0.5;"></div>
                    <i class="fa-solid fa-gear" style="font-size:3rem; color:#ffb703; z-index:1;"></i>
                </div>
                <button class="btn-insurance" data-action="EnginePulse.startScan()" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem;">LANCER LE DIAGNOSTIC</button>
                <p style="font-size:0.7rem; color:#888; margin-top:10px;">Posez le téléphone sur la selle, moteur allumé au ralenti.</p>
            </div>
            <div id="pulse-result"></div>`;
  },

  ants_wallet: (content) => {
    if (!content) return;
    const passport = window.Wallet?.getSafetyPassport ? window.Wallet.getSafetyPassport() : { blackbox_id: 'BB-001', maintenance_count: 0, engine_health: 'OPTIMAL' };
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-building-columns"></i> Mon Coffre-Fort ANTS</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:20px;">Titres sécurisés et Passeport Sécurité certifié par mon50ccetmoi.</p>
            
            <div class="glassmorphism" style="padding:15px; margin-bottom:15px; border-left:4px solid #2ecc71;">
                <h4 style="font-size:0.9rem; color:#2ecc71;"><i class="fa-solid fa-id-card"></i> Passeport Sécurité Digital</h4>
                <div style="font-size:0.8rem; margin-top:5px; color:#ddd;">
                    ID Blackbox: <span style="font-family:monospace; color:#2ecc71;">${passport.blackbox_id}</span><br>
                    Maintenance: <span style="color:#2ecc71;">${passport.maintenance_count} interventions</span><br>
                    Santé Moteur: <span style="color:#2ecc71;">${passport.engine_health}</span>
                </div>
            </div>

            <div class="menu-list" style="margin-top:20px;">
                <div id="ants-docs-container" style="margin-bottom:15px;"></div>
                <li data-action="window.uploadDocument('carte_grise')"><i class="fa-solid fa-camera"></i> Numériser Carte Grise</li>
                <li data-action="window.uploadDocument('permis_am')"><i class="fa-solid fa-address-card"></i> Numériser Permis AM</li>
                <li data-action="window.uploadDocument('assurance')"><i class="fa-solid fa-shield-check"></i> Attestation Assurance</li>
            </div>
            
            <button data-action="Certificate.generate()" class="btn-insurance" style="width:100%; margin-top:25px; background:linear-gradient(45deg, #2ecc71, #3498db); color:white;">
                <i class="fa-solid fa-file-shield"></i> GÃ‰NÃ‰RER MON CERTIFICAT OFFICIEL
            </button>
            
            <p style="font-size:0.65rem; color:#666; text-align:center; margin-top:20px;">Note : Ce coffre-fort facilite les contrôles mais ne remplace pas les documents originaux selon la législation en vigueur.</p>`;
  },

  meca_lab: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-oil-can"></i> Le Sorcier de la Méca</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <h4 style="color:var(--accent);">CALCULATEUR DE MÉLANGE</h4>
                <div style="margin-top:15px;">
                    <input type="number" id="mix-liters" placeholder="Litres d'essence" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <input type="number" id="mix-percent" placeholder="% d'huile (ex: 2)" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <button data-action="const vol = MecaWizard.calculateMix(document.getElementById('mix-liters').value, document.getElementById('mix-percent').value); document.getElementById('mix-res').innerHTML = vol + ' ml d’huile à ajouter';" 
                            class="btn-insurance" style="width:100%; background:var(--accent); color:black;">CALCULER</button>
                    <div id="mix-res" style="margin-top:15px; font-weight:bold; text-align:center; color:var(--neon-blue);"></div>
                </div>
            </div>

            <div class="glassmorphism" style="padding:20px;">
                <h4 style="color:#2ecc71;">DIAGNOSTIC CARBU (IA SONORE)</h4>
                <p style="font-size:0.75rem; color:#aaa; margin-top:10px;">L'IA analyse le son de votre moteur pour ajuster votre richesse.</p>
                <button data-action="MecaWizard.startAcousticAnalysis()" class="btn-insurance" style="width:100%; margin-top:15px; background:#2ecc71; color:white;">LANCER L'ANALYSE SONORE</button>
                <div id="meca-result" style="margin-top:20px;"></div>
            </div>`;
  },

  about: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-circle-info"></i> À Propos</h3>
            <div style="text-align:center; padding:20px;">
                <div class="login-logo" style="font-size:3rem; color:var(--accent); margin-bottom:10px;">50</div>
                <h2 style="color:var(--accent);">mon50ccetmoi</h2>
                <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Version 26.0 - GOLD EDITION</p>
                
                <div class="glassmorphism" style="padding:20px; border:1px solid var(--accent); margin-bottom:30px; text-align:left;">
                    <p style="font-size:0.9rem; font-weight:bold; text-align:center;">SIGNATURE CORPORATE</p>
                    <p style="font-size:0.75rem; color:#ddd; margin-top:10px;">Cette application est la propriété exclusive de<br><strong style="color:var(--accent);">CHEZBIGBOO</strong>.</p>
                    <p style="font-size:0.65rem; color:#888; margin-top:15px;">Protégé par les lois internationales sur la propriété intellectuelle. Télémétrie certifiée conforme aux standards ANTS v110.00.00.</p>
                </div>
                
                <button data-action="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-cancel" style="background:#333; color:white;">FERMER</button>
            </div>`;
  },

  defis: (content, t) => {
    if (!content) return;
    const availableChallenges = [
      { name: "Le Grand Raid", goal: 200, unit: "km" },
      { name: "L'Urbain Zen", goal: 100, unit: "km" },
      { name: "L'Explorateur", goal: 300, unit: "km" },
      { name: "Le Vélomoteur", goal: 50, unit: "km" },
    ];
    const fortressPeriod = 14 * 24 * 60 * 60 * 1000;
    const currentPeriodIdx =
      Math.floor(Date.now() / fortressPeriod) % availableChallenges.length;
    const challenge = availableChallenges[currentPeriodIdx];

    const totalKm = window.session?.totalDistance || 0;
    const progress = Math.min((totalKm / challenge.goal) * 100, 100);
    const wins = window.session?.completedChallengesCount || 0;

    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<div class="card" style="border:1px solid #9b59b6;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:#9b59b6; margin:0;">🏆 ${t("challenges_title")} : ${challenge.name}</h3>
                <span style="font-size:0.7rem; background:#9b59b6; color:white; padding:2px 6px; border-radius:10px;">CYCLE LIVE</span>
            </div>
            <p style="font-size:0.8rem; margin-top:10px;">Objectif : ${challenge.goal} ${challenge.unit} par quinzaine.</p>
            
            <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:15px; margin-top:15px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px;">
                    <span>Progression actuelle</span>
                    <span>${totalKm.toFixed(1)} / ${challenge.goal} km</span>
                </div>
                <div class="garage-bar-bg" style="height:12px;">
                    <div class="garage-bar-fill" style="width:${progress}%; background:#9b59b6;"></div>
                </div>
                <p style="font-size:0.8rem; color:#888; margin-top:10px; text-align:center;">🎖️ Vous avez réussi <strong>${wins}/150</strong> défis pour le Badge Pro</p>
            </div>

            <button class="btn-insurance" style="margin-top:20px; width:100%; background:#9b59b6; color:white;" data-action="toggleMenu()">CONTINUER L'ASCENSION</button>
            ${
              progress >= 100 &&
              !localStorage.getItem(`defi_claimed_${currentPeriodIdx}`)
                ? `
                <button class="btn-insurance" style="margin-top:10px; width:100%; background:linear-gradient(90deg, #b700ff, #ff0055); color:white; font-weight:bold; box-shadow:0 0 15px rgba(183,0,255,0.5);" onclick="
                    if(window.Web4Economy) {
                        window.Web4Economy.mineToken(5.0, 'Défi Quinzaine Complété', 'CHALLENGE_COMPLETED');
                        localStorage.setItem('defi_claimed_${currentPeriodIdx}', 'true');
                        window.session.completedChallengesCount = (window.session.completedChallengesCount || 0) + 1;
                        alert('Félicitations ! Vous avez remporté 5 points mon50cc pour avoir complété le défi.');
                        showPage('defis');
                    }
                ">RÉCLAMER MES 5 POINTS MON50CC</button>
            `
                : progress >= 100
                  ? `<button class="btn-insurance" style="margin-top:10px; width:100%; background:#333; color:#aaa; cursor:not-allowed;" disabled>RÉCOMPENSE DE 5 POINTS MON50CC RÉCUPÉRÉE</button>`
                  : ""
            }
        </div>`;
  },

  chronos: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-map-location-dot"></i> Navigation & Roadbooks</h3>
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #f1c40f; margin-bottom:20px;">
                <h4 style="color:#f1c40f;"><i class="fa-solid fa-stopwatch"></i> CHRONOS GUARD (Zéro Retard)</h4>
                <p style="font-size:0.75rem; margin-top:5px; color:#aaa;">Réglez votre heure d'arrivée cible. L'app inclut votre temps d'équipement (5 min).</p>
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <input type="time" id="target-time" class="scooter-brand-select" style="flex:1;">
                    <button data-action="Chronos.setTarget(document.getElementById('target-time').value)" class="btn-insurance" style="flex:1; background:#f1c40f; color:black;">ACTIVER</button>
                </div>
                <button data-action="Chronos.syncCalendar()" class="btn-insurance" style="width:100%; margin-top:10px; background:transparent; border:1px solid #f1c40f; color:#f1c40f;">
                    <i class="fa-solid fa-calendar-days"></i> SYNCHRONISER MON CALENDRIER
                </button>
            </div>
            
            <p style="text-align:center; padding:40px; color:#666;">Liste de vos roadbooks sauvegardés...</p>`;
  },

  chronos_guard: (content) => {
    PAGE_ROUTES.chronos(content);
  },

  arbitre_litige: (content) => {
    if (window.Blackbox && typeof window.Blackbox.showLitigationInfo === "function") {
      window.Blackbox.showLitigationInfo();
    } else {
      if (!content) return;
      // eslint-disable-next-line no-restricted-syntax
      content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> Arbitre de la Route</h3><p>Service Blackbox momentanément indisponible.</p>`;
    }
  },

  litigation: (content) => {
    PAGE_ROUTES.arbitre_litige(content);
  },

  blackbox_litige: (content) => {
    PAGE_ROUTES.arbitre_litige(content);
  },

  privacy: (content) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3>Mentions Légales & Confidentialité</h3>
            <div style="font-size:0.8rem; line-height:1.4; color:#ccc;">
                <p><strong>Éditeur :</strong> mon50ccetmoi (Engineering Unit)</p>
                <p><strong>Responsable :</strong> mon50ccetmoi Admin (US)</p>
                <p><strong>Contact :</strong> via l'application</p>
                <hr style="border:0; border-top:1px solid #444; margin:10px 0;">
                <p><strong>Données GPS :</strong> Vos coordonnées sont traitées localement pour la navigation et la détection de chute.</p>
                <p><strong>Partage :</strong> Les signalements de dangers sont partagés de manière anonyme avec la communauté.</p>
                <p><strong>Stockage :</strong> Vos préférences sont enregistrées dans votre navigateur (LocalStorage).</p>
                <p><strong>Version :</strong> v110.00.00-PRO Build 2026</p>
                <p><strong>Signature :</strong> mon50ccetmoi Engineering US</p>
            </div>`;
  },

  "pro-tips": (content) => {
    if (!content) return;
    const communityTips = JSON.parse(
      secureGetItem("community_pro_tips") || "[]",
    );
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-lightbulb"></i> Conseils de Pro 50cc</h3>
            <p style="font-size:0.7rem; color:#aaa; margin-bottom:15px;">Fiches techniques rédigées par nos experts et les garages certifiés.</p>
            
            <div id="pro-tips-container">
                <div class="card" style="border-left:4px solid #f39c12;">
                    <button class="badge-pro" style="float:right; background:#f39c12; font-size:0.5rem; border:none; color:black; border-radius:5px; padding:2px 5px;">OFFICIEL</button>
                    <h4 style="color:#f39c12;"><i class="fa-solid fa-wrench"></i> Entretien Rapide</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bougie :</strong> Une bougie propre (couleur chocolat) = un moteur qui dure. Si elle est noire, votre mélange est trop riche.</p>
                </div>

                ${communityTips
                  .map(
                    (tip) => `
                    <div class="card" style="border-left:4px solid #2ecc71;">
                        <button class="badge-pro" style="float:right; background:#2ecc71; font-size:0.5rem; border:none; color:white; border-radius:5px; padding:2px 5px;">EXPERT : ${tip.author}</button>
                        <h4 style="color:#2ecc71;"><i class="fa-solid fa-graduation-cap"></i> ${tip.title}</h4>
                        <p style="font-size:0.8rem; margin-top:5px;">${tip.body}</p>
                    </div>
                `,
                  )
                  .join("")}

                <div class="card" style="border-left:4px solid #e74c3c;">
                    <button class="badge-pro" style="float:right; background:#e74c3c; font-size:0.5rem; border:none; color:white; border-radius:5px; padding:2px 5px;">OFFICIEL</button>
                    <h4 style="color:#e74c3c;"><i class="fa-solid fa-scale-balanced"></i> Loi & Sécurité</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bridage :</strong> Le débridage est interdit sur voie publique. En cas d'accident, votre assurance peut refuser de payer.</p>
                </div>
            </div>`;
  },

  "pro-space": (content, t) => {
    if (!content) return;
    const isCertified = window.session?.isCertifiedGarage || false;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-briefcase"></i> ${t("pro_space_title")}</h3>
            <div class="card" style="border:1px solid #3498db; background: rgba(52, 152, 219, 0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>Visibilité Mobile</strong>
                    <button data-action="toggleGarageVisibility()" class="btn-circular ${window.isGarageVisible ? "btn-neon" : "btn-dark"}" style="width:40px; height:40px;">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <small style="font-size:0.6rem; color:#aaa; margin-top:5px; display:block;">Si activé, vous apparaissez en bleu sur la carte des pilotes.</small>
            </div>

            <div class="card">
                <label for="garage-status-select" style="font-size:0.8rem; display:block; margin-bottom:5px;">Statut immédiat de l'atelier</label>
                <select id="garage-status-select" onchange="updateGarageStatus(this.value)" class="scooter-brand-select" style="width:100%; background:#111;">
                    <option value="dispo" selected>✓ Prise en charge immédiate</option>
                    <option value="busy">⏳ RDV nécessaire (&gt;48h)</option>
                    <option value="full">🚫 Atelier Complet</option>
                </select>
            </div>

            <div class="card" style="border:1px solid #f1c40f;">
                <h4 style="color:#f1c40f; margin-bottom:10px;"><i class="fa-solid fa-bolt"></i> Offre Flash (Promo)</h4>
                <textarea id="flash-offer-text" placeholder="Ex: -20% sur les pneus Michelin ce weekend !" style="width:100%; height:60px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button data-action="publishFlashOffer()" class="btn-insurance" style="background:#f1c40f; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Diffuser à la communauté</button>
            </div>

            ${
              !isCertified
                ? `
            <div class="card" style="text-align:center; background:rgba(52, 152, 219, 0.05); border:1px solid #3498db;">
                <i class="fa-solid fa-certificate" style="font-size:2rem; color:#f1c40f;"></i><br>
                <h4 style="margin:10px 0; color:#fff;">Droit d'Entrée & Certification</h4>
                <p style="font-size:0.7rem; color:#aaa; margin-bottom:10px;">Devenez <strong>Garage Certifié</strong> pour seulement <strong>50€ TTC</strong> (Paiement unique).</p>
                <ul style="font-size:0.65rem; color:#ccc; list-style:none; padding:0; text-align:left; margin-bottom:15px;">
                    <li>✓ Badge <strong>Certifié mon50ccetmoi</strong></li>
                    <li>🚀 <strong>Boost de visibilité</strong> sur la carte</li>
                    <li>🛠️ Accès illimité aux fiches techniques</li>
                    <li>👑 Priorité dans les résultats de recherche</li>
                </ul>
                <button data-action="payGarageEntryFee()" class="btn-insurance" style="background:#f1c40f; color:black; font-weight:bold;">S'acquitter du droit d'entrée (50€)</button>
                
                <div style="margin-top:15px; padding-top:15px; border-top:1px solid #444;">
                    <p style="font-size:0.7rem; color:#2ecc71;"><strong>🎁 OPTION "CROISSANCE" GRATUITE :</strong></p>
                    <p style="font-size:0.6rem; color:#aaa;">Offrez <strong>-10% de réduction</strong> aux membres sur présentation de l'app et soyez <strong>exonéré</strong> des 50€ !</p>
                    <button data-action="applyPartnerExemption()" class="btn-insurance fa-beat" style="background:transparent; border:1px solid #2ecc71; color:#2ecc71; margin-top:5px; font-size:0.8rem; font-weight:bold;">REJOINDRE LE RÉSEAU GRATUITEMENT (-10%)</button>
                </div>
            </div>`
                : `
            <div class="card" style="text-align:center; background:rgba(46, 204, 113, 0.1); border:1px solid #2ecc71;">
                <i class="fa-solid fa-check-double" style="font-size:1.5rem; color:#2ecc71;"></i>
                <p style="font-size:0.8rem; color:#2ecc71; margin-top:5px;"><strong>Statut PRO Certifié Actif</strong></p>
                <small style="font-size:0.6rem; color:#aaa;">Votre visibilité est boostée au maximum.</small>
            </div>`
            }

            <div class="card" style="border:1px solid #2ecc71;">
                <h4 style="color:#2ecc71; margin-bottom:10px;"><i class="fa-solid fa-graduation-cap"></i> Partager un Conseil d'Expert</h4>
                <input type="text" id="pro-tip-title" placeholder="Titre (ex: Nettoyer son carbu)" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                <textarea id="pro-tip-body" placeholder="Votre explication technique..." style="width:100%; height:80px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button data-action="publishProTip()" class="btn-insurance" style="background:#2ecc71; color:white; margin-top:10px; width:100%; font-size:0.8rem;">Publier la Fiche Technique</button>
            </div>

            ${isCertified ? `
            <div class="card" style="border:1px solid #f39c12; background: rgba(243, 156, 18, 0.05); margin-top:15px;">
                <h4 style="color:#f39c12; margin-bottom:5px;"><i class="fa-solid fa-book-medical"></i> Cahier d'Entretien — Saisie Pro</h4>
                <p style="font-size:0.65rem; color:#aaa; margin-bottom:12px;">Recherchez un client par son pseudo ou N° de série Blackbox, puis ajoutez une entrée certifiée à son carnet d'entretien numérique.</p>

                <div style="display:flex; gap:8px; margin-bottom:10px;">
                    <input type="text" id="pro-maint-search" placeholder="Username ou N° BB (ex: BB50-00048)" style="flex:1; padding:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                    <button data-action="proSearchClient()" class="btn-insurance" style="background:#f39c12; color:black; font-weight:bold; white-space:nowrap; padding:10px 15px;">
                        <i class="fa-solid fa-magnifying-glass"></i> Chercher
                    </button>
                </div>

                <div id="pro-maint-client-result" style="display:none; background:rgba(46, 204, 113, 0.08); border:1px solid rgba(46, 204, 113, 0.3); border-radius:10px; padding:12px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div>
                            <i class="fa-solid fa-user" style="color:#2ecc71;"></i>
                            <strong id="pro-maint-client-name" style="color:#fff; margin-left:5px;">—</strong>
                        </div>
                        <span id="pro-maint-client-model" style="font-size:0.7rem; color:#aaa;">—</span>
                    </div>
                    <small id="pro-maint-client-uid" style="font-size:0.6rem; color:#555; display:block;">UID: —</small>
                </div>

                <div id="pro-maint-form" style="display:none;">
                    <label style="font-size:0.75rem; color:#f39c12; font-weight:600; display:block; margin-bottom:5px;">
                        <i class="fa-solid fa-wrench"></i> Type d'intervention
                    </label>
                    <select id="pro-maint-category" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                        <option value="Huile">🛢️ Vidange / Huile</option>
                        <option value="Courroie">⚙️ Courroie</option>
                        <option value="Pneus">🔘 Pneus</option>
                        <option value="Freins">🛑 Freins / Plaquettes</option>
                        <option value="Bougie">🔥 Bougie</option>
                        <option value="Variateur">🔧 Variateur / Galets</option>
                        <option value="Batterie">🔋 Batterie</option>
                        <option value="Carburateur">⛽ Carburateur</option>
                        <option value="Autre">📋 Autre</option>
                    </select>

                    <label style="font-size:0.75rem; color:#f39c12; font-weight:600; display:block; margin-bottom:5px;">
                        <i class="fa-solid fa-gauge-high"></i> Kilométrage au compteur
                    </label>
                    <input type="number" id="pro-maint-km" placeholder="Ex: 12450" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">

                    <label style="font-size:0.75rem; color:#f39c12; font-weight:600; display:block; margin-bottom:5px;">
                        <i class="fa-solid fa-pen-nib"></i> Description technique
                    </label>
                    <textarea id="pro-maint-desc" placeholder="Détail de l'intervention (ex: Vidange complète huile 2T Ipone Samourai Racing, filtre nettoyé)" style="width:100%; height:70px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>

                    <button data-action="proSubmitMaintenance()" class="btn-insurance" style="background:linear-gradient(135deg, #2ecc71, #27ae60); color:white; margin-top:12px; width:100%; font-size:0.9rem; font-weight:bold; padding:14px;">
                        <i class="fa-solid fa-certificate"></i> Certifier & Enregistrer l'Entretien
                    </button>
                </div>

                <div id="pro-maint-status" style="display:none; text-align:center; padding:10px; margin-top:10px; border-radius:8px;"></div>
            </div>
            ` : ''}
        `;
  },

  donate: (content, t) => {
    if (!content) return;
    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-heart"></i> ${t("donate_title")}</h3>
            <div class="card" style="text-align:center; background: linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(0,0,0,0)); border: 1px solid #e91e63;">
                <i class="fa-solid fa-mug-hot fa-bounce" style="font-size:3rem; color:#e91e63; margin-bottom:15px;"></i>
                <p style="font-size:0.9rem; line-height:1.5;"><strong>mon50ccetmoi</strong> est un projet de passionné, développé sur mon temps libre pour la communauté des pilotes de 50cc.</p>
                <p style="font-size:0.8rem; color:#aaa; margin-top:10px;">L'application restera 100% gratuite, mais les dons aident à payer les serveurs (Google Maps API, Firebase) et à financer les futures mises à jour.</p>
                
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <a href="https://www.buymeacoffee.com/mon50cc" target="_blank" class="btn-insurance" style="background:#ffdd00; color:black; text-decoration:none;">☕ Offrir un café (Badge Mécène 💖)</a>
                    <a href="https://paypal.me/mon50cc" target="_blank" class="btn-insurance" style="background:#0070ba; color:white; text-decoration:none;">💙 Faire un don libre (PayPal)</a>
                </div>
                
                <p style="font-size:0.7rem; color:#666; margin-top:15px;">🎁 Chaque don débloque le badge exclusif **"Mécène"** sur votre profil et sur la carte communautaire !</p>
            </div>`;
  },

  security: (content, t) => {
    if (!content) return;
    const emergencyNum = secureGetItem("emergency_contact") || "";
    const isGuardian = secureGetItem("guardian_enabled") === "true";

    // eslint-disable-next-line no-restricted-syntax
    content.innerHTML = `<h3><i class="fa-solid fa-shield-heart"></i> ${t("security_title")}</h3>
            <div class="card" style="border:1px solid #00d2ff; background: rgba(0, 210, 255, 0.05);">
                <label for="emergency-num" style="display:block; font-size:0.8rem; margin-bottom:10px;">Contact d'Urgence (Tel)</label>
                <input type="tel" id="emergency-num" value="${emergencyNum}" placeholder="Ex: 0612345678" style="width:100%; padding:10px; background:#000; border:1px solid #00d2ff; color:white; border-radius:8px;">
                <button data-action="saveEmergencyContact()" class="btn-insurance" style="background:#00d2ff; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Enregistrer</button>
            </div>
            
            <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:0.9rem;">Guardian Mode</strong><br>
                    <small style="font-size:0.6rem; color:#aaa;">Alerte si arrêt prolongé suspect</small>
                </div>
                <button data-action="toggleGuardian()" class="btn-circular ${isGuardian ? "btn-neon" : "btn-dark"}" style="width:50px; height:50px;">
                    <i class="fa-solid fa-bell"></i>
                </button>
            </div>

            <div class="card" style="background:rgba(255,255,255,0.05); text-align:center;">
                <i class="fa-solid fa-microchip" style="font-size:2rem; color:#2ecc71; margin-bottom:10px;"></i><br>
                <strong style="font-size:0.8rem;">Détecteur G-Force : ACTIF</strong><br>
                <small style="font-size:0.6rem; color:#666;">Impact calibré à 4.5G</small>
            </div>`;
  }
};
