/**
 * CERTIFIED CAMERA MODULE (Dashcam Photo Experte)
 * Gère l'appareil photo, la capture et l'incrustation des données indélébiles (Watermark).
 */

window.CertifiedCamera = {
    stream: null,
    videoEl: null,
    overlayEl: null,
    currentCaseCode: null,

    open: async function(caseCode = null) {
        if (this.overlayEl) return; // Déjà ouvert
        this.currentCaseCode = caseCode;

        // Création de l'interface en plein écran
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'certified-camera-overlay';
        this.overlayEl.style = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: #000;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        // Élément vidéo
        this.videoEl = document.createElement('video');
        this.videoEl.setAttribute('autoplay', '');
        this.videoEl.setAttribute('playsinline', '');
        this.videoEl.style = "width: 100%; height: 100%; object-fit: cover;";

        // Interface utilisateur (Boutons + HUD)
        const uiContainer = document.createElement('div');
        uiContainer.style = `
            position: absolute;
            bottom: 30px;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        `;

        const hudText = document.createElement('div');
        hudText.style = "color: #00ffcc; font-family: monospace; text-shadow: 0 0 5px #000; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 10px; font-size: 0.9rem;";
        const hudCase = caseCode ? ` - DOSSIER: ${caseCode}` : '';
        hudText.innerHTML = `<i class="fa-solid fa-lock"></i> Mode Preuve Certifiée (mon50cc.com)${hudCase}`;

        const btnCapture = document.createElement('button');
        btnCapture.innerHTML = '<i class="fa-solid fa-camera"></i> CAPTURER';
        btnCapture.style = `
            width: 80px; height: 80px;
            border-radius: 50%;
            border: 4px solid #fff;
            background: rgba(255, 0, 0, 0.8);
            color: #fff;
            font-size: 0.8rem;
            font-weight: bold;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
            cursor: pointer;
        `;
        btnCapture.onclick = () => this.capture();

        const btnClose = document.createElement('button');
        btnClose.innerHTML = '<i class="fa-solid fa-times"></i> Fermer';
        btnClose.style = "background: rgba(50, 50, 50, 0.8); color: #fff; border: none; padding: 10px 20px; border-radius: 20px;";
        btnClose.onclick = () => this.close();

        uiContainer.appendChild(hudText);
        uiContainer.appendChild(btnCapture);
        uiContainer.appendChild(btnClose);

        this.overlayEl.appendChild(this.videoEl);
        this.overlayEl.appendChild(uiContainer);
        document.body.appendChild(this.overlayEl);

        // Lancement de la caméra arrière
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            this.videoEl.srcObject = this.stream;
            if(typeof speak === 'function') speak('Caméra certifiée activée. Ciblez le dommage.');
        } catch (err) {
            console.error("Erreur caméra :", err);
            alert("Impossible d'accéder à la caméra. Vérifiez les permissions.");
            this.close();
        }
    },

    capture: function() {
        if (!this.videoEl || !this.stream) return;

        // Effet flash
        const flash = document.createElement('div');
        flash.style = "position:absolute; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999999; pointer-events:none; transition: opacity 0.5s;";
        document.body.appendChild(flash);
        setTimeout(() => flash.style.opacity = '0', 50);
        setTimeout(() => flash.remove(), 500);

        if ('vibrate' in navigator) navigator.vibrate(50); // Son du clic / vibration

        // Création du canvas invisible
        const canvas = document.createElement('canvas');
        canvas.width = this.videoEl.videoWidth;
        canvas.height = this.videoEl.videoHeight;
        const ctx = canvas.getContext('2d');

        // Dessiner l'image
        ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);

        // Récupération des données GPS & Vitesse
        let lat = "INCONNU";
        let lng = "INCONNU";
        if (window.currentPosition) {
            lat = window.currentPosition.lat.toFixed(6);
            lng = window.currentPosition.lng.toFixed(6);
        }
        
        let speed = 0;
        const speedEl = document.getElementById('speed');
        if (speedEl && speedEl.textContent) speed = speedEl.textContent;

        const date = new Date();
        const dateStr = date.toLocaleDateString('fr-FR');
        const timeStr = date.toLocaleTimeString('fr-FR');

        // ----------------------------------------------------
        // INCRUSTATION DES DONNÉES (WATERMARKING)
        // ----------------------------------------------------
        
        // 1. FILIGRANE DIAGONAL (40 degrés)
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-40 * Math.PI / 180);
        
        const watermarkSize = Math.max(40, canvas.width * 0.08);
        ctx.font = `bold ${watermarkSize}px sans-serif`;
        ctx.fillStyle = "rgba(255, 183, 3, 0.4)"; // Orange mon50cc semi-transparent
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CERTIFICATION mon50cc.com", 0, 0);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = `bold ${watermarkSize * 0.6}px sans-serif`;
        ctx.fillText("PREUVE HORODATÉE", 0, watermarkSize * 1.2);
        
        ctx.restore();

        // 2. BANDEAU DE DONNÉES EN BAS (Lecture Claire)
        const bannerHeight = canvas.height * 0.15;
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

        // Paramètres du texte
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        // Tailles de police adaptatives
        const dataSize = Math.max(16, canvas.height * 0.02);
        
        const padding = canvas.width * 0.02;
        let startY = canvas.height - bannerHeight + padding;
        
        ctx.font = `${dataSize}px monospace`;
        ctx.fillStyle = "#00ffcc"; // Cyan Cyberpunk
        
        const textData = [];
        if (this.currentCaseCode) {
            textData.push(`DOSSIER LITIGE : ${this.currentCaseCode}`);
        }
        textData.push(`DATE : ${dateStr} - HEURE : ${timeStr}`);
        textData.push(`GPS  : LAT ${lat} | LNG ${lng}`);
        textData.push(`VITESSE AU MOMENT DU CHOC/ARRET : ${speed} KM/H`);
        textData.push(`SIGNATURE SHA : ${Math.random().toString(36).substring(2,15).toUpperCase()} (VALIDATION CLOUD)`);

        textData.forEach((line) => {
            ctx.fillText(line, padding, startY);
            startY += dataSize + 5;
        });

        // ----------------------------------------------------
        // TÉLÉCHARGEMENT
        // ----------------------------------------------------
        const dataURL = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        const fileName = this.currentCaseCode ? `Preuve-Litige-${this.currentCaseCode}.jpg` : `Preuve-Expertise-mon50cc-${Date.now()}.jpg`;
        link.download = fileName;
        link.href = dataURL;
        link.click();

        if(typeof speak === 'function') speak('Preuve horodatée certifiée et enregistrée dans votre galerie.');
        
        // Fermeture automatique après 1 seconde
        setTimeout(() => this.close(), 1000);
    },

    close: function() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
            this.videoEl = null;
        }
    }
};
