/**
 * lazy-features.js — Fonctions rares chargées seulement quand on les utilise.
 *
 * Étape 5 du plan de dette technique (7/11/2026) : ces modules étaient téléchargés et exécutés
 * à chaque démarrage de l'app, même si le pilote ne les ouvrait jamais.
 *
 * Fonctionnement : pour chaque module, on installe un « remplaçant » window.X. Au premier appel
 * d'une de ses méthodes (ex. window.PocketLawyer.toggleLawyer()), le vrai module est téléchargé,
 * il remplace window.X, puis l'appel lui est transmis. Les boutons data-action="X.methode()"
 * passent aussi par là.
 */

const FEATURES = {
  // Avocat de poche (Nexus Atlas Juridique)
  PocketLawyer: () => import("./pocket-lawyer.js"),
  // Diagnostic acoustique et décibelmètre
  MecaWizard: () => import("./meca-wizard.js"),
  // Portail assureur B2B (écran insurer-portal)
  InsurerPortal: () => import("./insurer-portal.js"),
  // Rapports d'expertise assurance (utilise l'analyse de litige)
  InsurancePortal: () => import("./litigation-ai.js").then(() => import("./insurance-portal.js")),
  LitigationAI: () => import("./litigation-ai.js"),
  // Vision AR (caméra + flèche de direction)
  arNavigationManager: () => import("./ar-navigation.js"),
};

// Méthodes appelées dès l'ouverture de l'app : la page ?appeal=true ouvre l'avocat de poche
const OPEN_ON_LOAD = [
  { when: () => /[?&](appeal=true|openLawyer=appeal)/.test(window.location.search), name: "PocketLawyer" },
];

export function installLazyFeature(name, load) {
  if (window[name] && !window[name].__lazy) return; // déjà chargé
  let loading = null;
  const ensureLoaded = () => {
    if (!loading) {
      loading = load().then(() => {
        const real = window[name];
        if (!real || real.__lazy) throw new Error(`[LazyFeatures] ${name} introuvable après chargement`);
        return real;
      });
      loading.catch((err) => {
        loading = null; // nouvel essai au prochain clic (ex. réseau revenu)
        console.error(`[LazyFeatures] Échec du chargement de ${name} :`, err);
      });
    }
    return loading;
  };

  window[name] = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "__lazy") return true;
        if (prop === "load") return ensureLoaded;
        // Pas un objet « thenable » ni un objet à convertir en texte
        if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") return undefined;
        return (...args) => ensureLoaded().then((real) => {
          if (typeof real[prop] !== "function") {
            console.warn(`[LazyFeatures] ${name}.${String(prop)} n'existe pas`);
            return undefined;
          }
          return real[prop](...args);
        });
      },
    },
  );
}

for (const [name, load] of Object.entries(FEATURES)) installLazyFeature(name, load);

for (const { when, name } of OPEN_ON_LOAD) {
  try {
    if (when()) window[name].load();
  } catch (_) {
    // URL illisible : rien à ouvrir
  }
}
