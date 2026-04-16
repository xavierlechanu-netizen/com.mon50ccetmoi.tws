import qrcode
img = qrcode.make('https://mon50ccetmoi.netlify.app/')
img.save('qrcode_mon50cc.png')
print("QR Code généré avec succès !")
