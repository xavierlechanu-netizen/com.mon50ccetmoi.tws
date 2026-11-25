import { registerAction } from './actionRegistry.js';
import { comptes, comptesErrorMessage } from './comptes.js';

/**
 * Connexion à l'espace garage (serveur souverain). Le tableau de bord vérifie lui-même auprès du
 * serveur que le compte est un garage certifié, et propose sinon le droit d'entrée.
 */
async function doGarageLogin() {
  const email = document.getElementById("garage-email").value.trim();
  const pass = document.getElementById("garage-pass").value;
  const errorBox = document.getElementById("login-error");
  const btn = document.getElementById("btn-garage-login");

  errorBox.style.display = "none";
  if (!email || !pass) {
    errorBox.textContent = "Veuillez remplir tous les champs.";
    errorBox.style.display = "block";
    return;
  }

  btn.disabled = true;
  try {
    await comptes.seConnecter(email, pass);
    window.location.href = "garage-dashboard.html";
  } catch (error) {
    console.error("Erreur connexion Garage:", error);
    errorBox.textContent = comptesErrorMessage(error);
    errorBox.style.display = "block";
    btn.disabled = false;
  }
}

/** Ouvre la fenêtre d'inscription (garage-pro.js). */
function openPioneerRegistration() {
  if (window.GaragePro) window.GaragePro.showRegistrationModal();
}

registerAction('doGarageLogin', doGarageLogin);
registerAction('openPioneerRegistration', openPioneerRegistration);
