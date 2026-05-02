window.EnginePulse = {
    isScanning: false,
    isSynthActive: false,
    audioCtx: null,
    oscillator: null,
    gainNode: null,

    startSynth: function() {
        if (this.isSynthActive || !this.audioCtx) return;
        
        try {
            this.oscillator = this.audioCtx.createOscillator();
            this.gainNode = this.audioCtx.createGain();

            this.oscillator.type = 'sawtooth';
            this.oscillator.frequency.setValueAtTime(40, this.audioCtx.currentTime); // Base low hum
            
            // Low pass filter for "muffled" engine sound
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, this.audioCtx.currentTime);

            this.oscillator.connect(filter);
            filter.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);

            this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
            this.oscillator.start();
            this.isSynthActive = true;
            
            this.updateSynth(0);
        } catch(e) { console.warn("Synth start fail:", e); }
    },

    updateSynth: function(speed) {
        if (!this.isSynthActive || !this.audioCtx) return;
        
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const targetFreq = 40 + (speed * 2);
        const targetGain = Math.min(0.1 + (speed / 100), 0.4);
        
        this.oscillator.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.1);
        this.gainNode.gain.setTargetAtTime(window.isRiding ? targetGain : 0.05, this.audioCtx.currentTime, 0.2);
    },

    stopSynth: function() {
        if (this.oscillator) {
            try {
                this.oscillator.stop();
                this.oscillator.disconnect();
            } catch(e) {}
        }
        this.isSynthActive = false;
    },

    startScan: function() {
        // ... (Previous logic remains for diagnostic)
    },
};

// Auto-unlock AudioContext on first interaction
window.addEventListener('click', () => {
    if (!window.EnginePulse.audioCtx) {
        window.EnginePulse.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log("mon50cc Audio : Engine Pulse Unlocked.");
        // Si le HUD est déjà là, on lance le synthé
        if (document.getElementById('hud')) window.EnginePulse.startSynth();
    }
}, { once: true });

window.addEventListener('touchstart', () => {
    if (!window.EnginePulse.audioCtx) {
        window.EnginePulse.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log("mon50cc Audio : Engine Pulse Unlocked (Touch).");
        if (document.getElementById('hud')) window.EnginePulse.startSynth();
    }
}, { once: true });
