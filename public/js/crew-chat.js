/**
 * CREW CHAT (Messagerie PrivÃ©e SÃ©curisÃ©e)
 */
window.CrewChat = {
  isOpen: false,
  unsubscribe: null,

  open: function () {
    if (!window.session || !window.session.crewId) {
      return alert(
        "Vous devez Ãªtre dans un Crew pour utiliser le chat privÃ©.",
      );
    }

    let container = document.getElementById("crew-chat-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "crew-chat-container";
      container.style.cssText =
        "position:fixed; bottom:80px; right:20px; width:350px; height:500px; max-height:80vh; max-width:90vw; background:rgba(10,10,15,0.95); border:1px solid #00f2ff; border-radius:15px; box-shadow:0 0 20px rgba(0,242,255,0.2); z-index:9998; display:flex; flex-direction:column; backdrop-filter:blur(10px); font-family:'Outfit', sans-serif; overflow:hidden; transition:transform 0.3s ease;";
      document.body.appendChild(container);

      container.innerHTML = `
                <div style="background:linear-gradient(90deg, #111, #004455); padding:15px; border-bottom:1px solid #00f2ff; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:#00f2ff; font-size:1.1rem;"><i class="fa-solid fa-comments"></i> Chat du Crew</h3>
                    <button onclick="window.CrewChat.close()" style="background:transparent; border:none; color:#fff; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-times"></i></button>
                </div>
                <div id="crew-chat-messages" style="flex:1; padding:15px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
                    <!-- Messages dynamiques -->
                </div>
                <div style="padding:15px; border-top:1px solid #333; display:flex; gap:10px; background:rgba(0,0,0,0.5);">
                    <input type="text" id="crew-chat-input" placeholder="Message secret..." autocomplete="off" style="flex:1; padding:10px; border-radius:20px; border:1px solid #333; background:#111; color:#fff; outline:none;">
                    <button onclick="window.CrewChat.sendMessage()" style="background:#00f2ff; color:#000; border:none; border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            `;

      // Envoyer avec la touche EntrÃ©e
      document
        .getElementById("crew-chat-input")
        .addEventListener("keypress", function (e) {
          if (e.key === "Enter") {
            window.CrewChat.sendMessage();
          }
        });
    }

    container.style.transform = "translateY(0)";
    this.isOpen = true;
    this.listenMessages();
  },

  close: function () {
    const container = document.getElementById("crew-chat-container");
    if (container) {
      container.style.transform = "translateY(150%)"; // Cacher en bas
    }
    this.isOpen = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  },

  sendMessage: async function () {
    const input = document.getElementById("crew-chat-input");
    const text = input.value.trim();
    if (!text || !window.session || !window.session.crewId) return;

    input.value = "";

    try {
      await firebase
        .firestore()
        .collection("crew_chats")
        .doc(window.session.crewId)
        .collection("messages")
        .add({
          authorUid: window.session.uid,
          authorName: window.session.username || "Pilote",
          text: text,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
      console.error("[CrewChat] Error sending message", e);
      alert("Erreur lors de l'envoi du message.");
    }
  },

  listenMessages: function () {
    if (!window.session || !window.session.crewId) return;

    const messagesDiv = document.getElementById("crew-chat-messages");

    // Se dÃ©sabonner d'une Ã©ventuelle Ã©coute prÃ©cÃ©dente
    if (this.unsubscribe) this.unsubscribe();

    this.unsubscribe = firebase
      .firestore()
      .collection("crew_chats")
      .doc(window.session.crewId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .limit(50) // Charger les 50 derniers messages
      .onSnapshot((snapshot) => {
        messagesDiv.innerHTML = "";
        snapshot.forEach((doc) => {
          const data = doc.data();
          const isMe = data.authorUid === window.session.uid;

          const time = data.timestamp
            ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          const bubbleAlign = isMe
            ? "align-self: flex-end;"
            : "align-self: flex-start;";
          const bubbleColor = isMe
            ? "background: #004455; border: 1px solid #00f2ff;"
            : "background: #222; border: 1px solid #444;";
          const textColor = isMe ? "color: #fff;" : "color: #ccc;";

          const msgEl = document.createElement("div");
          msgEl.style.cssText = `max-width: 80%; padding: 10px 15px; border-radius: 15px; ${bubbleAlign} ${bubbleColor} ${textColor} word-wrap: break-word; font-size:0.9rem;`;

          msgEl.innerHTML = `
                        ${!isMe ? `<strong style="color:#00f2ff; font-size:0.75rem; display:block; margin-bottom:3px;">${data.authorName}</strong>` : ""}
                        ${data.text}
                        <div style="font-size:0.65rem; color:#888; text-align:right; margin-top:5px;">${time}</div>
                    `;

          messagesDiv.appendChild(msgEl);
        });

        // Scroll en bas
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
  },
};
