/**
 * Unit Tests for Moderation Engine & Group Spaces Protection
 * Vérifie :
 * - La détection avec base de données de mots grossiers et normalisation leetspeak
 * - L'application du bannissement définitif après 3 bannissements temporaires
 * - L'absence totale de remboursement en cas de bannissement
 * - La tolérance zéro pour les contenus illicites
 */

const fs = require('fs');
const path = require('path');

describe('Group Spaces Moderation & Strict Ban System (DSA Art. 16/17 & CGU)', () => {
    let Moderation;

    beforeEach(() => {
        const store = {};
        global.localStorage = {
            getItem: jest.fn(key => store[key] || null),
            setItem: jest.fn((key, val) => { store[key] = String(val); }),
            removeItem: jest.fn(key => { delete store[key]; }),
            clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); })
        };

        global.window = {
            session: { uid: "test_user_777", username: "PiloteTest" },
            FrenchBadWords: ["connard", "salope", "merde", "batard", "fdp", "enfoiré", "enculé"]
        };

        // Charger moderation.js en éliminant les imports/exports ES6 pour Jest
        const code = fs.readFileSync(path.resolve(__dirname, '../src/js/moderation.js'), 'utf8');
        const cleanedCode = code
            .replace(/import\s+[^;]+;?/g, '')
            .replace(/export default.*;|export\s*\{[^}]*\};?/g, '');
        eval(cleanedCode);
        Moderation = window.Moderation;
    });

    test('Normalise le leetspeak, la ponctuation et les lettres répétées', () => {
        expect(Moderation.normalizeText("c.0.n_n@rd")).toBe("connard");
        expect(Moderation.normalizeText("s@l0pe")).toBe("salope");
        expect(Moderation.normalizeText("m.e.r.d.e !")).toBe("merde");
        expect(Moderation.normalizeText("cooooonnnnard")).toBe("connard");
    });

    test('Détecte les mots grossiers standards et camouflés', () => {
        expect(Moderation.isProfane("Espèce de connard")).toBe(true);
        expect(Moderation.isProfane("Quel c.0.n.n.@.r.d")).toBe(true);
        expect(Moderation.isProfane("C'est de la m3rd3")).toBe(true);
        expect(Moderation.isProfane("Bonjour à tous sur le cortège !")).toBe(false);
    });

    test('Ne confond plus les mots de tous les jours avec des insultes (vrai dictionnaire)', () => {
        const dico = {};
        new Function('window', fs.readFileSync(path.resolve(__dirname, '../src/js/badwords.js'), 'utf8')
            .replace(/^s*import .*$/gm, ''))(dico);
        window.FrenchBadWords = dico.FrenchBadWords;
        for (const q of [
            "la fixation apparente, quelle est la conformité réglementaire d'un dispositif d'identification dont l'intégrité structurelle est compromise",
            "Si ma plaque d'immatriculation est mal fixée et risque de tomber, est-ce que je risque une amende même si elle est encore attachée ?",
            "Je dois passer le contrôle technique de mon véhicule",
            "Quels sont les conseils de conduite en circulation ?",
            "La pédale de frein est molle et ma moto est sale",
            "Je risque de crever un pneu, est-ce violer le code de rouler ainsi ?",
            "Ma salopette est dans le coffre, cap de la rue, cul-de-sac à droite",
            "Le cône est tombé, le disque est usé, la manche à air bouge",
        ]) {
            expect([q, Moderation.isProfane(q), Moderation.isZeroTolerance(q)]).toEqual([q, false, false]);
        }
        for (const q of ["Espèce de con !", "t'es un connard.", "c o n n a r d", "C.0.N.N.@.R.D", "va te faire enculer",
            "fils-de-pute", "quelle m3rd3", "bande de salopes", "ntm"]) {
            expect([q, Moderation.isProfane(q)]).toEqual([q, true]);
        }
    });

    test('Applique la progression stricte : 3 bans temporaires puis ban définitif sans remboursement', () => {
        const uid = "user_infracteur_1";
        const context = { space: "Crew Chat", uid, username: "BadPilot" };

        // 1er écart : 1er bannissement temporaire
        const res1 = Moderation.checkGroupMessage("Putain c'est nul", context);
        expect(res1.safe).toBe(false);
        expect(res1.action).toBe("TEMP_BAN");
        expect(res1.tempBansCount).toBe(1);
        expect(res1.userMessage).toContain("1er BANNISSEMENT TEMPORAIRE");
        expect(res1.userMessage).toContain("sans possibilité de remboursement");

        // 2e écart : 2e bannissement temporaire
        const res2 = Moderation.checkGroupMessage("Ferme ta gueule connard", context);
        expect(res2.safe).toBe(false);
        expect(res2.action).toBe("TEMP_BAN");
        expect(res2.tempBansCount).toBe(2);
        expect(res2.userMessage).toContain("2e BANNISSEMENT TEMPORAIRE");

        // 3e écart : 3e bannissement temporaire (Dernier avertissement)
        const res3 = Moderation.checkGroupMessage("Bande de salopes", context);
        expect(res3.safe).toBe(false);
        expect(res3.action).toBe("TEMP_BAN");
        expect(res3.tempBansCount).toBe(3);
        expect(res3.userMessage).toContain("3e BANNISSEMENT TEMPORAIRE");
        expect(res3.userMessage).toContain("DERNIER AVERTISSEMENT");

        // 4e écart (après 3 bannissements temporaires) : BANNISSEMENT DÉFINITIF SANS REMBOURSEMENT
        const res4 = Moderation.checkGroupMessage("Encore une insulte de merde", context);
        expect(res4.safe).toBe(false);
        expect(res4.action).toBe("PERM_BAN");
        expect(res4.userMessage).toContain("BANNISSEMENT DÉFINITIF");
        expect(res4.userMessage).toContain("sans aucune possibilité de remboursement");
    });

    test('Déclenche immédiatement le bannissement définitif en cas de contenu à Tolérance Zéro', () => {
        const uid = "user_nazi_999";
        const context = { space: "Cortège", uid, username: "Extremist" };

        const res = Moderation.checkGroupMessage("Espèce de nazi", context);
        expect(res.safe).toBe(false);
        expect(res.action).toBe("PERM_BAN");
        expect(res.userMessage).toContain("TOLÉRANCE ZÉRO");
        expect(res.userMessage).toContain("DÉFINITIVEMENT");
        expect(res.userMessage).toContain("sans aucune possibilité de remboursement");
    });

    test('Permet le recours humain et réinitialise le compteur à zéro avec 50 points de compensation si la sanction est annulée', async () => {
        const uid = "user_appeal_test_123";
        const context = { space: "Crew Chat", uid, username: "RiderInnocent" };

        // 1. L'utilisateur subit un premier bannissement temporaire
        Moderation.checkGroupMessage("Putain", context);
        let status = Moderation.getBanStatus(uid);
        expect(status.isTempBanned).toBe(true);
        expect(status.tempBansCount).toBe(1);

        // 2. L'utilisateur soumet une demande de réexamen via l'Avocat de Poche
        const firestore = () => ({ collection: () => ({ add: async () => ({}), doc: () => ({ set: async () => ({}) }) }) });
        firestore.FieldValue = { serverTimestamp: () => "maintenant" };
        global.firebase = { firestore };
        const appealRes = await Moderation.requestAppeal(uid, "C'était une citation de chanson, pas une insulte", "Contexte musical");
        delete global.firebase;
        expect(appealRes.success).toBe(true);
        expect(appealRes.compensationIfAccepted).toBe(50);

        status = Moderation.getBanStatus(uid);
        expect(status.appealPending).toBe(true);

        // Le compte de l'administrateur connecté ne doit RIEN recevoir : les 50 points vont
        // à l'utilisateur sanctionné, via la mise à jour de son profil (braveCoins + 50).
        window.BVCManager = { add: jest.fn() };

        // 3. La vérification humaine valide le rejet de la sanction
        const liftRes = await Moderation.liftBanAndResetStrikes(uid, "admin_moderator_1");
        expect(liftRes.success).toBe(true);
        expect(liftRes.compensationPoints).toBe(50);

        // 4. Vérification : interdiction levée, compteur réinitialisé à zéro, pas de double crédit
        const finalStatus = Moderation.getBanStatus(uid);
        expect(finalStatus.isBanned).toBe(false);
        expect(finalStatus.isTempBanned).toBe(false);
        expect(finalStatus.tempBansCount).toBe(0);
        expect(window.BVCManager.add).not.toHaveBeenCalled();
    });

    test('Un recours non enregistré le dit et ne reste pas en attente', async () => {
        const uid = "user_appeal_refuse";
        Moderation.checkGroupMessage("Putain", { space: "Crew Chat", uid, username: "Rider" });
        const firestore = () => ({ collection: () => ({ add: async () => { throw new Error("refusé"); } }) });
        firestore.FieldValue = { serverTimestamp: () => "maintenant" };
        global.firebase = { firestore };
        const res = await Moderation.requestAppeal(uid, "Malentendu");
        delete global.firebase;
        expect(res.success).toBe(false);
        expect(res.error).toContain("aucun point n'a été retiré");
        expect(Moderation.getBanStatus(uid).appealPending).toBeFalsy();
        expect((await Moderation.requestAppeal(uid, "Sans Firebase")).success).toBe(false);
    });
});
