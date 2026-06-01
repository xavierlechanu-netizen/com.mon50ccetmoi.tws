import os

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the incorrectly placed </head><body> block
bad_block = """</head>
<body style="margin:0; padding:0; background:#000; overflow:hidden;">
    <!-- APEX SENTINEL: Holographic Quantum Background -->
    <canvas id="quantum-bg" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;pointer-events:none;opacity:0.6;"></canvas>

    <div id="map" style="width: 100vw; height: 100vh; z-index: 10;"></div>
    <div id="guardian-halo" class="guardian-halo hidden"></div>"""

text = text.replace(bad_block, "")

# Find where the head ACTUALLY ends. 
# In the original file, it ended right before the <div id="app-loader"> or the Leaflet CSS
# Let's insert the correct block right before <div id="app-loader">

target = """    <!-- APP LOADER HOLOGRAM -->
    <div id="app-loader\""""

correct_block = """</head>
<body style="margin:0; padding:0; background:#000; overflow:hidden;">
    <!-- APEX SENTINEL: Holographic Quantum Background -->
    <canvas id="quantum-bg" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;pointer-events:none;opacity:0.6;"></canvas>

    <div id="map" style="width: 100vw; height: 100vh; z-index: 10;"></div>
    <div id="guardian-halo" class="guardian-halo hidden"></div>

    <!-- APP LOADER HOLOGRAM -->
    <div id="app-loader\""""

text = text.replace(target, correct_block)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
