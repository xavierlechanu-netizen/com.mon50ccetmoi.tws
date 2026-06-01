import re
with open('js/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

text = text.replace('        </div>;', '        </div>`;')
text = re.sub(r'alert\(.*L\'IA Pr.*y acc.*der\.\'\);', 'alert("L\'IA Predictive et les avantages courtier sont reserves aux membres ! Creez un compte pour y acceder.");', text)

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
