import os

base_dir = r"c:\Users\xavie\.gemini\antigravity\scratch\balade-app"
index_path = os.path.join(base_dir, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Inject script tag
if '<script src="js/insurer-portal.js"></script>' not in content:
    content = content.replace('<script src="js/web4-mining.js"></script>', '<script src="js/web4-mining.js"></script>\n    <script src="js/insurer-portal.js"></script>')

# 2. Inject HTML for the portal
insurer_ui = """
<!-- INSURER PORTAL SCREEN (B2B) -->
<div id="insurer-portal-screen" class="hidden fullscreen-overlay" style="background: #0f172a; color: #fff; z-index: 40000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding-bottom: 50px;">
    <button onclick="window.InsurerPortal.close()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
    
    <div style="margin-top: 50px; text-align: center;">
        <i class="fa-solid fa-building-shield" style="font-size: 4rem; color: #00d2ff; filter: drop-shadow(0 0 20px #00d2ff); margin-bottom: 20px;"></i>
        <h1 style="margin: 0; font-size: 2rem; letter-spacing: 2px; color: #fff;">Portail Expert Assureur</h1>
        <p style="color: #00ffcc; font-weight: bold; margin-top: 5px;">Accès sécurisé Zero-Trust</p>
    </div>

    <!-- Login Box -->
    <div id="insurer-login-box" style="margin: 40px auto; width: 90%; max-width: 400px; background: rgba(255,255,255,0.05); border: 1px solid rgba(0,210,255,0.3); border-radius: 20px; padding: 40px 20px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <h3 style="color: #aaa; margin: 0 0 20px 0; font-size: 1.1rem;">Entrez le Code Litige</h3>
        <input type="text" id="insurer-code-input" placeholder="Ex: LIT-XXXX" style="width: 80%; padding: 15px; border-radius: 10px; border: 1px solid #00d2ff; background: rgba(0,0,0,0.5); color: #00ffcc; font-size: 1.5rem; text-align: center; text-transform: uppercase; margin-bottom: 20px;">
        <br>
        <button onclick="window.InsurerPortal.verifyCode()" style="padding: 15px 40px; background: linear-gradient(90deg, #00d2ff, #3a7bd5); border: none; border-radius: 30px; color: #fff; font-weight: 900; font-size: 1.2rem; box-shadow: 0 5px 20px rgba(0,210,255,0.4); cursor: pointer;"><i class="fa-solid fa-unlock"></i> Déverrouiller</button>
    </div>
    
    <!-- Pricing Box -->
    <div id="insurer-pricing-box" class="hidden" style="margin: 20px auto; width: 95%; max-width: 500px;">
        <h3 style="text-align:center; color:#00ffcc; margin-bottom:20px;">Sélectionnez le rapport à débloquer</h3>
        
        <div style="background:rgba(255,255,255,0.05); border:1px solid #aaa; border-radius:15px; padding:20px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="font-size:1.2rem;">Rapport Standard</strong><br>
                <span style="color:#aaa; font-size:0.9rem;">Constat simple, heure, position GPS</span>
            </div>
            <button onclick="window.InsurerPortal.buyReport('Standard', 49.99, 5)" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; font-weight:bold; cursor:pointer;">49.99 €</button>
        </div>
        
        <div style="background:rgba(0,210,255,0.1); border:1px solid #00d2ff; border-radius:15px; padding:20px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="font-size:1.2rem; color:#00d2ff;">Rapport Intermédiaire</strong><br>
                <span style="color:#aaa; font-size:0.9rem;">Télémétrie complète (G-Force, Vitesse)</span>
            </div>
            <button onclick="window.InsurerPortal.buyReport('Intermédiaire', 89.99, 10)" style="background:#00d2ff; color:#000; border:none; padding:10px 20px; border-radius:10px; font-weight:bold; cursor:pointer;">89.99 €</button>
        </div>
        
        <div style="background:rgba(183,0,255,0.1); border:1px solid #b700ff; border-radius:15px; padding:20px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 0 15px rgba(183,0,255,0.2);">
            <div>
                <strong style="font-size:1.2rem; color:#b700ff;"><i class="fa-solid fa-brain"></i> Rapport Expert IA</strong><br>
                <span style="color:#aaa; font-size:0.9rem;">Reconstitution 3D, Analyse des responsabilités</span>
            </div>
            <button onclick="window.InsurerPortal.buyReport('Expert', 149.99, 20)" style="background:linear-gradient(90deg, #b700ff, #ff0055); color:#fff; border:none; padding:10px 20px; border-radius:10px; font-weight:bold; cursor:pointer;">149.99 €</button>
        </div>
    </div>
</div>
"""

# Insert right before the last closing div of the app or just before script tags
if "<!-- INSURER PORTAL SCREEN (B2B) -->" not in content:
    content = content.replace("<!-- CRYPTO WALLET SCREEN -->", insurer_ui + "\n\n<!-- CRYPTO WALLET SCREEN -->")

# 3. Add a button in the nav to access the portal
nav_button = """            <button class="nav-btn" onclick="window.InsurerPortal.open()" title="Espace Assureur">
                <i class="fa-solid fa-building-shield"></i>
            </button>
        </nav>"""
content = content.replace("        </nav>", nav_button)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Injected insurer portal UI into index.html")
