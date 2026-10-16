/**
 * FIREBASE CLOUD FUNCTIONS — mon50ccetmoi
 * ─────────────────────────────────────────────────────────────────────────────
 * L'architecture a été modularisée (Phase 1).
 * Toutes les fonctions se trouvent dans le dossier `api/`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const auth = require('./api/auth');
const payments = require('./api/payments');
const services = require('./api/services');
const iot = require('./api/iot');
const alerts = require('./api/alerts');
const social = require('./api/social');
const nexusInsights = require('./api/nexus-insights');
const blackboxRegistry = require('./api/blackbox-registry');

module.exports = {
    // Auth & Identity (FIDO2 & RGPD)
    deleteUserAccount: auth.deleteUserAccount,
    fidoGenerateRegistration: auth.fidoGenerateRegistration,
    fidoVerifyRegistration: auth.fidoVerifyRegistration,
    fidoGenerateAuthentication: auth.fidoGenerateAuthentication,
    fidoVerifyAuthentication: auth.fidoVerifyAuthentication,

    // Payments (Revolut & Pennylane)
    createRevolutOrder: payments.createRevolutOrder,
    revolutWebhook: payments.revolutWebhook,
    checkPaymentStatus: payments.checkPaymentStatus,

    // Services (Gemini, Notion, Meteo, Legifrance)
    sendWelcomeEmail: services.sendWelcomeEmail,
    askNexusAtlasGemini: services.askNexusAtlasGemini,
    reportToNotion: services.reportToNotion,
    getVigilanceMeteo: services.getVigilanceMeteo,
    searchLegifrancePiste: services.searchLegifrancePiste,

    // IoT & Hardware
    iotFdoRendezvous: iot.iotFdoRendezvous,
    uploadBlackboxTelemetry: iot.uploadBlackboxTelemetry,

    // Alerts & Safety
    sendEmergencySOS: alerts.sendEmergencySOS,
    triggerAntiTheftAlert: alerts.triggerAntiTheftAlert,
    createHazardReport: alerts.createHazardReport,

    // Social Media (Facebook Page)
    publishToFacebook: social.publishToFacebook,
    autoPublishFacebookNexusAtlas: social.autoPublishFacebookNexusAtlas,
    previewFacebookDailyPost: social.previewFacebookDailyPost,

    // Nexus Atlas Autonomous Intelligence (Logs & Insights)
    autoAnalyzeNexusInsights: nexusInsights.autoAnalyzeNexusInsights,
    triggerNexusAnalysis: nexusInsights.triggerNexusAnalysis,

    // Black Box Hardware Registry (Francelog S.A. Linselles)
    adminRegisterBlackboxUnits: blackboxRegistry.adminRegisterBlackboxUnits,
    adminUpdateBlackboxStatus: blackboxRegistry.adminUpdateBlackboxStatus,
    adminAssignBlackbox: blackboxRegistry.adminAssignBlackbox,
    adminUnassignBlackbox: blackboxRegistry.adminUnassignBlackbox,
    adminUpdateBlackboxInfo: blackboxRegistry.adminUpdateBlackboxInfo
};
