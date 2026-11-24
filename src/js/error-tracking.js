/**
 * 🛡️ Crash Reporter & Error Tracking
 * Enterprise-grade monitoring system for mon50ccetmoi
 * Capte les erreurs JavaScript et les promesses rejetées, sans gêner le pilote.
 * Elles ne sont plus envoyées nulle part depuis le 24/11/2026 : Firestore est fermé et la fonction qui les
 * transmettait à Notion (Google Cloud) est coupée. L'erreur reste dans la console.
 * À reprendre sur le serveur souverain (une route de rapport d'erreur) si on veut les relire un jour.
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

  logError: function () {},
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
