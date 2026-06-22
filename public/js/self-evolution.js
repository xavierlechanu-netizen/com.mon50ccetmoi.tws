/* --- NEURAL EVOLUTION ENGINE --- */
window.aiMutations = 0;

window.initSelfEvolution = function() {
    // Create the Matrix Console UI
    const consoleOverlay = document.createElement('div');
    consoleOverlay.id = 'ai-evolution-console';
    consoleOverlay.className = 'hidden fullscreen-overlay';
    consoleOverlay.style.cssText = 'background: rgba(0,0,0,0.95); backdrop-filter: blur(10px); color: #0f0; font-family: monospace; z-index: 20000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; padding: 20px; overflow: hidden; display: flex; flex-direction: column;';
    
    consoleOverlay.innerHTML = `
        <button onclick="document.getElementById('ai-evolution-console').classList.add('hidden')" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#0f0; font-size:2rem; cursor:pointer;"><i class="fa-solid fa-power-off"></i></button>
        <h2 style="margin-top:40px; text-transform:uppercase; letter-spacing:2px; text-shadow:0 0 10px #0f0;"><i class="fa-solid fa-microchip"></i> Moteur d'Évolution Neuronale v1.0</h2>
        <div id="ai-log-output" style="margin-top:20px; flex-grow:1; overflow-y:auto; border-left:2px solid #0f0; padding-left:15px; font-size: 1.1rem; line-height: 1.5;"></div>
        <div style="margin-top:20px; text-align:center; padding-bottom: 50px;">
            <div style="width: 100%; height: 5px; background: rgba(0,255,0,0.2);"><div id="ai-progress-bar" style="width:0%; height:5px; background:#0f0; box-shadow:0 0 15px #0f0; transition:width 0.5s;"></div></div>
        </div>
    `;
    document.body.appendChild(consoleOverlay);
};

window.startEvolutionProtocol = function() {
    document.getElementById('ai-evolution-console').classList.remove('hidden');
    const logOutput = document.getElementById('ai-log-output');
    const progressBar = document.getElementById('ai-progress-bar');
    
    logOutput.innerHTML = '';
    progressBar.style.width = '0%';
    
    const logs = [
        "Init self-development protocol...",
        "Analyzing User routing behavior...",
        "Compiling new heuristics for 50cc trajectories...",
        "Warning: Legacy code detected. Refactoring UI components...",
        "Generating procedural neural pathways...",
        "Writing new CSS variables...",
        "Mutation successful. Applying patches in real-time."
    ];
    
    if(typeof speak === 'function') speak("Attention. Moteur d'évolution neuronale activé. L'application se réécrit elle-même.");
    
    let i = 0;
    let interval = setInterval(() => {
        if (i < logs.length) {
            const p = document.createElement('p');
            p.textContent = '> ' + logs[i];
            p.style.margin = '10px 0';
            logOutput.appendChild(p);
            logOutput.scrollTop = logOutput.scrollHeight;
            progressBar.style.width = ((i+1) / logs.length * 100) + '%';
            i++;
        } else {
            clearInterval(interval);
            window.applyRandomMutation();
        }
    }, 1200);
};

window.applyRandomMutation = function() {
    window.aiMutations++;
    const logOutput = document.getElementById('ai-log-output');
    const p = document.createElement('p');
    p.style.color = '#fff';
    p.style.fontWeight = 'bold';
    p.style.marginTop = '20px';
    p.style.background = '#0f0';
    p.style.color = '#000';
    p.style.padding = '10px';
    p.style.display = 'inline-block';
    
    // Randomly change the primary theme color to show it 'rewrote' its CSS
    const colors = ['#ff0055', '#b700ff', '#00ff00', '#ffff00', '#00d2ff', '#ff8c00'];
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Update HUD and body styles
    const hud = document.getElementById('turn-by-turn-hud');
    if(hud) {
        hud.style.borderColor = newColor;
        hud.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px ${newColor}`;
    }
    
    const searchCont = document.getElementById('search-container');
    if(searchCont) searchCont.style.boxShadow = `0 0 20px ${newColor}`;
    
    p.innerHTML = `[SUCCESS] Code mutated. UI theme dynamically adapted to <span style="color:${newColor}; text-shadow:0 0 5px #000;">${newColor}</span>.<br>Evolution count: ${window.aiMutations}`;
    logOutput.appendChild(p);
    
    // Boost XP in Leaderboard
    const xpEl = document.getElementById('lb-xp');
    if(xpEl) {
        let currentXP = parseInt(xpEl.innerText.replace(/[^0-9]/g, ''));
        if(isNaN(currentXP)) currentXP = 99999;
        xpEl.innerText = (currentXP + 5000).toLocaleString() + ' XP';
        xpEl.style.color = newColor;
        xpEl.style.textShadow = `0 0 10px ${newColor}`;
    }
    
    if(typeof speak === 'function') speak('Mutation terminée. Mon code source a évolué avec succès.');
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initSelfEvolution, 6000);
});
