const admin = require('firebase-admin');

// Remplacez par le chemin vers votre clé de service Firebase si vous l'exécutez en local
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Si exécuté depuis un environnement configuré (Google Cloud, ou avec GOOGLE_APPLICATION_CREDENTIALS) :
admin.initializeApp();

const db = admin.firestore();

async function giftEarlyAdopters() {
    console.log("🎁 Lancement de l'Airdrop : Cadeau de 5.00 BVC pour les premiers pilotes...");
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();

        if (snapshot.empty) {
            console.log("Aucun utilisateur trouvé.");
            return;
        }

        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            // On récupère le solde actuel (0 si non défini)
            const currentBVC = parseFloat(data.bvcPoints || data.braveCoins || 0);
            const newBVC = currentBVC + 5.00;

            // On met à jour les différents champs pour assurer la compatibilité
            batch.update(doc.ref, {
                bvcPoints: newBVC,
                braveCoins: newBVC
            });
            count++;
            console.log(`- Cadeau préparé pour le pilote : ${data.username || doc.id}`);
        });

        // Application de toutes les modifications en une seule transaction
        await batch.commit();
        console.log(`✅ Airdrop réussi ! 5.00 BVC ont été crédités à ${count} utilisateurs.`);

    } catch (error) {
        console.error("Erreur lors de la distribution du cadeau :", error);
    }
}

giftEarlyAdopters();
