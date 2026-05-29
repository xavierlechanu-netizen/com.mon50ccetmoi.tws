import os

base_dir = r"c:\Users\xavie\.gemini\antigravity\scratch\balade-app"
index_path = os.path.join(base_dir, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    content = f.read()

# Re-read the file and just replace the UI block directly. We know what it looks like now.
old_wallet_ui = """      <div style="text-align: center; margin-top: 30px;">
          <h3 style="color: #fff; margin-bottom: 15px;">Place de Marché Web4</h3>
          <div style="display:flex; flex-direction:column; gap:10px; align-items:center; margin-bottom:20px;">
              <div style="background:rgba(255,255,255,0.1); padding:10px 20px; border-radius:10px; width:80%; max-width:350px; display:flex; justify-content:space-between;">
                  <span><i class="fa-solid fa-scale-balanced" style="color:#cca300;"></i> Lettre Avocat</span>
                  <span style="color:#00ffcc; font-weight:bold;">5.0 BVC fixes</span>
              </div>
              <div style="background:rgba(255,255,255,0.1); padding:10px 20px; border-radius:10px; width:80%; max-width:350px; display:flex; justify-content:space-between;">
                  <span><i class="fa-solid fa-building-shield" style="color:#00d2ff;"></i> Rapport Assureur</span>
                  <span style="color:#00ffcc; font-weight:bold;">10.0 BVC fixes</span>
              </div>
          </div>
          <button style="padding: 15px 40px; background: linear-gradient(90deg, #b700ff, #ff0055); border: none; border-radius: 30px; color: #fff; font-weight: 900; font-size: 1.2rem; box-shadow: 0 5px 20px rgba(183,0,255,0.4); cursor: pointer;">CONVERTIR EN ESSENCE (Bientôt)</button>
      </div>"""

new_wallet_ui = """      <div style="text-align: center; margin-top: 30px;">
          <h3 style="color: #fff; margin-bottom: 15px;">Écosystème Web4</h3>
          <div style="display:flex; flex-direction:column; gap:10px; align-items:center; margin-bottom:20px;">
              <div style="background:rgba(255,255,255,0.1); padding:10px 20px; border-radius:10px; width:80%; max-width:350px; display:flex; justify-content:space-between;">
                  <span><i class="fa-solid fa-scale-balanced" style="color:#cca300;"></i> Frais d'Avocat</span>
                  <span style="color:#ff4d4d; font-weight:bold;">- 5.0 BVC</span>
              </div>
              <div style="background:rgba(255,255,255,0.1); padding:10px 20px; border-radius:10px; width:80%; max-width:350px; display:flex; justify-content:space-between;">
                  <span><i class="fa-solid fa-building-shield" style="color:#00ffcc;"></i> Prime Assureur</span>
                  <span style="color:#00ffcc; font-weight:bold;">+ 10.0 BVC</span>
              </div>
          </div>
          <button style="padding: 15px 40px; background: linear-gradient(90deg, #b700ff, #ff0055); border: none; border-radius: 30px; color: #fff; font-weight: 900; font-size: 1.2rem; box-shadow: 0 5px 20px rgba(183,0,255,0.4); cursor: pointer;">CONVERTIR EN ESSENCE (Bientôt)</button>
      </div>"""

if old_wallet_ui in content:
    content = content.replace(old_wallet_ui, new_wallet_ui)
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated index.html wallet UI")
else:
    print("Could not find the UI block in index.html to replace.")
