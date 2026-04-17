import zipfile
import os

path = r'C:\Users\xavie\Desktop\com.Mon50CCetmoi.aab'
target_id = b'com.mon50ccetmoi.tws'

with zipfile.ZipFile(path, 'r') as z:
    for name in z.namelist():
        content = z.read(name)
        if target_id in content:
            print(f"Found id in {name}")
