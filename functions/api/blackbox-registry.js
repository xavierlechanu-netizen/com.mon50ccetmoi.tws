/**
 * BLACK BOX REGISTRY — Gestion centralisée des unités matérielles (Admin SDK)
 * ─────────────────────────────────────────────────────────────────────────────
 * Fonctions Cloud pour la traçabilité complète des boîtiers physiques :
 *  - Enregistrement des lots de fabrication Francelog S.A. (Linselles)
 *  - Attribution / désattribution des numéros de série aux commandes clients
 *  - Changement d'état dans le cycle de vie (machine à états stricte)
 *  - Journalisation immuable dans blackbox_units/{serial}/history
 *  - Traçabilité dans mod_logs et audit sans PII (NIST CSF 2.0 & RGPD)
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const { onCall, HttpsError, admin, db } = require("./shared");
const core = require("./blackbox-core");

/**
 * Vérification stricte du rôle administrateur côté serveur (Zero-Trust).
 * OWASP ASVS v5.0.0-8.x : Ne jamais faire confiance au client.
 */
async function assertAdmin(request) {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.auth.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== "admin") {
        console.warn(`[BlackboxRegistry] Tentative d'accès non autorisé par UID: ${core.shortUid(uid)}`);
        throw new HttpsError("permission-denied", "Accès administrateur requis.");
    }
    return { uid, adminData: userDoc.data() };
}

/**
 * 1. Enregistrement d'un lot de boîtiers (Prototypes Francelog P01-P10 ou Série).
 */
exports.adminRegisterBlackboxUnits = onCall(
    { region: "europe-west1", timeoutSeconds: 60, memory: "256MiB" },
    async (request) => {
        const { uid } = await assertAdmin(request);
        const data = request.data || {};

        const type = data.type;
        const revision = data.revision || "V1";
        const initialStatus = data.initialStatus || core.STATUSES.IN_STOCK;
        const batchNumber = core.normalizeBatchNumber(data.batchNumber) || "BATCH-FRANCELOG";
        const manufacturer = core.sanitizeText(data.manufacturer, 64) || core.DEFAULT_MANUFACTURER;
        const manufacturingSite = core.sanitizeText(data.manufacturingSite, 64) || core.DEFAULT_MANUFACTURING_SITE;
        const notes = core.sanitizeText(data.notes, 500) || "";
        const mfgDate = core.parseIsoDate(data.manufacturedAt) || new Date();

        if (!core.HW_REVISIONS.includes(revision)) {
            throw new HttpsError("invalid-argument", `Révision matérielle '${revision}' non supportée.`);
        }
        if (!core.INITIAL_STATUSES.includes(initialStatus)) {
            throw new HttpsError("invalid-argument", `Statut initial '${initialStatus}' invalide.`);
        }

        const registryRef = db.collection("blackbox_registry").doc(revision);

        if (type === core.UNIT_TYPES.PROTOTYPE) {
            // Enregistrement d'un prototype
            const requestedUnit = data.unitNumber ? parseInt(data.unitNumber, 10) : null;
            if (requestedUnit !== null && (requestedUnit < 1 || requestedUnit > core.MAX_PROTOTYPES)) {
                throw new HttpsError("invalid-argument", `Le numéro de prototype doit être compris entre 1 et ${core.MAX_PROTOTYPES}.`);
            }

            const result = await db.runTransaction(async (t) => {
                const regDoc = await t.get(registryRef);
                const regData = regDoc.exists ? regDoc.data() : {
                    revision,
                    nextSeriesNumber: 1,
                    prototypesAllocated: [],
                    totalUnits: 0,
                    prototypeUnits: 0,
                    seriesUnits: 0,
                    statusCounts: {}
                };

                const allocated = Array.isArray(regData.prototypesAllocated) ? regData.prototypesAllocated : [];
                let chosenUnit = requestedUnit;

                if (chosenUnit !== null) {
                    if (allocated.includes(chosenUnit)) {
                        throw new HttpsError("already-exists", `Le prototype P${chosenUnit < 10 ? "0" + chosenUnit : chosenUnit} est déjà enregistré.`);
                    }
                } else {
                    // Trouver le premier emplacement libre 1..10
                    for (let i = 1; i <= core.MAX_PROTOTYPES; i++) {
                        if (!allocated.includes(i)) {
                            chosenUnit = i;
                            break;
                        }
                    }
                    if (chosenUnit === null) {
                        throw new HttpsError("resource-exhausted", `Les ${core.MAX_PROTOTYPES} prototypes Francelog sont déjà tous enregistrés.`);
                    }
                }

                const serial = core.formatSerial(revision, core.UNIT_TYPES.PROTOTYPE, chosenUnit);
                const unitRef = db.collection("blackbox_units").doc(serial);
                const existingUnit = await t.get(unitRef);
                if (existingUnit.exists) {
                    throw new HttpsError("already-exists", `Le boîtier ${serial} existe déjà.`);
                }

                const now = admin.firestore.FieldValue.serverTimestamp();
                const warranty = core.computeWarranty(core.UNIT_TYPES.PROTOTYPE, true, new Date());
                const blePasskey = (data.blePasskey && core.isValidBluetoothPasskey(data.blePasskey))
                    ? data.blePasskey.trim()
                    : core.generateBluetoothPasskey();
                const padStr = chosenUnit < 10 ? "0" + chosenUnit : String(chosenUnit);
                const unitCode = `P${padStr}`;

                const unitDocData = {
                    serial,
                    type: core.UNIT_TYPES.PROTOTYPE,
                    unitNumber: chosenUnit,
                    unitCode,
                    hwRevision: revision,
                    manufacturer,
                    manufacturingSite,
                    partnerStatus: core.PARTNER_PROTOTYPE_STATUS,
                    deliveryGuarantee: core.DELIVERY_GUARANTEE,
                    batchNumber,
                    manufacturedAt: admin.firestore.Timestamp.fromDate(mfgDate),
                    status: initialStatus,
                    blePasskey,
                    bleMac: null,
                    firmwareVersion: "1.0.0",
                    saleOrderId: null,
                    ownerUid: null,
                    soldAt: null,
                    activatedAt: null,
                    warrantyType: warranty.warrantyType,
                    warrantyEndsAt: null,
                    notes,
                    createdAt: now,
                    createdBy: uid,
                    updatedAt: now,
                    updatedBy: uid
                };

                t.set(unitRef, unitDocData);

                // Historique immuable
                const histRef = unitRef.collection("history").doc();
                t.set(histRef, {
                    action: "UNIT_CREATED",
                    fromStatus: null,
                    toStatus: initialStatus,
                    byUid: uid,
                    reason: "Fabrication prototype Francelog",
                    timestamp: now
                });

                // Mise à jour du registre
                const newAllocated = [...allocated, chosenUnit].sort((a, b) => a - b);
                const statusCounts = regData.statusCounts || {};
                statusCounts[initialStatus] = (statusCounts[initialStatus] || 0) + 1;

                t.set(registryRef, {
                    ...regData,
                    prototypesAllocated: newAllocated,
                    totalUnits: (regData.totalUnits || 0) + 1,
                    prototypeUnits: newAllocated.length,
                    statusCounts,
                    updatedAt: now
                }, { merge: true });

                return { serial, unitNumber: chosenUnit };
            });

            console.log(`[BlackboxRegistry] Prototype enregistré : ${result.serial} par ${core.shortUid(uid)}`);
            return { success: true, count: 1, createdSerials: [result.serial] };

        } else if (type === core.UNIT_TYPES.SERIES) {
            // Enregistrement d'un lot de série
            const count = parseInt(data.count, 10);
            if (!Number.isInteger(count) || count < 1 || count > core.SERIES_BATCH_MAX) {
                throw new HttpsError("invalid-argument", `Le nombre d'unités de série par lot doit être compris entre 1 et ${core.SERIES_BATCH_MAX}.`);
            }

            const createdSerials = await db.runTransaction(async (t) => {
                const regDoc = await t.get(registryRef);
                const regData = regDoc.exists ? regDoc.data() : {
                    revision,
                    nextSeriesNumber: 1,
                    prototypesAllocated: [],
                    totalUnits: 0,
                    prototypeUnits: 0,
                    seriesUnits: 0,
                    statusCounts: {}
                };

                let startUnit = regData.nextSeriesNumber || 1;
                if (data.startCode) {
                    const parsedStart = core.seriesCodeToUnitNumber(data.startCode);
                    if (parsedStart === null) {
                        throw new HttpsError("invalid-argument", `Code de début de série '${data.startCode}' invalide. La série commence à A01 et le 00 est exclu.`);
                    }
                    startUnit = parsedStart;
                } else if (data.startUnit) {
                    const s = parseInt(data.startUnit, 10);
                    if (!Number.isInteger(s) || s < 1) {
                        throw new HttpsError("invalid-argument", "Numéro d'unité de départ invalide.");
                    }
                    startUnit = s;
                }

                const endUnit = startUnit + count - 1;

                if (endUnit > core.SERIES_MAX) {
                    throw new HttpsError("resource-exhausted", "Capacité maximale de numérotation de série atteinte.");
                }

                const now = admin.firestore.FieldValue.serverTimestamp();
                const warranty = core.computeWarranty(core.UNIT_TYPES.SERIES, false, new Date());
                const serials = [];

                for (let unitNum = startUnit; unitNum <= endUnit; unitNum++) {
                    const unitCode = core.unitNumberToSeriesCode(unitNum);
                    const serial = core.formatSerial(revision, core.UNIT_TYPES.SERIES, unitNum);
                    serials.push(serial);
                    const unitRef = db.collection("blackbox_units").doc(serial);

                    const blePasskey = (count === 1 && data.blePasskey && core.isValidBluetoothPasskey(data.blePasskey))
                        ? data.blePasskey.trim()
                        : core.generateBluetoothPasskey();

                    const unitDocData = {
                        serial,
                        type: core.UNIT_TYPES.SERIES,
                        unitNumber: unitNum,
                        unitCode,
                        hwRevision: revision,
                        manufacturer,
                        manufacturingSite,
                        partnerStatus: core.PARTNER_SERIES_STATUS,
                        deliveryGuarantee: core.DELIVERY_GUARANTEE,
                        batchNumber,
                        manufacturedAt: admin.firestore.Timestamp.fromDate(mfgDate),
                        status: initialStatus,
                        blePasskey,
                        bleMac: null,
                        firmwareVersion: "1.0.0",
                        saleOrderId: null,
                        ownerUid: null,
                        soldAt: null,
                        activatedAt: null,
                        warrantyType: warranty.warrantyType,
                        warrantyEndsAt: null,
                        notes,
                        createdAt: now,
                        createdBy: uid,
                        updatedAt: now,
                        updatedBy: uid
                    };

                    t.set(unitRef, unitDocData);

                    const histRef = unitRef.collection("history").doc();
                    t.set(histRef, {
                        action: "UNIT_CREATED",
                        fromStatus: null,
                        toStatus: initialStatus,
                        byUid: uid,
                        reason: `Lot de série Francelog ${batchNumber}`,
                        timestamp: now
                    });
                }

                const statusCounts = regData.statusCounts || {};
                statusCounts[initialStatus] = (statusCounts[initialStatus] || 0) + count;

                t.set(registryRef, {
                    ...regData,
                    nextSeriesNumber: endUnit + 1,
                    totalUnits: (regData.totalUnits || 0) + count,
                    seriesUnits: (regData.seriesUnits || 0) + count,
                    statusCounts,
                    updatedAt: now
                }, { merge: true });

                return serials;
            });

            console.log(`[BlackboxRegistry] Lot de série enregistré : ${createdSerials.length} unités (${createdSerials[0]} à ${createdSerials[createdSerials.length - 1]})`);
            return { success: true, count: createdSerials.length, createdSerials };

        } else {
            throw new HttpsError("invalid-argument", "Type d'unité inconnu (doit être PROTOTYPE ou SERIES).");
        }
    }
);

/**
 * 2. Mise à jour de statut avec validation stricte de la machine à états.
 */
exports.adminUpdateBlackboxStatus = onCall(
    { region: "europe-west1", timeoutSeconds: 30, memory: "256MiB" },
    async (request) => {
        const { uid } = await assertAdmin(request);
        const { serial, newStatus, reason } = request.data || {};

        if (!core.isValidSerial(serial)) {
            throw new HttpsError("invalid-argument", "Numéro de série invalide.");
        }
        if (!core.isKnownStatus(newStatus)) {
            throw new HttpsError("invalid-argument", `Statut '${newStatus}' inconnu.`);
        }
        if (core.requiresReason(newStatus) && (!reason || reason.trim().length < 5)) {
            throw new HttpsError("invalid-argument", `Un motif détaillé (min. 5 caractères) est obligatoire pour le statut ${newStatus}.`);
        }

        const safeReason = core.sanitizeText(reason, 250) || "Modification manuelle administrateur";
        const unitRef = db.collection("blackbox_units").doc(serial);

        const result = await db.runTransaction(async (t) => {
            const unitDoc = await t.get(unitRef);
            if (!unitDoc.exists) {
                throw new HttpsError("not-found", `Boîtier ${serial} introuvable.`);
            }

            const data = unitDoc.data();
            const currentStatus = data.status;

            if (currentStatus === newStatus) {
                return { serial, currentStatus, newStatus, unchanged: true };
            }

            if (!core.canTransition(currentStatus, newStatus)) {
                throw new HttpsError("failed-precondition", `Transition non autorisée : de '${currentStatus}' vers '${newStatus}'.`);
            }

            if (core.isAssignmentOnlyTransition(currentStatus, newStatus)) {
                throw new HttpsError("failed-precondition", "Cette transition s'effectue obligatoirement via l'attribution/désattribution de commande.");
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            t.update(unitRef, {
                status: newStatus,
                updatedAt: now,
                updatedBy: uid
            });

            // Historique immuable
            const histRef = unitRef.collection("history").doc();
            t.set(histRef, {
                action: "STATUS_CHANGED",
                fromStatus: currentStatus,
                toStatus: newStatus,
                byUid: uid,
                reason: safeReason,
                timestamp: now
            });

            // Mise à jour compteurs de statut dans blackbox_registry
            const regRef = db.collection("blackbox_registry").doc(data.hwRevision || "V1");
            const regDoc = await t.get(regRef);
            if (regDoc.exists) {
                const regData = regDoc.data();
                const counts = regData.statusCounts || {};
                counts[currentStatus] = Math.max(0, (counts[currentStatus] || 1) - 1);
                counts[newStatus] = (counts[newStatus] || 0) + 1;
                t.update(regRef, { statusCounts: counts, updatedAt: now });
            }

            return { serial, oldStatus: currentStatus, newStatus };
        });

        console.log(`[BlackboxRegistry] Statut mis à jour pour ${serial} : ${result.oldStatus} -> ${result.newStatus}`);
        return { success: true, ...result };
    }
);

/**
 * 3. Attribution d'un boîtier à un acheteur (Vente vérifiée / Commande Revolut).
 */
exports.adminAssignBlackbox = onCall(
    { region: "europe-west1", timeoutSeconds: 30, memory: "256MiB" },
    async (request) => {
        const { uid } = await assertAdmin(request);
        const { serial, orderId, manualOwnerUid, reason } = request.data || {};

        if (!core.isValidSerial(serial)) {
            throw new HttpsError("invalid-argument", "Numéro de série invalide.");
        }

        const unitRef = db.collection("blackbox_units").doc(serial);

        const result = await db.runTransaction(async (t) => {
            const unitDoc = await t.get(unitRef);
            if (!unitDoc.exists) {
                throw new HttpsError("not-found", `Boîtier ${serial} introuvable.`);
            }

            const unitData = unitDoc.data();
            if (unitData.status !== core.STATUSES.IN_STOCK) {
                throw new HttpsError("failed-precondition", `Seul un boîtier EN STOCK peut être attribué (statut actuel : ${unitData.status}).`);
            }

            let targetOwnerUid = null;
            let targetOrderId = null;
            let orderRef = null;

            if (orderId) {
                orderRef = db.collection("blackbox_sales").doc(orderId);
                const orderDoc = await t.get(orderRef);
                if (!orderDoc.exists) {
                    throw new HttpsError("not-found", `Commande ${orderId} introuvable dans blackbox_sales.`);
                }
                const orderData = orderDoc.data();
                if (orderData.status && orderData.status !== "PAID" && orderData.status !== "COMPLETED") {
                    throw new HttpsError("failed-precondition", `La commande ${orderId} n'est pas encore payée (statut: ${orderData.status}).`);
                }
                if (orderData.assignedSerial && orderData.assignedSerial !== serial) {
                    throw new HttpsError("failed-precondition", `La commande ${orderId} est déjà liée au boîtier ${orderData.assignedSerial}.`);
                }
                targetOwnerUid = orderData.userId;
                targetOrderId = orderId;
            } else if (manualOwnerUid) {
                // Attribution manuelle (ex: remplacement SAV direct, flotte partenaire)
                const userDoc = await t.get(db.collection("users").doc(manualOwnerUid));
                if (!userDoc.exists) {
                    throw new HttpsError("not-found", `Utilisateur client ${manualOwnerUid} introuvable.`);
                }
                targetOwnerUid = manualOwnerUid;
                targetOrderId = "MANUAL_ASSIGN";
            } else {
                throw new HttpsError("invalid-argument", "Un orderId de commande ou un manualOwnerUid est requis.");
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            const warranty = core.computeWarranty(unitData.type, unitData.type === core.UNIT_TYPES.PROTOTYPE, new Date());

            // Mise à jour de l'unité
            t.update(unitRef, {
                status: core.STATUSES.SOLD,
                ownerUid: targetOwnerUid,
                saleOrderId: targetOrderId,
                soldAt: now,
                warrantyType: warranty.warrantyType,
                warrantyEndsAt: warranty.warrantyEndsAt ? admin.firestore.Timestamp.fromDate(warranty.warrantyEndsAt) : null,
                updatedAt: now,
                updatedBy: uid
            });

            // Mise à jour du profil utilisateur (rattachement du S/N)
            const userRef = db.collection("users").doc(targetOwnerUid);
            t.update(userRef, {
                blackbox_serial: serial,
                blackbox_assigned_at: now
            });

            // Si commande blackbox_sales, marquer l'assignation
            if (orderRef) {
                t.update(orderRef, {
                    assignedSerial: serial,
                    assignedAt: now
                });
            }

            // Historique immuable
            const histRef = unitRef.collection("history").doc();
            t.set(histRef, {
                action: "ASSIGNED_TO_OWNER",
                fromStatus: core.STATUSES.IN_STOCK,
                toStatus: core.STATUSES.SOLD,
                byUid: uid,
                ownerUid: targetOwnerUid,
                orderId: targetOrderId,
                reason: core.sanitizeText(reason, 200) || `Attribution commande ${targetOrderId}`,
                timestamp: now
            });

            // Mise à jour des stats registre
            const regRef = db.collection("blackbox_registry").doc(unitData.hwRevision || "V1");
            const regDoc = await t.get(regRef);
            if (regDoc.exists) {
                const regData = regDoc.data();
                const counts = regData.statusCounts || {};
                counts[core.STATUSES.IN_STOCK] = Math.max(0, (counts[core.STATUSES.IN_STOCK] || 1) - 1);
                counts[core.STATUSES.SOLD] = (counts[core.STATUSES.SOLD] || 0) + 1;
                t.update(regRef, { statusCounts: counts, updatedAt: now });
            }

            return { serial, ownerUid: targetOwnerUid, orderId: targetOrderId, warrantyType: warranty.warrantyType };
        });

        console.log(`[BlackboxRegistry] Boîtier ${serial} attribué au client ${core.shortUid(result.ownerUid)}`);
        return { success: true, ...result };
    }
);

/**
 * 4. Désattribution d'un boîtier (Rétractation / Annulation / Retour stock).
 */
exports.adminUnassignBlackbox = onCall(
    { region: "europe-west1", timeoutSeconds: 30, memory: "256MiB" },
    async (request) => {
        const { uid } = await assertAdmin(request);
        const { serial, reason } = request.data || {};

        if (!core.isValidSerial(serial)) {
            throw new HttpsError("invalid-argument", "Numéro de série invalide.");
        }
        if (!reason || reason.trim().length < 5) {
            throw new HttpsError("invalid-argument", "Un motif détaillé (min. 5 caractères) est requis pour désattribuer un boîtier.");
        }

        const unitRef = db.collection("blackbox_units").doc(serial);

        const result = await db.runTransaction(async (t) => {
            const unitDoc = await t.get(unitRef);
            if (!unitDoc.exists) {
                throw new HttpsError("not-found", `Boîtier ${serial} introuvable.`);
            }

            const data = unitDoc.data();
            if (data.status !== core.STATUSES.SOLD && data.status !== core.STATUSES.ACTIVE) {
                throw new HttpsError("failed-precondition", `Seul un boîtier VENDU ou ACTIF peut être désattribué (statut : ${data.status}).`);
            }

            const prevOwner = data.ownerUid;
            const now = admin.firestore.FieldValue.serverTimestamp();

            t.update(unitRef, {
                status: core.STATUSES.IN_STOCK,
                ownerUid: null,
                saleOrderId: null,
                soldAt: null,
                activatedAt: null,
                updatedAt: now,
                updatedBy: uid
            });

            // Détacher du profil utilisateur si toujours associé
            if (prevOwner) {
                const userRef = db.collection("users").doc(prevOwner);
                const userDoc = await t.get(userRef);
                if (userDoc.exists && userDoc.data().blackbox_serial === serial) {
                    t.update(userRef, {
                        blackbox_serial: admin.firestore.FieldValue.delete(),
                        blackbox_unassigned_at: now
                    });
                }
            }

            // Historique immuable
            const histRef = unitRef.collection("history").doc();
            t.set(histRef, {
                action: "UNASSIGNED",
                fromStatus: data.status,
                toStatus: core.STATUSES.IN_STOCK,
                byUid: uid,
                prevOwnerUid: prevOwner,
                reason: core.sanitizeText(reason, 250),
                timestamp: now
            });

            // Mise à jour registre
            const regRef = db.collection("blackbox_registry").doc(data.hwRevision || "V1");
            const regDoc = await t.get(regRef);
            if (regDoc.exists) {
                const regData = regDoc.data();
                const counts = regData.statusCounts || {};
                counts[data.status] = Math.max(0, (counts[data.status] || 1) - 1);
                counts[core.STATUSES.IN_STOCK] = (counts[core.STATUSES.IN_STOCK] || 0) + 1;
                t.update(regRef, { statusCounts: counts, updatedAt: now });
            }

            return { serial, prevOwner };
        });

        console.log(`[BlackboxRegistry] Boîtier ${serial} désattribué (ancien propriétaire : ${core.shortUid(result.prevOwner)})`);
        return { success: true, ...result };
    }
);

/**
 * 5. Mise à jour des informations techniques / d'appairage (BLE MAC, Firmware, Notes).
 */
exports.adminUpdateBlackboxInfo = onCall(
    { region: "europe-west1", timeoutSeconds: 30, memory: "256MiB" },
    async (request) => {
        const { uid } = await assertAdmin(request);
        const { serial, blePasskey, bleMac, firmwareVersion, batchNumber, notes } = request.data || {};

        if (!core.isValidSerial(serial)) {
            throw new HttpsError("invalid-argument", "Numéro de série invalide.");
        }

        const updates = {};
        const changes = [];

        if (blePasskey !== undefined) {
            if (!core.isValidBluetoothPasskey(blePasskey)) {
                throw new HttpsError("invalid-argument", "Code Bluetooth invalide (exactement 6 chiffres).");
            }
            updates.blePasskey = blePasskey.trim();
            changes.push("code Bluetooth mis à jour");
        }

        if (bleMac !== undefined) {
            if (bleMac === null || bleMac === "") {
                updates.bleMac = null;
                changes.push("bleMac effacé");
            } else {
                const normMac = core.normalizeMac(bleMac);
                if (!normMac) throw new HttpsError("invalid-argument", "Adresse MAC BLE invalide (format AA:BB:CC:DD:EE:FF).");
                updates.bleMac = normMac;
                changes.push(`bleMac -> ${normMac}`);
            }
        }

        if (firmwareVersion !== undefined) {
            if (!core.isValidFirmwareVersion(firmwareVersion)) {
                throw new HttpsError("invalid-argument", "Version firmware invalide (ex: 1.0.0 ou 1.2.3-beta).");
            }
            updates.firmwareVersion = firmwareVersion.trim();
            changes.push(`firmware -> ${updates.firmwareVersion}`);
        }

        if (batchNumber !== undefined) {
            const normBatch = core.normalizeBatchNumber(batchNumber);
            if (!normBatch) throw new HttpsError("invalid-argument", "Numéro de lot invalide (caractères alphanumériques et tirets).");
            updates.batchNumber = normBatch;
            changes.push(`batchNumber -> ${normBatch}`);
        }

        if (notes !== undefined) {
            const safeNotes = core.sanitizeText(notes, 500);
            if (safeNotes === null) throw new HttpsError("invalid-argument", "Notes trop longues (max 500 caractères).");
            updates.notes = safeNotes;
            changes.push("notes mises à jour");
        }

        if (Object.keys(updates).length === 0) {
            return { success: true, message: "Aucune modification fournie." };
        }

        const unitRef = db.collection("blackbox_units").doc(serial);
        const now = admin.firestore.FieldValue.serverTimestamp();
        updates.updatedAt = now;
        updates.updatedBy = uid;

        await unitRef.update(updates);

        // Trace historique
        await unitRef.collection("history").add({
            action: "INFO_UPDATED",
            byUid: uid,
            changes,
            timestamp: now
        });

        console.log(`[BlackboxRegistry] Informations mises à jour pour ${serial} : ${changes.join(", ")}`);
        return { success: true, serial, changes };
    }
);
