/* --- BRAVE COINS (BVC) LEADERBOARD --- */

window.Leaderboard = {
    // Pseudonymes RGPD-Friendly
    mockNames: [
        "Pilote_Fantôme_84", "Rider_99", "ScooterKing", "NightCruiser", 
        "Tmax_Killer", "Urban_Fox", "NeoRider", "Ghost_Driver", 
        "Shadow_50", "Asphalt_Surfer", "Cyber_Wheel", "Neon_Rider"
    ],
    
    // Badges pour le Top 3
    badges: [
        { icon: '<i class="fa-solid fa-crown" style="color: gold;"></i>', title: 'Pilote Élite' },
        { icon: '<i class="fa-solid fa-medal" style="color: silver;"></i>', title: 'Pilote Vétéran' },
        { icon: '<i class="fa-solid fa-award" style="color: #cd7f32;"></i>', title: 'Challenger' }
    ],

    generateMockData: function() {
        let players = [];
        
        // Générer 9 fausses personnes avec des scores entre 100 et 5000 BVC
        for(let i=0; i<9; i++) {
            players.push({
                name: this.mockNames[Math.floor(Math.random() * this.mockNames.length)] + '_' + Math.floor(Math.random()*100),
                score: Math.floor(Math.random() * 4900) + 100,
                isMe: false
            });
        }
        
        // Ajouter l'utilisateur courant
        const myScore = window.braveCoins || parseFloat(localStorage.getItem('bvc_balance')) || 0;
        players.push({
            name: "VOUS (Moi)",
            score: Math.floor(myScore),
            isMe: true
        });

        // Trier par score décroissant
        players.sort((a, b) => b.score - a.score);
        return players;
    },

    render: function() {
        const modal = document.getElementById('leaderboard-modal');
        if (!modal) return;

        const players = this.generateMockData();
        const podiumContainer = document.getElementById('leaderboard-podium');
        const listContainer = document.getElementById('leaderboard-list');

        podiumContainer.innerHTML = '';
        listContainer.innerHTML = '';

        // Construire le Podium (L'ordre visuel sur un podium est souvent: 2, 1, 3)
        if (players.length >= 3) {
            // Rank 2
            podiumContainer.innerHTML += this.createPodiumHTML(players[1], 2);
            // Rank 1
            podiumContainer.innerHTML += this.createPodiumHTML(players[0], 1);
            // Rank 3
            podiumContainer.innerHTML += this.createPodiumHTML(players[2], 3);
        }

        // Construire la liste (Rangs 4 à 10+)
        for(let i = 3; i < players.length; i++) {
            listContainer.innerHTML += this.createListHTML(players[i], i + 1);
        }

        modal.classList.remove('hidden');
    },

    createPodiumHTML: function(player, rank) {
        const badge = this.badges[rank - 1];
        const isMeStyle = player.isMe ? "color: #00d2ff; text-shadow: 0 0 10px #00d2ff;" : "";
        return `
            <div class="lb-podium-item">
                <div class="lb-podium-badge" title="${badge.title}">${badge.icon}</div>
                <div class="lb-podium-score">${player.score} Pts</div>
                <div class="lb-podium-name" style="${isMeStyle}">${player.name}</div>
                <div class="lb-podium-rank lb-rank-${rank}">${rank}</div>
            </div>
        `;
    },

    createListHTML: function(player, rank) {
        const isMeClass = player.isMe ? "is-me" : "";
        return `
            <div class="lb-list-item ${isMeClass}">
                <div class="lb-list-rank">#${rank}</div>
                <div class="lb-list-info">
                    <div class="lb-list-name">${player.name}</div>
                </div>
                <div class="lb-list-score">${player.score} Pts</div>
            </div>
        `;
    }
};

window.showLeaderboard = function() {
    if (window.Leaderboard) {
        window.Leaderboard.render();
    } else {
        console.error("Module Leaderboard non chargé.");
    }
};
