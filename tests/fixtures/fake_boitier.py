"""Boîtier simulé pour tester tools/mise_en_service.py : répond comme main/factory_console.c."""
import json
import sys

sys.path.insert(0, sys.argv[1])  # dossier tools/
from mise_en_service import Serveur, mettre_en_service  # noqa: E402
from cryptography.hazmat.primitives import hashes, serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402


class FauxBoitier:
    def __init__(self):
        self.cle = ec.generate_private_key(ec.SECP256R1())  # « dans la puce »
        self.pub = self.cle.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint).hex()
        self.serie = None

    def commande(self, ligne, attendu):
        mots = ligne.split(" ")
        if mots[1] == "INFO":
            return json.dumps({"fw": "1.1.0", "pub": self.pub, "pin": "482913"})
        if mots[1] == "POP":
            if self.serie:
                raise RuntimeError("Le boîtier refuse « POP » : signature refusee")
            msg = f"mon50cc-factory-pop:{mots[2]}:{self.pub}".encode()
            return self.cle.sign(msg, ec.ECDSA(hashes.SHA256())).hex()
        if mots[1] == "SERIAL":
            if self.serie:
                raise RuntimeError("Le boîtier refuse « SERIAL » : numero refuse (deja ecrit)")
            self.serie = mots[2]
            return self.serie
        raise RuntimeError("commande inconnue")


serveur = Serveur(sys.argv[2], sys.argv[3])
resultats = []
for type_unite in sys.argv[4].split(","):
    b = FauxBoitier()
    numero, pub, pin = mettre_en_service(b, serveur, type_unite)
    resultats.append({"serial": numero, "pub": pub, "pin": pin, "deviceSerial": b.serie})
print(json.dumps(resultats))
