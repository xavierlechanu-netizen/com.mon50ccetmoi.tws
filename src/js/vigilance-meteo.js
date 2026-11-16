/**
 * Vigilance Météo-France, lue par l'appli via le serveur souverain (GET /api/v1/meteo/vigilance),
 * qui garde la clé Météo-France (sovereign-core/server/meteo-vigilance.js).
 *
 * Carte du jour au format Météo-France (DPVigilance v1, cartevigilance/encours) :
 *   product.periods[] : { echeance: "J" | "J1", timelaps: { domain_ids: [ { domain_id, max_color_id,
 *   phenomenon_items: [ { phenomenon_id, phenomenon_max_color_id } ] } ] } }
 * Couleurs : 1 vert, 2 jaune, 3 orange, 4 rouge.
 *
 * Avant (16/11/2026), l'appli cherchait « product.domain » et « nom_dept », qui n'existent pas
 * dans cette réponse : le bandeau rouge ne pouvait jamais s'afficher.
 */

export const COULEURS_VIGILANCE = { 1: 'verte', 2: 'jaune', 3: 'orange', 4: 'rouge' };

export const PHENOMENES = {
  1: 'vent violent',
  2: 'pluie-inondation',
  3: 'orages',
  4: 'crues',
  5: 'neige-verglas',
  6: 'canicule',
  7: 'grand froid',
  8: 'avalanches',
  9: 'vagues-submersion',
};

// Départements de métropole (numéros utilisés par Météo-France), pour un bandeau lisible
const DEPARTEMENTS = {
  '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes',
  '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube',
  '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal',
  '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '2A': 'Corse-du-Sud',
  '2B': 'Haute-Corse', '21': "Côte-d'Or", '22': "Côtes-d'Armor", '23': 'Creuse', '24': 'Dordogne',
  '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère',
  '30': 'Gard', '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde', '34': 'Hérault',
  '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura',
  '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique',
  '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire',
  '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle',
  '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord',
  '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques',
  '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône',
  '70': 'Haute-Saône', '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie',
  '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres',
  '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse',
  '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne',
  '90': 'Territoire de Belfort', '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis',
  '94': 'Val-de-Marne', '95': "Val-d'Oise", '99': 'Andorre',
};

/** Adresse de la route du serveur souverain, ou null s'il n'est pas branché (CONFIG.SOVEREIGN). */
export function vigilanceUrl(sovereignConf) {
  if (!sovereignConf || !sovereignConf.ACTIF || !sovereignConf.API_URL) return null;
  return `${String(sovereignConf.API_URL).replace(/\/+$/, '')}/meteo/vigilance`;
}

/** « Finistère (29) », « Var (83, littoral) » : les zones côtières ont le numéro du département suivi de 10. */
export function nomZone(domainId) {
  const id = String(domainId == null ? '' : domainId).toUpperCase();
  const littoral = /^(\d{2}|2[AB])10$/.exec(id);
  const dep = littoral ? littoral[1] : id;
  const nom = DEPARTEMENTS[dep];
  if (!nom) return `zone ${id}`;
  return littoral ? `${nom} (${dep}, littoral)` : `${nom} (${dep})`;
}

/**
 * Résumé de la carte du jour (échéance J) : niveau maximal en France, zones en rouge (avec leurs
 * risques en rouge) et risques signalés à partir du jaune.
 * null si la réponse n'est pas une carte (serveur non configuré, Météo-France indisponible…).
 */
export function resumeVigilance(data) {
  const periods = data && data.product && Array.isArray(data.product.periods) ? data.product.periods : null;
  if (!periods || periods.length === 0) return null;
  const jour = periods.find((p) => p && p.echeance === 'J') || periods[0];
  const zones = jour && jour.timelaps && Array.isArray(jour.timelaps.domain_ids) ? jour.timelaps.domain_ids : [];

  let niveau = 1;
  const zonesRouges = [];
  const risques = new Set();
  for (const zone of zones) {
    if (!zone) continue;
    const couleur = Math.min(Math.max(Number(zone.max_color_id) || 1, 1), 4);
    if (couleur > niveau) niveau = couleur;
    const risquesRouges = [];
    for (const ph of Array.isArray(zone.phenomenon_items) ? zone.phenomenon_items : []) {
      const nom = ph && PHENOMENES[Number(ph.phenomenon_id)];
      if (!nom) continue;
      const c = Number(ph.phenomenon_max_color_id) || 1;
      if (c >= 2) risques.add(nom);
      if (c >= 4 && !risquesRouges.includes(nom)) risquesRouges.push(nom);
    }
    if (couleur === 4) zonesRouges.push({ zone: nomZone(zone.domain_id), risques: risquesRouges });
  }
  return {
    niveau,
    couleur: COULEURS_VIGILANCE[niveau],
    zonesRouges,
    risques: [...risques],
    perimee: data.stale === true,
  };
}

/** Texte du bandeau : « Finistère (29) : vent violent | Morbihan (56) ». */
export function texteZonesRouges(zonesRouges) {
  return zonesRouges
    .map(({ zone, risques }) => (risques.length ? `${zone} : ${risques.join(', ')}` : zone))
    .join(' | ');
}

/**
 * Demande la carte au serveur souverain. null si le serveur n'est pas branché, injoignable,
 * ou s'il répond par un repli (« fallback »).
 */
export async function chargerVigilance(sovereignConf, fetchImpl = globalThis.fetch) {
  const url = vigilanceUrl(sovereignConf);
  if (!url || typeof fetchImpl !== 'function') return null;
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response || !response.ok) return null;
  return resumeVigilance(await response.json());
}
