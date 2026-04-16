import qrcode
img = qrcode.make('https://xavierlechanu-netizen.github.io/mon50ccetmoi/')
img.save('qrcode_mon50cc.png')
print("QR Code généré avec succès !")
