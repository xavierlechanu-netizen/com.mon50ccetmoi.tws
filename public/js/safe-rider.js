/**
 * ðŸ† SAFE RIDER CHALLENGES
 * Gamification et rÃ©compenses BVC basÃ©es sur le kilomÃ©trage
 */

window.SafeRider = {
  currentDistance: 0,
  milestones: [
    { km: 50, reward: 10, name: "Pilote Prudent - 50 km" },
    { km: 100, reward: 25, name: "Endurance - 100 km" },
    { km: 500, reward: 100, name: "VÃ©tÃ©ran - 500 km" },
    { km: 1000, reward: 500, name: "MaÃ®tre de la Route - 1000 km" },
  ],

  init: function () {
    if (!localStorage.getItem("safe_rider_claimed")) {
      localStorage.setItem("safe_rider_claimed", JSON.stringify([]));
    }

    // Polling de la distance
    setInterval(() => {
      this.checkMilestones();
    }, 5000); // Check every 5s
  },

  getAppDistance: function () {
    return parseFloat(localStorage.getItem("total_distance") || "0");
  },

  checkMilestones: function () {
    const distance = this.getAppDistance();
    let claimed = JSON.parse(
      localStorage.getItem("safe_rider_claimed") || "[]",
    );

    for (const milestone of this.milestones) {
      if (distance >= milestone.km && !claimed.includes(milestone.km)) {
        this.awardMilestone(milestone);
        claimed.push(milestone.km);
      }
    }

    localStorage.setItem("safe_rider_claimed", JSON.stringify(claimed));
  },

  awardMilestone: function (milestone) {
    if (typeof window.braveCoins === "undefined") return;

    window.braveCoins += milestone.reward;
    localStorage.setItem("braveCoins", window.braveCoins.toString());

    const balanceEl = document.getElementById("crypto-balance");
    if (balanceEl)
      balanceEl.innerText = Math.floor(window.braveCoins) + " Pts BVC";

    // Notification UI
    const msg = `ðŸ† Challenge RÃ©ussi : ${milestone.name} ! Vous avez gagnÃ© ${milestone.reward} Pts BVC !`;
    if (typeof speak === "function") speak(msg);

    // Afficher popup
    this.showPopup(msg);
  },

  showPopup: function (message) {
    let popup = document.createElement("div");
    popup.style = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(90deg, #cca300, #b38f00); color: #000;
            padding: 15px 25px; border-radius: 30px; font-weight: bold;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5); z-index: 60000;
            animation: slideDown 0.5s ease-out, fadeOut 0.5s ease-in 4s forwards;
            display: flex; align-items: center; gap: 15px;
        `;
    popup.innerHTML = `<i class="fa-solid fa-trophy" style="font-size: 1.5rem;"></i> <span>${message}</span>`;

    const style = document.createElement("style");
    style.innerHTML = `
            @keyframes slideDown { from { top: -50px; opacity: 0; } to { top: 20px; opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; display: none; } }
        `;
    document.head.appendChild(style);
    document.body.appendChild(popup);

    setTimeout(() => {
      if (document.body.contains(popup)) document.body.removeChild(popup);
    }, 4500);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  SafeRider.init();
});
