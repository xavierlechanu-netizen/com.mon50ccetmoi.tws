/**
 * CHRONOS GUARD v1.0
 * Door-to-Door Punctuality AI.
 * Calculates commute time including "Gearing up" buffer.
 */

window.Chronos = {
  gearUpTime: 5, // 5 minutes par dÃ©faut pour l'Ã©quipement
  targetArrivalTime: null,
  nextEvent: null,

  syncCalendar: async function () {
    if (window.session && window.session.isGuest) {
      alert(
        "ðŸ”’ La synchronisation Nexus Calendar est rÃ©servÃ©e aux membres officiels. Rejoignez la communautÃ© pour automatiser vos trajets !",
      );
      return;
    }
    speak(
      "Synchronisation Nexus Calendar en cours. Analyse de votre emploi du temps.",
    );

    // Simulation d'appel API Calendar (Google/iCal)
    // En prod, on utiliserait gapi.client.calendar.events.list
    setTimeout(() => {
      this.nextEvent = {
        title: "Rendez-vous Client",
        location: "Place de la Concorde, Paris",
        startTime: "18:45",
      };

      this.targetArrivalTime = this.nextEvent.startTime;
      speak(
        `Ã‰vÃ©nement dÃ©tectÃ© : ${this.nextEvent.title} Ã  ${this.nextEvent.startTime}. Destination prÃ©-chargÃ©e.`,
      );

      const widget = document.getElementById("chronos-countdown");
      if (widget) widget.textContent = "CAL";

      this.startMonitoring();
    }, 2000);
  },

  setTarget: function (timeStr) {
    this.targetArrivalTime = timeStr;
    speak(
      `Objectif d'arrivÃ©e fixÃ© Ã  ${timeStr}. Chronos Guard surveille dÃ©sormais votre fenÃªtre de dÃ©part.`,
    );
    this.startMonitoring();
  },

  calculateDeparture: function (travelTimeMinutes) {
    const totalNeeded = travelTimeMinutes + this.gearUpTime;

    const now = new Date();
    const target = new Date();
    const [hours, minutes] = this.targetArrivalTime.split(":");
    target.setHours(hours, minutes, 0);

    const departureDate = new Date(target.getTime() - totalNeeded * 60000);
    const timeLeftBeforeGearUp =
      (departureDate.getTime() - now.getTime()) / 60000;

    return {
      departureTime: departureDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      minutesRemaining: Math.round(timeLeftBeforeGearUp),
    };
  },

  startMonitoring: function () {
    setInterval(() => {
      if (!this.targetArrivalTime || window.isRiding) return;

      // On simule un temps de trajet de 15min pour l'exemple (en prod, on utilise directionsService)
      const travelTime = 15;
      const info = this.calculateDeparture(travelTime);

      if (info.minutesRemaining <= 2 && info.minutesRemaining > 0) {
        speak(
          `Alerte PonctualitÃ© : Il est temps de vous Ã©quiper. DÃ©part dans ${info.minutesRemaining} minutes.`,
        );
        Hardware.vibratePattern("warning");
      }
    }, 60000);
  },
};
