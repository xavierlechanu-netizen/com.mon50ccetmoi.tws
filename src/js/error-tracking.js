/**
 * 🛡️ Crash Reporter & Error Tracking
 * Enterprise-grade monitoring system for mon50ccetmoi
 * Captures JavaScript errors and unhandled promise rejections,
 * and logs them securely to Firestore without interrupting the user.
 */

window.CrashReporter = {
  init: function () {
    // 1. Capture standard JS exceptions
    window.onerror = function (message, source, lineno, colno, error) {
      window.CrashReporter.logError({
        type: "TypeError/ReferenceError",
        message: message,
        source: source,
        line: lineno,
        col: colno,
        stack: error ? error.stack : "N/A",
      });
      // We do NOT return true, so the error still logs to the console for local debugging
      return false;
    };

    // 2. Capture Unhandled Promises (e.g., Firebase Auth failures, failed API calls)
    window.addEventListener("unhandledrejection", function (event) {
      window.CrashReporter.logError({
        type: "UnhandledPromiseRejection",
        message: event.reason
          ? event.reason.message || event.reason
          : "Unknown Promise Rejection",
        stack: event.reason ? event.reason.stack : "N/A",
      });
    });
  },

  logError: function (errorData) {
    // Prevent logging errors if Firebase isn't loaded or initialized yet
    try {
      const msgStr = String(errorData?.message || "");
      // Ignorer les erreurs bénignes de double-chargement de scripts tiers (Axeptio, extensions)
      if (/Axeptio SDK is already loaded|Script error\.?/i.test(msgStr)) {
        return;
      }

      if (
        typeof firebase === "undefined" ||
        !firebase.firestore ||
        !firebase.apps ||
        firebase.apps.length === 0
      )
        return;

      const currentUser = firebase.auth ? firebase.auth().currentUser : null;
      // firestore.rules exige isSignedIn() sur crash_reports et reportToNotion exige un Bearer token
      if (!currentUser) {
        return;
      }

      const db = firebase.firestore();
      const payload = {
        ...errorData,
        uid: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent,
        appVersion: "112.00.00",
        url: window.location.href,
        online: navigator.onLine,
        conversationSessionId: window.NexusAtlasGemini?.sessionId || null,
        category: errorData.category || (errorData.message && /map|google\.maps|leaflet|directions/i.test(errorData.message) ? "MAPS_API" : "GENERAL")
      };

      db.collection("crash_reports")
        .add(payload)
        .then(async () => {
          const idToken = await currentUser.getIdToken();
          if (!idToken) return;

          // Send to Notion Bug Tracker via Cloud Functions avec jeton Bearer valide (évite 401)
          fetch("https://europe-west1-mon50ccetmoi.cloudfunctions.net/reportToNotion", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              title: `[${payload.category}] ${errorData.type}: ${msgStr.substring(0, 50)}`,
              description: `Message: ${errorData.message}\nCatégorie: ${payload.category}\nSession: ${payload.conversationSessionId || 'N/A'}\nURL: ${payload.url}\nUserAgent: ${payload.userAgent}\nStack: ${errorData.stack}`,
              category: payload.category === "MAPS_API" ? "Cartographie" : "Bug Technique",
              priority: payload.category === "MAPS_API" ? "High" : "Medium"
            })
          }).catch(err => console.warn("🛡️ Failed to sync to Notion", err));
        })
        .catch((err) =>
          console.warn(
            "🛡️ Failed to send crash report (probably offline).",
            err,
          ),
        );

      // Also log to Firebase Analytics if available
      if (window.mon50Analytics) {
        window.mon50Analytics.logEvent("exception", {
          description: errorData.message,
          fatal: false,
        });
      }
    } catch (e) {
      console.warn("🛡️ CrashReporter internal error:", e);
    }
  },
};

// Auto-init as early as possible
window.CrashReporter.init();

// Global Logger Utility
window.logger = {
  error: function(message, details = null) {
    console.error("🚨 " + message, details || "");
    window.CrashReporter.logError({
      type: "ManualErrorLog",
      message: message,
      details: details ? JSON.stringify(details) : "N/A",
      stack: new Error().stack
    });
  },
  warn: function(message, details = null) {
    console.warn("⚠️ " + message, details || "");
  },
  info: function(message, details = null) {
    console.info("ℹ️ " + message, details || "");
  }
};
