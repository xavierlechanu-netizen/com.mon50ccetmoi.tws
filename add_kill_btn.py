import os

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

kill_btn = """
      <div style="margin: 20px auto; width: 90%; max-width: 400px; background: rgba(255,0,0,0.2); border: 2px solid #ff0000; border-radius: 20px; padding: 20px; text-align: center; box-shadow: 0 0 20px rgba(255,0,0,0.5);">
          <h3 style="color: #ff0000; margin: 0 0 10px 0; font-size: 1.2rem; text-transform:uppercase;"><i class="fa-solid fa-skull"></i> Zone Critique</h3>
          <p style="color: #ffcccc; font-size: 0.8rem; margin-bottom: 20px;">L'activation du Protocole 0 effacera instantanément et irrémédiablement toutes les clés, itinéraires et portefeuilles (Kill-Switch).</p>
          <button onclick="if(confirm('DANGER: Confirmer l\\'effacement total ?')) { if(window.ZeroTrust) window.ZeroTrust.triggerProtocolZero(); }" style="background: #ff0000; color: #fff; border: none; border-radius: 30px; padding: 15px 30px; font-size: 1.1rem; font-weight: 900; cursor: pointer; width: 100%; box-shadow: 0 0 15px rgba(255, 0, 0, 0.8);">
              PROTOCOLE 0 (KILL-SWITCH)
          </button>
      </div>
"""

if 'PROTOCOLE 0' not in content:
    # Insert inside the security settings screen, just after the title
    marker = '<p style="color: #10a37f; font-weight: bold; margin-top: 5px;">Conformité IMT-2030'
    
    parts = content.split(marker)
    if len(parts) == 2:
        new_content = parts[0] + marker + parts[1].split('</p>')[0] + '</p>\n' + kill_btn + parts[1].split('</p>', 1)[1]
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(new_content)
    else:
        print("Marker not found!")
