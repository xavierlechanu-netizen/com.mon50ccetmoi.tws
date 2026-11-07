import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Générer dynamiquement les entrées pour Rollup (tous les .html dans src/)
const srcDir = resolve(__dirname, 'src');
const htmlFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.html'));
const inputMap = {};
htmlFiles.forEach(file => {
    const name = file.replace('.html', '');
    inputMap[name] = resolve(srcDir, file);
});

// Content-Security-Policy injectée dans chaque page (audit 2026-11, E1).
// GitHub Pages (mon50ccetmoi.com) n'envoie pas les en-têtes de firebase.json : la balise <meta>
// est la seule protection CSP sur le domaine principal.
// 'unsafe-inline' reste nécessaire pour les scripts tant que les onclick= et scripts inline
// (Axeptio, Google Sign-In) n'ont pas été migrés vers data-action (Phase 5).
// frame-ancestors est ignoré en <meta> : il reste dans firebase.json.
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://*.gstatic.com',
    'https://apis.google.com', 'https://unpkg.com', 'https://cdnjs.cloudflare.com',
    'https://translate.googleapis.com', 'https://accounts.google.com', 'https://merchant.revolut.com',
    'https://cdn.revolut.com', 'https://connect.facebook.net', 'https://static.axept.io'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com',
    'https://unpkg.com', 'https://translate.googleapis.com', 'https://accounts.google.com', 'https://static.axept.io'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'https://static.axept.io'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'media-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'", 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.firebaseio.com',
    'wss://*.firebaseio.com', 'https://*.cloudfunctions.net', 'https://*.a.run.app', 'https://*.mon50ccetmoi.com',
    'https://merchant.revolut.com', 'https://cdn.revolut.com', 'https://api.piste.gouv.fr', 'https://oauth.piste.gouv.fr',
    'https://apicarto.ign.fr', 'https://data.geopf.fr', 'https://*.project-osrm.org', 'https://nominatim.openstreetmap.org',
    'https://overpass-api.de', 'https://*.overpass-api.de', 'https://api.open-meteo.com', 'https://data.economie.gouv.fr',
    'https://recherche-entreprises.api.gouv.fr', 'https://*.axept.io', 'https://cdnjs.cloudflare.com',
    'https://unpkg.com', 'https://cdn.jsdelivr.net',
    // Connexion Google (Google Identity Services) : exigé par Google pour la fenêtre de choix du compte
    'https://accounts.google.com/gsi/'],
  'frame-src': ["'self'", 'https://mon50ccetmoi.firebaseapp.com', 'https://merchant.revolut.com', 'https://cdn.revolut.com', 'https://translate.google.com',
    'https://accounts.google.com', 'https://www.google.com', 'https://www.youtube.com'],
  'worker-src': ["'self'", 'blob:'],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

const CSP_META_CONTENT = Object.entries(CSP_DIRECTIVES)
  .map(([k, v]) => `${k} ${v.join(' ')}`)
  .join('; ');

const cspMetaPlugin = {
  name: 'inject-csp-meta',
  transformIndexHtml(html) {
    if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) return html;
    return html.replace(/<head([^>]*)>/i,
      `<head$1>\n    <meta http-equiv="Content-Security-Policy" content="${CSP_META_CONTENT}">`);
  },
};

export default defineConfig({
  plugins: [cspMetaPlugin],
  root: 'src',
  publicDir: 'public', // Résolu par rapport à root (donc src/public)
  server: {
    port: 5000,
  },
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: inputMap,
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('localforage')) {
              return 'vendor-storage';
            }
            return 'vendor-libs';
          }
        }
      }
    }
  }
});
