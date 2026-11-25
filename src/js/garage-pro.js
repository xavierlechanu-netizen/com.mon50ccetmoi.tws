import { registerAction } from './actionRegistry.js';
import { comptes, comptesErrorMessage } from './comptes.js';

/**
 * Inscription d'un garage (serveur souverain) : création du compte, puis le tableau de bord
 * propose le droit d'entrée (50 € TTC, prix venu du serveur) et ouvre l'espace une fois payé.
 */
window.GaragePro = {
  showRegistrationModal: function () {
    if (document.getElementById("garage-reg-modal")) return;
    const html = `
      <div id="garage-reg-modal" role="dialog" aria-modal="true" aria-labelledby="garage-reg-title" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="background:#141414; border:1px solid #ffb703; border-radius:12px; padding:30px; width:100%; max-width:400px; box-sizing:border-box; text-align:center; color:#fff;">
          <i class="fa-solid fa-wrench" style="font-size:3rem; color:#ffb703; margin-bottom:15px;"></i>
          <h2 id="garage-reg-title">Inscrire mon garage</h2>
          <p style="color:#aaa; font-size:0.9rem; margin:10px 0 20px;">Créez le compte du garage. Le droit d'entrée de <strong>50,00 € TTC</strong>, payé une seule fois, vous sera ensuite proposé.</p>
          <input type="email" id="garage-reg-email" placeholder="Email du garage" autocomplete="email" style="width:100%; box-sizing:border-box; padding:10px; margin-bottom:10px; border-radius:5px; border:1px solid #333; background:#000; color:#fff;" />
          <input type="password" id="garage-reg-pwd" placeholder="Mot de passe (8 caractères au moins)" autocomplete="new-password" style="width:100%; box-sizing:border-box; padding:10px; margin-bottom:20px; border-radius:5px; border:1px solid #333; background:#000; color:#fff;" />
          <button data-action="GaragePro.register()" style="width:100%; padding:12px; background:#ffb703; color:#000; font-weight:bold; border:none; border-radius:5px; cursor:pointer; margin-bottom:10px;">
            Créer le compte du garage
          </button>
          <button data-action="GaragePro.closeModal()" style="width:100%; padding:12px; background:transparent; color:#aaa; border:1px solid #333; border-radius:5px; cursor:pointer;">
            Annuler
          </button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", html);
  },

  closeModal: function () {
    document.getElementById("garage-reg-modal")?.remove();
  },

  register: async function () {
    const email = document.getElementById("garage-reg-email").value.trim();
    const pwd = document.getElementById("garage-reg-pwd").value;
    if (!email || !pwd) {
      alert("Saisissez l'email du garage et un mot de passe.");
      return;
    }
    try {
      // Le serveur demande un pseudonyme : tiré de l'email du garage (le nom affiché est celui de la fiche)
      const local = email.split("@")[0].replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40);
      await comptes.creerCompte({ email, username: `garage-${local || "pro"}`, password: pwd });
      window.location.href = "garage-dashboard.html";
    } catch (e) {
      console.error("Erreur inscription garage", e);
      alert("Inscription impossible : " + comptesErrorMessage(e));
    }
  },
};

registerAction("GaragePro.showRegistrationModal", () => window.GaragePro.showRegistrationModal());
registerAction("GaragePro.closeModal", () => window.GaragePro.closeModal());
registerAction("GaragePro.register", () => window.GaragePro.register());
