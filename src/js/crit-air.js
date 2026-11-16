/**
 * crit-air.js — Classe Crit'Air d'un cyclomoteur 50 cc ou d'une voiture sans permis (fonctions
 * pures, sans DOM ni réseau, testées dans tests/crit-air.test.js).
 *
 * Sources officielles (vérifiées le 16/11/2026) :
 * - Arrêté du 21 juin 2016 établissant la nomenclature des véhicules classés en fonction de leur
 *   niveau d'émission de polluants atmosphériques (NOR DEVR1608173A), version en vigueur
 *   (annexe modifiée le 22 juillet 2023) :
 *   https://www.legifrance.gouv.fr/loda/id/JORFTEXT000032749723
 *   - art. 1 : la classe dépend d'abord de la norme Euro (rubrique V.9 de la carte grise) quand
 *     elle est connue, « à défaut » de la date de 1re immatriculation (rubrique B) ;
 *   - art. 2 : les quadricycles légers (L6e, voitures sans permis) sont rangés avec les
 *     cyclomoteurs (L1e, L2e) ; électrique et hydrogène = sources d'énergie EL, H2, AC, HE, HH ;
 *   - annexe I, colonne « 2 roues, tricycles et quadricycles à moteur » (pas de classe 5) :
 *       1 : Euro 4 et 5, à partir du 1/1/2017 (motocycles), du 1/1/2018 (cyclomoteurs)
 *       2 : Euro 3, du 1/1/2007 au 31/12/2016 (motocycles), au 31/12/2017 (cyclomoteurs)
 *       3 : Euro 2, du 1/7/2004 au 31/12/2006
 *       4 : pas de norme, du 1/6/2000 au 30/6/2004
 *       non classés : pas de norme, jusqu'au 31/5/2000
 * - Tableau repris par service-public.gouv.fr (fiche F33371), qui désigne certificat-air.gouv.fr
 *   comme le seul site officiel de délivrance.
 *
 * Ce que ce module ne sait pas trancher (affiché « à vérifier sur certificat-air.gouv.fr ») :
 * norme Euro 1 (absente du tableau, on retombe sur la date), désaccord entre la norme et la date,
 * post-équipement antipollution (art. 3).
 */

/** Seul site officiel de commande (service-public.gouv.fr, fiche F33371) */
export const OFFICIAL_CRITAIR_URL = "https://www.certificat-air.gouv.fr/";

export const NON_CLASSE = "non classé";
export const INCONNU = "inconnu";
export const NON_CONCERNE = "non concerné";

/** Classe 0 = certificat « E » zéro émission (vert) */
export const ZERO_EMISSION = 0;

/** Véhicules de l'appli (vehicle-config-screen.html, champ « scooter-motor ») → catégorie */
const VEHICLE_CATEGORY = {
  cyclomoteur: "cyclomoteur",
  "2t": "cyclomoteur",
  "4t": "cyclomoteur",
  moto: "cyclomoteur", // « Moto 50 à boîte » : cyclomoteur L1e
  vsp: "cyclomoteur", // quadricycle léger L6e, rangé avec les cyclomoteurs (art. 2)
  motocycle: "motocycle", // L3e (plus de 50 cm³), pour mémoire
  trottinette: NON_CONCERNE, // engin de déplacement personnel : pas de vignette
  velo: NON_CONCERNE,
};

/** Dates de l'annexe I (« AAAA-MM-JJ », comparées comme du texte) */
const BOUNDS = {
  cyclomoteur: { class1From: "2018-01-01" },
  motocycle: { class1From: "2017-01-01" },
  class2From: "2007-01-01",
  class3From: "2004-07-01",
  class4From: "2000-06-01",
};

const ELECTRIC_ENERGIES = new Set(["electrique", "électrique", "el", "hydrogene", "hydrogène", "h2", "ac", "he", "hh"]);

/** « AAAA-MM-JJ » (champ date du formulaire) ou Date → « AAAA-MM-JJ », sinon null */
export function normalizeDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return m[0];
}

/** « Euro 4 », « EURO4 », 4 → 4 ; inconnu → null */
export function parseEuroNorm(value) {
  if (value === null || value === undefined || value === "") return null;
  const m = /^(?:euro\s*)?([1-5])$/i.exec(String(value).trim());
  return m ? Number(m[1]) : null;
}

function classFromDate(category, iso) {
  if (iso >= BOUNDS[category].class1From) return 1;
  if (iso >= BOUNDS.class2From) return 2;
  if (iso >= BOUNDS.class3From) return 3;
  if (iso >= BOUNDS.class4From) return 4;
  return NON_CLASSE;
}

function classFromNorm(euro) {
  if (euro >= 4) return 1; // « Euro 4 et 5 »
  if (euro === 3) return 2;
  if (euro === 2) return 3;
  return null; // Euro 1 : absent du tableau
}

/**
 * Classe Crit'Air détaillée.
 * @param {{ vehicleType: string, firstRegistrationDate?: string|Date, euroNorm?: string|number,
 *           energy?: string, today?: string|Date }} input
 * @returns {{ classe: number|string, source: "énergie"|"norme"|"date"|null, aVerifier: boolean,
 *             raison: string }}
 */
export function critAirDetails({ vehicleType, firstRegistrationDate, euroNorm, energy, today } = {}) {
  const category = VEHICLE_CATEGORY[String(vehicleType || "").toLowerCase()];
  if (!category) return { classe: INCONNU, source: null, aVerifier: true, raison: "Type de véhicule inconnu." };
  if (category === NON_CONCERNE) {
    return { classe: NON_CONCERNE, source: null, aVerifier: false, raison: "Les trottinettes et vélos n'ont pas de vignette Crit'Air." };
  }

  if (energy && ELECTRIC_ENERGIES.has(String(energy).toLowerCase())) {
    return { classe: ZERO_EMISSION, source: "énergie", aVerifier: false, raison: "Véhicule électrique ou à hydrogène." };
  }

  const iso = normalizeDate(firstRegistrationDate);
  const todayIso = normalizeDate(today || new Date());
  const dateOk = iso && (!todayIso || iso <= todayIso);
  const fromDate = dateOk ? classFromDate(category, iso) : null;

  const euro = parseEuroNorm(euroNorm);
  const fromNorm = euro ? classFromNorm(euro) : null;

  if (fromNorm !== null) {
    // Article 1 : la norme Euro prime quand elle est connue
    const disagree = fromDate !== null && fromDate !== fromNorm;
    return {
      classe: fromNorm,
      source: "norme",
      aVerifier: disagree,
      raison: disagree
        ? "La norme Euro et la date de 1re immatriculation ne donnent pas la même classe : la norme prime, mais vérifiez."
        : `Norme Euro ${euro}.`,
    };
  }
  if (fromDate !== null) {
    return {
      classe: fromDate,
      source: "date",
      aVerifier: euro === 1,
      raison: euro === 1
        ? "La norme Euro 1 ne figure pas dans le tableau officiel : classe donnée d'après la date, à vérifier."
        : "D'après la date de 1re immatriculation.",
    };
  }
  return {
    classe: INCONNU,
    source: null,
    aVerifier: true,
    raison: iso && !dateOk ? "La date de 1re immatriculation est dans le futur." : "Indiquez la date de 1re immatriculation (case B de la carte grise).",
  };
}

/** Classe seule : 0 (zéro émission) à 4, « non classé », « non concerné » ou « inconnu » */
export function critAirClass(input) {
  return critAirDetails(input).classe;
}

/** Libellé et couleurs officielles de la pastille */
export function critAirBadge(classe) {
  switch (classe) {
    case 0: return { label: "Crit'Air 0 (E, zéro émission)", short: "E", bg: "#2e9e4f", fg: "#fff" };
    case 1: return { label: "Crit'Air 1", short: "1", bg: "#7b4fa3", fg: "#fff" };
    case 2: return { label: "Crit'Air 2", short: "2", bg: "#f5d000", fg: "#000" };
    case 3: return { label: "Crit'Air 3", short: "3", bg: "#f08a00", fg: "#000" };
    case 4: return { label: "Crit'Air 4", short: "4", bg: "#7a1f2b", fg: "#fff" };
    case 5: return { label: "Crit'Air 5", short: "5", bg: "#8c8c8c", fg: "#fff" };
    case NON_CLASSE: return { label: "Non classé (pas de vignette possible)", short: "NC", bg: "#333", fg: "#fff" };
    case NON_CONCERNE: return { label: "Pas de vignette pour ce véhicule", short: "—", bg: "#444", fg: "#fff" };
    default: return { label: "Classe inconnue", short: "?", bg: "#444", fg: "#fff" };
  }
}
