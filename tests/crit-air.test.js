/**
 * @jest-environment node
 *
 * Classe Crit'Air des cyclomoteurs et voitures sans permis : src/js/crit-air.js.
 * Bornes de l'annexe I de l'arrêté du 21 juin 2016 (colonne « 2 roues, tricycles et
 * quadricycles à moteur »), vérifiées sur Légifrance le 16/11/2026.
 */
const fs = require("fs");
const path = require("path");

function loadModule() {
  const src = fs
    .readFileSync(path.resolve(__dirname, "../src/js/crit-air.js"), "utf8")
    .replace(/^export (const|function) /gm, "$1 ");
  return new Function(
    `${src}\nreturn { critAirClass, critAirDetails, critAirBadge, normalizeDate, parseEuroNorm, OFFICIAL_CRITAIR_URL, NON_CLASSE, INCONNU, NON_CONCERNE };`,
  )();
}

const M = loadModule();
const TODAY = "2026-11-16";
const cls = (vehicleType, date, extra = {}) =>
  M.critAirClass({ vehicleType, firstRegistrationDate: date, today: TODAY, ...extra });

describe("Cyclomoteur 50 cc : bornes de dates (annexe I)", () => {
  test.each([
    ["2026-01-01", 1],
    ["2018-01-01", 1], // 1re date de la classe 1 pour les cyclomoteurs
    ["2017-12-31", 2], // les cyclomoteurs restent en classe 2 jusqu'à fin 2017
    ["2017-01-01", 2],
    ["2007-01-01", 2],
    ["2006-12-31", 3],
    ["2004-07-01", 3],
    ["2004-06-30", 4],
    ["2000-06-01", 4],
    ["2000-05-31", "non classé"],
    ["1985-04-12", "non classé"],
  ])("1re immatriculation le %s → %s", (date, expected) => {
    for (const type of ["cyclomoteur", "2t", "4t", "moto"]) expect(cls(type, date)).toBe(expected);
  });
});

describe("Voiture sans permis (quadricycle léger L6e) : mêmes dates que les cyclomoteurs (art. 2)", () => {
  test.each([
    ["2018-01-01", 1],
    ["2017-12-31", 2],
    ["2007-01-01", 2],
    ["2006-12-31", 3],
    ["2004-07-01", 3],
    ["2004-06-30", 4],
    ["2000-06-01", 4],
    ["2000-05-31", "non classé"],
  ])("VSP immatriculée le %s → %s", (date, expected) => {
    expect(cls("vsp", date)).toBe(expected);
  });
});

describe("Motocycle (plus de 50 cm³) : la classe 1 commence un an plus tôt", () => {
  test.each([
    ["2017-01-01", 1],
    ["2016-12-31", 2],
    ["2007-01-01", 2],
    ["2006-12-31", 3],
  ])("%s → %s", (date, expected) => {
    expect(cls("motocycle", date)).toBe(expected);
  });
});

describe("Il n'y a pas de classe 5 pour les deux-roues et quadricycles", () => {
  test("aucune date ne donne 5", () => {
    for (let y = 1970; y <= 2026; y++) {
      for (const m of ["01", "06", "07", "12"]) {
        expect(cls("vsp", `${y}-${m}-15`)).not.toBe(5);
      }
    }
  });
});

describe("Norme Euro (rubrique V.9) : elle prime sur la date (art. 1)", () => {
  test.each([
    ["Euro 5", 1],
    ["EURO4", 1],
    [4, 1],
    ["euro 3", 2],
    ["2", 3],
  ])("norme %s → %s", (euroNorm, expected) => {
    expect(cls("cyclomoteur", undefined, { euroNorm })).toBe(expected);
  });

  test("norme et date d'accord : pas d'avertissement", () => {
    const d = M.critAirDetails({ vehicleType: "2t", firstRegistrationDate: "2019-03-01", euroNorm: "Euro 4", today: TODAY });
    expect(d).toMatchObject({ classe: 1, source: "norme", aVerifier: false });
  });

  test("désaccord (cyclomoteur Euro 2 de 2012) : la norme prime, mais « à vérifier »", () => {
    const d = M.critAirDetails({ vehicleType: "2t", firstRegistrationDate: "2012-05-10", euroNorm: "Euro 2", today: TODAY });
    expect(d).toMatchObject({ classe: 3, source: "norme", aVerifier: true });
  });

  test("Euro 1 absent du tableau : on retombe sur la date, à vérifier", () => {
    const d = M.critAirDetails({ vehicleType: "vsp", firstRegistrationDate: "2001-02-01", euroNorm: "Euro 1", today: TODAY });
    expect(d).toMatchObject({ classe: 4, source: "date", aVerifier: true });
  });

  test("norme illisible ou inexistante pour la catégorie L : ignorée", () => {
    expect(M.parseEuroNorm("Euro 6")).toBeNull();
    expect(M.parseEuroNorm("abc")).toBeNull();
    expect(M.parseEuroNorm("")).toBeNull();
    expect(cls("2t", "2010-01-01", { euroNorm: "Euro 6" })).toBe(2);
  });
});

describe("Électrique et hydrogène : certificat E (classe 0)", () => {
  test.each(["electrique", "Électrique", "EL", "H2"])("énergie %s → 0", (energy) => {
    expect(cls("vsp", "1999-01-01", { energy })).toBe(0);
    expect(cls("2t", undefined, { energy })).toBe(0);
  });
  test("essence ou gazole : on suit la date", () => {
    expect(cls("vsp", "2019-01-01", { energy: "gazole" })).toBe(1);
  });
});

describe("Cas non calculables", () => {
  test("trottinette et vélo : pas de vignette", () => {
    expect(cls("trottinette", "2020-01-01")).toBe("non concerné");
    expect(cls("velo", "2020-01-01")).toBe("non concerné");
  });
  test("type inconnu", () => {
    expect(cls("camion", "2020-01-01")).toBe("inconnu");
    expect(cls(undefined, "2020-01-01")).toBe("inconnu");
  });
  test.each([undefined, "", "2020-13-01", "2021-02-29", "31/12/2019", "n'importe quoi", 20190101])(
    "date absente ou invalide (%s) → inconnu",
    (date) => {
      expect(cls("2t", date)).toBe("inconnu");
    },
  );
  test("date dans le futur → inconnu", () => {
    expect(cls("2t", "2026-11-17")).toBe("inconnu");
    expect(cls("2t", "2026-11-16")).toBe(1);
  });
  test("année bissextile valide", () => {
    expect(cls("2t", "2020-02-29")).toBe(1);
  });
  test("objet Date accepté (date locale)", () => {
    expect(cls("2t", new Date(2004, 6, 1))).toBe(3);
    expect(cls("2t", new Date(2004, 5, 30))).toBe(4);
  });
});

describe("Pastille et site officiel", () => {
  test("couleurs et libellés", () => {
    expect(M.critAirBadge(0).short).toBe("E");
    expect(M.critAirBadge(1).label).toBe("Crit'Air 1");
    expect(M.critAirBadge(2).bg).toBe("#f5d000");
    expect(M.critAirBadge("non classé").short).toBe("NC");
    expect(M.critAirBadge("inconnu").short).toBe("?");
  });
  test("le seul lien de commande est le site officiel de l'État", () => {
    const url = new URL(M.OFFICIAL_CRITAIR_URL);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("www.certificat-air.gouv.fr");
  });
});
