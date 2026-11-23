/**
 * Tableau de bord : ne montre que des données réelles (23/11/2026).
 * Avant, un profil vide recevait un faux score (92), de faux km et de faux trajets, écrits dans sa fiche.
 * Ces valeurs de démonstration, encore présentes dans des fiches, sont ignorées à l'affichage.
 * Aucun import : testé directement (tests/dashboard-data.test.js).
 */
const DEMO_ROUTES = new Set(["Domicile → Lycée Victor Hugo", "Lycée → Centre Commercial", "Domicile → Garage Mécano Pro"]);
const DEMO_WEEK = "8,12,5,18,24,15,4";
const NO_STATS = { km: 0, hours: 0, speed: 0, streak: 0 };

const isDemoStats = (s) => Boolean(s) && s.km === 1247 && s.hours === 86 && s.speed === 34 && s.streak === 12;

/** @returns {{score: number|null, stats: object, weekly: object[], trips: object[]}} */
export function realDashboardData({ userData = {}, weekly = [], trips = [] }) {
  const demo = isDemoStats(userData && userData.stats);
  const score = !demo && Number.isFinite(userData && userData.bvc_score) ? userData.bvc_score : null;
  const stats = !demo && userData && userData.stats ? { ...NO_STATS, ...userData.stats } : { ...NO_STATS };
  const isDemoWeek = weekly.map((d) => d.km).join(",") === DEMO_WEEK;
  return {
    score,
    stats,
    weekly: isDemoWeek ? [] : weekly,
    trips: trips.filter((t) => !DEMO_ROUTES.has(t.route)),
  };
}
