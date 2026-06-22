import zipfile
import os
import shutil

src_path = r'C:\Users\xavie\Desktop\com.Mon50CCetmoi.aab'
extract_dir = r'c:\Users\xavie\.gemini\antigravity\scratch\balade-app\temp_aab'

# Clean up
if os.path.exists(extract_dir): shutil.rmtree(extract_dir)
os.makedirs(extract_dir)

print("Extracting...")
with zipfile.ZipFile(src_path, 'r') as z:
    z.extractall(extract_dir)

# REMOVE SIGNATURE
sig_dir = os.path.join(extract_dir, 'META-INF')
if os.path.exists(sig_dir): shutil.rmtree(sig_dir)

old_id = b'com.mon50ccetmoi.tws'
new_id = b'com.mon50ccetmoi.twa'

# ONLY PATCH MANIFEST
manifest_path = os.path.join(extract_dir, 'base', 'manifest', 'AndroidManifest.xml')
with open(manifest_path, 'rb') as f:
    data = f.read()

if old_id in data:
    print("Patching AndroidManifest.xml...")
    new_data = data.replace(old_id, new_id)
    with open(manifest_path, 'wb') as f:
        f.write(new_data)

print("Done surgery!")
