#!/usr/bin/env python3
"""
OUTIL DE PROVISIONING SÉCURISÉ — BOÎTE NOIRE mon50ccetmoi (REV3)
─────────────────────────────────────────────────────────────────────────────
Génération de partition NVS chiffrée pour ESP32-C3 (ASVS v5.0.0-11.x / Francelog S.A. Linselles)
Conforme au rapport d'audit systèmes critiques EXP-BB50-2026-REV3 :
  1. Clé AES-256-GCM unique par unité (32 octets CSPRNG)
  2. PIN Bluetooth Secure Connections unique à 6 chiffres (100000..999999)
  3. Biclé asymétrique ECDSA P-256 (secp256r1) unique par unité :
     - Clé privée (32 octets) injectée en NVS chiffrée ("ecdsa_priv")
     - Clé publique non-compressée SEC1 (65 octets "04..." -> "ecdsa_pub") exportée
       pour enregistrement dans Firestore `blackbox_units/{serial}.ecdsaPublicKey`
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import os
import secrets
import csv
import json

# Paramètres officiels de la courbe NIST P-256 (secp256r1 / FIPS 186-4)
P256_P  = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
P256_A  = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC
P256_N  = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
P256_GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296
P256_GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B31BF5CE63406837BF51F5


def _point_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and (y1 + y2) % P256_P == 0:
        return None
    if x1 == x2 and y1 == y2:
        lam = ((3 * x1 * x1 + P256_A) * pow(2 * y1, P256_P - 2, P256_P)) % P256_P
    else:
        lam = ((y2 - y1) * pow(x2 - x1, P256_P - 2, P256_P)) % P256_P
    x3 = (lam * lam - x1 - x2) % P256_P
    y3 = (lam * (x1 - x3) - y1) % P256_P
    return (x3, y3)


def _scalar_mult(k, point):
    result = None
    addend = point
    while k:
        if k & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        k >>= 1
    return result


def generate_p256_keypair():
    """Génère une paire de clés ECDSA P-256 (secp256r1) en CSPRNG."""
    d = secrets.randbelow(P256_N - 1) + 1
    pub_x, pub_y = _scalar_mult(d, (P256_GX, P256_GY))
    priv_bytes = d.to_bytes(32, byteorder="big")
    pub_bytes = b"\x04" + pub_x.to_bytes(32, byteorder="big") + pub_y.to_bytes(32, byteorder="big")
    return priv_bytes.hex(), pub_bytes.hex()


def generate_provisioning(serial_number, output_dir="provisioning_out"):
    if not serial_number:
        print("Erreur : Numéro de série requis (ex: BB50V1-A01 ou BB50V2-A01)")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    # 1. Génération cryptographique aléatoire TRNG / CSPRNG
    aes_key_bytes = secrets.token_bytes(32)
    aes_key_hex = aes_key_bytes.hex()

    # PIN BLE à 6 chiffres (entre 100000 et 999999)
    ble_pin = secrets.randbelow(900000) + 100000

    # Biclé asymétrique ECDSA P-256 (secp256r1) pour signature matérielle eIDAS / Art. 1366 C. Civ.
    ecdsa_priv_hex, ecdsa_pub_hex = generate_p256_keypair()

    # 2. Génération du fichier CSV conforme au partition generator ESP-IDF
    csv_filename = os.path.join(output_dir, f"nvs_{serial_number}.csv")
    with open(csv_filename, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "type", "encoding", "value"])
        writer.writerow(["storage", "namespace", "", ""])
        writer.writerow(["aes_key", "data", "hex2bin", aes_key_hex])
        writer.writerow(["ble_pin", "data", "u32", str(ble_pin)])
        writer.writerow(["ecdsa_priv", "data", "hex2bin", ecdsa_priv_hex])
        writer.writerow(["ecdsa_pub", "data", "hex2bin", ecdsa_pub_hex])
        writer.writerow(["serial", "data", "string", serial_number])

    # 3. Manifeste public JSON pour import dans le registre Firestore (sans clé privée ni clé AES !)
    public_manifest_file = os.path.join(output_dir, f"public_manifest_{serial_number}.json")
    with open(public_manifest_file, mode="w", encoding="utf-8") as mf:
        json.dump({
            "serial": serial_number,
            "blePasskey": str(ble_pin),
            "ecdsaPublicKey": ecdsa_pub_hex,
            "cipherSuite": "AES-256-GCM + SHA-256-Merkle + ECDSA-P256"
        }, mf, indent=2)

    print("==================================================")
    print(f"✅ PROVISIONING REV3 GÉNÉRÉ POUR : {serial_number}")
    print(f"🔐 PIN BLE (étiquette boîtier)   : {ble_pin}")
    print(f"🔏 Clé publique ECDSA P-256      : {ecdsa_pub_hex[:24]}... ({len(ecdsa_pub_hex)//2} octets)")
    print(f"📄 Fichier CSV NVS               : {csv_filename}")
    print(f"📋 Manifeste Public Firestore    : {public_manifest_file}")
    print("==================================================")
    print("Commande ESP-IDF recommandée pour compiler la partition NVS chiffrée :")
    print(f"python $IDF_PATH/components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py encrypt {csv_filename} {output_dir}/nvs_{serial_number}.bin 0x6000 --keygen --keyfile {output_dir}/nvs_keys_{serial_number}.bin")
    print("==================================================")


if __name__ == "__main__":
    serial = sys.argv[1] if len(sys.argv) > 1 else "BB50V2-A01"
    generate_provisioning(serial)
