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

    // Exécuter dans le contexte
    const evalFn = new Function('getAction', sanitizedCode + '\nreturn { parseSafeArgs: parseSafeArgs };');
    const exportsObj = evalFn(getAction);
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

  test('DOMSecurity.safeHTML filtre les balises dangereuses via DOMPurify', () => {
    const container = document.createElement('div');
    DOMSecurity.safeHTML(container, '<p>Texte sain</p><iframe src="evil.com"></iframe><style>body{color:red}</style>');

    expect(window.DOMPurify.sanitize).toHaveBeenCalled();
    expect(container.innerHTML).not.toContain('<iframe');
    expect(container.innerHTML).not.toContain('<style');
  });
});
