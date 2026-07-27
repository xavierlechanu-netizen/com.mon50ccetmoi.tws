/**
 * L'ARBITRE DE LA ROUTE - Logic System (MULTILINGUAL & INTERNATIONAL)
 * Based on French Law, EU Directives, and Vienna Convention.
 */

window.processArbitreQuery = async function (query) {
  const q = query.toLowerCase();
  const lang = window.currentLang || "fr";

  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Content Database
  const legalContent = {
    fr: {
      disclaimer:
        '<br><br><small style="color:#666; font-size:0.7rem;">âš ï¸ <em>Ceci est un assistant basÃ© sur les textes officiels, pas un conseil juridique professionnel.</em></small>',
      notFound: `<strong>Verdict de l'Arbitre :</strong> Je n'ai pas trouvÃ© de texte de loi spÃ©cifique.<br><br>ðŸ” <em>PrÃ©cisez (ex: gants, casque, dÃ©bridage...).</em>`,
      scenarios: [
        {
          keywords: ["accident", "dÃ©bridÃ©", "assurance", "responsable"],
          response: `<strong>âš ï¸ CAS CRITIQUE : Accident & ConformitÃ©</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Article L211-1 (Assurances).<br>
                    ðŸŒ <strong>International :</strong> Dans toute l'UE, la modification des performances annule l'homologation.<br>
                    ðŸ”¹ <strong>Verdict :</strong> L'assureur peut exercer un "Droit de Recours" et vous rÃ©clamer le remboursement des dommages versÃ©s aux tiers.`,
        },
        {
          keywords: ["dÃ©bridage", "vitesse", "45", "km/h", "moteur"],
          response: `<strong>ðŸš€ RÃˆGLE : Vitesse & CatÃ©gorie AM</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Article R311-1 (France).<br>
                    ðŸŒ <strong>International :</strong> Directive EuropÃ©enne 2006/126/CE : La catÃ©gorie AM est limitÃ©e Ã  <strong>45 km/h</strong>.<br>
                    ðŸ”¹ <strong>Sanction :</strong> Amende (135â‚¬ en FR) et confiscation du vÃ©hicule.`,
        },
        {
          keywords: ["casque", "gants", "protection", "homologuÃ©", "ce"],
          response: `<strong>ðŸª– Ã‰QUIPEMENT : Normes de sÃ©curitÃ©</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Articles R431-1 et R431-1-2.<br>
                    ðŸŒ <strong>International :</strong> Norme <strong>ECE 22.06</strong> pour les casques et <strong>EN 13594</strong> pour les gants.<br>
                    ðŸ”¹ <strong>Obligation :</strong> Le marquage CE est obligatoire pour circuler en Europe.`,
        },
        {
          keywords: ["contrÃ´le technique", "ct", "visite"],
          response: `<strong>ðŸ”§ RÃ‰GLEMENTATION : ContrÃ´le Technique</strong><br><br>
                    âš–ï¸ <strong>France :</strong> Obligatoire depuis le 15 avril 2024.<br>
                    ðŸŒ <strong>International :</strong> Directive 2014/45/UE imposant le contrÃ´le technique des deux-roues dans l'Union EuropÃ©enne.<br>
                    ðŸ”¹ <strong>DÃ©faut :</strong> Amende de 135â‚¬ et immobilisation.`,
        },
        {
          keywords: ["interfiles", "remontÃ©e", "file"],
          response: `<strong>ðŸï¸ RÃˆGLE : Circulation Inter-Files</strong><br><br>
                    ðŸŒ <strong>Convention de Vienne :</strong> Le dÃ©passement doit se faire par la gauche.<br>
                    âš–ï¸ <strong>SpÃ©cificitÃ© :</strong> En France, la CIF est en expÃ©rimentation sur certaines voies rapides (50 km/h max). Interdite partout ailleurs.`,
        },
        {
          keywords: ["pot", "Ã©chappement", "bruit", "chicane", "db"],
          response: `<strong>ðŸ”Š NUISANCE : Ã‰chappement & Bruit</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Article R318-3 du Code de la Route.<br>
                    ðŸ”¹ <strong>RÃ¨gle :</strong> Tout dispositif rÃ©duisant le bruit (chicane) doit Ãªtre prÃ©sent. L'absence de chicane est passible d'une amende de 135â‚¬ et peut entraÃ®ner l'immobilisation du vÃ©hicule.`,
        },
        {
          keywords: ["passager", "duo", "place", "selle"],
          response: `<strong>ðŸ‘¥ DUO : Transport d'un passager</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Article R431-5.<br>
                    ðŸ”¹ <strong>Condition :</strong> Le cyclomoteur doit possÃ©der une selle biplace et des repose-pieds. Le passager doit obligatoirement porter un casque et des gants homologuÃ©s.`,
        },
        {
          keywords: ["feu", "Ã©clairage", "phare", "clignotant"],
          response: `<strong>ðŸ’¡ VISIBILITÃ‰ : Ã‰clairage obligatoire</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Articles R313-1 Ã  R313-32.<br>
                    ðŸ”¹ <strong>Obligation :</strong> Feux de croisement allumÃ©s de jour comme de nuit. Tout feu non fonctionnel est passible d'une contravention de 3Ã¨me classe (68â‚¬).`,
        },
        {
          keywords: ["autocollant", "rÃ©flÃ©chissant", "casque", "nuit"],
          response: `<strong>âœ¨ SÃ‰CURITÃ‰ : Stickers rÃ©flÃ©chissants</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Article R431-1 et homologation ECE 22.05/22.06.<br>
                    ðŸ”¹ <strong>RÃ¨gle :</strong> 4 stickers rÃ©flÃ©chissants (un sur chaque face) sont obligatoires sur le casque. Absence = 3 points de moins et 135â‚¬ d'amende.`,
        },
        {
          keywords: [
            "tÃ©lÃ©phone",
            "Ã©couteur",
            "musique",
            "kit",
            "main libre",
          ],
          response: `<strong>ðŸ“± USAGE : TÃ©lÃ©phone et Ã‰couteurs</strong><br><br>
                    âš–ï¸ <strong>Loi :</strong> Article R412-6-1.<br>
                    ðŸ”¹ <strong>Interdiction :</strong> Tout dispositif portÃ© Ã  l'oreille (Ã©couteurs, casque audio) est interdit. Seuls les systÃ¨mes intÃ©grÃ©s au casque (Bluetooth sans contact direct avec l'oreille) sont tolÃ©rÃ©s.`,
        },
      ],
    },
    en: {
      disclaimer:
        '<br><br><small style="color:#666; font-size:0.7rem;">âš ï¸ <em>This is an assistant based on official texts, not professional legal advice.</em></small>',
      notFound: `<strong>Referee's Verdict:</strong> I couldn't find a specific law for this.<br><br>ðŸ” <em>Please clarify (e.g., helmet, gloves, tuning...).</em>`,
      scenarios: [
        {
          keywords: ["accident", "tuned", "insurance", "liable"],
          response: `<strong>âš ï¸ CRITICAL CASE: Accident & Compliance</strong><br><br>
                    âš–ï¸ <strong>Law :</strong> EU Directive 2009/103/EC.<br>
                    ðŸŒ <strong>International :</strong> Modifying performance voids the vehicle's type-approval (homologation) worldwide.<br>
                    ðŸ”¹ <strong>Verdict :</strong> The insurer may exercise a "Right of Recourse" and demand you repay all damages paid to third parties.`,
        },
        {
          keywords: ["tuning", "speed", "45", "km/h", "unrestricted"],
          response: `<strong>ðŸš€ RULE: Speed & AM Category</strong><br><br>
                    ðŸŒ <strong>International :</strong> EU Directive 2006/126/EC: The AM category is strictly limited to <strong>45 km/h (28 mph)</strong>.<br>
                    ðŸ”¹ <strong>Sanction :</strong> Heavy fines and vehicle impoundment in most countries.`,
        },
        {
          keywords: ["helmet", "gloves", "protection", "certified", "ce"],
          response: `<strong>ðŸª– EQUIPMENT: Safety Standards</strong><br><br>
                    ðŸŒ <strong>International :</strong> <strong>ECE 22.06</strong> standard for helmets and <strong>EN 13594</strong> for gloves.<br>
                    ðŸ”¹ <strong>Obligation :</strong> CE marking is mandatory for riding in Europe and many international territories.`,
        },
        {
          keywords: ["inspection", "technical", "mot"],
          response: `<strong>ðŸ”§ REGULATION: Technical Inspection</strong><br><br>
                    ðŸŒ <strong>International :</strong> EU Directive 2014/45/EU mandating roadworthiness tests for powered two-wheelers.<br>
                    ðŸ”¹ <strong>Note :</strong> Rules vary by country (e.g., MOT in UK, CT in France). Always check local dates.`,
        },
      ],
    },
  };

  // Fallback logic for other languages (use English as base)
  const content = legalContent[lang] || legalContent["en"];

  // Search for match
  for (const entry of content.scenarios) {
    if (entry.keywords.some((k) => q.includes(k))) {
      return entry.response + content.disclaimer;
    }
  }

  return content.notFound + content.disclaimer;
};
