const fs = require('fs');
const path = require('path');

describe('DOMSecurity & Safe Event Delegator (OWASP ASVS v5.0.0-1.3.1 & 1.3.2)', () => {
  let DOMSecurity;
  let Actions;
  let registerAction;
  let getAction;

  beforeEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();

    // Mock DOMPurify pour l'environnement JSDOM
    window.DOMPurify = {
      sanitize: jest.fn((str, options) => {
        // Simuler le filtrage DOMPurify strict
        let clean = str;
        if (options && options.FORBID_TAGS) {
          options.FORBID_TAGS.forEach(tag => {
            const re = new RegExp(`<\/?${tag}[^>]*>`, 'gi');
            clean = clean.replace(re, '');
          });
        }
        return clean;
      })
    };

    // Charger actionRegistry
    Actions = {};
    registerAction = (name, fn) => {
      Actions[name] = fn;
      window[name] = fn;
    };
    getAction = (path) => {
      const parts = path.trim().split('.');
      let fn = Actions;
      let ctx = Actions;
      for (const part of parts) {
        if (fn != null) {
          ctx = fn;
          fn = fn[part];
        } else {
          fn = undefined;
          break;
        }
      }
      if (typeof fn === 'function') return fn.bind(ctx);
      let winFn = window;
      let winCtx = window;
      for (const part of parts) {
        if (winFn != null) {
          winCtx = winFn;
          winFn = winFn[part];
        } else {
          winFn = undefined;
          break;
        }
      }
      if (typeof winFn === 'function') return winFn.bind(winCtx);
      return undefined;
    };

    // Importer parseSafeArgs depuis le module
    const rawSecurity = fs.readFileSync(path.resolve(__dirname, '../src/js/dom-security.js'), 'utf8');
    // Éliminer les imports ES pour exécution dans le sandbox de test
    const sanitizedCode = rawSecurity
      .replace(/import\s+.*?;/g, '')
      .replace(/export\s+function\s+parseSafeArgs/g, 'function parseSafeArgs')
      .replace(/export\s+/g, '');

    // Même résolution que actionRegistry.resolveActionTarget (registre puis window, sans lier)
    const resolveActionTarget = (p) => {
      const walk = (root) => {
        let fn = root;
        let ctx = root;
        for (const part of p.trim().split('.')) {
          if (fn == null) return null;
          ctx = fn;
          fn = fn[part];
        }
        return typeof fn === 'function' ? { fn, ctx } : null;
      };
      return walk(Actions) || walk(window);
    };

    // Exécuter dans le contexte
    const evalFn = new Function('getAction', 'resolveActionTarget', sanitizedCode + '\nreturn { parseSafeArgs: parseSafeArgs };');
    const exportsObj = evalFn(getAction, resolveActionTarget);
    DOMSecurity = window.DOMSecurity;
    DOMSecurity.parseSafeArgs = exportsObj.parseSafeArgs;
  });

  test('parseSafeArgs doit parser des chaînes, nombres et booléens sans eval', () => {
    const parse = DOMSecurity.parseSafeArgs;
    expect(parse("'hello', 'world'")).toEqual(['hello', 'world']);
    expect(parse('"foo", 42, true, false, null')).toEqual(['foo', 42, true, false, null]);
    expect(parse('["json1", 123, true]')).toEqual(['json1', 123, true]);
    expect(parse('')).toEqual([]);
    expect(parse(null)).toEqual([]);
  });

  test('parseSafeArgs ne doit JAMAIS évaluer de code JS arbitraire', () => {
    const parse = DOMSecurity.parseSafeArgs;
    // Les expressions JS complexes ne sont pas des littéraux reconnus
    const dangerous = "alert(document.cookie), fetch('//evil.com')";
    const result = parse(dangerous);
    // Le résultat ne doit contenir aucun code exécuté ni référence globale
    expect(result).not.toContain(document.cookie);
  });

  test('L\'Event Delegator doit appeler une action autorisée enregistrée', () => {
    const testAction = jest.fn();
    registerAction('safeAction', testAction);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', "safeAction('arg1', 99)");
    document.body.appendChild(btn);

    btn.click();
    expect(testAction).toHaveBeenCalledWith('arg1', 99);
  });

  test('L\'Event Delegator doit bloquer les tentatives de prototype pollution', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const btn = document.createElement('button');
    btn.setAttribute('data-action', '__proto__.polluted()');
    document.body.appendChild(btn);

    btn.click();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('prototype pollution bloquée'));
  });

  test('L\'Event Delegator ne doit pas planter si l\'action est inconnue', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'actionInexistante()');
    document.body.appendChild(btn);

    expect(() => btn.click()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Action non trouvée'));
  });

  test('Boutons d\'interface en ligne : afficher, masquer, retirer (ne faisaient rien avant)', () => {
    document.body.insertAdjacentHTML('beforeend',
      '<div id="panel" class="hidden" style="display:block"></div><div id="toast"></div>' +
      '<div id="modal"><div><button id="close" data-action="this.parentElement.parentElement.remove()">x</button></div></div>');
    const click = (action) => {
      const b = document.createElement('button');
      b.setAttribute('data-action', action);
      document.body.appendChild(b);
      b.click();
    };
    click("document.getElementById('panel').classList.remove('hidden')");
    expect(document.getElementById('panel').classList.contains('hidden')).toBe(false);
    click("document.getElementById('panel').style.display='none'");
    expect(document.getElementById('panel').style.display).toBe('none');
    click("document.getElementById('toast').remove()");
    expect(document.getElementById('toast')).toBeNull();
    document.getElementById('close').click();
    expect(document.getElementById('modal')).toBeNull();
  });

  test('Un contenu piégé ne peut pas rediriger hors du site ni appeler une fonction du navigateur', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('session', 'garder');
    const click = (action) => {
      const b = document.createElement('button');
      b.setAttribute('data-action', action);
      document.body.appendChild(b);
      b.click();
    };
    click("localStorage.clear()");
    expect(localStorage.getItem('session')).toBe('garder');
    click("window.location.href='https://phishing.example/login'");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('hors du site bloquée'));
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    click("window.open('https://phishing.example', '_blank')");
    expect(openSpy).not.toHaveBeenCalled();
    click("window.open('https://www.legifrance.gouv.fr/', '_blank')");
    expect(openSpy).toHaveBeenCalledWith('https://www.legifrance.gouv.fr/', '_blank', 'noopener');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Fonction du navigateur bloquée'));
  });

  // Remplaçants des onkeyup / onchange / oninput / onerror (CSP stricte, 7/11/2026).
  // Rappel : chaque test recharge le module, donc un même événement peut être traité plusieurs fois.
  test('data-enter-action : Entrée dans le champ lance l\'action, une autre touche non', () => {
    const login = jest.fn();
    registerAction('doLoginTest', login);
    document.body.insertAdjacentHTML('beforeend', '<input id="pwd" data-enter-action="doLoginTest()">');
    const input = document.getElementById('pwd');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(login).not.toHaveBeenCalled();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(login).toHaveBeenCalled();
  });

  test('data-change-action : la fonction reçoit la nouvelle valeur ; fonctions du navigateur refusées', () => {
    const save = jest.fn();
    registerAction('saveDateTest', save);
    document.body.insertAdjacentHTML('beforeend',
      '<input id="d" data-change-action="saveDateTest"><input id="evil" data-change-action="localStorage.clear">');
    const d = document.getElementById('d');
    d.value = '2026-12-01';
    d.dispatchEvent(new Event('change', { bubbles: true }));
    expect(save).toHaveBeenCalledWith('2026-12-01');

    localStorage.setItem('garde', 'oui');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    document.getElementById('evil').dispatchEvent(new Event('change', { bubbles: true }));
    expect(localStorage.getItem('garde')).toBe('oui');
  });

  test('data-input-filter="digits" ne garde que les chiffres', () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="siret" data-input-filter="digits">');
    const siret = document.getElementById('siret');
    siret.value = '123 456-78a9';
    siret.dispatchEvent(new Event('input', { bubbles: true }));
    expect(siret.value).toBe('123456789');
  });

  test('data-fallback-icon : une image cassée est remplacée par une icône', () => {
    document.body.insertAdjacentHTML('beforeend',
      '<div id="box"><img id="photo" src="x.jpg" data-fallback-icon="fa-motorcycle"></div>');
    document.getElementById('photo').dispatchEvent(new Event('error'));
    const icon = document.querySelector('#box i');
    expect(document.getElementById('photo')).toBeNull();
    expect(icon.className).toBe('fa-solid fa-motorcycle');
  });

  test('DOMSecurity.safeHTML filtre les balises dangereuses via DOMPurify', () => {
    const container = document.createElement('div');
    DOMSecurity.safeHTML(container, '<p>Texte sain</p><iframe src="evil.com"></iframe><style>body{color:red}</style>');

    expect(window.DOMPurify.sanitize).toHaveBeenCalled();
    expect(container.innerHTML).not.toContain('<iframe');
    expect(container.innerHTML).not.toContain('<style');
  });
});
