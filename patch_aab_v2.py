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

# REMOVE EXISTING SIGNATURE!
sig_dir = os.path.join(extract_dir, 'META-INF')
if os.path.exists(sig_dir):
    for f in os.listdir(sig_dir):
        if f.endswith('.SF') or f.endswith('.RSA') or f.endswith('.DSA') or f == 'MANIFEST.MF':
            os.remove(os.path.join(sig_dir, f))

old_id = b'com.mon50ccetmoi.tws'
new_id = b'com.mon50ccetmoi.twa'

print("Patching...")
for root, dirs, files in os.walk(extract_dir):
    for name in files:
        file_path = os.path.join(root, name)
        with open(file_path, 'rb') as f:
            data = f.read()
        
        if old_id in data:
            print(f"Patching {name}...")
            new_data = data.replace(old_id, new_id)
            with open(file_path, 'wb') as f:
                f.write(new_data)

print("Done! Files ready in " + extract_dir)
