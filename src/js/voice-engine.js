/**
 * voice-engine.js — Voix de l'assistant (synthèse vocale) et vibrations courtes.
 *
 * Sorti de app-core.js (étape 5 du plan de dette technique, 7/11/2026) :
 * - window.OracleEngine : lexique des phrases (accents régionaux) et choix de la voix ;
 * - speak(clé ou phrase) : dit la phrase dans la langue de l'utilisateur (voice-phrases.js) ;
 * - vibrate(ms) : vibration, seulement après une première interaction (règle des navigateurs).
 */
import { voiceLanguage, translateForVoice } from './voice-phrases.js';

// --- NEW: Voice Synthesis & Haptics ---
export function vibrate(ms) {
  if (
    "vibrate" in navigator &&
    navigator.userActivation &&
    navigator.userActivation.hasBeenActive
  ) {
    navigator.vibrate(ms);
  }
}

// --- REGIONAL & VOICE ENGINE (ORACLE v110.00.00) ---
window.OracleEngine = {
  gender: localStorage.getItem("oracle_gender") || "female",
  currentRegion: "standard",

  regionalLexicon: {
    fr: {
      marseille: {
        start:
          "Té, l'Oracle est en place ! On est parés pour la route, peuchère.",
        speed: "Oh fada, tu vas trop vite ! Lève le pied avant de t'envoler.",
        threat_detected:
          "Vé ! Y'a un souci sur la route devant. Fais gaffe à toi.",
        level_up: "Et bim ! Tu as monté de niveau, bravo mon brave.",
        start_guardian:
          "Ange Gardien en place ! T'inquiète pas, je veille sur toi.",
        stop_guardian: "Ange Gardien au repos. Fais doucement, hein !",
        danger_overtake:
          "Vé ! Tu doubles n'importe comment, tu vas nous faire un plat !",
      },
      quebec: {
        start: "Attache ta tuque, l'Oracle est prêt pour une sacrée virée !",
        speed: "Lâche la patate, tu roules pas mal trop vite là !",
        threat_detected: "Check ben ça, y'a de quoi de pas net sur le chemin.",
        level_up: "C'est écoeurant ! T'as gagné un niveau.",
        start_guardian: "Ton Ange Gardien est prêt, on lâche pas !",
        stop_guardian: "L'Ange Gardien prend une pause. Prudence !",
        danger_overtake:
          "Oulà ! Ton dépassement était pas mal risqué, check tes angles !",
      },
      standard: {
        start: "Core Universel stabilisé. Liaison totale établie.",
        speed: "Alerte : Vitesse excessive. Ralentissez immédiatement.",
        threat_detected: "ANALYSE : Menace identifiée. Prudence conseillée.",
        level_up: "Félicitations Pilote. Votre expérience a augmenté.",
        start_guardian:
          "Ange Gardien activé. Surveillance périmétrique en cours.",
        stop_guardian: "Ange Gardien désactivé. Fin de la surveillance.",
        danger_overtake: "ATTENTION : DÉPASSEMENT DANGEREUX DÉTECTÉ.",
        ferry_detected:
          "Attention, cet itinéraire inclut une traversée en ferry.",
        ferry_ahead:
          "Traversée en ferry à 1 kilomètre. Préparez-vous à l'embarquement.",
      },
      liege: {
        start: "Oufti, l'Oracle est en place, valet ! On décolle ?",
        speed: "Ouille valet, tu vas trop vite ! Calme ton jeu.",
        threat_detected: "Aïe gaffe, y'a un bins sur la route devant.",
        level_up: "Oufti ! T'es passé au niveau suivant, c'est du propre !",
        start_guardian:
          "L'Ange Gardien est là pour toi, valet. Roule tranquille.",
        stop_guardian: "L'Ange Gardien va s'en jeter une, sois prudent.",
        danger_overtake:
          "Oufti ! Ton dépassement était un peu chaud, valet !",
      },
      charleroi: {
        start: "Salut m'fi ! L'Oracle est prêt, on y va ?",
        speed: "M'fi, tu roules trop vite ! On n'est pas sur le ring ici.",
        threat_detected: "Fais gaffe m'fi, y'a un gros souci devant.",
        level_up: "Bordel m'fi ! T'as monté de niveau, félicitations !",
        start_guardian: "Ton Ange Gardien veille sur toi, m'fi. Pas de stress.",
        stop_guardian: "L'Ange Gardien a fini sa pause, fais attention m'fi.",
        danger_overtake: "M'fi ! C'était quoi ce dépassement de baraki ?",
      },
      brussels: {
        start: "Salut fieu ! L'Oracle est là, on y va ou quoi ?",
        speed:
          "Dites une fois, fieu ! Tu vas trop vite, on n'est pas pressés !",
        threat_detected: "Attention fieu, y'a un stut sur la route devant.",
        level_up:
          "Non peut-être ! T'as monté de niveau, ça c'est du stoemp !",
        start_guardian: "L'Ange Gardien est avec toi, fieu. T'inquiète pas.",
        stop_guardian: "L'Ange Gardien va manger une frite, fais gaffe à toi.",
        danger_overtake:
          "Eh fieu ! Ton dépassement là, c'était un peu zinneke, non ?",
      },
      flanders: {
        start: "Allez, l'Oracle est prêt. On roule, hein ?",
        speed: "Oula ! Tu vas trop vite, hein ! Calme-toi un peu.",
        threat_detected: "Pas de chance, y'a un problème sur la route.",
        level_up: "Super ! T'as monté de niveau. C'est bien, hein !",
        start_guardian:
          "L'Ange Gardien est là pour toi. C'est sécurisé, hein.",
        stop_guardian: "L'Ange Gardien s'arrête. Sois prudent, hein.",
        danger_overtake:
          "Dis, ton dépassement était un peu dangereux, hein !",
      },
      andalucia: {
        start: "¡Ole! L'Oracle est prêt, mon ami. On y va !",
        speed: "Eh, l'ami ! Tu vas trop vite, doucement sur l'accélérateur.",
        threat_detected: "Attention, y'a du jaleo sur la route devant.",
        level_up: "¡Qué arte! Tu as monté de niveau, bravo !",
        start_guardian: "L'Ange Gardien est avec toi, l'ami.",
        stop_guardian: "L'Ange Gardien fait une petite sieste, sois prudent.",
        danger_overtake:
          "Eh ! Ce dépassement était un peu trop risqué, mi arma !",
      },
      reunion: {
        start: "Lé paré ! L'Oracle est en place, dalon. Allons rouler !",
        speed: "Oté ! Tu vas trop vite, calme un peu là !",
        threat_detected:
          "Gaffe dalon, y'a un l'embouteillage ou un souci devant.",
        level_up: "Lé bon ça ! T'as monté de niveau, félicitations !",
        start_guardian: "L'Ange Gardien lé là, t'inquiète pas dalon.",
        stop_guardian: "L'Ange Gardien va prendre un petit rhum, sois prudent.",
        danger_overtake:
          "Oté ! Ton dépassement là, c'était risqué dalon !",
      },
    },
    zh: {
      standard: {
        start: "系统就绪。连接已建立。",
        speed: "警告：速度过快。请立即减速。",
        threat_detected: "分析：发现威胁。建议谨慎。",
        level_up: "恭喜车手。您的经验值已提升。",
        start_guardian: "守护天使已开启。正在监控。",
        stop_guardian: "守护天使已关闭。监控结束。",
        danger_overtake: "警告：检测到危险超车。",
      },
    },
    ja: {
      standard: {
        start: "システム準備完了。接続が確立されました。",
        speed: "警告：速度超過です。直ちに減速してください。",
        threat_detected: "分析：脅威を検知。注意してください。",
        level_up: "おめでとうございます。レベルが上がりました。",
        start_guardian: "守護天使が起動しました。監視中。",
        stop_guardian: "守護天使が解除されました。監視終了。",
        danger_overtake: "警告：危険な追い越しを検知しました。",
      },
    },
    es: {
      andalucia: {
        start: "¡Ole! El Oráculo está listo, mi arma. ¡Vámonos!",
        speed: "¡Eh, chiquillo! Vas mu' rápido, frena un poco.",
        threat_detected: "Cuidao, que hay un jaleo ahí delante.",
        level_up: "¡Qué arte tienes! Has subido de nivel.",
        start_guardian: "El Ángel de la Guarda está contigo, mi arma.",
        stop_guardian: "El Ángel se va a echar una siestecita, ten cuidao.",
        danger_overtake:
          "¡Chiquillo! Ese adelantamiento ha sío mu' peligroso.",
      },
      standard: {
        start: "Sistemas listos. Conexión establecida.",
        speed: "Alerta: Exceso de velocidad. Reduzca inmediatamente.",
        threat_detected: "ANÁLISIS: Amenaza identificada. Tenga precaución.",
        level_up: "Felicidades Piloto. Su experiencia ha aumentado.",
        start_guardian: "Ángel de la Guarda activado. Vigilancia en curso.",
        stop_guardian: "Ángel de la Guarda desactivado. Fin de la vigilancia.",
        danger_overtake: "ATENCIÓN: ADELANTAMIENTO PELIGROSO DETECTADO.",
      },
    },
    en: {
      standard: {
        start: "System ready. Connection established.",
        speed: "Alert: Excessive speed. Please slow down.",
        threat_detected: "ANALYSIS: Threat identified. Caution advised.",
        level_up: "Congratulations Pilot. Your experience has increased.",
        start_guardian: "Guardian Angel activated. Monitoring perimeter.",
        stop_guardian: "Guardian Angel deactivated. End of monitoring.",
        danger_overtake: "WARNING: DANGEROUS OVERTAKE DETECTED.",
        ferry_detected: "Attention, this route includes a ferry crossing.",
        ferry_ahead: "Ferry crossing in 1 kilometer. Prepare for boarding.",
      },
    },
    it: {
      standard: {
        start: "Sistema pronto. Connessione stabilita.",
        speed: "Allerta: Velocità eccessiva. Rallenta immediatamente.",
        threat_detected:
          "ANALISI: Minaccia identificata. Prudenza consigliata.",
        level_up: "Congratulazioni Pilota. La tua esperienza è aumentata.",
        start_guardian: "Angelo Custode attivato. Monitoraggio in corso.",
        stop_guardian: "Angelo Custode disattivato. Fine monitoraggio.",
        danger_overtake: "ATTENZIONE: SORPASSO PERICOLOSO RILEVATO.",
      },
    },
    de: {
      standard: {
        start: "System bereit. Verbindung hergestellt.",
        speed: "Warnung: Zu hohe Geschwindigkeit. Bitte sofort abbremsen.",
        threat_detected: "ANALYSE: Gefahr erkannt. Vorsicht geboten.",
        level_up: "Glückwunsch Pilot. Deine Erfahrung ist gestiegen.",
        start_guardian: "Schutzengel aktiviert. Überwachung läuft.",
        stop_guardian: "Schutzengel deaktiviert. Ende der Überwachung.",
        danger_overtake: "WARNUNG: GEFÄHRLICHES ÜBERHOLMANÖVER ERKANNT.",
      },
    },
    pt: {
      standard: {
        start: "Sistema pronto. Conexão estabelecida.",
        speed: "Alerta: Velocidade excessiva. Reduza imediatamente.",
        threat_detected: "ANÁLISE: Ameaça identificada. Cuidado aconselhado.",
        level_up: "Parabéns Piloto. A sua experiência aumentou.",
        start_guardian: "Anjo da Guarda ativado. Monitorização em curso.",
        stop_guardian: "Anjo da Guarda desativado. Fim da monitorização.",
        danger_overtake: "AVISO: ULTRAPASSAGEM PERIGOSA DETETADA.",
      },
    },
    nl: {
      standard: {
        start: "Systeem gereed. Verbinding tot stand gebracht.",
        speed:
          "Waarschuwing: Te hoge snelheid. Gelieve onmiddellijk te vertragen.",
        threat_detected:
          "ANALYSE: Dreiging geïdentificeerd. Voorzichtigheid geboden.",
        level_up: "Gefeliciteerd Piloot. Uw ervaring is toegenomen.",
        start_guardian: "Beschermengel geactiveerd. Monitoring gestart.",
        stop_guardian: "Beschermengel gedeactiveerd. Einde monitoring.",
        danger_overtake: "WAARSCHUWING: GEVAARLIJKE INHAALACTIE GEDETECTEERD.",
      },
    },
    pl: {
      standard: {
        start: "System gotowy. Połączenie nawiązane.",
        speed: "Alert: Nadmierna prędkość. Proszę natychmiast zwolnić.",
        threat_detected:
          "ANALIZA: Zidentyfikowano zagrożenie. Zalecana ostrożność.",
        level_up: "Gratulacje Pilocie. Twoje doświadczenie wzrosło.",
        start_guardian: "Anioł Stróż aktywowany. Monitorowanie w toku.",
        stop_guardian: "Anioł Stróż dezaktywowany. Koniec monitorowania.",
        danger_overtake: "OSTRZEŻENIE: WYKRYTO NIEBEZPIECZNE WYPRZEDZANIE.",
      },
    },
    sv: {
      standard: {
        start: "Systemet är klart. Anslutning upprättad.",
        speed: "Varning: För hög hastighet. Sänk farten omedelbart.",
        threat_detected: "ANALYS: Hot identifierat. Var försiktig.",
        level_up: "Grattis Pilot. Din erfarenhet har ökat.",
        start_guardian: "Skyddsängel aktiverad. Övervakning pågår.",
        stop_guardian: "Skyddsängel inaktiverad. Slut på övervakning.",
        danger_overtake: "VARNING: FARLIG OMKÖRNING UPPTÄCKT.",
      },
    },
    da: {
      standard: {
        start: "Systemet er klar. Forbindelse oprettet.",
        speed: "Advarsel: For høj hastighed. Sæt farten ned med det samme.",
        threat_detected:
          "ANALYSE: Trussel identificeret. Forsigtighed tilrådes.",
        level_up: "Tillykke Pilot. Din erfarenhet er øget.",
        start_guardian: "Skytsengel aktiveret. Overvågning i gang.",
        stop_guardian: "Skytsengel deaktiveret. Slut på overvågning.",
        danger_overtake: "ADVARSEL: FARLIG OVERHALING REGISTRERET.",
      },
    },
    fi: {
      standard: {
        start: "Järjestelmä valmis. Yhteys muodostettu.",
        speed: "Hälytys: Liian suuri nopeus. Hidasta välittömästi.",
        threat_detected: "ANALYYSI: Uhka tunnistettu. Noudata varovaisuutta.",
        level_up: "Onnea Pilotti. Kokemuksesi on kasvanut.",
        start_guardian: "Suojelusenkeli aktivoitu. Valvonta käynnissä.",
        stop_guardian: "Suojelusenkeli deaktivoitu. Valvonta päättynyt.",
        danger_overtake: "VAROITUS: VAARALLINEN OHITUS HAVAITTU.",
      },
    },
    no: {
      standard: {
        start: "Systemet er klart. Tilkobling opprettet.",
        speed: "Advarsel: For høy hastighet. Sakt ned umiddelbart.",
        threat_detected:
          "ANALYSE: Trussel identifisert. Forsiktighet anbefales.",
        level_up: "Gratulerer Pilot. Din erfaring har økt.",
        start_guardian: "Skytsengel aktivert. Overvåking pågår.",
        stop_guardian: "Skytsengel deaktivert. Slut på overvåking.",
        danger_overtake: "ADVARSEL: FARLIG FORBIKJØRING OPPDAGET.",
      },
    },
    el: {
      standard: {
        start:
          "Σύστημα έτοιμο. Η σύνδεση ολοκληρώθηκε.",
        speed:
          "Ειδοποίηση: Υπερβολική ταχύτητα. Επιβραδύνετε αμέσως.",
        threat_detected:
          "ΑΝΑΛΥΣΗ: Εντοπίστηκε απειλή. Συνιστάται προσοχή.",
        level_up:
          "Συγχαρητήρια Πιλότε. Η εμπειρία σας αυξήθηκε.",
        start_guardian:
          "Φύλακας Άγγελος ενεργοποιήθηκε. Παρακολούθηση σε εξέλιξη.",
        stop_guardian:
          "Φύλακας Άγγελος απενεργοποιήθηκε. Τέλος παρακολούθησης.",
        danger_overtake:
          "ΠΡΟΣΟΧΗ: ΕΝΤΟΠΙΣΤΗΚΕ ΕΠΙΚΙΝΔΥΝΗ ΠΡΟΣΠΕΡΑΣΗ.",
      },
    },
    cs: {
      standard: {
        start: "Systém připraven. Připojení navázáno.",
        speed: "Upozornění: Nadměrná rychlost. Okamžitě zpomalte.",
        threat_detected:
          "ANALÝZA: Identifikována hrozba. Doporučuje se opatrnost.",
        level_up: "Gratulujeme Pilote. Vaše zkušenosti se zvýšily.",
        start_guardian: "Anděl strážný aktivován. Sledování probíhá.",
        stop_guardian: "Anděl strážný deaktivován. Konec sledování.",
        danger_overtake: "VAROVÁNÍ: ZJIŠTĚNO NEBEZPEČNÉ PŘEDBÍHÁNÍ.",
      },
    },
    hu: {
      standard: {
        start: "Rendszer kész. Kapcsolat létrejött.",
        speed: "Riasztás: Túl nagy sebesség. Azonnal lassítson.",
        threat_detected:
          "ELEMZÉS: Fenyegetés azonosítva. Óvatosság ajánlott.",
        level_up: "Gratulálunk Pilóta. Tapasztalata nőtt.",
        start_guardian: "Őrangyal aktiválva. Megfigyelés folyamatban.",
        stop_guardian: "Őrangyal deaktiválva. Megfigyelés vége.",
        danger_overtake: "FIGYELEM: VESZÉLYES ELŐZÉS ÉSZLELVE.",
      },
    },
    ro: {
      standard: {
        start: "Sistem gata. Conexiune stabilită.",
        speed: "Alertă: Viteză excesivă. Încetiniți imediat.",
        threat_detected:
          "ANALIZĂ: Amenințare identificată. Se recomandă prudență.",
        level_up: "Felicitări Pilotule. Experiența ta a crescut.",
        start_guardian: "Înger Păzitor activat. Monitorizare în curs.",
        stop_guardian:
          "Înger Păzitor dezactivat. Sfârșitul monitorizării.",
        danger_overtake: "ATENȚIE: DEPĂȘIRE PERICULOASĂ DETECTATĂ.",
      },
    },
  },

  updateRegion: function (lat, lng) {
    // Ne pas écraser la région si triggerRegionalWelcome (Nominatim) l'a déjà définie
    if (this._regionSetByNominatim) return;

    if (lat > 43.1 && lat < 43.4 && lng > 5.2 && lng < 5.6)
      this.currentRegion = "marseille";
    else if (lat > 45 && lat < 47 && lng > -74 && lng < -71)
      this.currentRegion = "quebec";
    else if (lat > 50.5 && lat < 50.8 && lng > 5.3 && lng < 5.8)
      this.currentRegion = "liege";
    else if (lat > 50.2 && lat < 50.5 && lng > 4.2 && lng < 4.6)
      this.currentRegion = "charleroi";
    else if (lat > 50.75 && lat < 50.95 && lng > 4.2 && lng < 4.6)
      this.currentRegion = "brussels";
    else if (lat > 50.95 && lat < 51.5 && lng > 2.5 && lng < 5.9)
      this.currentRegion = "flanders";
    else if (lat > 35.8 && lat < 38.7 && lng > -7.5 && lng < -1.6)
      this.currentRegion = "andalucia";
    else if (lat > -21.4 && lat < -20.8 && lng > 55.2 && lng < 55.9)
      this.currentRegion = "reunion";
    else this.currentRegion = "standard";
  },

  getVoice: function (lang) {
    const voices = window.speechSynthesis.getVoices();
    let filtered = voices.filter((v) => v.lang.startsWith(lang));
    let target = filtered.find((v) => {
      const name = v.name.toLowerCase();
      return this.gender === "female"
        ? name.includes("female") ||
            name.includes("mary") ||
            name.includes("claire") ||
            name.includes("hortense")
        : name.includes("male") ||
            name.includes("david") ||
            name.includes("thomas") ||
            name.includes("paul");
    });
    return target || filtered[0] || null;
  },
};


export async function speak(phraseKey) {
  if (!("speechSynthesis" in window)) return;

  // Les navigateurs refusent de parler tant que la personne n'a pas touché la page : le
  // message (ex. « Content de vous revoir ») était perdu. On garde le dernier et on le dit
  // au premier clic ou appui sur une touche.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    window.pendingSpeech = phraseKey;
    if (!window.pendingSpeechListening) {
      window.pendingSpeechListening = true;
      const flush = () => {
        window.removeEventListener("click", flush, true);
        window.removeEventListener("keydown", flush, true);
        window.pendingSpeechListening = false; // se réinstalle si la voix est encore refusée
        const pending = window.pendingSpeech;
        window.pendingSpeech = null;
        if (pending) speak(pending);
      };
      window.addEventListener("click", flush, { once: true, capture: true });
      window.addEventListener("keydown", flush, { once: true, capture: true });
    }
    return;
  }

  const region = window.OracleEngine.currentRegion;
  const wantedLang = voiceLanguage(window.currentLang, navigator.language);

  // Clés du lexique (« start_guardian »…) : version régionale en français, version
  // standard pour les autres langues (c'est elle qui est traduite).
  const lexicon = window.OracleEngine.regionalLexicon?.fr;
  const text =
    (wantedLang === "fr" && lexicon?.[region]?.[phraseKey]) ||
    lexicon?.standard?.[phraseKey] ||
    phraseKey;

  // Traduction par le dictionnaire intégré (voice-phrases.js). Avant : chaque phrase
  // partait vers un service de traduction Google non officiel.
  const voiceText = translateForVoice(text, wantedLang);
  if (!voiceText.translated) {
    console.info(`[Voix] Phrase sans traduction (${wantedLang}) :`, text);
  }
  const targetLang = voiceText.lang;
  const finalMsg = voiceText.text;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(finalMsg);

  const voices = window.speechSynthesis.getVoices();
  let voice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));
  if (!voice && targetLang === "fr") voice = window.OracleEngine.getVoice("fr");
  if (voice) utterance.voice = voice;

  utterance.lang = { fr: "fr-FR", en: "en-GB", es: "es-ES" }[targetLang] || "fr-FR";

  // Voice Modes (Marché Noir BVC)
  let rate = 0.95;
  let pitch =
    window.OracleEngine && window.OracleEngine.gender === "female" ? 1.05 : 0.9;

  const voiceMode = localStorage.getItem("nexus-atlasVoiceMode") || "standard";

  // Simulation d'accents régionaux (pitch/rate)
  if (region && region !== "standard" && voiceMode === "standard") {
    switch (region) {
      // Système A (Régions) & Système B (Villes/zones GPS)
      case "provence-alpes-côte d'azur":
      case "occitanie":
      case "marseille":
      case "reunion":
        rate = 0.85;
        pitch = pitch * 1.2; // Sud : plus lent, plus chantant
        break;
      case "hauts-de-france":
      case "liege":
      case "charleroi":
        rate = 1.1;
        pitch = pitch * 0.85; // Nord : plus rapide, un peu plus grave
        break;
      case "île-de-france":
      case "brussels":
        rate = 1.15; // Paris/Bruxelles : parle vite
        break;
      case "auvergne-rhône-alpes":
        rate = 0.88;
        pitch = pitch * 0.95; // Rhône-Alpes : posé, calme
        break;
      case "bretagne":
      case "normandie":
        pitch = pitch * 1.1; // Ouest
        break;
      case "grand est":
      case "bourgogne-franche-comté":
      case "flanders":
        rate = 0.92;
        pitch = pitch * 1.05;
        break;
      case "quebec":
        rate = 0.9;
        pitch = pitch * 1.15; // Québécois : chantant, plus lent
        break;
      case "andalucia":
        rate = 1.05;
        pitch = pitch * 1.1; // Espagnol du sud
        break;
    }
  }

  if (voiceMode === "cyberpunk") {
    rate = 0.85;
    pitch = 0.4;
  } else if (voiceMode === "rally") {
    rate = 1.3;
    pitch = 1.2;
  }

  utterance.rate = rate;
  utterance.pitch = pitch;

  window.speechSynthesis.speak(utterance);
  if (
    "vibrate" in navigator &&
    navigator.userActivation &&
    navigator.userActivation.hasBeenActive
  ) {
    navigator.vibrate(30);
  }
}
