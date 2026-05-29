import os

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

hud_html = """
<!-- INTERCEPTOR HUD ELEMENTS -->
<div id="hud" style="position:fixed; top:20px; right:20px; z-index:9000; display:flex; flex-direction:column; gap:10px; pointer-events:none; transition: all 0.3s ease;">
    <div id="weather-hud" style="background:rgba(0, 10, 20, 0.8); border:1px solid #00d2ff; padding:12px 20px; border-radius:12px; color:#fff; font-family:'JetBrains Mono', monospace; font-size:14px; text-shadow:0 0 10px #00d2ff; box-shadow:0 0 15px rgba(0, 210, 255, 0.5); backdrop-filter:blur(5px); display:flex; gap:15px; align-items:center;">
        <div><i class="fa-solid fa-cloud" style="color:#aaa;"></i> <span id="weather-temp">--°C</span></div>
        <div><i class="fa-solid fa-wind" style="color:#00d2ff;"></i> <span id="weather-wind">-- km/h</span></div>
    </div>
    <div id="radar-hud" style="background:rgba(20, 0, 0, 0.8); border:1px solid #ff4d4d; padding:12px 20px; border-radius:12px; color:#fff; font-family:'JetBrains Mono', monospace; font-size:14px; text-shadow:0 0 10px #ff4d4d; box-shadow:0 0 15px rgba(255, 77, 77, 0.5); backdrop-filter:blur(5px); display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-satellite-dish fa-beat" style="color:#ff4d4d;"></i> <span id="radar-users">SCANNING...</span>
    </div>
</div>

<!-- GLITCH ALERT OVERLAY -->
<div id="glitch-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:35000; pointer-events:none; background:radial-gradient(circle, transparent 20%, rgba(255,0,0,0.5) 100%); mix-blend-mode:difference; opacity:0; transition:opacity 0.05s; display:none;"></div>
"""

# Also fix the script tag syntax error in index.html around line 214
error_str = """        try {
            window.session = (typeof checkAuth === "function") ? checkAuth(false) : { username: "Pilote", isGuest: true };

    <!-- APPLE SMART DOCK -->"""

fixed_str = """        try {
            window.session = (typeof checkAuth === "function") ? checkAuth(false) : { username: "Pilote", isGuest: true };
        } catch(e) {}
    </script>
    
    <!-- APPLE SMART DOCK -->"""

content = content.replace(error_str, fixed_str)

if 'id="hud"' not in content:
    content = content.replace('</body>', hud_html + '\n</body>')
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
