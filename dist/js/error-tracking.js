/**
 * 🛡ï¸ Crash Reporter & Error Tracking
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
      if (
        typeof firebase === "undefined" ||
        !firebase.firestore ||
        !firebase.apps ||
        firebase.apps.length === 0
      )
        return;

      const db = firebase.firestore();
      const payload = {
        ...errorData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent,
        appVersion: "100.80.00", // Updated version
        url: window.location.href,
        online: navigator.onLine,
      };

      // If user is logged in, attach their UID (helps debug specific user states)
      if (firebase.auth().currentUser) {
        payload.uid = firebase.auth().currentUser.uid;
      }

      db.collection("crash_reports")
        .add(payload)
        .then(() => {
          // Send to Notion Bug Tracker via Cloud Functions
          fetch("https://us-central1-mon50ccetmoi.cloudfunctions.net/reportToNotion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `[BUG] ${errorData.type}: ${String(errorData.message).substring(0, 50)}`,
              description: `Message: ${errorData.message}\nURL: ${payload.url}\nUserAgent: ${payload.userAgent}\nStack: ${errorData.stack}`,
              category: "Bug Technique",
              priority: "High"
            })
          }).catch(err => console.warn("🛡ï¸  Failed to sync to Notion", err));
        })
        .catch((err) =>
          console.warn(
            "🛡ï¸ Failed to send crash report (probably offline).",
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
      console.warn("🛡ï¸ CrashReporter internal error:", e);
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
