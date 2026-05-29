/* --- PREMIUM UX CORE LOGIC --- */

// 1. Gamification XP System
window.updateXP = function(distanceAdded) {
    if(!window.session) return;
    if(!window.session.xp) window.session.xp = 0;
    window.session.xp += distanceAdded * 10; // 10 XP per km
    
    const xpFill = document.getElementById('xp-fill');
    const xpText = document.getElementById('xp-text');
    if(xpFill && xpText) {
        let level = Math.floor(window.session.xp / 1000) + 1;
        let progress = (window.session.xp % 1000) / 10; // % to next level
        xpFill.style.width = progress + '%';
        xpText.textContent = window.session.xp.toFixed(0) + ' (Lvl ' + level + ')';
    }
    localStorage.setItem('session', JSON.stringify(window.session));
};

// 2. Day/Night Auto Toggle
window.checkDayMode = function() {
    const hour = new Date().getHours();
    if(hour >= 7 && hour <= 19) {
        document.body.classList.add('day-mode');
    } else {
        document.body.classList.remove('day-mode');
    }
};
setInterval(window.checkDayMode, 60000);
setTimeout(window.checkDayMode, 1000);

window.toggleDayMode = function() {
    document.body.classList.toggle('day-mode');
};

// 3. Dynamic Weather Overlay
window.updateWeatherUI = function(isRaining) {
    const overlay = document.getElementById('weather-overlay');
    if(overlay) {
        if(isRaining) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }
};

// 4. Cloud Sync Stub (Firebase Integration)
window.syncUserToCloud = function() {
    if(typeof db !== 'undefined' && window.session && !window.session.isGuest) {
        console.log('Syncing profile to Cloud...');
        try {
            db.collection('users').doc(window.session.uid).set(window.session, {merge: true});
        } catch(e) {
            console.error('Firebase DB Error:', e);
        }
    } else {
        console.log('Local save only (Guest or no DB)');
    }
};

// Hook distance updates to XP
document.addEventListener('DOMContentLoaded', () => {
    // Initial XP load
    if(window.session && window.session.xp) {
        window.updateXP(0);
});

// 5. Waze-Killer Turn-by-Turn Navigation
window.startPremiumNavigation = function(leg) {
    if(!leg || !leg.steps || leg.steps.length === 0) return;
    
    const hud = document.getElementById('turn-by-turn-hud');
    const statsTray = document.getElementById('nav-stats-tray');
    if(hud) hud.classList.remove('hidden');
    if(statsTray) statsTray.classList.remove('hidden');

    // Format instructions
    const nextStep = leg.steps[0];
    let instructionText = nextStep.instructions.replace(/<[^>]*>?/gm, ''); // Strip HTML tags
    
    const navInstruction = document.getElementById('nav-instruction');
    const navDistance = document.getElementById('nav-distance');
    const navIcon = document.getElementById('nav-turn-icon');
    
    if(navInstruction) navInstruction.textContent = instructionText;
    if(navDistance) navDistance.textContent = nextStep.distance.text;
    
    // Icon logic based on text (very basic for demo)
    if(navIcon) {
        const lowerInst = instructionText.toLowerCase();
        if(lowerInst.includes('gauche')) {
            navIcon.className = 'fa-solid fa-arrow-turn-up';
            navIcon.style.transform = 'scaleX(-1) rotate(90deg)';
        } else if(lowerInst.includes('droite')) {
            navIcon.className = 'fa-solid fa-arrow-turn-up';
            navIcon.style.transform = 'rotate(90deg)';
        } else if(lowerInst.includes('rond-point')) {
            navIcon.className = 'fa-solid fa-arrows-spin';
            navIcon.style.transform = 'rotate(0deg)';
        } else {
            navIcon.className = 'fa-solid fa-arrow-up';
            navIcon.style.transform = 'rotate(0deg)';
        }
    }

    // Update Stats Tray
    const etaEl = document.getElementById('nav-eta');
    const distEl = document.getElementById('nav-total-dist');
    const arrEl = document.getElementById('nav-arrival-time');
    
    if(etaEl) etaEl.textContent = leg.duration.text;
    if(distEl) distEl.textContent = leg.distance.text;
    
    if(arrEl) {
        const now = new Date();
        const durationSecs = leg.duration.value;
        now.setSeconds(now.getSeconds() + durationSecs);
        const hours = now.getHours().toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        arrEl.textContent = hours + ':' + mins;
    }
    
    // Voice Announcement
    if(typeof speak === 'function') {
        speak('Itinéraire calculé. Dans ' + nextStep.distance.text + ', ' + instructionText);
    }
};
