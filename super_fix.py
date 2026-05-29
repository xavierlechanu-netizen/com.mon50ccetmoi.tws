import os
import re

base_dir = r"c:\Users\xavie\.gemini\antigravity\scratch\balade-app"

def fix_file(rel_path, replacements, binary=False):
    path = os.path.join(base_dir, rel_path)
    if not os.path.exists(path):
        print(f"Skipping {rel_path}, file not found")
        return
        
    mode = "rb" if binary else "r"
    encoding = None if binary else "utf-8"
    with open(path, mode, encoding=encoding) as f:
        content = f.read()

    original = content

    for old, new in replacements:
        if isinstance(old, bytes) and not binary:
            continue
        if isinstance(old, re.Pattern):
            content = old.sub(new, content)
        else:
            content = content.replace(old, new)

    if content != original:
        write_mode = "wb" if binary else "w"
        with open(path, write_mode, encoding=encoding) as f:
            f.write(content)
        print(f"Fixed {rel_path}")
    else:
        print(f"No changes needed for {rel_path}")

# 1. index.html
weather_regex = re.compile(r"    <!-- Weather Overlay -->.*? console\.warn\(\"Session check delayed\.\.\.\"\); \}\n    </script>\n", re.DOTALL)
fix_file("index.html", [
    ("        } catch(e) {\n        try {", "        } catch(e) { }\n        try {"),
    ("</head>\n<body style=\"margin:0; padding:0; background:#000; overflow:hidden;\">\n", ""),
    ("<!-- INTERCEPTOR HUD ELEMENTS -->", "</head>\n<body style=\"margin:0; padding:0; background:#000; overflow:hidden;\">\n<!-- INTERCEPTOR HUD ELEMENTS -->"),
    (weather_regex, ""),
    ('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https://kit.fontawesome.com https://unpkg.com; style-src \'self\' \'unsafe-inline\' https://ka-f.fontawesome.com https://unpkg.com; img-src \'self\' data: https://unpkg.com; font-src \'self\' https://ka-f.fontawesome.com; connect-src \'self\' https://ka-f.fontawesome.com wss://*;">\n', '')
])

# 2. app.js (binary to strip null bytes)
app_path = os.path.join(base_dir, "js", "app.js")
with open(app_path, "rb") as f:
    app_bytes = f.read()
app_bytes = app_bytes.replace(b'\x00', b'')
app_content = app_bytes.decode('utf-8')

replacements_app = [
    ('content.innerHTML = <div class="card-insurance"', 'content.innerHTML = `<div class="card-insurance"'),
    ('</button>\n        </div>;', '</button>\n        </div>`;'),
    ('content.innerHTML = <h3><i class="fa-solid fa-user-pen">', 'content.innerHTML = `<h3><i class="fa-solid fa-user-pen">'),
    ('            </div>;', '            </div>`;'),
    ("alert('L'IA analyse", "alert('L\\'IA analyse"),
    ("content.classList.remove('hidden');", "if(typeof content !== 'undefined') content.classList.remove('hidden');"),
    ("        content.innerHTML = ", "        if(typeof content !== 'undefined') content.innerHTML = ")
]
for old, new in replacements_app:
    app_content = app_content.replace(old, new)
with open(app_path, "w", encoding="utf-8") as f:
    f.write(app_content)
print("Fixed js/app.js")

# 3. neural-hud.js
fix_file("js/neural-hud.js", [
    ("!video.readyState === video.HAVE_ENOUGH_DATA", "video.readyState !== video.HAVE_ENOUGH_DATA"),
    ("\\${users}", "${users}"),
    ("this.initInterceptorMode();", "if(typeof this.initInterceptorMode === 'function') this.initInterceptorMode();")
])

# 4. litigation-ai.js
fix_file("js/litigation-ai.js", [
    ("onclick=\"LitigationAI.confirmAndSend(${JSON.stringify(proposal).replace(/\"/g, '&quot;')})\"", 
     "onclick='LitigationAI.confirmAndSend(' + JSON.stringify(proposal).replace(/\"/g, \"&quot;\") + ')'")
])

# 5. blackbox.js
fix_file("js/blackbox.js", [
    ("Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z)", "Math.sqrt((acc.x||0)*(acc.x||0) + (acc.y||0)*(acc.y||0) + (acc.z||0)*(acc.z||0))")
])

# 6. guardian-angel.js
fix_file("js/guardian-angel.js", [
    ("if (!this.sessionId || !navigator.onLine) return;", "if (!this.sessionId || !navigator.onLine || typeof db === 'undefined') return;")
])

# 7. ghost-rider.js
fix_file("js/ghost-rider.js", [
    ('        db.collection("hazards")', "        if(typeof db === 'undefined') return;\n        db.collection(\"hazards\")")
])

# 8. social-map.js
fix_file("js/social-map.js", [
    ("window.userLocation", "window.currentPosition")
])

# 9. habits.js
fix_file("js/habits.js", [
    (" currentPosition", " window.currentPosition"),
    ("if (!currentPosition", "if (!window.currentPosition")
])

# 10. offline-map.js
fix_file("js/offline-map.js", [
    ("this.leafletMap = L.map('leaflet-map')", "if(typeof L === 'undefined') return; this.leafletMap = L.map('leaflet-map')")
])

# 11. Remove sentinel.js
s_path = os.path.join(base_dir, "js", "sentinel.js")
if os.path.exists(s_path):
    os.remove(s_path)
    print("Deleted js/sentinel.js (conflict with v2)")
