/**
 * RIDE HABITS & ROUTINES v1.0 (OFFLINE)
 * Learns regular routes and provides automatic protection.
 */

window.Habits = {
    records: JSON.parse(localStorage.getItem('ride_habits') || '[]'),
    currentRideStart: null,

    init: function() {
        console.log("Habitudes de trajet : Initialisées.");
    },

    // Apprendre un nouveau trajet
    recordEnd: function(endPos) {
        if (!this.currentRideStart) return;

        const startPos = this.currentRideStart;
        const dist = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(startPos.lat, startPos.lng),
            new google.maps.LatLng(endPos.lat, endPos.lng)
        );

        if (dist < 500) return; // Trop court pour être un trajet

        const habit = {
            start: startPos,
            end: endPos,
            time: new Date().getHours(),
            day: new Date().getDay(),
            duration: window.currentRideDuration || 0
        };

        this.records.push(habit);
        // On ne garde que les 20 derniers pour l'apprentissage local
        if (this.records.length > 20) this.records.shift();
        
        localStorage.setItem('ride_habits', JSON.stringify(this.records));
        this.currentRideStart = null;
    },

    // Vérifier si le trajet actuel ressemble à une habitude
    detectHabit: function(currentPos) {
        const hour = new Date().getHours();
        
        const matchingHabit = this.records.find(h => {
            const distStart = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(currentPos.lat, currentPos.lng),
                new google.maps.LatLng(h.start.lat, h.start.lng)
            );
            // Si on part d'un endroit connu à une heure similaire (+/- 2h)
            return distStart < 300 && Math.abs(h.time - hour) <= 2;
        });

        if (matchingHabit) {
            console.log("Habitude détectée ! Activation de la protection automatique.");
            if (!window.isGuardianActive && typeof toggleGuardianAngel === "function") {
                toggleGuardianAngel();
                speak("Trajet habituel détecté. Ange Gardien activé automatiquement.");
            }
            return matchingHabit;
        }
        return null;
    }
};

// Monitoring de début de trajet
setInterval(() => {
    if (window.isRiding && !window.Habits.currentRideStart && currentPosition) {
        window.Habits.currentRideStart = currentPosition;
        window.currentRideDuration = 0;
        window.Habits.detectHabit(currentPosition);
    }
    if (window.isRiding) {
        window.currentRideDuration = (window.currentRideDuration || 0) + 10;
    }
}, 10000);
