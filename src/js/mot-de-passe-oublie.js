import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const showOnly = (shown) => {
  for (const id of ['reset-demande', 'reset-form', 'reset-ok']) $(id).hidden = id !== shown;
};

let token = null;
function readLink() {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get('token');
  if (fromLink) {
    token = fromLink;
    // Le lien est secret : il ne reste ni dans la barre d'adresse ni dans l'historique
    history.replaceState(null, '', location.pathname);
  }
  showOnly(token ? 'reset-form' : 'reset-demande');
}
readLink();
// Lien ouvert dans un onglet déjà sur cette page : le navigateur ne la recharge pas
window.addEventListener('hashchange', readLink);

$('reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('reset-pass').value;
  const error = $('reset-error');
  error.textContent = '';
  if (password !== $('reset-pass2').value) {
    error.textContent = 'Les deux mots de passe sont différents.';
    return;
  }
  $('reset-submit').disabled = true;
  try {
    const res = await fetch(`${CONFIG.SOVEREIGN.API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      showOnly('reset-ok');
      return;
    }
    const data = await res.json().catch(() => ({}));
    error.textContent = data.error || 'Changement impossible. Réessaie.';
  } catch {
    error.textContent = 'Serveur injoignable. Vérifie ton réseau et réessaie.';
  } finally {
    $('reset-submit').disabled = false;
  }
});
