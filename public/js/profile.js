/**
 * Gestion du Profil Utilisateur & Mode Hôte de Recharge
 */

document.addEventListener("DOMContentLoaded", () => {
    // Éléments du DOM
    const nameEl = document.getElementById("profile-name");
    const avatarEl = document.getElementById("profile-avatar");
    const bvcEl = document.getElementById("profile-bvc");
    const hostToggle = document.getElementById("host-toggle");
    const hostSettings = document.getElementById("host-settings");
    const hostPrice = document.getElementById("host-price");
    
    const vehicleSelect = document.getElementById("profile-vehicle-select");
    const vehicleLabel = document.getElementById("current-vehicle-label");

    // Attente de l'authentification Firebase
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // Remplir les infos de base
                nameEl.textContent = user.displayName || user.email.split('@')[0];
                if (user.photoURL) {
                    avatarEl.src = user.photoURL;
                } else {
                    avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameEl.textContent)}&background=111&color=00f2ff`;
                }

                // Charger les données Firestore (BVC, Host Status)
                loadUserProfile(user.uid);
            } else {
                // Pas connecté, redirection
                window.location.href = "login.html";
            }
        });
    }

    function loadUserProfile(uid) {
        if (!window.db) return;

        const userRef = window.db.collection('users').doc(uid);
        
        // Écoute en temps réel
        userRef.onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                // Mettre à jour le BVC
                if (data.bvc !== undefined) {
                    bvcEl.textContent = `${data.bvc} BVC`;
                }

                // Mettre à jour l'état Hôte
                if (data.isChargingHost) {
                    hostToggle.checked = true;
                    hostSettings.style.display = "flex";
                } else {
                    hostToggle.checked = false;
                    hostSettings.style.display = "none";
                }

                if (data.chargingPriceBvc) {
                    hostPrice.value = data.chargingPriceBvc;
                }

                // Mettre à jour le Garage Virtuel
                if (data.vehicleModel) {
                    vehicleSelect.value = data.vehicleModel;
                    updateVehicleLabel(data.vehicleModel);
                }

                // Logique des Badges & Succès
                // 1. Badge Fondateur (Toujours actif pour les premiers inscrits)
                // Déjà actif par défaut en HTML avec la classe 'unlocked'

                // 2. Badge Hôte de Choc
                const badgeHost = document.getElementById("badge-host");
                if (badgeHost) {
                    if (data.isChargingHost) {
                        badgeHost.classList.add("unlocked");
                    } else {
                        badgeHost.classList.remove("unlocked");
                    }
                }

                // 3. Badge Mécano (Si l'utilisateur a publié au moins une annonce)
                const badgeMechanic = document.getElementById("badge-mechanic");
                if (badgeMechanic && data.hasPublishedListing) {
                    badgeMechanic.classList.add("unlocked");
                }

            } else {
                // Créer le profil s'il n'existe pas
                userRef.set({
                    bvc: 1500, // Cadeau de bienvenue (simulation)
                    isChargingHost: false,
                    chargingPriceBvc: 50,
                    vehicleModel: "universel",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        });
    }

    function updateVehicleLabel(val) {
        if (!vehicleSelect) return;
        const option = Array.from(vehicleSelect.options).find(opt => opt.value === val);
        if (option && vehicleLabel) {
            vehicleLabel.textContent = option.textContent;
        }
    }

    // Gestion de la sauvegarde du véhicule
    if (vehicleSelect) {
        vehicleSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            updateVehicleLabel(val);
            const user = firebase.auth().currentUser;
            if (user && window.db) {
                window.db.collection('users').doc(user.uid).update({
                    vehicleModel: val
                }).then(() => {
                    // Mettre à jour la session globale pour la marketplace
                    if (window.session) {
                        window.session.vehicleModel = val;
                    }
                }).catch(console.error);
            }
        });
    }

    // Gestion du Toggle "Hôte de Recharge"
    hostToggle.addEventListener("change", (e) => {
        const isHost = e.target.checked;
        hostSettings.style.display = isHost ? "flex" : "none";

        const user = firebase.auth().currentUser;
        if (user && window.db) {
            window.db.collection('users').doc(user.uid).update({
                isChargingHost: isHost
            }).then(() => {
                // Si on devient hôte, on peut aussi publier automatiquement une annonce "Service" dans la marketplace
                publishHostServiceListing(user, isHost);
            }).catch(console.error);
        }
    });

    // Mise à jour du prix
    hostPrice.addEventListener("change", (e) => {
        const user = firebase.auth().currentUser;
        const newPrice = parseInt(e.target.value, 10);
        if (user && window.db && !isNaN(newPrice)) {
            window.db.collection('users').doc(user.uid).update({
                chargingPriceBvc: newPrice
            }).then(() => {
                publishHostServiceListing(user, true, newPrice);
            });
        }
    });

    function publishHostServiceListing(user, isHost, price = null) {
        // Cette fonction crée ou supprime une annonce dans la collection 'marketplace'
        const listingId = `host_${user.uid}`;
        const marketRef = window.db.collection('marketplace').doc(listingId);

        if (isHost) {
            const currentPrice = price || parseInt(hostPrice.value, 10) || 50;
            marketRef.set({
                title: "Recharge Communautaire - Chez " + (user.displayName || "Moi"),
                description: "Venez recharger votre scooter 50cc ou Ami chez moi ! Prise standard 220V disponible. Tarif à l'heure de charge.",
                priceBvc: currentPrice,
                priceType: "bvc", // Uniquement en BVC
                condition: "service", // Nouveau type "Service"
                category: "services", // Nouvelle catégorie
                sellerId: user.uid,
                sellerName: user.displayName || user.email.split('@')[0],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                imageUrl: "https://images.unsplash.com/photo-1549423668-cb0a4c5ce8b1?q=80&w=600&auto=format&fit=crop" // Image générique prise électrique
            }, { merge: true });
        } else {
            // L'utilisateur ne veut plus être hôte, on supprime l'annonce
            marketRef.delete();
        }
    }
});
