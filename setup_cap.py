import shutil
import os
import json

base_dir = r"C:\Users\xavie\.gemini\antigravity\scratch\balade-app"
android_dir = os.path.join(base_dir, "android-app")
www_dir = os.path.join(android_dir, "www")

if not os.path.exists(www_dir):
    os.makedirs(www_dir)

# Copy specific folders/files
for item in ["index.html", "js", "css", "assets", "fonts", "pages", "src"]:
    src = os.path.join(base_dir, item)
    dst = os.path.join(www_dir, item)
    if os.path.exists(src):
        if os.path.isdir(src):
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

# Update capacitor.config.json
config_path = os.path.join(android_dir, "capacitor.config.json")
if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    config["webDir"] = "www"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

print("Copy and config update successful.")
