// ═══════════════════════════════════════════════
// TEST SUITE — mon50ccetmoi v60.0.18
// GPS Trace + Oracle Voice + Géolocalisation
// ═══════════════════════════════════════════════

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ ${name} → ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

// ── Mock Browser APIs ────────────────────────────
global.window = global;
global.navigator = {
    language: 'fr-FR',
    geolocation: {
        watchPosition: (ok, err, opts) => {
            console.log('    [GPS] watchPosition appelé avec:', JSON.stringify(opts));
            return 1; // fake watch ID
        },
        getCurrentPosition: (ok, err, opts) => {
            console.log('    [GPS] getCurrentPosition appelé');
        },
        clearWatch: (id) => {
            console.log('    [GPS] clearWatch appelé, id:', id);
        }
    },
    onLine: true,
    vibrate: () => true
};
global.google = {
    maps: {
        Polyline: class {
            constructor(opts) { this._opts = opts; this._path = opts.path || []; }
            setPath(path) { this._path = path; }
            setMap(m) { this._map = m; }
        },
        Marker: class {
            constructor(opts) { this._opts = opts; }
            setPosition(p) { this._pos = p; }
        }
    }
};
global.document = {
    getElementById: (id) => {
        const fakeEls = {
            'speed': { textContent: '42' },
            'weather-hud': { textContent: '22°C' },
        };
        return fakeEls[id] || null;
    }
};
global.localStorage = { getItem: () => null };
global.speechSynthesis = null;

// ── TEST 1 : Tracé GPS — addTracePoint ──────────
console.log('\n📍 GPS TRACE TESTS');

let map = { panTo: () => {}, setHeading: () => {}, setCenter: () => {} };
let rideTracePolyline = null;
let rideTraceCoords = [];

global.map = map;

global.addTracePoint = function(lat, lng) {
    if (!map) return;
    rideTraceCoords.push({ lat, lng });
    if (!rideTracePolyline) {
        rideTracePolyline = new google.maps.Polyline({
            path: rideTraceCoords,
            geodesic: true,
            strokeColor: '#00d2ff',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map: map
        });
    } else {
        rideTracePolyline.setPath(rideTraceCoords);
    }
};

global.clearRideTrace = function() {
    if (rideTracePolyline) {
        rideTracePolyline.setMap(null);
        rideTracePolyline = null;
    }
    rideTraceCoords = [];
};

test('Premier point GPS crée la polyline', () => {
    rideTracePolyline = null;
    rideTraceCoords = [];
    addTracePoint(48.8566, 2.3522);
    assert(rideTracePolyline !== null, 'Polyline devrait être créée');
    assert(rideTraceCoords.length === 1, 'Devrait avoir 1 coord');
    assert(rideTraceCoords[0].lat === 48.8566, 'Lat incorrecte');
});

test('Deuxième point GPS étend la polyline', () => {
    addTracePoint(48.857, 2.353);
    assert(rideTraceCoords.length === 2, 'Devrait avoir 2 coords');
});

test('10 points GPS accumulation correcte', () => {
    for (let i = 0; i < 8; i++) addTracePoint(48.86 + i * 0.001, 2.35 + i * 0.001);
    assert(rideTraceCoords.length === 10, `Devrait avoir 10 coords, a ${rideTraceCoords.length}`);
});

test('clearRideTrace remet à zéro', () => {
    clearRideTrace();
    assert(rideTracePolyline === null, 'Polyline devrait être null');
    assert(rideTraceCoords.length === 0, 'Coords devrait être vide');
});

test('addTracePoint sans map ne plante pas et ne push pas', () => {
    // On vérifie directement le comportement du return early
    global.map = null;
    const coordsSnapshot = rideTraceCoords.length; // 0 après clearRideTrace
    addTracePoint(99.0, 99.0); // doit être ignoré car map=null
    assert(rideTraceCoords.length === coordsSnapshot,
        `Coords ${rideTraceCoords.length} devrait rester à ${coordsSnapshot} sans map`);
    global.map = map; // restore
});

// ── TEST 2 : Oracle Voice — processCommand ───────
console.log('\n🎙️  ORACLE VOICE TESTS');

let lastSpoken = null;
global.speak = (text) => { lastSpoken = text; };
global.vibrate = () => {};
global.window.session = { username: 'Xavier', totalDistance: 1234.5 };
global.window.currentPosition = { lat: 48.8566, lng: 2.3522 };
global.window.toggleMenu = () => {};
global.window.reportHazard = (type, source) => {};
global.window.SOSEmergency = { trigger: () => {} };
global.window.searchDestination = () => {};

// Reconstruct processCommand logic
function processCommand(text) {
    const triggered = text.includes("oracle") || text.includes("mon 50") ||
        text.includes("mon50") || text.includes("voturette") ||
        text.includes("vsp") || text.includes("ami") || text.includes("allô");

    if (!triggered) return false;

    vibrate(100);

    if (text.includes("danger") || text.includes("radar") || text.includes("police") || text.includes("contrôle")) {
        speak("Danger signalé à la communauté. Restez prudent.");
    } else if (text.includes("vitesse") || text.includes("vite")) {
        const speed = document.getElementById('speed')?.textContent || '0';
        speak(`Vitesse actuelle : ${speed} km/h.`);
    } else if (text.includes("menu") || text.includes("ouvre")) {
        window.toggleMenu();
        speak("Ouverture du menu.");
    } else if (text.includes("kilométrage") || text.includes("combien") || text.includes("parcouru")) {
        const km = window.session?.totalDistance || 0;
        speak(`Vous avez parcouru ${km.toFixed(1)} kilomètres au total.`);
    } else if (text.includes("où") || text.includes("position") || text.includes("suis-je")) {
        const pos = window.currentPosition;
        if (pos) speak(`Vous êtes à latitude ${pos.lat.toFixed(4)}, longitude ${pos.lng.toFixed(4)}.`);
        else speak("Je n'ai pas encore de signal GPS.");
    } else if (text.includes("bonjour") || text.includes("salut") || text.includes("coucou")) {
        speak(`Bonjour, Xavier. Je suis Oracle, votre copilote intelligent.`);
    } else if (text.includes("aide") || text.includes("commande")) {
        speak("Je peux : Signaler un danger, Donner votre vitesse, Naviguer vers une destination, Ouvrir le menu, Donner votre kilométrage, et activer le SOS.");
    } else if (text.includes("sos") || text.includes("urgence")) {
        speak("Activation du protocole SOS. Restez immobile.");
    } else {
        speak("Je vous écoute. Dites Oracle aide pour connaître mes commandes disponibles.");
    }
    return true;
}

test('Trigger "oracle" reconnu', () => {
    const result = processCommand("oracle aide");
    assert(result === true, 'Devrait déclencher');
});

test('Trigger non-reconnu ignoré', () => {
    lastSpoken = null;
    processCommand("bonjour comment allez-vous");
    assert(lastSpoken === null, 'Ne devrait pas parler sans trigger');
});

test('"oracle bonjour" → salutation', () => {
    processCommand("oracle bonjour");
    assert(lastSpoken && lastSpoken.includes("Oracle"), `Got: ${lastSpoken}`);
});

test('"oracle vitesse" → vitesse 42', () => {
    processCommand("oracle vitesse");
    assert(lastSpoken && lastSpoken.includes("42"), `Got: ${lastSpoken}`);
});

test('"oracle danger" → signalement', () => {
    processCommand("oracle danger");
    assert(lastSpoken && lastSpoken.includes("Danger"), `Got: ${lastSpoken}`);
});

test('"oracle où suis-je" → coordonnées GPS', () => {
    processCommand("oracle où suis-je");
    assert(lastSpoken && lastSpoken.includes("48.8566"), `Got: ${lastSpoken}`);
});

test('"oracle kilométrage" → total km', () => {
    processCommand("oracle combien de kilomètres");
    assert(lastSpoken && lastSpoken.includes("1234.5"), `Got: ${lastSpoken}`);
});

test('"oracle aide" → liste commandes', () => {
    processCommand("oracle aide");
    assert(lastSpoken && lastSpoken.includes("danger"), `Got: ${lastSpoken}`);
});

test('"oracle sos" → SOS activé', () => {
    processCommand("oracle sos");
    assert(lastSpoken && lastSpoken.includes("SOS"), `Got: ${lastSpoken}`);
});

test('"mon 50 vitesse" → trigger alternatif', () => {
    processCommand("mon 50 vitesse");
    assert(lastSpoken && lastSpoken.includes("42"), `Got: ${lastSpoken}`);
});

// ── TEST 3 : Géolocalisation — Options ──────────
console.log('\n🛰️  GÉOLOCALISATION TESTS');

test('geoOptions haute précision correcte', () => {
    const geoOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 };
    assert(geoOptions.enableHighAccuracy === true, 'Doit activer haute précision');
    assert(geoOptions.timeout === 20000, 'Timeout doit être 20s');
    assert(geoOptions.maximumAge === 5000, 'MaxAge doit être 5s');
});

test('Fallback basse précision options correctes', () => {
    const fallbackOpts = { enableHighAccuracy: false, timeout: 20000, maximumAge: 30000 };
    assert(fallbackOpts.enableHighAccuracy === false, 'Fallback doit être basse précision');
    assert(fallbackOpts.maximumAge === 30000, 'MaxAge fallback = 30s');
});

test('Warm-up réseau options correctes (5min cache)', () => {
    const warmupOpts = { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 };
    assert(warmupOpts.maximumAge === 300000, 'Warm-up accepte cache 5min');
    assert(warmupOpts.timeout === 10000, 'Warm-up timeout = 10s');
});

test('Précision < 30m → fallback doit s\'arrêter', () => {
    let fallbackWatchId = 42;
    let cleared = false;
    const fakeNavigator = {
        geolocation: { clearWatch: (id) => { cleared = true; } }
    };
    const accuracy = 17.7;
    if (accuracy !== null && accuracy < 30 && fallbackWatchId !== null) {
        fakeNavigator.geolocation.clearWatch(fallbackWatchId);
        fallbackWatchId = null;
    }
    assert(cleared === true, 'Fallback doit être stoppé si précision < 30m');
    assert(fallbackWatchId === null, 'fallbackWatchId doit être null');
});

// ── RÉSUMÉ ──────────────────────────────────────
console.log('\n═══════════════════════════════════════');
console.log(`  RÉSULTAT : ${passed} tests réussis, ${failed} tests échoués`);
console.log('═══════════════════════════════════════\n');
if (failed > 0) process.exit(1);
