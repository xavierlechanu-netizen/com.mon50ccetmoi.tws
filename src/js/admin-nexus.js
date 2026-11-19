/**
 * Page admin-nexus.html : carnet d'apprentissage de Nexus Atlas (19/11/2026).
 * Lit et décide via le serveur du VPS (GET/POST /api/v1/admin/nexus/carnet), avec la session souveraine
 * d'un compte administrateur. Tout est construit avec le DOM (aucun HTML injecté).
 */
import { sovereignSession } from './sovereign.js';

const etat = document.getElementById("etat");
const liste = document.getElementById("liste");
const filtres = document.getElementById("filtres");
let statut = "a_verifier";

const LIBELLES = { a_verifier: "à vérifier", valide_auto: "validée par l'agent", valide: "validée", rejete_auto: "rejetée par l'agent", refuse: "refusée" };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function client() {
  if (!sovereignSession || !sovereignSession.hasAccount()) return null;
  return sovereignSession.client;
}

async function decide(id, decision, answer) {
  const c = client();
  await c.request(`/admin/nexus/carnet/${encodeURIComponent(id)}`, { method: "POST", body: { decision, answer } });
  await charger();
}

function carte(e) {
  const box = el("div", "carte");
  box.appendChild(el("div", "q", e.question));
  box.appendChild(el("div", "meta", `Posée ${e.timesAsked} fois · ${LIBELLES[e.status] || e.status}${e.category ? ` · ${e.category}` : ""}`));
  box.appendChild(el("div", "r", e.answer));
  if (e.reviewNote) box.appendChild(el("div", "avis", e.reviewNote));

  const zone = el("textarea");
  zone.value = e.answer;
  zone.setAttribute("aria-label", "Réponse corrigée");
  zone.hidden = true;

  const actions = el("div", "actions");
  const valider = el("button", "valider", "Valider");
  const corriger = el("button", "", "Corriger");
  const refuser = el("button", "refuser", "Refuser");
  for (const b of [valider, corriger, refuser]) b.type = "button";
  valider.addEventListener("click", () => decide(e.id, "valider").catch(erreur));
  refuser.addEventListener("click", () => decide(e.id, "refuser").catch(erreur));
  corriger.addEventListener("click", () => {
    if (zone.hidden) {
      zone.hidden = false;
      corriger.textContent = "Enregistrer la correction";
      zone.focus();
      return;
    }
    decide(e.id, "corriger", zone.value).catch(erreur);
  });
  actions.append(valider, corriger, refuser);
  box.append(zone, actions);
  return box;
}

function erreur(e) {
  etat.textContent = e && e.status === 403
    ? "Réservé aux administrateurs : connectez-vous avec votre compte administrateur."
    : `Impossible de joindre le serveur : ${e && e.message ? e.message : "erreur inconnue"}`;
}

async function charger() {
  const c = client();
  if (!c) {
    etat.textContent = "Connectez-vous d'abord (page de connexion), avec votre compte administrateur.";
    return;
  }
  etat.textContent = "Chargement…";
  try {
    const data = await c.request(`/admin/nexus/carnet?status=${encodeURIComponent(statut)}`);
    liste.replaceChildren(...data.entries.map(carte));
    etat.textContent = `${data.entries.length} réponse(s) ${LIBELLES[statut]}`
      + `${data.mistral ? "" : " · Mistral n'est pas branché sur le serveur"}`
      + `${data.enAttente ? ` · ${data.enAttente} en cours de vérification par l'agent` : ""}.`;
  } catch (e) {
    erreur(e);
  }
}

filtres.addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-statut]");
  if (!b) return;
  statut = b.dataset.statut;
  for (const x of filtres.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
  charger();
});

charger();
