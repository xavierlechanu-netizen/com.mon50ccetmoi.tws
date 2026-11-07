import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { initialsAvatar } from './avatar.js';

// ─── Real Data Fetching (Firestore) ─────────────────────
      let currentUser = null;

      async function loadRealData() {
        const sessionRaw = localStorage.getItem('session');
        if (!sessionRaw) {
          console.log("Aucune session trouvée");
          return;
        }

        try {
          currentUser = JSON.parse(sessionRaw);
          if (!currentUser || !currentUser.uid) return;
          
          // Mise à jour de l'UI avec les infos du profil
          document.getElementById('dash-greeting-text').textContent = `Salut ${currentUser.username || 'Pilote'} 👋`;
          const avatarUrl = initialsAvatar(currentUser.username || 'Pilote', '#ffffff'); // local, plus d'envoi à ui-avatars.com
          document.getElementById('dash-avatar-img').src = avatarUrl;

          if (typeof db === 'undefined') {
            console.warn("Firestore (db) n'est pas initialisé");
            return;
          }

          const userRef = db.collection('users').doc(currentUser.uid);
          const docSnap = await userRef.get();
          let userData = docSnap.data();

          // Si c'est un nouvel utilisateur sans stats, on initialise des données par défaut
          if (!userData || !userData.stats) {
            console.log("Initialisation des données réelles par défaut...");
            userData = await initializeUserData(userRef, userData);
          }

          // 1. Mise à jour du Score BVC
          const scoreBVC = userData.bvc_score || 85;
          animateScore(scoreBVC);

          // 2. Mise à jour des Quick Stats
          const stats = userData.stats || { km: 0, hours: 0, speed: 0, streak: 0 };
          document.querySelectorAll('[data-count]').forEach(el => {
            const type = el.parentElement.querySelector('.stat-label').textContent.toLowerCase();
            if (type.includes('km')) el.dataset.count = stats.km;
            else if (type.includes('heures')) el.dataset.count = stats.hours;
            else if (type.includes('jours')) el.dataset.count = stats.streak;
          });
          document.querySelectorAll('.stat-card').forEach(card => {
             if(card.querySelector('.stat-label').textContent.includes('vitesse')) {
                card.querySelector('.stat-value').textContent = stats.speed;
             }
          });
          animateCounters();

          // 3. Récupération de l'historique hebdo
          const weeklyRef = await userRef.collection('weekly_stats').orderBy('order').get();
          let weeklyData = [];
          if (weeklyRef.empty) {
             weeklyData = [
              { day: "Lun", km: 8, order: 1 }, { day: "Mar", km: 12, order: 2 },
              { day: "Mer", km: 5, order: 3 }, { day: "Jeu", km: 18, order: 4 },
              { day: "Ven", km: 24, order: 5 }, { day: "Sam", km: 15, order: 6 },
              { day: "Dim", km: 4, order: 7 }
             ];
             // Sauvegarde des stats hebdos par défaut
             for(const w of weeklyData) {
               await userRef.collection('weekly_stats').doc(w.day).set(w);
             }
          } else {
             weeklyRef.forEach(doc => weeklyData.push(doc.data()));
          }
          renderWeeklyChart(weeklyData);

          // 4. Récupération des Trajets
          const tripsRef = await userRef.collection('trips').orderBy('timestamp', 'desc').limit(5).get();
          let tripsData = [];
          if (tripsRef.empty) {
             tripsData = [
              { route: "Domicile → Lycée Victor Hugo", date: "Aujourd'hui", dist: "4.2 km", time: "12 min", score: 96, quality: "good", timestamp: Date.now() },
              { route: "Lycée → Centre Commercial", date: "Hier", dist: "6.8 km", time: "19 min", score: 88, quality: "good", timestamp: Date.now() - 86400000 },
              { route: "Domicile → Garage Mécano Pro", date: "Il y a 2 jours", dist: "12.1 km", time: "28 min", score: 72, quality: "ok", timestamp: Date.now() - (86400000*2) }
             ];
             for(const t of tripsData) {
                await userRef.collection('trips').add(t);
             }
          } else {
             tripsRef.forEach(doc => tripsData.push(doc.data()));
          }
          renderTrips(tripsData);

        } catch (e) {
          console.error('[Dashboard] Erreur lors du chargement Firestore:', e);
        }
      }

      // Initialise les données si manquantes dans la base
      async function initializeUserData(userRef, existingData) {
        const newData = {
          ...existingData,
          bvc_score: 92,
          stats: {
            km: 1247,
            hours: 86,
            speed: 34,
            streak: 12
          }
        };
        await userRef.set(newData, { merge: true });
        return newData;
      }

      // ─── Render Weekly Chart ────────────────────────────────
      function renderWeeklyChart(weeklyData) {
        const container = document.getElementById('weekly-chart');
        const maxKm = Math.max(...weeklyData.map(d => d.km), 1);
        // eslint-disable-next-line no-restricted-syntax
container.innerHTML = '';

        weeklyData.forEach((day, i) => {
          const heightPercent = (day.km / maxKm) * 100;
          const col = document.createElement('div');
          col.className = 'chart-bar-col';
          // eslint-disable-next-line no-restricted-syntax
col.innerHTML = `
            <div class="chart-bar-value">${day.km}</div>
            <div class="chart-bar" style="height: 0%; transition-delay: ${i * 0.08}s;"></div>
            <div class="chart-bar-label">${day.day}</div>
          `;
          container.appendChild(col);

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              col.querySelector('.chart-bar').style.height = heightPercent + '%';
            });
          });
        });
      }

      // ─── Render Trips List ──────────────────────────────────
      function renderTrips(tripsData) {
        const container = document.getElementById('trips-list');
        // eslint-disable-next-line no-restricted-syntax
container.innerHTML = '';

        tripsData.forEach(trip => {
          const item = document.createElement('div');
          item.className = 'trip-item';
          // eslint-disable-next-line no-restricted-syntax
item.innerHTML = `
            <div class="trip-icon trip-${trip.quality}">
              <i class="fa-solid fa-${trip.quality === 'good' ? 'check-circle' : 'exclamation-circle'}"></i>
            </div>
            <div class="trip-info">
              <div class="trip-route">${trip.route}</div>
              <div class="trip-meta">
                <span><i class="fa-regular fa-calendar"></i> ${trip.date}</span>
                <span><i class="fa-solid fa-road"></i> ${trip.dist}</span>
                <span><i class="fa-regular fa-clock"></i> ${trip.time}</span>
              </div>
            </div>
            <div class="trip-score ${trip.quality}">${trip.score}/100</div>
          `;
          container.appendChild(item);
        });
      }

      // ─── Animate BVC Score Ring ──────────────────────────────
      function animateScore(targetScore) {
        const circle = document.getElementById('score-ring-circle');
        const circumference = 2 * Math.PI * 78; // r=78
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference;

        const valueEl = document.getElementById('score-value');
        const targetOffset = circumference - (targetScore / 100) * circumference;

        // Animate after a brief delay
        setTimeout(() => {
          circle.style.strokeDashoffset = targetOffset;

          // Count up animation
          const duration = 1500;
          const startTime = performance.now();

          function updateCount(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            valueEl.textContent = Math.floor(eased * targetScore);
            if (progress < 1) requestAnimationFrame(updateCount);
          }
          requestAnimationFrame(updateCount);
        }, 600);
      }

      // ─── Counter Animation (Stats) ──────────────────────────
      function animateCounters() {
        const counters = document.querySelectorAll('[data-count]');
        counters.forEach(counter => {
          const target = parseInt(counter.dataset.count);
          const duration = 1800;
          const startTime = performance.now();

          function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = Math.floor(eased * target).toLocaleString('fr-FR');
            if (progress < 1) requestAnimationFrame(update);
          }
          requestAnimationFrame(update);
        });
      }

      // ─── Init ───────────────────────────────────────────────
      document.addEventListener('DOMContentLoaded', () => {
        // Lance le chargement des données réelles Firebase
        loadRealData();
      });