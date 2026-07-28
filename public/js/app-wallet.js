// F10 : ROADBOOKS COMMUNAUTAIRES (100% GRATUIT)
// ============================================================
window.CommunityRoadbooks = {
  shareMyRoute() {
    if (!window.currentRoute && !window.currentPosition) {
      alert("Lancez d'abord un itinÃƒ©raire pour pouvoir le partager !");
      return;
    }
    const name = prompt(
      "Donnez un nom ÃƒÂ  votre itinÃƒ©raire (ex: Boucle des Alpilles) :",
    );
    if (!name) return;
    const desc = prompt("Description courte (optionnel) :") || "";

    const existing = JSON.parse(
      localStorage.getItem("community_roadbooks") || "[]",
    );
    const newRb = {
      id: "rb_" + Date.now(),
      name: name.trim(),
      description: desc.trim(),
      author: window.session?.username || "Pilote Anonyme",
      distance: window.session?.lastRouteDist || "?",
      date: new Date().toLocaleDateString("fr-FR"),
      rating: 0,
      ratingCount: 0,
    };
    existing.unshift(newRb);
    // Garder max 50 roadbooks locaux
    if (existing.length > 50) existing.pop();
    localStorage.setItem("community_roadbooks", JSON.stringify(existing));
    speak(
      "ItinÃƒ©raire partagÃƒ© avec la communautÃƒ©. Merci pour votre contribution !",
    );
    showPage("community_roadbooks");
  },

  load(id) {
    const rbs = JSON.parse(localStorage.getItem("community_roadbooks") || "[]");
    const rb = rbs.find((r) => r.id === id);
    if (!rb) return;
    speak("Chargement de l'itinÃƒ©raire " + rb.name);
    // On met le nom dans la barre de recherche pour relancer
    if (document.getElementById("route-search")) {
      document.getElementById("route-search").value = rb.name;
    }
    document.getElementById("screen-overlay")?.classList.add("hidden");
  },

  rate(id) {
    const rbs = JSON.parse(localStorage.getItem("community_roadbooks") || "[]");
    const rb = rbs.find((r) => r.id === id);
    if (!rb) return;
    rb.rating = Math.min(5, (rb.rating || 0) + 1);
    rb.ratingCount = (rb.ratingCount || 0) + 1;
    localStorage.setItem("community_roadbooks", JSON.stringify(rbs));
    speak("Merci pour votre note !");
    showPage("community_roadbooks");
  },
};

// ============================================================
