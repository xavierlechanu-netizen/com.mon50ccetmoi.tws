window.EnginePulse = {
    isScanning: false,
    isSynthActive: false,
    audioCtx: null,
    oscillator: null,
    gainNode: null,

    startSynth: function() {
        if (this.isSynthActive) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    },

    updateSynth: function(speed) {
        if (!this.isSynthActive || !this.audioCtx) return;
        
        const targetFreq = 40 + (speed * 2);
        const targetGain = Math.min(0.1 + (speed / 100), 0.4);
        
        this.oscillator.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.1);
        this.gainNode.gain.setTargetAtTime(window.isRiding ? targetGain : 0.05, this.audioCtx.currentTime, 0.2);
    },

    stopSynth: function() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
        }
        this.isSynthActive = false;
    },

    startScan: function() {
        // ... (Previous logic remains for diagnostic)
    },
    // ...
};
