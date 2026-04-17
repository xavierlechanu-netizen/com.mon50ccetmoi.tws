import zipfile
import os

def repack(in_aab, out_aab):
    print(f"Repacking {in_aab} to {out_aab}...")
    with zipfile.ZipFile(in_aab, 'r') as zin:
        with zipfile.ZipFile(out_aab, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            count = 0
            for item in zin.infolist():
                # Skip directory entries AND existing signature files
                if item.filename.endswith('/') or item.filename.startswith('META-INF/'):
                    continue
                data = zin.read(item.filename)
                zout.writestr(item.filename, data)
                count += 1
    print(f"Done! {count} files packed.")

if __name__ == "__main__":
    # On utilise FIXED_v2 comme base car l'ID est déjà correct (com.mon50ccetmoi.twa)
    repack(r'archives\mon50ccetmoi_FIXED_v2.aab', r'archives\mon50ccetmoi_CLEAN_REPACK.aab')
