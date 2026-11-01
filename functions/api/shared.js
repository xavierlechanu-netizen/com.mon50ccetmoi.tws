const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Client } = require("@notionhq/client");
const { GoogleAuth } = require("google-auth-library");
const crypto = require("crypto");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const googleAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

const REVOLUT_SECRET_KEY = defineSecret("REVOLUT_SECRET_KEY");
const REVOLUT_WEBHOOK_SECRET = defineSecret("REVOLUT_WEBHOOK_SECRET");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const NOTION_API_KEY = defineSecret("NOTION_API_KEY");
const NOTION_DATABASE_ID = defineSecret("NOTION_DATABASE_ID");
const METEO_FRANCE_API_KEY = defineSecret("METEO_FRANCE_API_KEY");
const PISTE_CLIENT_ID = defineSecret("PISTE_CLIENT_ID");
const PISTE_CLIENT_SECRET = defineSecret("PISTE_CLIENT_SECRET");
const PISTE_API_KEY = defineSecret("PISTE_API_KEY");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");
const FB_PAGE_ACCESS_TOKEN = defineSecret("FB_PAGE_ACCESS_TOKEN");
const FB_PAGE_ID = defineSecret("FB_PAGE_ID");

const REVOLUT_API_BASE    = "https://merchant.revolut.com/api";
const REVOLUT_API_VERSION = "2026-04-20";

function setCorsHeaders(res) {
    res.set("Access-Control-Allow-Origin",  "https://mon50ccetmoi.com");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function verifyAuthToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }
    const idToken = authHeader.split("Bearer ")[1];
    try {
        return await admin.auth().verifyIdToken(idToken);
    } catch (e) {
        console.warn("[Auth] Token verification failed:", e.message);
        return null;
    }
}

function maskUid(uid) {
    if (!uid || typeof uid !== "string") return "anonymous";
    if (uid.length <= 8) return uid;
    return `${uid.substring(0, 8)}...`;
}

module.exports = {
    onRequest, onCall, HttpsError, onDocumentCreated, defineSecret,
    admin, db, googleAuth, crypto, Client,
    REVOLUT_SECRET_KEY, REVOLUT_WEBHOOK_SECRET, GEMINI_API_KEY, NOTION_API_KEY, NOTION_DATABASE_ID,
    METEO_FRANCE_API_KEY, PISTE_CLIENT_ID, PISTE_CLIENT_SECRET, PISTE_API_KEY, SMTP_PASSWORD,
    REVOLUT_API_BASE, REVOLUT_API_VERSION, FB_PAGE_ACCESS_TOKEN, FB_PAGE_ID,
    setCorsHeaders, verifyAuthToken, maskUid
};
