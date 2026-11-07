const {
  AGGREGATE_VERSION,
  validateGarageVote,
  applyGarageVote,
  voteDocId,
} = require("../functions/api/garage-rules");

describe("Notation des garages (garage-rules.js)", () => {
  test("accepte les identifiants produits par la carte", () => {
    expect(validateGarageVote({ placeId: "osm-node-123", name: "Moto 59", score: 4 }))
      .toEqual({ placeId: "osm-node-123", name: "Moto 59", score: 4 });
    expect(validateGarageVote({ placeId: "50.6292,-3.0573", score: 1 }).placeId).toBe("50.6292,-3.0573");
  });

  test("refuse une note hors 1-5 ou non entière", () => {
    for (const score of [0, 6, 3.5, "5", null, undefined, NaN]) {
      expect(() => validateGarageVote({ placeId: "osm-node-1", score })).toThrow("entier de 1 à 5");
    }
  });

  test("refuse un identifiant qui sortirait de la collection", () => {
    for (const placeId of ["", "a/b", "../users/x", "osm__x", "x".repeat(129), 42, null]) {
      expect(() => validateGarageVote({ placeId, score: 3 })).toThrow("Garage inconnu");
    }
  });

  test("nettoie et raccourcit le nom", () => {
    const { name } = validateGarageVote({ placeId: "osm-node-1", name: "  Garage\u0000\n" + "x".repeat(300), score: 3 });
    expect(name.startsWith("Garage")).toBe(true);
    expect(name).not.toMatch(/[\u0000-\u001f]/);
    expect(name.length).toBe(120);
  });

  test("premier vote", () => {
    expect(applyGarageVote(null, null, 4)).toEqual({ v: AGGREGATE_VERSION, count: 1, totalScore: 4, avgRating: 4 });
  });

  test("le deuxième votant est compté (bug corrigé)", () => {
    const first = applyGarageVote(null, null, 4);
    expect(applyGarageVote(first, null, 5)).toEqual({ v: AGGREGATE_VERSION, count: 2, totalScore: 9, avgRating: 4.5 });
  });

  test("revoter remplace la note sans ajouter d'avis", () => {
    const agg = { v: AGGREGATE_VERSION, count: 3, totalScore: 12, avgRating: 4 };
    expect(applyGarageVote(agg, 5, 2)).toEqual({ v: AGGREGATE_VERSION, count: 3, totalScore: 9, avgRating: 3 });
  });

  test("ignore les anciennes moyennes écrites par le navigateur", () => {
    const forged = { count: 1000, totalScore: 5000, avgRating: "5.0", voters: ["Tricheur"] };
    expect(applyGarageVote(forged, null, 3)).toEqual({ v: AGGREGATE_VERSION, count: 1, totalScore: 3, avgRating: 3 });
  });

  test("moyenne arrondie à une décimale", () => {
    const agg = { v: AGGREGATE_VERSION, count: 2, totalScore: 9, avgRating: 4.5 };
    expect(applyGarageVote(agg, null, 5).avgRating).toBe(4.7); // 14 / 3
  });

  test("un vote par membre et par garage", () => {
    expect(voteDocId("osm-node-1", "uidA")).toBe("osm-node-1__uidA");
    expect(voteDocId("osm-node-1", "uidA")).not.toBe(voteDocId("osm-node-1", "uidB"));
  });
});
