/**
 * GAMIFICATION ENGINE v2.0
 * Gère l'expérience (XP), les Rangs, les Badges et l'affichage Cyberpunk.
 * Synchronise avec Firestore (gamification_stats/{userId})
 */

window.Gamification = {
    xp: 0,
    badges: [],
    
    RANKS: [
        { name: "Novice", minXp: 0, icon: "fa-motorcycle", color: "#a0a0a0" },
        { name: "Explorateur", minXp: 500, icon: "fa-compass", color: "#00d2ff" },
        { name: "Routard", minXp: 1500, icon: "fa-road", color: "#00ff88" },
        { name: "Vétéran", minXp: 3000, icon: "fa-shield-halved", color: "#ffaa00" },
        { name: "As du Bitume", minXp: 6000, icon: "fa-star", color: "#ff6600" },
        { name: "Légende 50cc", minXp: 10000, icon: "fa-crown", color: "#ffcf00" }
    ],

    BADGES: [
        { id: "first_ride", name: "Premier Trajet", icon: "fa-flag-checkered", condition: (ctx) => ctx.totalSessions >= 1 },
        { id: "road_warrior", name: "Guerrier de la Route", icon: "fa-helmet-safety", condition: (ctx) => ctx.totalKm >= 100 },
        { id: "eco_rider", name: "Éco-Pilote", icon: "fa-leaf", condition: (ctx) => ctx.avgSpeed <= 45 && ctx.totalSessions >= 5 },
        { id: "safe_driver", name: "Conducteur Prudent", icon: "fa-shield-heart", condition: (ctx) => ctx.drivingScore >= 85 },
        { id: "night_owl", name: "Hibou Nocturne", icon: "fa-moon", condition: (ctx) => ctx.nightRides >= 3 },
        { id: "social_butterfly", name: "Papillon Social", icon: "fa-users", condition: (ctx) => ctx.communityActions >= 10 },
        { id: "meca_guru", name: "Guru Mécanique", icon: "fa-wrench", condition: (ctx) => ctx.maintenanceLogs >= 5 },
        { id: "blackbox_linked", name: "Boîte Noire Connectée", icon: "fa-microchip", condition: (ctx) => ctx.blackboxSessions >= 1 }
    ],
    
    init: function() {
        // Chargement local
        this.xp = parseInt(localStorage.getItem('mon50cc_xp')) || 0;
        try {
            this.badges = JSON.parse(localStorage.getItem('mon50cc_badges')) || [];
        } catch(e) {
            this.badges = [];
        }
        
        // Synchronisation Cloud (chargement initial)
        this.loadFromCloud();
        
        this.updateHUD();
    },

    getCurrentRank: function() {
        let current = this.RANKS[0];
        for (let i = 0; i < this.RANKS.length; i++) {
            if (this.xp >= this.RANKS[i].minXp) {
                current = this.RANKS[i];
            }
        }
        return current;
    },

    getNextRank: function() {
        for (let i = 0; i < this.RANKS.length; i++) {
            if (this.xp < this.RANKS[i].minXp) {
                return this.RANKS[i];
            }
        }
        return null;
    },

    /**
     * Attribue de l'XP à la fin d'une action (ex: Roadbook, OBD, etc.)
     */
    awardXP: function(baseXP, context) {
        let totalXp = baseXP;
        let reasons = [];

        // 1. Bonus Conduite Prudente (Driving Score > 80)
        let drivingScore = window.DrivingScore ? window.DrivingScore.currentScore : 100;
        if (drivingScore >= 80) {
            totalXp += 50;
            reasons.push("Conduite Prudente (+50)");
        }

        // 2. Bonus Communauté (Ghost Mode désactivé)
        let ghostMode = window.RadarSocial ? window.RadarSocial.isGhostMode : true;
        if (!ghostMode) {
            totalXp += 20;
            reasons.push("Partage Communauté (+20)");
        }

        // 3. Multiplicateur Boîte Noire
        let blackboxConnected = document.getElementById('bb-batt') && document.getElementById('bb-batt').textContent !== '-- mV';
        if (blackboxConnected) {
            totalXp *= 2;
            reasons.push("Bonus Boîte Noire (x2)");
        }

        const oldRank = this.getCurrentRank();
        this.xp += totalXp;
        localStorage.setItem('mon50cc_xp', this.xp.toString());
        
        // Sauvegarde Cloud Sécurisée (Incrément côté serveur)
        this.syncXpToCloud(totalXp);

        const newRank = this.getCurrentRank();

        // Animation de Récompense
        this.showRewardAnimation(totalXp, reasons);

        if (newRank.name !== oldRank.name) {
            this.showLevelUpAnimation(newRank);
        }

        this.updateHUD();
    },

    /**
     * Vérifie et débloque les badges
     */
    checkBadges: function(ctx) {
        let newBadges = [];
        for (const badge of this.BADGES) {
            if (!this.badges.includes(badge.id)) {
                try {
                    if (badge.condition(ctx)) {
                        this.badges.push(badge.id);
                        newBadges.push(badge);
                    }
                } catch(e) { /* condition check failed, skip */ }
            }
        }
        if (newBadges.length > 0) {
            localStorage.setItem('mon50cc_badges', JSON.stringify(this.badges));
            this.syncBadgesToCloud();
            for (const badge of newBadges) {
                this.showBadgeUnlock(badge);
            }
        }
    },

    loadFromCloud: function() {
        if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
            try {
                const uid = firebase.auth().currentUser.uid;
                firebase.firestore().collection('gamification_stats').doc(uid).get().then((doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        // Prendre le max entre local et cloud
                        if (data.xp && data.xp > this.xp) {
                            this.xp = data.xp;
                            localStorage.setItem('mon50cc_xp', this.xp.toString());
                        }
                        if (data.badges && data.badges.length > this.badges.length) {
                            this.badges = data.badges;
                            localStorage.setItem('mon50cc_badges', JSON.stringify(this.badges));
                        }
                        this.updateHUD();
                    }
                }).catch(e => console.warn("Gamification: Cloud load failed", e));
            } catch(e) {
                console.warn("Gamification: Cloud init failed", e);
            }
        }
    },

    syncXpToCloud: function(addedXp) {
        if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
            try {
                const uid = firebase.auth().currentUser.uid;
                firebase.firestore().collection('gamification_stats').doc(uid).set({
                    xp: firebase.firestore.FieldValue.increment(addedXp),
                    rank: this.getCurrentRank().name,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch(e) {
                console.warn("Gamification: Firestore XP sync failed", e);
            }
        }
    },

    syncBadgesToCloud: function() {
        if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
            try {
                const uid = firebase.auth().currentUser.uid;
                firebase.firestore().collection('gamification_stats').doc(uid).set({
                    badges: this.badges,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch(e) {
                console.warn("Gamification: Firestore Badges sync failed", e);
            }
        }
    },

    updateHUD: function() {
        const hud = document.getElementById('gamification-hud');
        if (!hud) return;

        const rank = this.getCurrentRank();
        const nextRank = this.getNextRank();

        const iconEl = document.getElementById('gami-icon');
        if (iconEl) {
            iconEl.className = `fa-solid ${rank.icon} gami-icon`;
            iconEl.style.color = rank.color;
        }
        
        const rankEl = document.getElementById('gami-rank-name');
        if (rankEl) rankEl.textContent = rank.name;
        
        const xpEl = document.getElementById('gami-xp-text');
        if (xpEl) xpEl.textContent = `${this.xp} XP`;

        const bar = document.getElementById('gami-progress-bar');
        if (bar) {
            if (nextRank) {
                const range = nextRank.minXp - rank.minXp;
                const progress = this.xp - rank.minXp;
                const percent = Math.min(100, Math.max(0, (progress / range) * 100));
                bar.style.width = `${percent}%`;
            } else {
                bar.style.width = '100%';
                bar.style.background = 'linear-gradient(90deg, #ffcf00, #ff6600)';
            }
        }
    },

    showRewardAnimation: function(xpGained, reasons) {
        const toast = document.createElement('div');
        toast.className = 'xp-reward-toast';
        
        const reasonsHtml = reasons.map(r => `<div>${r}</div>`).join('');
        toast.innerHTML = `
            <h2>+${xpGained} XP</h2>
            <div class="reasons">${reasonsHtml}</div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    showLevelUpAnimation: function(newRank) {
        const hud = document.getElementById('gamification-hud');
        if (hud) {
            hud.classList.add('gami-level-up');
            setTimeout(() => hud.classList.remove('gami-level-up'), 1500);
        }

        const toast = document.createElement('div');
        toast.className = 'level-up-toast';
        toast.innerHTML = `
            <div class="rank-icon" style="color: ${newRank.color};">
                <i class="fa-solid ${newRank.icon}"></i>
            </div>
            <h2>Niveau Supérieur !</h2>
            <div class="rank-name">${newRank.name}</div>
        `;
        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },

    showBadgeUnlock: function(badge) {
        const toast = document.createElement('div');
        toast.className = 'level-up-toast';
        toast.innerHTML = `
            <div class="rank-icon" style="color: #00d2ff;">
                <i class="fa-solid ${badge.icon}"></i>
            </div>
            <h2>Badge Débloqué !</h2>
            <div class="rank-name">${badge.name}</div>
        `;
        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};

// Auto-init
window.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            window.Gamification.init();
        });
    } else {
        setTimeout(() => {
            window.Gamification.init();
        }, 500);
    }
});
