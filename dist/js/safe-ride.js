// --- SAFE RIDE (MÃ©tÃ©o PrÃ©dictive) ---
window.SafeRide = {
  checkWeatherForRoute: async function (lat, lng) {
    try {
      // Utilisation de l'API gratuite Open-Meteo
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.current_weather) {
        const weathercode = data.current_weather.weathercode;
        const windspeed = data.current_weather.windspeed;

        let issues = [];
        let isDangerous = false;

        // Codes WMO : 51-67 (pluie/verglas), 71-77 (neige), 95-99 (orage)
        if (
          (weathercode >= 51 && weathercode <= 67) ||
          (weathercode >= 80 && weathercode <= 82)
        ) {
          issues.push("Pluie dÃ©tectÃ©e");
          isDangerous = true;
        } else if (weathercode >= 71 && weathercode <= 77) {
          issues.push("Risque de Neige ou Verglas");
          isDangerous = true;
        } else if (weathercode >= 95 && weathercode <= 99) {
          issues.push("Orage dangereux en approche");
          isDangerous = true;
        }

        if (windspeed > 40) {
          // Vent > 40 km/h (dangereux en 50cc lÃ©ger)
          issues.push("Vents violents dÃ©tectÃ©s");
          isDangerous = true;
        }

        return { isDangerous, issues, temp: data.current_weather.temperature };
      }
      return { isDangerous: false, issues: [] };
    } catch (e) {
      console.warn("[SafeRide] Meteo API fail", e);
      return { isDangerous: false, issues: [] };
    }
  },
};
