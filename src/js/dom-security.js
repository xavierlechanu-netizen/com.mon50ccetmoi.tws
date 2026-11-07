/**
 * DOM Security & Event Delegation (Phase 1 Fix)
 * OWASP ASVS v5.0.0-1.3.1, v5.0.0-1.3.2, v5.0.0-3.2.2 / CSP Strict Enforcement
 * Zéro eval(), zéro new Function(). Parsing déterministe et sécurisé.
 */

import { resolveActionTarget } from './actionRegistry.js';

// Fonctions du navigateur autorisées dans un data-action (sans effet dangereux)
const SAFE_NATIVE_ACTIONS = new Set(['print', 'history.back', 'history.forward', 'location.reload']);

// Objets du navigateur jamais appelables depuis un data-action, même s'ils sont réimplémentés
// en JavaScript (polyfills, extensions) et échappent donc à isNativeFunction.
const BLOCKED_ROOTS = new Set([
    'window', 'self', 'globalThis', 'top', 'parent', 'opener', 'frames', 'document', 'location',
    'history', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'cookieStore',
    'fetch', 'XMLHttpRequest', 'open', 'eval', 'Function', 'setTimeout', 'setInterval', 'postMessage',
]);

export function isBlockedActionPath(functionPath) {
    const path = functionPath.replace(/^window\./, '');
    if (SAFE_NATIVE_ACTIONS.has(path)) return false;
    return BLOCKED_ROOTS.has(path.split('.')[0]);
}

// Sites officiels qu'un bouton peut ouvrir dans un nouvel onglet
const TRUSTED_EXTERNAL_HOSTS = new Set([
    'www.legifrance.gouv.fr', 'legifrance.gouv.fr', 'www.service-public.fr',
    'www.securite-routiere.gouv.fr', 'www.cnil.fr',
]);

export function isNativeFunction(fn) {
    try {
        return typeof fn === 'function' && /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(fn));
    } catch (e) {
        return true; // dans le doute, on bloque
    }
}

export function isSameOriginUrl(url) {
    try {
        return new URL(url, window.location.href).origin === window.location.origin;
    } catch (e) {
        return false;
    }
}

export function isTrustedExternalUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && TRUSTED_EXTERNAL_HOSTS.has(parsed.hostname);
    } catch (e) {
        return false;
    }
}

// Parseur d'arguments sécurisé (uniquement primitives et JSON, AUCUN eval/new Function)
export function parseSafeArgs(argsStr) {
    if (!argsStr || typeof argsStr !== 'string' || !argsStr.trim()) {
        return [];
    }
    const trimmed = argsStr.trim();

    // 1. Si format JSON valide (ex: [1, "test"])
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            return JSON.parse(trimmed);
        } catch (e) {
            // Continuer vers le tokenizer si ce n'est pas du JSON strict
        }
    }

    // 2. Tokenizer de primitives sans exécution de code
    // Supporte les littéraux séparés par virgules : 'chaine', "chaine", nombres, true, false, null
    const args = [];
    const tokenRegex = /\s*(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?)|(true|false|null))\s*(?:,|$)/g;
    let match;
    let count = 0;
    while ((match = tokenRegex.exec(trimmed)) !== null) {
        if (match[1] !== undefined) {
            args.push(match[1]);
        } else if (match[2] !== undefined) {
            args.push(match[2]);
        } else if (match[3] !== undefined) {
            args.push(Number(match[3]));
        } else if (match[4] === 'true') {
            args.push(true);
        } else if (match[4] === 'false') {
            args.push(false);
        } else if (match[4] === 'null') {
            args.push(null);
        }
        count++;
        if (tokenRegex.lastIndex >= trimmed.length || count > 20) break;
    }

    return args;
}

// Exécuteur sécurisé d'une action unique
function executeSingleAction(actionStr, element, event) {
    const trimmed = actionStr.trim();
    if (!trimmed) return;

    // 1. Navigation / Redirection : uniquement vers le site lui-même (audit 2026-11-07 : avant,
    // un texte piégé pouvait rediriger vers n'importe quel site, ex. une page de phishing)
    const navMatch = trimmed.match(/^(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]\s*;?$/);
    if (navMatch) {
        const targetUrl = navMatch[1];
        if (!isSameOriginUrl(targetUrl)) {
            console.error(`[DOMSecurity] Redirection hors du site bloquée: ${targetUrl}`);
            return;
        }
        if (element.tagName === 'A' && event) event.preventDefault();
        window.location.href = targetUrl;
        return;
    }

    // 1bis. Ouverture d'un site externe officiel dans un nouvel onglet (liste fermée)
    const openMatch = trimmed.match(/^(?:window\.)?open\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"][^'"]*['"]\s*)?\)$/);
    if (openMatch) {
        if (element.tagName === 'A' && event) event.preventDefault();
        if (isTrustedExternalUrl(openMatch[1])) {
            window.open(openMatch[1], '_blank', 'noopener');
        } else {
            console.error(`[DOMSecurity] Ouverture d'un site non autorisé bloquée: ${openMatch[1]}`);
        }
        return;
    }

    // 1ter. Gestes d'interface écrits en ligne (afficher/masquer/retirer un bloc). Avant, ces
    // ~25 boutons ne faisaient rien : aucune branche ne savait les exécuter.
    const byIdMatch = trimmed.match(/^document\.getElementById\(\s*['"]([\w-]+)['"]\s*\)\.(?:classList\.(add|remove|toggle)\(\s*['"]([\w -]+)['"]\s*\)|style\.display\s*=\s*['"]([\w-]*)['"]|(remove)\(\s*\))$/);
    if (byIdMatch) {
        if (element.tagName === 'A' && event) event.preventDefault();
        const target = document.getElementById(byIdMatch[1]);
        if (!target) return;
        if (byIdMatch[2]) {
            byIdMatch[3].split(/\s+/).filter(Boolean).forEach((cls) => target.classList[byIdMatch[2]](cls));
        } else if (byIdMatch[5]) {
            target.remove();
        } else {
            target.style.display = byIdMatch[4];
        }
        return;
    }
    const parentRemoveMatch = trimmed.match(/^this((?:\.parentElement){0,4})\.remove\(\s*\)$/);
    if (parentRemoveMatch) {
        let target = element;
        const depth = (parentRemoveMatch[1].match(/parentElement/g) || []).length;
        for (let i = 0; i < depth && target; i++) target = target.parentElement;
        if (target && target !== document.body && target !== document.documentElement) target.remove();
        return;
    }

    // 2. Actions de navigation simples
    if (trimmed === 'history.back()' || trimmed === 'window.history.back()') {
        if (element.tagName === 'A' && event) event.preventDefault();
        window.history.back();
        return;
    }
    if (trimmed === 'location.reload()' || trimmed === 'window.location.reload()') {
        if (element.tagName === 'A' && event) event.preventDefault();
        window.location.reload();
        return;
    }

    // 3. Gestion spécifique des alertes déclaratives
    const alertMatch = trimmed.match(/^alert\((['"])(.*?)\1\);?$/);
    if (alertMatch) {
        if (element.tagName === 'A' && event) event.preventDefault();
        if (typeof alert === 'function') {
            alert(alertMatch[2]);
        }
        return;
    }

    // 4. Appel de fonction : identifiant ou chemin de propriétés sécurisé
    const funcMatch = trimmed.match(/^([a-zA-Z0-9_$.]+)(?:\((.*)\))?;?$/);
    if (funcMatch) {
        const functionPath = funcMatch[1];
        const rawArgs = funcMatch[2];

        // Bloquer l'accès à des propriétés sensibles/prototypes
        if (/__(?:proto|defineGetter|defineSetter)__|constructor|prototype/i.test(functionPath)) {
            console.error(`[DOMSecurity] Tentative de prototype pollution bloquée: ${functionPath}`);
            return;
        }

        // Les fonctions internes du navigateur (localStorage.clear, location.assign, fetch…)
        // ne sont jamais appelables depuis un attribut : un contenu piégé pourrait s'en servir.
        const target = resolveActionTarget(functionPath);
        if (isBlockedActionPath(functionPath)
            || (target && isNativeFunction(target.fn) && !SAFE_NATIVE_ACTIONS.has(functionPath.replace(/^window\./, '')))) {
            console.error(`[DOMSecurity] Fonction du navigateur bloquée: ${functionPath}`);
            return;
        }
        const fn = target ? target.fn.bind(target.ctx) : undefined;
        if (typeof fn === 'function') {
            if (element.tagName === 'A' && event && (element.getAttribute('href') === '#' || !element.getAttribute('href'))) {
                event.preventDefault();
            }
            const args = parseSafeArgs(rawArgs);
            try {
                fn.apply(element, args);
            } catch (err) {
                console.error(`[DOMSecurity] Erreur lors de l'exécution de ${functionPath}:`, err);
            }
            return;
        } else {
            console.warn(`[DOMSecurity] Action non trouvée dans le registre: ${functionPath}`);
            return;
        }
    }

    console.warn(`[DOMSecurity] Action non reconnue ou syntaxe invalide ignorée: ${trimmed}`);
}

// 1. GLOBAL EVENT DELEGATOR (Sans new Function ni eval)
if (typeof document !== 'undefined') {
    document.addEventListener('click', function(event) {
        const screenClose = event.target.closest('[data-screen-close]');
        if (screenClose) {
            if (window.ScreenManager && typeof window.ScreenManager.close === 'function') {
                window.ScreenManager.close();
            }
            return;
        }

        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) {
            return;
        }

        const actionString = actionElement.getAttribute('data-action');
        if (!actionString) return;

        // Découper les instructions multiples enchaînées par des points-virgules
        // et extraire d'éventuels if(window.X) sans jamais utiliser new Function
        const statements = actionString.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
            let executableStmt = stmt;
            const ifMatch = stmt.match(/^if\s*\([^)]+\)\s*(.+)$/);
            if (ifMatch) {
                executableStmt = ifMatch[1].trim();
            }
            executeSingleAction(executableStmt, actionElement, event);
        }
    });
}

// 2. MONKEY PATCH GLOBAL innerHTML (Sanitization stricte DOMPurify)
if (typeof Element !== 'undefined' && Element.prototype) {
    const originalInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (originalInnerHTMLDescriptor) {
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                if (typeof value !== 'string') {
                    originalInnerHTMLDescriptor.set.call(this, value);
                    return;
                }

                let safeValue = value;
                if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
                    safeValue = DOMPurify.sanitize(value, {
                        FORBID_TAGS: ['iframe', 'style', 'script', 'object', 'embed'],
                        ADD_TAGS: ['input', 'select', 'textarea', 'button', 'form', 'canvas', 'video', 'source', 'option', 'label', 'optgroup'],
                        ADD_ATTR: ['data-action', 'data-id', 'data-value', 'data-theme', 'data-screen-close', 'target', 'class', 'id', 'role', 'aria-label', 'placeholder', 'type', 'for', 'value', 'checked', 'selected', 'disabled', 'name', 'src', 'alt', 'rows', 'cols', 'min', 'max', 'step', 'autocomplete'],
                        ALLOW_DATA_ATTR: true
                    });
                } else {
                    console.error("[DOMSecurity] DOMPurify non chargé ! Injection HTML brute neutralisée (OWASP ASVS v5.0.0-1.3.1).");
                    safeValue = value.replace(/[&<>"']/g, function(c) {
                        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
                    });
                }

                originalInnerHTMLDescriptor.set.call(this, safeValue);
            },
            get: function() {
                return originalInnerHTMLDescriptor.get.call(this);
            }
        });
    }
}

// 3. Export global sécurisé
if (typeof window !== 'undefined') {
    window.DOMSecurity = {
        safeHTML: function(element, templateString) {
            if (element && typeof templateString === 'string') {
                // eslint-disable-next-line no-restricted-syntax
                element.innerHTML = templateString;
            }
        },
        parseSafeArgs: parseSafeArgs
    };
}
