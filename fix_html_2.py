import os

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

correct_block = """</head>
<body style="margin:0; padding:0; background:#000; overflow:hidden;">
    <!-- APEX SENTINEL: Holographic Quantum Background -->
    <canvas id="quantum-bg" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;pointer-events:none;opacity:0.6;"></canvas>

    <div id="map" style="width: 100vw; height: 100vh; z-index: 10;"></div>
    <div id="guardian-halo" class="guardian-halo hidden"></div>

    <!-- APPLE SMART DOCK -->"""

# Find <!-- APPLE SMART DOCK -->
text = text.replace("    <!-- APPLE SMART DOCK -->", correct_block)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
