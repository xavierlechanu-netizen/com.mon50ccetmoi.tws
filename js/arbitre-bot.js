/**
 * L'ARBITRE DE LA ROUTE - Logic System (MULTILINGUAL & INTERNATIONAL)
 * Based on French Law, EU Directives, and Vienna Convention.
 */

window.processArbitreQuery = async function(query) {
    const q = query.toLowerCase();
    const lang = window.currentLang || 'fr';
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Content Database
    const legalContent = {
        fr: {
            disclaimer: '<br><br><small style="color:#666; font-size:0.7rem;">⚠️ <em>Ceci est un assistant basé sur les textes officiels, pas un conseil juridique professionnel.</em></small>',
            notFound: `<strong>Verdict de l'Arbitre :</strong> Je n'ai pas trouvé de texte de loi spécifique.<br><br>🔍 <em>Précisez (ex: gants, casque, débridage...).</em>`,
            scenarios: [
                {
                    keywords: ['accident', 'débridé', 'assurance', 'responsable'],
                    response: `<strong>⚠️ CAS CRITIQUE : Accident & Conformité</strong><br><br>
                    ⚖️ <strong>Loi :</strong> Article L211-1 (Assurances).<br>
                    🌍 <strong>International :</strong> Dans toute l'UE, la modification des performances annule l'homologation.<br>
                    🔹 <strong>Verdict :</strong> L'assureur peut exercer un "Droit de Recours" et vous réclamer le remboursement des dommages versés aux tiers.`
                },
                {
                    keywords: ['débridage', 'vitesse', '45', 'km/h', 'moteur'],
                    response: `<strong>🚀 RÈGLE : Vitesse & Catégorie AM</strong><br><br>
                    ⚖️ <strong>Loi :</strong> Article R311-1 (France).<br>
                    🌍 <strong>International :</strong> Directive Européenne 2006/126/CE : La catégorie AM est limitée à <strong>45 km/h</strong>.<br>
                    🔹 <strong>Sanction :</strong> Amende (135€ en FR) et confiscation du véhicule.`
                },
                {
                    keywords: ['casque', 'gants', 'protection', 'homologué', 'ce'],
                    response: `<strong>🪖 ÉQUIPEMENT : Normes de sécurité</strong><br><br>
                    ⚖️ <strong>Loi :</strong> Articles R431-1 et R431-1-2.<br>
                    🌍 <strong>International :</strong> Norme <strong>ECE 22.06</strong> pour les casques et <strong>EN 13594</strong> pour les gants.<br>
                    🔹 <strong>Obligation :</strong> Le marquage CE est obligatoire pour circuler en Europe.`
                },
                {
                    keywords: ['contrôle technique', 'ct', 'visite'],
                    response: `<strong>🔧 RÉGLEMENTATION : Contrôle Technique</strong><br><br>
                    ⚖️ <strong>France :</strong> Obligatoire depuis le 15 avril 2024.<br>
                    🌍 <strong>International :</strong> Directive 2014/45/UE imposant le contrôle technique des deux-roues dans l'Union Européenne.<br>
                    🔹 <strong>Défaut :</strong> Amende de 135€ et immobilisation.`
                },
                {
                    keywords: ['interfiles', 'remontée', 'file'],
                    response: `<strong>🏍️ RÈGLE : Circulation Inter-Files</strong><br><br>
                    🌍 <strong>Convention de Vienne :</strong> Le dépassement doit se faire par la gauche.<br>
                    ⚖️ <strong>Spécificité :</strong> En France, la CIF est en expérimentation sur certaines voies rapides (50 km/h max). Interdite partout ailleurs.`
                },
                {
                    keywords: ['pot', 'échappement', 'bruit', 'chicane', 'db'],
                    response: `<strong>🔊 NUISANCE : Échappement & Bruit</strong><br><br>
                    ⚖️ <strong>Loi :</strong> Article R318-3 du Code de la Route.<br>
                    🔹 <strong>Règle :</strong> Tout dispositif réduisant le bruit (chicane) doit être présent. L'absence de chicane est passible d'une amende de 135€ et peut entraîner l'immobilisation du véhicule.`
                },
                {
                    keywords: ['passager', 'duo', 'place', 'selle'],
                    response: `<strong>👥 DUO : Transport d'un passager</strong><br><br>
                    ⚖️ <strong>Loi :</strong> Article R431-5.<br>
                    🔹 <strong>Condition :</strong> Le cyclomoteur doit posséder une selle biplace et des repose-pieds. Le passager doit obligatoirement porter un casque et des gants homologués.`
                },
                {
                    keywords: ['feu', 'éclairage', 'phare', 'clignotant'],
                    response: `<strong>💡 VISIBILITÉ : Éclairage obligatoire</strong><br><br>
                    ⚖️ <strong>Loi :</strong> Articles R313-1 à R313-32.<br>
                    🔹 <strong>Obligation :</strong> Feux de croisement allumés de jour comme de nuit. Tout feu non fonctionnel est passible d'une contravention de 3ème classe (68€).`
                }
            ]
        },
        en: {
            disclaimer: '<br><br><small style="color:#666; font-size:0.7rem;">⚠️ <em>This is an assistant based on official texts, not professional legal advice.</em></small>',
            notFound: `<strong>Referee's Verdict:</strong> I couldn't find a specific law for this.<br><br>🔍 <em>Please clarify (e.g., helmet, gloves, tuning...).</em>`,
            scenarios: [
                {
                    keywords: ['accident', 'tuned', 'insurance', 'liable'],
                    response: `<strong>⚠️ CRITICAL CASE: Accident & Compliance</strong><br><br>
                    ⚖️ <strong>Law :</strong> EU Directive 2009/103/EC.<br>
                    🌍 <strong>International :</strong> Modifying performance voids the vehicle's type-approval (homologation) worldwide.<br>
                    🔹 <strong>Verdict :</strong> The insurer may exercise a "Right of Recourse" and demand you repay all damages paid to third parties.`
                },
                {
                    keywords: ['tuning', 'speed', '45', 'km/h', 'unrestricted'],
                    response: `<strong>🚀 RULE: Speed & AM Category</strong><br><br>
                    🌍 <strong>International :</strong> EU Directive 2006/126/EC: The AM category is strictly limited to <strong>45 km/h (28 mph)</strong>.<br>
                    🔹 <strong>Sanction :</strong> Heavy fines and vehicle impoundment in most countries.`
                },
                {
                    keywords: ['helmet', 'gloves', 'protection', 'certified', 'ce'],
                    response: `<strong>🪖 EQUIPMENT: Safety Standards</strong><br><br>
                    🌍 <strong>International :</strong> <strong>ECE 22.06</strong> standard for helmets and <strong>EN 13594</strong> for gloves.<br>
                    🔹 <strong>Obligation :</strong> CE marking is mandatory for riding in Europe and many international territories.`
                },
                {
                    keywords: ['inspection', 'technical', 'mot'],
                    response: `<strong>🔧 REGULATION: Technical Inspection</strong><br><br>
                    🌍 <strong>International :</strong> EU Directive 2014/45/EU mandating roadworthiness tests for powered two-wheelers.<br>
                    🔹 <strong>Note :</strong> Rules vary by country (e.g., MOT in UK, CT in France). Always check local dates.`
                }
            ]
        }
    };

    // Fallback logic for other languages (use English as base)
    const content = legalContent[lang] || legalContent['en'];
    
    // Search for match
    for (const entry of content.scenarios) {
        if (entry.keywords.some(k => q.includes(k))) {
            return entry.response + content.disclaimer;
        }
    }

    return content.notFound + content.disclaimer;
};
