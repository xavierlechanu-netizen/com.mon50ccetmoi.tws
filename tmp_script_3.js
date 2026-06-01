
        // INIT APEX SENTINEL
        window.addEventListener('load', () => {
            if(window.QuantumCrypto) window.QuantumCrypto.init();
            if(window.ZeroTrust) window.ZeroTrust.init();
            
            // WebGL / Canvas Holographic Effect (Simplified for performance)
            const canvas = document.getElementById('quantum-bg');
            if(canvas) {
                const ctx = canvas.getContext('2d');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                let particles = [];
                for(let i=0; i<50; i++) {
                    particles.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: (Math.random() - 0.5) * 0.5
                    });
                }
                function draw() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'rgba(0, 255, 204, 0.5)';
                    particles.forEach(p => {
                        p.x += p.vx; p.y += p.vy;
                        if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
                        if(p.y < 0 || p.y > canvas.height) p.vy *= -1;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                        ctx.fill();
                    });
                    requestAnimationFrame(draw);
                }
                draw();
            }
        });
    