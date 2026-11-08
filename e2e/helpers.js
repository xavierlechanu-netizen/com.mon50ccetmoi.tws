// Outils partagés par les tests navigateur (*.e2e.js).

/** Ouvre une page en relevant les erreurs JS et les fichiers du site manquants. */
export async function openAndWatch(page, url, { settleMs = 1500 } = {}) {
  const pageErrors = [];
  const missing = [];
  page.on("pageerror", (err) => pageErrors.push(String(err.message || err).slice(0, 300)));
  page.on("response", (res) => {
    const u = new URL(res.url());
    if (u.hostname === "localhost" && res.status() >= 400 && !u.pathname.endsWith("favicon.ico")) {
      missing.push(`${res.status()} ${u.pathname}`);
    }
  });
  page.on("dialog", (d) => d.dismiss().catch(() => {})); // alert/confirm : jamais bloquants
  // Scripts bloqués par la CSP stricte (ex. un onclick= oublié) : relevés par la page elle-même
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      if (/^script-src/.test(e.effectiveDirective)) {
        window.__cspViolations.push(`${e.effectiveDirective} ${e.blockedURI || "inline"} ${e.sourceFile || ""}:${e.lineNumber || ""}`);
      }
    });
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(settleMs);
  const cspViolations = await page.evaluate(() => window.__cspViolations || []).catch(() => []);
  return { pageErrors, missing, cspViolations };
}
