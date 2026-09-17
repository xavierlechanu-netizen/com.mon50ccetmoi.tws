import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

// Plugin Vite pour remplacer post-build.mjs
function legacyBundlerPlugin() {
  return {
    name: 'legacy-bundler',
    apply: 'build',
    enforce: 'post',
    generateBundle(options, bundle) {
      const appHtmlAsset = bundle['app.html'];
      if (!appHtmlAsset) return;

      const htmlContent = appHtmlAsset.source;
      const $ = cheerio.load(htmlContent);
      
      const excludedScripts = [
        'infallible.js',
        'config.js',
        'error-tracking.js',
        'oracle-voice.js'
      ];
      
      const scriptsToBundle = [];
      let bundledContent = '/** MON50CCETMOI MASTER BUNDLE — UTF-8 **/\n';
      
      // Sélectionner tous les scripts locaux (ignorant http/https)
      $('script').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('/js/') || src?.startsWith('js/')) {
          const cleanName = src.split('/').pop().split('?')[0];
          
          if (!excludedScripts.includes(cleanName)) {
            const scriptPath = path.resolve(__dirname, 'public', 'js', cleanName);
            if (fs.existsSync(scriptPath)) {
              scriptsToBundle.push({ el, name: cleanName, path: scriptPath });
            }
          }
        }
      });

      if (scriptsToBundle.length === 0) return;

      console.log(`\n[legacy-bundler] Regroupement de ${scriptsToBundle.length} scripts...`);

      scriptsToBundle.forEach((scriptInfo, index) => {
        let content = fs.readFileSync(scriptInfo.path, 'utf8');
        content = content.replace(/\uFEFF/g, ''); // Retirer BOM
        bundledContent += `\n/* --- ${scriptInfo.name} --- */\n` + content + '\n';
        
        if (index === 0) {
          $(scriptInfo.el).replaceWith('<script defer src="/js/mon50cc-bundle.js" charset="utf-8"></script>');
        } else {
          $(scriptInfo.el).remove();
        }
      });

      // Émettre le nouveau fichier bundle
      this.emitFile({
        type: 'asset',
        fileName: 'js/mon50cc-bundle.js',
        source: bundledContent
      });

      // Mettre à jour le HTML
      appHtmlAsset.source = $.html();
      console.log(`[legacy-bundler] ✅ Bundle généré et injecté dans app.html`);
    }
  };
}

export default defineConfig({
  server: {
    port: 5000,
  },
  base: '/',
  plugins: [legacyBundlerPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        login: resolve(__dirname, 'login.html'),
        marketplace: resolve(__dirname, 'marketplace.html'),
        insurance: resolve(__dirname, 'insurance.html'),
        watch: resolve(__dirname, 'watch.html'),
        admin: resolve(__dirname, 'admin.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        offline: resolve(__dirname, 'offline.html'),
        beta: resolve(__dirname, 'beta.html'),
        banned: resolve(__dirname, 'banned.html'),
        assureur: resolve(__dirname, 'assureur.html'),
        assurance: resolve(__dirname, 'assurance.html'),
        partenaires: resolve(__dirname, 'partenaires.html'),
        cookies: resolve(__dirname, 'cookies.html'),
        cgv: resolve(__dirname, 'cgv.html'),
        mentions: resolve(__dirname, 'mentions-legales.html'),
        profile: resolve(__dirname, 'profile.html'),
        moderation: resolve(__dirname, 'moderation.html'),
        garage: resolve(__dirname, 'garage.html'),
        p404: resolve(__dirname, '404.html'),
        codeRoute: resolve(__dirname, 'code-de-la-route.html'),
        contratRoute: resolve(__dirname, 'contrat-de-route.html'),
        radarDanger: resolve(__dirname, 'radar-danger.html'),
        maProgression: resolve(__dirname, 'ma-progression.html')
      }
    }
  }
});
