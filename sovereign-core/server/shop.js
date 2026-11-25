/**
 * shop.js — Boutique des points mon50cc (25/11/2026) : ce que les points achètent dans l'appli.
 *
 * - Le prix vient de ce catalogue, jamais de la demande.
 * - L'achat est un mouvement « SHOP_PURCHASE » du grand livre des points (inaltérable), avec la clé
 *   unique « shop:<article> » : un article ne se paie qu'une fois, et cette ligne prouve l'achat
 *   (rien d'autre à stocker). SHOP_PURCHASE est réservé au serveur (points-rules.js) : l'appli ne
 *   peut pas l'imiter par /points/transact.
 * - Les voix de Nexus Atlas ont un prix mais ne sont pas encore en vente (aucune voix enregistrée).
 */
"use strict";

// Règle de prix : un article qui fait un don à une association coûte 550 points (dont le don).
const SHOP_ITEMS = Object.freeze({
    // Thème de soutien à la lutte contre le cancer du sein : pour chacun, mon50ccetmoi verse 1 € à
    // une association contre le cancer du sein, nommée seulement après son accord (de ses propres fonds ; total dû : GET /api/v1/admin/payments)
    THEME_PINK: { label: "Thème Rose", price: 550, available: true, donation: { association: "Cancer du sein (association à confirmer)", euros: 1 } },
    VOICE_CYBERPUNK: { label: "Voix Cyberpunk", price: 1000, available: false },
    VOICE_RALLYE: { label: "Voix Pilote de Rallye", price: 1000, available: false },
});
const SHOP_REASON = "SHOP_PURCHASE";

class ShopError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function createShopService({ store }) {
    async function owned(uid) {
        return new Set(await store.listShopPurchases(uid));
    }

    return {
        async catalog(authUser) {
            if (!authUser) throw new ShopError(401, "Connectez-vous pour voir la boutique.");
            const mine = await owned(authUser.uid);
            return { items: Object.entries(SHOP_ITEMS).map(([id, it]) => ({ id, ...it, owned: mine.has(id) })) };
        },

        /** Administrateur : dons dus aux associations (un par article débloqué). */
        async donations() {
            const out = [];
            for (const [id, it] of Object.entries(SHOP_ITEMS)) {
                if (!it.donation) continue;
                const achats = await store.countShopPurchases(id);
                out.push({ article: id, association: it.donation.association, achats, euros: achats * it.donation.euros });
            }
            return out;
        },

        async buy(authUser, body = {}) {
            if (!authUser) throw new ShopError(401, "Connectez-vous pour acheter.");
            const id = String(body.item || "");
            const item = Object.prototype.hasOwnProperty.call(SHOP_ITEMS, id) ? SHOP_ITEMS[id] : null;
            if (!item) throw new ShopError(404, "Article inconnu.");
            if (!item.available) throw new ShopError(400, `${item.label} : bientôt disponible.`);
            const result = await store.applyPointsTransaction({
                uid: authUser.uid, action: "DEDUCT", reason: SHOP_REASON, description: `Boutique : ${item.label}`,
                amount: item.price, idempotencyKey: `shop:${id}`, metadata: { item: id },
                checkCaps: () => ({ ok: true }),
            });
            // Déjà acheté : la clé unique rend le même mouvement, sans nouveau débit
            return { item: id, owned: true, alreadyOwned: result.idempotent, balance: result.balance };
        },
    };
}

module.exports = { createShopService, ShopError, SHOP_ITEMS, SHOP_REASON };
