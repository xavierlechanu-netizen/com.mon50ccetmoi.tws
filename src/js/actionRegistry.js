/**
 * Action Registry
 * Permet de remplacer l'usage de 'window' pour l'Event Delegator (dom-security.js).
 * En mode ES Modules, les fonctions ne sont plus attachées à window par défaut.
 * Chaque module doit enregistrer ses fonctions publiques ici via registerAction().
 */

export const Actions = {};

export function registerAction(name, fn) {
    if (typeof fn !== 'function') {
        console.warn(`[ActionRegistry] Tentative d'enregistrement d'une action invalide : ${name}`);
        return;
    }
    Actions[name] = fn;
    if (typeof window !== 'undefined' && !window[name]) {
        try {
            window[name] = fn;
        } catch (e) {}
    }
}

function walkPath(root, parts) {
    let fn = root;
    let ctx = root;
    for (const part of parts) {
        if (fn == null) return null;
        ctx = fn;
        fn = fn[part];
    }
    return typeof fn === 'function' ? { fn, ctx } : null;
}

/**
 * Trouve la fonction désignée par un chemin ("Auth.login", "window.doLogin") sans la lier :
 * { fn, ctx, fromWindow } ou null. Le registre Actions est prioritaire, window en repli.
 */
export function resolveActionTarget(path) {
    if (!path || typeof path !== 'string') return null;
    const parts = path.trim().split('.');
    const fromActions = walkPath(Actions, parts);
    if (fromActions) return { ...fromActions, fromWindow: false };
    if (typeof window !== 'undefined') {
        const fromWindow = walkPath(window, parts);
        if (fromWindow) return { ...fromWindow, fromWindow: true };
    }
    return null;
}

// Support pour les appels namespace (ex: "Auth.login" ou fonction globale "window.doLogin")
export function getAction(path) {
    const target = resolveActionTarget(path);
    return target ? target.fn.bind(target.ctx) : undefined;
}

if (typeof window !== 'undefined') {
    window.Actions = Actions;
    window.registerAction = registerAction;
    window.getAction = getAction;
}

