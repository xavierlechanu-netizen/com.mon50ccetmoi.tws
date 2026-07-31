/**
 * ⚖️ BASE JURIDIQUE MONDIALE â€” POCKET LAWYER
 * Sources officielles gouvernementales uniquement.
 * Dernière mise à jour : 14 juillet 2026
 *
 * Structure : window.LegalDatabase[pays][thème]
 * Chaque entrée contient : title, content, source, url
 *
 * Avertissement (AI Act UE 2024/1689) : Ces informations sont fournies
 * à titre indicatif et sont soumises à contrôle humain.
 */

window.LegalDatabase = {
  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡«ðŸ‡· FRANCE â€” Source : Légifrance (legifrance.gouv.fr)
  // ═══════════════════════════════════════════════════════════════
  france: {
    _flag: "ðŸ‡«ðŸ‡·",
    _name: "France",
    _source: "Légifrance â€” legifrance.gouv.fr",
    _keywords: ["france", "français", "francais", "légifrance", "legifrance"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡«ðŸ‡· Port du Casque â€” Art. R431-1 Code de la Route",
      content:
        "Le port du casque homologué <strong>ECE 22.06</strong> est obligatoire pour tout conducteur et passager de 2-roues motorisé.<br><strong>Sanction :</strong> 135€ d'amende (contravention 4ème classe) + retrait de 3 points.",
      source: "Légifrance â€” Art. R431-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    debridage: {
      keywords: ["débrid", "debride", "kité", "kit"],
      title: "ðŸ‡«ðŸ‡· Débridage â€” Art. L317-5 Code de la Route",
      content:
        "Le débridage d'un cyclomoteur est un <strong>délit</strong>. Vous risquez <strong>135€ d'amende</strong> pour le propriétaire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.",
      source: "Légifrance â€” Art. L317-5 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stupefiants: {
      keywords: ["stup", "drogue", "fumé", "positif", "cannabis", "thc"],
      title: "ðŸ‡«ðŸ‡· Conduite sous Stupéfiants (Délit)",
      content:
        "Même avec un BSR, vous risquez jusqu'à <strong>4500€ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une première infraction, le juge peut faire preuve de clémence si vous montrez des preuves médicales.",
      source: "Légifrance â€” Art. L235-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    alcool: {
      keywords: ["alcool", "boire", "ivre", "alcoolémie"],
      title: "ðŸ‡«ðŸ‡· Alcoolémie â€” Art. L234-1",
      content:
        "Pour un permis probatoire ou BSR, la limite légale est de <strong>0,2 g/L</strong>. Vous risquez l'immobilisation immédiate du cyclomoteur et de fortes amendes. Au-delà de 0,8 g/L : délit pénal (2 ans de prison, 4500€).",
      source: "Légifrance â€” Art. L234-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    assurance: {
      keywords: ["assurance", "assuré"],
      title: "ðŸ‡«ðŸ‡· Défaut d'Assurance (Délit) â€” Art. L324-2",
      content:
        "Conduire sans assurance coûte jusqu'à <strong>3750€ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais <strong>vous réclamera le remboursement</strong>, potentiellement toute votre vie.",
      source: "Légifrance â€” Art. L324-2 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    fuite: {
      keywords: ["fuite", "obtempérer", "obtemperer"],
      title: "ðŸ‡«ðŸ‡· Refus d'Obtempérer / Délit de Fuite",
      content:
        "Cumuler ces délits entraîne des peines de <strong>prison fermes</strong>, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrôle de police.",
      source: "Légifrance â€” Art. L233-1 & L231-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stationnement: {
      keywords: ["stationn", "garé", "parking", "trottoir", "fourrière"],
      title: "ðŸ‡«ðŸ‡· Stationnement 2-Roues â€” Art. R417-10/11",
      content:
        "Sur un <strong>trottoir</strong> : toléré si le passage piéton (>1,50m) n'est pas entravé. Sur <strong>passage piéton/piste cyclable</strong> : 135€ + fourrière immédiate. Sur <strong>place auto</strong> : toléré si vous payez le stationnement.",
      source: "Légifrance â€” Art. R417-10 et R417-11",
      url: "legifrance.gouv.fr",
    },
    rgpd: {
      keywords: [
        "rgpd",
        "gdpr",
        "données personnelles",
        "cnil",
        "vie privée",
      ],
      title: "ðŸ‡«ðŸ‡· RGPD â€” Règlement (UE) 2016/679",
      content:
        "La protection des données personnelles est régie par le <strong>RGPD</strong> (entré en vigueur le 25 mai 2018) et la <strong>Loi Informatique et Libertés</strong> (Loi n°78-17 du 6 janvier 1978). La CNIL est l'autorité de contrôle française.<br>Droits : Accès (Art.15), Rectification (Art.16), Effacement (Art.17), Portabilité (Art.20), Opposition (Art.21).",
      source: "Légifrance & EUR-Lex â€” Règlement (UE) 2016/679",
      url: "legifrance.gouv.fr | eur-lex.europa.eu",
    },
    retractation: {
      keywords: [
        "remboursement",
        "rétractation",
        "retractation",
        "cgv",
        "numérique",
        "digital",
      ],
      title:
        "ðŸ‡«ðŸ‡· Droit de Rétractation (Contenu Numérique) â€” Art. L221-28",
      content:
        "Selon l'<strong>Article L221-28 (13°) du Code de la consommation</strong>, le droit de rétractation ne peut pas être exercé pour la fourniture d'un <strong>contenu numérique non fourni sur un support matériel</strong> dont l'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation. Les rapports d'expertise générés ne sont donc <strong>pas remboursables</strong>.",
      source: "Légifrance â€” Art. L221-28 du Code de la Consommation",
      url: "legifrance.gouv.fr",
    },
    vice_cache: {
      keywords: ["vice", "caché", "cache", "panne", "arnaque", "occasion"],
      title: "ðŸ‡«ðŸ‡· Garantie des Vices Cachés â€” Art. 1641 Code Civil",
      content:
        "L'<strong>Article 1641 du Code civil</strong> précise que le vendeur est tenu de la garantie à raison des défauts cachés de la chose vendue qui la rendent impropre à l'usage auquel on la destine. L'acheteur a <strong>2 ans à compter de la découverte du vice</strong> pour agir.",
      source: "Légifrance â€” Art. 1641 du Code Civil",
      url: "legifrance.gouv.fr",
    },
    accident_assurance: {
      keywords: [
        "accident",
        "constat",
        "sinistre",
        "indemnisation",
        "badinter",
      ],
      title: "ðŸ‡«ðŸ‡· Indemnisation des Victimes (Loi Badinter)",
      content:
        "La <strong>Loi n° 85-677 du 5 juillet 1985 (Loi Badinter)</strong> vise à améliorer la situation des victimes d'accidents de la circulation et à accélérer les procédures d'indemnisation. Si vous n'êtes pas responsable, votre assureur doit vous indemniser intégralement de vos préjudices corporels et matériels.",
      source: "Légifrance â€” Loi Badinter",
      url: "legifrance.gouv.fr",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡ªðŸ‡º UNION EUROPÉENNE â€” Source : EUR-Lex (eur-lex.europa.eu)
  // ═══════════════════════════════════════════════════════════════
  eu: {
    _flag: "ðŸ‡ªðŸ‡º",
    _name: "Union Européenne",
    _source: "EUR-Lex â€” eur-lex.europa.eu",
    _keywords: ["europe", "européen", "europeen", "ue", "eu", "eur-lex"],

    rgpd: {
      keywords: ["rgpd", "gdpr", "donnée", "privacy"],
      title: "ðŸ‡ªðŸ‡º RGPD â€” Règlement (UE) 2016/679",
      content:
        "Le Règlement Général sur la Protection des Données est le texte de référence en matière de protection des données personnelles dans l'UE. Entrée en vigueur : <strong>25 mai 2018</strong>.<br>Amende max : <strong>20M€ ou 4% du CA mondial</strong>.",
      source: "EUR-Lex â€” Règlement (UE) 2016/679",
      url: "eur-lex.europa.eu",
    },
    ai_act: {
      keywords: ["ia act", "ai act", "intelligence artificielle", "ia"],
      title: "ðŸ‡ªðŸ‡º AI Act â€” Règlement (UE) 2024/1689",
      content:
        "Premier règlement au monde sur l'IA. En vigueur depuis le <strong>1er août 2024</strong>. Approche par niveaux de risque :<br>• Risque inacceptable : <strong>Interdit</strong><br>• Haut risque : Conformité stricte obligatoire<br>• Risque limité : <strong>Obligation de transparence</strong> (notre catégorie)<br>• Risque minimal : Libre<br>Application complète prévue pour <strong>août 2026</strong>.",
      source: "EUR-Lex â€” Règlement (UE) 2024/1689",
      url: "eur-lex.europa.eu",
    },
    dsa: {
      keywords: ["dsa", "digital services", "modération", "plateforme"],
      title: "ðŸ‡ªðŸ‡º DSA â€” Règlement (UE) 2022/2065",
      content:
        "Le Digital Services Act impose des obligations de <strong>modération</strong> et de <strong>transparence</strong> aux plateformes numériques. Obligation de point de contact, mécanisme de signalement (Art.16), et motivation des décisions de modération (Art.17).",
      source: "EUR-Lex â€” Règlement (UE) 2022/2065",
      url: "eur-lex.europa.eu",
    },
    casque_eu: {
      keywords: ["casque", "homologation", "ece", "unece"],
      title: "ðŸ‡ªðŸ‡º Homologation Casque â€” UNECE R22.06",
      content:
        "Depuis juin 2024, seuls les casques homologués <strong>ECE 22.06</strong> peuvent être vendus dans l'UE. Les anciens ECE 22.05 restent utilisables mais ne sont plus fabriqués.",
      source: "UNECE â€” Regulation No. 22 Rev.6",
      url: "unece.org",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡®ðŸ‡© INDONÉSIE â€” Source : JDIH (jdih.kemenkumham.go.id)
  // ═══════════════════════════════════════════════════════════════
  indonesia: {
    _flag: "ðŸ‡®ðŸ‡©",
    _name: "Indonésie",
    _source: "JDIH â€” jdih.kemenkumham.go.id | peraturan.bpk.go.id",
    _keywords: ["indonésie", "indonesie", "indonesia", "jdih"],

    casque: {
      keywords: ["casque", "helm", "sni"],
      title: "ðŸ‡®ðŸ‡© Casque (Helm SNI) â€” UU 22/2009 Art.106(8)",
      content:
        "Le port du casque homologué <strong>SNI</strong> (Standar Nasional Indonesia) est obligatoire pour le conducteur et le passager (Art. 57§2).<br><strong>Sanction :</strong> Jusqu'à 1 mois de prison ou <strong>Rp 250.000</strong> d'amende (Art. 291§1).",
      source: "JDIH â€” UU No.22 Tahun 2009 (LLAJ)",
      url: "jdih.kemenkumham.go.id",
    },
    sim: {
      keywords: ["sim", "permis", "conduire"],
      title: "ðŸ‡®ðŸ‡© Permis de conduire (SIM) â€” UU 22/2009 Art.77",
      content:
        "Tout conducteur doit posséder un SIM correspondant à son véhicule :<br>• <strong>SIM C</strong> : Moto â‰¤ 250cc<br>• <strong>SIM CI</strong> : Moto 250-500cc<br>• <strong>SIM CII</strong> : Moto > 500cc<br><strong>Sans SIM :</strong> 3 mois prison ou Rp 1.000.000 (Art.281).<br><strong>SIM non présenté :</strong> 1 mois ou Rp 250.000 (Art.288§2).",
      source: "JDIH â€” UU No.22 Tahun 2009",
      url: "jdih.kemenkumham.go.id",
    },
    code_route: {
      keywords: ["route", "lalu lintas", "circulation", "code"],
      title: "ðŸ‡®ðŸ‡© Code de la Route â€” UU No.22 Tahun 2009 (LLAJ)",
      content:
        "La loi sur la Circulation et les Transports Routiers régit l'ensemble du trafic en Indonésie. Obligations pour les 2-roues :<br>• Casque SNI obligatoire (Art.106§8)<br>• Rétroviseurs, feux, klaxon, compteur (Art.285§1)<br>• SIM C obligatoire (Art.77)<br>• STNK à jour (Perpol 7/2021)",
      source: "JDIH â€” Kementerian Perhubungan",
      url: "jdih.kemenkumham.go.id",
    },
    stnk: {
      keywords: ["stnk", "enregistrement", "immatriculation", "pajak"],
      title: "ðŸ‡®ðŸ‡© Immatriculation (STNK) â€” Perpol 7/2021",
      content:
        "Le STNK est le certificat d'immatriculation obligatoire. Si le STNK expire et n'est pas renouvelé sous <strong>2 ans</strong>, les données du véhicule sont radiées.<br><strong>Opsen Pajak (2025) :</strong> Taxe additionnelle sur le PKB et BBN-KB (UU 1/2022).<br>Depuis 2026, le NIK (KTP) est intégré au SIM.",
      source: "JDIH â€” Korlantas Polri",
      url: "korlantas.polri.go.id",
    },
    pdp: {
      keywords: ["data", "donnée", "pdp", "pribadi", "privée"],
      title: "ðŸ‡®ðŸ‡© Protection des Données â€” UU No.27/2022 (UU PDP)",
      content:
        "En vigueur depuis le <strong>17 octobre 2024</strong>. Portée extraterritoriale.<br><strong>Sanctions admin. (Art.57) :</strong> Jusqu'à <strong>2% du CA annuel</strong>.<br><strong>Sanctions pénales :</strong> 4-6 ans de prison + Rp 4-6 milliards.<br><strong>Korporasi :</strong> Amende Ã—10 + gel/dissolution.",
      source: "JDIH â€” Komdigi (ex-Kominfo)",
      url: "jdih.kemenkumham.go.id",
    },
    contrat: {
      keywords: ["contrat"],
      title: "ðŸ‡®ðŸ‡© Droit des Contrats",
      content:
        "Régi par le <strong>Code civil indonésien</strong> (KUH Perdata), hérité du droit romano-hollandais. L'Indonésie n'a <strong>pas ratifié</strong> la Convention de Vienne (CISG).",
      source: "JDIH â€” peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    hierarchie: {
      keywords: ["hiérarchie", "constitution", "norme", "loi"],
      title: "ðŸ‡®ðŸ‡© Hiérarchie des Normes â€” UU No.10/2004",
      content:
        "Système mixte (adat / romano-hollandais / national / musulman à Aceh).<br>1. <strong>UUD 1945</strong> â€” Constitution<br>2. <strong>UU</strong> â€” Lois du Parlement<br>3. <strong>PP</strong> â€” Règlements gouvernementaux<br>4. <strong>Perpres</strong> â€” Décrets présidentiels<br>5. <strong>Perda</strong> â€” Règlements régionaux",
      source: "JDIH â€” jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    immobilier: {
      keywords: ["immobilier", "terre", "agraire", "hak"],
      title: "ðŸ‡®ðŸ‡© Droit Immobilier â€” Loi Agraire n°5/1960 (UUPA)",
      content:
        "Les étrangers ne peuvent posséder de terres directement (<strong>Hak Milik</strong>), mais peuvent acquérir des droits d'usage (<strong>Hak Pakai</strong>) ou investir via des sociétés (<strong>PT PMA</strong>).",
      source: "JDIH â€” peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    travail: {
      keywords: ["travail", "licenciement", "emploi"],
      title: "ðŸ‡®ðŸ‡© Droit du Travail â€” UU 13/2003 & Omnibus 11/2020",
      content:
        "Loi n°13/2003 = texte principal. Modifiée par la <strong>loi omnibus n°11/2020</strong> (Cipta Kerja) pour faciliter l'investissement (contrats, licenciements, heures supplémentaires).",
      source: "JDIH â€” jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    langue: {
      keywords: ["langue", "éducation", "media", "bahasa"],
      title: "ðŸ‡®ðŸ‡© Réglementation Linguistique â€” UU 20/2003 & 32/2002",
      content:
        "L'indonésien (<em>Bahasa Indonesia</em>) est la langue officielle de l'éducation et des médias. Les langues régionales et étrangères sont autorisées sous conditions.",
      source: "JDIH â€” Kemendikbudristek",
      url: "jdih.kemenkumham.go.id",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡ºðŸ‡¸ ÉTATS-UNIS â€” Sources : NHTSA, IIHS, Cornell LII
  // ═══════════════════════════════════════════════════════════════
  usa: {
    _flag: "ðŸ‡ºðŸ‡¸",
    _name: "États-Unis",
    _source: "NHTSA (nhtsa.gov) | Cornell LII (law.cornell.edu)",
    _keywords: [
      "usa",
      "états-unis",
      "etats-unis",
      "amérique",
      "amerique",
      "américain",
      "americain",
      "united states",
    ],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡ºðŸ‡¸ Casque Moto â€” FMVSS 218 (NHTSA)",
      content:
        "La norme fédérale est le <strong>FMVSS 218</strong> (Federal Motor Vehicle Safety Standard). <strong>Attention :</strong> la loi varie par État !<br>• <strong>Universal law</strong> (19 États) : Casque obligatoire pour tous<br>• <strong>Partial law</strong> (28 États) : Obligatoire seulement pour les <18 ou <21 ans<br>• <strong>No law</strong> (3 États) : Illinois, Iowa, New Hampshire",
      source: "NHTSA â€” nhtsa.gov | IIHS â€” iihs.org",
      url: "nhtsa.gov",
    },
    assurance: {
      keywords: ["assurance", "insurance"],
      title: "ðŸ‡ºðŸ‡¸ Assurance Moto â€” Réglementation par État",
      content:
        "L'assurance moto est obligatoire dans <strong>48 des 50 États</strong> (sauf Floride et Montana pour la responsabilité civile). Les minimums de couverture varient considérablement par État. En Californie : 15/30/5 (en milliers de $).",
      source: "NHTSA â€” nhtsa.gov",
      url: "nhtsa.gov",
    },
    ccpa: {
      keywords: ["ccpa", "cpra", "california", "donnée", "privacy"],
      title: "ðŸ‡ºðŸ‡¸ CCPA/CPRA â€” Protection des Données (Californie)",
      content:
        "Le <strong>CCPA</strong> (California Consumer Privacy Act, 2020) et son amendement <strong>CPRA</strong> offrent aux résidents californiens des droits proches du RGPD : droit de savoir, de suppression, de refus de vente. <strong>Amende :</strong> $2.500/violation, $7.500/violation intentionnelle.",
      source: "State of California â€” oag.ca.gov",
      url: "oag.ca.gov",
    },
    coppa: {
      keywords: ["coppa", "mineur", "enfant"],
      title: "ðŸ‡ºðŸ‡¸ COPPA â€” Protection des Mineurs en Ligne",
      content:
        "La <strong>Children's Online Privacy Protection Act</strong> interdit la collecte de données personnelles d'enfants de moins de 13 ans sans consentement parental vérifiable. <strong>Amende :</strong> jusqu'à $50.120/violation (FTC).",
      source: "FTC â€” ftc.gov",
      url: "ftc.gov",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¬ðŸ‡§ ROYAUME-UNI â€” Source : legislation.gov.uk
  // ═══════════════════════════════════════════════════════════════
  uk: {
    _flag: "ðŸ‡¬ðŸ‡§",
    _name: "Royaume-Uni",
    _source: "legislation.gov.uk",
    _keywords: [
      "royaume-uni",
      "uk",
      "angleterre",
      "british",
      "anglais",
      "london",
    ],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¬ðŸ‡§ Casque Moto â€” Road Traffic Act 1988 §16",
      content:
        "Le port du casque homologué <strong>BS 6658:1985</strong> ou <strong>UNECE R22.05/22.06</strong> est obligatoire. Les Sikhs portant un turban sont exemptés (§16§2).<br><strong>Sanction :</strong> Fixed Penalty Notice de <strong>£100</strong>.",
      source: "legislation.gov.uk â€” Road Traffic Act 1988 §16",
      url: "legislation.gov.uk",
    },
    permis: {
      keywords: ["permis", "licence", "cbt"],
      title: "ðŸ‡¬ðŸ‡§ Permis Moto â€” CBT / A1 / A2 / A",
      content:
        "Formation obligatoire : <strong>CBT</strong> (Compulsory Basic Training). Catégories :<br>• <strong>AM</strong> : Cyclomoteur â‰¤ 50cc<br>• <strong>A1</strong> : â‰¤ 125cc (16+)<br>• <strong>A2</strong> : â‰¤ 35kW (19+)<br>• <strong>A</strong> : Illimité (24+ ou 21+ avec 2 ans d'A2)",
      source: "GOV.UK â€” gov.uk/motorcycle-licence",
      url: "gov.uk",
    },
    uk_gdpr: {
      keywords: ["gdpr", "donnée", "ico", "privacy", "data"],
      title: "ðŸ‡¬ðŸ‡§ UK GDPR & Data Protection Act 2018",
      content:
        "Post-Brexit, le Royaume-Uni a conservé les principes du RGPD via le <strong>UK GDPR</strong> et le <strong>Data Protection Act 2018</strong>. L'autorité de contrôle est l'<strong>ICO</strong> (Information Commissioner's Office). Amende max : <strong>£17.5M ou 4% du CA</strong>.",
      source: "legislation.gov.uk â€” Data Protection Act 2018",
      url: "legislation.gov.uk",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¯ðŸ‡µ JAPON â€” Source : Japanese Law Translation (japaneselawtranslation.go.jp)
  // ═══════════════════════════════════════════════════════════════
  japan: {
    _flag: "ðŸ‡¯ðŸ‡µ",
    _name: "Japon",
    _source: "Japanese Law Translation â€” japaneselawtranslation.go.jp",
    _keywords: ["japon", "japonais", "japan", "nippon"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¯ðŸ‡µ Casque Moto â€” Road Traffic Act Art.71-4",
      content:
        "Le port du casque homologué <strong>PSC/SG</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues. Les casques doivent porter le marquage <strong>PSCãƒžãƒ¼ã‚¯</strong>.<br>Norme : <strong>JIS T 8133</strong>.",
      source: "Japanese Law Translation â€” Road Traffic Act (é“è·¯äº¤é€šæ³•)",
      url: "japaneselawtranslation.go.jp",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "ðŸ‡¯ðŸ‡µ Permis Moto (å…è¨±) â€” Road Traffic Act",
      content:
        "Catégories :<br>• <strong>åŽŸä»˜</strong> (Gentsuki) : â‰¤ 50cc (16+)<br>• <strong>å°åž‹</strong> : â‰¤ 125cc<br>• <strong>æ™®é€š</strong> : â‰¤ 400cc<br>• <strong>å¤§åž‹</strong> : Illimité (18+)<br>Examen pratique obligatoire en circuit fermé.",
      source: "Japanese Law Translation â€” é“è·¯äº¤é€šæ³•",
      url: "japaneselawtranslation.go.jp",
    },
    appi: {
      keywords: ["appi", "donnée", "data", "ppc", "privacy"],
      title: "ðŸ‡¯ðŸ‡µ APPI â€” Act on Protection of Personal Information",
      content:
        "Révisée en 2022. L'APPI est supervisée par la <strong>PPC</strong> (Personal Information Protection Commission). Le Japon bénéficie d'une <strong>décision d'adéquation</strong> avec l'UE (RGPD). Transferts transfrontaliers strictement encadrés.",
      source: "PPC â€” ppc.go.jp",
      url: "ppc.go.jp",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¨ðŸ‡³ CHINE â€” Source : NPC (npc.gov.cn)
  // ═══════════════════════════════════════════════════════════════
  china: {
    _flag: "ðŸ‡¨ðŸ‡³",
    _name: "Chine",
    _source: "NPC â€” npc.gov.cn | Assemblée Nationale Populaire",
    _keywords: ["chine", "chinois", "china", "pékin", "beijing"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¨ðŸ‡³ Casque Moto â€” Campagne « Un casque, une ceinture »",
      content:
        "Depuis la campagne nationale de 2020, le port du casque est obligatoire pour les conducteurs et passagers de 2-roues dans toute la Chine. Norme obligatoire : <strong>GB 811-2022</strong> (mise à jour de la norme nationale).",
      source: "NPC â€” Road Traffic Safety Law (é“è·¯äº¤é€šå®‰å…¨æ³•)",
      url: "npc.gov.cn",
    },
    pipl: {
      keywords: ["pipl", "donnée", "data", "privacy"],
      title: "ðŸ‡¨ðŸ‡³ PIPL â€” Personal Information Protection Law (2021)",
      content:
        "En vigueur depuis le <strong>1er novembre 2021</strong>. Portée extraterritoriale. Consentement séparé requis pour les données sensibles. <strong>Amende :</strong> jusqu'à <strong>50M RMB ou 5% du CA annuel</strong>. Transferts transfrontaliers soumis à évaluation de sécurité obligatoire (CAC).",
      source: "NPC â€” ä¸ªäººä¿¡æ¯ä¿æŠ¤æ³•",
      url: "npc.gov.cn",
    },
    dsl: {
      keywords: ["dsl", "sécurité", "securite", "cybersécurité"],
      title: "ðŸ‡¨ðŸ‡³ DSL â€” Data Security Law (2021)",
      content:
        "La Loi sur la Sécurité des Données (DSL) classe les données par niveau d'importance (national, important, général). Les données « importantes » et « nationales » exigent des évaluations de risque et des stockages localisés.",
      source: "NPC â€” æ•°æ®å®‰å…¨æ³•",
      url: "npc.gov.cn",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡®ðŸ‡³ INDE â€” Source : India Code (indiacode.nic.in)
  // ═══════════════════════════════════════════════════════════════
  india: {
    _flag: "ðŸ‡®ðŸ‡³",
    _name: "Inde",
    _source: "India Code â€” indiacode.nic.in",
    _keywords: ["inde", "indien", "india", "hindi"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡®ðŸ‡³ Casque Moto â€” Motor Vehicles Act 1988 §129",
      content:
        "Le port du casque homologué <strong>ISI (BIS)</strong> est obligatoire pour le conducteur et le passager. Norme : <strong>IS 4151:2015</strong>.<br><strong>Sanction :</strong> â‚¹1.000 d'amende + suspension du permis (3 mois).<br>Exception : Les Sikhs portant un turban sont exemptés dans certains États.",
      source: "India Code â€” Motor Vehicles Act 1988 §129",
      url: "indiacode.nic.in",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "ðŸ‡®ðŸ‡³ Permis Moto â€” Motor Vehicles Act §3",
      content:
        "Deux catégories :<br>• <strong>MCWG</strong> (Motor Cycle With Gear) : Moto avec vitesses<br>• <strong>MCWOG</strong> : Scooter sans vitesses<br>Ã‚ge minimum : <strong>18 ans</strong> (16 ans pour les â‰¤50cc dans certains États).",
      source: "India Code â€” Motor Vehicles Act 1988",
      url: "indiacode.nic.in",
    },
    dpdp: {
      keywords: ["dpdp", "donnée", "data", "privacy"],
      title: "ðŸ‡®ðŸ‡³ DPDP â€” Digital Personal Data Protection Act 2023",
      content:
        "En vigueur depuis <strong>2023</strong>. Droits des « Data Principals » : consentement, rectification, effacement. Possibilité de nommer un représentant légal. <strong>Amende :</strong> jusqu'à <strong>â‚¹250 crore</strong> (â‰ˆ 27M€). Supervision par le Data Protection Board of India.",
      source: "MeitY â€” meity.gov.in",
      url: "meity.gov.in",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡§ðŸ‡· BRÉSIL â€” Source : Planalto (planalto.gov.br)
  // ═══════════════════════════════════════════════════════════════
  brazil: {
    _flag: "ðŸ‡§ðŸ‡·",
    _name: "Brésil",
    _source: "Planalto â€” planalto.gov.br",
    _keywords: ["brésil", "bresil", "brazil", "brésilien", "bresilien"],

    casque: {
      keywords: ["casque", "capacete", "helmet"],
      title: "ðŸ‡§ðŸ‡· Casque Moto â€” CTB Art.244 (Lei 9.503/1997)",
      content:
        "Le port du casque homologué <strong>INMETRO</strong> est obligatoire pour le conducteur et le passager de moto. Le viseur est aussi obligatoire.<br><strong>Sanction :</strong> Infraction grave â€” <strong>R$293,47</strong> + 7 points sur le CNH + rétention du véhicule.",
      source: "Planalto â€” Lei 9.503/1997 (CTB) Art.244",
      url: "planalto.gov.br",
    },
    cnh: {
      keywords: ["permis", "cnh", "conduire", "licence"],
      title: "ðŸ‡§ðŸ‡· Permis Moto (CNH) â€” CTB Art.140",
      content:
        "Catégorie <strong>A</strong> obligatoire pour les 2-roues. Ã‚ge minimum : <strong>18 ans</strong>. Formation obligatoire incluant cours théoriques (45h) et pratiques (20h). Système de points : <strong>40 pts/an = suspension</strong>.",
      source: "Planalto â€” Lei 9.503/1997 (CTB)",
      url: "planalto.gov.br",
    },
    lgpd: {
      keywords: ["lgpd", "donnée", "data", "privacy"],
      title: "ðŸ‡§ðŸ‡· LGPD â€” Lei Geral de ProteçÃ£o de Dados (13.709/2018)",
      content:
        "La LGPD est le « RGPD brésilien ». En vigueur depuis <strong>septembre 2020</strong>. Supervisée par l'<strong>ANPD</strong> (Autoridade Nacional de ProteçÃ£o de Dados). <strong>Amende :</strong> jusqu'à <strong>2% du CA au Brésil</strong>, plafonnée à R$50M par infraction.",
      source: "Planalto â€” Lei 13.709/2018",
      url: "planalto.gov.br",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¸ðŸ‡¬ SINGAPOUR â€” Source : Singapore Statutes Online (sso.agc.gov.sg)
  // ═══════════════════════════════════════════════════════════════
  singapore: {
    _flag: "ðŸ‡¸ðŸ‡¬",
    _name: "Singapour",
    _source: "Singapore Statutes Online â€” sso.agc.gov.sg",
    _keywords: ["singapour", "singapore"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¸ðŸ‡¬ Casque Moto â€” Road Traffic Act §22A",
      content:
        "Le casque homologué <strong>PSB/Spring SG</strong> (ou UN R22) est obligatoire. <br><strong>Sanction :</strong> Amende jusqu'à <strong>S$1.000</strong> et/ou 3 mois de prison.",
      source: "SSO â€” Road Traffic Act (Cap. 276)",
      url: "sso.agc.gov.sg",
    },
    pdpa: {
      keywords: ["pdpa", "donnée", "data", "privacy"],
      title: "ðŸ‡¸ðŸ‡¬ PDPA â€” Personal Data Protection Act 2012",
      content:
        "Supervisée par la <strong>PDPC</strong>. Consentement éclairé obligatoire. Droit d'accès et de correction rapide.<br><strong>Amende :</strong> jusqu'à <strong>S$1M ou 10% du CA annuel</strong> (depuis la révision 2020).",
      source: "SSO â€” PDPA (No.26 of 2012)",
      url: "sso.agc.gov.sg",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¿ðŸ‡¦ AFRIQUE DU SUD â€” Source : gov.za
  // ═══════════════════════════════════════════════════════════════
  south_africa: {
    _flag: "ðŸ‡¿ðŸ‡¦",
    _name: "Afrique du Sud",
    _source: "Government of South Africa â€” gov.za",
    _keywords: ["afrique du sud", "south africa", "sud-africain"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¿ðŸ‡¦ Casque Moto â€” NRTA 93/1996 §98",
      content:
        "Le port du casque homologué <strong>SABS (SANS 55)</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues.<br><strong>Sanction :</strong> Amende et points de démérite.",
      source: "gov.za â€” National Road Traffic Act 93 of 1996",
      url: "gov.za",
    },
    popia: {
      keywords: ["popia", "donnée", "data", "privacy"],
      title: "ðŸ‡¿ðŸ‡¦ POPIA â€” Protection of Personal Information Act 4/2013",
      content:
        "En vigueur depuis <strong>juillet 2021</strong>. L'<strong>Information Regulator</strong> est l'autorité de contrôle. Traitement licite et raisonnable obligatoire. Droit d'accès, de correction, et de suppression.<br><strong>Amende :</strong> jusqu'à <strong>R10M</strong> et/ou 10 ans de prison.",
      source: "Information Regulator â€” inforegulator.org.za",
      url: "inforegulator.org.za",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡³ðŸ‡¬ NIGÉRIA â€” Source : FRSC / NITDA
  // ═══════════════════════════════════════════════════════════════
  nigeria: {
    _flag: "ðŸ‡³ðŸ‡¬",
    _name: "Nigéria",
    _source: "FRSC â€” frsc.gov.ng | NITDA â€” nitda.gov.ng",
    _keywords: ["nigéria", "nigeria"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡³ðŸ‡¬ Casque Moto â€” Highway Code / FRSC",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de motos (<em>Okada</em>). Réglementation appliquée par le <strong>FRSC</strong> (Federal Road Safety Corps).<br><strong>Sanction :</strong> â‚¦2.000 d'amende.",
      source: "FRSC â€” frsc.gov.ng",
      url: "frsc.gov.ng",
    },
    ndpr: {
      keywords: ["ndpr", "ndpa", "donnée", "data", "privacy"],
      title: "ðŸ‡³ðŸ‡¬ NDPA â€” Nigeria Data Protection Act 2023",
      content:
        "Remplace le NDPR de 2019. Crée la <strong>NDPC</strong> (Nigeria Data Protection Commission) comme autorité indépendante. Consentement obligatoire. Notifications de violation sous <strong>72h</strong>.<br><strong>Amende :</strong> jusqu'à <strong>2% du CA mondial</strong> ou â‚¦10M.",
      source: "NITDA â€” nitda.gov.ng",
      url: "nitda.gov.ng",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡²ðŸ‡¦ MAROC â€” Source : Bulletin Officiel (sgg.gov.ma)
  // ═══════════════════════════════════════════════════════════════
  morocco: {
    _flag: "ðŸ‡²ðŸ‡¦",
    _name: "Maroc",
    _source: "Bulletin Officiel â€” sgg.gov.ma | Fiscamaroc",
    _keywords: ["maroc", "marocain", "morocco", "maghreb"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡²ðŸ‡¦ Casque Moto â€” Loi n°52-05 (Code de la Route)",
      content:
        "Le port du casque homologué est obligatoire pour les conducteurs et passagers de 2-roues motorisés.<br><strong>Sanction :</strong> Amende de <strong>400 à 700 DH</strong>, immobilisation du véhicule, et retrait de permis possible.",
      source: "Bulletin Officiel â€” Loi n°52-05 portant Code de la Route",
      url: "sgg.gov.ma",
    },
    permis: {
      keywords: ["permis", "conduire"],
      title: "ðŸ‡²ðŸ‡¦ Permis Moto â€” Loi n°52-05",
      content:
        "Catégories :<br>• <strong>A1</strong> : Cyclomoteur â‰¤ 50cc (16+)<br>• <strong>A</strong> : Toute moto (18+)<br>Système de permis à points depuis 2010.",
      source: "Bulletin Officiel â€” Code de la Route",
      url: "sgg.gov.ma",
    },
    loi_0908: {
      keywords: ["donnée", "data", "privacy", "cndp"],
      title: "ðŸ‡²ðŸ‡¦ Loi n°09-08 â€” Protection des Données Personnelles",
      content:
        "En vigueur depuis <strong>2009</strong>. Supervisée par la <strong>CNDP</strong> (Commission Nationale de Contrôle de la Protection des Données). Inspirée du modèle français (CNIL). Droits d'accès, de rectification et d'opposition.",
      source: "Bulletin Officiel â€” Loi n°09-08",
      url: "cndp.ma",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¹ðŸ‡­ THAÃLANDE â€” Source : Royal Thai Police
  // ═══════════════════════════════════════════════════════════════
  thailand: {
    _flag: "ðŸ‡¹ðŸ‡­",
    _name: "Thaïlande",
    _source: "Royal Thai Police â€” royalthaipolice.go.th",
    _keywords: ["thaïlande", "thailande", "thailand", "thai"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¹ðŸ‡­ Casque Moto â€” Land Traffic Act B.E.2522 (1979)",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de moto. Norme : <strong>TIS 369</strong> (Thai Industrial Standard).<br><strong>Sanction :</strong> Amende de <strong>500 THB</strong>.",
      source: "Royal Thai Police â€” Land Traffic Act B.E.2522",
      url: "royalthaipolice.go.th",
    },
    pdpa_th: {
      keywords: ["pdpa", "donnée", "data", "privacy"],
      title: "ðŸ‡¹ðŸ‡­ PDPA â€” Personal Data Protection Act B.E.2562 (2019)",
      content:
        "En vigueur depuis <strong>juin 2022</strong>. Très inspirée du RGPD. Consentement explicite requis pour les données sensibles. <strong>Amende :</strong> jusqu'à <strong>5M THB</strong> + sanctions pénales (1 an de prison et/ou 1M THB).",
      source: "PDPA Thailand â€” pdpathailand.com",
      url: "pdpathailand.com",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¦ðŸ‡º AUSTRALIE â€” Source : Federal Register of Legislation
  // ═══════════════════════════════════════════════════════════════
  australia: {
    _flag: "ðŸ‡¦ðŸ‡º",
    _name: "Australie",
    _source: "Federal Register of Legislation â€” legislation.gov.au",
    _keywords: ["australie", "australia", "australien"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¦ðŸ‡º Casque Moto â€” Australian Road Rules Rule 270",
      content:
        "Le port du casque homologué <strong>AS/NZS 1698:2006</strong> (ou UNECE R22) est obligatoire dans tous les États et Territoires.<br><strong>Sanction :</strong> Varie par État. Ex NSW : <strong>A$349</strong> + 3 points de démérite.",
      source: "legislation.gov.au â€” Australian Road Rules",
      url: "legislation.gov.au",
    },
    privacy_act: {
      keywords: ["privacy", "donnée", "data"],
      title: "ðŸ‡¦ðŸ‡º Privacy Act 1988 â€” Protection des Données",
      content:
        "Supervisée par l'<strong>OAIC</strong> (Office of the Australian Information Commissioner). Les 13 <strong>Australian Privacy Principles (APPs)</strong> régissent la collecte, l'utilisation et la sécurité des données.<br><strong>Amende :</strong> jusqu'à <strong>A$50M</strong>, 3Ã— le bénéfice obtenu, ou 30% du CA (le plus élevé).",
      source: "legislation.gov.au â€” Privacy Act 1988",
      url: "legislation.gov.au",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ðŸ‡¨ðŸ‡¦ CANADA â€” Source : Justice Laws (laws-lois.justice.gc.ca)
  // ═══════════════════════════════════════════════════════════════
  canada: {
    _flag: "ðŸ‡¨ðŸ‡¦",
    _name: "Canada",
    _source: "Justice Laws â€” laws-lois.justice.gc.ca",
    _keywords: ["canada", "canadien", "québec", "quebec"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¨ðŸ‡¦ Casque Moto â€” Highway Traffic Act (Provincial)",
      content:
        "Le casque est obligatoire dans <strong>toutes les provinces</strong>. Normes acceptées : <strong>DOT (FMVSS 218)</strong>, <strong>Snell</strong>, <strong>ECE 22.05/22.06</strong>.<br><strong>Sanction :</strong> Varie par province. Ontario : <strong>C$110</strong>.",
      source: "laws-lois.justice.gc.ca + HTA provincial",
      url: "laws-lois.justice.gc.ca",
    },
    pipeda: {
      keywords: ["pipeda", "donnée", "data", "privacy"],
      title: "ðŸ‡¨ðŸ‡¦ PIPEDA â€” Personal Information Protection Act",
      content:
        "Loi fédérale sur la protection des renseignements personnels dans le secteur privé. Supervisée par le <strong>Commissariat à la protection de la vie privée</strong>. Remplacée progressivement au Québec par la <strong>Loi 25</strong> (2023).<br><strong>Amende :</strong> jusqu'à <strong>C$100.000</strong> (PIPEDA), C$25M ou 4% du CA (Loi 25 QC).",
      source: "laws-lois.justice.gc.ca â€” PIPEDA (S.C. 2000, c.5)",
      url: "laws-lois.justice.gc.ca",
    },
  },
};

/**
 * ðŸ” Moteur de recherche dans la base juridique mondiale
 * Utilisé par PocketLawyer.processChatQuery()
 */
window.LegalDatabase.search = function (query) {
  const t = query.toLowerCase();
  const results = [];

  // 1. Identifier le(s) pays ciblé(s)
  let targetCountries = [];
  for (const [countryKey, country] of Object.entries(this)) {
    if (typeof country !== "object" || countryKey === "search") continue;
    if (country._keywords && country._keywords.some((kw) => t.includes(kw))) {
      targetCountries.push(countryKey);
    }
  }

  // Si aucun pays détecté, chercher dans tous
  if (targetCountries.length === 0) {
    targetCountries = Object.keys(this).filter(
      (k) => typeof this[k] === "object" && k !== "search",
    );
  }

  // 2. Chercher par mots-clés dans les pays ciblés
  for (const countryKey of targetCountries) {
    const country = this[countryKey];
    if (!country || typeof country !== "object") continue;

    for (const [topicKey, topic] of Object.entries(country)) {
      if (
        topicKey.startsWith("_") ||
        typeof topic !== "object" ||
        !topic.keywords
      )
        continue;
      if (topic.keywords.some((kw) => t.includes(kw))) {
        results.push({
          country: country._name,
          flag: country._flag,
          ...topic,
        });
      }
    }
  }

  return results;
};
