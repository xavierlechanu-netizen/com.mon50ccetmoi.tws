/**
 * âš–ï¸ BASE JURIDIQUE MONDIALE â€” POCKET LAWYER
 * Sources officielles gouvernementales uniquement.
 * DerniÃ¨re mise Ã  jour : 14 juillet 2026
 *
 * Structure : window.LegalDatabase[pays][thÃ¨me]
 * Chaque entrÃ©e contient : title, content, source, url
 *
 * Avertissement (AI Act UE 2024/1689) : Ces informations sont fournies
 * Ã  titre indicatif et sont soumises Ã  contrÃ´le humain.
 */

window.LegalDatabase = {
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡«ðŸ‡· FRANCE â€” Source : LÃ©gifrance (legifrance.gouv.fr)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  france: {
    _flag: "ðŸ‡«ðŸ‡·",
    _name: "France",
    _source: "LÃ©gifrance â€” legifrance.gouv.fr",
    _keywords: ["france", "franÃ§ais", "francais", "lÃ©gifrance", "legifrance"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡«ðŸ‡· Port du Casque â€” Art. R431-1 Code de la Route",
      content:
        "Le port du casque homologuÃ© <strong>ECE 22.06</strong> est obligatoire pour tout conducteur et passager de 2-roues motorisÃ©.<br><strong>Sanction :</strong> 135â‚¬ d'amende (contravention 4Ã¨me classe) + retrait de 3 points.",
      source: "LÃ©gifrance â€” Art. R431-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    debridage: {
      keywords: ["dÃ©brid", "debride", "kitÃ©", "kit"],
      title: "ðŸ‡«ðŸ‡· DÃ©bridage â€” Art. L317-5 Code de la Route",
      content:
        "Le dÃ©bridage d'un cyclomoteur est un <strong>dÃ©lit</strong>. Vous risquez <strong>135â‚¬ d'amende</strong> pour le propriÃ©taire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.",
      source: "LÃ©gifrance â€” Art. L317-5 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stupefiants: {
      keywords: ["stup", "drogue", "fumÃ©", "positif", "cannabis", "thc"],
      title: "ðŸ‡«ðŸ‡· Conduite sous StupÃ©fiants (DÃ©lit)",
      content:
        "MÃªme avec un BSR, vous risquez jusqu'Ã  <strong>4500â‚¬ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une premiÃ¨re infraction, le juge peut faire preuve de clÃ©mence si vous montrez des preuves mÃ©dicales.",
      source: "LÃ©gifrance â€” Art. L235-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    alcool: {
      keywords: ["alcool", "boire", "ivre", "alcoolÃ©mie"],
      title: "ðŸ‡«ðŸ‡· AlcoolÃ©mie â€” Art. L234-1",
      content:
        "Pour un permis probatoire ou BSR, la limite lÃ©gale est de <strong>0,2 g/L</strong>. Vous risquez l'immobilisation immÃ©diate du cyclomoteur et de fortes amendes. Au-delÃ  de 0,8 g/L : dÃ©lit pÃ©nal (2 ans de prison, 4500â‚¬).",
      source: "LÃ©gifrance â€” Art. L234-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    assurance: {
      keywords: ["assurance", "assurÃ©"],
      title: "ðŸ‡«ðŸ‡· DÃ©faut d'Assurance (DÃ©lit) â€” Art. L324-2",
      content:
        "Conduire sans assurance coÃ»te jusqu'Ã  <strong>3750â‚¬ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais <strong>vous rÃ©clamera le remboursement</strong>, potentiellement toute votre vie.",
      source: "LÃ©gifrance â€” Art. L324-2 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    fuite: {
      keywords: ["fuite", "obtempÃ©rer", "obtemperer"],
      title: "ðŸ‡«ðŸ‡· Refus d'ObtempÃ©rer / DÃ©lit de Fuite",
      content:
        "Cumuler ces dÃ©lits entraÃ®ne des peines de <strong>prison fermes</strong>, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrÃ´le de police.",
      source: "LÃ©gifrance â€” Art. L233-1 & L231-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stationnement: {
      keywords: ["stationn", "garÃ©", "parking", "trottoir", "fourriÃ¨re"],
      title: "ðŸ‡«ðŸ‡· Stationnement 2-Roues â€” Art. R417-10/11",
      content:
        "Sur un <strong>trottoir</strong> : tolÃ©rÃ© si le passage piÃ©ton (>1,50m) n'est pas entravÃ©. Sur <strong>passage piÃ©ton/piste cyclable</strong> : 135â‚¬ + fourriÃ¨re immÃ©diate. Sur <strong>place auto</strong> : tolÃ©rÃ© si vous payez le stationnement.",
      source: "LÃ©gifrance â€” Art. R417-10 et R417-11",
      url: "legifrance.gouv.fr",
    },
    rgpd: {
      keywords: [
        "rgpd",
        "gdpr",
        "donnÃ©es personnelles",
        "cnil",
        "vie privÃ©e",
      ],
      title: "ðŸ‡«ðŸ‡· RGPD â€” RÃ¨glement (UE) 2016/679",
      content:
        "La protection des donnÃ©es personnelles est rÃ©gie par le <strong>RGPD</strong> (entrÃ© en vigueur le 25 mai 2018) et la <strong>Loi Informatique et LibertÃ©s</strong> (Loi nÂ°78-17 du 6 janvier 1978). La CNIL est l'autoritÃ© de contrÃ´le franÃ§aise.<br>Droits : AccÃ¨s (Art.15), Rectification (Art.16), Effacement (Art.17), PortabilitÃ© (Art.20), Opposition (Art.21).",
      source: "LÃ©gifrance & EUR-Lex â€” RÃ¨glement (UE) 2016/679",
      url: "legifrance.gouv.fr | eur-lex.europa.eu",
    },
    retractation: {
      keywords: [
        "remboursement",
        "rÃ©tractation",
        "retractation",
        "cgv",
        "numÃ©rique",
        "digital",
      ],
      title:
        "ðŸ‡«ðŸ‡· Droit de RÃ©tractation (Contenu NumÃ©rique) â€” Art. L221-28",
      content:
        "Selon l'<strong>Article L221-28 (13Â°) du Code de la consommation</strong>, le droit de rÃ©tractation ne peut pas Ãªtre exercÃ© pour la fourniture d'un <strong>contenu numÃ©rique non fourni sur un support matÃ©riel</strong> dont l'exÃ©cution a commencÃ© aprÃ¨s accord prÃ©alable exprÃ¨s du consommateur et renoncement exprÃ¨s Ã  son droit de rÃ©tractation. Les rapports d'expertise gÃ©nÃ©rÃ©s ne sont donc <strong>pas remboursables</strong>.",
      source: "LÃ©gifrance â€” Art. L221-28 du Code de la Consommation",
      url: "legifrance.gouv.fr",
    },
    vice_cache: {
      keywords: ["vice", "cachÃ©", "cache", "panne", "arnaque", "occasion"],
      title: "ðŸ‡«ðŸ‡· Garantie des Vices CachÃ©s â€” Art. 1641 Code Civil",
      content:
        "L'<strong>Article 1641 du Code civil</strong> prÃ©cise que le vendeur est tenu de la garantie Ã  raison des dÃ©fauts cachÃ©s de la chose vendue qui la rendent impropre Ã  l'usage auquel on la destine. L'acheteur a <strong>2 ans Ã  compter de la dÃ©couverte du vice</strong> pour agir.",
      source: "LÃ©gifrance â€” Art. 1641 du Code Civil",
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
        "La <strong>Loi nÂ° 85-677 du 5 juillet 1985 (Loi Badinter)</strong> vise Ã  amÃ©liorer la situation des victimes d'accidents de la circulation et Ã  accÃ©lÃ©rer les procÃ©dures d'indemnisation. Si vous n'Ãªtes pas responsable, votre assureur doit vous indemniser intÃ©gralement de vos prÃ©judices corporels et matÃ©riels.",
      source: "LÃ©gifrance â€” Loi Badinter",
      url: "legifrance.gouv.fr",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡ªðŸ‡º UNION EUROPÃ‰ENNE â€” Source : EUR-Lex (eur-lex.europa.eu)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  eu: {
    _flag: "ðŸ‡ªðŸ‡º",
    _name: "Union EuropÃ©enne",
    _source: "EUR-Lex â€” eur-lex.europa.eu",
    _keywords: ["europe", "europÃ©en", "europeen", "ue", "eu", "eur-lex"],

    rgpd: {
      keywords: ["rgpd", "gdpr", "donnÃ©e", "privacy"],
      title: "ðŸ‡ªðŸ‡º RGPD â€” RÃ¨glement (UE) 2016/679",
      content:
        "Le RÃ¨glement GÃ©nÃ©ral sur la Protection des DonnÃ©es est le texte de rÃ©fÃ©rence en matiÃ¨re de protection des donnÃ©es personnelles dans l'UE. EntrÃ©e en vigueur : <strong>25 mai 2018</strong>.<br>Amende max : <strong>20Mâ‚¬ ou 4% du CA mondial</strong>.",
      source: "EUR-Lex â€” RÃ¨glement (UE) 2016/679",
      url: "eur-lex.europa.eu",
    },
    ai_act: {
      keywords: ["ia act", "ai act", "intelligence artificielle", "ia"],
      title: "ðŸ‡ªðŸ‡º AI Act â€” RÃ¨glement (UE) 2024/1689",
      content:
        "Premier rÃ¨glement au monde sur l'IA. En vigueur depuis le <strong>1er aoÃ»t 2024</strong>. Approche par niveaux de risque :<br>â€¢ Risque inacceptable : <strong>Interdit</strong><br>â€¢ Haut risque : ConformitÃ© stricte obligatoire<br>â€¢ Risque limitÃ© : <strong>Obligation de transparence</strong> (notre catÃ©gorie)<br>â€¢ Risque minimal : Libre<br>Application complÃ¨te prÃ©vue pour <strong>aoÃ»t 2026</strong>.",
      source: "EUR-Lex â€” RÃ¨glement (UE) 2024/1689",
      url: "eur-lex.europa.eu",
    },
    dsa: {
      keywords: ["dsa", "digital services", "modÃ©ration", "plateforme"],
      title: "ðŸ‡ªðŸ‡º DSA â€” RÃ¨glement (UE) 2022/2065",
      content:
        "Le Digital Services Act impose des obligations de <strong>modÃ©ration</strong> et de <strong>transparence</strong> aux plateformes numÃ©riques. Obligation de point de contact, mÃ©canisme de signalement (Art.16), et motivation des dÃ©cisions de modÃ©ration (Art.17).",
      source: "EUR-Lex â€” RÃ¨glement (UE) 2022/2065",
      url: "eur-lex.europa.eu",
    },
    casque_eu: {
      keywords: ["casque", "homologation", "ece", "unece"],
      title: "ðŸ‡ªðŸ‡º Homologation Casque â€” UNECE R22.06",
      content:
        "Depuis juin 2024, seuls les casques homologuÃ©s <strong>ECE 22.06</strong> peuvent Ãªtre vendus dans l'UE. Les anciens ECE 22.05 restent utilisables mais ne sont plus fabriquÃ©s.",
      source: "UNECE â€” Regulation No. 22 Rev.6",
      url: "unece.org",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡®ðŸ‡© INDONÃ‰SIE â€” Source : JDIH (jdih.kemenkumham.go.id)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  indonesia: {
    _flag: "ðŸ‡®ðŸ‡©",
    _name: "IndonÃ©sie",
    _source: "JDIH â€” jdih.kemenkumham.go.id | peraturan.bpk.go.id",
    _keywords: ["indonÃ©sie", "indonesie", "indonesia", "jdih"],

    casque: {
      keywords: ["casque", "helm", "sni"],
      title: "ðŸ‡®ðŸ‡© Casque (Helm SNI) â€” UU 22/2009 Art.106(8)",
      content:
        "Le port du casque homologuÃ© <strong>SNI</strong> (Standar Nasional Indonesia) est obligatoire pour le conducteur et le passager (Art. 57Â§2).<br><strong>Sanction :</strong> Jusqu'Ã  1 mois de prison ou <strong>Rp 250.000</strong> d'amende (Art. 291Â§1).",
      source: "JDIH â€” UU No.22 Tahun 2009 (LLAJ)",
      url: "jdih.kemenkumham.go.id",
    },
    sim: {
      keywords: ["sim", "permis", "conduire"],
      title: "ðŸ‡®ðŸ‡© Permis de conduire (SIM) â€” UU 22/2009 Art.77",
      content:
        "Tout conducteur doit possÃ©der un SIM correspondant Ã  son vÃ©hicule :<br>â€¢ <strong>SIM C</strong> : Moto â‰¤ 250cc<br>â€¢ <strong>SIM CI</strong> : Moto 250-500cc<br>â€¢ <strong>SIM CII</strong> : Moto > 500cc<br><strong>Sans SIM :</strong> 3 mois prison ou Rp 1.000.000 (Art.281).<br><strong>SIM non prÃ©sentÃ© :</strong> 1 mois ou Rp 250.000 (Art.288Â§2).",
      source: "JDIH â€” UU No.22 Tahun 2009",
      url: "jdih.kemenkumham.go.id",
    },
    code_route: {
      keywords: ["route", "lalu lintas", "circulation", "code"],
      title: "ðŸ‡®ðŸ‡© Code de la Route â€” UU No.22 Tahun 2009 (LLAJ)",
      content:
        "La loi sur la Circulation et les Transports Routiers rÃ©git l'ensemble du trafic en IndonÃ©sie. Obligations pour les 2-roues :<br>â€¢ Casque SNI obligatoire (Art.106Â§8)<br>â€¢ RÃ©troviseurs, feux, klaxon, compteur (Art.285Â§1)<br>â€¢ SIM C obligatoire (Art.77)<br>â€¢ STNK Ã  jour (Perpol 7/2021)",
      source: "JDIH â€” Kementerian Perhubungan",
      url: "jdih.kemenkumham.go.id",
    },
    stnk: {
      keywords: ["stnk", "enregistrement", "immatriculation", "pajak"],
      title: "ðŸ‡®ðŸ‡© Immatriculation (STNK) â€” Perpol 7/2021",
      content:
        "Le STNK est le certificat d'immatriculation obligatoire. Si le STNK expire et n'est pas renouvelÃ© sous <strong>2 ans</strong>, les donnÃ©es du vÃ©hicule sont radiÃ©es.<br><strong>Opsen Pajak (2025) :</strong> Taxe additionnelle sur le PKB et BBN-KB (UU 1/2022).<br>Depuis 2026, le NIK (KTP) est intÃ©grÃ© au SIM.",
      source: "JDIH â€” Korlantas Polri",
      url: "korlantas.polri.go.id",
    },
    pdp: {
      keywords: ["data", "donnÃ©e", "pdp", "pribadi", "privÃ©e"],
      title: "ðŸ‡®ðŸ‡© Protection des DonnÃ©es â€” UU No.27/2022 (UU PDP)",
      content:
        "En vigueur depuis le <strong>17 octobre 2024</strong>. PortÃ©e extraterritoriale.<br><strong>Sanctions admin. (Art.57) :</strong> Jusqu'Ã  <strong>2% du CA annuel</strong>.<br><strong>Sanctions pÃ©nales :</strong> 4-6 ans de prison + Rp 4-6 milliards.<br><strong>Korporasi :</strong> Amende Ã—10 + gel/dissolution.",
      source: "JDIH â€” Komdigi (ex-Kominfo)",
      url: "jdih.kemenkumham.go.id",
    },
    contrat: {
      keywords: ["contrat"],
      title: "ðŸ‡®ðŸ‡© Droit des Contrats",
      content:
        "RÃ©gi par le <strong>Code civil indonÃ©sien</strong> (KUH Perdata), hÃ©ritÃ© du droit romano-hollandais. L'IndonÃ©sie n'a <strong>pas ratifiÃ©</strong> la Convention de Vienne (CISG).",
      source: "JDIH â€” peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    hierarchie: {
      keywords: ["hiÃ©rarchie", "constitution", "norme", "loi"],
      title: "ðŸ‡®ðŸ‡© HiÃ©rarchie des Normes â€” UU No.10/2004",
      content:
        "SystÃ¨me mixte (adat / romano-hollandais / national / musulman Ã  Aceh).<br>1. <strong>UUD 1945</strong> â€” Constitution<br>2. <strong>UU</strong> â€” Lois du Parlement<br>3. <strong>PP</strong> â€” RÃ¨glements gouvernementaux<br>4. <strong>Perpres</strong> â€” DÃ©crets prÃ©sidentiels<br>5. <strong>Perda</strong> â€” RÃ¨glements rÃ©gionaux",
      source: "JDIH â€” jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    immobilier: {
      keywords: ["immobilier", "terre", "agraire", "hak"],
      title: "ðŸ‡®ðŸ‡© Droit Immobilier â€” Loi Agraire nÂ°5/1960 (UUPA)",
      content:
        "Les Ã©trangers ne peuvent possÃ©der de terres directement (<strong>Hak Milik</strong>), mais peuvent acquÃ©rir des droits d'usage (<strong>Hak Pakai</strong>) ou investir via des sociÃ©tÃ©s (<strong>PT PMA</strong>).",
      source: "JDIH â€” peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    travail: {
      keywords: ["travail", "licenciement", "emploi"],
      title: "ðŸ‡®ðŸ‡© Droit du Travail â€” UU 13/2003 & Omnibus 11/2020",
      content:
        "Loi nÂ°13/2003 = texte principal. ModifiÃ©e par la <strong>loi omnibus nÂ°11/2020</strong> (Cipta Kerja) pour faciliter l'investissement (contrats, licenciements, heures supplÃ©mentaires).",
      source: "JDIH â€” jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    langue: {
      keywords: ["langue", "Ã©ducation", "media", "bahasa"],
      title: "ðŸ‡®ðŸ‡© RÃ©glementation Linguistique â€” UU 20/2003 & 32/2002",
      content:
        "L'indonÃ©sien (<em>Bahasa Indonesia</em>) est la langue officielle de l'Ã©ducation et des mÃ©dias. Les langues rÃ©gionales et Ã©trangÃ¨res sont autorisÃ©es sous conditions.",
      source: "JDIH â€” Kemendikbudristek",
      url: "jdih.kemenkumham.go.id",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡ºðŸ‡¸ Ã‰TATS-UNIS â€” Sources : NHTSA, IIHS, Cornell LII
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  usa: {
    _flag: "ðŸ‡ºðŸ‡¸",
    _name: "Ã‰tats-Unis",
    _source: "NHTSA (nhtsa.gov) | Cornell LII (law.cornell.edu)",
    _keywords: [
      "usa",
      "Ã©tats-unis",
      "etats-unis",
      "amÃ©rique",
      "amerique",
      "amÃ©ricain",
      "americain",
      "united states",
    ],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡ºðŸ‡¸ Casque Moto â€” FMVSS 218 (NHTSA)",
      content:
        "La norme fÃ©dÃ©rale est le <strong>FMVSS 218</strong> (Federal Motor Vehicle Safety Standard). <strong>Attention :</strong> la loi varie par Ã‰tat !<br>â€¢ <strong>Universal law</strong> (19 Ã‰tats) : Casque obligatoire pour tous<br>â€¢ <strong>Partial law</strong> (28 Ã‰tats) : Obligatoire seulement pour les <18 ou <21 ans<br>â€¢ <strong>No law</strong> (3 Ã‰tats) : Illinois, Iowa, New Hampshire",
      source: "NHTSA â€” nhtsa.gov | IIHS â€” iihs.org",
      url: "nhtsa.gov",
    },
    assurance: {
      keywords: ["assurance", "insurance"],
      title: "ðŸ‡ºðŸ‡¸ Assurance Moto â€” RÃ©glementation par Ã‰tat",
      content:
        "L'assurance moto est obligatoire dans <strong>48 des 50 Ã‰tats</strong> (sauf Floride et Montana pour la responsabilitÃ© civile). Les minimums de couverture varient considÃ©rablement par Ã‰tat. En Californie : 15/30/5 (en milliers de $).",
      source: "NHTSA â€” nhtsa.gov",
      url: "nhtsa.gov",
    },
    ccpa: {
      keywords: ["ccpa", "cpra", "california", "donnÃ©e", "privacy"],
      title: "ðŸ‡ºðŸ‡¸ CCPA/CPRA â€” Protection des DonnÃ©es (Californie)",
      content:
        "Le <strong>CCPA</strong> (California Consumer Privacy Act, 2020) et son amendement <strong>CPRA</strong> offrent aux rÃ©sidents californiens des droits proches du RGPD : droit de savoir, de suppression, de refus de vente. <strong>Amende :</strong> $2.500/violation, $7.500/violation intentionnelle.",
      source: "State of California â€” oag.ca.gov",
      url: "oag.ca.gov",
    },
    coppa: {
      keywords: ["coppa", "mineur", "enfant"],
      title: "ðŸ‡ºðŸ‡¸ COPPA â€” Protection des Mineurs en Ligne",
      content:
        "La <strong>Children's Online Privacy Protection Act</strong> interdit la collecte de donnÃ©es personnelles d'enfants de moins de 13 ans sans consentement parental vÃ©rifiable. <strong>Amende :</strong> jusqu'Ã  $50.120/violation (FTC).",
      source: "FTC â€” ftc.gov",
      url: "ftc.gov",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¬ðŸ‡§ ROYAUME-UNI â€” Source : legislation.gov.uk
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
      title: "ðŸ‡¬ðŸ‡§ Casque Moto â€” Road Traffic Act 1988 Â§16",
      content:
        "Le port du casque homologuÃ© <strong>BS 6658:1985</strong> ou <strong>UNECE R22.05/22.06</strong> est obligatoire. Les Sikhs portant un turban sont exemptÃ©s (Â§16Â§2).<br><strong>Sanction :</strong> Fixed Penalty Notice de <strong>Â£100</strong>.",
      source: "legislation.gov.uk â€” Road Traffic Act 1988 Â§16",
      url: "legislation.gov.uk",
    },
    permis: {
      keywords: ["permis", "licence", "cbt"],
      title: "ðŸ‡¬ðŸ‡§ Permis Moto â€” CBT / A1 / A2 / A",
      content:
        "Formation obligatoire : <strong>CBT</strong> (Compulsory Basic Training). CatÃ©gories :<br>â€¢ <strong>AM</strong> : Cyclomoteur â‰¤ 50cc<br>â€¢ <strong>A1</strong> : â‰¤ 125cc (16+)<br>â€¢ <strong>A2</strong> : â‰¤ 35kW (19+)<br>â€¢ <strong>A</strong> : IllimitÃ© (24+ ou 21+ avec 2 ans d'A2)",
      source: "GOV.UK â€” gov.uk/motorcycle-licence",
      url: "gov.uk",
    },
    uk_gdpr: {
      keywords: ["gdpr", "donnÃ©e", "ico", "privacy", "data"],
      title: "ðŸ‡¬ðŸ‡§ UK GDPR & Data Protection Act 2018",
      content:
        "Post-Brexit, le Royaume-Uni a conservÃ© les principes du RGPD via le <strong>UK GDPR</strong> et le <strong>Data Protection Act 2018</strong>. L'autoritÃ© de contrÃ´le est l'<strong>ICO</strong> (Information Commissioner's Office). Amende max : <strong>Â£17.5M ou 4% du CA</strong>.",
      source: "legislation.gov.uk â€” Data Protection Act 2018",
      url: "legislation.gov.uk",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¯ðŸ‡µ JAPON â€” Source : Japanese Law Translation (japaneselawtranslation.go.jp)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  japan: {
    _flag: "ðŸ‡¯ðŸ‡µ",
    _name: "Japon",
    _source: "Japanese Law Translation â€” japaneselawtranslation.go.jp",
    _keywords: ["japon", "japonais", "japan", "nippon"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¯ðŸ‡µ Casque Moto â€” Road Traffic Act Art.71-4",
      content:
        "Le port du casque homologuÃ© <strong>PSC/SG</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues. Les casques doivent porter le marquage <strong>PSCãƒžãƒ¼ã‚¯</strong>.<br>Norme : <strong>JIS T 8133</strong>.",
      source: "Japanese Law Translation â€” Road Traffic Act (é“è·¯äº¤é€šæ³•)",
      url: "japaneselawtranslation.go.jp",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "ðŸ‡¯ðŸ‡µ Permis Moto (å…è¨±) â€” Road Traffic Act",
      content:
        "CatÃ©gories :<br>â€¢ <strong>åŽŸä»˜</strong> (Gentsuki) : â‰¤ 50cc (16+)<br>â€¢ <strong>å°åž‹</strong> : â‰¤ 125cc<br>â€¢ <strong>æ™®é€š</strong> : â‰¤ 400cc<br>â€¢ <strong>å¤§åž‹</strong> : IllimitÃ© (18+)<br>Examen pratique obligatoire en circuit fermÃ©.",
      source: "Japanese Law Translation â€” é“è·¯äº¤é€šæ³•",
      url: "japaneselawtranslation.go.jp",
    },
    appi: {
      keywords: ["appi", "donnÃ©e", "data", "ppc", "privacy"],
      title: "ðŸ‡¯ðŸ‡µ APPI â€” Act on Protection of Personal Information",
      content:
        "RÃ©visÃ©e en 2022. L'APPI est supervisÃ©e par la <strong>PPC</strong> (Personal Information Protection Commission). Le Japon bÃ©nÃ©ficie d'une <strong>dÃ©cision d'adÃ©quation</strong> avec l'UE (RGPD). Transferts transfrontaliers strictement encadrÃ©s.",
      source: "PPC â€” ppc.go.jp",
      url: "ppc.go.jp",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¨ðŸ‡³ CHINE â€” Source : NPC (npc.gov.cn)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  china: {
    _flag: "ðŸ‡¨ðŸ‡³",
    _name: "Chine",
    _source: "NPC â€” npc.gov.cn | AssemblÃ©e Nationale Populaire",
    _keywords: ["chine", "chinois", "china", "pÃ©kin", "beijing"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¨ðŸ‡³ Casque Moto â€” Campagne Â« Un casque, une ceinture Â»",
      content:
        "Depuis la campagne nationale de 2020, le port du casque est obligatoire pour les conducteurs et passagers de 2-roues dans toute la Chine. Norme obligatoire : <strong>GB 811-2022</strong> (mise Ã  jour de la norme nationale).",
      source: "NPC â€” Road Traffic Safety Law (é“è·¯äº¤é€šå®‰å…¨æ³•)",
      url: "npc.gov.cn",
    },
    pipl: {
      keywords: ["pipl", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¨ðŸ‡³ PIPL â€” Personal Information Protection Law (2021)",
      content:
        "En vigueur depuis le <strong>1er novembre 2021</strong>. PortÃ©e extraterritoriale. Consentement sÃ©parÃ© requis pour les donnÃ©es sensibles. <strong>Amende :</strong> jusqu'Ã  <strong>50M RMB ou 5% du CA annuel</strong>. Transferts transfrontaliers soumis Ã  Ã©valuation de sÃ©curitÃ© obligatoire (CAC).",
      source: "NPC â€” ä¸ªäººä¿¡æ¯ä¿æŠ¤æ³•",
      url: "npc.gov.cn",
    },
    dsl: {
      keywords: ["dsl", "sÃ©curitÃ©", "securite", "cybersÃ©curitÃ©"],
      title: "ðŸ‡¨ðŸ‡³ DSL â€” Data Security Law (2021)",
      content:
        "La Loi sur la SÃ©curitÃ© des DonnÃ©es (DSL) classe les donnÃ©es par niveau d'importance (national, important, gÃ©nÃ©ral). Les donnÃ©es Â« importantes Â» et Â« nationales Â» exigent des Ã©valuations de risque et des stockages localisÃ©s.",
      source: "NPC â€” æ•°æ®å®‰å…¨æ³•",
      url: "npc.gov.cn",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡®ðŸ‡³ INDE â€” Source : India Code (indiacode.nic.in)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  india: {
    _flag: "ðŸ‡®ðŸ‡³",
    _name: "Inde",
    _source: "India Code â€” indiacode.nic.in",
    _keywords: ["inde", "indien", "india", "hindi"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡®ðŸ‡³ Casque Moto â€” Motor Vehicles Act 1988 Â§129",
      content:
        "Le port du casque homologuÃ© <strong>ISI (BIS)</strong> est obligatoire pour le conducteur et le passager. Norme : <strong>IS 4151:2015</strong>.<br><strong>Sanction :</strong> â‚¹1.000 d'amende + suspension du permis (3 mois).<br>Exception : Les Sikhs portant un turban sont exemptÃ©s dans certains Ã‰tats.",
      source: "India Code â€” Motor Vehicles Act 1988 Â§129",
      url: "indiacode.nic.in",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "ðŸ‡®ðŸ‡³ Permis Moto â€” Motor Vehicles Act Â§3",
      content:
        "Deux catÃ©gories :<br>â€¢ <strong>MCWG</strong> (Motor Cycle With Gear) : Moto avec vitesses<br>â€¢ <strong>MCWOG</strong> : Scooter sans vitesses<br>Ã‚ge minimum : <strong>18 ans</strong> (16 ans pour les â‰¤50cc dans certains Ã‰tats).",
      source: "India Code â€” Motor Vehicles Act 1988",
      url: "indiacode.nic.in",
    },
    dpdp: {
      keywords: ["dpdp", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡®ðŸ‡³ DPDP â€” Digital Personal Data Protection Act 2023",
      content:
        "En vigueur depuis <strong>2023</strong>. Droits des Â« Data Principals Â» : consentement, rectification, effacement. PossibilitÃ© de nommer un reprÃ©sentant lÃ©gal. <strong>Amende :</strong> jusqu'Ã  <strong>â‚¹250 crore</strong> (â‰ˆ 27Mâ‚¬). Supervision par le Data Protection Board of India.",
      source: "MeitY â€” meity.gov.in",
      url: "meity.gov.in",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡§ðŸ‡· BRÃ‰SIL â€” Source : Planalto (planalto.gov.br)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  brazil: {
    _flag: "ðŸ‡§ðŸ‡·",
    _name: "BrÃ©sil",
    _source: "Planalto â€” planalto.gov.br",
    _keywords: ["brÃ©sil", "bresil", "brazil", "brÃ©silien", "bresilien"],

    casque: {
      keywords: ["casque", "capacete", "helmet"],
      title: "ðŸ‡§ðŸ‡· Casque Moto â€” CTB Art.244 (Lei 9.503/1997)",
      content:
        "Le port du casque homologuÃ© <strong>INMETRO</strong> est obligatoire pour le conducteur et le passager de moto. Le viseur est aussi obligatoire.<br><strong>Sanction :</strong> Infraction grave â€” <strong>R$293,47</strong> + 7 points sur le CNH + rÃ©tention du vÃ©hicule.",
      source: "Planalto â€” Lei 9.503/1997 (CTB) Art.244",
      url: "planalto.gov.br",
    },
    cnh: {
      keywords: ["permis", "cnh", "conduire", "licence"],
      title: "ðŸ‡§ðŸ‡· Permis Moto (CNH) â€” CTB Art.140",
      content:
        "CatÃ©gorie <strong>A</strong> obligatoire pour les 2-roues. Ã‚ge minimum : <strong>18 ans</strong>. Formation obligatoire incluant cours thÃ©oriques (45h) et pratiques (20h). SystÃ¨me de points : <strong>40 pts/an = suspension</strong>.",
      source: "Planalto â€” Lei 9.503/1997 (CTB)",
      url: "planalto.gov.br",
    },
    lgpd: {
      keywords: ["lgpd", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡§ðŸ‡· LGPD â€” Lei Geral de ProteÃ§Ã£o de Dados (13.709/2018)",
      content:
        "La LGPD est le Â« RGPD brÃ©silien Â». En vigueur depuis <strong>septembre 2020</strong>. SupervisÃ©e par l'<strong>ANPD</strong> (Autoridade Nacional de ProteÃ§Ã£o de Dados). <strong>Amende :</strong> jusqu'Ã  <strong>2% du CA au BrÃ©sil</strong>, plafonnÃ©e Ã  R$50M par infraction.",
      source: "Planalto â€” Lei 13.709/2018",
      url: "planalto.gov.br",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¸ðŸ‡¬ SINGAPOUR â€” Source : Singapore Statutes Online (sso.agc.gov.sg)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  singapore: {
    _flag: "ðŸ‡¸ðŸ‡¬",
    _name: "Singapour",
    _source: "Singapore Statutes Online â€” sso.agc.gov.sg",
    _keywords: ["singapour", "singapore"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¸ðŸ‡¬ Casque Moto â€” Road Traffic Act Â§22A",
      content:
        "Le casque homologuÃ© <strong>PSB/Spring SG</strong> (ou UN R22) est obligatoire. <br><strong>Sanction :</strong> Amende jusqu'Ã  <strong>S$1.000</strong> et/ou 3 mois de prison.",
      source: "SSO â€” Road Traffic Act (Cap. 276)",
      url: "sso.agc.gov.sg",
    },
    pdpa: {
      keywords: ["pdpa", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¸ðŸ‡¬ PDPA â€” Personal Data Protection Act 2012",
      content:
        "SupervisÃ©e par la <strong>PDPC</strong>. Consentement Ã©clairÃ© obligatoire. Droit d'accÃ¨s et de correction rapide.<br><strong>Amende :</strong> jusqu'Ã  <strong>S$1M ou 10% du CA annuel</strong> (depuis la rÃ©vision 2020).",
      source: "SSO â€” PDPA (No.26 of 2012)",
      url: "sso.agc.gov.sg",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¿ðŸ‡¦ AFRIQUE DU SUD â€” Source : gov.za
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  south_africa: {
    _flag: "ðŸ‡¿ðŸ‡¦",
    _name: "Afrique du Sud",
    _source: "Government of South Africa â€” gov.za",
    _keywords: ["afrique du sud", "south africa", "sud-africain"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¿ðŸ‡¦ Casque Moto â€” NRTA 93/1996 Â§98",
      content:
        "Le port du casque homologuÃ© <strong>SABS (SANS 55)</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues.<br><strong>Sanction :</strong> Amende et points de dÃ©mÃ©rite.",
      source: "gov.za â€” National Road Traffic Act 93 of 1996",
      url: "gov.za",
    },
    popia: {
      keywords: ["popia", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¿ðŸ‡¦ POPIA â€” Protection of Personal Information Act 4/2013",
      content:
        "En vigueur depuis <strong>juillet 2021</strong>. L'<strong>Information Regulator</strong> est l'autoritÃ© de contrÃ´le. Traitement licite et raisonnable obligatoire. Droit d'accÃ¨s, de correction, et de suppression.<br><strong>Amende :</strong> jusqu'Ã  <strong>R10M</strong> et/ou 10 ans de prison.",
      source: "Information Regulator â€” inforegulator.org.za",
      url: "inforegulator.org.za",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡³ðŸ‡¬ NIGÃ‰RIA â€” Source : FRSC / NITDA
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  nigeria: {
    _flag: "ðŸ‡³ðŸ‡¬",
    _name: "NigÃ©ria",
    _source: "FRSC â€” frsc.gov.ng | NITDA â€” nitda.gov.ng",
    _keywords: ["nigÃ©ria", "nigeria"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡³ðŸ‡¬ Casque Moto â€” Highway Code / FRSC",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de motos (<em>Okada</em>). RÃ©glementation appliquÃ©e par le <strong>FRSC</strong> (Federal Road Safety Corps).<br><strong>Sanction :</strong> â‚¦2.000 d'amende.",
      source: "FRSC â€” frsc.gov.ng",
      url: "frsc.gov.ng",
    },
    ndpr: {
      keywords: ["ndpr", "ndpa", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡³ðŸ‡¬ NDPA â€” Nigeria Data Protection Act 2023",
      content:
        "Remplace le NDPR de 2019. CrÃ©e la <strong>NDPC</strong> (Nigeria Data Protection Commission) comme autoritÃ© indÃ©pendante. Consentement obligatoire. Notifications de violation sous <strong>72h</strong>.<br><strong>Amende :</strong> jusqu'Ã  <strong>2% du CA mondial</strong> ou â‚¦10M.",
      source: "NITDA â€” nitda.gov.ng",
      url: "nitda.gov.ng",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡²ðŸ‡¦ MAROC â€” Source : Bulletin Officiel (sgg.gov.ma)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  morocco: {
    _flag: "ðŸ‡²ðŸ‡¦",
    _name: "Maroc",
    _source: "Bulletin Officiel â€” sgg.gov.ma | Fiscamaroc",
    _keywords: ["maroc", "marocain", "morocco", "maghreb"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡²ðŸ‡¦ Casque Moto â€” Loi nÂ°52-05 (Code de la Route)",
      content:
        "Le port du casque homologuÃ© est obligatoire pour les conducteurs et passagers de 2-roues motorisÃ©s.<br><strong>Sanction :</strong> Amende de <strong>400 Ã  700 DH</strong>, immobilisation du vÃ©hicule, et retrait de permis possible.",
      source: "Bulletin Officiel â€” Loi nÂ°52-05 portant Code de la Route",
      url: "sgg.gov.ma",
    },
    permis: {
      keywords: ["permis", "conduire"],
      title: "ðŸ‡²ðŸ‡¦ Permis Moto â€” Loi nÂ°52-05",
      content:
        "CatÃ©gories :<br>â€¢ <strong>A1</strong> : Cyclomoteur â‰¤ 50cc (16+)<br>â€¢ <strong>A</strong> : Toute moto (18+)<br>SystÃ¨me de permis Ã  points depuis 2010.",
      source: "Bulletin Officiel â€” Code de la Route",
      url: "sgg.gov.ma",
    },
    loi_0908: {
      keywords: ["donnÃ©e", "data", "privacy", "cndp"],
      title: "ðŸ‡²ðŸ‡¦ Loi nÂ°09-08 â€” Protection des DonnÃ©es Personnelles",
      content:
        "En vigueur depuis <strong>2009</strong>. SupervisÃ©e par la <strong>CNDP</strong> (Commission Nationale de ContrÃ´le de la Protection des DonnÃ©es). InspirÃ©e du modÃ¨le franÃ§ais (CNIL). Droits d'accÃ¨s, de rectification et d'opposition.",
      source: "Bulletin Officiel â€” Loi nÂ°09-08",
      url: "cndp.ma",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¹ðŸ‡­ THAÃLANDE â€” Source : Royal Thai Police
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  thailand: {
    _flag: "ðŸ‡¹ðŸ‡­",
    _name: "ThaÃ¯lande",
    _source: "Royal Thai Police â€” royalthaipolice.go.th",
    _keywords: ["thaÃ¯lande", "thailande", "thailand", "thai"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¹ðŸ‡­ Casque Moto â€” Land Traffic Act B.E.2522 (1979)",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de moto. Norme : <strong>TIS 369</strong> (Thai Industrial Standard).<br><strong>Sanction :</strong> Amende de <strong>500 THB</strong>.",
      source: "Royal Thai Police â€” Land Traffic Act B.E.2522",
      url: "royalthaipolice.go.th",
    },
    pdpa_th: {
      keywords: ["pdpa", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¹ðŸ‡­ PDPA â€” Personal Data Protection Act B.E.2562 (2019)",
      content:
        "En vigueur depuis <strong>juin 2022</strong>. TrÃ¨s inspirÃ©e du RGPD. Consentement explicite requis pour les donnÃ©es sensibles. <strong>Amende :</strong> jusqu'Ã  <strong>5M THB</strong> + sanctions pÃ©nales (1 an de prison et/ou 1M THB).",
      source: "PDPA Thailand â€” pdpathailand.com",
      url: "pdpathailand.com",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¦ðŸ‡º AUSTRALIE â€” Source : Federal Register of Legislation
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  australia: {
    _flag: "ðŸ‡¦ðŸ‡º",
    _name: "Australie",
    _source: "Federal Register of Legislation â€” legislation.gov.au",
    _keywords: ["australie", "australia", "australien"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¦ðŸ‡º Casque Moto â€” Australian Road Rules Rule 270",
      content:
        "Le port du casque homologuÃ© <strong>AS/NZS 1698:2006</strong> (ou UNECE R22) est obligatoire dans tous les Ã‰tats et Territoires.<br><strong>Sanction :</strong> Varie par Ã‰tat. Ex NSW : <strong>A$349</strong> + 3 points de dÃ©mÃ©rite.",
      source: "legislation.gov.au â€” Australian Road Rules",
      url: "legislation.gov.au",
    },
    privacy_act: {
      keywords: ["privacy", "donnÃ©e", "data"],
      title: "ðŸ‡¦ðŸ‡º Privacy Act 1988 â€” Protection des DonnÃ©es",
      content:
        "SupervisÃ©e par l'<strong>OAIC</strong> (Office of the Australian Information Commissioner). Les 13 <strong>Australian Privacy Principles (APPs)</strong> rÃ©gissent la collecte, l'utilisation et la sÃ©curitÃ© des donnÃ©es.<br><strong>Amende :</strong> jusqu'Ã  <strong>A$50M</strong>, 3Ã— le bÃ©nÃ©fice obtenu, ou 30% du CA (le plus Ã©levÃ©).",
      source: "legislation.gov.au â€” Privacy Act 1988",
      url: "legislation.gov.au",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¨ðŸ‡¦ CANADA â€” Source : Justice Laws (laws-lois.justice.gc.ca)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  canada: {
    _flag: "ðŸ‡¨ðŸ‡¦",
    _name: "Canada",
    _source: "Justice Laws â€” laws-lois.justice.gc.ca",
    _keywords: ["canada", "canadien", "quÃ©bec", "quebec"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¨ðŸ‡¦ Casque Moto â€” Highway Traffic Act (Provincial)",
      content:
        "Le casque est obligatoire dans <strong>toutes les provinces</strong>. Normes acceptÃ©es : <strong>DOT (FMVSS 218)</strong>, <strong>Snell</strong>, <strong>ECE 22.05/22.06</strong>.<br><strong>Sanction :</strong> Varie par province. Ontario : <strong>C$110</strong>.",
      source: "laws-lois.justice.gc.ca + HTA provincial",
      url: "laws-lois.justice.gc.ca",
    },
    pipeda: {
      keywords: ["pipeda", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¨ðŸ‡¦ PIPEDA â€” Personal Information Protection Act",
      content:
        "Loi fÃ©dÃ©rale sur la protection des renseignements personnels dans le secteur privÃ©. SupervisÃ©e par le <strong>Commissariat Ã  la protection de la vie privÃ©e</strong>. RemplacÃ©e progressivement au QuÃ©bec par la <strong>Loi 25</strong> (2023).<br><strong>Amende :</strong> jusqu'Ã  <strong>C$100.000</strong> (PIPEDA), C$25M ou 4% du CA (Loi 25 QC).",
      source: "laws-lois.justice.gc.ca â€” PIPEDA (S.C. 2000, c.5)",
      url: "laws-lois.justice.gc.ca",
    },
  },
};

/**
 * ðŸ” Moteur de recherche dans la base juridique mondiale
 * UtilisÃ© par PocketLawyer.processChatQuery()
 */
window.LegalDatabase.search = function (query) {
  const t = query.toLowerCase();
  const results = [];

  // 1. Identifier le(s) pays ciblÃ©(s)
  let targetCountries = [];
  for (const [countryKey, country] of Object.entries(this)) {
    if (typeof country !== "object" || countryKey === "search") continue;
    if (country._keywords && country._keywords.some((kw) => t.includes(kw))) {
      targetCountries.push(countryKey);
    }
  }

  // Si aucun pays dÃ©tectÃ©, chercher dans tous
  if (targetCountries.length === 0) {
    targetCountries = Object.keys(this).filter(
      (k) => typeof this[k] === "object" && k !== "search",
    );
  }

  // 2. Chercher par mots-clÃ©s dans les pays ciblÃ©s
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
