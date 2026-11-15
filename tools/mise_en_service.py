#!/usr/bin/env python3
"""
MISE EN SERVICE EN FIN DE CHAÎNE — Boîte Noire mon50ccetmoi
────────────────────────────────────────────────────────────────────────────
Un boîtier neuf fabrique LUI-MÊME sa clé de signature dans la puce (mode usine).
Cet outil, lancé par l'usine pour chaque boîtier branché :
  1. lit son identité publique sur le port série (clé publique, code d'appairage) ;
  2. demande un défi au serveur mon50ccetmoi et le fait signer par le boîtier
     (preuve que la clé publique est bien celle de CETTE puce) ;
  3. reçoit du serveur le numéro de série lié définitivement à cette clé ;
  4. l'écrit dans le boîtier (une seule fois ; le port d'usine se ferme ensuite) ;
  5. affiche l'étiquette (numéro + code d'appairage) et l'ajoute au journal CSV.

Aucune clé privée ne passe par cet outil ni par le PC de l'usine.

Usage :
  pip install pyserial
  export MON50CC_FACTORY_TOKEN=...   # jeton du poste d'usine (rôle « factory »)
  python tools/mise_en_service.py --port /dev/ttyUSB0            # série : A01, A02…
  python tools/mise_en_service.py --port COM3 --type PROTOTYPE   # P01 à P10
"""

import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

DEFAULT_SERVER = "https://api.mon50ccetmoi.com"


class Boitier:
    """Dialogue ligne à ligne avec le port série d'usine du firmware (main/factory_console.c)."""

    def __init__(self, port, baud=115200, timeout=5.0):
        import serial  # pyserial

        self.ser = serial.Serial(port, baud, timeout=0.2)
        self.timeout = timeout

    def commande(self, ligne, attendu):
        """Envoie une commande et renvoie la réponse « BB50 <attendu> … » (les journaux sont ignorés)."""
        self.ser.reset_input_buffer()
        self.ser.write((ligne + "\n").encode("ascii"))
        fin = time.monotonic() + self.timeout
        while time.monotonic() < fin:
            brut = self.ser.readline().decode("utf-8", "replace").strip()
            if brut.startswith("BB50 ERR"):
                raise RuntimeError(f"Le boîtier refuse « {ligne.split()[1]} » : {brut[9:]}")
            if brut.startswith(f"BB50 {attendu}"):
                return brut[len(f"BB50 {attendu}"):].strip()
        raise TimeoutError(f"Pas de réponse du boîtier à « {ligne.split()[1]} » (déjà numéroté ? mauvais port ?)")

    def fermer(self):
        self.ser.close()


class Serveur:
    def __init__(self, base, jeton):
        self.base = base.rstrip("/")
        self.jeton = jeton

    def post(self, chemin, corps):
        req = urllib.request.Request(
            self.base + chemin,
            data=json.dumps(corps).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.jeton}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.status, json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read().decode("utf-8")).get("error", "")
            except Exception:
                msg = ""
            raise RuntimeError(f"Serveur : {e.code} {msg}") from e


def mettre_en_service(boitier, serveur, type_unite="SERIES", revision="V1"):
    """Déroule les étapes 1 à 4 et renvoie (numéro, clé publique, code d'appairage)."""
    info = json.loads(boitier.commande("BB50 INFO", "INFO"))
    pub, pin = info["pub"], info["pin"]

    _, defi = serveur.post("/api/v1/factory/challenge", {})
    signature = boitier.commande(f"BB50 POP {defi['challenge']}", "POP")

    _, unite = serveur.post("/api/v1/factory/units", {
        "ecdsaPublicKey": pub,
        "challengeToken": defi["challengeToken"],
        "popSignature": signature,
        "type": type_unite,
        "revision": revision,
    })
    numero = unite["serial"]

    ok = boitier.commande(f"BB50 SERIAL {numero}", "OK")
    if ok != numero:
        raise RuntimeError(f"Le boîtier a écrit « {ok} » au lieu de « {numero} »")
    return numero, pub, pin


def main():
    ap = argparse.ArgumentParser(description="Mise en service d'une Boîte Noire en fin de chaîne")
    ap.add_argument("--port", required=True, help="port série du boîtier (ex. /dev/ttyUSB0, COM3)")
    ap.add_argument("--server", default=os.environ.get("MON50CC_SERVER", DEFAULT_SERVER))
    ap.add_argument("--type", choices=["SERIES", "PROTOTYPE"], default="SERIES")
    ap.add_argument("--revision", default="V1", choices=["V1", "V2"])
    ap.add_argument("--journal", default="mise_en_service.csv", help="journal CSV (sans aucun secret)")
    args = ap.parse_args()

    jeton = os.environ.get("MON50CC_FACTORY_TOKEN")
    if not jeton:
        sys.exit("MON50CC_FACTORY_TOKEN manquant (jeton du poste d'usine fourni par mon50ccetmoi).")

    boitier = Boitier(args.port)
    try:
        numero, pub, pin = mettre_en_service(boitier, Serveur(args.server, jeton), args.type, args.revision)
    finally:
        boitier.fermer()

    nouveau = not os.path.exists(args.journal)
    with open(args.journal, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if nouveau:
            w.writerow(["date_utc", "numero_serie", "cle_publique", "code_appairage"])
        w.writerow([datetime.now(timezone.utc).isoformat(timespec="seconds"), numero, pub, pin])

    print(f"\n✅ Boîtier mis en service : {numero}")
    print(f"   Étiquette — N° {numero}   Code d'appairage {pin}")


if __name__ == "__main__":
    main()
