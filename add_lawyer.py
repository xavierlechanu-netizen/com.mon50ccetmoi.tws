import os

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add script to head or body
script_tag = '<script src="js/pocket-lawyer.js"></script>'
if script_tag not in content:
    content = content.replace('</body>', f'    {script_tag}\n</body>')

# 2. Add button to Apple Smart Dock
lawyer_btn = """
        <!-- Avocat de Poche -->
        <button id="dock-btn-lawyer" onclick="if(window.PocketLawyer) window.PocketLawyer.toggleLawyer()" style="background: none; border: none; color: #cca300; font-size: 1.5rem; cursor: pointer; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); padding: 5px;">
            <i class="fa-solid fa-scale-balanced" style="filter: drop-shadow(0 0 5px #cca300);"></i>
        </button>
"""

# Insert button into the dock before the last closing div of the dock
if 'id="dock-btn-lawyer"' not in content:
    # Find Apple smart dock
    dock_start = content.find('id="apple-smart-dock"')
    if dock_start != -1:
        # Find the closing tag of the dock
        # It's a bit hard with string matching, let's just insert it after AR Vision button
        ar_btn = '<!-- AR Vision -->'
        if ar_btn in content:
            content = content.replace(ar_btn, lawyer_btn + '\n        ' + ar_btn)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
