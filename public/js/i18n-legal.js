const I18N_LEGAL = {
  fr: {
    privacy_title: "Politique de Confidentialité",
    privacy_last_update: "Dernière mise à jour : 29 avril 2026",
    privacy_intro:
      "L'application <strong>mon50ccetmoi</strong>, opérée par Xavier Le Chanu (SIRET : 891 912 503 00036 | TVA : FR87891912503), s'engage à protéger la vie privée des utilisateurs de sa communauté de scooters 50cc.",
    privacy_h1: "1. Données collectées et Utilisation",
    privacy_p1:
      "Nous collectons les données suivantes pour assurer le bon fonctionnement de l'application. Conformément à l'Article 13 du RGPD, chaque traitement est justifié par une base légale :",
    privacy_li1:
      "<span class='highlight'>Position GPS (Précise) :</span> Utilisée pour la navigation, l'odomètre, la détection de chute et le scan juridique.<br><em>Base légale : Consentement. Caractère : Obligatoire pour l'usage de ces modules.</em>",
    privacy_li2:
      "<span class='highlight'>Données en arrière-plan :</span> Accès à la position écran éteint indispensable pour vous alerter en cas d'accident.<br><em>Base légale : Consentement (protection vitale). Caractère : Obligatoire pour Guardian Angel.</em>",
    privacy_li3:
      "<span class='highlight'>Photos et Métadonnées (Litigation AI) :</span> Traitées pour générer des rapports d'assurance certifiés.<br><em>Base légale : Exécution du contrat. Caractère : Obligatoire pour la création du rapport.</em>",
    privacy_li4:
      "<span class='highlight'>Contacts d'Urgence :</span> Sauvegardés localement pour l'envoi de SMS automatiques en cas de chute.<br><em>Base légale : Intérêt légitime (sécurité). Caractère : Facultatif.</em>",
    privacy_h2: "2. Partage et Transferts des données",
    privacy_p2:
      "Vos données de localisation précises ne sont jamais vendues ni cédées à des tiers. Les partages suivants peuvent avoir lieu :",
    privacy_li_share1:
      "<span class='highlight'>Signalements de dangers :</span> Partagés anonymement avec la communauté.",
    privacy_li_share2:
      "<span class='highlight'>Portail Assureur :</span> Vos rapports de sinistres et photos certifiées ne sont accessibles à votre compagnie d'assurance <strong>que si vous leur fournissez volontairement votre code PIN unique à 6 chiffres</strong>. Sans ce code, aucune donnée de sinistre n'est partagée.",
    privacy_li_share3:
      "<span class='highlight'>Transferts hors UE (Google/Firebase) :</span> Pour gérer l'authentification et la base de données sécurisée, nous utilisons les services de Google (Firebase). Vos données d'identification peuvent transiter par des serveurs situés aux États-Unis. Ce transfert est sécurisé et encadré par des garanties appropriées (Clauses Contractuelles Types).",
    privacy_h3: "3. Conservation des données et Droits RGPD",
    privacy_p3:
      "Vos données sont conservées tant que votre compte est actif. Conformément au <strong>Règlement (UE) 2016/679 (RGPD)</strong> et à la <strong>Loi n° 78-17 du 6 janvier 1978 modifiée (Informatique et Libertés)</strong>, vous disposez à tout moment des droits suivants sur vos données personnelles :",
    privacy_li_right1:
      "<span class='highlight'>Droit d'accès (Article 15 RGPD) :</span> Obtenir une copie des données que nous détenons sur vous.",
    privacy_li_right2:
      "<span class='highlight'>Droit de rectification (Article 16 RGPD) :</span> Corriger des données inexactes ou incomplètes.",
    privacy_li_right3:
      "<span class='highlight'>Droit à l'effacement (Article 17 RGPD) :</span> Demander la suppression complète de votre compte et de toutes vos données (faisable directement depuis les paramètres de l'application).",
    privacy_li_right4:
      "<span class='highlight'>Droit à la limitation du traitement (Article 18 RGPD) :</span> Geler temporairement l'utilisation de vos données.",
    privacy_li_right5:
      "<span class='highlight'>Droit à la portabilité (Article 20 RGPD) :</span> Récupérer vos données dans un format structuré et lisible par machine.",
    privacy_li_right6:
      "<span class='highlight'>Droit d'opposition (Article 21 RGPD) :</span> Vous opposer à l'utilisation de vos données à certaines fins.",
    privacy_h4: "4. Sécurité",
    privacy_p4:
      "L'application utilise un chiffrement AES-256 (via CryptoJS) pour le stockage local des rapports sensibles et des sessions utilisateur. L'authentification est assurée par Firebase Authentication (Google) avec support optionnel de la biométrie FIDO2/WebAuthn. Nous mettons en Å“uvre toutes les mesures techniques et organisationnelles nécessaires pour garantir la sécurité et la confidentialité de vos données conformément à l'<strong>Article 32 du RGPD</strong>.",
    privacy_h5: "5. Responsable de Traitement et Contact",
    privacy_p5_1:
      "Le Responsable de Traitement des données de cette application est Xavier Le Chanu.",
    privacy_p5_2:
      "Pour exercer vos droits RGPD, pour toute question concernant cette politique, ou pour contacter notre point de contact unique (utilisateurs et autorités) dans le cadre du DSA, veuillez envoyer un e-mail à : <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3:
      "Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (cnil.fr).",
    privacy_h6: "6. Politique des Cookies et Stockage Local",
    privacy_p6_1:
      'Pour faire fonctionner l\'application (notamment pour vous garder connecté et sauvegarder vos préférences), nous utilisons des "cookies" et le stockage local de votre appareil (Local Storage).',
    privacy_li_cookie1:
      "<span class='highlight'>Cookies Essentiels :</span> Utilisés par notre fournisseur Firebase pour gérer votre authentification sécurisée.",
    privacy_li_cookie2:
      "<span class='highlight'>Stockage Local :</span> Utilisé pour sauvegarder vos réglages (thème, paramètres de la moto) afin que l'application soit prête à l'emploi à chaque ouverture.",
    privacy_p6_2:
      "Aucun cookie de ciblage publicitaire intrusif n'est utilisé. En utilisant l'application, vous consentez à l'utilisation de ces cookies essentiels au bon fonctionnement du service.",
    privacy_h7: "7. Conformité au Règlement Européen sur l'IA (AI Act)",
    privacy_p7:
      "Conformément à la législation européenne sur l'Intelligence Artificielle (AI Act), nous tenons à faire preuve d'une transparence totale concernant l'usage de nos algorithmes au sein de l'application :",
    privacy_li_ai1:
      "<span class='highlight'>Transparence (Risque Limité) :</span> En utilisant les fonctionnalités <strong>Meca Wizard</strong>, <strong>Pocket Lawyer</strong>, <strong>Litigation AI</strong> et <strong>Oracle Voice</strong>, vous êtes expressément informé que vous interagissez avec des systèmes d'Intelligence Artificielle générative et analytique.",
    privacy_li_ai2:
      "<span class='highlight'>Supervision Humaine :</span> Les rapports générés par notre IA (notamment pour les assurances via Litigation AI) et les conseils juridiques/mécaniques sont fournis à titre d'assistance. <strong>Aucune décision automatisée ayant un effet juridique n'est prise sans supervision humaine</strong>. L'utilisateur et l'assureur gardent toujours le pouvoir final de validation.",
    privacy_li_ai3:
      "<span class='highlight'>Garantie & Biais :</span> Nos modèles d'apprentissage (\"Self-Evolution Engine\") sont entraînés pour être neutres et sécurisés. Cependant, les conseils fournis par l'IA ne remplacent pas l'expertise d'un professionnel humain assermenté (avocat ou mécanicien certifié).",
    privacy_h8:
      "8. Conformité pour les Utilisateurs aux États-Unis (US Privacy Laws)",
    privacy_p8:
      "Bien qu'il n'existe pas de loi fédérale unique et globale sur la protection des données aux États-Unis, <strong>mon50ccetmoi</strong> s'engage à respecter les réglementations étatiques et sectorielles applicables :",
    privacy_li_us1:
      "<span class='highlight'>Droits des consommateurs (CCPA / CPRA) :</span> Les résidents de Californie bénéficient de droits de confidentialité étendus (droit de savoir, suppression, refus de vente). <strong>Nous confirmons formellement que nous ne vendons aucune donnée personnelle.</strong> L'application est disponible aux États-Unis, mais la 'Boîte noire' matérielle n'y est pas distribuée.",
    privacy_li_us2:
      "<span class='highlight'>Protection des mineurs (COPPA) :</span> L'application n'est pas destinée aux enfants. Nous ne collectons pas sciemment de données personnelles auprès de mineurs sans le consentement des parents.",
    privacy_li_us3:
      "<span class='highlight'>Santé & Finance (HIPAA / GLBA) :</span> Bien que non soumis strictement à ces lois sectorielles, nous appliquons des standards de chiffrement (AES-256) maximaux pour protéger toute donnée relative à la santé (rythme cardiaque local) ou financière.",
    privacy_li_us4:
      "<span class='highlight'>Transparence B2B (Buy American Act & IOR) :</span> Dans le cadre d'un déploiement institutionnel ou de marchés publics aux États-Unis, notre infrastructure logicielle et nos conditions garantissent une transparence totale pour répondre aux obligations de divulgation accrues des importateurs (Importer of Record).",
    privacy_h9:
      "9. Conformité pour les Utilisateurs en République Populaire de Chine (PIPL & DSL)",
    privacy_p9:
      "Conformément à la Loi sur la protection des informations personnelles (PIPL) et à la Loi sur la sécurité des données (DSL), <strong>mon50ccetmoi</strong> applique des mesures strictes pour les résidents chinois :",
    privacy_li_cn1:
      "<span class='highlight'>Transparence et Minimisation :</span> Nous collectons uniquement les données strictement nécessaires au fonctionnement du service, avec le consentement explicite de l'utilisateur.",
    privacy_li_cn2:
      "<span class='highlight'>Transferts Transfrontaliers :</span> Les données des utilisateurs sont traitées avec des mécanismes de sécurité robustes pour empêcher toute fuite, et tout transfert éventuel hors de Chine requiert un consentement spécifique.",
    privacy_li_cn3:
      "<span class='highlight'>Sécurité des Données (DSL) :</span> Aucune donnée collectée (trajets, sinistres) n'est classifiée comme critique pour la sécurité nationale. Il s'agit de données à usage strictement civil et privé (B2C/B2B).",
    privacy_h10:
      "10. Conformité pour les Utilisateurs en Afrique (POPIA & Convention de Malabo)",
    privacy_p10:
      "Conformément à la loi POPIA (Afrique du Sud) et aux principes de la Convention de Malabo (Union Africaine), nous nous engageons à protéger les données personnelles de nos utilisateurs africains :",
    privacy_li_af1:
      "<span class='highlight'>Responsabilité et Limitation :</span> Vos données GPS ne sont collectées que pour l'usage direct de l'application. Vous gardez le contrôle total sur leur suppression.",
    privacy_li_af2:
      "<span class='highlight'>Sécurité :</span> Les données sont chiffrées selon les standards internationaux pour prévenir tout accès non autorisé.",
    privacy_h11: "11. Sanctions Internationales et Territoires Exclus",
    privacy_p11:
      "En raison des réglementations internationales et des sanctions en vigueur, l'application <strong>mon50ccetmoi</strong> n'est ni disponible, ni destinée à être utilisée en <strong>Corée du Nord (RPDC)</strong>. Aucune donnée n'est traitée depuis ce territoire.",
  },
  en: {
    privacy_title: "Privacy Policy",
    privacy_last_update: "Last updated: April 29, 2026",
    privacy_intro:
      "The <strong>mon50ccetmoi</strong> application, operated by Xavier Le Chanu (SIRET: 891 912 503 00036 | VAT: FR87891912503), is committed to protecting the privacy of its 50cc scooter community users.",
    privacy_h1: "1. Data Collected and Usage",
    privacy_p1:
      "We collect the following data to ensure the proper functioning of the application. In accordance with Article 13 of the GDPR, each processing is justified by a legal basis:",
    privacy_li1:
      "<span class='highlight'>GPS Position (Precise):</span> Used for navigation, odometer, fall detection and legal scan.<br><em>Legal basis: Consent. Nature: Mandatory to use these modules.</em>",
    privacy_li2:
      "<span class='highlight'>Background Data:</span> Access to location with screen off, essential for accident alerts.<br><em>Legal basis: Consent (vital protection). Nature: Mandatory for the Guardian Angel module.</em>",
    privacy_li3:
      "<span class='highlight'>Photos and Metadata (Litigation AI):</span> Processed to generate certified insurance reports.<br><em>Legal basis: Contract execution. Nature: Mandatory for report creation.</em>",
    privacy_li4:
      "<span class='highlight'>Emergency Contacts:</span> Saved locally for automatic SMS in case of a fall.<br><em>Legal basis: Legitimate interest (security). Nature: Optional.</em>",
    privacy_h2: "2. Data Sharing and Transfers",
    privacy_p2:
      "Your precise location data is never sold or transferred to third parties. The following sharing may occur:",
    privacy_li_share1:
      "<span class='highlight'>Hazard Reports:</span> Shared anonymously with the community.",
    privacy_li_share2:
      "<span class='highlight'>Insurer Portal:</span> Your claim reports and certified photos are only accessible to your insurance company <strong>if you voluntarily provide them your unique 6-digit PIN</strong>. Without this code, no claim data is shared.",
    privacy_li_share3:
      "<span class='highlight'>Transfers outside the EU (Google/Firebase):</span> To manage your authentication and secure database, we use Google (Firebase) services. Your identification data may pass through servers located in the United States. This transfer is secure and framed by appropriate safeguards (Standard Contractual Clauses of the European Commission).",
    privacy_h3: "3. Data Retention and GDPR Rights",
    privacy_p3:
      "Your data is retained as long as your account is active. In accordance with the <strong>Regulation (EU) 2016/679 (GDPR)</strong>, you have the following rights over your personal data at any time:",
    privacy_li_right1:
      "<span class='highlight'>Right of Access (Article 15 GDPR):</span> Obtain a copy of the data we hold about you.",
    privacy_li_right2:
      "<span class='highlight'>Right to Rectification (Article 16 GDPR):</span> Correct inaccurate or incomplete data.",
    privacy_li_right3:
      "<span class='highlight'>Right to Erasure (Article 17 GDPR):</span> Request the complete deletion of your account and all your data (doable directly from the app settings).",
    privacy_li_right4:
      "<span class='highlight'>Right to Restriction of Processing (Article 18 GDPR):</span> Temporarily freeze the use of your data.",
    privacy_li_right5:
      "<span class='highlight'>Right to Data Portability (Article 20 GDPR):</span> Retrieve your data in a structured, machine-readable format.",
    privacy_li_right6:
      "<span class='highlight'>Right to Object (Article 21 GDPR):</span> Object to the use of your data for certain purposes.",
    privacy_h4: "4. Security",
    privacy_p4:
      "The application uses AES-256 encryption (via CryptoJS) for local storage of sensitive reports and user sessions. Authentication is provided by Firebase Authentication (Google) with optional support for FIDO2/WebAuthn biometrics. We implement all necessary technical and organizational measures to ensure the security and confidentiality of your data in accordance with <strong>Article 32 of the GDPR</strong>.",
    privacy_h5: "5. Data Controller and Contact",
    privacy_p5_1:
      "The Data Controller for this application is Xavier Le Chanu.",
    privacy_p5_2:
      "To exercise your GDPR rights, for any questions regarding this policy, or to contact our single point of contact (users and authorities) under the DSA, please send an email to: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3:
      "If you feel, after contacting us, that your rights are not respected, you can submit a complaint to the CNIL (cnil.fr).",
    privacy_h6: "6. Cookies and Local Storage Policy",
    privacy_p6_1:
      'To operate the application (notably to keep you logged in and save your preferences), we use "cookies" and your device\'s local storage.',
    privacy_li_cookie1:
      "<span class='highlight'>Essential Cookies:</span> Used by our provider Firebase to manage your secure authentication.",
    privacy_li_cookie2:
      "<span class='highlight'>Local Storage:</span> Used to save your settings (theme, motorcycle parameters) so that the application is ready to use every time you open it.",
    privacy_p6_2:
      "No intrusive advertising targeting cookies are used. By using the application, you consent to the use of these essential cookies for the proper functioning of the service.",
    privacy_h7: "7. Compliance with the European AI Act",
    privacy_p7:
      "In accordance with the European legislation on Artificial Intelligence (AI Act), we want to demonstrate full transparency regarding the use of our algorithms within the application:",
    privacy_li_ai1:
      "<span class='highlight'>Transparency (Limited Risk):</span> By using the <strong>Meca Wizard</strong>, <strong>Pocket Lawyer</strong>, <strong>Litigation AI</strong> and <strong>Oracle Voice</strong> features, you are expressly informed that you are interacting with generative and analytical Artificial Intelligence systems.",
    privacy_li_ai2:
      "<span class='highlight'>Human Oversight:</span> Reports generated by our AI (especially for insurance via Litigation AI) and legal/mechanical advice are provided for assistance. <strong>No automated decision with legal effect is taken without human oversight</strong>. The user and the insurer always keep the final validation power.",
    privacy_li_ai3:
      "<span class='highlight'>Warranty & Bias:</span> Our learning models (\"Self-Evolution Engine\") are trained to be neutral and secure. However, advice provided by AI does not replace the expertise of a sworn human professional (lawyer or certified mechanic).",
    privacy_h8:
      "8. Compliance for Users in the United States (US Privacy Laws)",
    privacy_p8:
      "Although there is no single comprehensive federal data protection law in the United States, <strong>mon50ccetmoi</strong> is committed to complying with applicable state and sectoral regulations:",
    privacy_li_us1:
      "<span class='highlight'>Consumer Rights (CCPA / CPRA):</span> California residents enjoy extended privacy rights (right to know, deletion, opt-out of sale). <strong>We formally confirm that we do not sell any personal data.</strong> The application is available in the United States, but the hardware 'Black Box' is not distributed there.",
    privacy_li_us2:
      "<span class='highlight'>Minors' Protection (COPPA):</span> The application is not intended for children. We do not knowingly collect personal data from minors without parental consent.",
    privacy_li_us3:
      "<span class='highlight'>Health & Finance (HIPAA / GLBA):</span> Although not strictly subject to these sectoral laws, we apply maximum encryption standards (AES-256) to protect any health-related (local heart rate) or financial data.",
    privacy_li_us4:
      "<span class='highlight'>B2B Transparency (Buy American Act & IOR):</span> In the context of an institutional deployment or public procurement in the United States, our software infrastructure and terms guarantee full transparency to meet the increased disclosure obligations for Importers of Record.",
    privacy_h9:
      "9. Compliance for Users in the People's Republic of China (PIPL & DSL)",
    privacy_p9:
      "In accordance with the Personal Information Protection Law (PIPL) and the Data Security Law (DSL), <strong>mon50ccetmoi</strong> applies strict measures for Chinese residents:",
    privacy_li_cn1:
      "<span class='highlight'>Transparency and Minimization:</span> We only collect data strictly necessary for the service to function, with the explicit consent of the user.",
    privacy_li_cn2:
      "<span class='highlight'>Cross-border Transfers:</span> User data is treated with robust security mechanisms to prevent leaks, and any potential transfer outside China requires specific consent.",
    privacy_li_cn3:
      "<span class='highlight'>Data Security (DSL):</span> No data collected (trips, claims) is classified as critical for national security. It is strictly civil and private use data (B2C/B2B).",
    privacy_h10:
      "10. Compliance for Users in Africa (POPIA & Malabo Convention)",
    privacy_p10:
      "In accordance with POPIA (South Africa) and the principles of the Malabo Convention (African Union), we are committed to protecting the personal data of our African users:",
    privacy_li_af1:
      "<span class='highlight'>Accountability & Limitation:</span> Your GPS data is collected only for the direct use of the application. You retain full control over its deletion.",
    privacy_li_af2:
      "<span class='highlight'>Security:</span> Data is encrypted using international standards to prevent unauthorized access.",
    privacy_h11: "11. International Sanctions & Excluded Territories",
    privacy_p11:
      "Due to international regulations and active sanctions, the <strong>mon50ccetmoi</strong> application is neither available nor intended for use in <strong>North Korea (DPRK)</strong>. No data is processed from this territory.",
  },
  es: {
    privacy_title: "PolÃ­tica de Privacidad",
    privacy_last_update: "Ãšltima actualizaciÃ³n: 29 de abril de 2026",
    privacy_intro:
      "La aplicaciÃ³n <strong>mon50ccetmoi</strong>, operada por Xavier Le Chanu (SIRET: 891 912 503 00036 | IVA: FR87891912503), se compromete a proteger la privacidad de los usuarios de su comunidad de scooters 50cc.",
    privacy_h1: "1. Datos recopilados y Uso",
    privacy_p1:
      "Recopilamos los siguientes datos para garantizar el buen funcionamiento de la aplicaciÃ³n:",
    privacy_li1:
      "<span class='highlight'>PosiciÃ³n GPS (Precisa):</span> Utilizada para la navegaciÃ³n, el odÃ³metro, la detecciÃ³n de caÃ­das (Guardian Angel) y el escaneo legal de estacionamiento (Pocket Lawyer).",
    privacy_li2:
      "<span class='highlight'>Datos en segundo plano:</span> Si utiliza la navegaciÃ³n o el detector de caÃ­das, la aplicaciÃ³n accede a su ubicaciÃ³n incluso con la pantalla apagada. Esto es esencial para alertarle en caso de accidente.",
    privacy_li3:
      "<span class='highlight'>Fotos y Metadatos (Litigation AI):</span> Las fotos tomadas a través de la aplicaciÃ³n para el Portal Experto se procesan para generar informes de seguro certificados. Estas fotos se almacenan de forma segura.",
    privacy_li4:
      "<span class='highlight'>Contactos de Emergencia:</span> Los nÃºmeros de teléfono de sus \"Ãngeles Guardianes\" se guardan localmente en su dispositivo y solo se utilizan para enviar SMS automÃ¡ticos en caso de detectar una caÃ­da grave.",
    privacy_h2: "2. Intercambio de datos",
    privacy_p2:
      "Sus datos de ubicaciÃ³n precisa nunca se venden ni se ceden a terceros. Puede producirse el siguiente intercambio:",
    privacy_li_share1:
      "<span class='highlight'>Reportes de peligro:</span> Compartidos de forma anÃ³nima con la comunidad.",
    privacy_li_share2:
      "<span class='highlight'>Portal del Asegurador:</span> Sus informes de siniestros y fotos certificadas solo son accesibles para su compañÃ­a de seguros <strong>si les proporciona voluntariamente su cÃ³digo PIN Ãºnico de 6 dÃ­gitos</strong>. Sin este cÃ³digo, no se comparten datos.",
    privacy_h3: "3. RetenciÃ³n de datos y Derechos RGPD",
    privacy_p3:
      "Sus datos se conservan mientras su cuenta esté activa. De acuerdo con el <strong>Reglamento (UE) 2016/679 (RGPD)</strong>, tiene en todo momento los siguientes derechos sobre sus datos:",
    privacy_li_right1:
      "<span class='highlight'>Derecho de Acceso (Art. 15 RGPD):</span> Obtener una copia de sus datos.",
    privacy_li_right2:
      "<span class='highlight'>Derecho de RectificaciÃ³n (Art. 16 RGPD):</span> Corregir datos inexactos.",
    privacy_li_right3:
      "<span class='highlight'>Derecho de SupresiÃ³n (Art. 17 RGPD):</span> Solicitar la eliminaciÃ³n completa de su cuenta y de todos sus datos.",
    privacy_li_right4:
      "<span class='highlight'>Derecho a la LimitaciÃ³n del Tratamiento (Art. 18 RGPD):</span> Congelar temporalmente el uso de sus datos.",
    privacy_li_right5:
      "<span class='highlight'>Derecho a la Portabilidad (Art. 20 RGPD):</span> Recuperar sus datos en un formato estructurado.",
    privacy_li_right6:
      "<span class='highlight'>Derecho de OposiciÃ³n (Art. 21 RGPD):</span> Oponerse al uso de sus datos para ciertos fines.",
    privacy_h4: "4. Seguridad",
    privacy_p4:
      "La aplicaciÃ³n utiliza cifrado AES-256 (vÃ­a CryptoJS) para el almacenamiento local de informes sensibles. La autenticaciÃ³n estÃ¡ a cargo de Firebase (Google) con soporte opcional de biometrÃ­a FIDO2/WebAuthn. Implementamos todas las medidas necesarias para garantizar la seguridad de sus datos (Art. 32 del RGPD).",
    privacy_h5: "5. Responsable del Tratamiento y Contacto",
    privacy_p5_1:
      "El Responsable del Tratamiento de datos de esta aplicaciÃ³n es Xavier Le Chanu.",
    privacy_p5_2:
      "Para ejercer sus derechos RGPD o para el DSA, envÃ­e un correo a: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3:
      "Si considera que no se respetan sus derechos, puede presentar una reclamaciÃ³n ante su autoridad local de protecciÃ³n de datos.",
    privacy_h6: "6. PolÃ­tica de Cookies y Almacenamiento Local",
    privacy_p6_1:
      'Para operar la aplicaciÃ³n, utilizamos "cookies" y el almacenamiento local de su dispositivo.',
    privacy_li_cookie1:
      "<span class='highlight'>Cookies Esenciales:</span> Utilizadas por Firebase para su autenticaciÃ³n segura.",
    privacy_li_cookie2:
      "<span class='highlight'>Almacenamiento Local:</span> Utilizado para guardar sus ajustes (tema, parÃ¡metros) para que la aplicaciÃ³n esté lista al abrirla.",
    privacy_p6_2:
      "No se utilizan cookies publicitarias intrusivas. Al usar la app, consiente el uso de estas cookies esenciales.",
    privacy_h7: "7. Cumplimiento con el Reglamento Europeo de IA (AI Act)",
    privacy_p7:
      "De acuerdo con el Reglamento de Inteligencia Artificial (AI Act), somos transparentes sobre el uso de nuestros algoritmos:",
    privacy_li_ai1:
      "<span class='highlight'>Transparencia (Riesgo Limitado):</span> Al usar Meca Wizard, Pocket Lawyer, Litigation AI u Oracle Voice, se le informa que interactÃºa con IA.",
    privacy_li_ai2:
      "<span class='highlight'>SupervisiÃ³n Humana:</span> Los consejos de la IA son de asistencia. <strong>No se toman decisiones automatizadas con efectos legales sin revisiÃ³n humana.</strong>",
    privacy_li_ai3:
      "<span class='highlight'>GarantÃ­a y Sesgo:</span> Nuestros modelos estÃ¡n entrenados para ser neutrales. Sin embargo, no reemplazan a un profesional certificado.",
    privacy_h8:
      "8. Cumplimiento para Usuarios en los Estados Unidos (US Privacy Laws)",
    privacy_p8:
      "Aunque no hay una ley federal Ãºnica, respetamos las regulaciones estatales y sectoriales:",
    privacy_li_us1:
      "<span class='highlight'>Derechos del consumidor (CCPA / CPRA):</span> Confirmamos formalmente que no vendemos datos personales.",
    privacy_li_us2:
      "<span class='highlight'>ProtecciÃ³n de menores (COPPA):</span> No recopilamos datos de menores sin consentimiento.",
    privacy_li_us3:
      "<span class='highlight'>Salud y Finanzas (HIPAA / GLBA):</span> Aplicamos cifrado mÃ¡ximo (AES-256) para proteger datos de salud (ritmo cardÃ­aco).",
    privacy_li_us4:
      "<span class='highlight'>Transparencia B2B (Buy American Act & IOR):</span> Garantizamos transparencia total para obligaciones de importadores.",
    privacy_h9: "9. Cumplimiento para Usuarios en China (PIPL & DSL)",
    privacy_p9: "De acuerdo con PIPL y DSL, aplicamos medidas estrictas:",
    privacy_li_cn1:
      "<span class='highlight'>Transparencia:</span> Solo recopilamos los datos estrictamente necesarios con consentimiento explÃ­cito.",
    privacy_li_cn2:
      "<span class='highlight'>Transferencias:</span> Tratamos los datos con mecanismos robustos contra fugas.",
    privacy_li_cn3:
      "<span class='highlight'>Seguridad (DSL):</span> NingÃºn dato recopilado se clasifica como crÃ­tico para la seguridad nacional.",
  },
  it: {
    privacy_title: "Informativa sulla Privacy",
    privacy_last_update: "Ultimo aggiornamento: 29 aprile 2026",
    privacy_intro:
      "L'applicazione <strong>mon50ccetmoi</strong>, gestita da Xavier Le Chanu, si impegna a proteggere la privacy degli utenti della sua comunità di scooter 50cc.",
    privacy_h1: "1. Dati raccolti e Utilizzo",
    privacy_p1:
      "Raccogliamo i seguenti dati per garantire il corretto funzionamento dell'applicazione:",
    privacy_li1:
      "<span class='highlight'>Posizione GPS (Precisa):</span> Utilizzata per la navigazione, rilevamento cadute e Pocket Lawyer.",
    privacy_li2:
      "<span class='highlight'>Dati in background:</span> L'app accede alla posizione anche a schermo spento per avvisare in caso di incidente.",
    privacy_li3:
      "<span class='highlight'>Foto (Litigation AI):</span> Generate per rapporti assicurativi certificati e archiviate in modo sicuro.",
    privacy_li4:
      "<span class='highlight'>Contatti di emergenza:</span> Salvati localmente e usati solo per inviare SMS in caso di caduta grave.",
    privacy_h2: "2. Condivisione dei dati",
    privacy_p2:
      "I tuoi dati di posizione non vengono mai venduti. Le seguenti condivisioni possono verificarsi:",
    privacy_li_share1:
      "<span class='highlight'>Segnalazioni pericoli:</span> Condivise in modo anonimo.",
    privacy_li_share2:
      "<span class='highlight'>Portale Assicuratore:</span> Accessibile all'assicurazione <strong>solo se fornisci volontariamente il PIN a 6 cifre</strong>.",
    privacy_h3: "3. Conservazione dei dati e Diritti GDPR",
    privacy_p3:
      "Ai sensi del <strong>Regolamento (UE) 2016/679 (GDPR)</strong>, hai i seguenti diritti:",
    privacy_li_right1:
      "<span class='highlight'>Diritto di Accesso (Art. 15):</span> Ottenere una copia dei tuoi dati.",
    privacy_li_right2:
      "<span class='highlight'>Diritto di Rettifica (Art. 16):</span> Correggere i dati inesatti.",
    privacy_li_right3:
      "<span class='highlight'>Diritto alla Cancellazione (Art. 17):</span> Richiedere l'eliminazione completa dell'account.",
    privacy_li_right4:
      "<span class='highlight'>Diritto di Limitazione (Art. 18):</span> Congelare l'uso dei tuoi dati.",
    privacy_li_right5:
      "<span class='highlight'>Diritto alla Portabilità (Art. 20):</span> Recuperare i tuoi dati in formato strutturato.",
    privacy_li_right6:
      "<span class='highlight'>Diritto di Opposizione (Art. 21):</span> Opporti all'uso dei tuoi dati.",
    privacy_h4: "4. Sicurezza",
    privacy_p4:
      "Usiamo la crittografia AES-256 (tramite CryptoJS) per l'archiviazione locale e Firebase Authentication. Implementiamo le misure necessarie (Art. 32 GDPR).",
    privacy_h5: "5. Titolare del Trattamento e Contatti",
    privacy_p5_1: "Il Titolare del Trattamento è Xavier Le Chanu.",
    privacy_p5_2:
      "Per esercitare i tuoi diritti GDPR, invia un'email a: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3:
      "Se ritieni che i tuoi diritti non siano rispettati, puoi presentare un reclamo all'autorità locale per la protezione dei dati.",
    privacy_h6: "6. Politica sui Cookie e Archiviazione Locale",
    privacy_p6_1:
      "Utilizziamo cookie essenziali e archiviazione locale per far funzionare l'app.",
    privacy_li_cookie1:
      "<span class='highlight'>Cookie Essenziali:</span> Usati da Firebase per l'autenticazione sicura.",
    privacy_li_cookie2:
      "<span class='highlight'>Archiviazione Locale:</span> Usata per salvare le tue impostazioni.",
    privacy_p6_2: "Non vengono utilizzati cookie pubblicitari intrusivi.",
    privacy_h7: "7. Conformità al Regolamento Europeo sull'IA (AI Act)",
    privacy_p7:
      "Nel rispetto della normativa, siamo trasparenti sull'uso dell'IA:",
    privacy_li_ai1:
      "<span class='highlight'>Trasparenza:</span> Sei informato che interagisci con IA.",
    privacy_li_ai2:
      "<span class='highlight'>Supervisione Umana:</span> <strong>Nessuna decisione legale viene presa senza revisione umana.</strong>",
    privacy_li_ai3:
      "<span class='highlight'>Garanzia:</span> L'IA non sostituisce un professionista umano.",
    privacy_h8: "8. Conformità (Stati Uniti)",
    privacy_p8: "Rispettiamo le normative statali applicabili:",
    privacy_li_us1:
      "<span class='highlight'>CCPA / CPRA:</span> Confermiamo di non vendere dati personali.",
    privacy_li_us2:
      "<span class='highlight'>COPPA:</span> Non raccogliamo dati di minori senza consenso.",
    privacy_li_us3:
      "<span class='highlight'>HIPAA / GLBA:</span> Applichiamo standard massimi di crittografia.",
    privacy_li_us4:
      "<span class='highlight'>Trasparenza B2B:</span> Garantiamo trasparenza totale.",
    privacy_h9: "9. Conformità (Cina PIPL & DSL)",
    privacy_p9: "Ai sensi della PIPL e DSL, applichiamo misure rigorose:",
    privacy_li_cn1:
      "<span class='highlight'>Trasparenza:</span> Raccogliamo solo i dati necessari.",
    privacy_li_cn2:
      "<span class='highlight'>Trasferimenti:</span> Preveniamo attivamente le fughe di dati.",
    privacy_li_cn3:
      "<span class='highlight'>Sicurezza:</span> Nessun dato è classificato come critico per la sicurezza nazionale.",
  },
  de: {
    privacy_title: "Datenschutzrichtlinie",
    privacy_last_update: "Letzte Aktualisierung: 29. April 2026",
    privacy_intro:
      "Die App <strong>mon50ccetmoi</strong>, betrieben von Xavier Le Chanu, verpflichtet sich, die Privatsphäre der Nutzer ihrer 50cc-Roller-Community zu schützen.",
    privacy_h1: "1. Gesammelte Daten und Nutzung",
    privacy_p1: "Wir sammeln folgende Daten für den Betrieb der App:",
    privacy_li1:
      "<span class='highlight'>GPS-Position (Präzise):</span> Für Navigation, Sturzerkennung und rechtlichen Park-Scan.",
    privacy_li2:
      "<span class='highlight'>Hintergrunddaten:</span> Zugriff auf den Standort auch bei ausgeschaltetem Bildschirm für Notfallwarnungen.",
    privacy_li3:
      "<span class='highlight'>Fotos (Litigation AI):</span> Werden sicher für zertifizierte Versicherungsberichte gespeichert.",
    privacy_li4:
      "<span class='highlight'>Notfallkontakte:</span> Lokal gespeichert, nur für automatische SMS bei schweren Stürzen verwendet.",
    privacy_h2: "2. Datenweitergabe",
    privacy_p2:
      "Ihre genauen Standortdaten werden niemals verkauft. Folgende Weitergaben können erfolgen:",
    privacy_li_share1:
      "<span class='highlight'>Gefahrenmeldungen:</span> Anonym mit der Community geteilt.",
    privacy_li_share2:
      "<span class='highlight'>Versicherungsportal:</span> Nur zugänglich, <strong>wenn Sie Ihren 6-stelligen PIN freiwillig weitergeben</strong>.",
    privacy_h3: "3. Datenspeicherung und DSGVO-Rechte",
    privacy_p3: "GemäÃŸ <strong>DSGVO</strong> haben Sie folgende Rechte:",
    privacy_li_right1:
      "<span class='highlight'>Auskunftsrecht (Art. 15 DSGVO):</span> Kopie Ihrer Daten anfordern.",
    privacy_li_right2:
      "<span class='highlight'>Recht auf Berichtigung (Art. 16 DSGVO):</span> Falsche Daten korrigieren.",
    privacy_li_right3:
      "<span class='highlight'>Recht auf Löschung (Art. 17 DSGVO):</span> Komplette Löschung des Kontos anfordern.",
    privacy_li_right4:
      "<span class='highlight'>Recht auf Einschränkung (Art. 18 DSGVO):</span> Nutzung der Daten einfrieren.",
    privacy_li_right5:
      "<span class='highlight'>Recht auf Datenübertragbarkeit (Art. 20 DSGVO):</span> Daten strukturiert erhalten.",
    privacy_li_right6:
      "<span class='highlight'>Widerspruchsrecht (Art. 21 DSGVO):</span> Der Nutzung widersprechen.",
    privacy_h4: "4. Sicherheit",
    privacy_p4:
      "Die App verwendet AES-256 Verschlüsselung für lokale Speicherung und Firebase für Authentifizierung (Art. 32 DSGVO).",
    privacy_h5: "5. Verantwortlicher und Kontakt",
    privacy_p5_1: "Verantwortlicher ist Xavier Le Chanu.",
    privacy_p5_2:
      "Zur Ausübung Ihrer Rechte kontaktieren Sie: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3:
      "Sie können sich jederzeit an eine Datenschutzbehörde wenden.",
    privacy_h6: "6. Cookies und lokale Speicherung",
    privacy_p6_1: "Wir verwenden essenzielle Cookies und lokalen Speicher.",
    privacy_li_cookie1:
      "<span class='highlight'>Essenzielle Cookies:</span> Für die sichere Firebase-Authentifizierung.",
    privacy_li_cookie2:
      "<span class='highlight'>Lokaler Speicher:</span> Um Ihre Einstellungen zu speichern.",
    privacy_p6_2: "Es werden keine Werbecookies verwendet.",
    privacy_h7: "7. KI-Verordnung (AI Act)",
    privacy_p7: "GemäÃŸ dem AI Act sind wir transparent:",
    privacy_li_ai1:
      "<span class='highlight'>Transparenz:</span> Sie interagieren mit KI in bestimmten Modulen.",
    privacy_li_ai2:
      "<span class='highlight'>Menschliche Aufsicht:</span> Keine rechtlichen Entscheidungen ohne menschliche Prüfung.",
    privacy_li_ai3:
      "<span class='highlight'>Garantie:</span> KI ersetzt keinen zertifizierten Fachmann.",
    privacy_h8: "8. US-Compliance (CCPA / HIPAA)",
    privacy_p8: "Wir erfüllen staatliche US-Regeln:",
    privacy_li_us1:
      "<span class='highlight'>Verbraucherrechte:</span> Keine Daten werden verkauft.",
    privacy_li_us2:
      "<span class='highlight'>Minderjährige:</span> Keine Datenerfassung von Kindern ohne Zustimmung.",
    privacy_li_us3:
      "<span class='highlight'>Sicherheit:</span> Maximale Verschlüsselung für sensible Daten.",
    privacy_li_us4:
      "<span class='highlight'>B2B:</span> Volle Transparenz gewährleistet.",
    privacy_h9: "9. China-Compliance (PIPL & DSL)",
    privacy_p9: "Wir befolgen PIPL und DSL:",
    privacy_li_cn1:
      "<span class='highlight'>Transparenz:</span> Nur absolut notwendige Datenerfassung.",
    privacy_li_cn2:
      "<span class='highlight'>Transfers:</span> Strikter Schutz vor Datenlecks.",
    privacy_li_cn3:
      "<span class='highlight'>Sicherheit:</span> Keine national sicherheitsrelevanten Daten.",
  },
  pt: {
    privacy_title: "PolÃ­tica de Privacidade",
    privacy_last_update: "Ãšltima atualizaçÃ£o: 29 de abril de 2026",
    privacy_intro:
      "O aplicativo <strong>mon50ccetmoi</strong>, operado por Xavier Le Chanu, compromete-se a proteger a privacidade da sua comunidade de scooters.",
    privacy_h1: "1. Dados Recolhidos e UtilizaçÃ£o",
    privacy_p1: "Recolhemos os seguintes dados:",
    privacy_li1:
      "<span class='highlight'>GPS (Preciso):</span> Para navegaçÃ£o e deteçÃ£o de quedas.",
    privacy_li2:
      "<span class='highlight'>Segundo Plano:</span> Acesso em segundo plano para alertas de acidentes.",
    privacy_li3:
      "<span class='highlight'>Fotos (IA):</span> Para relatÃ³rios de seguros.",
    privacy_li4:
      "<span class='highlight'>Contactos de Emergência:</span> Salvos localmente para SMS de emergência.",
    privacy_h2: "2. Partilha de Dados",
    privacy_p2: "Os seus dados nunca sÃ£o vendidos.",
    privacy_li_share1:
      "<span class='highlight'>Perigos:</span> Partilhados de forma anÃ³nima.",
    privacy_li_share2:
      "<span class='highlight'>Seguradora:</span> AcessÃ­vel <strong>apenas com o seu PIN de 6 dÃ­gitos</strong>.",
    privacy_h3: "3. Direitos RGPD",
    privacy_p3:
      "De acordo com o <strong>RGPD</strong>, tem os seguintes direitos:",
    privacy_li_right1:
      "<span class='highlight'>Acesso (Art. 15):</span> Obter uma cÃ³pia.",
    privacy_li_right2:
      "<span class='highlight'>RetificaçÃ£o (Art. 16):</span> Corrigir dados.",
    privacy_li_right3:
      "<span class='highlight'>Apagamento (Art. 17):</span> Eliminar a sua conta.",
    privacy_li_right4:
      "<span class='highlight'>LimitaçÃ£o (Art. 18):</span> Congelar os dados.",
    privacy_li_right5:
      "<span class='highlight'>Portabilidade (Art. 20):</span> Recuperar os dados.",
    privacy_li_right6:
      "<span class='highlight'>OposiçÃ£o (Art. 21):</span> Opor-se ao uso.",
    privacy_h4: "4. Segurança",
    privacy_p4: "Criptografia AES-256 e Firebase Auth (Art. 32 RGPD).",
    privacy_h5: "5. Contacto",
    privacy_p5_1: "ResponsÃ¡vel: Xavier Le Chanu.",
    privacy_p5_2: "Email: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Pode apresentar reclamaçÃ£o à autoridade competente.",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "Usamos cookies essenciais.",
    privacy_li_cookie1:
      "<span class='highlight'>Essenciais:</span> Para autenticaçÃ£o.",
    privacy_li_cookie2:
      "<span class='highlight'>Armazenamento Local:</span> Para definiçÃµes.",
    privacy_p6_2: "Sem cookies de publicidade.",
    privacy_h7: "7. IA (AI Act)",
    privacy_p7: "Transparência total:",
    privacy_li_ai1:
      "<span class='highlight'>Transparência:</span> InteraçÃ£o com IA assinalada.",
    privacy_li_ai2:
      "<span class='highlight'>SupervisÃ£o:</span> DecisÃµes requerem validaçÃ£o humana.",
    privacy_li_ai3:
      "<span class='highlight'>Garantia:</span> IA nÃ£o substitui profissionais.",
    privacy_h8: "8. EUA",
    privacy_p8: "Cumprimento das normas dos EUA:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> NÃ£o vendemos dados.",
    privacy_li_us2:
      "<span class='highlight'>COPPA:</span> Sem dados de menores sem consentimento.",
    privacy_li_us3:
      "<span class='highlight'>Segurança:</span> Criptografia mÃ¡xima.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparência total.",
    privacy_h9: "9. China (PIPL)",
    privacy_p9: "Conformidade com a PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>MinimizaçÃ£o:</span> Apenas dados necessÃ¡rios.",
    privacy_li_cn2:
      "<span class='highlight'>Transferências:</span> ProteçÃ£o robusta.",
    privacy_li_cn3:
      "<span class='highlight'>DSL:</span> Dados civis e privados.",
  },
  nl: {
    privacy_title: "Privacybeleid",
    privacy_last_update: "Laatst bijgewerkt: 29 april 2026",
    privacy_intro:
      "De app <strong>mon50ccetmoi</strong> doet er alles aan om uw privacy te beschermen.",
    privacy_h1: "1. Gegevens en Gebruik",
    privacy_p1: "We verzamelen:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Voor navigatie en valdetectie.",
    privacy_li2:
      "<span class='highlight'>Achtergrond:</span> Voor noodmeldingen.",
    privacy_li3:
      "<span class='highlight'>Foto's:</span> Voor verzekeringsrapporten.",
    privacy_li4:
      "<span class='highlight'>Noodcontacten:</span> Lokaal opgeslagen voor SMS.",
    privacy_h2: "2. Delen van Gegevens",
    privacy_p2: "Nooit verkocht.",
    privacy_li_share1:
      "<span class='highlight'>Gevaren:</span> Anoniem gedeeld.",
    privacy_li_share2:
      "<span class='highlight'>Verzekeraar:</span> <strong>Alleen met uw 6-cijferige PIN</strong>.",
    privacy_h3: "3. AVG / GDPR",
    privacy_p3: "Uw rechten:",
    privacy_li_right1: "<span class='highlight'>Inzage:</span> Kopie krijgen.",
    privacy_li_right2: "<span class='highlight'>Correctie:</span> Aanpassen.",
    privacy_li_right3:
      "<span class='highlight'>Verwijdering:</span> Account wissen.",
    privacy_li_right4:
      "<span class='highlight'>Beperking:</span> Gebruik bevriezen.",
    privacy_li_right5:
      "<span class='highlight'>Portabiliteit:</span> Gegevens ophalen.",
    privacy_li_right6: "<span class='highlight'>Bezwaar:</span> Bezwaar maken.",
    privacy_h4: "4. Veiligheid",
    privacy_p4: "AES-256 encryptie gebruikt.",
    privacy_h5: "5. Contact",
    privacy_p5_1: "Verantwoordelijke: Xavier Le Chanu.",
    privacy_p5_2: "E-mail: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Klachten bij de Autoriteit Persoonsgegevens.",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "Essentiële cookies gebruikt.",
    privacy_li_cookie1:
      "<span class='highlight'>Essentieel:</span> Voor login.",
    privacy_li_cookie2:
      "<span class='highlight'>Lokaal:</span> Voor instellingen.",
    privacy_p6_2: "Geen reclame.",
    privacy_h7: "7. AI Act",
    privacy_p7: "Transparantie over AI:",
    privacy_li_ai1:
      "<span class='highlight'>Transparantie:</span> U gebruikt AI.",
    privacy_li_ai2:
      "<span class='highlight'>Menselijk:</span> Geen besluiten zonder mens.",
    privacy_li_ai3:
      "<span class='highlight'>Garantie:</span> Geen vervanging van experts.",
    privacy_h8: "8. VS",
    privacy_p8: "VS wetgeving:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> Geen verkoop.",
    privacy_li_us2: "<span class='highlight'>COPPA:</span> Geen kinderen.",
    privacy_li_us3:
      "<span class='highlight'>Encryptie:</span> Maximaal beveiligd.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparant.",
    privacy_h9: "9. China",
    privacy_p9: "PIPL naleving:",
    privacy_li_cn1: "<span class='highlight'>Minimaal:</span> Alleen nodig.",
    privacy_li_cn2: "<span class='highlight'>Transfer:</span> Veilig.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Niet kritiek.",
  },
  pl: {
    privacy_title: "Polityka PrywatnoÅ›ci",
    privacy_last_update: "Ostatnia aktualizacja: 29 kwietnia 2026",
    privacy_intro:
      "Aplikacja <strong>mon50ccetmoi</strong> dba o ochronÄ™ Twojej prywatnoÅ›ci.",
    privacy_h1: "1. Gromadzone dane",
    privacy_p1: "Gromadzimy:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Do nawigacji i wykrywania upadkÃ³w.",
    privacy_li2:
      "<span class='highlight'>TÅ‚o:</span> Dla alertÃ³w awaryjnych.",
    privacy_li3:
      "<span class='highlight'>ZdjÄ™cia:</span> Dla raportÃ³w ubezpieczeniowych.",
    privacy_li4:
      "<span class='highlight'>Kontakty:</span> Lokalnie zapisane dla SMS.",
    privacy_h2: "2. UdostÄ™pnianie",
    privacy_p2: "Dane nie sÄ… sprzedawane.",
    privacy_li_share1: "<span class='highlight'>ZagroÅ¼enia:</span> Anonimowo.",
    privacy_li_share2:
      "<span class='highlight'>Ubezpieczyciel:</span> <strong>Tylko z kodem PIN</strong>.",
    privacy_h3: "3. RODO (GDPR)",
    privacy_p3: "Twoje prawa:",
    privacy_li_right1: "<span class='highlight'>DostÄ™p:</span> Kopia danych.",
    privacy_li_right2:
      "<span class='highlight'>Sprostowanie:</span> Poprawa bÅ‚Ä™dÃ³w.",
    privacy_li_right3:
      "<span class='highlight'>UsuniÄ™cie:</span> UsuniÄ™cie konta.",
    privacy_li_right4:
      "<span class='highlight'>Ograniczenie:</span> ZamroÅ¼enie.",
    privacy_li_right5:
      "<span class='highlight'>Przenoszenie:</span> OdbiÃ³r danych.",
    privacy_li_right6:
      "<span class='highlight'>Sprzeciw:</span> Zablokowanie uÅ¼ycia.",
    privacy_h4: "4. BezpieczeÅ„stwo",
    privacy_p4: "Szyfrowanie AES-256.",
    privacy_h5: "5. Kontakt",
    privacy_p5_1: "Administrator: Xavier Le Chanu.",
    privacy_p5_2: "E-mail: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Skargi do organu nadzoru.",
    privacy_h6: "6. Ciasteczka (Cookies)",
    privacy_p6_1: "UÅ¼ywamy tylko niezbÄ™dnych.",
    privacy_li_cookie1:
      "<span class='highlight'>NiezbÄ™dne:</span> Do logowania.",
    privacy_li_cookie2: "<span class='highlight'>Lokalne:</span> Ustawienia.",
    privacy_p6_2: "Brak reklam.",
    privacy_h7: "7. AI Act",
    privacy_p7: "PeÅ‚na przejrzystoÅ›Ä‡:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> UÅ¼ywasz sztucznej inteligencji.",
    privacy_li_ai2:
      "<span class='highlight'>NadzÃ³r:</span> Decyzje weryfikowane przez czÅ‚owieka.",
    privacy_li_ai3:
      "<span class='highlight'>Gwarancja:</span> AI nie zastÄ™puje eksperta.",
    privacy_h8: "8. USA",
    privacy_p8: "ZgodnoÅ›Ä‡ z USA:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> Brak sprzedaÅ¼y.",
    privacy_li_us2: "<span class='highlight'>COPPA:</span> Brak nieletnich.",
    privacy_li_us3: "<span class='highlight'>HIPAA:</span> Szyfrowanie.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> TransparentnoÅ›Ä‡.",
    privacy_h9: "9. Chiny",
    privacy_p9: "ZgodnoÅ›Ä‡ PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>Minimalizacja:</span> Tylko niezbÄ™dne.",
    privacy_li_cn2: "<span class='highlight'>Transfery:</span> Chronione.",
    privacy_li_cn3:
      "<span class='highlight'>BezpieczeÅ„stwo:</span> Brak zagroÅ¼eÅ„.",
  },
  zh: {
    privacy_title: "éšç§æ”¿ç­–",
    privacy_last_update: "æœ€åŽæ›´æ–°ï¼š2026å¹´4æœˆ29æ—¥",
    privacy_intro: "<strong>mon50ccetmoi</strong> è‡´åŠ›äºŽä¿æŠ¤æ‚¨çš„éšç§ã€‚",
    privacy_h1: "1. æ•°æ®æ”¶é›†",
    privacy_p1: "æˆ‘ä»¬æ”¶é›†ï¼š",
    privacy_li1: "<span class='highlight'>GPS:</span> å¯¼èˆªä¸Žè·Œå€’æ£€æµ‹ã€‚",
    privacy_li2: "<span class='highlight'>åŽå°:</span> ç”¨äºŽç´§æ€¥è­¦æŠ¥ã€‚",
    privacy_li3: "<span class='highlight'>ç…§ç‰‡:</span> ç”¨äºŽä¿é™©æŠ¥å‘Šã€‚",
    privacy_li4:
      "<span class='highlight'>è”ç³»äºº:</span> æœ¬åœ°å­˜å‚¨ç”¨äºŽå‘é€çŸ­ä¿¡ã€‚",
    privacy_h2: "2. æ•°æ®å…±äº«",
    privacy_p2: "ç»ä¸ä½œé”€å”®ã€‚",
    privacy_li_share1:
      "<span class='highlight'>å±é™©æŠ¥å‘Š:</span> åŒ¿åå…±äº«ã€‚",
    privacy_li_share2:
      "<span class='highlight'>ä¿é™©å…¬å¸:</span> <strong>ä»…åœ¨æ‚¨æä¾›PINç æ—¶å¯è§</strong>ã€‚",
    privacy_h3: "3. GDPR ä¸Žæ‚¨çš„æƒåˆ©",
    privacy_p3: "æ‚¨çš„æƒåˆ©ï¼š",
    privacy_li_right1: "<span class='highlight'>è®¿é—®:</span> èŽ·å–å‰¯æœ¬ã€‚",
    privacy_li_right2: "<span class='highlight'>æ›´æ­£:</span> ä¿®æ”¹é”™è¯¯ã€‚",
    privacy_li_right3: "<span class='highlight'>åˆ é™¤:</span> é”€æ¯è´¦æˆ·ã€‚",
    privacy_li_right4: "<span class='highlight'>é™åˆ¶:</span> å†»ç»“ä½¿ç”¨ã€‚",
    privacy_li_right5: "<span class='highlight'>è¿ç§»:</span> å¯¼å‡ºæ•°æ®ã€‚",
    privacy_li_right6: "<span class='highlight'>æ‹’ç»:</span> åå¯¹å¤„ç†ã€‚",
    privacy_h4: "4. å®‰å…¨",
    privacy_p4: "AES-256 åŠ å¯†ã€‚",
    privacy_h5: "5. è”ç³»æˆ‘ä»¬",
    privacy_p5_1: "è´Ÿè´£äºº: Xavier Le Chanuã€‚",
    privacy_p5_2: "é‚®ç®±: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "å¯å‘ç›‘ç®¡æœºæž„æŠ•è¯‰ã€‚",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "ä»…é™å¿…è¦ã€‚",
    privacy_li_cookie1: "<span class='highlight'>å¿…è¦:</span> ç™»å½•éªŒè¯ã€‚",
    privacy_li_cookie2: "<span class='highlight'>æœ¬åœ°:</span> åå¥½è®¾ç½®ã€‚",
    privacy_p6_2: "æ— å¹¿å‘Šã€‚",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI é€æ˜Žåº¦ï¼š",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> æ‚¨æ­£åœ¨ä½¿ç”¨AIæœåŠ¡ã€‚",
    privacy_li_ai2:
      "<span class='highlight'>äººå·¥:</span> æ— å®Œå…¨è‡ªåŠ¨åŒ–æ³•å¾‹å†³å®šã€‚",
    privacy_li_ai3:
      "<span class='highlight'>æç¤º:</span> AIä¸èƒ½æ›¿ä»£ä¸“å®¶ã€‚",
    privacy_h8: "8. ç¾Žå›½åˆè§„",
    privacy_p8: "éµå®ˆ CCPA ç­‰ï¼š",
    privacy_li_us1:
      "<span class='highlight'>ä¸é”€å”®:</span> æˆ‘ä»¬ä¸å‡ºå”®æ•°æ®ã€‚",
    privacy_li_us2:
      "<span class='highlight'>å„¿ç«¥:</span> ä¸æ”¶é›†å„¿ç«¥æ•°æ®ã€‚",
    privacy_li_us3: "<span class='highlight'>åŠ å¯†:</span> å†›ç”¨çº§åŠ å¯†ã€‚",
    privacy_li_us4: "<span class='highlight'>B2B:</span> é«˜é€æ˜Žåº¦ã€‚",
    privacy_h9: "9. ä¸­å›½ PIPL åˆè§„",
    privacy_p9: "ä¸¥æ ¼éµå®ˆï¼š",
    privacy_li_cn1:
      "<span class='highlight'>æœ€å°åŒ–:</span> ä»…é™å¿…é¡»æ•°æ®ã€‚",
    privacy_li_cn2: "<span class='highlight'>ä¼ è¾“:</span> é˜²æ­¢æ³„éœ²ã€‚",
    privacy_li_cn3:
      "<span class='highlight'>DSL:</span> éžå›½å®¶å®‰å…¨æ•°æ®ã€‚",
  },
  ja: {
    privacy_title: "ãƒ—ãƒ©ã‚¤ãƒã‚·ãƒ¼ãƒãƒªã‚·ãƒ¼",
    privacy_last_update: "æœ€çµ‚æ›´æ–°æ—¥ï¼š2026å¹´4æœˆ29æ—¥",
    privacy_intro:
      "<strong>mon50ccetmoi</strong> ã¯ãƒ—ãƒ©ã‚¤ãƒã‚·ãƒ¼ã®ä¿è­·ã«åŠªã‚ã¦ã„ã¾ã™ã€‚",
    privacy_h1: "1. ãƒ‡ãƒ¼ã‚¿åŽé›†",
    privacy_p1: "åŽé›†ã™ã‚‹ãƒ‡ãƒ¼ã‚¿ï¼š",
    privacy_li1: "<span class='highlight'>GPS:</span> ãƒŠãƒ“ã¨è»¢å€’æ¤œçŸ¥ã€‚",
    privacy_li2:
      "<span class='highlight'>ãƒãƒƒã‚¯ã‚°ãƒ©ã‚¦ãƒ³ãƒ‰:</span> ç·Šæ€¥ã‚¢ãƒ©ãƒ¼ãƒˆç”¨ã€‚",
    privacy_li3:
      "<span class='highlight'>å†™çœŸ:</span> ä¿é™ºãƒ¬ãƒãƒ¼ãƒˆç”¨ã€‚",
    privacy_li4:
      "<span class='highlight'>é€£çµ¡å…ˆ:</span> SMSç”¨ã®ãƒ­ãƒ¼ã‚«ãƒ«ä¿å­˜ã€‚",
    privacy_h2: "2. ãƒ‡ãƒ¼ã‚¿å…±æœ‰",
    privacy_p2: "è²©å£²ã¯ã—ã¾ã›ã‚“ã€‚",
    privacy_li_share1:
      "<span class='highlight'>å±é™ºå ±å‘Š:</span> åŒ¿åã§å…±æœ‰ã€‚",
    privacy_li_share2:
      "<span class='highlight'>ä¿é™ºä¼šç¤¾:</span> <strong>PINã‚’æä¾›ã—ãŸå ´åˆã®ã¿</strong>ã€‚",
    privacy_h3: "3. GDPRã¨æ¨©åˆ©",
    privacy_p3: "ã‚ãªãŸã®æ¨©åˆ©ï¼š",
    privacy_li_right1:
      "<span class='highlight'>ã‚¢ã‚¯ã‚»ã‚¹:</span> ã‚³ãƒ”ãƒ¼ã®å–å¾—ã€‚",
    privacy_li_right2: "<span class='highlight'>è¨‚æ­£:</span> ä¿®æ­£ã€‚",
    privacy_li_right3:
      "<span class='highlight'>å‰Šé™¤:</span> ã‚¢ã‚«ã‚¦ãƒ³ãƒˆå‰Šé™¤ã€‚",
    privacy_li_right4: "<span class='highlight'>åˆ¶é™:</span> ä½¿ç”¨ã®å‡çµã€‚",
    privacy_li_right5:
      "<span class='highlight'>ãƒãƒ¼ã‚¿ãƒ“ãƒªãƒ†ã‚£:</span> ãƒ‡ãƒ¼ã‚¿ã®æŠ½å‡ºã€‚",
    privacy_li_right6: "<span class='highlight'>æ‹’å¦:</span> åå¯¾ã€‚",
    privacy_h4: "4. ã‚»ã‚­ãƒ¥ãƒªãƒ†ã‚£",
    privacy_p4: "AES-256æš—å·åŒ–ã€‚",
    privacy_h5: "5. é€£çµ¡å…ˆ",
    privacy_p5_1: "è²¬ä»»è€…: Xavier Le Chanuã€‚",
    privacy_p5_2: "ãƒ¡ãƒ¼ãƒ«: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "ç›£ç£æ©Ÿé–¢ã«è‹¦æƒ…ã‚’ç”³ã—ç«‹ã¦å¯èƒ½ã€‚",
    privacy_h6: "6. Cookie",
    privacy_p6_1: "å¿…é ˆã®ã¿ä½¿ç”¨ã€‚",
    privacy_li_cookie1:
      "<span class='highlight'>å¿…é ˆ:</span> ãƒ­ã‚°ã‚¤ãƒ³ç”¨ã€‚",
    privacy_li_cookie2:
      "<span class='highlight'>ãƒ­ãƒ¼ã‚«ãƒ«:</span> è¨­å®šç”¨ã€‚",
    privacy_p6_2: "åºƒå‘Šãªã—ã€‚",
    privacy_h7: "7. AI Act",
    privacy_p7: "AIã®é€æ˜Žæ€§ï¼š",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> AIã¨ã‚„ã‚Šå–ã‚Šã—ã¾ã™ã€‚",
    privacy_li_ai2:
      "<span class='highlight'>äººé–“:</span> è‡ªå‹•æ±ºå®šã«ã¯äººé–“ã®ãƒã‚§ãƒƒã‚¯ãŒå¿…è¦ã€‚",
    privacy_li_ai3:
      "<span class='highlight'>ä¿è¨¼:</span> å°‚é–€å®¶ã®ä»£ã‚ã‚Šã«ã¯ãªã‚Šã¾ã›ã‚“ã€‚",
    privacy_h8: "8. ç±³å›½",
    privacy_p8: "CCPAç­‰ã«æº–æ‹ ï¼š",
    privacy_li_us1:
      "<span class='highlight'>è²©å£²ãªã—:</span> ãƒ‡ãƒ¼ã‚¿ã‚’è²©å£²ã—ã¾ã›ã‚“ã€‚",
    privacy_li_us2:
      "<span class='highlight'>å­ä¾›:</span> æ„å›³çš„ã«åŽé›†ã—ã¾ã›ã‚“ã€‚",
    privacy_li_us3: "<span class='highlight'>æš—å·åŒ–:</span> æœ€å¤§ã®ä¿è­·ã€‚",
    privacy_li_us4: "<span class='highlight'>B2B:</span> é€æ˜Žæ€§ã€‚",
    privacy_h9: "9. ä¸­å›½ PIPL",
    privacy_p9: "åŽ³æ ¼ãªæŽªç½®ï¼š",
    privacy_li_cn1:
      "<span class='highlight'>æœ€å°åŒ–:</span> å¿…è¦ãªãƒ‡ãƒ¼ã‚¿ã®ã¿ã€‚",
    privacy_li_cn2: "<span class='highlight'>è»¢é€:</span> æ¼æ´©é˜²æ­¢ã€‚",
    privacy_li_cn3:
      "<span class='highlight'>DSL:</span> å›½å®¶å®‰å…¨ä¿éšœã«ã¯é–¢ä¿‚ãªã—ã€‚",
  },
  no: {
    privacy_title: "Personvernerklæring",
    privacy_last_update: "Sist oppdatert: 29. april 2026",
    privacy_intro:
      "Appen <strong>mon50ccetmoi</strong> er forpliktet til å beskytte personvernet ditt.",
    privacy_h1: "1. Datainnsamling",
    privacy_p1: "Vi samler inn:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> For navigasjon og falldeteksjon.",
    privacy_li2: "<span class='highlight'>Bakgrunn:</span> For nødalarm.",
    privacy_li3:
      "<span class='highlight'>Bilder:</span> For forsikringsrapporter.",
    privacy_li4:
      "<span class='highlight'>Kontakter:</span> Lagres lokalt for SMS.",
    privacy_h2: "2. Datadeling",
    privacy_p2: "Selges aldri.",
    privacy_li_share1: "<span class='highlight'>Farer:</span> Deles anonymt.",
    privacy_li_share2:
      "<span class='highlight'>Forsikring:</span> <strong>Kun hvis du oppgir PIN</strong>.",
    privacy_h3: "3. GDPR-rettigheter",
    privacy_p3: "Dine rettigheter:",
    privacy_li_right1: "<span class='highlight'>Innsyn:</span> Få kopi.",
    privacy_li_right2: "<span class='highlight'>Retting:</span> Korriger feil.",
    privacy_li_right3: "<span class='highlight'>Sletting:</span> Slett konto.",
    privacy_li_right4: "<span class='highlight'>Begrensning:</span> Frys data.",
    privacy_li_right5:
      "<span class='highlight'>Portabilitet:</span> Eksporter data.",
    privacy_li_right6: "<span class='highlight'>Protest:</span> Stopp bruk.",
    privacy_h4: "4. Sikkerhet",
    privacy_p4: "AES-256 kryptering.",
    privacy_h5: "5. Kontakt",
    privacy_p5_1: "Ansvarlig: Xavier Le Chanu.",
    privacy_p5_2: "E-post: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Klag til datatilsynet.",
    privacy_h6: "6. Informasjonskapsler",
    privacy_p6_1: "Kun essensielle cookies.",
    privacy_li_cookie1:
      "<span class='highlight'>Essensielle:</span> For pålogging.",
    privacy_li_cookie2:
      "<span class='highlight'>Lokalt:</span> For innstillinger.",
    privacy_p6_2: "Ingen annonser.",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI-gjennomsiktighet:",
    privacy_li_ai1: "<span class='highlight'>AI:</span> Du bruker AI.",
    privacy_li_ai2:
      "<span class='highlight'>Menneskelig:</span> Sjekkes av mennesker.",
    privacy_li_ai3:
      "<span class='highlight'>Garanti:</span> Erstatter ikke eksperter.",
    privacy_h8: "8. USA",
    privacy_p8: "USA-kompatibel:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> Selger ikke data.",
    privacy_li_us2: "<span class='highlight'>Barn:</span> Ingen innsamling.",
    privacy_li_us3: "<span class='highlight'>Sikkerhet:</span> Kryptert.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparent.",
    privacy_h9: "9. Kina (PIPL)",
    privacy_p9: "Følger PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>Minimering:</span> Kun nødvendig.",
    privacy_li_cn2: "<span class='highlight'>Overføring:</span> Sikret.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Ikke kritisk data.",
  },
  ko: {
    privacy_title: "ê°œì¸ì •ë³´ ì²˜ë¦¬ë°©ì¹¨",
    privacy_last_update: "ìµœì¢… ì—…ë°ì´íŠ¸: 2026ë…„ 4ì›” 29ì¼",
    privacy_intro:
      "<strong>mon50ccetmoi</strong> ì•±ì€ ê°œì¸ì •ë³´ ë³´í˜¸ë¥¼ ìœ„í•´ ìµœì„ ì„ ë‹¤í•©ë‹ˆë‹¤.",
    privacy_h1: "1. ë°ì´í„° ìˆ˜ì§‘",
    privacy_p1: "ìš°ë¦¬ê°€ ìˆ˜ì§‘í•˜ëŠ” ë°ì´í„°:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> ë‚´ë¹„ê²Œì´ì…˜ ë° ë‚™ìƒ ê°ì§€.",
    privacy_li2:
      "<span class='highlight'>ë°±ê·¸ë¼ìš´ë“œ:</span> ê¸´ê¸‰ ì•Œë¦¼ìš©.",
    privacy_li3: "<span class='highlight'>ì‚¬ì§„:</span> ë³´í—˜ ë³´ê³ ì„œìš©.",
    privacy_li4:
      "<span class='highlight'>ì—°ë½ì²˜:</span> SMSìš© ë¡œì»¬ ì €ìž¥.",
    privacy_h2: "2. ë°ì´í„° ê³µìœ ",
    privacy_p2: "ë°ì´í„°ëŠ” íŒë§¤ë˜ì§€ ì•ŠìŠµë‹ˆë‹¤.",
    privacy_li_share1:
      "<span class='highlight'>ìœ„í—˜ ë³´ê³ :</span> ìµëª…ìœ¼ë¡œ ê³µìœ .",
    privacy_li_share2:
      "<span class='highlight'>ë³´í—˜ì‚¬:</span> <strong>PINì„ ì œê³µí•œ ê²½ìš°ì—ë§Œ</strong>.",
    privacy_h3: "3. GDPR ê¶Œë¦¬",
    privacy_p3: "ê·€í•˜ì˜ ê¶Œë¦¬:",
    privacy_li_right1:
      "<span class='highlight'>ì ‘ê·¼ê¶Œ:</span> ì‚¬ë³¸ ìš”ì²­.",
    privacy_li_right2:
      "<span class='highlight'>ì •ì •ê¶Œ:</span> ì˜¤ë¥˜ ìˆ˜ì •.",
    privacy_li_right3:
      "<span class='highlight'>ì‚­ì œê¶Œ:</span> ê³„ì • ì‚­ì œ.",
    privacy_li_right4:
      "<span class='highlight'>ì œí•œê¶Œ:</span> ì‚¬ìš© ì¤‘ì§€.",
    privacy_li_right5:
      "<span class='highlight'>ì´ë™ê¶Œ:</span> ë°ì´í„° ë‚´ë³´ë‚´ê¸°.",
    privacy_li_right6:
      "<span class='highlight'>ë°˜ëŒ€ê¶Œ:</span> ì²˜ë¦¬ ê±°ë¶€.",
    privacy_h4: "4. ë³´ì•ˆ",
    privacy_p4: "AES-256 ì•”í˜¸í™” ì ìš©.",
    privacy_h5: "5. ì—°ë½ì²˜",
    privacy_p5_1: "ì±…ìž„ìž: Xavier Le Chanu.",
    privacy_p5_2: "ì´ë©”ì¼: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "ê°ë… ê¸°ê´€ì— ë¶ˆë§Œ ì œê¸° ê°€ëŠ¥.",
    privacy_h6: "6. ì¿ í‚¤",
    privacy_p6_1: "í•„ìˆ˜ ì¿ í‚¤ë§Œ ì‚¬ìš©.",
    privacy_li_cookie1:
      "<span class='highlight'>í•„ìˆ˜:</span> ë¡œê·¸ì¸ ì¸ì¦ìš©.",
    privacy_li_cookie2: "<span class='highlight'>ë¡œì»¬:</span> ì„¤ì • ì €ìž¥.",
    privacy_p6_2: "ê´‘ê³  ì—†ìŒ.",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI íˆ¬ëª…ì„±:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> AI ì‹œìŠ¤í…œì„ ì‚¬ìš© ì¤‘ìž…ë‹ˆë‹¤.",
    privacy_li_ai2:
      "<span class='highlight'>ì¸ê°„ ê°ë…:</span> ìžë™í™”ëœ ë²•ì  ê²°ì • ì—†ìŒ.",
    privacy_li_ai3:
      "<span class='highlight'>ë³´ì¦:</span> ì „ë¬¸ê°€ë¥¼ ëŒ€ì²´í•˜ì§€ ì•ŠìŒ.",
    privacy_h8: "8. ë¯¸êµ­ ê·œì •",
    privacy_p8: "CCPA ë“± ì¤€ìˆ˜:",
    privacy_li_us1:
      "<span class='highlight'>íŒë§¤ ê¸ˆì§€:</span> ë°ì´í„°ë¥¼ íŒë§¤í•˜ì§€ ì•ŠìŒ.",
    privacy_li_us2:
      "<span class='highlight'>ì•„ë™:</span> ì˜ë„ì  ìˆ˜ì§‘ ì—†ìŒ.",
    privacy_li_us3:
      "<span class='highlight'>ë³´ì•ˆ:</span> ìµœê³  ìˆ˜ì¤€ ì•”í˜¸í™”.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> íˆ¬ëª…ì„± ë³´ìž¥.",
    privacy_h9: "9. ì¤‘êµ­ ê·œì • (PIPL)",
    privacy_p9: "ì—„ê²©í•œ ì¤€ìˆ˜:",
    privacy_li_cn1:
      "<span class='highlight'>ìµœì†Œí™”:</span> í•„ìˆ˜ ë°ì´í„°ë§Œ ìˆ˜ì§‘.",
    privacy_li_cn2:
      "<span class='highlight'>ì „ì†¡:</span> ì •ë³´ ìœ ì¶œ ë°©ì§€.",
    privacy_li_cn3:
      "<span class='highlight'>DSL:</span> êµ­ê°€ ì•ˆë³´ì™€ ë¬´ê´€.",
  },
  he: {
    privacy_title: "×ž×“×™× ×™×•×ª ×¤×¨×˜×™×•×ª",
    privacy_last_update: "×¢×“×›×•×Ÿ ××—×¨×•×Ÿ: 29 ×‘××¤×¨×™×œ 2026",
    privacy_intro:
      "×”××¤×œ×™×§×¦×™×” <strong>mon50ccetmoi</strong> ×ž×—×•×™×‘×ª ×œ×”×’× ×” ×¢×œ ×¤×¨×˜×™×•×ª×š.",
    privacy_h1: "1. ××™×¡×•×£ × ×ª×•× ×™×",
    privacy_p1: "×× ×• ××•×¡×¤×™×:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> ×œ× ×™×•×•×˜ ×•×–×™×”×•×™ × ×¤×™×œ×•×ª.",
    privacy_li2:
      "<span class='highlight'>×¨×§×¢:</span> ×œ×”×ª×¨×¢×•×ª ×—×™×¨×•×.",
    privacy_li3:
      "<span class='highlight'>×ª×ž×•× ×•×ª:</span> ×œ×“×•×—×•×ª ×‘×™×˜×•×—.",
    privacy_li4:
      "<span class='highlight'>×× ×©×™ ×§×©×¨:</span> ×©×ž×•×¨ ×ž×§×•×ž×™×ª ×œ-SMS.",
    privacy_h2: "2. ×©×™×ª×•×£ × ×ª×•× ×™×",
    privacy_p2: "×”× ×ª×•× ×™× ×œ×¢×•×œ× ×œ× × ×ž×›×¨×™×.",
    privacy_li_share1:
      "<span class='highlight'>×¡×›× ×•×ª:</span> ×ž×©×•×ª×£ ×‘×× ×•× ×™×ž×™×•×ª.",
    privacy_li_share2:
      "<span class='highlight'>×‘×™×˜×•×—:</span> <strong>×¨×§ ×¢× ×§×•×“ PIN</strong>.",
    privacy_h3: "3. ×–×›×•×™×•×ª GDPR",
    privacy_p3: "×”×–×›×•×™×•×ª ×©×œ×š:",
    privacy_li_right1:
      "<span class='highlight'>×’×™×©×”:</span> ×§×‘×œ×ª ×¢×•×ª×§.",
    privacy_li_right2:
      "<span class='highlight'>×ª×™×§×•×Ÿ:</span> ×¢×“×›×•×Ÿ × ×ª×•× ×™×.",
    privacy_li_right3:
      "<span class='highlight'>×ž×—×™×§×”:</span> ×ž×—×™×§×ª ×—×©×‘×•×Ÿ.",
    privacy_li_right4:
      "<span class='highlight'>×”×’×‘×œ×”:</span> ×”×§×¤××ª ×©×™×ž×•×©.",
    privacy_li_right5:
      "<span class='highlight'>× ×™×™×“×•×ª:</span> ×™×™×¦×•× × ×ª×•× ×™×.",
    privacy_li_right6:
      "<span class='highlight'>×”×ª× ×’×“×•×ª:</span> ×¢×¦×™×¨×ª ×¢×™×‘×•×“.",
    privacy_h4: "4. ××‘×˜×—×”",
    privacy_p4: "×”×¦×¤× ×ª AES-256.",
    privacy_h5: "5. ×™×¦×™×¨×ª ×§×©×¨",
    privacy_p5_1: "××—×¨××™: Xavier Le Chanu.",
    privacy_p5_2: '×“×•×"×œ: <strong>contact@mon50ccetmoi.com</strong>',
    privacy_p5_3: "× ×™×ª×Ÿ ×œ×”×’×™×© ×ª×œ×•× ×” ×œ×¨×©×•×ª ×”×¤×™×§×•×—.",
    privacy_h6: "6. ×¢×•×’×™×•×ª",
    privacy_p6_1: "×¢×•×’×™×•×ª ×”×›×¨×—×™×•×ª ×‘×œ×‘×“.",
    privacy_li_cookie1:
      "<span class='highlight'>×”×›×¨×—×™:</span> ×œ××™×ž×•×ª.",
    privacy_li_cookie2:
      "<span class='highlight'>×ž×§×•×ž×™:</span> ×œ×”×’×“×¨×•×ª.",
    privacy_p6_2: "×œ×œ× ×¤×¨×¡×•×ž×•×ª.",
    privacy_h7: "7. AI Act",
    privacy_p7: "×©×§×™×¤×•×ª AI:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> ××ª×” ×ž×©×ª×ž×© ×‘-AI.",
    privacy_li_ai2:
      "<span class='highlight'>×¤×™×§×•×—:</span> × ×“×¨×© ××™×©×•×¨ ×× ×•×©×™.",
    privacy_li_ai3:
      "<span class='highlight'>××—×¨×™×•×ª:</span> ×œ× ×ž×—×œ×™×£ ×ž×•×ž×—×”.",
    privacy_h8: '8. ××¨×”"×‘',
    privacy_p8: "×ª××™×ž×•×ª CCPA:",
    privacy_li_us1:
      "<span class='highlight'>××™×Ÿ ×ž×›×™×¨×”:</span> ×œ× ×ž×•×›×¨×™× × ×ª×•× ×™×.",
    privacy_li_us2:
      "<span class='highlight'>×™×œ×“×™×:</span> ××™×Ÿ ××™×¡×•×£ ×ž×™×œ×“×™×.",
    privacy_li_us3:
      "<span class='highlight'>××‘×˜×—×”:</span> ×ž×•×¦×¤×Ÿ ×”×™×˜×‘.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> ×©×§×•×£.",
    privacy_h9: "9. ×¡×™×Ÿ",
    privacy_p9: "×ª××™×ž×•×ª PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>×ž×™× ×™×ž×•×:</span> ×¨×§ ×ž×” ×©×¦×¨×™×š.",
    privacy_li_cn2: "<span class='highlight'>×”×¢×‘×¨×”:</span> ×ž××•×‘×˜×—×ª.",
    privacy_li_cn3:
      "<span class='highlight'>DSL:</span> ×œ× × ×ª×•× ×™× ×¨×’×™×©×™×.",
  },
  id: {
    privacy_title: "Kebijakan Privasi",
    privacy_last_update: "Terakhir diperbarui: 29 April 2026",
    privacy_intro:
      "Aplikasi <strong>mon50ccetmoi</strong> berkomitmen untuk melindungi privasi Anda.",
    privacy_h1: "1. Pengumpulan Data",
    privacy_p1: "Kami mengumpulkan:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Untuk navigasi dan deteksi jatuh.",
    privacy_li2:
      "<span class='highlight'>Latar Belakang:</span> Untuk peringatan darurat.",
    privacy_li3: "<span class='highlight'>Foto:</span> Untuk laporan asuransi.",
    privacy_li4:
      "<span class='highlight'>Kontak:</span> Disimpan lokal untuk SMS.",
    privacy_h2: "2. Berbagi Data",
    privacy_p2: "Tidak pernah dijual.",
    privacy_li_share1:
      "<span class='highlight'>Bahaya:</span> Dibagikan secara anonim.",
    privacy_li_share2:
      "<span class='highlight'>Asuransi:</span> <strong>Hanya dengan PIN Anda</strong>.",
    privacy_h3: "3. Hak GDPR",
    privacy_p3: "Hak Anda:",
    privacy_li_right1:
      "<span class='highlight'>Akses:</span> Dapatkan salinan.",
    privacy_li_right2:
      "<span class='highlight'>Perbaikan:</span> Koreksi data.",
    privacy_li_right3:
      "<span class='highlight'>Penghapusan:</span> Hapus akun.",
    privacy_li_right4:
      "<span class='highlight'>Pembatasan:</span> Bekukan data.",
    privacy_li_right5:
      "<span class='highlight'>Portabilitas:</span> Ambil data.",
    privacy_li_right6:
      "<span class='highlight'>Keberatan:</span> Tolak penggunaan.",
    privacy_h4: "4. Keamanan",
    privacy_p4: "Enkripsi AES-256.",
    privacy_h5: "5. Kontak",
    privacy_p5_1: "Penanggung Jawab: Xavier Le Chanu.",
    privacy_p5_2: "Email: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Anda dapat mengadu ke otoritas terkait.",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "Hanya yang penting.",
    privacy_li_cookie1: "<span class='highlight'>Penting:</span> Untuk masuk.",
    privacy_li_cookie2: "<span class='highlight'>Lokal:</span> Pengaturan.",
    privacy_p6_2: "Tanpa iklan.",
    privacy_h7: "7. AI Act",
    privacy_p7: "Transparansi AI:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> Berinteraksi dengan AI.",
    privacy_li_ai2:
      "<span class='highlight'>Manusia:</span> Keputusan divalidasi manusia.",
    privacy_li_ai3:
      "<span class='highlight'>Garansi:</span> Bukan pengganti ahli.",
    privacy_h8: "8. AS",
    privacy_p8: "Kepatuhan AS:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> Tidak ada penjualan.",
    privacy_li_us2:
      "<span class='highlight'>COPPA:</span> Tidak ada anak-anak.",
    privacy_li_us3: "<span class='highlight'>Keamanan:</span> Enkripsi kuat.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparan.",
    privacy_h9: "9. Tiongkok",
    privacy_p9: "Kepatuhan PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>Minimal:</span> Hanya yang diperlukan.",
    privacy_li_cn2: "<span class='highlight'>Transfer:</span> Dilindungi.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Aman.",
  },
  hu: {
    privacy_title: "Adatvédelmi IrÃ¡nyelvek",
    privacy_last_update: "UtolsÃ³ frissÃ­tés: 2026. Ã¡prilis 29.",
    privacy_intro:
      "A <strong>mon50ccetmoi</strong> elkötelezett az Ã–n magÃ¡néletének védelme irÃ¡nt.",
    privacy_h1: "1. AdatgyÅ±jtés",
    privacy_p1: "Ezeket gyÅ±jtjük:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> NavigÃ¡ciÃ³ és esésérzékelés.",
    privacy_li2: "<span class='highlight'>HÃ¡ttér:</span> Vészjelzésekhez.",
    privacy_li3:
      "<span class='highlight'>FotÃ³k:</span> BiztosÃ­tÃ¡si jelentésekhez.",
    privacy_li4:
      "<span class='highlight'>Névjegyek:</span> Helyi tÃ¡rolÃ¡s SMS-hez.",
    privacy_h2: "2. AdatmegosztÃ¡s",
    privacy_p2: "Soha nem adjuk el.",
    privacy_li_share1:
      "<span class='highlight'>Veszélyek:</span> Névtelenül osztva.",
    privacy_li_share2:
      "<span class='highlight'>BiztosÃ­tÃ³:</span> <strong>Csak PIN kÃ³ddal</strong>.",
    privacy_h3: "3. GDPR Jogok",
    privacy_p3: "Az Ã–n jogai:",
    privacy_li_right1:
      "<span class='highlight'>HozzÃ¡férés:</span> MÃ¡solat kérése.",
    privacy_li_right2:
      "<span class='highlight'>HelyesbÃ­tés:</span> HibÃ¡k javÃ­tÃ¡sa.",
    privacy_li_right3:
      "<span class='highlight'>Törlés:</span> FiÃ³k törlése.",
    privacy_li_right4:
      "<span class='highlight'>KorlÃ¡tozÃ¡s:</span> FagyasztÃ¡s.",
    privacy_li_right5:
      "<span class='highlight'>HordozhatÃ³sÃ¡g:</span> Adatok exportÃ¡lÃ¡sa.",
    privacy_li_right6:
      "<span class='highlight'>TiltakozÃ¡s:</span> HasznÃ¡lat leÃ¡llÃ­tÃ¡sa.",
    privacy_h4: "4. BiztonsÃ¡g",
    privacy_p4: "AES-256 titkosÃ­tÃ¡s.",
    privacy_h5: "5. Kapcsolat",
    privacy_p5_1: "FelelÅ‘s: Xavier Le Chanu.",
    privacy_p5_2: "E-mail: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Panasztétel a hatÃ³sÃ¡gnÃ¡l.",
    privacy_h6: "6. Sütik (Cookies)",
    privacy_p6_1: "Csak alapvetÅ‘ sütik.",
    privacy_li_cookie1:
      "<span class='highlight'>AlapvetÅ‘:</span> Bejelentkezéshez.",
    privacy_li_cookie2:
      "<span class='highlight'>Helyi:</span> BeÃ¡llÃ­tÃ¡sokhoz.",
    privacy_p6_2: "Nincs reklÃ¡m.",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI Ã¡tlÃ¡thatÃ³sÃ¡g:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> Mesterséges intelligencia hasznÃ¡lata.",
    privacy_li_ai2:
      "<span class='highlight'>Emberi:</span> Nincs ember nélküli döntés.",
    privacy_li_ai3:
      "<span class='highlight'>Garancia:</span> Nem pÃ³tolja a szakembert.",
    privacy_h8: "8. USA",
    privacy_p8: "USA szabÃ¡lyok:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> Nincs eladÃ¡s.",
    privacy_li_us2:
      "<span class='highlight'>Gyermekek:</span> Nincs adatgyÅ±jtés.",
    privacy_li_us3: "<span class='highlight'>BiztonsÃ¡g:</span> TitkosÃ­tott.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> ÃtlÃ¡thatÃ³.",
    privacy_h9: "9. KÃ­na (PIPL)",
    privacy_p9: "SzigorÃº megfelelés:",
    privacy_li_cn1:
      "<span class='highlight'>MinimalizÃ¡lÃ¡s:</span> Csak a szükséges.",
    privacy_li_cn2: "<span class='highlight'>Transzfer:</span> Védett.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Nem érzékeny.",
  },
  hi: {
    privacy_title: "à¤—à¥‹à¤ªà¤¨à¥€à¤¯à¤¤à¤¾ à¤¨à¥€à¤¤à¤¿",
    privacy_last_update:
      "à¤…à¤‚à¤¤à¤¿à¤® à¤…à¤ªà¤¡à¥‡à¤Ÿ: 29 à¤…à¤ªà¥à¤°à¥ˆà¤² 2026",
    privacy_intro:
      "<strong>mon50ccetmoi</strong> à¤à¤ª à¤†à¤ªà¤•à¥€ à¤—à¥‹à¤ªà¤¨à¥€à¤¯à¤¤à¤¾ à¤•à¥€ à¤°à¤•à¥à¤·à¤¾ à¤•à¥‡ à¤²à¤¿à¤ à¤ªà¥à¤°à¤¤à¤¿à¤¬à¤¦à¥à¤§ à¤¹à¥ˆà¥¤",
    privacy_h1: "1. à¤¡à¥‡à¤Ÿà¤¾ à¤¸à¤‚à¤—à¥à¤°à¤¹",
    privacy_p1: "à¤¹à¤® à¤à¤•à¤¤à¥à¤° à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> à¤¨à¥‡à¤µà¤¿à¤—à¥‡à¤¶à¤¨ à¤”à¤° à¤—à¤¿à¤°à¤¾à¤µà¤Ÿ à¤•à¤¾ à¤ªà¤¤à¤¾ à¤²à¤—à¤¾à¤¨à¥‡ à¤•à¥‡ à¤²à¤¿à¤à¥¤",
    privacy_li2:
      "<span class='highlight'>à¤¬à¥ˆà¤•à¤—à¥à¤°à¤¾à¤‰à¤‚à¤¡:</span> à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤…à¤²à¤°à¥à¤Ÿ à¤•à¥‡ à¤²à¤¿à¤à¥¤",
    privacy_li3:
      "<span class='highlight'>à¤¤à¤¸à¥à¤µà¥€à¤°à¥‡à¤‚:</span> à¤¬à¥€à¤®à¤¾ à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ à¤•à¥‡ à¤²à¤¿à¤à¥¤",
    privacy_li4:
      "<span class='highlight'>à¤¸à¤‚à¤ªà¤°à¥à¤•:</span> SMS à¤•à¥‡ à¤²à¤¿à¤ à¤¸à¥à¤¥à¤¾à¤¨à¥€à¤¯ à¤°à¥‚à¤ª à¤¸à¥‡ à¤¸à¤¹à¥‡à¤œà¤¾ à¤—à¤¯à¤¾à¥¤",
    privacy_h2: "2. à¤¡à¥‡à¤Ÿà¤¾ à¤¸à¤¾à¤à¤¾ à¤•à¤°à¤¨à¤¾",
    privacy_p2: "à¤•à¤­à¥€ à¤¨à¤¹à¥€à¤‚ à¤¬à¥‡à¤šà¤¾ à¤œà¤¾à¤¤à¤¾à¥¤",
    privacy_li_share1:
      "<span class='highlight'>à¤–à¤¤à¤°à¥‡:</span> à¤—à¥à¤®à¤¨à¤¾à¤® à¤°à¥‚à¤ª à¤¸à¥‡ à¤¸à¤¾à¤à¤¾ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾à¥¤",
    privacy_li_share2:
      "<span class='highlight'>à¤¬à¥€à¤®à¤¾à¤•à¤°à¥à¤¤à¤¾:</span> <strong>à¤•à¥‡à¤µà¤² à¤†à¤ªà¤•à¥‡ 6-à¤…à¤‚à¤•à¥€à¤¯ à¤ªà¤¿à¤¨ à¤•à¥‡ à¤¸à¤¾à¤¥</strong>à¥¤",
    privacy_h3: "3. GDPR à¤…à¤§à¤¿à¤•à¤¾à¤°",
    privacy_p3: "à¤†à¤ªà¤•à¥‡ à¤…à¤§à¤¿à¤•à¤¾à¤°:",
    privacy_li_right1:
      "<span class='highlight'>à¤ªà¤¹à¥à¤‚à¤š:</span> à¤•à¥‰à¤ªà¥€ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚à¥¤",
    privacy_li_right2:
      "<span class='highlight'>à¤¸à¥à¤§à¤¾à¤°:</span> à¤—à¤²à¤¤à¤¿à¤¯à¥‹à¤‚ à¤•à¥‹ à¤ à¥€à¤• à¤•à¤°à¥‡à¤‚à¥¤",
    privacy_li_right3:
      "<span class='highlight'>à¤¹à¤Ÿà¤¾à¤¨à¤¾:</span> à¤–à¤¾à¤¤à¤¾ à¤¹à¤Ÿà¤¾à¤à¤‚à¥¤",
    privacy_li_right4:
      "<span class='highlight'>à¤ªà¥à¤°à¤¤à¤¿à¤¬à¤‚à¤§:</span> à¤‰à¤ªà¤¯à¥‹à¤— à¤°à¥‹à¤•à¥‡à¤‚à¥¤",
    privacy_li_right5:
      "<span class='highlight'>à¤ªà¥‹à¤°à¥à¤Ÿà¥‡à¤¬à¤¿à¤²à¤¿à¤Ÿà¥€:</span> à¤¡à¥‡à¤Ÿà¤¾ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚à¥¤",
    privacy_li_right6:
      "<span class='highlight'>à¤†à¤ªà¤¤à¥à¤¤à¤¿:</span> à¤‰à¤ªà¤¯à¥‹à¤— à¤•à¤¾ à¤µà¤¿à¤°à¥‹à¤§ à¤•à¤°à¥‡à¤‚à¥¤",
    privacy_h4: "4. à¤¸à¥à¤°à¤•à¥à¤·à¤¾",
    privacy_p4: "AES-256 à¤à¤¨à¥à¤•à¥à¤°à¤¿à¤ªà¥à¤¶à¤¨à¥¤",
    privacy_h5: "5. à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚",
    privacy_p5_1:
      "à¤ªà¥à¤°à¤­à¤¾à¤°à¥€: à¤œà¤¼à¥‡à¤µà¤¿à¤¯à¤° à¤²à¥‡ à¤šà¤¾à¤¨à¥‚à¥¤",
    privacy_p5_2: "à¤ˆà¤®à¥‡à¤²: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3:
      "à¤†à¤ª à¤ªà¥à¤°à¤¾à¤§à¤¿à¤•à¤°à¤£ à¤¸à¥‡ à¤¶à¤¿à¤•à¤¾à¤¯à¤¤ à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤",
    privacy_h6: "6. à¤•à¥à¤•à¥€à¤œà¤¼",
    privacy_p6_1: "à¤•à¥‡à¤µà¤² à¤†à¤µà¤¶à¥à¤¯à¤• à¤•à¥à¤•à¥€à¤œà¤¼à¥¤",
    privacy_li_cookie1:
      "<span class='highlight'>à¤†à¤µà¤¶à¥à¤¯à¤•:</span> à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¥‡ à¤²à¤¿à¤à¥¤",
    privacy_li_cookie2:
      "<span class='highlight'>à¤¸à¥à¤¥à¤¾à¤¨à¥€à¤¯:</span> à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤•à¥‡ à¤²à¤¿à¤à¥¤",
    privacy_p6_2: "à¤•à¥‹à¤ˆ à¤µà¤¿à¤œà¥à¤žà¤¾à¤ªà¤¨ à¤¨à¤¹à¥€à¤‚à¥¤",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI à¤ªà¤¾à¤°à¤¦à¤°à¥à¤¶à¤¿à¤¤à¤¾:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> à¤†à¤ª AI à¤•à¥‡ à¤¸à¤¾à¤¥ à¤¬à¤¾à¤¤à¤šà¥€à¤¤ à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤",
    privacy_li_ai2:
      "<span class='highlight'>à¤®à¤¾à¤¨à¤µ:</span> à¤¨à¤¿à¤°à¥à¤£à¤¯ à¤®à¤¾à¤¨à¤µ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤®à¤¾à¤¨à¥à¤¯ à¤¹à¥‹à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤",
    privacy_li_ai3:
      "<span class='highlight'>à¤—à¤¾à¤°à¤‚à¤Ÿà¥€:</span> à¤µà¤¿à¤¶à¥‡à¤·à¤œà¥à¤ž à¤•à¤¾ à¤µà¤¿à¤•à¤²à¥à¤ª à¤¨à¤¹à¥€à¤‚à¥¤",
    privacy_h8: "8. USA",
    privacy_p8: "USA à¤…à¤¨à¥à¤ªà¤¾à¤²à¤¨:",
    privacy_li_us1:
      "<span class='highlight'>CCPA:</span> à¤•à¥‹à¤ˆ à¤¬à¤¿à¤•à¥à¤°à¥€ à¤¨à¤¹à¥€à¤‚à¥¤",
    privacy_li_us2:
      "<span class='highlight'>à¤¬à¤šà¥à¤šà¥‡:</span> à¤•à¥‹à¤ˆ à¤¸à¤‚à¤—à¥à¤°à¤¹ à¤¨à¤¹à¥€à¤‚à¥¤",
    privacy_li_us3:
      "<span class='highlight'>à¤¸à¥à¤°à¤•à¥à¤·à¤¾:</span> à¤à¤¨à¥à¤•à¥à¤°à¤¿à¤ªà¥à¤Ÿà¥‡à¤¡à¥¤",
    privacy_li_us4:
      "<span class='highlight'>B2B:</span> à¤ªà¤¾à¤°à¤¦à¤°à¥à¤¶à¥€à¥¤",
    privacy_h9: "9. à¤šà¥€à¤¨ (PIPL)",
    privacy_p9: "PIPL à¤…à¤¨à¥à¤ªà¤¾à¤²à¤¨:",
    privacy_li_cn1:
      "<span class='highlight'>à¤¨à¥à¤¯à¥‚à¤¨à¥€à¤•à¤°à¤£:</span> à¤•à¥‡à¤µà¤² à¤†à¤µà¤¶à¥à¤¯à¤•à¥¤",
    privacy_li_cn2:
      "<span class='highlight'>à¤¸à¥à¤¥à¤¾à¤¨à¤¾à¤‚à¤¤à¤°à¤£:</span> à¤¸à¤‚à¤°à¤•à¥à¤·à¤¿à¤¤à¥¤",
    privacy_li_cn3:
      "<span class='highlight'>DSL:</span> à¤®à¤¹à¤¤à¥à¤µà¤ªà¥‚à¤°à¥à¤£ à¤¡à¥‡à¤Ÿà¤¾ à¤¨à¤¹à¥€à¤‚à¥¤",
  },
  fi: {
    privacy_title: "Tietosuojakäytäntö",
    privacy_last_update: "Päivitetty: 29. huhtikuuta 2026",
    privacy_intro:
      "<strong>mon50ccetmoi</strong> on sitoutunut suojelemaan yksityisyyttäsi.",
    privacy_h1: "1. Tiedonkeruu",
    privacy_p1: "Keräämme:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Navigointiin ja kaatumisen tunnistukseen.",
    privacy_li2: "<span class='highlight'>Tausta:</span> Hätäilmoituksiin.",
    privacy_li3: "<span class='highlight'>Kuvat:</span> Vakuutusraportteihin.",
    privacy_li4:
      "<span class='highlight'>Yhteystiedot:</span> Tallennetaan paikallisesti SMS-viestejä varten.",
    privacy_h2: "2. Tietojen jakaminen",
    privacy_p2: "Ei koskaan myydä.",
    privacy_li_share1:
      "<span class='highlight'>Vaarat:</span> Jaetaan nimettömästi.",
    privacy_li_share2:
      "<span class='highlight'>Vakuutus:</span> <strong>Vain PIN-koodillasi</strong>.",
    privacy_h3: "3. GDPR Oikeudet",
    privacy_p3: "Oikeutesi:",
    privacy_li_right1: "<span class='highlight'>Pääsy:</span> Hanki kopio.",
    privacy_li_right2:
      "<span class='highlight'>Oikaisu:</span> Korjaa virheet.",
    privacy_li_right3: "<span class='highlight'>Poisto:</span> Poista tili.",
    privacy_li_right4:
      "<span class='highlight'>Rajoitus:</span> Jäädytä käyttö.",
    privacy_li_right5:
      "<span class='highlight'>Siirrettävyys:</span> Hae tiedot.",
    privacy_li_right6:
      "<span class='highlight'>Vastus:</span> Lopeta käsittely.",
    privacy_h4: "4. Turvallisuus",
    privacy_p4: "AES-256-salaus.",
    privacy_h5: "5. Yhteystiedot",
    privacy_p5_1: "Vastuuhenkilö: Xavier Le Chanu.",
    privacy_p5_2: "Sähköposti: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Voit tehdä valituksen viranomaiselle.",
    privacy_h6: "6. Evästeet",
    privacy_p6_1: "Vain välttämättömät evästeet.",
    privacy_li_cookie1:
      "<span class='highlight'>Välttämätön:</span> Kirjautumiseen.",
    privacy_li_cookie2:
      "<span class='highlight'>Paikallinen:</span> Asetuksille.",
    privacy_p6_2: "Ei mainoksia.",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI-läpinäkyvyys:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> Olet vuorovaikutuksessa AI:n kanssa.",
    privacy_li_ai2:
      "<span class='highlight'>Ihminen:</span> Ihmisen vahvistamat päätökset.",
    privacy_li_ai3:
      "<span class='highlight'>Takuu:</span> Ei korvaa asiantuntijaa.",
    privacy_h8: "8. USA",
    privacy_p8: "CCPA-yhteensopiva:",
    privacy_li_us1:
      "<span class='highlight'>Ei myyntiä:</span> Emme myy tietoja.",
    privacy_li_us2: "<span class='highlight'>Lapset:</span> Ei lasten tietoja.",
    privacy_li_us3: "<span class='highlight'>Turvallisuus:</span> Salattu.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Läpinäkyvä.",
    privacy_h9: "9. Kiina (PIPL)",
    privacy_p9: "PIPL-yhteensopiva:",
    privacy_li_cn1:
      "<span class='highlight'>Minimointi:</span> Vain tarvittava.",
    privacy_li_cn2: "<span class='highlight'>Siirto:</span> Suojattu.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Ei herkkää dataa.",
  },
  da: {
    privacy_title: "Privatlivspolitik",
    privacy_last_update: "Sidst opdateret: 29. april 2026",
    privacy_intro:
      "Appen <strong>mon50ccetmoi</strong> er forpligtet til at beskytte dit privatliv.",
    privacy_h1: "1. Dataindsamling",
    privacy_p1: "Vi indsamler:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Til navigation og falddetektion.",
    privacy_li2: "<span class='highlight'>Baggrund:</span> Til nødalarm.",
    privacy_li3:
      "<span class='highlight'>Billeder:</span> Til forsikringsrapporter.",
    privacy_li4:
      "<span class='highlight'>Kontakter:</span> Gemt lokalt til SMS.",
    privacy_h2: "2. Datadeling",
    privacy_p2: "Sælges aldrig.",
    privacy_li_share1: "<span class='highlight'>Farer:</span> Deles anonymt.",
    privacy_li_share2:
      "<span class='highlight'>Forsikring:</span> <strong>Kun med din PIN-kode</strong>.",
    privacy_h3: "3. GDPR Rettigheder",
    privacy_p3: "Dine rettigheder:",
    privacy_li_right1: "<span class='highlight'>Indsigt:</span> Få en kopi.",
    privacy_li_right2: "<span class='highlight'>Rettelse:</span> Ret fejl.",
    privacy_li_right3: "<span class='highlight'>Sletning:</span> Slet konto.",
    privacy_li_right4:
      "<span class='highlight'>Begrænsning:</span> Frys data.",
    privacy_li_right5:
      "<span class='highlight'>Portabilitet:</span> Eksporter data.",
    privacy_li_right6: "<span class='highlight'>Indsigelse:</span> Stop brug.",
    privacy_h4: "4. Sikkerhed",
    privacy_p4: "AES-256 kryptering.",
    privacy_h5: "5. Kontakt",
    privacy_p5_1: "Ansvarlig: Xavier Le Chanu.",
    privacy_p5_2: "E-mail: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Du kan klage til tilsynsmyndigheden.",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "Kun nødvendige cookies.",
    privacy_li_cookie1: "<span class='highlight'>Nødvendig:</span> Til login.",
    privacy_li_cookie2:
      "<span class='highlight'>Lokal:</span> Til indstillinger.",
    privacy_p6_2: "Ingen annoncer.",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI gennemsigtighed:",
    privacy_li_ai1: "<span class='highlight'>AI:</span> Du bruger AI.",
    privacy_li_ai2:
      "<span class='highlight'>Menneskelig:</span> Tjekkes af mennesker.",
    privacy_li_ai3:
      "<span class='highlight'>Garanti:</span> Erstatter ikke eksperter.",
    privacy_h8: "8. USA",
    privacy_p8: "USA-kompatibel:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> Ingen salg af data.",
    privacy_li_us2: "<span class='highlight'>Børn:</span> Ingen indsamling.",
    privacy_li_us3: "<span class='highlight'>Sikkerhed:</span> Krypteret.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparent.",
    privacy_h9: "9. Kina (PIPL)",
    privacy_p9: "Følger PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>Minimering:</span> Kun nødvendigt.",
    privacy_li_cn2: "<span class='highlight'>Overførsel:</span> Sikret.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Ikke kritisk data.",
  },
  ro: {
    privacy_title: "Politica de ConfidenÈ›ialitate",
    privacy_last_update: "Ultima actualizare: 29 aprilie 2026",
    privacy_intro:
      "AplicaÈ›ia <strong>mon50ccetmoi</strong> se angajeazÄƒ sÄƒ vÄƒ protejeze confidenÈ›ialitatea.",
    privacy_h1: "1. Colectarea datelor",
    privacy_p1: "ColectÄƒm:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Pentru navigaÈ›ie È™i detectarea cÄƒderilor.",
    privacy_li2:
      "<span class='highlight'>Fundal:</span> Pentru alerte de urgenÈ›Äƒ.",
    privacy_li3:
      "<span class='highlight'>Fotografii:</span> Pentru rapoarte de asigurare.",
    privacy_li4:
      "<span class='highlight'>Contacte:</span> Salvate local pentru SMS.",
    privacy_h2: "2. Partajarea datelor",
    privacy_p2: "Nu sunt vândute niciodatÄƒ.",
    privacy_li_share1:
      "<span class='highlight'>Pericole:</span> Partajate anonim.",
    privacy_li_share2:
      "<span class='highlight'>AsigurÄƒtor:</span> <strong>Doar cu codul dvs. PIN</strong>.",
    privacy_h3: "3. Drepturi GDPR",
    privacy_p3: "Drepturile dvs.:",
    privacy_li_right1:
      "<span class='highlight'>Acces:</span> ObÈ›ineÈ›i o copie.",
    privacy_li_right2:
      "<span class='highlight'>Rectificare:</span> CorectaÈ›i greÈ™elile.",
    privacy_li_right3:
      "<span class='highlight'>È˜tergere:</span> È˜tergeÈ›i contul.",
    privacy_li_right4:
      "<span class='highlight'>RestricÈ›ionare:</span> ÃŽngheÈ›aÈ›i datele.",
    privacy_li_right5:
      "<span class='highlight'>Portabilitate:</span> ExportaÈ›i datele.",
    privacy_li_right6:
      "<span class='highlight'>OpoziÈ›ie:</span> OpriÈ›i utilizarea.",
    privacy_h4: "4. Securitate",
    privacy_p4: "Criptare AES-256.",
    privacy_h5: "5. Contact",
    privacy_p5_1: "Responsabil: Xavier Le Chanu.",
    privacy_p5_2: "E-mail: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "PuteÈ›i depune o plângere la autoritate.",
    privacy_h6: "6. Cookie-uri",
    privacy_p6_1: "Doar cele esenÈ›iale.",
    privacy_li_cookie1:
      "<span class='highlight'>EsenÈ›ial:</span> Pentru autentificare.",
    privacy_li_cookie2: "<span class='highlight'>Local:</span> Pentru setÄƒri.",
    privacy_p6_2: "FÄƒrÄƒ reclame.",
    privacy_h7: "7. AI Act",
    privacy_p7: "TransparenÈ›Äƒ AI:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> InteracÈ›ionaÈ›i cu AI.",
    privacy_li_ai2:
      "<span class='highlight'>Uman:</span> Decizii validate uman.",
    privacy_li_ai3:
      "<span class='highlight'>GaranÈ›ie:</span> Nu înlocuieÈ™te expertul.",
    privacy_h8: "8. SUA",
    privacy_p8: "Conformitate SUA:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> FÄƒrÄƒ vânzÄƒri.",
    privacy_li_us2: "<span class='highlight'>Copii:</span> FÄƒrÄƒ colectare.",
    privacy_li_us3: "<span class='highlight'>Securitate:</span> Criptat.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparent.",
    privacy_h9: "9. China (PIPL)",
    privacy_p9: "Conform PIPL:",
    privacy_li_cn1: "<span class='highlight'>Minimizare:</span> Doar necesar.",
    privacy_li_cn2: "<span class='highlight'>Transfer:</span> Securizat.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Nu e critic.",
  },
  sk: {
    privacy_title: "ZÃ¡sady Ochrany OsobnÃ½ch Ãšdajov",
    privacy_last_update: "PoslednÃ¡ aktualizÃ¡cia: 29. aprÃ­la 2026",
    privacy_intro:
      "AplikÃ¡cia <strong>mon50ccetmoi</strong> sa zaviazala chrÃ¡niÅ¥ vaÅ¡e sÃºkromie.",
    privacy_h1: "1. Zber DÃ¡t",
    privacy_p1: "ZhromaÅ¾Äujeme:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Pre navigÃ¡ciu a detekciu pÃ¡du.",
    privacy_li2:
      "<span class='highlight'>Pozadie:</span> Pre nÃºdzové upozornenia.",
    privacy_li3: "<span class='highlight'>Fotky:</span> Pre poistné udalosti.",
    privacy_li4:
      "<span class='highlight'>Kontakty:</span> UloÅ¾ené lokÃ¡lne pre SMS.",
    privacy_h2: "2. ZdieÄ¾anie DÃ¡t",
    privacy_p2: "Nikdy sa nepredÃ¡vajÃº.",
    privacy_li_share1:
      "<span class='highlight'>NebezpeÄenstvÃ¡:</span> ZdieÄ¾ané anonymne.",
    privacy_li_share2:
      "<span class='highlight'>PoisÅ¥ovÅˆa:</span> <strong>Len s vaÅ¡Ã­m PIN kÃ³dom</strong>.",
    privacy_h3: "3. PrÃ¡va GDPR",
    privacy_p3: "VaÅ¡e prÃ¡va:",
    privacy_li_right1:
      "<span class='highlight'>PrÃ­stup:</span> ZÃ­skajte kÃ³piu.",
    privacy_li_right2: "<span class='highlight'>Oprava:</span> Opravte chyby.",
    privacy_li_right3:
      "<span class='highlight'>Vymazanie:</span> ZmaÅ¾te ÃºÄet.",
    privacy_li_right4:
      "<span class='highlight'>Obmedzenie:</span> Zmrazte Ãºdaje.",
    privacy_li_right5:
      "<span class='highlight'>PrenosnosÅ¥:</span> Exportujte dÃ¡ta.",
    privacy_li_right6:
      "<span class='highlight'>NÃ¡mietka:</span> Zastavte pouÅ¾itie.",
    privacy_h4: "4. BezpeÄnosÅ¥",
    privacy_p4: "Å ifrovanie AES-256.",
    privacy_h5: "5. Kontakt",
    privacy_p5_1: "ZodpovednÃ¡ osoba: Xavier Le Chanu.",
    privacy_p5_2: "E-mail: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "MôÅ¾ete podaÅ¥ sÅ¥aÅ¾nosÅ¥ na Ãºrad.",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "Len nevyhnutné sÃºbory cookie.",
    privacy_li_cookie1:
      "<span class='highlight'>Nevyhnutné:</span> Pre prihlÃ¡senie.",
    privacy_li_cookie2:
      "<span class='highlight'>LokÃ¡lne:</span> Pre nastavenia.",
    privacy_p6_2: "Å½iadne reklamy.",
    privacy_h7: "7. AI Act",
    privacy_p7: "TransparentnosÅ¥ AI:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> PouÅ¾Ã­vate umelÃº inteligenciu.",
    privacy_li_ai2:
      "<span class='highlight'>Ä½udskÃ½:</span> Rozhodnutia overujÃº Ä¾udia.",
    privacy_li_ai3:
      "<span class='highlight'>ZÃ¡ruka:</span> NenahrÃ¡dza experta.",
    privacy_h8: "8. USA",
    privacy_p8: "V sÃºlade s CCPA:",
    privacy_li_us1:
      "<span class='highlight'>ZÃ¡kaz predaja:</span> NepredÃ¡vame Ãºdaje.",
    privacy_li_us2:
      "<span class='highlight'>Deti:</span> NezhromaÅ¾Äujeme Ãºdaje.",
    privacy_li_us3: "<span class='highlight'>BezpeÄnosÅ¥:</span> Å ifrované.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparentné.",
    privacy_h9: "9. ÄŒÃ­na (PIPL)",
    privacy_p9: "V sÃºlade s PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>MinimalizÃ¡cia:</span> Len to nevyhnutné.",
    privacy_li_cn2: "<span class='highlight'>Prenos:</span> ZabezpeÄené.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Nie citlivé.",
  },
  sv: {
    privacy_title: "Integritetspolicy",
    privacy_last_update: "Senast uppdaterad: 29 april 2026",
    privacy_intro:
      "Appen <strong>mon50ccetmoi</strong> har åtagit sig att skydda din integritet.",
    privacy_h1: "1. Datainsamling",
    privacy_p1: "Vi samlar in:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> För navigering och falldetektering.",
    privacy_li2: "<span class='highlight'>Bakgrund:</span> För nödlarm.",
    privacy_li3:
      "<span class='highlight'>Foton:</span> För försäkringsrapporter.",
    privacy_li4:
      "<span class='highlight'>Kontakter:</span> Spara lokalt för SMS.",
    privacy_h2: "2. Datadelning",
    privacy_p2: "Säljs aldrig.",
    privacy_li_share1: "<span class='highlight'>Faror:</span> Delas anonymt.",
    privacy_li_share2:
      "<span class='highlight'>Försäkring:</span> <strong>Endast med din PIN-kod</strong>.",
    privacy_h3: "3. GDPR-rättigheter",
    privacy_p3: "Dina rättigheter:",
    privacy_li_right1:
      "<span class='highlight'>Tillgång:</span> Få en kopia.",
    privacy_li_right2: "<span class='highlight'>Rättelse:</span> Rätta fel.",
    privacy_li_right3: "<span class='highlight'>Radering:</span> Radera konto.",
    privacy_li_right4:
      "<span class='highlight'>Begränsning:</span> Frys data.",
    privacy_li_right5:
      "<span class='highlight'>Portabilitet:</span> Exportera data.",
    privacy_li_right6:
      "<span class='highlight'>Invändning:</span> Stoppa användning.",
    privacy_h4: "4. Säkerhet",
    privacy_p4: "AES-256-kryptering.",
    privacy_h5: "5. Kontakt",
    privacy_p5_1: "Ansvarig: Xavier Le Chanu.",
    privacy_p5_2: "E-post: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Du kan klaga till datainspektionen.",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "Endast viktiga cookies.",
    privacy_li_cookie1:
      "<span class='highlight'>Viktiga:</span> För inloggning.",
    privacy_li_cookie2:
      "<span class='highlight'>Lokala:</span> För inställningar.",
    privacy_p6_2: "Inga annonser.",
    privacy_h7: "7. AI Act",
    privacy_p7: "AI-transparens:",
    privacy_li_ai1: "<span class='highlight'>AI:</span> Du interagerar med AI.",
    privacy_li_ai2:
      "<span class='highlight'>Människa:</span> Mänsklig validering krävs.",
    privacy_li_ai3:
      "<span class='highlight'>Garanti:</span> Ersätter inte experter.",
    privacy_h8: "8. USA",
    privacy_p8: "USA-kompatibel:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> Ingen försäljning.",
    privacy_li_us2: "<span class='highlight'>Barn:</span> Ingen insamling.",
    privacy_li_us3: "<span class='highlight'>Säkerhet:</span> Krypterat.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Transparent.",
    privacy_h9: "9. Kina (PIPL)",
    privacy_p9: "Följer PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>Minimering:</span> Endast nödvändigt.",
    privacy_li_cn2: "<span class='highlight'>Ã–verföring:</span> Säkrad.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Inte kritisk data.",
  },
  th: {
    privacy_title:
      "à¸™à¹‚à¸¢à¸šà¸²à¸¢à¸„à¸§à¸²à¸¡à¹€à¸›à¹‡à¸™à¸ªà¹ˆà¸§à¸™à¸•à¸±à¸§",
    privacy_last_update:
      "à¸­à¸±à¸›à¹€à¸”à¸•à¸¥à¹ˆà¸²à¸ªà¸¸à¸”: 29 à¹€à¸¡à¸©à¸²à¸¢à¸™ 2026",
    privacy_intro:
      "à¹à¸­à¸› <strong>mon50ccetmoi</strong> à¸¡à¸¸à¹ˆà¸‡à¸¡à¸±à¹ˆà¸™à¸—à¸µà¹ˆà¸ˆà¸°à¸›à¸à¸›à¹‰à¸­à¸‡à¸„à¸§à¸²à¸¡à¹€à¸›à¹‡à¸™à¸ªà¹ˆà¸§à¸™à¸•à¸±à¸§à¸‚à¸­à¸‡à¸„à¸¸à¸“",
    privacy_h1: "1. à¸à¸²à¸£à¹€à¸à¹‡à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥",
    privacy_p1: "à¹€à¸£à¸²à¹€à¸à¹‡à¸šà¸£à¸§à¸šà¸£à¸§à¸¡:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¸™à¸³à¸—à¸²à¸‡à¹à¸¥à¸°à¸•à¸£à¸§à¸ˆà¸ˆà¸±à¸šà¸à¸²à¸£à¸¥à¹‰à¸¡",
    privacy_li2:
      "<span class='highlight'>à¸žà¸·à¹‰à¸™à¸«à¸¥à¸±à¸‡:</span> à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™à¸‰à¸¸à¸à¹€à¸‰à¸´à¸™",
    privacy_li3:
      "<span class='highlight'>à¸£à¸¹à¸›à¸ à¸²à¸ž:</span> à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸²à¸¢à¸‡à¸²à¸™à¸›à¸£à¸°à¸à¸±à¸™à¸ à¸±à¸¢",
    privacy_li4:
      "<span class='highlight'>à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸•à¸´à¸”à¸•à¹ˆà¸­:</span> à¸šà¸±à¸™à¸—à¸¶à¸à¹ƒà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸ªà¹ˆà¸‡ SMS",
    privacy_h2: "2. à¸à¸²à¸£à¹à¸šà¹ˆà¸‡à¸›à¸±à¸™à¸‚à¹‰à¸­à¸¡à¸¹à¸¥",
    privacy_p2: "à¹„à¸¡à¹ˆà¹€à¸„à¸¢à¸–à¸¹à¸à¸‚à¸²à¸¢",
    privacy_li_share1:
      "<span class='highlight'>à¸­à¸±à¸™à¸•à¸£à¸²à¸¢:</span> à¹à¸šà¹ˆà¸‡à¸›à¸±à¸™à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸Šà¸·à¹ˆà¸­",
    privacy_li_share2:
      "<span class='highlight'>à¸›à¸£à¸°à¸à¸±à¸™à¸ à¸±à¸¢:</span> <strong>à¹€à¸‰à¸žà¸²à¸°à¹€à¸¡à¸·à¹ˆà¸­à¸„à¸¸à¸“à¹ƒà¸«à¹‰ PIN</strong>",
    privacy_h3: "3. à¸ªà¸´à¸—à¸˜à¸´à¹Œ GDPR",
    privacy_p3: "à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸‚à¸­à¸‡à¸„à¸¸à¸“:",
    privacy_li_right1:
      "<span class='highlight'>à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸–à¸¶à¸‡:</span> à¸£à¸±à¸šà¸ªà¸³à¹€à¸™à¸²",
    privacy_li_right2:
      "<span class='highlight'>à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚:</span> à¹à¸à¹‰à¹„à¸‚à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”",
    privacy_li_right3:
      "<span class='highlight'>à¸à¸²à¸£à¸¥à¸š:</span> à¸¥à¸šà¸šà¸±à¸à¸Šà¸µ",
    privacy_li_right4:
      "<span class='highlight'>à¸à¸²à¸£à¸ˆà¸³à¸à¸±à¸”:</span> à¸£à¸°à¸‡à¸±à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥",
    privacy_li_right5:
      "<span class='highlight'>à¸à¸²à¸£à¸žà¸à¸žà¸²:</span> à¸ªà¹ˆà¸‡à¸­à¸­à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥",
    privacy_li_right6:
      "<span class='highlight'>à¸„à¸±à¸”à¸„à¹‰à¸²à¸™:</span> à¸«à¸¢à¸¸à¸”à¸à¸²à¸£à¹ƒà¸Šà¹‰à¸‡à¸²à¸™",
    privacy_h4: "4. à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢",
    privacy_p4: "à¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸£à¸«à¸±à¸ª AES-256",
    privacy_h5: "5. à¸•à¸´à¸”à¸•à¹ˆà¸­",
    privacy_p5_1: "à¸œà¸¹à¹‰à¸£à¸±à¸šà¸œà¸´à¸”à¸Šà¸­à¸š: Xavier Le Chanu",
    privacy_p5_2: "à¸­à¸µà¹€à¸¡à¸¥: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3:
      "à¸„à¸¸à¸“à¸ªà¸²à¸¡à¸²à¸£à¸–à¸£à¹‰à¸­à¸‡à¹€à¸£à¸µà¸¢à¸™à¸•à¹ˆà¸­à¸«à¸™à¹ˆà¸§à¸¢à¸‡à¸²à¸™à¹„à¸”à¹‰",
    privacy_h6: "6. à¸„à¸¸à¸à¸à¸µà¹‰",
    privacy_p6_1: "à¹€à¸‰à¸žà¸²à¸°à¸„à¸¸à¸à¸à¸µà¹‰à¸—à¸µà¹ˆà¸ˆà¸³à¹€à¸›à¹‡à¸™",
    privacy_li_cookie1:
      "<span class='highlight'>à¸ˆà¸³à¹€à¸›à¹‡à¸™:</span> à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š",
    privacy_li_cookie2:
      "<span class='highlight'>à¹ƒà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡:</span> à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²",
    privacy_p6_2: "à¹„à¸¡à¹ˆà¸¡à¸µà¹‚à¸†à¸©à¸“à¸²",
    privacy_h7: "7. à¸ž.à¸£.à¸š. AI",
    privacy_p7: "à¸„à¸§à¸²à¸¡à¹‚à¸›à¸£à¹ˆà¸‡à¹ƒà¸ªà¸‚à¸­à¸‡ AI:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> à¸„à¸¸à¸“à¹‚à¸•à¹‰à¸•à¸­à¸šà¸à¸±à¸š AI",
    privacy_li_ai2:
      "<span class='highlight'>à¸¡à¸™à¸¸à¸©à¸¢à¹Œ:</span> à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹‚à¸”à¸¢à¸¡à¸™à¸¸à¸©à¸¢à¹Œ",
    privacy_li_ai3:
      "<span class='highlight'>à¸à¸²à¸£à¸£à¸±à¸šà¸›à¸£à¸°à¸à¸±à¸™:</span> à¹„à¸¡à¹ˆà¹à¸—à¸™à¸—à¸µà¹ˆà¸œà¸¹à¹‰à¹€à¸Šà¸µà¹ˆà¸¢à¸§à¸Šà¸²à¸",
    privacy_h8: "8. à¸ªà¸«à¸£à¸±à¸à¸­à¹€à¸¡à¸£à¸´à¸à¸²",
    privacy_p8:
      "à¸à¸²à¸£à¸›à¸à¸´à¸šà¸±à¸•à¸´à¸•à¸²à¸¡à¸‚à¸­à¸‡à¸ªà¸«à¸£à¸±à¸à¸¯:",
    privacy_li_us1:
      "<span class='highlight'>CCPA:</span> à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸²à¸£à¸‚à¸²à¸¢à¸‚à¹‰à¸­à¸¡à¸¹à¸¥",
    privacy_li_us2:
      "<span class='highlight'>à¹€à¸”à¹‡à¸:</span> à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸²à¸£à¹€à¸à¹‡à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹€à¸”à¹‡à¸",
    privacy_li_us3:
      "<span class='highlight'>à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢:</span> à¹€à¸‚à¹‰à¸²à¸£à¸«à¸±à¸ª",
    privacy_li_us4: "<span class='highlight'>B2B:</span> à¹‚à¸›à¸£à¹ˆà¸‡à¹ƒà¸ª",
    privacy_h9: "9. à¸ˆà¸µà¸™ (PIPL)",
    privacy_p9: "à¸ªà¸­à¸”à¸„à¸¥à¹‰à¸­à¸‡à¸à¸±à¸š PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>à¸¢à¹ˆà¸­à¸‚à¸™à¸²à¸”:</span> à¹€à¸‰à¸žà¸²à¸°à¸—à¸µà¹ˆà¸ˆà¸³à¹€à¸›à¹‡à¸™",
    privacy_li_cn2:
      "<span class='highlight'>à¹‚à¸­à¸™:</span> à¸›à¹‰à¸­à¸‡à¸à¸±à¸™à¹à¸¥à¹‰à¸§",
    privacy_li_cn3:
      "<span class='highlight'>DSL:</span> à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¸„à¸±à¸",
  },
  tr: {
    privacy_title: "Gizlilik PolitikasÄ±",
    privacy_last_update: "Son güncelleme: 29 Nisan 2026",
    privacy_intro:
      "<strong>mon50ccetmoi</strong> uygulamasÄ± gizliliÄŸinizi korumaya kararlÄ±dÄ±r.",
    privacy_h1: "1. Veri Toplama",
    privacy_p1: "TopladÄ±klarÄ±mÄ±z:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Navigasyon ve düÅŸme tespiti için.",
    privacy_li2:
      "<span class='highlight'>Arka Plan:</span> Acil durum uyarÄ±larÄ± için.",
    privacy_li3:
      "<span class='highlight'>FotoÄŸraflar:</span> Sigorta raporlarÄ± için.",
    privacy_li4:
      "<span class='highlight'>KiÅŸiler:</span> SMS için yerel olarak kaydedilir.",
    privacy_h2: "2. Veri PaylaÅŸÄ±mÄ±",
    privacy_p2: "Asla satÄ±lmaz.",
    privacy_li_share1:
      "<span class='highlight'>Tehlikeler:</span> Anonim olarak paylaÅŸÄ±lÄ±r.",
    privacy_li_share2:
      "<span class='highlight'>SigortacÄ±:</span> <strong>YalnÄ±zca PIN'inizle</strong>.",
    privacy_h3: "3. GDPR HaklarÄ±",
    privacy_p3: "HaklarÄ±nÄ±z:",
    privacy_li_right1:
      "<span class='highlight'>EriÅŸim:</span> Bir kopya alÄ±n.",
    privacy_li_right2:
      "<span class='highlight'>Düzeltme:</span> HatalarÄ± düzeltin.",
    privacy_li_right3: "<span class='highlight'>Silme:</span> HesabÄ± silin.",
    privacy_li_right4:
      "<span class='highlight'>KÄ±sÄ±tlama:</span> Verileri dondurun.",
    privacy_li_right5:
      "<span class='highlight'>TaÅŸÄ±nabilirlik:</span> Verileri dÄ±ÅŸa aktarÄ±n.",
    privacy_li_right6:
      "<span class='highlight'>Ä°tiraz:</span> KullanÄ±mÄ± durdurun.",
    privacy_h4: "4. Güvenlik",
    privacy_p4: "AES-256 ÅŸifreleme.",
    privacy_h5: "5. Ä°letiÅŸim",
    privacy_p5_1: "Sorumlu: Xavier Le Chanu.",
    privacy_p5_2: "E-posta: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "Yetkili kuruma ÅŸikayette bulunabilirsiniz.",
    privacy_h6: "6. Çerezler",
    privacy_p6_1: "YalnÄ±zca temel çerezler.",
    privacy_li_cookie1:
      "<span class='highlight'>Temel:</span> Oturum açmak için.",
    privacy_li_cookie2: "<span class='highlight'>Yerel:</span> Ayarlar için.",
    privacy_p6_2: "Reklam yok.",
    privacy_h7: "7. AI YasasÄ±",
    privacy_p7: "Yapay Zeka ÅžeffaflÄ±ÄŸÄ±:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> Yapay zeka kullanÄ±yorsunuz.",
    privacy_li_ai2:
      "<span class='highlight'>Ä°nsan:</span> Kararlar insan onaylÄ±dÄ±r.",
    privacy_li_ai3:
      "<span class='highlight'>Garanti:</span> UzmanÄ±n yerini tutmaz.",
    privacy_h8: "8. ABD",
    privacy_p8: "ABD uyumluluÄŸu:",
    privacy_li_us1: "<span class='highlight'>CCPA:</span> SatÄ±ÅŸ yok.",
    privacy_li_us2: "<span class='highlight'>Çocuklar:</span> Veri toplanmaz.",
    privacy_li_us3: "<span class='highlight'>Güvenlik:</span> ÅžifrelenmiÅŸ.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> Åžeffaf.",
    privacy_h9: "9. Çin (PIPL)",
    privacy_p9: "PIPL'ye uygun:",
    privacy_li_cn1:
      "<span class='highlight'>Küçültme:</span> YalnÄ±zca gerekli olanlar.",
    privacy_li_cn2: "<span class='highlight'>AktarÄ±m:</span> KorumalÄ±.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> Kritik veri deÄŸil.",
  },
  cs: {
    privacy_title: "ZÃ¡sady ochrany osobnÃ­ch ÃºdajÅ¯",
    privacy_last_update: "PoslednÃ­ aktualizace: 29. dubna 2026",
    privacy_intro:
      "Aplikace <strong>mon50ccetmoi</strong> se zavÃ¡zala chrÃ¡nit vaÅ¡e soukromÃ­.",
    privacy_h1: "1. SbÄ›r dat",
    privacy_p1: "ShromaÅ¾Äujeme:",
    privacy_li1:
      "<span class='highlight'>GPS:</span> Pro navigaci a detekci pÃ¡du.",
    privacy_li2:
      "<span class='highlight'>PozadÃ­:</span> Pro nouzovÃ¡ upozornÄ›nÃ­.",
    privacy_li3:
      "<span class='highlight'>Fotky:</span> Pro zprÃ¡vy o pojiÅ¡tÄ›nÃ­.",
    privacy_li4:
      "<span class='highlight'>Kontakty:</span> UloÅ¾eno lokÃ¡lnÄ› pro SMS.",
    privacy_h2: "2. SdÃ­lenÃ­ dat",
    privacy_p2: "Nikdy se neprodÃ¡vÃ¡.",
    privacy_li_share1:
      "<span class='highlight'>NebezpeÄÃ­:</span> SdÃ­leno anonymnÄ›.",
    privacy_li_share2:
      "<span class='highlight'>PojiÅ¡Å¥ovna:</span> <strong>Pouze s vaÅ¡Ã­m PINem</strong>.",
    privacy_h3: "3. PrÃ¡va GDPR",
    privacy_p3: "VaÅ¡e prÃ¡va:",
    privacy_li_right1:
      "<span class='highlight'>PÅ™Ã­stup:</span> ZÃ­skejte kopii.",
    privacy_li_right2: "<span class='highlight'>Oprava:</span> Opravte chyby.",
    privacy_li_right3: "<span class='highlight'>VÃ½maz:</span> SmaÅ¾te ÃºÄet.",
    privacy_li_right4: "<span class='highlight'>OmezenÃ­:</span> Zmrazte data.",
    privacy_li_right5:
      "<span class='highlight'>PÅ™enositelnost:</span> Exportujte data.",
    privacy_li_right6:
      "<span class='highlight'>NÃ¡mitka:</span> Zastavte zpracovÃ¡nÃ­.",
    privacy_h4: "4. BezpeÄnost",
    privacy_p4: "Å ifrovÃ¡nÃ­ AES-256.",
    privacy_h5: "5. Kontakt",
    privacy_p5_1: "OdpovÄ›dnÃ¡ osoba: Xavier Le Chanu.",
    privacy_p5_2: "E-mail: <strong>contact@mon50ccetmoi.com</strong>",
    privacy_p5_3: "MÅ¯Å¾ete podat stÃ­Å¾nost ÃºÅ™adu.",
    privacy_h6: "6. Cookies",
    privacy_p6_1: "Pouze nezbytné cookies.",
    privacy_li_cookie1:
      "<span class='highlight'>Nezbytné:</span> Pro pÅ™ihlÃ¡Å¡enÃ­.",
    privacy_li_cookie2:
      "<span class='highlight'>LokÃ¡lnÃ­:</span> Pro nastavenÃ­.",
    privacy_p6_2: "Å½Ã¡dné reklamy.",
    privacy_h7: "7. ZÃ¡kon o AI",
    privacy_p7: "Transparentnost AI:",
    privacy_li_ai1:
      "<span class='highlight'>AI:</span> PouÅ¾Ã­vÃ¡te umÄ›lou inteligenci.",
    privacy_li_ai2:
      "<span class='highlight'>LidskÃ½:</span> RozhodnutÃ­ schvalujÃ­ lidé.",
    privacy_li_ai3:
      "<span class='highlight'>ZÃ¡ruka:</span> Nenahrazuje odbornÃ­ka.",
    privacy_h8: "8. USA",
    privacy_p8: "V souladu s CCPA:",
    privacy_li_us1:
      "<span class='highlight'>ZÃ¡kaz prodeje:</span> NeprodÃ¡vÃ¡me data.",
    privacy_li_us2:
      "<span class='highlight'>DÄ›ti:</span> NeshromaÅ¾Äujeme data.",
    privacy_li_us3: "<span class='highlight'>BezpeÄnost:</span> Å ifrovÃ¡no.",
    privacy_li_us4: "<span class='highlight'>B2B:</span> TransparentnÃ­.",
    privacy_h9: "9. ÄŒÃ­na (PIPL)",
    privacy_p9: "V souladu s PIPL:",
    privacy_li_cn1:
      "<span class='highlight'>Minimalizace:</span> Jen to nutné.",
    privacy_li_cn2: "<span class='highlight'>PÅ™enos:</span> ZabezpeÄeno.",
    privacy_li_cn3: "<span class='highlight'>DSL:</span> NenÃ­ kritické.",
  },
};

window.I18N_LEGAL = I18N_LEGAL;
